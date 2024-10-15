import type { Player } from "soundfont-player";
import { writable, get } from "svelte/store";
import { getInstrument } from "../utils";
import type { InstrumentName } from "../instrument_names";
import type { ClientData, WebsocketMessage } from "src/server_bindings";

// Client represents a connected client and contains there own instrument and audio node map
// to allow for multiple clients to play the same note at the same time
export class Client {
    audioNodeMap = new Map<string, Player>();
    instrument?: Player;
    instrumentName?: InstrumentName;
    colorHue: number;
    socketID: number;

    constructor(clientData: ClientData) {
        this.colorHue = clientData.color_hue;
        this.socketID = clientData.id;
        this.setInstrument(clientData.instrument_name as InstrumentName);
    }

    async setInstrument(instrumentName: InstrumentName) {
        this.instrumentName = instrumentName;
        this.instrument = await getInstrument(instrumentName);
    }

    stopAudio(note: string) {
        const node = this.audioNodeMap.get(note);
        if (node) {
            node.stop();
            this.audioNodeMap.delete(note);
        }
    }

    playAudio(note: string, volume: number) {
        if (this.instrument) {
            this.stopAudio(note);
            this.audioNodeMap.set(
                note,
                this.instrument.play(note, undefined, {
                    gain: volume,
                }),
            );
        }
    }
}

export class SocketPlayer {
    // These need to use svelte store so that the ui can update dynamically
    connecting = writable(false);
    connectError = writable("");
    connectedColorHues = writable<Map<number, number>>(new Map());
    connected = writable(false);

    clientMap = new Map<number, Client>();
    localClient = new Client({
        color_hue: 220,
        id: 0,
        instrument_name: "acoustic_grand_piano",
    });
    socket: WebSocket | null = null;

    // Note play functions to be set by the piano (gets called when needs to be played)
    onPlayNote?: (note: string, volume: number, client: Client) => void;
    onStopNote?: (note: string, sustain: boolean, client: Client) => void;

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

            // Try reconnect if unexpectedly disconnected
            if (get(this.connected)) {
                console.log("Trying to reconnect");
                this.connect(roomName);
                this.connected.set(false);
            }
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

        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message) {
                this.handleMessage(message);
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

    handleMessage(message: WebsocketMessage) {
        switch (message.type) {
            case "Error":
                this.connectError.set(message.error);
                break;
            case "PlayNote":
                this.onPlayNote!(message.note, message.volume, this.getClient(message.id!)!);
                break;
            case "StopNote":
                this.onStopNote!(message.note, message.sustain, this.getClient(message.id!)!);
                break;
            case "InstrumentChange":
                this.getClient(message.id!)!.setInstrument(
                    message.instrument_name as InstrumentName,
                );
                break;
            case "ClientConnect":
                this.addClient(new Client(message));
                break;
            case "ReceiveInfo": {
                for (const client of message.client_list) {
                    this.addClient(new Client(client));
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

    getClient(socketID: number) {
        return this.clientMap.get(socketID);
    }

    // These functions send the note event to the server as well as calling the inner note play/stop functions with the local thread
    playNote(note: string, volume: number) {
        this.onPlayNote!(note, volume, this.localClient);
        this.sendMessage("PlayNote", { note, volume });
    }

    stopNote(note: string, sustain: boolean) {
        this.onStopNote!(note, sustain, this.localClient);
        this.sendMessage("StopNote", { note, sustain });
    }

    sendMessage(type: string, message: Record<string, any>) {
        if (this.socket && get(this.connected)) {
            this.socket.send(JSON.stringify({ type, ...message }));
        }
    }

    async changeInstrument(instrumentName: InstrumentName) {
        this.sendMessage("InstrumentChange", { instrument_name: instrumentName });

        await this.localClient.setInstrument(instrumentName);
    }

    private addClient(client: Client) {
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

    private cleanClient(client: Client) {
        // Stop all notes to prevent notes still held after disconnect
        for (const note of client.audioNodeMap.keys()) {
            this.onStopNote!(note, false, client);
        }
    }
}
