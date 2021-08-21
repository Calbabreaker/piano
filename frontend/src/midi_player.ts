import { Midi } from "@tonejs/midi";

const indexMapInterval = 1000;

export class MidiPlayer {
    playNote: (note: string, velocity: number) => void;
    stopNote: (note: string) => void;

    midiJSON: Midi | null = null;
    // array representing each tracks' note mapped every indexMapInterval
    tracksIndexMap: number[][];
    midiTotalDuration: number;

    tracksIndexUpTo: number[] = [];
    midiPlaying: boolean = false;
    midiCurrentTime: number;
    timeStarted: number;

    constructor(playNote: MidiPlayer["playNote"], stopNote: MidiPlayer["stopNote"]) {
        this.playNote = playNote;
        this.stopNote = stopNote;
    }

    setMidiFile(file: File | undefined) {
        this.midiPlaying = false;
        if (!file) {
            this.midiJSON = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = () => this.generatePlayInfo(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(file);
    }

    generatePlayInfo(readResult: ArrayBuffer) {
        this.midiJSON = new Midi(readResult);

        // filter empty tracks
        this.midiJSON.tracks = this.midiJSON.tracks.filter((track) => track.notes.length !== 0);

        this.midiTotalDuration = null;
        this.tracksIndexMap = [];
        this.midiCurrentTime = 0;
        this.midiJSON.tracks.forEach((track) => {
            const indexMap = [];
            track.notes.forEach((note, i) => {
                if (note.time * 1000 >= indexMap.length * indexMapInterval) {
                    indexMap.push(i);
                }
            });

            this.tracksIndexMap.push(indexMap);

            const lastNote = track.notes[track.notes.length - 1];
            const totalDuration = lastNote.time + lastNote.duration;
            if (totalDuration > this.midiTotalDuration) {
                this.midiTotalDuration = totalDuration;
            }
        });
    }

    update() {
        this.midiJSON.tracks.forEach((track, i) => {
            const indexUpTo = this.tracksIndexUpTo[i];

            if (indexUpTo >= track.notes.length) return;
            const note = track.notes[indexUpTo];

            const now = performance.now() - this.timeStarted;
            const delta = now - note.time * 1000;
            if (delta > 0) {
                this.playNote(note.name, note.velocity);
                setTimeout(() => this.stopNote(note.name), note.duration * 1000);
                this.tracksIndexUpTo[i]++;
            }
        });
    }

    resume() {
        if (!this.midiJSON) return alert("No MIDI file selected!");

        this.timeStarted = performance.now();

        // this will map the currentTime to every indexMapInterval
        const currentInterval = Math.floor(this.midiCurrentTime / indexMapInterval);
        this.midiCurrentTime = currentInterval * indexMapInterval;
        this.tracksIndexMap.forEach((indexMap, i) => {
            this.tracksIndexUpTo[i] = indexMap[currentInterval];
        });

        this.midiPlaying = true;

        const updateLoop = () => {
            if (!this.midiPlaying) return;

            this.update();
            requestAnimationFrame(updateLoop);
        };

        updateLoop();
    }

    pause() {
        this.midiPlaying = false;
    }
}
