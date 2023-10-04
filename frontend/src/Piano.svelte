<script lang="ts">
    import { ControlPanelData, type LabelType } from "./ControlPanel.svelte";
    import { MidiPlayer } from "./midi_player";
    import {
        generateNoteMapFromRange,
        getNoteName,
        getOctave,
        keyBinds,
        midiToNote,
        noteToKeyBindKey,
        noteToMidi,
    } from "./notes";
    import type { INoteMap } from "./notes";
    import type { Player } from "soundfont-player";
    import type { SocketPlayer } from "./socket_player";
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
    let { noteRange, sustain, noteShift, octaveShift, volume, labelType } = controlPanelData;

    // Set play and stop note functions so that the midiPlayer can play notes on this piano
    export let midiPlayer: MidiPlayer;
    midiPlayer.onPlayNote = playNote;
    midiPlayer.onStopNote = stopNote;

    export let socketPlayer: SocketPlayer;

    // These set the functions that do the actual playing using the instrument
    // SocketPlayer needs to handle when to play since it also might need to send the note event to the server
    // and find out which thread the current user is using to play
    socketPlayer.onPlayNote = ({ note, volume }, thread) => {
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
    };

    socketPlayer.onStopNote = ({ note, sustain }, thread) => {
        if (noteMap[note]) {
            noteMap[note].pressedColor = null;
        }

        if (!sustain) {
            stopAudioNode(note, thread.audioNodeMap);
        }
    };

    // Remake the noteMap (aka. piano data) when the noteRage changed
    noteRange.subscribe((range) => {
        [noteMap, whiteKeys] = generateNoteMapFromRange(range[0], range[1]);
    });

    // Gets the note with the note shift and octave shift applied
    function getShiftedNote(note: string): string {
        const midi = noteToMidi(note) + $noteShift + $octaveShift * 12;
        return midiToNote(midi);
    }

    // These functions relay the playing to the socket player
    function playNote(note: string, velocity: number) {
        const realNote = getShiftedNote(note);

        // Only play if a note isn't already being held
        if (!pressedMap.has(realNote)) {
            pressedMap.set(realNote, true);
            socketPlayer.playNote(realNote, $volume * velocity);
        }
    }

    function stopNote(note: string) {
        const realNote = getShiftedNote(note);
        if (pressedMap.has(realNote)) {
            pressedMap.delete(realNote);
            socketPlayer.stopNote(realNote, $sustain);
        }
    }

    function stopAudioNode(note: string, audioNodeMap: Map<string, Player>) {
        if (audioNodeMap.get(note)) {
            audioNodeMap.get(note).stop();
            audioNodeMap.delete(note);
        }
    }

    // Stop all notes still playing when sustain turned off
    sustain.subscribe((sustain) => {
        if (!sustain) {
            for (const note of socketPlayer.originalThread.audioNodeMap.keys()) {
                if (!pressedMap.get(note)) {
                    socketPlayer.stopNote(note, false);
                }
            }
        }
    });

    // Unpress all pressed keys to prevent 'phantom notes' when the octave changed
    octaveShift.subscribe(() => {
        for (const note of pressedMap.keys()) {
            socketPlayer.stopNote(note, $sustain);
        }
    });

    function recalcWidth(numWhiteKeys: number) {
        if (pianoContainer) {
            // A key's height is 6 times its width so we divide the total area by 6 to get the maximum width for a key
            const maxWidth = pianoContainer.clientHeight / 6;
            const width = pianoContainer.offsetWidth / numWhiteKeys;
            pianoContainer.style.setProperty("--white-key-width", `${Math.min(width, maxWidth)}px`);
        }
    }

    // Recalc when whiteKeys (and thereby the noteRange) changes
    $: recalcWidth(whiteKeys);

    onMount(() => {
        recalcWidth(whiteKeys);
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

    // We need to pass the control panel data stuff so that it gets called when that changes
    function showLabel(
        note: string,
        labelType: LabelType,
        noteShift: number,
        octaveShift: number
    ): string {
        switch (labelType) {
            case "none":
                return "";
            case "notes":
                return getNoteName(note);
            case "keybinds":
                // 'Unshifts' the note and gets the keybind from the dictionary
                const midi = noteToMidi(note) - noteShift - octaveShift * 12;
                return noteToKeyBindKey[midiToNote(midi)] ?? "";
        }
    }
</script>

<svelte:window
    on:resize={() => recalcWidth(whiteKeys)}
    on:keyup={onKeyup}
    on:keydown={onKeyDown}
    on:pointerdown={() => (mouseDown = true)}
    on:pointerup={() => (mouseDown = false)}
/>
<!-- Have a container for the piano in order to get the full width/height of the piano -->
<div class="piano-container" bind:this={pianoContainer}>
    <div class="piano" on:touchstart|preventDefault>
        <!-- Loop through all the notes in noteMap and create a div for each note -->
        {#each Object.entries(noteMap) as [note, { isWhite, pressedColor }]}
            <div
                class="key {isWhite ? 'white' : 'black'}"
                class:pressed={pressedColor !== null}
                on:pointerdown={(event) => {
                    // Prevents holding selecting things on IOS
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
            >
                {showLabel(note, $labelType, $noteShift, $octaveShift)}
            </div>
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

    .white {
        --width: var(--white-key-width);
        background-color: white;
        color: hsl(0, 0%, 20%);
    }

    .black {
        /* Make the black key be proportionaly smaller than the white key */
        --width: calc(var(--white-key-width) / 1.67);
        color: hsl(0, 0%, 80%);
        background-color: hsl(0, 0%, 10%);
        margin-left: calc(var(--width) / -2);
        margin-right: calc(var(--width) / -2);
        z-index: 2;
    }

    .key {
        border: 1px solid #222;
        height: calc(var(--width) * 6);
        width: var(--width);
        border-radius: 0px 0px 4px 4px;
        --shadow-height: calc(var(--width) / 14);
        box-shadow: 0px var(--shadow-height) 1px rgba(32, 32, 32, 0.2);
        user-select: none;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding-bottom: calc(var(--width) / 8);
        font-size: calc(var(--width) / 1.5);
    }

    .black:hover {
        background-color: hsl(0, 0%, 20%);
    }

    .white:hover {
        background-color: hsl(0, 0%, 90%);
    }

    .pressed {
        background-color: hsl(var(--color-hue), 60%, 50%) !important;
        border: hsl(var(--color-hue), 60%, 40%) solid 2px !important;
        transform: translateY(var(--shadow-height));
        box-shadow: 0px 0px 1px rgba(32, 32, 32, 0.2);
    }
</style>
