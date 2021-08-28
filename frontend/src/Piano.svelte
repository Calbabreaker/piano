<script lang="ts">
    import { instrument, octaveShift, volume, sustain, noteRange } from "./ControlPanel.svelte";
    import { midiPlayerSetup } from "./midi_player";
    import { generateNoteMapFromRange, getNoteName, getOctave, keyBinds } from "./notes";
    import type { INoteMap } from "./notes";
    import type { Player } from "soundfont-player";

    let mouseDown: boolean = false;

    let noteMap: INoteMap;
    let whiteKeys: number;

    let audioNodeMap: { [key: string]: Player | undefined } = {};

    const maxKeyWidth = window.innerHeight / 1.7 / 6;
    $: keyWidth = Math.min(maxKeyWidth, window.innerWidth / whiteKeys);

    noteRange.subscribe((range) => {
        const output = generateNoteMapFromRange(range[0], range[1]);
        noteMap = output.noteMap;
        whiteKeys = output.whiteKeys;
    });

    function getRealNote(note: string): string {
        const octave = getOctave(note) + $octaveShift;
        return getNoteName(note) + octave;
    }

    function playNote(note: string, velocity: number = 1) {
        note = getRealNote(note);

        if (noteMap[note]) {
            if (noteMap[note].pressed) return;
            noteMap[note].pressed = true;
        }

        if ($instrument) {
            stopAudioNode(note);
            audioNodeMap[note] = $instrument.play(note, undefined, {
                gain: $volume * velocity,
            });
        }
    }

    function stopNote(note: string) {
        note = getRealNote(note);

        if (noteMap[note]) {
            noteMap[note].pressed = false;
        }

        if (!$sustain) stopAudioNode(note);
    }

    midiPlayerSetup(playNote, stopNote);

    function stopAudioNode(note: string) {
        if (audioNodeMap[note]) {
            audioNodeMap[note].stop();
            audioNodeMap[note] = undefined;
        }
    }

    // stop all sustain audio nodes when sustain changed
    sustain.subscribe(() => {
        for (const note in noteMap) {
            if (!noteMap[note].pressed) {
                stopAudioNode(note);
            }
        }
    });

    // unpress all pressed keys to prevent 'ghosting' when octave shifting
    octaveShift.subscribe(() => {
        for (const note in noteMap) {
            if (noteMap[note].pressed) {
                noteMap[note].pressed = false;
                if (!$sustain) stopAudioNode(note);
            }
        }
    });

    window.addEventListener("keydown", (event) => {
        const note = keyBinds[event.code];
        const target = event.target as HTMLElement;
        if (note && target.tagName !== "INPUT") {
            event.preventDefault();
            playNote(note);
        }
    });

    window.addEventListener("keyup", (event) => {
        const note = keyBinds[event.code];
        if (note) stopNote(note);
    });
</script>

<div
    class="piano"
    style={`--white-key-width: ${keyWidth}px`}
    on:pointerdown={() => (mouseDown = true)}
    on:pointerup={() => (mouseDown = false)}
>
    {#each Object.entries(noteMap) as [note, { pressed, white }]}
        <div
            class="key {white ? 'white' : 'black'}"
            class:pressed
            on:pointerdown={(event) => {
                event.currentTarget.releasePointerCapture(event.pointerId);
                playNote(note);
            }}
            on:pointerenter={() => {
                if (mouseDown) playNote(note);
            }}
            on:pointerleave={() => stopNote(note)}
            on:pointerup={() => stopNote(note)}
        />
    {/each}
</div>

<style>
    .piano {
        --white-key-width: 0;
        display: flex;
    }

    .key {
        height: calc(var(--width) * 6);
        width: var(--width);
        border-radius: 0px 0px 4px 4px;
        box-shadow: 0px 5px 1px rgba(32, 32, 32, 0.2);
        user-select: none;
    }

    .key:hover {
        background-color: rgb(33, 192, 197);
        border: rgb(20, 112, 116) solid 1px;
    }

    .pressed {
        --color-hue: 220;
        background-color: hsl(var(--color-hue), 70%, 50%) !important;
        border: hsl(var(--color-hue), 70%, 40%) solid 2px !important;
        transform: translateY(2.5%);
        box-shadow: 0px 0px 1px rgba(32, 32, 32, 0.2);
    }

    .white {
        --width: var(--white-key-width);
        background-color: white;
        border: 1px solid #333;
    }

    .black {
        --width: calc(var(--white-key-width) / 1.6666);
        background-color: rgb(26, 26, 26);
        margin-left: calc(var(--width) / -2);
        margin-right: calc(var(--width) / -2);
        z-index: 2;
    }
</style>
