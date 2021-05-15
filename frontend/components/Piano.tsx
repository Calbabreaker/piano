import React, { useState } from "react";
import { Key } from "./Key";
import { generateNotesFromRange } from "lib/notes";

interface PianoProps {
    startNote: string;
    endNote: string;
}

export const Piano: React.FC<PianoProps> = ({ startNote, endNote }) => {
    const { notes, whiteKeys } = generateNotesFromRange(startNote, endNote);

    const [mouseDown, setMouseDown] = useState(false);
    const [pressedKeys, setPressedKeys] = useState<{ [key: string]: boolean }>({});

    const playNote = (note: string) => {
        setPressedKeys((pressedKeys) => ({ ...pressedKeys, [note]: true }));
    };

    const stopNote = (note: string) => {
        setPressedKeys((pressedKeys) => ({ ...pressedKeys, [note]: false }));
    };

    return (
        <div
            id="piano"
            style={{ "--white-keys": whiteKeys } as React.CSSProperties}
            onMouseDown={() => setMouseDown(true)}
            onMouseUp={() => {
                setMouseDown(false), setPressedKeys({});
            }}
        >
            {notes.map((note) => (
                <Key
                    note={note}
                    pressedKeys={pressedKeys}
                    playNote={playNote}
                    stopNote={stopNote}
                    mouseDown={mouseDown}
                />
            ))}
        </div>
    );
};
