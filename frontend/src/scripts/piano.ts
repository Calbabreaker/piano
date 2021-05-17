import { generateNotesFromRange, getNoteName, getOctave, keyBinds } from "./notes";
import * as Soundfont from "soundfont-player";
import { ControlPanel } from "./control_panel";
import { htmlToElement, mainElm } from "./dom_utils";

interface IActiveNote {
    audioNode?: Soundfont.Player;
    key: HTMLElement;
}

export class Piano {
    audioContext = new AudioContext();
    activeNoteMap = new Map<string, IActiveNote>();

    mouseIsPressed = false;
    controlPanel = new ControlPanel();

    get instrument(): Soundfont.Player | null {
        return this.controlPanel.instrument;
    }

    constructor(startNote: string, endNote: string) {
        window.addEventListener("mousedown", () => {
            this.mouseIsPressed = true;
        });

        window.addEventListener("mouseup", () => {
            this.mouseIsPressed = false;
            this.stopAllNotes();
        });

        window.addEventListener("keydown", (event) => {
            const note = keyBinds[event.code];
            if (note) {
                this.playNote(note);

                if (!event.shiftKey) event.preventDefault();
            }
        });

        window.addEventListener("keyup", (event) => {
            const note = keyBinds[event.code];
            if (note) this.stopNote(note);
        });

        this.createDOM(startNote, endNote);
    }

    playNote(note: string, includeShift = true): void {
        if (this.activeNoteMap.has(note)) return;

        const octave = getOctave(note) + (includeShift ? this.controlPanel.octaveShift : 0);
        const noteReal = getNoteName(note) + octave;
        const key = document.querySelector<HTMLElement>(`[data-note~="${noteReal}"]`);

        if (key) {
            key.classList.add("pressed");
            let node: Soundfont.Player | undefined;
            if (this.instrument) {
                node = this.instrument.play(noteReal, undefined, {
                    gain: this.controlPanel.volume,
                });
            }

            this.activeNoteMap.set(note, { audioNode: node, key });
        }
    }

    stopNote(note: string): void {
        const activeNote = this.activeNoteMap.get(note);

        if (activeNote) {
            activeNote.key.classList.remove("pressed");
            this.activeNoteMap.delete(note);
            if (!this.controlPanel.sustain && this.instrument && activeNote.audioNode) {
                activeNote.audioNode.stop();
            }
        }
    }

    stopAllNotes(): void {
        const keys = document.querySelectorAll(".pressed");
        keys.forEach((key) => {
            key.classList.remove("pressed");
        });

        if (!this.controlPanel.sustain && this.instrument) {
            this.instrument.stop();
            this.activeNoteMap.clear();
        }
    }

    createDOM(startNote: string, endNote: string): void {
        const piano = htmlToElement(`<div class="piano"/>`);
        mainElm.appendChild(piano);

        const { notes, whiteKeys } = generateNotesFromRange(startNote, endNote);
        piano.style.setProperty("--white-keys", whiteKeys.toString());

        notes.forEach((note) => {
            const isWhite = getNoteName(note).length === 1;
            const key = htmlToElement(
                `<div class="key ${isWhite ? "white" : "black"}" data-note="${note}"/>`
            );

            key.onmousedown = () => this.playNote(note, false);
            key.onmouseup = () => this.stopNote(note);
            key.onmouseenter = () => this.mouseIsPressed && this.playNote(note, false);
            key.onmouseleave = () => this.stopNote(note);

            piano.appendChild(key);
        });
    }
}
