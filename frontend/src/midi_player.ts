import { Midi } from "@tonejs/midi";
import { writable, get } from "svelte/store";
import { midiToNote } from "./notes";

export const midiPlaying = writable(false);
export const midiCurrentTime = writable(0); // time in seconds
export const midiTotalTime = writable(0); // time in seconds
export const midiFile = writable<File | undefined>();
export const midiSpeed = writable(1);

export async function midiPlayerSetup(
    playNote: (note: string, velocity: number) => void,
    stopNote: (note: string) => void
) {
    let tracksIndexUpTo: number[] = [];
    let midiJSON: Midi | null = null;

    function generatePlayInfo(readResult: ArrayBuffer) {
        midiJSON = new Midi(readResult);

        // filter empty tracks
        midiJSON.tracks = midiJSON.tracks.filter((track) => track.notes.length !== 0);

        let totalTime = 0;
        midiJSON.tracks.forEach((track) => {
            const lastNote = track.notes[track.notes.length - 1];
            const totalDuration = lastNote.time + lastNote.duration;
            if (totalDuration > totalTime) {
                totalTime = totalDuration;
            }
        });

        midiTotalTime.set(totalTime);
    }

    midiFile.subscribe((file) => {
        midiPlaying.set(false);
        midiTotalTime.set(0);
        midiCurrentTime.set(0);
        if (!file) {
            midiJSON = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = () => generatePlayInfo(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(file);
    });

    function update(delta: number) {
        const midiNow = get(midiCurrentTime) + delta;
        midiCurrentTime.set(midiNow);

        midiJSON.tracks.forEach((track, i) => {
            const note = track.notes[tracksIndexUpTo[i]];
            if (!note) return;

            const delta = midiNow - note.time;
            if (delta > 0) {
                playNote(note.name, note.velocity);
                setTimeout(() => stopNote(note.name), (note.duration * 1000) / get(midiSpeed));

                tracksIndexUpTo[i]++;
            }
        });

        if (midiNow > get(midiTotalTime)) midiPlaying.set(false);
    }

    midiPlaying.subscribe((playing) => {
        if (!playing) return;
        if (!midiJSON) {
            midiPlaying.set(false);
            return alert("No MIDI file selected!");
        }

        // uses binary search to get fill indexUpTo
        midiJSON.tracks.forEach((track, trackI) => {
            let left = 0;
            let right = track.notes.length - 1;
            while (left != right) {
                const i = Math.ceil((left + right) / 2);
                const note = track.notes[i];
                if (note.time > get(midiCurrentTime)) {
                    right = i - 1;
                } else {
                    left = i;
                }
            }

            tracksIndexUpTo[trackI] = left;
        });

        let lastFrameTime = performance.now();
        const updateLoop = () => {
            if (!get(midiPlaying)) return;

            const now = performance.now();
            const delta = now - lastFrameTime;
            lastFrameTime = now;
            update((delta / 1000) * get(midiSpeed));
            requestAnimationFrame(updateLoop);
        };

        updateLoop();
    });

    function onMidiEvent(event: WebMidi.MIDIMessageEvent) {
        const [command, key, velocity] = event.data;
        // if (command != 258 && command != 248 && command != 254) console.log(event.data);
        if (command > 143 && command < 160) {
            if (velocity == 0) {
                stopNote(midiToNote(key));
            } else {
                playNote(midiToNote(key), velocity / 127);
            }
        } else if (command > 127 && command < 144) {
            stopNote(midiToNote(key));
        }
    }

    const access = await navigator.requestMIDIAccess();
    function connectDevices() {
        access.inputs.forEach((input) => {
            input.onmidimessage = onMidiEvent;
        });
    }

    connectDevices();
    access.onstatechange = () => {
        connectDevices();
    };
}
