<script lang="ts">
    import type { LabelType, PianoControlsData } from "./PianoControlsList.svelte";
    import { MidiPlayer } from "./midi_player";
    import {
        generateNoteMapFromRange,
        getNoteName,
        keyBinds,
        midiToNote,
        noteToKeyBindKey,
        noteToMidi,
    } from "./notes";
    import type { SocketPlayer } from "./socket_player";
    import { onMount } from "svelte";

    let mouseDown = false;
    let pianoContainer: HTMLDivElement;

    // This map allows us to know if the local client is pressing a specific key
    // noteMap is unreliable here because other client (in multiplayer) could be pressing the same keys
    let pressedMap = new Map<string, boolean>();

    export let pianoControlsData: PianoControlsData;
    let { noteRange, sustain, noteShift, octaveShift, volume, labelType } = pianoControlsData;

    // Remake the noteMap when the noteRange changed
    $: [noteMap, whiteKeys] = generateNoteMapFromRange($noteRange);

    // Set play and stop note functions so that the midiPlayer can play notes on this piano
    export let midiPlayer: MidiPlayer;
    midiPlayer.onPlayNote = playNote;
    midiPlayer.onStopNote = stopNote;

    export let socketPlayer: SocketPlayer;

    // These set the functions that do the actual playing using the instrument
    // SocketPlayer needs a way to notify when a note needs to be played (sent from the server)
    // It also needs to manage all the clients as well
    socketPlayer.onPlayNote = ({ note, volume }, client) => {
        if (noteMap[note]) {
            noteMap[note].pressedColor = client.colorHue;
        }

        client.playAudio(note, volume);
    };

    socketPlayer.onStopNote = ({ note, sustain }, client) => {
        if (noteMap[note]) {
            noteMap[note].pressedColor = null;
        }

        if (!sustain) {
            client.stopAudio(note);
        }
    };

    // Gets the note with the note shift and octave shift applied
    function getShiftedNote(note: string): string {
        const midi = noteToMidi(note) + $noteShift + $octaveShift * 12;
        return midiToNote(midi);
    }

    // These functions relay the playing to the socket player
    function playNote(note: string, velocity = 0.5) {
        const realNote = getShiftedNote(note);

        // Stop note if note is being held
        if (pressedMap.has(realNote)) {
            stopNote(note);
        }

        pressedMap.set(realNote, true);
        socketPlayer.playNote(realNote, $volume * velocity);

        // We check if the callee is not the midiPlayer so that it doesn't record itself playing the note
        if (this !== midiPlayer) {
            midiPlayer.recordPlayNote(note, velocity);
        }
    }

    function stopNote(note: string) {
        const realNote = getShiftedNote(note);
        if (pressedMap.has(realNote)) {
            pressedMap.delete(realNote);

            socketPlayer.stopNote(realNote, $sustain);

            if (this !== midiPlayer) {
                midiPlayer.recordStopNote(note);
            }
        }
    }

    // Stop all notes still playing when sustain turned off
    sustain.subscribe((sustain) => {
        if (!sustain) {
            for (const note of socketPlayer.localClient.audioNodeMap.keys()) {
                if (!pressedMap.get(note)) {
                    socketPlayer.stopNote(note, false);
                }
            }
        }
    });

    // Unpress all held keys to prevent notes being continuely pressed when the octave changed
    function unpressHeld() {
        for (const note of pressedMap.keys()) {
            socketPlayer.stopNote(note, $sustain);
        }
    }

    octaveShift.subscribe(unpressHeld);
    noteShift.subscribe(unpressHeld);

    // Caculates an individual key's width while making sure the key won't be over the height of the container
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

    function onKeyDown(event: KeyboardEvent) {
        const note = keyBinds[event.code];
        const target = event.target as HTMLElement;

        // If the keyBind exists and the user is not selected in a text box or something then play the note
        if (note && target.tagName !== "INPUT") {
            event.preventDefault();
            playNote(note);
        }
    }

    function onKeyUp(event: KeyboardEvent) {
        const note = keyBinds[event.code];
        if (note) {
            stopNote(note);
        }
    }

    // We need to pass the control panel data stuff so that this functioin gets called when that changes
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

    function onMidiEvent(event: WebMidi.MIDIMessageEvent) {
        const [command, key, velocity] = event.data;

        // These are the midi command ids for playing and stopping a note (uses all 16 midi channels)
        // See https://computermusicresource.com/MIDI.Commands.html
        if (command >= 144 && command <= 159) {
            if (velocity == 0) {
                stopNote(midiToNote(key));
            } else {
                // Play notes with velocity mapped from 1 to 127 -> 0 to 1
                playNote(midiToNote(key), velocity / 127);
            }
        } else if (command >= 128 && command <= 143) {
            stopNote(midiToNote(key));
        }
    }

    function connectMidiDevices(midiAccess: WebMidi.MIDIAccess) {
        midiAccess.inputs.forEach((input) => {
            input.onmidimessage = onMidiEvent;
        });
    }

    onMount(() => {
        recalcWidth(whiteKeys);

        navigator.requestMIDIAccess().then((access) => {
            connectMidiDevices(access);

            // Automatically connect midi devices as they plug in
            access.onstatechange = () => {
                connectMidiDevices(access);
            };
        });
    });
</script>

<svelte:window
    on:resize={() => recalcWidth(whiteKeys)}
    on:keyup={onKeyUp}
    on:keydown={onKeyDown}
    on:pointerdown={(e) => {
        if (e.button === 0 && e.target?.tagName !== "SELECT") {
            mouseDown = true;
        }
    }}
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
                    playNote(note);
                }}
                on:pointerenter={() => {
                    if (mouseDown) {
                        playNote(note);
                    }
                }}
                on:pointerleave={() => {
                    if (mouseDown) {
                        stopNote(note);
                    }
                }}
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
