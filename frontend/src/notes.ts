export const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const keyBinds: { [key: string]: string | undefined } = {
    Backquote: "A#2",
    Tab: "B2",
    KeyQ: "C3",
    Digit2: "C#3",
    KeyW: "D3",
    Digit3: "D#3",
    KeyE: "E3",
    KeyR: "F3",
    Digit5: "F#3",
    KeyT: "G3",
    Digit6: "G#3",
    KeyY: "A3",
    Digit7: "A#3",
    KeyU: "B3",
    KeyI: "C4",
    Digit9: "C#4",
    KeyO: "D4",
    Digit0: "D#4",
    KeyP: "E4",
    BracketLeft: "F4",
    Equal: "F#4",
    BracketRight: "G4",
    Backspace: "G#4",
    Backslash: "A4",
    ShiftLeft: "A4",
    KeyA: "A#4",
    KeyZ: "B4",
    KeyX: "C5",
    KeyD: "C#5",
    KeyC: "D5",
    KeyF: "D#5",
    KeyV: "E5",
    KeyB: "F5",
    KeyH: "F#5",
    KeyN: "G5",
    KeyJ: "G#5",
    KeyM: "A5",
    KeyK: "A#5",
    Comma: "B5",
    Period: "C6",
    Semicolon: "C#6",
    Slash: "D6",
    Quote: "D#6",
    ShiftRight: "E6",
    Enter: "F6",
};

export function getOctave(note: string): number {
    return parseInt(note.charAt(note.length - 1));
}

export function getNoteName(note: string): string {
    return note.substring(0, note.length - 1);
}

import type { Player } from "soundfont-player";

export interface INote {
    pressed: boolean;
    white: boolean;
    audioNode: Player | null;
}

type INoteMap = { [key: string]: INote | undefined };

export function generateNoteMapFromRange(
    startNote: string,
    endNote: string
): { noteMap: INoteMap; whiteKeys: number } {
    const endOctave = getOctave(endNote);
    const startOctave = getOctave(startNote);
    const startNoteNameIndex = noteNames.indexOf(getNoteName(startNote));
    const endNoteNameIndex = noteNames.indexOf(getNoteName(endNote));

    const noteMap: INoteMap = {};
    let whiteKeys = 0;
    // go through each octave
    for (let octave = startOctave; octave <= endOctave; octave++) {
        // if first octave start from `startNote` else use C
        let noteNameIndex = octave === startOctave ? startNoteNameIndex : 0;

        // go through each key
        while (noteNameIndex < noteNames.length) {
            const reachedEndNote = octave === endOctave && noteNameIndex > endNoteNameIndex;
            if (reachedEndNote) break;
            const noteName = noteNames[noteNameIndex];

            const white = noteName.length === 1;
            noteMap[noteName + octave] = { white, pressed: false, audioNode: null };
            if (white) whiteKeys++;

            noteNameIndex++;
        }
    }

    return { noteMap, whiteKeys };
}
