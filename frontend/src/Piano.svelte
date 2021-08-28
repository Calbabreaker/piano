<script lang="ts">
    import { octaveShift, volume, sustain, noteRange } from "./ControlPanel.svelte";
    import { midiPlayerSetup } from "./midi_player";
    import { generateNoteMapFromRange, getNoteName, getOctave, keyBinds } from "./notes";
    import type { INoteMap } from "./notes";
    import type { Player } from "soundfont-player";
    import type { IThread } from "./socket_player";
    import { socketSetup, socketPlayNote, socketStopNote } from "./socket_player";
    import type { IPlayNoteEvent, IStopNoteEvent } from "../../backend/src/socket_events";

    let mouseDown: boolean = false;

    let noteMap: INoteMap;
    let whiteKeys: number;

    // audioNodes are seperate 'threads' but the noteMap isn't
    let threadMap = new Map<string, IThread>();
    // we need to keep this around to stop note sound correctly
    let thisAudioNodeMap = new Map<string, Player>();
    // default thread is 0
    threadMap.set("0", { audioNodeMap: thisAudioNodeMap, colorHue: "220" });

    noteRange.subscribe((range) => {
        const output = generateNoteMapFromRange(range[0], range[1]);
        noteMap = output.noteMap;
        whiteKeys = output.whiteKeys;
    });

    function getRealNote(note: string): string {
        const octave = getOctave(note) + $octaveShift;
        return getNoteName(note) + octave;
    }

    function playNoteEvent(event: IPlayNoteEvent) {
        const note = getRealNote(event.note);
        const thread = threadMap.get(event.socketID ?? "0");

        if (noteMap[note]) noteMap[note].pressedColor = thread.colorHue;

        if (!thread.instrument) return;
        stopAudioNode(note, thread.audioNodeMap);
        thread.audioNodeMap.set(
            note,
            thread.instrument.play(note, undefined, {
                gain: event.volume,
            })
        );
    }

    function stopNoteEvent(event: IStopNoteEvent) {
        const note = getRealNote(event.note);
        const thread = threadMap.get(event.socketID ?? "0");

        if (noteMap[note]) noteMap[note].pressedColor = null;

        if (!event.sustain) stopAudioNode(note, thread.audioNodeMap);
    }

    socketSetup(playNoteEvent, stopNoteEvent, threadMap);

    function playNote(note: string) {
        socketPlayNote(note, $volume);
    }

    function stopNote(note: string) {
        socketStopNote(note, $sustain);
    }

    midiPlayerSetup(playNote, stopNote);

    function stopAudioNode(note: string, audioNodeMap: Map<string, Player>) {
        if (audioNodeMap.get(note)) {
            audioNodeMap.get(note).stop();
            audioNodeMap.delete(note);
        }
    }

    // stop all sustain audio nodes when sustain changed
    sustain.subscribe(() => {
        for (const note in noteMap) {
            if (!noteMap[note].pressedColor) {
                stopAudioNode(note, thisAudioNodeMap);
            }
        }
    });

    // unpress all pressed keys to prevent 'ghosting' when octave shifting
    octaveShift.subscribe(() => {
        for (const note in noteMap) {
            if (noteMap[note].pressedColor) {
                noteMap[note].pressedColor = null;
                if (!$sustain) stopAudioNode(note, thisAudioNodeMap);
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
    style={`--white-keys: ${whiteKeys}`}
    on:pointerdown={() => (mouseDown = true)}
    on:pointerup={() => (mouseDown = false)}
>
    {#each Object.entries(noteMap) as [note, { white, pressedColor }]}
        <div
            class="key {white ? 'white' : 'black'}"
            class:pressed={pressedColor ? true : false}
            on:pointerdown={(event) => {
                event.currentTarget.releasePointerCapture(event.pointerId);
                playNote(note);
            }}
            on:pointerenter={() => {
                if (mouseDown) playNote(note);
            }}
            on:pointerleave={() => stopNote(note)}
            on:pointerup={() => stopNote(note)}
            style={`--color-hue: ${pressedColor}`}
        />
    {/each}
</div>

<style>
    .piano {
        --white-keys: 0;
        --white-key-width: min(calc(100vw / var(--white-keys)), calc(60vh / 6));
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
