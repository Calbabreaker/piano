<script lang="ts" context="module">
    import type { Player } from "soundfont-player";
    import { writable } from "svelte/store";

    export const instrument = writable<Player>(undefined);
    export const octaveShift = writable<number>(0);
    export const sustain = writable<boolean>(false);
    export const volume = writable<number>(25);
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
        midiIntervalToSecond,
    } from "./midi_player";

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

    window.addEventListener("keydown", (event) => {
        if (event.code === "Space") $sustain = !$sustain;

        if (event.code === "ControlLeft") $octaveShift -= 1;
        else if (event.code === "AltLeft") $octaveShift += 1;

        if ($octaveShift < -3) $octaveShift = 3;
        else if ($octaveShift > 3) $octaveShift = -3;
    });

    function onFileChanged(event: Event) {
        const inputElm = event.target as HTMLInputElement;
        $midiFile = inputElm.files?.[0];
    }
</script>

<div class="control-panel">
    <div>
        Sustain (space):
        <input type="checkbox" bind:checked={$sustain} />
    </div>
    <div>
        Octave Shift (- ctrl, + alt):
        <input type="number" min="-3" max="3" bind:value={$octaveShift} />
    </div>
    <div>
        Volume:
        <input type="range" min="0" max="50" step="0.1" bind:value={$volume} />
        <input type="number" bind:value={$volume} />
    </div>
    <div>
        Instrument:
        <select bind:value={instrumentName}>
            {#each instrumentNames as name}
                <option>{name}</option>
            {/each}
        </select>
        {#await instrumentPromise}
            loading...
        {/await}
    </div>

    <div>
        <p>Play a midi:</p>
        <input type="file" on:change={onFileChanged} />
        <br />

        {#if $midiPlaying}
            <button on:click={() => ($midiPlaying = false)}>Stop</button>
        {:else}
            <button on:click={() => ($midiPlaying = true)}>Play</button>
        {/if}
        <br />
        <input
            type="range"
            min="0"
            max={$midiTotalTime}
            step={midiIntervalToSecond}
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
    }
</style>
