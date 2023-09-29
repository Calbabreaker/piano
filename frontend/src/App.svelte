<script lang="ts">
    import Piano from "./Piano.svelte";
    import ControlPanel, { ControlPanelData } from "./ControlPanel.svelte";
    import { MidiPlayer } from "./midi_player";
    import { SocketPlayer } from "./socket_player";

    const controlPanelData = new ControlPanelData();
    const midiPlayer = new MidiPlayer();
    const socketPlayer = new SocketPlayer();
</script>

<main>
    <ControlPanel {controlPanelData} {midiPlayer} {socketPlayer} />
    <Piano {controlPanelData} {midiPlayer} {socketPlayer} />
</main>

<style>
    main {
        height: 100%;
        display: flex;
        flex-flow: column;
    }
</style>
