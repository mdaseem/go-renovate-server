"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const prductRoutes_1 = __importDefault(require("./routes/prductRoutes"));
const addUser_1 = __importDefault(require("./routes/addUser"));
const roomRoutes_1 = __importDefault(require("./routes/roomRoutes"));
const authorizeUser_1 = __importDefault(require("./routes/authorizeUser"));
const authMiddleware_1 = require("./middleware/authMiddleware");
const socket_io_1 = require("socket.io");
const messageModel_1 = __importDefault(require("./models/messageModel"));
dotenv_1.default.config();
mongoose_1.default
    .connect("mongodb+srv://go-renovate-userDB:3AsOY7MQsPeCNaYV@cluster0.cjpxkja.mongodb.net/test")
    .then(() => console.log(" Connected to MongoDB Atlas"))
    .catch((err) => console.error(" Connection error:", err));
mongoose_1.default.connection.on("open", () => {
    console.log(`DB connected !`);
});
const app = (0, express_1.default)();
const port = process.env.SERVER_PORT || 3000;
app.use((0, cors_1.default)({
    origin: ["http://localhost:3000", "https://go-renovate.vercel.app"],
    credentials: true,
}));
// app.use(cors());
app.use(express_1.default.json());
app.use("/user", authMiddleware_1.requireAuth, userRoutes_1.default);
app.use("/signup", addUser_1.default);
app.use("/auth", authorizeUser_1.default);
app.use("/products", authMiddleware_1.requireAuth, prductRoutes_1.default);
app.use("/rooms", roomRoutes_1.default);
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: ["http://localhost:3000", "https://go-renovate.vercel.app"],
        methods: ["GET", "POST"],
        credentials: true,
    },
});
// 👇 socket logic
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    // join room
    socket.on("join_room", (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
    });
    // send + save message
    socket.on("send_message", (data) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // save message in MongoDB
            const savedMessage = yield messageModel_1.default.create({
                roomId: data.roomId,
                senderId: data.senderId,
                sender: data.sender,
                receiverId: data.receiverId,
                message: data.message,
            });
            // emit to everyone in room INCLUDING sender
            io.to(data.roomId).emit("receive_message", savedMessage);
            console.log("Message saved:", savedMessage);
        }
        catch (error) {
            console.log("Socket message error:", error);
        }
    }));
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});
server.listen(port, () => {
    console.log(`Server running @ port ${port} !`);
});
