import { Server } from "socket.io";
import { createServer } from "http";
import type {
    IPlayNoteEvent,
    IStopNoteEvent,
    IClientData,
    IInstrumentChangeEvent,
} from "./socket_events";
import { type InstrumentName, instrumentNames } from "./instrument_names";
import { config } from "dotenv";
config();

const PORT = (process.env.PORT as number | undefined) ?? 5000;
const server = createServer().listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on 0.0.0.0:${PORT}.`);
});

const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ALLOW ?? "*",
        methods: ["GET", "POST"],
    },
});

// Used to check if an instrument name is invalid
const instrumentNameMap: { [key: string]: boolean } = {};
instrumentNames.forEach((name) => {
    instrumentNameMap[name] = true;
});

// A map of a room to client datas
const roomClientMap: Map<string, IClientData[]> = new Map();

io.on("connection", (socket) => {
    const roomName = socket.handshake.query?.roomName;
    const instrumentName = socket.handshake.query?.instrumentName;

    function kick(message = "Something is wrong with the client") {
        socket.emit("error_message", message);
        socket.disconnect();
    }

    // If the queries are not valid then immediately disconnect the user since that should not be happening
    if (
        typeof roomName !== "string" ||
        roomName.length > 100 ||
        typeof instrumentName !== "string" ||
        !instrumentNameMap[instrumentName]
    ) {
        kick();
        return;
    }

    if (!roomClientMap.has(roomName)) {
        roomClientMap.set(roomName, []);
    }

    const connectedClients = roomClientMap.get(roomName)!;
    if (connectedClients.length > 50) {
        kick("Room has over 50 people already!");
        return;
    }

    socket.join(roomName);

    // Send the list of clients in this room to only the connecting client so it knows the people here
    socket.emit("client_list_recieve", connectedClients);

    const clientData: IClientData = {
        colorHue: Math.round(Math.random() * 360).toString(),
        socketID: socket.id,
        instrumentName: instrumentName as InstrumentName,
    };
    connectedClients.push(clientData);
    io.to(roomName).emit("client_connect", clientData);

    // These listeners listen for a client to send that event and then broadcasts it to all other clients in the current room
    // If any of the sent data is invalid it immediately kicks the client
    socket.on("change_instrument", (event) => {
        const instrumentEvent = event as IInstrumentChangeEvent;
        if (instrumentNameMap[instrumentEvent?.instrumentName]) {
            instrumentEvent.socketID = socket.id;
            clientData.instrumentName = instrumentEvent.instrumentName;
            socket.to(roomName).emit("change_instrument", instrumentEvent);
        } else {
            kick();
        }
    });

    socket.on("play_note", (event) => {
        const noteEvent = event as IPlayNoteEvent;
        if (typeof noteEvent?.note === "string" && typeof noteEvent?.volume === "number") {
            noteEvent.socketID = socket.id;
            socket.to(roomName).emit("play_note", noteEvent);
        } else {
            kick();
        }
    });

    socket.on("stop_note", (event) => {
        const noteEvent = event as IStopNoteEvent;
        if (typeof noteEvent?.note === "string" && typeof noteEvent?.sustain === "boolean") {
            noteEvent.socketID = socket.id;
            socket.to(roomName).emit("stop_note", noteEvent);
        } else {
            kick();
        }
    });

    socket.on("disconnect", () => {
        // Find the client and remove it
        const index = connectedClients.findIndex((client) => client.socketID == socket.id);
        if (index !== -1) {
            connectedClients.splice(index, 1);
        }

        if (connectedClients.length === 0) {
            roomClientMap.delete(roomName);
        } else {
            socket.to(roomName).emit("client_disconnect", socket.id);
        }
    });
});
