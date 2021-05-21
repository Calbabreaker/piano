import { generateNotesFromRange, getNoteName } from "./notes";
import { htmlToElement, mainElm } from "./utils";
import { Player } from "soundfont-player";

export class Keyboard {
    activeAudioNodes = new Map<string, Player>();
    startNote: string;
    endNote: string;

    constructor(startNote: string, endNote: string) {
        this.startNote = startNote;
        this.endNote = endNote;
    }

    createDOM() {
        const piano = htmlToElement(`<div class="piano"/>`);
        mainElm.appendChild(piano);

        const { notes, whiteKeys } = generateNotesFromRange(this.startNote, this.endNote);
        piano.style.setProperty("--white-keys", whiteKeys.toString());

        notes.forEach((note) => {
            const isWhite = getNoteName(note).length === 1;
            const key = htmlToElement(
                `<div class="key ${isWhite ? "white" : "black"}" data-note="${note}"/>`
            );

            piano.appendChild(key);
        });
    }

    playNote(instrument: Player | undefined, note: string, volume: number): void {
        if (this.activeAudioNodes.has(note)) return;

        const key = document.querySelector<HTMLElement>(`[data-note~="${note}"]`);
        if (key) {
            key.classList.add("pressed");
            if (instrument) {
                this.activeAudioNodes.set(
                    note,
                    instrument.play(note, undefined, {
                        gain: volume,
                    })
                );
            }
        }
    }

    stopNote(instrument: Player | undefined, note: string, sustain: boolean): void {
        const activeNode = this.activeAudioNodes.get(note);

        const key = document.querySelector<HTMLElement>(`[data-note~="${note}"]`);
        if (key) {
            key.classList.remove("pressed");

            if (!sustain && instrument && activeNode) {
                activeNode.stop();
                this.activeAudioNodes.delete(note);
            }
        }
    }

    pressNote(instrument: Player | undefined, note: string, duration: number, volume: number) {
        this.playNote(instrument, note, volume);
        setTimeout(() => this.stopNote(instrument, note, false), duration);
    }

    stopAllNotes(instrument: Player | undefined, sustain: boolean): void {
        const keys = document.querySelectorAll(".pressed");
        keys.forEach((key) => {
            key.classList.remove("pressed");
        });

        if (!sustain && instrument) {
            instrument.stop();
            this.activeAudioNodes.clear();
        }
    }
}
