<script lang="ts">
    import { ControlPanelData } from "./ControlPanel.svelte";
    import { midiPlayerSetup } from "./midi_player";
    import { generateNoteMapFromRange, getNoteName, getOctave, keyBinds } from "./notes";
    import type { INoteMap } from "./notes";
    import type { Player } from "soundfont-player";
    import {
        socketSetup,
        socketPlayNote,
        socketStopNote,
        originalThread,
        threadMap,
    } from "./socket_player";
    import type { IPlayNoteEvent, IStopNoteEvent } from "../../backend/src/socket_events";
    import { onMount } from "svelte";

    let mouseDown: boolean = false;
    let whiteKeys: number;
    let pianoContainer: HTMLDivElement;

    // A map mapping a note name to some note state data include if it's pressed
    let noteMap: INoteMap;

    // This map allows us to know if the local user is pressing a key
    // noteMap is unreliable here because other users (in multiplayer) could be pressing the same keys
    let pressedMap = new Map<string, boolean>();

    export let controlPanelData: ControlPanelData;
    let { noteRange, sustain, octaveShift, volume } = controlPanelData;

    // Remake the noteMap (aka. piano data) when the noteRage changed
    noteRange.subscribe((range) => {
        [noteMap, whiteKeys] = generateNoteMapFromRange(range[0], range[1]);
    });

    socketSetup(playNoteEvent, stopNoteEvent);

    // Gets the note with the octave shift applied
    function getShiftedNote(note: string): string {
        const octave = getOctave(note) + $octaveShift;
        return getNoteName(note) + octave;
    }

    // These note functions relay the what note the user played to the socket player
    function playNote(note: string, velocity: number) {
        const realNote = getShiftedNote(note);

        // Only play if a note isn't already being held
        if (!pressedMap.has(realNote)) {
            if (noteMap[note]) {
                noteMap[note].isGhost = true;
            }

            pressedMap.set(realNote, true);
            socketPlayNote(realNote, $volume * velocity);
        }
    }

    function stopNote(note: string) {
        const realNote = getShiftedNote(note);
        if (pressedMap.has(realNote)) {
            if (noteMap[note]) {
                noteMap[note].isGhost = false;
            }

            pressedMap.delete(realNote);
            socketStopNote(realNote, $sustain);
        }
    }

    // These functions do the actual playing
    function playNoteEvent({ socketID, note, volume }: IPlayNoteEvent) {
        const thread = threadMap.get(socketID);

        if (noteMap[note]) {
            noteMap[note].pressedColor = thread.colorHue;
        }

        if (thread.instrument) {
            stopAudioNode(note, thread.audioNodeMap);
            thread.audioNodeMap.set(
                note,
                thread.instrument.play(note, undefined, {
                    gain: volume,
                })
            );
        }
    }

    function stopNoteEvent({ socketID, note, sustain }: IStopNoteEvent) {
        const thread = threadMap.get(socketID);

        if (noteMap[note]) {
            noteMap[note].pressedColor = null;
        }

        if (!sustain) {
            stopAudioNode(note, thread.audioNodeMap);
        }
    }

    midiPlayerSetup(playNote, stopNote);

    function stopAudioNode(note: string, audioNodeMap: Map<string, Player>) {
        if (audioNodeMap.get(note)) {
            audioNodeMap.get(note).stop();
            audioNodeMap.delete(note);
        }
    }

    // Stop all notes when sustain turned off
    sustain.subscribe((sustain) => {
        if (!sustain) {
            for (const note of originalThread.audioNodeMap.keys()) {
                if (!pressedMap.get(note)) {
                    socketStopNote(note, false);
                }
            }
        }
    });

    // Unpress all pressed keys to prevent 'phantom notes' when the octave changed
    octaveShift.subscribe(() => {
        for (const note of pressedMap.keys()) {
            socketStopNote(note, $sustain);
        }
    });

    function recalcWidth(numWhiteKeys = whiteKeys) {
        if (pianoContainer) {
            const maxWidth = pianoContainer.clientHeight / 6;
            const width = pianoContainer.offsetWidth / numWhiteKeys;
            pianoContainer.style.setProperty("--white-key-width", `${Math.min(width, maxWidth)}px`);
        }
    }

    $: recalcWidth(whiteKeys);

    onMount(() => {
        recalcWidth();
    });

    function onKeyDown(event: KeyboardEvent) {
        const note = keyBinds[event.code];
        const target = event.target as HTMLElement;

        // If the keyBind exists and the user is not selected in a text box or something then play the note
        if (note && target.tagName !== "INPUT") {
            event.preventDefault();
            playNote(note, 0.5);
        }
    }

    function onKeyup(event: KeyboardEvent) {
        const note = keyBinds[event.code];
        if (note) {
            stopNote(note);
        }
    }
</script>

<svelte:window
    on:resize={() => recalcWidth()}
    on:keyup={onKeyup}
    on:keydown={onKeyDown}
    on:pointerdown={() => (mouseDown = true)}
    on:pointerup={() => (mouseDown = false)}
/>
<div class="piano-container" bind:this={pianoContainer}>
    <div class="piano" on:touchstart|preventDefault>
        <!-- Loop through all the notes in noteMap and create a div for each note -->
        {#each Object.entries(noteMap) as [note, { isWhite, pressedColor, isGhost }]}
            <div
                class="key {isWhite ? 'white' : 'black'}"
                class:pressed={pressedColor !== null}
                class:ghost={isGhost && pressedColor === null}
                on:pointerdown={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    playNote(note, 0.5);
                }}
                on:pointerenter={() => {
                    if (mouseDown) {
                        playNote(note, 0.5);
                    }
                }}
                on:pointerleave={() => stopNote(note)}
                on:pointerup={() => stopNote(note)}
                style="--color-hue: {pressedColor}"
            />
        {/each}
    </div>
</div>

<style>
    .piano-container {
        height: 100%;
        display: flex;
        justify-content: center;
    }

    .piano {
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
        background-color: #6cc5c9;
        border: #457d80 solid 1px;
    }

    .pressed {
        background-color: hsl(var(--color-hue), 60%, 50%) !important;
        border: hsl(var(--color-hue), 60%, 40%) solid 2px !important;
        transform: translateY(2.5%);
        box-shadow: 0px 0px 1px rgba(32, 32, 32, 0.2);
    }

    .ghost {
        background-color: hsl(0, 0%, 80%) !important;
        border: hsl(0, 0%, 70%) solid 2px !important;
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
