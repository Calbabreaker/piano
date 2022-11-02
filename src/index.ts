import { Server } from "socket.io";
import { createServer } from "http";
import {
    IPlayNoteEvent,
    IStopNoteEvent,
    IClientData,
    IInstrumentChangeEvent,
} from "./socket_events";
import { InstrumentName, instrumentNames } from "./instrument_names";
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

const instrumentNameMap: { [key: string]: boolean } = {};
instrumentNames.forEach((name) => {
    instrumentNameMap[name] = true;
});

const roomClientMap: Map<string, IClientData[]> = new Map();

io.on("connection", (socket) => {
    const roomName = socket.handshake.query?.roomName;
    const instrumentName = socket.handshake.query?.instrumentName;
    if (
        typeof roomName !== "string" ||
        typeof instrumentName !== "string" ||
        !instrumentNameMap[instrumentName]
    ) {
        socket.disconnect();
        return;
    }

    socket.join(roomName);
    if (!roomClientMap.has(roomName)) {
        roomClientMap.set(roomName, []);
    }

    const connectedClients = roomClientMap.get(roomName)!;
    socket.emit("client_list_recieve", connectedClients);

    const clientData: IClientData = {
        colorHue: Math.round(Math.random() * 360).toString(),
        socketID: socket.id,
        instrumentName: instrumentName as InstrumentName,
    };
    connectedClients.push(clientData);
    io.to(roomName).emit("client_connect", clientData);

    socket.on("instrument_change", (event) => {
        const instrumentEvent = event as IInstrumentChangeEvent;
        if (!instrumentNameMap[instrumentEvent?.instrumentName]) {
            socket.disconnect();
        }

        instrumentEvent.socketID = socket.id;
        clientData.instrumentName = instrumentEvent.instrumentName;
        socket.to(roomName).emit("instrument_change", instrumentEvent);
    });

    socket.on("play_note", (event) => {
        const noteEvent = event as IPlayNoteEvent;
        if (typeof noteEvent?.note === "string" && typeof noteEvent?.volume === "number") {
            noteEvent.socketID = socket.id;
            socket.to(roomName).emit("play_note", noteEvent);
        } else {
            socket.disconnect();
        }
    });

    socket.on("stop_note", (event) => {
        const noteEvent = event as IStopNoteEvent;
        if (typeof noteEvent?.note === "string" && typeof noteEvent?.sustain === "boolean") {
            noteEvent.socketID = socket.id;
            socket.to(roomName).emit("stop_note", noteEvent);
        } else {
            socket.disconnect();
        }
    });

    socket.on("disconnect", () => {
        const index = connectedClients.findIndex((client) => client.socketID == socket.id);
        if (index !== -1) connectedClients.splice(index, 1);

        if (connectedClients.length === 0) {
            roomClientMap.delete(roomName);
        } else {
            socket.to(roomName).emit("client_disconnect", socket.id);
        }
    });
});
