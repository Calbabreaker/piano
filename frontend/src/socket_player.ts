import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import type { Player } from "soundfont-player";
import { writable, get } from "svelte/store";
import type {
    IClientData,
    IPlayNoteEvent,
    IStopNoteEvent,
    IInstrumentChangeEvent,
} from "../../backend/src/socket_events";
import type { InstrumentName } from "../../backend/src/instrument_names";
import { getInstrument } from "./utils";

// Client represents a connected client and contains there own instrument and audio node map
// to allow for multiple clients to play the same note at the same time
export class Client {
    audioNodeMap = new Map<string, Player>();
    instrument?: Player;
    instrumentName?: InstrumentName;
    colorHue: string;

    constructor(colorHue: string) {
        this.colorHue = colorHue;
    }

    async setInstrument(instrumentName: InstrumentName) {
        this.instrumentName = instrumentName;
        this.instrument = await getInstrument(instrumentName);
    }

    stopAudio(note: string) {
        if (this.audioNodeMap.get(note)) {
            this.audioNodeMap.get(note).stop();
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

    clean() {
        // Stop all notes to prevent memory leak
        for (const note of this.audioNodeMap.values()) {
            note.stop();
        }

        this.audioNodeMap.clear();
    }
}

export class SocketPlayer {
    // These need to use svelte store so that the ui can update dynamically
    connecting = writable(false);
    connectError = writable("");
    connectedColorHues = writable<Map<string, string>>(new Map());
    connected = writable(false);

    clientMap = new Map<string, Client>();
    localClient = new Client("220");
    socket: Socket | null = null;

    onPlayNote: (event: IPlayNoteEvent, thread: Client) => void;
    onStopNote: (event: IStopNoteEvent, thread: Client) => void;

    // Connects to a server using socketio and sets the listeners
    connect(roomName: string) {
        if (get(this.connecting) || get(this.connected)) {
            return;
        }

        if (roomName.length > 100) {
            return this.connectError.set("Room name to long!");
        }

        const BACKEND_HOST = import.meta.env.VITE_BACKEND_HOST;
        if (!BACKEND_HOST) {
            return this.connectError.set("No backend server was specified in build!");
        }

        this.connectError.set("");
        this.connecting.set(true);

        this.socket = io(BACKEND_HOST, {
            query: { roomName, instrumentName: this.localClient.instrumentName },
            path: import.meta.env.VITE_BACKEND_PATH,
            reconnection: false,
            timeout: 1000 * 60, // 1 minute timeout
        });

        this.socket.on("connect_error", (err) => {
            this.clean();
            this.connectError.set("Failed to connect to server: " + err.message);
        });

        // Non custom error message sent by server
        this.socket.on("error_message", (message: string) => {
            this.connectError.set(message);
        });

        this.socket.on("connect_timeout", () => {
            this.clean();
            this.connectError.set("Timed out while connecting to server!");
        });

        this.socket.on("connect", () => {
            this.connecting.set(false);
            this.connected.set(true);

            // Set the url to end in /?room=[name] also change the title
            history.replaceState({}, undefined, `?room=${roomName}`);
            document.title = `Room ${roomName} - Play Piano!`;
        });

        this.socket.on("disconnect", () => {
            this.clean();
            history.replaceState({}, undefined, location.pathname);
            document.title = "Play Piano!";
        });

        this.socket.on("play_note", (event: IPlayNoteEvent) => {
            this.onPlayNote(event, this.clientMap.get(event.socketID));
        });

        this.socket.on("stop_note", (event: IStopNoteEvent) => {
            this.onStopNote(event, this.clientMap.get(event.socketID));
        });

        this.socket.on("change_instrument", async (event: IInstrumentChangeEvent) => {
            const thread = this.clientMap.get(event.socketID);
            thread.setInstrument(event.instrumentName);
        });

        this.socket.on("client_connect", (data: IClientData) => {
            this.addThread(data);
        });

        this.socket.on("client_list_recieve", (clientDatas: IClientData[]) => {
            for (let clientData of clientDatas) {
                this.addThread(clientData);
            }
        });

        this.socket.on("client_disconnect", (socketID: string) => {
            const colorHues = get(this.connectedColorHues);
            colorHues.delete(socketID);
            this.connectedColorHues.set(colorHues);
            this.clientMap.get(socketID).clean();
            this.clientMap.delete(socketID);
        });
    }

    // These functions send the note event to the server as well as calling the inner note play/stop functions with the local thread
    playNote(note: string, volume: number) {
        const noteEvent: IPlayNoteEvent = { note, volume };
        this.onPlayNote(noteEvent, this.localClient);

        if (this.socket) {
            this.socket.emit("play_note", noteEvent);
        }
    }

    stopNote(note: string, sustain: boolean) {
        const noteEvent: IStopNoteEvent = { note, sustain };
        this.onStopNote(noteEvent, this.localClient);

        if (this.socket) {
            this.socket.emit("stop_note", noteEvent);
        }
    }

    async changeInstrument(instrumentName: InstrumentName) {
        const event = { instrumentName } as IInstrumentChangeEvent;
        if (this.socket) {
            this.socket.emit("change_instrument", event);
        }

        await this.localClient.setInstrument(instrumentName);
    }

    private addThread({ socketID, colorHue, instrumentName }: IClientData) {
        const colorHues = get(this.connectedColorHues);
        colorHues.set(socketID, colorHue);
        this.connectedColorHues.set(colorHues);

        // If we're adding the local client, then just move over the localClientThread
        if (socketID == this.socket.id) {
            this.localClient.colorHue = colorHue;
            this.clientMap.set(socketID, this.localClient);
        } else {
            const client = new Client(colorHue);
            this.clientMap.set(socketID, client);
            client.setInstrument(instrumentName);
        }
    }

    // Clean and reset things when disconnecting
    private clean() {
        for (const client of this.clientMap.values()) {
            client.clean();
        }

        this.socket.removeAllListeners();
        this.socket = null;
        this.connecting.set(false);
        this.connected.set(false);
        this.clientMap.clear();
        this.localClient.colorHue = "220";
        get(this.connectedColorHues).clear();
    }
}
