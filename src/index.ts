import { Server } from "socket.io";
import { createServer } from "http";
import {
    IPlayNoteEvent,
    IStopNoteEvent,
    IClientData,
    IInstrumentChangeEvent,
} from "./socket_events";
import { config } from "dotenv";
config();

const PORT = (process.env.PORT as number | undefined) ?? 5000;
const server = createServer().listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}.`);
});

const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ALLOW ?? "*",
        methods: ["GET", "POST"],
    },
});

const roomClientMap: Map<string, IClientData[]> = new Map();

io.on("connection", (socket) => {
    try {
        const roomName = socket.handshake.query.roomName;
        if (typeof roomName !== "string") throw new Error("Invalid roomName!");
        socket.join(roomName);

        const instrumentName = socket.handshake.query.instrumentName;
        if (typeof instrumentName !== "string") throw new Error("Invalid instrument name!");

        if (!roomClientMap.has(roomName)) roomClientMap.set(roomName, []);
        const connectedClients = roomClientMap.get(roomName)!;
        socket.emit("client_list_recieve", connectedClients);

        const clientData: IClientData = {
            colorHue: Math.round(Math.random() * 360).toString(),
            socketID: socket.id,
            instrumentName,
        };
        connectedClients.push(clientData);
        io.to(roomName).emit("client_connect", clientData);

        socket.on("instrument_change", (event) => {
            try {
                const instrumentEvent = event as IInstrumentChangeEvent;
                if (!instrumentEvent.instrumentName) throw null;

                instrumentEvent.socketID = socket.id;
                clientData.instrumentName = instrumentEvent.instrumentName;
                socket.to(roomName).emit("instrument_change", instrumentEvent);
            } catch (err) {
                socket.disconnect();
            }
        });

        socket.on("play_note", (event) => {
            try {
                const noteEvent = event as IPlayNoteEvent;
                if (!noteEvent.note || noteEvent.volume == null) throw null;

                noteEvent.socketID = socket.id;
                socket.to(roomName).emit("play_note", noteEvent);
            } catch (err) {
                socket.disconnect();
            }
        });

        socket.on("stop_note", (event) => {
            try {
                const noteEvent = event as IStopNoteEvent;
                if (!noteEvent.note || noteEvent.sustain == null) throw null;

                noteEvent.socketID = socket.id;
                socket.to(roomName).emit("stop_note", noteEvent);
            } catch (err) {
                socket.disconnect();
            }
        });

        socket.on("disconnect", () => {
            const index = connectedClients.findIndex((client) => client.socketID == socket.id);
            if (index !== -1) connectedClients.splice(index, 1);

            if (connectedClients.length === 0) roomClientMap.delete(roomName);
            socket.to(roomName).emit("client_disconnect", socket.id);
        });
    } catch (err) {
        socket.disconnect();
    }
});
