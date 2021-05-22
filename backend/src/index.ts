import { Server } from "socket.io";
import { createServer } from "http";
import { IPlayNoteEvent, IStopNoteEvent, IClientData } from "./socket_events";

const PORT = 3000;
const server = createServer().listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}.`);
});

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

const connectedClients: IClientData[] = [];

io.on("connection", (socket) => {
    try {
        const roomName = socket.handshake.query.roomName;
        if (roomName == null) throw new Error("Invalid roomName!");
        socket.join(roomName);

        socket.emit("client_list_recieve", connectedClients);

        const clientData: IClientData = {
            colorHue: genHue(),
            socketID: socket.id,
        };
        connectedClients.push(clientData);
        io.to(roomName).emit("client_connect", clientData);

        socket.on("play_note", (event) => {
            try {
                const noteEvent = event as IPlayNoteEvent;
                noteEvent.socketID = socket.id;
                io.to(roomName).emit("play_note", noteEvent);
            } catch (err) {
                socket.disconnect();
            }
        });

        socket.on("stop_note", (event) => {
            try {
                const noteEvent = event as IStopNoteEvent;
                noteEvent.socketID = socket.id;
                io.to(roomName).emit("stop_note", noteEvent);
            } catch (err) {
                socket.disconnect();
            }
        });

        socket.on("disconnect", () => {
            let index: number | undefined = undefined;
            for (let i = 0; i < connectedClients.length; i++) {
                if (connectedClients[i].socketID === socket.id) {
                    index = i;
                    break;
                }
            }

            if (index !== undefined) connectedClients.splice(index, 1);
        });
    } catch (err) {
        socket.disconnect();
    }
});

function genHue(): number {
    let hue = Math.round(Math.random() * 360);
    // close to pressed note colour
    if (closeTo(hue, 200)) hue = genHue();
    return hue;
}

function closeTo(a: number, b: number): boolean {
    return Math.abs(a - b) <= 20;
}
