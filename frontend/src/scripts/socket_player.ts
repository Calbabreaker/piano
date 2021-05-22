import { io, Socket } from "socket.io-client";
import { Keyboard } from "./keyboard";
import { InstrumentCache } from "./utils";
import { IClientData, IPlayNoteEvent, IStopNoteEvent } from "~/../backend/src/socket_events";
import { InstrumentName } from "~/../backend/src/instrument_names";

export class SocketPlayer {
    socket?: Socket;
    keyboard: Keyboard;
    instrumentCache: InstrumentCache;

    constructor(keyboard: Keyboard, instrumentCache: InstrumentCache) {
        this.keyboard = keyboard;
        this.instrumentCache = instrumentCache;
    }

    connect(roomName: string): Promise<Socket> {
        return new Promise((resolve, reject) => {
            const BACKEND_URL = process.env.BACKEND_URL;
            if (BACKEND_URL === undefined) return reject("No server specified in client build!");
            this.socket = io(BACKEND_URL, {
                query: { roomName },
            });

            this.socket.on("connect", () => {
                this.keyboard.threads.delete("0");
                resolve(this.socket!);
            });

            this.socket.on("play_note", (event) => {
                const noteEvent = event as IPlayNoteEvent;
                const instrument = this.instrumentCache.get(noteEvent.instrumentName);
                this.keyboard.playNote(
                    instrument,
                    noteEvent.note,
                    noteEvent.volume,
                    event.socketID
                );
            });

            this.socket.on("stop_note", (event) => {
                const noteEvent = event as IStopNoteEvent;
                const instrument = this.instrumentCache.get(noteEvent.instrumentName);
                this.keyboard.stopNote(
                    instrument,
                    noteEvent.note,
                    noteEvent.sustain,
                    event.socketID
                );
            });

            this.socket.on("client_connect", (data) => {
                const clientData = data as IClientData;
                this.keyboard.addThread(clientData.socketID, clientData.colorHue);
            });

            this.socket.on("client_list_recieve", (datas) => {
                const clientDatas = datas as IClientData[];
                for (let clientData of clientDatas) {
                    this.keyboard.addThread(clientData.socketID, clientData.colorHue);
                }
            });
        });
    }

    playNote(note: string, instrumentName: InstrumentName, volume: number): boolean {
        if (this.socket === undefined) return false;
        const noteEvent: IPlayNoteEvent = {
            note,
            instrumentName,
            volume,
        };

        this.socket.emit("play_note", noteEvent);
        return true;
    }

    stopNote(note: string, instrumentName: InstrumentName, sustain: boolean): boolean {
        if (this.socket === undefined) return false;
        const noteEvent: IStopNoteEvent = {
            note,
            instrumentName,
            sustain,
        };

        this.socket.emit("stop_note", noteEvent);
        return true;
    }
}
