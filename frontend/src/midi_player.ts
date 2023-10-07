import { Midi, Track } from "@tonejs/midi";
import type { Note, NoteConstructorInterface } from "@tonejs/midi/dist/Note";
import { writable, get } from "svelte/store";
import { noteToMidi } from "./notes";
import { binarySearch, swapRemove } from "./utils";

// Play and record midi files
export class MidiPlayer {
    // These need to use svelte stores so that the ui can update dynamically
    // And so we can listen when it changes
    midiIsPlaying = writable(false);
    midiCurrentTime = writable(0); // time in seconds
    midiTotalTime = writable(0); // time in seconds
    midiSpeed = writable(1);
    midiIsRecording = writable(false);
    selectedMidiTrack = writable(0);
    midiData = new Midi();
    midiTracks = writable<Track[]>(this.midiData.tracks); // A seperate svelte store referencing this.midiData.tracks to notify and dynamically update when tracks changes
    midiPlaySolo = writable(false);

    // Reference to the startRecording or startPlaying function, whatever was called last
    // This is used for when something needs to stop temporarly and start again
    lastStartFunc = () => {};

    private tracksIndexUpTo: number[] = []; // Stores the note index that we are up to when playing for every track
    private loopIntervalID?: number;
    private playingHeldNotes: Note[] = [];
    private recordingHeldNotes = new Map<number, NoteConstructorInterface>();
    private recoringMidiData: Midi | null = null;
    private midiLastStartTime = 0; // The midi time when startPlaying or startRecording was called for seeking back when stopping

    // Note play functions to be set by the piano
    onPlayNote?: (note: string, velocity: number) => void;
    onStopNote?: (note: string) => void;

    constructor() {
        // Update the total time whenver the track information changes
        this.midiTracks.subscribe((tracks) => {
            console.log(tracks.map((t) => t.instrument.family));
            const totalTime = tracks.length == 0 ? 0 : this.midiData.duration;
            this.midiTotalTime.set(totalTime);
            this.midiCurrentTime.set(Math.min(totalTime, get(this.midiCurrentTime)));
        });
    }

    startPlaying() {
        this.recalcPlayIndex();

        // Create the playing loop
        this.startLoop((midiNow) => {
            this.onPlayUpdate(midiNow);

            // Stop playing once it reaches the end
            if (midiNow > get(this.midiTotalTime)) {
                this.stop();
                this.lastStartFunc = () => {};
            }
        });

        this.midiIsPlaying.set(true);
        this.lastStartFunc = this.startPlaying.bind(this);
        this.midiLastStartTime = get(this.midiCurrentTime);
    }

    startRecording() {
        this.stop();

        if (this.midiData.tracks.length == 0) {
            this.addTrack();
        }

        // Remove the track the we're currently recording in since we're overwriting it
        this.midiData.tracks[get(this.selectedMidiTrack)].notes = [];

        // We need to clone the midiData since we're also playing the tracks at the same time
        // This way we don't interfere with the playing
        this.recoringMidiData = this.midiData.clone();

        this.recalcPlayIndex();
        this.startLoop((midiNow) => {
            this.onPlayUpdate(midiNow);

            // Increase total time as the time reaches the end
            if (midiNow > get(this.midiTotalTime)) {
                this.midiTotalTime.set(midiNow);
            }
        });

        this.midiIsRecording.set(true);
        this.lastStartFunc = this.startRecording.bind(this);
        this.midiLastStartTime = get(this.midiCurrentTime);
    }

    // Stop playing or recording and resets
    stop() {
        clearInterval(this.loopIntervalID);
        this.playingHeldNotes.forEach((note) => this.onStopNote(note.name));
        this.playingHeldNotes = [];
        this.midiIsPlaying.set(false);

        // Set the midi data copy
        if (this.recoringMidiData) {
            this.midiData = this.recoringMidiData;
            this.recoringMidiData = null;
            this.midiTracks.set(this.midiData.tracks);
        }

        // Reset recording data
        this.midiIsRecording.set(false);
        this.recordingHeldNotes.clear();
    }

    recordPlayNote(note: string, velocity: number) {
        if (get(this.midiIsRecording)) {
            const midi = noteToMidi(note);
            // Store the note and then later add it into the midi track when the note is release
            this.recordingHeldNotes.set(midi, {
                midi,
                velocity,
                time: get(this.midiCurrentTime),
            });
        }
    }

    recordStopNote(note: string) {
        if (get(this.midiIsRecording)) {
            const midi = noteToMidi(note);
            const noteObject = this.recordingHeldNotes.get(midi);

            if (noteObject) {
                noteObject.duration = get(this.midiCurrentTime) - noteObject.time;
                this.recoringMidiData.tracks[get(this.selectedMidiTrack)].addNote(noteObject);
                this.recordingHeldNotes.delete(midi);
            }
        }
    }

    addTrack() {
        const track = this.midiData.addTrack();
        this.selectedMidiTrack.set(this.midiData.tracks.length - 1);
        this.midiTracks.set(this.midiData.tracks);

        const trackName = prompt("Enter the track name: ");
        if (trackName) {
            track.name = trackName;
        }
    }

    deleteTrack() {
        const selectedMidiTrack = get(this.selectedMidiTrack);
        this.midiData.tracks.splice(selectedMidiTrack, 1);
        this.selectedMidiTrack.set(Math.min(this.midiData.tracks.length - 1, selectedMidiTrack));
        this.midiTracks.set(this.midiData.tracks);
    }

    saveFile() {
        this.stop();

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

        this.stop();

        // When the midiFile is changednd read in the new midiFile data
        const reader = new FileReader();
        reader.onload = () => {
            this.midiData = new Midi(reader.result as ArrayBuffer);
            this.midiTracks.set(this.midiData.tracks);
        };
        reader.readAsArrayBuffer(file);
    }

    // Stop playing/recording and jump back to when the user stared playing/recording
    stopAndReseek() {
        this.stop();
        // Clear function reference
        this.lastStartFunc = () => {};
        this.midiCurrentTime.set(this.midiLastStartTime);
    }

    // Find where we are up to for all the tracks based on the current time
    private recalcPlayIndex() {
        this.midiData.tracks.forEach((track, i) => {
            const currentTime = get(this.midiCurrentTime);

            // We can binary search since the are all sorted
            this.tracksIndexUpTo[i] = binarySearch(track.notes, (note) => note.time - currentTime);
        });
    }

    // Starts a contiuous loop calling loopFunc every iteration with the current midi time
    private startLoop(loopFunc: (midiNow: number) => void) {
        let lastLoopTime = performance.now();
        this.loopIntervalID = setInterval(() => {
            const now = performance.now();
            const delta = now - lastLoopTime;

            // Caclute the midi current time (in seconds) scaled with the speed
            const deltaSecs = (delta / 1000) * get(this.midiSpeed);
            const midiNow = get(this.midiCurrentTime) + deltaSecs;
            loopFunc(midiNow);

            this.midiCurrentTime.set(midiNow);
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

        const checkTracks = (track: Track, i: number) => {
            // Keep going through all notes that are behind the current time and play them to do simultaneous notes
            // and to catch up with any notes that were behind
            while (true) {
                const note = track.notes[this.tracksIndexUpTo[i]];
                if (!note || midiNow < note.time) {
                    break;
                }

                // But don't play them if they're already completely played
                if (note.time + note.duration > midiNow) {
                    this.onPlayNote(note.name, note.velocity);
                    this.playingHeldNotes.push(note);
                }

                this.tracksIndexUpTo[i]++;
            }
        };

        if (get(this.midiPlaySolo)) {
            const i = get(this.selectedMidiTrack);
            checkTracks(this.midiData.tracks[i], i);
        } else {
            this.midiData.tracks.forEach(checkTracks);
        }
    }
}
