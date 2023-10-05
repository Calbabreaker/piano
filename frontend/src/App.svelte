<script lang="ts">
    import Piano from "./Piano.svelte";
    import ControlPanel from "./ControlPanel.svelte";
    import { MidiPlayer } from "./midi_player";
    import { SocketPlayer } from "./socket_player";
    import { PianoControlsData } from "./PianoControlsList.svelte";

    // Seperate functionallity to seperate classes for better modularity
    const pianoControlsData = new PianoControlsData();
    const midiPlayer = new MidiPlayer();
    const socketPlayer = new SocketPlayer();
</script>

<main>
    <ControlPanel {pianoControlsData} {midiPlayer} {socketPlayer} />
    <Piano {pianoControlsData} {midiPlayer} {socketPlayer} />
</main>
