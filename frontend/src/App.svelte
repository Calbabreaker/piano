<script lang="ts">
    import Piano from "./Piano.svelte";
    import ControlPanel from "./control_panel/ControlPanel.svelte";
    import { MidiPlayer } from "./control_panel/midi_player";
    import { SocketPlayer } from "./control_panel/socket_player";
    import { PianoControlsData } from "./control_panel/PianoControlsList.svelte";

    // Seperate functionallity to seperate classes for better modularity
    const pianoControlsData = new PianoControlsData();
    const midiPlayer = new MidiPlayer();
    const socketPlayer = new SocketPlayer();
</script>

<main>
    <ControlPanel {pianoControlsData} {midiPlayer} {socketPlayer} />
    <Piano {pianoControlsData} {midiPlayer} {socketPlayer} />
</main>
