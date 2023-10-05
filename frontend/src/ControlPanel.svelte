<script lang="ts" context="module">
    import { writable } from "svelte/store";

    const labels = ["none", "notes", "keybinds"] as const;
    export type LabelType = (typeof labels)[number];

    // Class to pass around the data needed for controling the piano
    export class ControlPanelData {
        // Use a svelte store for each property to allow us to only update when those specific values change
        octaveShift = writable(0);
        noteShift = writable(0);
        sustain = writable(false);
        volume = writable(5);
        noteRange = writable<[string, string]>(["C2", "C7"]);
        labelType = writable<LabelType>("keybinds");
    }
</script>

<script lang="ts">
    import { type InstrumentName, instrumentNames } from "../../backend/src/instrument_names";
    import { MidiPlayer } from "./midi_player";
    import { SocketPlayer } from "./socket_player";
    import spinner from "./spinner.svg";
    import { snakeToTitleCase } from "./utils";

    let roomName = "";
    let instrumentName: InstrumentName = "acoustic_grand_piano";

    export let controlPanelData: ControlPanelData;
    export let midiPlayer: MidiPlayer;
    export let socketPlayer: SocketPlayer;

    // We need to destructure these so that we can use svelte bind syntax ($)
    let { noteRange, sustain, noteShift, octaveShift, volume, labelType } = controlPanelData;
    let { midiFile, midiIsPlaying, midiCurrentTime, midiSpeed, midiTotalTime } = midiPlayer;
    let { connected, connecting, connectError, connectedColorHues } = socketPlayer;

    $: instrumentPromise = socketPlayer.changeInstrument(instrumentName);

    function onLoad() {
        // Gets the ?room=[room_name] from the url and connects to a room
        const urlParams = new URLSearchParams(location.search);
        const urlRoomName = urlParams.get("room");
        if (urlRoomName != null) {
            roomName = urlRoomName;
            socketPlayer.connect(roomName, instrumentName);
        }
    }

    function sizeSelectChange(select: HTMLSelectElement) {
        const option = select.children[select.selectedIndex] as HTMLOptionElement;
        $noteRange = option.dataset["range"].split(",") as [string, string];
    }

    function onKeyDown(event: KeyboardEvent) {
        if ((event.target as HTMLElement).tagName === "INPUT") {
            return;
        }

        switch (event.code) {
            case "Space":
                $sustain = true;
                break;
            case "ControlLeft":
                $noteShift -= 1;
                break;
            case "AltLeft":
                $noteShift += 1;
                break;
            case "AltRight":
                $octaveShift -= 1;
                break;
            case "ControlRight":
                $octaveShift += 1;
                break;
        }
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
    }
</script>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} on:load={onLoad} />
<div class="control-panel">
    <div class="row">
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
                    title="Note shift (shortcut: left ctrl + left alt)"
                    type="number"
                    bind:value={$noteShift}
                />
                <input
                    title="Octave shift (shortcut: right alt + right ctrl)"
                    type="number"
                    bind:value={$octaveShift}
                />
            </div>

            <div>
                <span>Volume</span>
                <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    bind:value={$volume}
                    style="width: 8rem"
                />
                <!-- We use a number input instead of a setting the value directly to allow the user to go above the limit -->
                <input type="number" bind:value={$volume} />
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
                <span>Labels</span>
                <select bind:value={$labelType}>
                    {#each labels as label}
                        <option value={label}>{snakeToTitleCase(label)}</option>
                    {/each}
                </select>
            </div>
        </div>

        <div>
            <p>Play a midi:</p>
            <div>
                <input
                    type="file"
                    accept=".midi,.mid"
                    on:change={(event) => ($midiFile = event.currentTarget.files?.[0])}
                />
            </div>

            <div style="margin: 0.2rem 0 0.2rem 0">
                {#if $midiIsPlaying}
                    <button on:click={() => ($midiIsPlaying = false)}>Pause</button>
                {:else}
                    <button on:click={() => ($midiIsPlaying = true)}>Play</button>
                {/if}
                <button
                    on:click={() => {
                        $midiCurrentTime = 0;
                        // Need to stop and start again to rebuild the up to index
                        $midiIsPlaying = false;
                        setTimeout(() => ($midiIsPlaying = true), 100);
                    }}
                >
                    Restart
                </button>
            </div>

            <div>
                <span>Speed</span>
                <input
                    type="range"
                    min="0.01"
                    max="4"
                    step="0.01"
                    bind:value={$midiSpeed}
                    title="Double click to set speed to normal"
                    on:click={(e) => {
                        // detail == 2 means double click
                        if (e.detail == 2) {
                            $midiSpeed = 1;
                        }
                    }}
                />
                <input type="number" min="0.01" bind:value={$midiSpeed} />times<br />
            </div>
            <div>
                <input
                    type="range"
                    min="0"
                    max={$midiTotalTime}
                    step="0.1"
                    bind:value={$midiCurrentTime}
                    on:mousedown={() => ($midiIsPlaying = false)}
                    on:mouseup={() => ($midiIsPlaying = true)}
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
                if (event.code === "Enter") {
                    socketPlayer.connect(roomName);
                }
            }}
        />

        {#if $connected}
            <button on:click={() => socketPlayer.socket.disconnect()}>Leave</button>
            <span>Connected!</span><br />
            <span>People: </span>
            <!-- Generate the connected square icons -->
            {#each Array.from($connectedColorHues.entries()) as [socketID, colorHue]}
                <div class="icon" style={`--color-hue: ${colorHue}`} />
                <!-- Indentify the users color -->
                {#if socketID === socketPlayer.socket.id}
                    <span style="margin-right: 0.5rem">(you)</span>
                {/if}
            {/each}
        {:else}
            <button on:click={() => socketPlayer.connect(roomName)} disabled={$connecting}>
                Join
            </button>
        {/if}

        {#if $connectError}
            <span class="error">{$connectError}</span>
        {:else if $connecting}
            <span>Connecting...</span>
            <img src={spinner} alt="spinner" />
        {/if}
    </div>
</div>

<style>
    .control-panel {
        background-color: black;
        color: white;
        padding: 0.5rem;
    }

    .row {
        margin-bottom: 1rem;
        display: flex;
    }

    .row > div > div {
        padding-bottom: 0.2rem;
    }

    .option-list > div {
        display: flex;
    }

    .option-list span {
        width: 7rem;
        margin-bottom: auto;
        margin-top: auto;
    }

    .option-list {
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
        margin-bottom: 0.6rem;
        margin-top: 0;
    }

    .error {
        color: #fe3c3c;
    }

    .icon {
        display: inline-block;
        background-color: hsl(var(--color-hue), 60%, 50%);
        border: hsl(var(--color-hue), 60%, 40%) solid 2px;
        width: 1rem;
        height: 1rem;
        margin-bottom: -5px;
    }

    img {
        margin-left: 0.2rem;
        width: 1rem;
    }
</style>
