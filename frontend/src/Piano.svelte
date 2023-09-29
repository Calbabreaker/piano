<script lang="ts">
    import { ControlPanelData } from "./ControlPanel.svelte";
    import { MidiPlayer } from "./midi_player";
    import { generateNoteMapFromRange, getNoteName, getOctave, keyBinds } from "./notes";
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
    let { noteRange, sustain, octaveShift, volume } = controlPanelData;

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

    // Gets the note with the octave shift applied
    function getShiftedNote(note: string): string {
        const octave = getOctave(note) + $octaveShift;
        return getNoteName(note) + octave;
    }

    // These functions relay the playing to the socket player
    function playNote(note: string, velocity: number) {
        const realNote = getShiftedNote(note);

        // Only play if a note isn't already being held
        if (!pressedMap.has(realNote)) {
            if (noteMap[note]) {
                noteMap[note].isGhost = true;
            }

            pressedMap.set(realNote, true);
            socketPlayer.playNote(realNote, $volume * velocity);
        }
    }

    function stopNote(note: string) {
        const realNote = getShiftedNote(note);
        if (pressedMap.has(realNote)) {
            if (noteMap[note]) {
                noteMap[note].isGhost = false;
            }

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

    // Stop all notes when sustain turned off
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
</script>

<svelte:window
    on:resize={() => recalcWidth(whiteKeys)}
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
