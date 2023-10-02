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

export interface IThread {
    audioNodeMap: Map<string, Player>;
    instrument?: Player;
    colorHue: string;
}

export class SocketPlayer {
    // These need to use svelte store so that the ui can update dynamically
    connecting = writable(false);
    connectError = writable("");
    instrumentName = writable<InstrumentName>("acoustic_grand_piano");
    connectedColorHues = writable<Map<string, string>>(new Map());
    connected = writable(false);

    // We need to use "threads" to allow for multiple users to play the same note
    threadMap = new Map<string, IThread>();
    originalThread: IThread = {
        audioNodeMap: new Map(),
        colorHue: "220",
    };
    socket: Socket | null = null;

    onPlayNote: (event: IPlayNoteEvent, thread: IThread) => void;
    onStopNote: (event: IStopNoteEvent, thread: IThread) => void;

    constructor() {
        // "0" is the threadID while playing offline
        this.threadMap.set("0", this.originalThread);

        this.instrumentName.subscribe((instrumentName) => {
            if (this.socket) {
                this.socket.emit("instrument_change", { instrumentName } as IInstrumentChangeEvent);
            }
            this.loadInstrument(instrumentName, this.socket?.id ?? "0");
        });
    }

    async loadInstrument(instrumentName: InstrumentName, threadID: string) {
        let instrument = await getInstrument(instrumentName);
        let thread = this.threadMap.get(threadID);
        if (thread) {
            thread.instrument = instrument;
        }
    }

    addThread({ socketID, colorHue, instrumentName }: IClientData) {
        this.threadMap.set(socketID, {
            audioNodeMap:
                socketID === this.socket.id ? this.originalThread.audioNodeMap : new Map(),
            colorHue,
        });

        // Need to do this get set thing to update the map
        this.connectedColorHues.set(get(this.connectedColorHues).set(socketID, colorHue));

        if (instrumentName) {
            this.loadInstrument(instrumentName, socketID);
        }
    }

    // Clean things up when disconnecting
    clean() {
        this.socket.removeAllListeners();
        this.socket = null;
        this.connecting.set(false);
        this.connected.set(false);
        this.threadMap.clear();
        this.threadMap.set("0", this.originalThread);
    }

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
            query: { roomName, instrumentName: get(this.instrumentName) },
            path: import.meta.env.VITE_BACKEND_PATH,
            reconnection: false,
            timeout: 1000 * 60, // 1 minute timeout
        });

        this.socket.on("connect_error", (err) => {
            this.clean();
            this.connectError.set("Failed to connect to server: " + err.message);
        });

        // Non built-in error sent by server
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
            this.threadMap.delete("0");
            get(this.connectedColorHues).clear();
            history.replaceState({}, undefined, `?room=${roomName}`);
            document.title = `Room ${roomName} - Play Piano!`;
        });

        this.socket.on("disconnect", () => {
            this.clean();
            history.replaceState({}, undefined, location.pathname);
            document.title = "Play Piano!";
        });

        this.socket.on("play_note", (event: IPlayNoteEvent) => {
            this.onPlayNote(event, this.threadMap.get(event.socketID));
        });

        this.socket.on("stop_note", (event: IStopNoteEvent) => {
            this.onStopNote(event, this.threadMap.get(event.socketID));
        });

        this.socket.on("instrument_change", (event: IInstrumentChangeEvent) => {
            this.loadInstrument(event.instrumentName, event.socketID);
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
            this.threadMap.delete(socketID);
        });
    }

    // These functions send the note event to the server as well as calling the piano functions with the correct thread
    playNote(note: string, volume: number) {
        const noteEvent: IPlayNoteEvent = { note, volume };
        if (this.socket) {
            this.socket.emit("play_note", noteEvent);
        }

        let thread = this.threadMap.get(this.socket?.id ?? "0");
        this.onPlayNote(noteEvent, thread);
    }

    stopNote(note: string, sustain: boolean) {
        const noteEvent: IStopNoteEvent = { note, sustain };
        if (this.socket) {
            this.socket.emit("stop_note", noteEvent);
        }

        let thread = this.threadMap.get(this.socket?.id ?? "0");
        this.onStopNote(noteEvent, thread);
    }
}
