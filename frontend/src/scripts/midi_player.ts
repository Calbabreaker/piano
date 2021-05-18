import { Midi } from "@tonejs/midi";
import { midiToNote } from "./notes";

export class MidiPlayer {
    midiToPlay: Midi | null = null;
    pressNoteFunc: (note: string, duration: number, velocity?: number) => void;

    midiPaused = true;
    trackIndexUpToArray: number[] = [];
    timeStarted: number | null = null;
    timestampPaused = 0;
    amountOftimePaused = 0;

    constructor(pressNoteFunc: MidiPlayer["pressNoteFunc"]) {
        this.pressNoteFunc = pressNoteFunc;
    }

    setMidiFile(file?: File) {
        if (!file) {
            this.midiToPlay = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = () => (this.midiToPlay = new Midi(reader.result as ArrayBuffer));
        reader.readAsArrayBuffer(file);
    }

    update(): void {
        if (this.midiPaused || !this.midiToPlay) return;

        this.midiToPlay.tracks.forEach((track, i) => {
            const indexUpTo = this.trackIndexUpToArray[i];

            if (indexUpTo >= track.notes.length) return;
            const note = track.notes[indexUpTo];

            // figure out if time now is next key
            const now = performance.now() - (this.timeStarted ?? 0) - this.amountOftimePaused;
            const delta = now - note.time * 1000;
            if (delta > 0) {
                const noteName = midiToNote(note.midi);
                // don't play the note if we're too behind
                if (delta < 100) this.pressNoteFunc(noteName, note.duration * 1000, note.velocity);
                this.trackIndexUpToArray[i]++;
            }
        });

        requestAnimationFrame(this.update.bind(this));
    }

    pause() {
        this.timestampPaused = performance.now();
        this.midiPaused = true;
    }

    resume() {
        if (!this.midiToPlay) return alert("No midi file selected!");

        if (this.timeStarted == null) {
            this.reset();
        } else {
            this.amountOftimePaused += performance.now() - this.timestampPaused;
        }

        this.midiPaused = false;
        this.update();
    }

    reset() {
        if (!this.midiToPlay) return;
        this.trackIndexUpToArray = new Array(this.midiToPlay.tracks.length).fill(0);
        this.timeStarted = performance.now();
        this.amountOftimePaused = 0;
    }
}
