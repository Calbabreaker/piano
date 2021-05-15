export const noteFreqs = {
    C: [16.35, 32.7, 65.41, 130.81, 261.63, 523.25, 1046.5, 2093.0, 4186.01],
    Db: [17.32, 34.65, 69.3, 138.59, 277.18, 554.37, 1108.73, 2217.46, 4434.92],
    D: [18.35, 36.71, 73.42, 146.83, 293.66, 587.33, 1174.66, 2349.32, 4698.64],
    Eb: [19.45, 38.89, 77.78, 155.56, 311.13, 622.25, 1244.51, 2489.02, 4978.03],
    E: [20.6, 41.2, 82.41, 164.81, 329.63, 659.26, 1318.51, 2637.02],
    F: [21.83, 43.65, 87.31, 174.61, 349.23, 698.46, 1396.91, 2793.83],
    Gb: [23.12, 46.25, 92.5, 185.0, 369.99, 739.99, 1479.98, 2959.96],
    G: [24.5, 49.0, 98.0, 196.0, 392.0, 783.99, 1567.98, 3135.96],
    Ab: [25.96, 51.91, 103.83, 207.65, 415.3, 830.61, 1661.22, 3322.44],
    A: [27.5, 55.0, 110.0, 220.0, 440.0, 880.0, 1760.0, 3520.0],
    Bb: [29.14, 58.27, 116.54, 233.08, 466.16, 932.33, 1864.66, 3729.31],
    B: [30.87, 61.74, 123.47, 246.94, 493.88, 987.77, 1975.53, 3951.07],
};

export const noteNames = Object.keys(noteFreqs);
export const whiteNoteNames = noteNames.filter((noteName) => noteName.length === 1);

export const keyBinds = {
    Backquote: "Bb2",
    Tab: "B2",
    KeyQ: "C3",
    Digit2: "Db3",
    KeyW: "D3",
    Digit3: "Eb3",
    KeyE: "E3",
    KeyR: "F3",
    Digit5: "Gb3",
    KeyT: "G3",
    Digit6: "Ab3",
    KeyY: "A3",
    Digit7: "Bb3",
    KeyU: "B3",
    KeyI: "C4",
    Digit9: "Db4",
    KeyO: "D4",
    Digit0: "Eb4",
    KeyP: "E4",
    BracketLeft: "F4",
    Equal: "Gb4",
    BracketRight: "G4",
    Backspace: "Ab4",
    Backslash: "A4",
    ShiftLeft: "A4",
    Enter: "B4",
    KeyA: "Bb4",
    KeyZ: "B4",
    KeyX: "C5",
    KeyD: "Db5",
    KeyC: "D5",
    KeyF: "Eb5",
    KeyV: "E5",
    KeyB: "F5",
    KeyH: "Gb5",
    KeyN: "G5",
    KeyJ: "Ab5",
    KeyM: "A5",
    KeyK: "Bb5",
    Comma: "B5",
    Period: "C6",
    Semicolon: "Db6",
    Slash: "D6",
    Quote: "Eb6",
    ShiftRight: "E6",
};

export function getOctaveCount(note: string): number {
    return parseInt(note.charAt(note.length - 1));
}

export function getNoteName(note: string): string {
    return note.substring(0, note.length - 1);
}

export function generateNotesFromRange(
    startNote: string,
    endNote: string
): { notes: string[]; whiteKeys: number } {
    const endOctave = getOctaveCount(endNote);
    const startOctave = getOctaveCount(startNote);
    const startNoteNameIndex = noteNames.indexOf(getNoteName(startNote));
    const endNoteNameIndex = noteNames.indexOf(getNoteName(endNote));

    const notes: string[] = [];
    let whiteKeys = 0;
    for (let octave = startOctave; octave <= endOctave; octave++) {
        let noteNameIndex = octave === startOctave ? startNoteNameIndex : 0;
        while (noteNameIndex < noteNames.length) {
            const reachedEndNote = octave === endOctave && noteNameIndex > endNoteNameIndex;
            if (reachedEndNote) break;

            const noteName = noteNames[noteNameIndex];
            notes.push(noteName + octave);
            if (noteName.length === 1) whiteKeys++;

            noteNameIndex++;
        }
    }

    return { notes, whiteKeys };
}
