import React from "react";
import { getNoteName } from "lib/notes";

interface KeyProps {
    note: string;
    pressedKeys: { [key: string]: boolean };
    playNote: (note: string) => void;
    stopNote: (note: string) => void;
    mouseDown: boolean;
}

export const Key: React.FC<KeyProps> = ({ note, pressedKeys, playNote, stopNote, mouseDown }) => {
    const keyColor = getNoteName(note).length === 1 ? "white" : "black";
    return (
        <div
            className={`key ${keyColor} ${pressedKeys[note] ? "pressed" : ""}`}
            data-note={note}
            key={note}
            onMouseDown={() => playNote(note)}
            onMouseUp={() => stopNote(note)}
            onMouseEnter={() => mouseDown && playNote(note)}
            onMouseOut={() => stopNote(note)}
        />
    );
};
