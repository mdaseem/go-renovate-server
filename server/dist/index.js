"use strict";
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
const authorizeUser_1 = __importDefault(require("./routes/authorizeUser"));
const authMiddleware_1 = require("./middleware/authMiddleware");
const socket_io_1 = require("socket.io");
dotenv_1.default.config();
mongoose_1.default.connect("mongodb+srv://go-renovate-userDB:3AsOY7MQsPeCNaYV@cluster0.cjpxkja.mongodb.net/test")
    .then(() => console.log(" Connected to MongoDB Atlas"))
    .catch(err => console.error(" Connection error:", err));
mongoose_1.default.connection.on("open", () => {
    console.log(`Online Training DB connected !`);
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
    socket.on("join_room", (roomId) => {
        socket.join(roomId);
    });
    socket.on("send_message", (data) => {
        socket.to(data.roomId).emit("receive_message", data);
    });
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});
server.listen(port, () => {
    console.log(`Server running @ port ${port} !`);
});
