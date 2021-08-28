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
    CapsLock: "A#4",
    ShiftLeft: "B4",
    KeyZ: "C5",
    KeyS: "C#5",
    KeyX: "D5",
    KeyD: "D#5",
    KeyC: "E5",
    KeyV: "F5",
    KeyG: "F#5",
    KeyB: "G5",
    KeyH: "G#5",
    KeyN: "A5",
    KeyJ: "A#5",
    KeyM: "B5",
    Comma: "C6",
    KeyL: "C#6",
    Period: "D6",
    Semicolon: "D#6",
    Slash: "E6",
    ShiftRight: "F6",
    Enter: "F#6",
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

export type INoteMap = { [key: string]: INote | undefined };

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
