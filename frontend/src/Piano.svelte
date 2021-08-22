<script lang="ts">
    import { instrument, octaveShift, volume, sustain } from "./ControlPanel.svelte";
    import { midiPlayerSetup } from "./midi_player";
    import { generateNoteMapFromRange, getNoteName, getOctave, keyBinds } from "./notes";

    export let startNote: string;
    export let endNote: string;

    let mouseDown: boolean = false;

    const { noteMap, whiteKeys } = generateNoteMapFromRange(startNote, endNote);

    function getRealNote(note: string, includeShift: boolean): string {
        if (includeShift) {
            const octave = getOctave(note) + $octaveShift;
            return getNoteName(note) + octave;
        } else {
            return note;
        }
    }

    function playNote(note: string, velocity: number = 1, includeShift: boolean = true) {
        note = getRealNote(note, includeShift);

        if (!noteMap[note] || noteMap[note].pressed) return;
        noteMap[note].pressed = true;

        if ($instrument) {
            stopAudioNode(note);
            noteMap[note].audioNode = $instrument.play(note, undefined, {
                gain: $volume * velocity,
            });
        }
    }

    function stopNote(note: string, includeShift: boolean = true) {
        note = getRealNote(note, includeShift);

        if (!noteMap[note]) return;
        noteMap[note].pressed = false;

        if (!$sustain) stopAudioNode(note);
    }

    midiPlayerSetup(playNote, stopNote);

    function stopAudioNode(note: string) {
        if (noteMap[note].audioNode) {
            noteMap[note].audioNode.stop();
            noteMap[note].audioNode = null;
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
    style="--white-keys: {whiteKeys}"
    on:mousedown={() => (mouseDown = true)}
    on:mouseup={() => (mouseDown = false)}
>
    {#each Object.entries(noteMap) as [note, { pressed, white }]}
        <!-- svelte-ignore a11y-mouse-events-have-key-events -->
        <div
            class="key {white ? 'white' : 'black'}"
            class:pressed
            on:mousedown={() => playNote(note, undefined, false)}
            on:mouseenter={() => {
                if (mouseDown) playNote(note, undefined, false);
            }}
            on:mouseout={() => stopNote(note, false)}
            on:mouseup={() => stopNote(note, false)}
        />
    {/each}
</div>

<style>
    .piano {
        --white-keys: 0;
        display: flex;
        align-self: flex-end;
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
        --width: calc(100vw / var(--white-keys));
        background-color: white;
        border: 1px solid #333;
    }

    .black {
        --width: calc(100vw / var(--white-keys) / 1.6666);
        background-color: rgb(26, 26, 26);
        margin-left: calc(var(--width) / -2);
        margin-right: calc(var(--width) / -2);
        z-index: 2;
    }
</style>
