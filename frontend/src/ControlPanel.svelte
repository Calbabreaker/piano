<script lang="ts" context="module">
    import type { Player } from "soundfont-player";
    import { writable } from "svelte/store";

    export const instrument = writable<Player>(undefined);
    export const octaveShift = writable(0);
    export const sustain = writable(false);
    export const volume = writable(25);
    export const noteRange = writable<[string, string]>(["C0", "C0"]);
</script>

<script lang="ts">
    import { instrumentNames } from "./instrument_names";
    import type { InstrumentName } from "./instrument_names";
    import * as Soundfont from "soundfont-player";
    import {
        midiCurrentTime,
        midiTotalTime,
        midiPlaying,
        midiFile,
        midiSpeed,
    } from "./midi_player";

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) alert("Your browser does not seem to support the Web Audio API!");

    const audioContext = new AudioContext();

    let instrumentName: InstrumentName = "acoustic_grand_piano";

    const instrumentCache: { [key: string]: Promise<Soundfont.Player> } = {};
    function getInstrument(name: InstrumentName): Promise<Soundfont.Player> {
        if (!instrumentCache[name])
            instrumentCache[name] = Soundfont.instrument(audioContext, instrumentName);

        return instrumentCache[name];
    }

    $: instrumentPromise = getInstrument(instrumentName);
    $: (async () => ($instrument = await instrumentPromise))();

    function sizeSelectChange(select: HTMLSelectElement) {
        const option = select.children[select.selectedIndex] as HTMLOptionElement;
        $noteRange = option.dataset["range"].split(",") as [string, string];
    }

    window.addEventListener("keydown", (event) => {
        if (event.code === "Space") $sustain = !$sustain;

        if (event.code === "ControlLeft") $octaveShift -= 1;
        else if (event.code === "AltLeft") $octaveShift += 1;

        if ($octaveShift < -3) $octaveShift = 3;
        else if ($octaveShift > 3) $octaveShift = -3;
    });
</script>

<div class="control-panel">
    <div>
        <span>Sustain (space):</span>
        <input type="checkbox" bind:checked={$sustain} />
        <br />

        <span>Octave Shift (- ctrl, + alt):</span>
        <input type="number" min="-3" max="3" bind:value={$octaveShift} />
        <br />

        <span>Volume:</span>
        <input type="range" min="0" max="50" step="0.1" bind:value={$volume} />
        <input type="number" bind:value={$volume} />
        <br />

        <span>Instrument:</span>
        <select bind:value={instrumentName}>
            {#each instrumentNames as name}
                <option>{name}</option>
            {/each}
        </select>
        {#await instrumentPromise}
            loading...
        {/await}
        <br />

        <span>Size:</span>
        <select on:change={(event) => sizeSelectChange(event.currentTarget)} use:sizeSelectChange>
            <option data-range="A0,C8">Full size (88 keys)</option>
            <option data-range="C2,C7" selected={true}>Half size (61 keys)</option>
            <option data-range="C3,C6">Quater Size (37 keys)</option>
            <option data-range="C4,A5">2 Octaves (24 keys)</option>
            <option data-range="C4,A4">1 Octave (12 keys)</option>
        </select>
    </div>

    <div style="margin-left: 3rem">
        <p>Play a midi:</p>

        <input type="file" on:change={(event) => ($midiFile = event.currentTarget.files?.[0])} />
        <br />

        {#if $midiPlaying}
            <button on:click={() => ($midiPlaying = false)}>Stop</button>
        {:else}
            <button on:click={() => ($midiPlaying = true)}>Play</button>
        {/if}
        <br />

        Speed: <input type="range" min="0.01" max="4" step="0.01" bind:value={$midiSpeed} />
        <input type="number" min="0.01" bind:value={$midiSpeed} />times<br />
        <input
            type="range"
            min="0"
            max={$midiTotalTime}
            step="0.1"
            bind:value={$midiCurrentTime}
            on:mousedown={() => ($midiPlaying = false)}
            on:mouseup={() => ($midiPlaying = true)}
            style="width: 20rem"
        />
        {$midiCurrentTime.toFixed(1)}/{$midiTotalTime.toFixed(1)} seconds
    </div>
</div>

<style>
    .control-panel {
        background-color: black;
        color: white;
        padding: 10px;
        display: flex;
    }

    input[type="range"] {
        width: 12rem;
    }

    input[type="number"] {
        width: 3rem;
    }

    input {
        margin-right: 5px;
    }

    p {
        margin-bottom: 5px;
        margin-top: 0;
    }
</style>
