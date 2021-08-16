<script lang="ts" context="module">
    import type { Player } from "soundfont-player";
    export interface IControlPanelData {
        instrument?: Player;
        octaveShift: number;
        sustain: boolean;
        volume: number;
    }
</script>

<script lang="ts">
    import { instrumentNames } from "./instrument_names";
    import type { InstrumentName } from "./instrument_names";
    import * as Soundfont from "soundfont-player";

    const audioContext = new AudioContext();

    // make the data an object for less repeativeness
    export let data: IControlPanelData = { volume: 25, sustain: false, octaveShift: 0 };

    let instrumentName: InstrumentName = "acoustic_grand_piano";

    const instrumentCache: { [key: string]: Promise<Soundfont.Player> } = {};
    function getInstrument(name: InstrumentName): Promise<Soundfont.Player> {
        if (!instrumentCache[name])
            instrumentCache[name] = Soundfont.instrument(audioContext, instrumentName);

        return instrumentCache[name];
    }

    $: instrumentPromise = getInstrument(instrumentName);
    $: (async () => (data.instrument = await instrumentPromise))();

    window.addEventListener("keydown", (event) => {
        if (event.code == "Space") data.sustain = !data.sustain;

        if (event.code === "ControlLeft") data.octaveShift -= 1;
        else if (event.code === "AltLeft") data.octaveShift += 1;

        if (data.octaveShift < -3) data.octaveShift = 3;
        else if (data.octaveShift > 3) data.octaveShift = -3;
    });
</script>

<div class="control-panel">
    <div>
        Sustain (space):
        <input type="checkbox" bind:checked={data.sustain} />
    </div>
    <div>
        Octave Shift (- ctrl, + alt):
        <input type="number" min="-3" max="3" bind:value={data.octaveShift} />
    </div>
    <div>
        Volume:
        <input type="range" min="0" max="50" step="0.1" bind:value={data.volume} />
        <input type="number" bind:value={data.volume} />
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
</div>

<style>
    .control-panel {
        background-color: black;
        color: white;
        padding: 10px;
        display: flex;
        flex-direction: column;
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
