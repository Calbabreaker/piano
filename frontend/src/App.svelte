<script lang="ts">
    import Piano from "./Piano.svelte";
    import ControlPanel from "./ControlPanel.svelte";
</script>

<main>
    <ControlPanel/>
    <Piano startNote="A0" endNote="C8" />
</main>
