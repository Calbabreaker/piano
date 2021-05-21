import { io, Socket } from "socket.io-client";

export class SocketPlayer {
    socket: Socket | null = null;
    playNoteFunc: (note: string, velocity: number) => void;
    stopNoteFunc: (note: string) => void;

    constructor(
        playNoteFunc: SocketPlayer["playNoteFunc"],
        stopNoteFunc: SocketPlayer["stopNoteFunc"]
    ) {
        this.playNoteFunc = playNoteFunc;
        this.stopNoteFunc = stopNoteFunc;
    }

    connect(): Promise<Socket> {
        return new Promise((resolve, reject) => {
            const BACKEND_URL = process.env.BACKEND_URL;
            if (BACKEND_URL === undefined) return reject("No server specified in client build!");
            this.socket = io(BACKEND_URL);

            this.socket.on("connect_failed", () => {
                reject("Failed to connect to server!");
            });

            this.socket.on("connection", () => {
                resolve(this.socket!);
            });
        });
    }
}
