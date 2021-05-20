import { Server } from "socket.io";
import { createServer } from "http";

const PORT = 3000;
const server = createServer().listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}.`);
});

const io = new Server(server, {
    cors: {
        origin: "http://localhost:1234",
        methods: ["GET", "POST"],
    },
});

io.on("connection", (socket) => {
    console.log("Connected with id: " + socket.id);
});
