<script lang="ts">
    import Piano from "./Piano.svelte";
    import ControlPanel, { ControlPanelData } from "./ControlPanel.svelte";

    let controlPanelData = new ControlPanelData();
</script>

<main>
    <ControlPanel {controlPanelData} />
    <Piano {controlPanelData} />
</main>

<style>
    main {
        height: 100%;
        display: flex;
        flex-flow: column;
    }
</style>
