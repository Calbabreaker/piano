<script lang="ts">
    import type { MidiPlayer } from "./midi_player";
    import MidiPlayerControls from "./MidiPlayerControls.svelte";
    import PianoControlsList, { type PianoControlsData } from "./PianoControlsList.svelte";
    import SocketPlayerControls from "./SocketPlayerControls.svelte";
    import type { SocketPlayer } from "./socket_player";

    export let pianoControlsData: PianoControlsData;
    export let midiPlayer: MidiPlayer;
    export let socketPlayer: SocketPlayer;
</script>

<div class="control-panel">
    <!-- Seperate out the different sections of the control panel so that it is more digestable to read -->
    <div class="row">
        <PianoControlsList {pianoControlsData} {socketPlayer} />
        <MidiPlayerControls {midiPlayer} />
    </div>

    <SocketPlayerControls {socketPlayer} />
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
</style>
