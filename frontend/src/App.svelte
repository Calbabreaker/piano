<script lang="ts">
    import Piano from "./Piano.svelte";
    import ControlPanel from "./ControlPanel.svelte";
</script>

<main>
    <ControlPanel />
    <Piano />
</main>

<style>
    main {
        height: 100%;
        display: flex;
        flex-flow: column;
    }
</style>
