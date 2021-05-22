import { generateNotesFromRange, getNoteName } from "./notes";
import { htmlToElement, mainElm } from "./utils";
import { Player } from "soundfont-player";

interface IKeyboardThread {
    activeAudioNodes: Map<string, Player>;
    colorHue: number;
}

export class Keyboard {
    threads = new Map<string, IKeyboardThread>();
    element?: HTMLElement;

    constructor() {
        // default thread '0'
        this.addThread("0", 220);
    }

    createDOM(startNote: string, endNote: string) {
        const piano = htmlToElement(`<div class="piano"/>`);
        mainElm.appendChild(piano);

        const { notes, whiteKeys } = generateNotesFromRange(startNote, endNote);
        piano.style.setProperty("--white-keys", whiteKeys.toString());

        notes.forEach((note) => {
            const isWhite = getNoteName(note).length === 1;
            const key = htmlToElement(
                `<div class="key ${isWhite ? "white" : "black"}" data-note="${note}"/>`
            );

            piano.appendChild(key);
        });

        this.element = piano;
    }

    addThread(id: string, colorHue: number): void {
        this.threads.set(id, { activeAudioNodes: new Map(), colorHue });
    }

    playNote(instrument: Player | undefined, note: string, volume: number, threadID = "0"): void {
        const thread = this.threads.get(threadID);
        if (thread === undefined || thread.activeAudioNodes.has(note)) return;

        const key = document.querySelector<HTMLElement>(`[data-note~="${note}"]`);
        if (key) {
            key.style.setProperty("--color-hue", thread.colorHue.toString());
            key.classList.add("pressed");
            if (instrument) {
                thread.activeAudioNodes.set(
                    note,
                    instrument.play(note, undefined, {
                        gain: volume,
                    })
                );
            }
        }
    }

    stopNote(instrument: Player | undefined, note: string, sustain: boolean, threadID = "0"): void {
        const thread = this.threads.get(threadID);
        if (thread === undefined) return;
        const activeNode = thread.activeAudioNodes.get(note);

        const key = document.querySelector<HTMLElement>(`[data-note~="${note}"]`);
        if (key) {
            key.classList.remove("pressed");
            if (!sustain && instrument && activeNode) activeNode.stop();
            thread.activeAudioNodes.delete(note);
        }
    }
}
