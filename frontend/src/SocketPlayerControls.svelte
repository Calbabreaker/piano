<script lang="ts">
    import spinner from "./spinner.svg";
    import { SocketPlayer } from "./socket_player";
    import { onMount } from "svelte";

    export let socketPlayer: SocketPlayer;
    let roomName = "";

    // We need to destructure these so that we can use svelte bind syntax ($)
    let { connected, connecting, connectError, connectedColorHues } = socketPlayer;

    onMount(() => {
        // Gets the ?room=[room_name] from the url and connects to a room
        const urlParams = new URLSearchParams(location.search);
        const urlRoomName = urlParams.get("room");
        if (urlRoomName != null) {
            roomName = urlRoomName;
            socketPlayer.connect(roomName);
        }
    });
</script>

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

<style>
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
