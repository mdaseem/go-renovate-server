import express, { Express } from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes";
import prductRoutes from "./routes/prductRoutes";
import addUser from "./routes/addUser";
import roomRoutes from "./routes/roomRoutes";
import authorize from "./routes/authorizeUser";
import { requireAuth } from "./middleware/authMiddleware";
import { Server } from "socket.io";
import Message from "./models/messageModel";

interface MessageData {
  roomId: string;
  message: string;
  senderId: string;
  receiverId: string;
  sender: string;
}

dotenv.config();
mongoose
  .connect(
    "mongodb+srv://go-renovate-userDB:3AsOY7MQsPeCNaYV@cluster0.cjpxkja.mongodb.net/test",
  )
  .then(() => console.log(" Connected to MongoDB Atlas"))
  .catch((err) => console.error(" Connection error:", err));

mongoose.connection.on("open", () => {
  console.log(`DB connected !`);
});

const app: Express = express();
const port = process.env.SERVER_PORT || 3000;

app.use(
  cors({
    origin: ["http://localhost:3000", "https://go-renovate.vercel.app"],
    credentials: true,
  }),
);

// app.use(cors());
app.use(express.json());
app.use("/user", requireAuth, userRoutes);
app.use("/signup", addUser);
app.use("/auth", authorize);
app.use("/products", requireAuth, prductRoutes);
app.use("/rooms", roomRoutes);

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

  // join room
  socket.on("join_room", (roomId: string) => {
    socket.join(roomId);

    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  // send + save message
  socket.on("send_message", async (data: MessageData) => {
    try {
      // save message in MongoDB
      const savedMessage = await Message.create({
        roomId: data.roomId,
        senderId: data.senderId,
        sender: data.sender,
        receiverId: data.receiverId,
        message: data.message,
      });

      // emit to everyone in room INCLUDING sender
      io.to(data.roomId).emit("receive_message", savedMessage);

      console.log("Message saved:", savedMessage);
    } catch (error) {
      console.log("Socket message error:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(port, () => {
  console.log(`Server running @ port ${port} !`);
});
