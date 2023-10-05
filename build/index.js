"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const instrument_names_1 = require("./instrument_names");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const PORT = (_a = process.env.PORT) !== null && _a !== void 0 ? _a : 5000;
const server = (0, http_1.createServer)().listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on 0.0.0.0:${PORT}.`);
});
const io = new socket_io_1.Server(server, {
    cors: {
        origin: (_b = process.env.CORS_ALLOW) !== null && _b !== void 0 ? _b : "*",
        methods: ["GET", "POST"],
    },
});
// Used to check if an instrument name is invalid
const instrumentNameMap = {};
instrument_names_1.instrumentNames.forEach((name) => {
    instrumentNameMap[name] = true;
});
// A map of a room to client datas
const roomClientMap = new Map();
io.on("connection", (socket) => {
    var _a, _b;
    const roomName = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.roomName;
    const instrumentName = (_b = socket.handshake.query) === null || _b === void 0 ? void 0 : _b.instrumentName;
    function kick(message = "Something is wrong with the client") {
        socket.emit("error_message", message);
        socket.disconnect();
    }
    // If the queries are not valid then immediately disconnect the user since that should not be happening
    if (typeof roomName !== "string" ||
        roomName.length > 100 ||
        typeof instrumentName !== "string" ||
        !instrumentNameMap[instrumentName]) {
        kick();
        return;
    }
    if (!roomClientMap.has(roomName)) {
        roomClientMap.set(roomName, []);
    }
    const connectedClients = roomClientMap.get(roomName);
    if (connectedClients.length > 50) {
        kick("Room has over 50 people already!");
        return;
    }
    socket.join(roomName);
    // Send the list of clients in this room to only the connecting client so it knows the people here
    socket.emit("client_list_recieve", connectedClients);
    const clientData = {
        colorHue: Math.round(Math.random() * 360).toString(),
        socketID: socket.id,
        instrumentName: instrumentName,
    };
    connectedClients.push(clientData);
    io.to(roomName).emit("client_connect", clientData);
    // These listeners listen for a client to send that event and then broadcasts it to all other clients in the current room
    // If any of the sent data is invalid it immediately kicks the client
    socket.on("change_instrument", (event) => {
        const instrumentEvent = event;
        if (instrumentNameMap[instrumentEvent === null || instrumentEvent === void 0 ? void 0 : instrumentEvent.instrumentName]) {
            instrumentEvent.socketID = socket.id;
            clientData.instrumentName = instrumentEvent.instrumentName;
            socket.to(roomName).emit("change_instrument", instrumentEvent);
        }
        else {
            kick();
        }
    });
    socket.on("play_note", (event) => {
        const noteEvent = event;
        if (typeof (noteEvent === null || noteEvent === void 0 ? void 0 : noteEvent.note) === "string" && typeof (noteEvent === null || noteEvent === void 0 ? void 0 : noteEvent.volume) === "number") {
            noteEvent.socketID = socket.id;
            socket.to(roomName).emit("play_note", noteEvent);
        }
        else {
            kick();
        }
    });
    socket.on("stop_note", (event) => {
        const noteEvent = event;
        if (typeof (noteEvent === null || noteEvent === void 0 ? void 0 : noteEvent.note) === "string" && typeof (noteEvent === null || noteEvent === void 0 ? void 0 : noteEvent.sustain) === "boolean") {
            noteEvent.socketID = socket.id;
            socket.to(roomName).emit("stop_note", noteEvent);
        }
        else {
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
        }
        else {
            socket.to(roomName).emit("client_disconnect", socket.id);
        }
    });
});
