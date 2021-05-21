import { keyBinds } from "./notes";
import * as Soundfont from "soundfont-player";
import { ControlPanel } from "./control_panel";
import { MidiPlayer } from "./midi_player";
import { Keyboard } from "./keyboard";

export class Piano {
    mouseIsDown = false;
    midiPlayer = new MidiPlayer(this.pressNote.bind(this));
    controlPanel = new ControlPanel(this.midiPlayer, this.stopAllNotes.bind(this));
    keyboard: Keyboard;

    get instrument(): Soundfont.Player | undefined {
        return this.controlPanel.instrument;
    }

    constructor(startNote: string, endNote: string) {
        this.keyboard = new Keyboard(startNote, endNote);
        window.addEventListener("mousedown", () => {
            this.mouseIsDown = true;
        });

        window.addEventListener("mouseup", () => {
            this.mouseIsDown = false;
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

        const mousePlayNote = (event: MouseEvent) => {
            const key = event.target as HTMLDivElement | undefined;
            if (key?.dataset?.note) {
                this.playNote(key.dataset.note, 1, false);
            }
        };

        window.addEventListener("mousedown", mousePlayNote);
        window.addEventListener("mouseenter", mousePlayNote);

        window.addEventListener("mouseup", () => {
            this.stopAllNotes();
        });

        window.addEventListener("mouseleave", (event) => {
            const key = event.target as HTMLDivElement | undefined;
            if (key?.dataset?.note) {
                this.stopNote(key.dataset.note);
            }
        });
    }

    playNote(note: string, velocity = 1, includeShift = true): void {
        if (includeShift) note = this.controlPanel.getShiftedNote(note);
        this.keyboard.playNote(this.instrument, note, velocity * this.controlPanel.volume);
    }

    stopNote(note: string, includeShift = true): void {
        if (includeShift) note = this.controlPanel.getShiftedNote(note);
        this.keyboard.stopNote(this.instrument, note, this.controlPanel.sustain);
    }

    pressNote(note: string, duration: number, velocity = 1) {
        this.keyboard.pressNote(
            this.instrument,
            note,
            duration,
            this.controlPanel.volume * velocity
        );
    }

    stopAllNotes(): void {
        this.keyboard.stopAllNotes(this.instrument, this.controlPanel.sustain);
    }
}
