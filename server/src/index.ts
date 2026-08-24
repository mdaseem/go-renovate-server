import express, { Express, NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes";
import prductRoutes from "./routes/prductRoutes";
import vendorDetailRoutes from "./routes/vendorDetailRoutes";
import addUser from "./routes/addUser";
import roomRoutes from "./routes/roomRoutes";
import authorize from "./routes/authorizeUser";
import aiChatRoutes from "./routes/aiChatRoutes";
import orderRoutes from "./routes/orderRoutes";
import wishlistRoutes from "./routes/wishlistRoutes";
import shiprocketWebhookRoutes from "./routes/shiprocketWebhookRoutes";
import essentialCategoryRoutes from "./routes/essentialCategoryRoutes";
import essentialOrderRoutes from "./routes/essentialOrderRoutes";
import essentialRoutes from "./routes/essentialRoutes";
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
const { DB_USER, DB_PASS, DB_HOST, DB_NAME } = process.env;
mongoose
  .connect(`mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`)
  .then(() => console.log(" Connected to MongoDB Atlas"))
  .catch((err) => console.error(" Connection error:", err));

mongoose.connection.on("open", () => {
  console.log(`DB connected !`);
});

const app: Express = express();
const port = process.env.SERVER_PORT || 3000;

app.use(
  cors({
    origin: ["http://localhost:3000", "https://gorenovate.in"],
    credentials: true,
  }),
);

// app.use(cors());
app.use(express.json());

// Public, unauthenticated — pinged by .github/workflows/keep-alive.yml on a
// schedule to stop Render's free tier from spinning the service down after
// ~15 minutes idle. Deliberately lightweight (no DB round trip required to
// answer) so the ping itself never becomes the slow part.
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    dbConnected: mongoose.connection.readyState === 1,
  });
});

app.use("/user", requireAuth, userRoutes);
app.use("/signup", addUser);
app.use("/auth", authorize);
app.use("/products", requireAuth, prductRoutes);
app.use("/vendors", vendorDetailRoutes);
app.use("/rooms", roomRoutes);
app.use("/ai", requireAuth, aiChatRoutes);
app.use("/orders", requireAuth, orderRoutes);
app.use("/wishlist", requireAuth, wishlistRoutes);
app.use("/webhooks/shiprocket", shiprocketWebhookRoutes);
// /essentials/categories and /essentials/orders MUST both be mounted
// before /essentials — otherwise those requests would be swallowed by
// essentialRoutes' GET /:id (treating "categories"/"orders" as an
// essential id) before ever reaching these routers, since Express tries
// mounts in registration order.
app.use("/essentials/categories", essentialCategoryRoutes);
app.use("/essentials/orders", requireAuth, essentialOrderRoutes);
app.use("/essentials", essentialRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
});


app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Malformed JSON body" });
  }
  console.error("Unhandled request error:", err);
  res.status(500).json({ message: "Internal server error" });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://gorenovate.in"],
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
