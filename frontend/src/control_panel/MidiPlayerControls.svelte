<script lang="ts">
    import type { MidiPlayer } from "./midi_player";

    export let midiPlayer: MidiPlayer;

    // We need to destructure these so that we can use svelte bind syntax ($)
    let {
        isPlaying,
        isRecording,
        currentTime,
        speed,
        totalTime,
        selectedTrack,
        tracks,
        shouldPlaySolo,
    } = midiPlayer;

    $: midiInUse = $isPlaying || $isRecording;

    function startRecording() {
        midiPlayer.startRecording();

        if (!Boolean(localStorage.getItem("hasRecordedBefore"))) {
            alert("Play any key to start recording. Recording WILL override the selected track.");
            localStorage.setItem("hasRecordedBefore", "true");
        }
    }
</script>

<div>
    <p>Play midi:</p>
    <div>
        <input
            type="file"
            accept=".midi,.mid"
            on:change={(event) => midiPlayer.setFile(event.currentTarget.files?.[0])}
            disabled={midiInUse}
        />
    </div>

    <div>
        {#if midiInUse}
            <button on:click={() => midiPlayer.stopAndReseek()}>Stop</button>
        {:else}
            <button on:click={() => midiPlayer.startPlaying()} disabled={$tracks.length == 0}>
                Play
            </button>
        {/if}
        <button
            on:click={() => {
                $currentTime = 0;
                midiPlayer.stop();
                midiPlayer.lastStartFunc();
            }}
            disabled={$tracks.length == 0}
        >
            Restart
        </button>

        {#if $tracks.length > 0}
            <button title="Click to toggle" on:click={() => ($shouldPlaySolo = !$shouldPlaySolo)}>
                {$shouldPlaySolo ? "single track" : "all tracks"}
            </button>
        {/if}
    </div>

    <div>
        <button on:click={() => startRecording()} disabled={midiInUse}>Record</button>
        <button on:click={() => midiPlayer.saveFile()} disabled={$tracks.length == 0 || midiInUse}>
            Save
        </button>

        {#if $tracks.length > 0}
            <select bind:value={$selectedTrack} disabled={$isRecording}>
                {#each $tracks as track, i}
                    <option value={i}>{track.name || `[Track ${i}]`}</option>
                {/each}
            </select>
            <button on:click={() => midiPlayer.addTrack()} disabled={$isRecording}>
                Add Track
            </button>
            <button on:click={() => midiPlayer.deleteTrack()} disabled={$isRecording}>
                Delete Track
            </button>
        {/if}
    </div>

    <div style="display: flex;">
        <span>Speed</span>
        <input
            type="range"
            min="0.01"
            max="4"
            step="0.01"
            bind:value={$speed}
            title="Double click to set speed to normal"
            on:click={(e) => {
                // detail == 2 means double click
                if (e.detail == 2) {
                    $speed = 1;
                }
            }}
        />
        <input type="number" min="0.01" bind:value={$speed} />
        <span>times</span>
    </div>
    <div style="display: flex;">
        <input
            type="range"
            min="0"
            max={$totalTime}
            step="0.1"
            bind:value={$currentTime}
            on:mousedown={() => midiPlayer.stop()}
            on:mouseup={() => midiPlayer.lastStartFunc()}
            style="width: 18rem"
            disabled={$isRecording}
        />
        <span>{$currentTime.toFixed(1)}/{$totalTime.toFixed(1)} seconds</span>
    </div>
</div>

<style>
    div > div {
        margin-top: 0.2rem;
    }

    span {
        margin-right: 0.3rem;
    }
</style>
