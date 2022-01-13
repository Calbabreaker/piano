"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const PORT = (_a = process.env.PORT) !== null && _a !== void 0 ? _a : 3000;
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
            colorHue: genHue().toString(),
            socketID: socket.id,
            instrumentName,
        };
        connectedClients.push(clientData);
        io.to(roomName).emit("client_connect", clientData);
        socket.on("instrument_change", (event) => {
            try {
                const instrumentEvent = event;
                instrumentEvent.socketID = socket.id;
                clientData.instrumentName = instrumentEvent.instrumentName;
                io.to(roomName).emit("instrument_change", instrumentEvent);
            }
            catch (err) {
                socket.disconnect();
            }
        });
        socket.on("play_note", (event) => {
            try {
                const noteEvent = event;
                noteEvent.socketID = socket.id;
                io.to(roomName).emit("play_note", noteEvent);
            }
            catch (err) {
                socket.disconnect();
            }
        });
        socket.on("stop_note", (event) => {
            try {
                const noteEvent = event;
                noteEvent.socketID = socket.id;
                io.to(roomName).emit("stop_note", noteEvent);
            }
            catch (err) {
                socket.disconnect();
            }
        });
        socket.on("disconnect", () => {
            let index = undefined;
            for (let i = 0; i < connectedClients.length; i++) {
                if (connectedClients[i].socketID === socket.id) {
                    index = i;
                    break;
                }
            }
            if (index !== undefined)
                connectedClients.splice(index, 1);
            if (connectedClients.length === 0)
                roomClientMap.delete(roomName);
            io.to(roomName).emit("client_disconnect", socket.id);
        });
    }
    catch (err) {
        socket.disconnect();
    }
});
function genHue() {
    let hue = Math.round(Math.random() * 360);
    // close to pressed note colour
    if (closeTo(hue, 220))
        hue = genHue();
    return hue;
}
function closeTo(a, b) {
    return Math.abs(a - b) <= 20;
}
