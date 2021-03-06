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
import type { InstrumentName } from "./instrument_names";
import { getInstrument } from "./utils";

export interface IThread {
    audioNodeMap: Map<string, Player>;
    instrument?: Player;
    colorHue: string;
}

export const socketPromise = writable<Promise<void> | undefined>();
export const instrumentName = writable<InstrumentName>("acoustic_grand_piano");
export const connectedColorHues = writable<Map<string, string>>(new Map());
export const connected = writable<boolean>(false);

export const threadMap = new Map<string, IThread>();
// "0" is the threadID while playing offline
export const originalThread: IThread = {
    audioNodeMap: new Map(),
    colorHue: "220",
};
threadMap.set("0", originalThread);

export let socket: Socket | null;
let playNote: (event: IPlayNoteEvent) => void;
let stopNote: (event: IStopNoteEvent) => void;

async function loadInstrument(instrumentName: InstrumentName, threadID: string) {
    let instrument = await getInstrument(instrumentName);
    let thread = threadMap.get(threadID);
    if (thread) thread.instrument = instrument;
}

function addThread({ socketID, colorHue, instrumentName }: IClientData) {
    // keep the audioNodeMap the same in order for Piano
    // component to stop notes correctly
    threadMap.set(socketID, {
        audioNodeMap: socketID === socket.id ? originalThread.audioNodeMap : new Map(),
        colorHue,
    });

    connectedColorHues.set(get(connectedColorHues).set(socketID, colorHue));

    if (instrumentName) loadInstrument(instrumentName, socketID);
}

function cleanSocket() {
    socket.removeAllListeners();
    socket = null;
    connected.set(false);
}

export function socketSetup(playNoteParam: typeof playNote, stopNoteParam: typeof stopNote) {
    playNote = playNoteParam;
    stopNote = stopNoteParam;
}

export function socketConnect(roomName: string) {
    const promise = new Promise<void>((resolve, reject) => {
        const BACKEND_HOST = import.meta.env.VITE_BACKEND_HOST;
        if (!BACKEND_HOST) return reject("No backend server was specified in build!");

        socket = io(BACKEND_HOST, {
            query: { roomName, instrumentName: get(instrumentName) },
            path: import.meta.env.VITE_BACKEND_PATH,
        });

        socket.on("connect_error", () => {
            cleanSocket();
            reject("Failed to connect to server!");
        });

        socket.on("connect_timeout", () => {
            cleanSocket();
            reject("Timed out while connecting to server!");
        });

        socket.on("connect", () => {
            connected.set(true);
            threadMap.delete("0");
            get(connectedColorHues).clear();
            resolve();

            history.replaceState({}, `Play Piano! - ${roomName}`, `?room=${roomName}`);
        });

        socket.on("disconnect", () => {
            threadMap.clear();
            threadMap.set("0", originalThread);
            cleanSocket();

            history.replaceState({}, `Play Piano!`, location.pathname);
        });

        socket.on("play_note", (event) => {
            playNote(event as IPlayNoteEvent);
        });

        socket.on("stop_note", (event) => {
            stopNote(event as IStopNoteEvent);
        });

        socket.on("instrument_change", (event) => {
            const { instrumentName, socketID } = event as IInstrumentChangeEvent;

            loadInstrument(instrumentName, socketID);
        });

        socket.on("client_connect", (data) => {
            addThread(data as IClientData);
        });

        socket.on("client_list_recieve", (datas) => {
            const clientDatas = datas as IClientData[];
            for (let clientData of clientDatas) {
                addThread(clientData);
            }
        });

        socket.on("client_disconnect", (socketID) => {
            const colorHues = get(connectedColorHues);
            colorHues.delete(socketID);
            connectedColorHues.set(colorHues);
            threadMap.delete(socketID);
        });
    });

    socketPromise.set(promise);
}

export function socketPlayNote(note: string, volume: number) {
    const noteEvent: IPlayNoteEvent = { note, volume };
    if (socket) {
        socket.emit("play_note", noteEvent);
    } else {
        playNote(noteEvent);
    }
}

export function socketStopNote(note: string, sustain: boolean) {
    const noteEvent: IStopNoteEvent = { note, sustain };
    if (socket) {
        socket.emit("stop_note", noteEvent);
    } else {
        stopNote(noteEvent);
    }
}

instrumentName.subscribe((instrumentName) => {
    if (socket) {
        socket.emit("instrument_change", { instrumentName } as IInstrumentChangeEvent);
    } else {
        loadInstrument(instrumentName, "0");
    }
});
