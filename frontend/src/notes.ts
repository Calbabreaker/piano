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

// Gets the octave last number from the note (eg. F#6 -> 6)
export function getOctave(note: string): number {
    return parseInt(note.charAt(note.length - 1));
}

// Gets the note name from the note (eg. F#6 -> F#)
export function getNoteName(note: string): string {
    return note.substring(0, note.length - 1);
}

export function midiToNote(midi: number): string {
    const octave = Math.floor(midi / 12) - 1;
    const note = noteNames[midi % 12];
    return note + octave;
}

export interface INote {
    isWhite: boolean;
    // A string that will be a hsl color value of its pressed color if the note is pressed
    // This is to allow multiplayer support from different clients with different colors
    pressedColor: string | null;
    isGhost: boolean;
}

export type INoteMap = { [key: string]: INote | undefined };

// Takes in a note range and returns the noteMap (see above) of all the notes and the number of white keys in order to calculate the width of the piano
export function generateNoteMapFromRange(startNote: string, endNote: string): [INoteMap, number] {
    const endOctave = getOctave(endNote);
    const startOctave = getOctave(startNote);
    const startNoteNameIndex = noteNames.indexOf(getNoteName(startNote));
    const endNoteNameIndex = noteNames.indexOf(getNoteName(endNote));

    // Declare output data
    const noteMap: INoteMap = {};
    let whiteKeys = 0;

    // First octave start from `startNote` then use C for every other octave
    let noteNameIndex = startNoteNameIndex;

    // Go through each octave
    for (let octave = startOctave; octave <= endOctave; octave++) {
        // Go through each key in the current octave
        while (noteNameIndex < noteNames.length) {
            // If we reached the last note of the last octave, break out since we finished
            if (octave === endOctave && noteNameIndex > endNoteNameIndex) {
                break;
            }

            const noteName = noteNames[noteNameIndex];
            const isWhite = noteName.length === 1;
            noteMap[noteName + octave] = {
                isWhite,
                pressedColor: null,
                isGhost: false,
            };

            if (isWhite) {
                whiteKeys++;
            }

            noteNameIndex++;
        }

        // Resets to C
        noteNameIndex = 0;
    }

    return [noteMap, whiteKeys];
}
