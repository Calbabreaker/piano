import { Midi } from "@tonejs/midi";
import { writable, get } from "svelte/store";

export const midiPlaying = writable(false);
export const midiCurrentTime = writable(0);
export const midiTotalTime = writable(0);
export const midiFile = writable<File | undefined>();

// time in milliseconds beewtween storing a note index for quick access
export const midiIntervalSize = 100;
export const midiIntervalToSecond = midiIntervalSize / 1000;

export function midiPlayerSetup(
    playNote: (note: string, velocity: number) => void,
    stopNote: (note: string) => void
) {
    let tracksIndexUpTo: number[] = [];
    let timeStarted: number;
    // array representing each tracks' note mapped every indexMapInterval
    let tracksIndexMap: number[][];
    let midiJSON: Midi | null = null;
    let midiCurrentInterval: number = 0;

    function generatePlayInfo(readResult: ArrayBuffer) {
        midiJSON = new Midi(readResult);

        // filter empty tracks
        midiJSON.tracks = midiJSON.tracks.filter((track) => track.notes.length !== 0);

        let totalTime = 0;
        tracksIndexMap = [];
        midiJSON.tracks.forEach((track) => {
            const indexMap = [];
            track.notes.forEach((note, i) => {
                while (note.time * 1000 >= indexMap.length * midiIntervalSize) {
                    indexMap.push(i);
                }
            });

            tracksIndexMap.push(indexMap);

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

    midiCurrentTime.subscribe((time) => {
        if (time > get(midiTotalTime)) midiPlaying.set(false);
        midiCurrentInterval = Math.round(time / midiIntervalToSecond);
    });

    function update() {
        // go to next interval if need to
        const nextInterval = midiCurrentInterval + 1;
        const midiActualTime = nextInterval * midiIntervalSize;
        if (performance.now() - timeStarted > midiActualTime) {
            // setting midiCurrentTime will set midiCurrentInterval later
            midiCurrentTime.set(nextInterval * midiIntervalToSecond);
        }

        midiJSON.tracks.forEach((track, i) => {
            const note = track.notes[tracksIndexUpTo[i]];
            if (!note) return;

            const now = performance.now() - timeStarted;
            const delta = now - note.time * 1000;
            if (delta > 0) {
                if (delta < 100) {
                    playNote(note.name, note.velocity);
                    setTimeout(() => stopNote(note.name), note.duration * 1000);
                }

                tracksIndexUpTo[i]++;
            }
        });
    }

    midiPlaying.subscribe((playing) => {
        if (!playing) return;
        if (!midiJSON) {
            midiPlaying.set(false);
            return alert("No MIDI file selected!");
        }

        timeStarted = performance.now() - midiCurrentInterval * midiIntervalSize;

        tracksIndexMap.forEach((indexMap, i) => {
            tracksIndexUpTo[i] = indexMap[midiCurrentInterval];
        });

        const updateLoop = () => {
            if (!get(midiPlaying)) return;

            update();
            requestAnimationFrame(updateLoop);
        };

        updateLoop();
    });
}
