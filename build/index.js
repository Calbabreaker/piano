"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const PORT = (_a = process.env.PORT) !== null && _a !== void 0 ? _a : 5000;
const server = (0, http_1.createServer)().listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}.`);
});
const io = new socket_io_1.Server(server, {
    cors: {
        origin: (_b = process.env.CORS_ALLOW) !== null && _b !== void 0 ? _b : "*",
        methods: ["GET", "POST"],
    },
});
const roomClientMap = new Map();
io.on("connection", (socket) => {
    try {
        const roomName = socket.handshake.query.roomName;
        if (typeof roomName !== "string")
            throw new Error("Invalid roomName!");
        socket.join(roomName);
        const instrumentName = socket.handshake.query.instrumentName;
        if (typeof instrumentName !== "string")
            throw new Error("Invalid instrument name!");
        if (!roomClientMap.has(roomName))
            roomClientMap.set(roomName, []);
        const connectedClients = roomClientMap.get(roomName);
        socket.emit("client_list_recieve", connectedClients);
        const clientData = {
            colorHue: Math.round(Math.random() * 360).toString(),
            socketID: socket.id,
            instrumentName,
        };
        connectedClients.push(clientData);
        io.to(roomName).emit("client_connect", clientData);
        socket.on("instrument_change", (event) => {
            try {
                const instrumentEvent = event;
                if (!instrumentEvent.instrumentName)
                    throw null;
                instrumentEvent.socketID = socket.id;
                clientData.instrumentName = instrumentEvent.instrumentName;
                socket.to(roomName).emit("instrument_change", instrumentEvent);
            }
            catch (err) {
                socket.disconnect();
            }
        });
        socket.on("play_note", (event) => {
            try {
                const noteEvent = event;
                if (!noteEvent.note || noteEvent.volume == null)
                    throw null;
                noteEvent.socketID = socket.id;
                socket.to(roomName).emit("play_note", noteEvent);
            }
            catch (err) {
                socket.disconnect();
            }
        });
        socket.on("stop_note", (event) => {
            try {
                const noteEvent = event;
                if (!noteEvent.note || noteEvent.sustain == null)
                    throw null;
                noteEvent.socketID = socket.id;
                socket.to(roomName).emit("stop_note", noteEvent);
            }
            catch (err) {
                socket.disconnect();
            }
        });
        socket.on("disconnect", () => {
            const index = connectedClients.findIndex((client) => client.socketID == socket.id);
            if (index !== -1)
                connectedClients.splice(index, 1);
            if (connectedClients.length === 0)
                roomClientMap.delete(roomName);
            socket.to(roomName).emit("client_disconnect", socket.id);
        });
    }
    catch (err) {
        socket.disconnect();
    }
});
