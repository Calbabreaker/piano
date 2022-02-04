<script lang="ts" context="module">
    import { writable } from "svelte/store";

    export const octaveShift = writable(0);
    export const sustain = writable(false);
    export const volume = writable(25);
    export const noteRange = writable<[string, string]>(["C0", "C0"]);
</script>

<script lang="ts">
    import { instrumentNames } from "./instrument_names";
    import {
        midiCurrentTime,
        midiTotalTime,
        midiPlaying,
        midiFile,
        midiSpeed,
    } from "./midi_player";
    import {
        instrumentName,
        socketConnect,
        socketPromise,
        socket,
        connectedColorHues,
        connected,
    } from "./socket_player";
    import { getInstrument } from "./utils";

    let roomName = "";

    $: instrumentPromise = getInstrument($instrumentName);

    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomName = urlParams.get("room");
    if (urlRoomName) {
        roomName = urlRoomName;
        socketConnect(roomName);
    }

    function sizeSelectChange(select: HTMLSelectElement) {
        const option = select.children[select.selectedIndex] as HTMLOptionElement;
        $noteRange = option.dataset["range"].split(",") as [string, string];
    }

    function onKeyDown(event: KeyboardEvent) {
        if (event.code === "Space") $sustain = !$sustain;

        if (event.code === "ControlLeft") $octaveShift -= 1;
        else if (event.code === "AltLeft" || event.code == "ControlRight") $octaveShift += 1;

        if ($octaveShift < -3) $octaveShift = 3;
        else if ($octaveShift > 3) $octaveShift = -3;
    }
</script>

<svelte:window on:keydown={onKeyDown} />
<div class="control-panel">
    <div class="row">
        <div>
            <div title="Shortcut: space">
                <span>Sustain:</span>
                <input type="checkbox" bind:checked={$sustain} />
            </div>

            <div title="Shortcut: left ctrl +, left alt or right ctrl -">
                <span>Octave Shift:</span>
                <input type="number" min="-3" max="3" bind:value={$octaveShift} />
            </div>

            <div>
                <span>Volume:</span>
                <input type="range" min="0" max="50" step="0.1" bind:value={$volume} />
                <input type="number" bind:value={$volume} />
            </div>

            <div>
                <span>Instrument:</span>
                <select bind:value={$instrumentName}>
                    {#each instrumentNames as name}
                        <option>{name}</option>
                    {/each}
                </select>
                {#await instrumentPromise}
                    loading...
                {/await}
            </div>

            <span>Size:</span>
            <select
                on:change={(event) => sizeSelectChange(event.currentTarget)}
                use:sizeSelectChange
            >
                <option data-range="A0,C8">Full size (88 keys)</option>
                <option data-range="C2,C7" selected={true}>Half size (61 keys)</option>
                <option data-range="C3,C6">Quater Size (37 keys)</option>
                <option data-range="C4,B5">2 Octaves (24 keys)</option>
                <option data-range="C4,B4">1 Octave (12 keys)</option>
            </select>
        </div>

        <div>
            <div>
                <p>Play a midi:</p>
                <input
                    type="file"
                    on:change={(event) => ($midiFile = event.currentTarget.files?.[0])}
                />
            </div>

            <div>
                {#if $midiPlaying}
                    <button on:click={() => ($midiPlaying = false)}>Pause</button>
                {:else}
                    <button on:click={() => ($midiPlaying = true)}>Play</button>
                {/if}
                <button
                    on:click={() => {
                        $midiPlaying = false;
                        $midiCurrentTime = 0;
                        setTimeout(() => {
                            $midiPlaying = true;
                        }, 100);
                    }}
                >
                    Restart
                </button>
            </div>

            <div>
                Speed:<input type="range" min="0.01" max="4" step="0.01" bind:value={$midiSpeed} />
                <input type="number" min="0.01" bind:value={$midiSpeed} />times<br />
                <input
                    type="range"
                    min="0"
                    max={$midiTotalTime}
                    step="0.1"
                    bind:value={$midiCurrentTime}
                    on:mousedown={() => ($midiPlaying = false)}
                    on:mouseup={() => ($midiPlaying = true)}
                    style="width: 18rem"
                />
                {$midiCurrentTime.toFixed(1)}/{$midiTotalTime.toFixed(1)} seconds
            </div>
        </div>
    </div>

    <div>
        <p>Join a room:</p>
        <input
            type="text"
            placeholder="Room name"
            bind:value={roomName}
            on:keydown={(event) => {
                if (event.code === "Enter") socketConnect(roomName);
            }}
        />

        {#if $connected}
            <button on:click={() => socket.disconnect()}>Leave</button>
        {:else}
            <button on:click={() => socketConnect(roomName)}>Join</button>
        {/if}
        {#await $socketPromise}
            <span>Connecting...</span>
        {:then}
            {#if $connected}
                <span>Connected!</span><br />
                <span>People: </span>
                {#each Array.from($connectedColorHues.entries()) as [socketID, colorHue]}
                    <div class="icon" style={`--color-hue: ${colorHue}`} />
                    {#if socketID === socket.id}
                        <span style="margin-right: 0.5rem">(you)</span>
                    {/if}
                {/each}
            {/if}
        {:catch error}
            <span class="error">{error}</span>
        {/await}
    </div>
</div>

<style>
    .control-panel {
        background-color: black;
        color: white;
        padding: 0.5rem;
    }

    .row {
        margin-bottom: 0.5rem;
        display: flex;
    }

    .row div {
        margin-right: 2rem;
    }

    input[type="range"] {
        width: 12rem;
        vertical-align: middle;
    }

    input[type="number"] {
        width: 3rem;
    }

    input {
        margin-right: 5px;
        user-select: none;
    }

    p {
        margin-bottom: 0.5rem;
        margin-top: 0;
    }

    .error {
        color: #fe3c3c;
    }

    .icon {
        display: inline-block;
        background-color: hsl(var(--color-hue), 70%, 50%);
        border: hsl(var(--color-hue), 70%, 40%) solid 2px;
        width: 1rem;
        height: 1rem;
        margin-bottom: -5px;
    }
</style>
