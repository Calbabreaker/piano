import { Midi } from "@tonejs/midi";
import type { Note } from "@tonejs/midi/dist/Note";
import { writable, get } from "svelte/store";
import { midiToNote } from "./notes";

export class MidiPlayer {
    // These need to use svelte store so that the ui can update dynamically
    midiIsPlaying = writable(false);
    midiCurrentTime = writable(0); // time in seconds
    midiTotalTime = writable(0); // time in seconds
    midiFile = writable<File | undefined>();
    midiSpeed = writable(1);

    private tracksIndexUpTo: number[] = [];
    private midiData: Midi | null = null;
    private playIntervalID: number;
    private heldNotes: Note[] = [];
    private midiAccess: WebMidi.MIDIAccess;

    onPlayNote: (note: string, velocity: number) => void;
    onStopNote: (note: string) => void;

    constructor() {
        // When the midiFile is changed, reset all the playing data and read in the new midiFile data
        this.midiFile.subscribe((file) => {
            this.midiIsPlaying.set(false);
            this.midiTotalTime.set(0);
            this.midiCurrentTime.set(0);
            if (!file) {
                this.midiData = null;
                return;
            }

            const reader = new FileReader();
            reader.onload = () => this.generatePlayData(reader.result as ArrayBuffer);
            reader.readAsArrayBuffer(file);
        });

        this.midiIsPlaying.subscribe((isPlaying) => {
            if (!isPlaying) {
                clearInterval(this.playIntervalID);
                this.heldNotes.forEach((note) => this.onStopNote(note.name));
                this.heldNotes = [];
                return;
            }

            if (!this.midiData) {
                this.midiIsPlaying.set(false);
                return alert("No MIDI file selected!");
            }

            // Find where we are up to for all the tracks based on the current time
            this.midiData.tracks.forEach((track, trackI) => {
                const currentTime = get(this.midiCurrentTime);
                const noteIndex = binarySearch(track.notes, (note) => note.time - currentTime);
                this.tracksIndexUpTo[trackI] = noteIndex;
            });

            let lastFrameTime = performance.now();
            this.playIntervalID = setInterval(() => {
                const now = performance.now();
                const delta = now - lastFrameTime;
                lastFrameTime = now;
                this.onUpdate((delta / 1000) * get(this.midiSpeed));
            }, 10);
        });

        navigator.requestMIDIAccess().then((access) => {
            this.midiAccess = access;
            this.connectMidiDevices();
            // Automatically connect midi devices as they plug in
            access.onstatechange = () => {
                this.connectMidiDevices();
            };
        });
    }

    private generatePlayData(readResult: ArrayBuffer) {
        this.midiData = new Midi(readResult);

        // Filter empty tracks
        this.midiData.tracks = this.midiData.tracks.filter((track) => track.notes.length !== 0);

        // Get total time by going through tracks
        let totalTime = 0;
        this.midiData.tracks.forEach((track) => {
            const lastNote = track.notes[track.notes.length - 1];
            const totalDuration = lastNote.time + lastNote.duration;
            if (totalDuration > totalTime) {
                totalTime = totalDuration;
            }
        });

        this.midiTotalTime.set(totalTime);
    }

    private onUpdate(deltaSecs: number) {
        const midiNow = get(this.midiCurrentTime) + deltaSecs;
        this.midiCurrentTime.set(midiNow);

        // Check and release held notes
        this.heldNotes.forEach((note, i) => {
            if (midiNow > note.time + note.duration) {
                this.onStopNote(note.name);
                swapRemove(this.heldNotes, i);
            }
        });

        this.midiData.tracks.forEach((track, i) => {
            // Keep going through all notes that are behind the current time to do simultaneous notes
            // and to catch up with any notes that were behind
            while (true) {
                const note = track.notes[this.tracksIndexUpTo[i]];
                if (!note || midiNow < note.time) {
                    break;
                }

                this.onPlayNote(note.name, note.velocity);
                this.heldNotes.push(note);
                this.tracksIndexUpTo[i]++;
            }
        });

        if (midiNow > get(this.midiTotalTime)) {
            this.midiIsPlaying.set(false);
        }
    }

    private connectMidiDevices() {
        this.midiAccess.inputs.forEach((input) => {
            input.onmidimessage = this.onMidiEvent;
        });
    }

    private onMidiEvent(event: WebMidi.MIDIMessageEvent) {
        const [command, key, velocity] = event.data;
        // if (command != 258 && command != 248 && command != 254) console.log(event.data);

        // These are the midi command ids for playing and stopping a note (uses all 16 midi channels)
        // See https://computermusicresource.com/MIDI.Commands.html
        if (command >= 144 && command <= 159) {
            if (velocity == 0) {
                this.onStopNote(midiToNote(key));
            } else {
                // Play notes with velocity mapped from 1 to 127 -> 0 to 1
                this.onPlayNote(midiToNote(key), velocity / 127);
            }
        } else if (command >= 128 && command <= 143) {
            this.onStopNote(midiToNote(key));
        }
    }
}

// Thanks https://stackoverflow.com/questions/22697936/binary-search-in-javascript
function binarySearch<T>(array: T[], compareFunc: (elm: T) => number): number {
    let left = 0;
    let right = array.length - 1;
    while (left != right) {
        const middle = Math.ceil((left + right) / 2);
        let result = compareFunc(array[middle]);
        if (result > 0) {
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
