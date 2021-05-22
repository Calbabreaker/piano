import { keyBinds } from "./notes";
import * as Soundfont from "soundfont-player";
import { ControlPanel } from "./control_panel";
import { MidiPlayer } from "./midi_player";
import { Keyboard } from "./keyboard";
import { SocketPlayer } from "./socket_player";
import { InstrumentCache } from "./utils";

export class Piano {
    // Keyboard is the lower level class that will actually do the playing and note pressing
    // while this class will handle events.
    keyboard = new Keyboard();

    mouseIsDown = false;
    instrumentCache = new InstrumentCache();
    midiPlayer = new MidiPlayer(this.pressNote.bind(this));
    socketPlayer = new SocketPlayer(this.keyboard, this.instrumentCache);
    controlPanel = new ControlPanel(
        this.midiPlayer,
        this.socketPlayer,
        this.instrumentCache,
        this.stopAllNotes.bind(this)
    );

    get instrument(): Soundfont.Player | undefined {
        return this.controlPanel.instrument;
    }

    constructor(startNote: string, endNote: string) {
        this.keyboard.createDOM(startNote, endNote);

        window.addEventListener("mousedown", () => {
            this.mouseIsDown = true;
        });

        window.addEventListener("mouseup", () => {
            this.mouseIsDown = false;
            this.stopAllNotes();
        });

        window.addEventListener("keydown", (event) => {
            const note = keyBinds[event.code];
            const target = event.target as HTMLElement;
            if (!note || target.tagName === "INPUT") return;

            this.playNote(note);

            if (!event.shiftKey) event.preventDefault();
        });

        window.addEventListener("keyup", (event) => {
            const note = keyBinds[event.code];
            if (note) this.stopNote(note);
        });

        const playNoteEvent = (event: MouseEvent | TouchEvent) => {
            const key = event.target as HTMLDivElement | undefined;
            if (key?.dataset?.note) this.playNote(key.dataset.note, 1, false);
        };

        const stopNoteEvent = (event: MouseEvent | TouchEvent) => {
            const key = event.target as HTMLDivElement | undefined;
            if (key?.dataset?.note) this.stopNote(key.dataset.note, false);
        };

        window.addEventListener("mousedown", (event) => {
            playNoteEvent(event);
            this.mouseIsDown = true;
        });

        window.addEventListener("mouseover", (event) => {
            if (!this.mouseIsDown) return;
            playNoteEvent(event);
        });

        window.addEventListener("mouseup", () => {
            this.stopAllNotes();
            this.mouseIsDown = false;
        });

        window.addEventListener("mouseout", stopNoteEvent);

        window.addEventListener("touchstart", playNoteEvent);
        window.addEventListener("touchcancel", stopNoteEvent);
        window.addEventListener("touchend", stopNoteEvent);

        if (this.keyboard.element) {
            this.keyboard.element.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
        }
    }

    playNote(note: string, velocity = 1, includeShift = true): void {
        if (includeShift) note = this.controlPanel.getShiftedNote(note);

        const ableToPlay = this.socketPlayer.playNote(
            note,
            this.controlPanel.instrumentName,
            this.controlPanel.volume
        );

        if (!ableToPlay)
            this.keyboard.playNote(this.instrument, note, velocity * this.controlPanel.volume);
    }

    stopNote(note: string, includeShift = true): void {
        if (includeShift) note = this.controlPanel.getShiftedNote(note);

        const ableToStop = this.socketPlayer.stopNote(
            note,
            this.controlPanel.instrumentName,
            this.controlPanel.sustain
        );

        if (!ableToStop) this.keyboard.stopNote(this.instrument, note, this.controlPanel.sustain);
    }

    pressNote(note: string, duration: number, velocity = 1) {
        this.playNote(note, velocity);
        setTimeout(() => this.stopNote(note), duration);
    }

    stopAllNotes(): void {
        const keys = document.querySelectorAll(".pressed") as NodeListOf<HTMLDivElement>;
        keys.forEach((key) => {
            key.classList.remove("pressed");
            if (key.dataset.note) this.stopNote(key.dataset.note);
        });
    }
}
