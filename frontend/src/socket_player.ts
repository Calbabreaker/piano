import type { Socket } from "socket.io-client";
import * as Soundfont from "soundfont-player";
import { io } from "socket.io-client";
import { writable, get } from "svelte/store";
import type {
    IClientData,
    IPlayNoteEvent,
    IStopNoteEvent,
    IInstrumentChangeEvent,
} from "../../backend/src/socket_events";
import type { InstrumentName } from "./instrument_names";

export interface IThread {
    audioNodeMap: Map<string, Soundfont.Player>;
    instrument?: Soundfont.Player;
    colorHue: string;
}

export const socketPromise = writable<Promise<void> | undefined>();
export const instrumentName = writable<InstrumentName>("acoustic_grand_piano");

let socket: Socket | undefined;
let playNote: (event: IPlayNoteEvent) => void;
let stopNote: (event: IStopNoteEvent) => void;
let threadMap: Map<string, IThread>;

const AudioContext = window.AudioContext || window.webkitAudioContext;
if (!AudioContext) alert("Your browser does not seem to support the Web Audio API!");
const audioContext = new AudioContext();
const instrumentCache: { [key: string]: Promise<Soundfont.Player> } = {};

export function getInstrument(name: InstrumentName): Promise<Soundfont.Player> {
    if (!instrumentCache[name]) {
        instrumentCache[name] = Soundfont.instrument(audioContext, name);
    }

    return instrumentCache[name];
}

function loadInstrument(instrumentName: InstrumentName, threadID: string) {
    getInstrument(instrumentName).then((instrument) => {
        threadMap.get(threadID).instrument = instrument;
    });
}

export function socketSetup(
    playNoteParam: typeof playNote,
    stopNoteParam: typeof stopNote,
    threadMapParam: typeof threadMap
) {
    playNote = playNoteParam;
    stopNote = stopNoteParam;
    threadMap = threadMapParam;
}

export function socketConnect(roomName: string) {
    const promise = new Promise((resolve, reject) => {
        const BACKEND_HOST = process.env.BACKEND_HOST;
        if (!BACKEND_HOST) return reject("No backend server was specified in build!");

        socket = io(BACKEND_HOST, {
            query: { roomName, instrumentName: get(instrumentName) },
            path: process.env.BACKEND_PATH,
        });

        let originalThread: IThread;
        let thisAudioNodeMap: Map<string, Soundfont.Player> | undefined;

        if (threadMap.has("0")) {
            originalThread = threadMap.get("0");
            thisAudioNodeMap = originalThread.audioNodeMap;
        }

        socket.on("connect", () => {
            threadMap.delete("0");
            resolve(socket!);
        });

        socket.on("disconnect", () => {
            threadMap.clear();
            threadMap.set("0", originalThread);
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

        function addThread({ socketID, colorHue, instrumentName }: IClientData) {
            threadMap.set(socketID, {
                audioNodeMap: thisAudioNodeMap ? thisAudioNodeMap : new Map(),
                colorHue,
            });

            thisAudioNodeMap = undefined;

            if (instrumentName) loadInstrument(instrumentName, socketID);
        }

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
            threadMap.delete(socketID);
        });
    });

    socketPromise.set(promise as Promise<void>);
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
