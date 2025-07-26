<script lang="ts" context="module">
    import { writable } from "svelte/store";

    const labels = ["none", "notes", "keybinds"] as const;
    export type LabelType = (typeof labels)[number];

    // Class to pass around the data needed for controling the piano
    export class PianoControlsData {
        // Use a svelte store for each property to allow us to only update when those specific values change
        octaveShift = writable(0);
        noteShift = writable(0);
        sustain = writable(false);
        volume = writable(10);
        noteRange = writable<string>("C2,C7");
        labelType = writable<LabelType>("keybinds");
    }
</script>

<script lang="ts">
    import { type InstrumentName, instrumentNames } from "../instrument_names";
    import spinner from "../spinner.svg";
    import type { SocketPlayer } from "./socket_player";

    export let pianoControlsData: PianoControlsData;
    export let socketPlayer: SocketPlayer;

    let instrumentName: InstrumentName = "acoustic_grand_piano";

    // We need to destructure these so that we can use svelte bind syntax ($)
    let { noteRange, sustain, noteShift, octaveShift, volume, labelType } = pianoControlsData;

    $: instrumentPromise = socketPlayer.changeInstrument(instrumentName);

    // Converts "snake_case" to "Title Case"
    function snakeToTitleCase(str: string): string {
        const words = str.split("_");
        const titleCasedWords = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1));
        return titleCasedWords.join(" ");
    }

    noteShift.subscribe(() => {
        // Move to the next octave if noteShift shifted 12 times
        if ($noteShift >= 12) {
            $octaveShift += 1;
            $noteShift = 0;
        } else if ($noteShift <= -12) {
            $octaveShift -= 1;
            $noteShift = 0;
        }
    });

    octaveShift.subscribe(() => {
        // Wrap around
        if ($octaveShift < -3) {
            $octaveShift = 3;
        } else if ($octaveShift > 3) {
            $octaveShift = -3;
        }
    });

    function onKeyUp(event: KeyboardEvent) {
        if (event.code === "Space") {
            $sustain = false;
        }

        if ((event.target as HTMLElement).tagName === "INPUT" || event.shiftKey) {
            return;
        }

        switch (event.code) {
            case "ArrowLeft":
                $noteShift -= 1;
                break;
            case "ArrowRight":
                $noteShift += 1;
                break;
            case "ArrowDown":
                $octaveShift -= 1;
                break;
            case "ArrowUp":
                $octaveShift += 1;
                break;
        }
    }

    function onKeyDown(event: KeyboardEvent) {
        if (event.code === "Space") {
            $sustain = true;
        }
    }
</script>

<svelte:window on:keyup={onKeyUp} on:keydown={onKeyDown} />
<div class="option-list">
    <div title="Shortcut: space">
        <span>Sustain</span>
        <input type="checkbox" bind:checked={$sustain} />
    </div>

    <div>
        <span
            title="Double click to reset"
            on:click={(e) => {
                // detail == 2 means double click
                if (e.detail == 2) {
                    $noteShift = 0;
                    $octaveShift = 0;
                }
            }}
        >
            Tranpose
        </span>
        <input
            title="Note shift (shortcut: LeftArrow & RightArrow)"
            type="number"
            bind:value={$noteShift}
        />
        <input
            title="Octave shift (shortcut: DownArrow & UpArrow)"
            type="number"
            bind:value={$octaveShift}
        />
    </div>

    <div>
        <span>Volume</span>
        <input type="range" min="0" max="10" step="0.1" bind:value={$volume} style="width: 8rem" />
        <span>{$volume}</span>
    </div>

    <div>
        <span>Instrument</span>
        <select bind:value={instrumentName}>
            {#each instrumentNames as name}
                <option value={name}>{snakeToTitleCase(name)}</option>
            {/each}
        </select>
        {#await instrumentPromise}
            <img src={spinner} alt="spinner" />
        {/await}
    </div>

    <div>
        <span>Size</span>
        <select bind:value={$noteRange}>
            <option value="A0,C8">Full size (88 keys)</option>
            <option value="C2,C7">Half size (61 keys)</option>
            <option value="C3,C6">Quater Size (37 keys)</option>
            <option value="C4,B5">2 Octaves (24 keys)</option>
            <option value="C4,B4">1 Octave (12 keys)</option>
        </select>
    </div>

    <div>
        <span>Labels</span>
        <select bind:value={$labelType}>
            {#each labels as label}
                <option value={label}>{snakeToTitleCase(label)}</option>
            {/each}
        </select>
    </div>
</div>

<style>
    .option-list > div {
        padding-bottom: 0.2rem;
        display: flex;
    }

    .option-list span {
        width: 7rem;
    }

    .option-list {
        margin-right: 2rem;
    }
</style>
