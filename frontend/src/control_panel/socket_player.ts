import { writable, get } from "svelte/store";
import type { InstrumentName } from "../instrument_names";
import type { ClientMessage, ServerMessage } from "src/server_bindings";
import * as msgpack from "@msgpack/msgpack";
import { SocketClient } from "./socket_client";

export class SocketPlayer {
    // These need to use svelte store so that the ui can update dynamically
    connecting = writable(false);
    connectError = writable("");
    connectedColorHues = writable<Map<number, number>>(new Map());
    connected = writable(false);

    clientMap = new Map<number, SocketClient>();
    localClient = new SocketClient({
        color_hue: 220,
        id: 0,
        instrument_name: "acoustic_grand_piano",
    });
    socket: WebSocket | null = null;

    // Note play functions to be set by the piano (gets called when needs to be played)
    onPlayNote?: (note: string, volume: number, client: SocketClient) => void;
    onStopNote?: (note: string, sustain: boolean, client: SocketClient) => void;

    // Connects to a server using socketio and sets the listeners
    connect(roomName: string, maxRetries = 6) {
        if (roomName.length > 100) {
            return this.connectError.set("Room name to long!");
        }

        const backendHost = import.meta.env.VITE_BACKEND_HOST;
        if (!backendHost) {
            return this.connectError.set("No backend server was specified in build!");
        }
        const protocol = location.protocol === "https:" ? "wss" : "ws";
        const backendPath = import.meta.env.VITE_BACKEND_PATH ?? "";
        const query = `room_name=${roomName}&instrument_name=${this.localClient.instrumentName}`;
        this.socket = new WebSocket(`${protocol}://${backendHost}/${backendPath}?${query}`);
        this.socket.binaryType = "arraybuffer";

        this.socket.onopen = () => {
            console.log("Connected to websocket");
            this.connecting.set(false);
            this.connected.set(true);

            // Set the url to end in /?room=[name] also change the title
            history.replaceState({}, "", `?room=${roomName}`);
            document.title = `Room ${roomName} - Play Piano!`;
        };

        this.socket.onclose = () => {
            history.replaceState({}, "", location.pathname);
            document.title = "Play Piano!";
            this.clean();
            this.connected.set(false);
        };

        this.socket.onerror = () => {
            console.log(`Failed to connect, reconnecting ${maxRetries} attempts left`);
            setTimeout(() => {
                if (maxRetries == 0) {
                    this.connectError.set("Failed to connect to websocket server");
                    this.disconnect();
                } else {
                    this.connect(roomName, maxRetries - 1);
                }
            }, 1000);
        };

        this.socket.onmessage = async (event) => {
            if (event.data instanceof ArrayBuffer) {
                const message = msgpack.decode(new Uint8Array(event.data));
                if (message) {
                    this.handleMessage(message as ServerMessage);
                }
            }
        };

        this.connectError.set("");
        this.connecting.set(true);
    }

    // Purposefully disconnect
    disconnect() {
        this.connected.set(false);
        this.connecting.set(false);
        if (this.socket) {
            this.socket.close();
        }
    }

    // These functions send the note event to the server as well as calling the inner note play/stop functions with the local client
    playNote(note: string, volume: number) {
        this.onPlayNote!(note, volume, this.localClient);
        this.sendMessage({ type: "Play", note, volume });
    }

    stopNote(note: string, sustain: boolean) {
        this.onStopNote!(note, sustain, this.localClient);
        this.sendMessage({ type: "Stop", note, sustain });
    }

    async changeInstrument(instrumentName: InstrumentName) {
        this.sendMessage({ type: "InstrumentChange", instrument_name: instrumentName });
        await this.localClient.setInstrument(instrumentName);
    }

    private handleMessage(message: ServerMessage) {
        switch (message.type) {
            case "Error":
                this.connectError.set(message.error);
                break;
            case "Relay":
                this.handleRelayMessage(message.msg, message.id);
                break;
            case "ClientConnect":
                this.addClient(new SocketClient(message));
                break;
            case "ReceiveInfo": {
                for (const client of message.client_list) {
                    this.addClient(new SocketClient(client));
                }

                const client = message.created_client;
                this.localClient.colorHue = client.color_hue;
                this.localClient.socketID = message.created_client.id;
                this.addClient(this.localClient);
                break;
            }
            case "ClientDisconnect":
                this.connectedColorHues.update((colorHues) => {
                    colorHues.delete(message.id);
                    return colorHues;
                });
                const client = this.getClient(message.id);
                if (client) {
                    this.cleanClient(client);
                    this.clientMap.delete(message.id);
                }
                break;
        }
    }

    private handleRelayMessage(message: ClientMessage, id: number) {
        switch (message.type) {
            case "Play":
                this.onPlayNote!(message.note, message.volume, this.getClient(id)!);
                break;
            case "Stop":
                this.onStopNote!(message.note, message.sustain, this.getClient(id)!);
                break;
            case "InstrumentChange":
                this.getClient(id)!.setInstrument(message.instrument_name as InstrumentName);
                break;
        }
    }

    private getClient(socketID: number) {
        return this.clientMap.get(socketID);
    }

    private sendMessage(message: ClientMessage) {
        // Only send when other people have connected
        if (this.clientMap.size == 1) {
            return;
        }

        if (this.socket && get(this.connected)) {
            this.socket.send(msgpack.encode(message));
        }
    }

    private addClient(client: SocketClient) {
        this.connectedColorHues.update((colorHues) => {
            colorHues.set(client.socketID!, client.colorHue);
            return colorHues;
        });

        this.clientMap.set(client.socketID!, client);
    }

    // Clean and reset things when disconnecting
    private clean() {
        for (const client of this.clientMap.values()) {
            this.cleanClient(client);
        }

        this.socket = null;
        this.clientMap.clear();
        this.localClient.colorHue = 220;
        this.localClient.socketID = 0;
        this.connectedColorHues.update((colorHues) => {
            colorHues.clear();
            return colorHues;
        });
    }

    private cleanClient(client: SocketClient) {
        // Stop all notes to prevent notes still held after disconnect
        for (const note of client.stopAudioMap.keys()) {
            this.onStopNote!(note, false, client);
        }
    }
}
