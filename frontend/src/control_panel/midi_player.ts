import { Midi, Track } from "@tonejs/midi";
import type { Note, NoteConstructorInterface } from "@tonejs/midi/dist/Note";
import { writable, get } from "svelte/store";
import { noteToMidi } from "../notes";

// Play and record midi files
export class MidiPlayer {
    // These need to use svelte stores so that the ui can update dynamically
    // And so we can listen when it changes
    isPlaying = writable(false);
    currentTime = writable(0); // time in seconds
    totalTime = writable(0); // time in seconds
    speed = writable(1);
    isRecording = writable(false);
    selectedTrackI = writable(0);
    midiData = new Midi();
    tracks = writable<Track[]>(this.midiData.tracks); // A seperate svelte store referencing this.midiData.tracks to notify and dynamically update when tracks changes
    shouldPlaySolo = writable(false);

    private tracksIndexUpTo: number[] = []; // Stores the note index that we are up to when playing for every track
    private loopIntervalID: number | null = null;
    private playingHeldNotes: Note[] = [];
    private recordingHeldNotes = new Map<number, NoteConstructorInterface>();
    private backupMidiData: Midi | null = null;
    private lastStartTime = 0; // The midi time when startPlaying or startRecording was called for seeking back when stopping

    // Note play functions to be set by the piano (gets called when needs to be played)
    onPlayNote?: (note: string, velocity: number) => void;
    onStopNote?: (note: string) => void;

    constructor() {
        // Update the total time whenver the track information changes
        this.tracks.subscribe((tracks) => {
            const totalTime = tracks.length == 0 ? 0 : this.midiData.duration;
            this.totalTime.set(totalTime);
            this.currentTime.set(Math.min(totalTime, get(this.currentTime)));
        });
    }

    startPlaying() {
        this.lastStartTime = get(this.currentTime);
        this.stop(); // Ensure nothing is playing to prevent weird bugs
        this.recalcPlayIndex();

        // Create the playing loop
        this.startLoop((midiNow) => {
            this.onPlayUpdate(midiNow);

            // Stop playing once it reaches the end
            if (midiNow > get(this.totalTime)) {
                this.stop();
                this.currentTime.set(0);
            }
        });

        this.isPlaying.set(true);
    }

    startRecording() {
        if (this.midiData.tracks.length == 0) {
            this.addTrack();
        }

        this.backupMidiData = this.midiData.clone();
        this.midiData.tracks[get(this.selectedTrackI)].notes = [];

        this.recalcPlayIndex();
        this.isRecording.set(true);
        this.lastStartTime = get(this.currentTime);
    }

    // Stop playing or recording and resets
    stop(cancelRecording = false) {
        clearInterval(this.loopIntervalID!);
        this.loopIntervalID = null;
        this.playingHeldNotes.forEach((note) => this.onStopNote!(note.name));
        this.playingHeldNotes = [];
        this.isPlaying.set(false);

        // Copy midi data from recording
        if (cancelRecording && this.backupMidiData) {
            this.midiData = this.backupMidiData;
            this.backupMidiData = null;
        }

        this.isRecording.set(false);
        this.recordingHeldNotes.clear();
        this.currentTime.set(this.lastStartTime);
        this.tracks.set(this.midiData.tracks);
    }

    recordPlayNote(note: string, velocity: number) {
        if (!get(this.isRecording)) {
            return;
        }

        // Only start the loop once the first note has been played
        if (this.loopIntervalID === null) {
            this.startLoop((midiNow) => {
                this.onPlayUpdate(midiNow);

                // Increase total time as the time reaches the end
                if (midiNow > get(this.totalTime)) {
                    this.totalTime.set(midiNow);
                }
            });
        }

        const midi = noteToMidi(note);
        // Store the note and then later add it into the midi track when the note is released
        this.recordingHeldNotes.set(midi, {
            midi,
            velocity,
            time: get(this.currentTime),
        });
    }

    recordStopNote(note: string) {
        if (!get(this.isRecording)) {
            return;
        }

        const midi = noteToMidi(note);
        const noteObject = this.recordingHeldNotes.get(midi);

        if (noteObject) {
            noteObject.duration = get(this.currentTime) - noteObject.time;
            this.midiData.tracks[get(this.selectedTrackI)].addNote(noteObject);
            this.recordingHeldNotes.delete(midi);
        }
    }

    addTrack() {
        const track = this.midiData.addTrack();
        this.selectedTrackI.set(this.midiData.tracks.length - 1);
        this.tracks.set(this.midiData.tracks);

        const trackName = prompt("Enter the track name: ");
        if (trackName) {
            track.name = trackName;
        }
    }

    deleteTrack() {
        const selectedTrackI = get(this.selectedTrackI);
        this.midiData.tracks.splice(selectedTrackI, 1);
        this.selectedTrackI.set(Math.min(this.midiData.tracks.length - 1, selectedTrackI));
        this.tracks.set(this.midiData.tracks);
    }

    saveFile() {
        // Creates a url blob of the midi data and downloads the file automatically using a link tag
        const blob = new Blob([this.midiData.toArray()], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "record.midi";

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    setFile(file: File) {
        if (!file) {
            return;
        }

        // When the midiFile is changed read in the new midiFile data
        const reader = new FileReader();
        reader.onload = () => {
            this.midiData = new Midi(reader.result as ArrayBuffer);
            this.tracks.set(this.midiData.tracks);
            this.selectedTrackI.set(0);
        };
        reader.readAsArrayBuffer(file);
    }

    // Find where we are up to for all the tracks based on the current time
    private recalcPlayIndex() {
        this.midiData.tracks.forEach((track, i) => {
            const currentTime = get(this.currentTime);

            // We can binary search since the timings are all in order
            this.tracksIndexUpTo[i] = binarySearch(track.notes, (note) => note.time - currentTime);
        });
    }

    // Starts a contiuous loop calling loopFunc every iteration with the current midi time
    private startLoop(loopFunc: (midiNow: number) => void) {
        let lastLoopTime = performance.now();
        this.loopIntervalID = setInterval(() => {
            const now = performance.now();
            const delta = now - lastLoopTime;

            // Calculate the midi current time (in seconds) scaled with the speed
            const deltaSecs = (delta / 1000) * get(this.speed);
            const midiNow = get(this.currentTime) + deltaSecs;
            this.currentTime.set(midiNow);

            loopFunc(midiNow);

            lastLoopTime = now;
        }, 10);
    }

    // Loop through tracks and plays or stops any notes as needed
    private onPlayUpdate(midiNow: number) {
        // Check and release held notes
        this.playingHeldNotes.forEach((note, i) => {
            if (midiNow > note.time + note.duration) {
                this.onStopNote(note.name);
                swapRemove(this.playingHeldNotes, i);
            }
        });

        if (get(this.shouldPlaySolo)) {
            const i = get(this.selectedTrackI);
            this.checkTracksPlayNotes(midiNow, i);
        } else {
            for (let i = 0; i < this.midiData.tracks.length; i++) {
                this.checkTracksPlayNotes(midiNow, i);
            }
        }
    }

    private checkTracksPlayNotes(midiNow: number, trackI: number) {
        if (get(this.isRecording) && get(this.selectedTrackI) == trackI) {
            return;
        }

        const track = this.midiData.tracks[trackI];
        // Keep going through all notes that are behind the current time and play them to do simultaneous notes
        // and to catch up with any notes that were behind
        while (true) {
            const note = track.notes[this.tracksIndexUpTo[trackI]];
            if (!note || midiNow < note.time) {
                break;
            }

            // But don't play them if they're already completely past
            if (note.time + note.duration > midiNow) {
                this.onPlayNote(note.name, note.velocity);
                this.playingHeldNotes.push(note);
            }

            this.tracksIndexUpTo[trackI]++;
        }
    }
}

// Thanks https://stackoverflow.com/questions/22697936/binary-search-in-javascript
function binarySearch<T>(array: T[], compareFunc: (elm: T) => number): number {
    if (!array || array.length == 0) {
        return 0;
    }

    let left = 0;
    let right = array.length - 1;
    while (left != right) {
        const middle = Math.ceil((left + right) / 2);
        let result = compareFunc(array[middle]);
        if (result >= 0) {
            right = middle - 1;
        } else {
            left = middle;
        }
    }

    return right;
}

function swapRemove<T>(array: T[], i: number) {
    array[i] = array[array.length - 1];
    array.pop();
}
