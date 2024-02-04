<script lang="ts">
    import type { MidiPlayer } from "./midi_player";

    export let midiPlayer: MidiPlayer;

    // We need to destructure these so that we can use svelte bind syntax ($)
    let {
        midiIsPlaying,
        midiIsRecording,
        midiCurrentTime,
        midiSpeed,
        midiTotalTime,
        selectedMidiTrack,
        midiTracks,
        midiPlaySolo,
    } = midiPlayer;

    $: midiInUse = $midiIsPlaying || $midiIsRecording;

    function startRecording() {
        if (!Boolean(localStorage.getItem("hasRecordedBefore"))) {
            alert("Play any key to start recording. Recording WILL override the selected track.");
            localStorage.setItem("hasRecordedBefore", "true");
        }

        midiPlayer.startRecording();
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
            <button on:click={() => midiPlayer.startPlaying()} disabled={$midiTracks.length == 0}>
                Play
            </button>
        {/if}
        <button
            on:click={() => {
                $midiCurrentTime = 0;
                midiPlayer.stop();
                midiPlayer.lastStartFunc();
            }}
            disabled={$midiTracks.length == 0}
        >
            Restart
        </button>

        {#if $midiTracks.length > 0}
            <select bind:value={$midiPlaySolo}>
                <option value={false}>all tracks</option>
                <option value={true}>single track</option>
            </select>
        {/if}
    </div>

    <div>
        <button on:click={() => startRecording()} disabled={midiInUse}>Record</button>
        <button
            on:click={() => midiPlayer.saveFile()}
            disabled={$midiTracks.length == 0 || midiInUse}
        >
            Save
        </button>

        {#if $midiTracks.length > 0}
            <select bind:value={$selectedMidiTrack} disabled={$midiIsRecording}>
                {#each $midiTracks as track, i}
                    <option value={i}>{track.name || `[Track ${i}]`}</option>
                {/each}
            </select>
            <button on:click={() => midiPlayer.addTrack()} disabled={$midiIsRecording}>
                Add Track
            </button>
            <button on:click={() => midiPlayer.deleteTrack()} disabled={$midiIsRecording}>
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
            bind:value={$midiSpeed}
            title="Double click to set speed to normal"
            on:click={(e) => {
                // detail == 2 means double click
                if (e.detail == 2) {
                    $midiSpeed = 1;
                }
            }}
        />
        <input type="number" min="0.01" bind:value={$midiSpeed} />
        <span>times</span>
    </div>
    <div style="display: flex;">
        <input
            type="range"
            min="0"
            max={$midiTotalTime}
            step="0.1"
            bind:value={$midiCurrentTime}
            on:mousedown={() => midiPlayer.stop()}
            on:mouseup={() => midiPlayer.lastStartFunc()}
            style="width: 18rem"
            disabled={$midiIsRecording}
        />
        <span>{$midiCurrentTime.toFixed(1)}/{$midiTotalTime.toFixed(1)} seconds</span>
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
