import express, { Express } from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes";
import prductRoutes from "./routes/prductRoutes"
import addUser from "./routes/addUser"
import authorize from "./routes/authorizeUser"
import { requireAuth } from "./middleware/authMiddleware";
import { Server } from "socket.io";


interface MessageData {
  roomId: string;
  message: string;
  sender: string;
}

dotenv.config();
mongoose.connect("mongodb+srv://go-renovate-userDB:3AsOY7MQsPeCNaYV@cluster0.cjpxkja.mongodb.net/test")
  .then(() => console.log(" Connected to MongoDB Atlas"))
  .catch(err => console.error(" Connection error:", err));

mongoose.connection.on("open", () => {
  console.log(`DB connected !`);
});

const app: Express = express();
const port = process.env.SERVER_PORT || 3000;

app.use(
  cors({
    origin: [ "http://localhost:3000", "https://go-renovate.vercel.app"],
    credentials: true,
  })
);

// app.use(cors());
app.use(express.json());
app.use("/user",requireAuth, userRoutes);
app.use("/signup", addUser)
app.use("/auth", authorize);
app.use("/products",requireAuth, prductRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://go-renovate.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});
// 👇 socket logic
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join_room", (roomId: string) => {
    socket.join(roomId);
  });

  socket.on("send_message", (data: MessageData) => {
    socket.to(data.roomId).emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(port, () => {
    console.log(`Server running @ port ${port} !`);
  });