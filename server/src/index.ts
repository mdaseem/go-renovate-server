import express, { Express, NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes";
import prductRoutes from "./routes/prductRoutes";
import vendorDetailRoutes from "./routes/vendorDetailRoutes";
import vendorApplicationRoutes from "./routes/vendorApplicationRoutes";
import vendorAccountRoutes from "./routes/vendorAccountRoutes";
import vendorOrderRoutes from "./routes/vendorOrderRoutes";
import vendorProductRoutes from "./routes/vendorProductRoutes";
import adminProductRoutes from "./routes/adminProductRoutes";
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
import designRoutes from "./routes/designRoutes";
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
const { DB_USER, DB_PASS, DB_HOST, DB_NAME, MONGODB_URI } = process.env;
mongoose
  // MONGODB_URI is optional (used for local testing against a throwaway database); the normal
  // setup keeps using the four DB_* variables.
  .connect(MONGODB_URI || `mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`)
  .then(() => console.log(" Connected to MongoDB Atlas"))
  .catch((err) => console.error(" Connection error:", err));

mongoose.connection.on("open", () => {
  console.log(`DB connected !`);
});

const app: Express = express();
const port = process.env.SERVER_PORT || 3000;

// How many proxies sit between the internet and this server (Render has one). Express then takes
// the client address from the entry that proxy appended (req.ip), not from the start of
// X-Forwarded-For, which the client can fake. Override with TRUST_PROXY_HOPS; 0 = no proxy (local).
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? "1");
app.set("trust proxy", Number.isInteger(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 1);
app.disable("x-powered-by");
// Standard security headers (nosniff, frame protection, HSTS, referrer policy, ...). This API only
// returns JSON, so cross-origin reads stay governed by the CORS list below.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

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
// Login responses carry a token: never let a browser or proxy cache them.
app.use("/auth", (req: Request, res: Response, next: NextFunction) => {
  res.set("Cache-Control", "no-store");
  next();
}, authorize);
app.use("/products", requireAuth, prductRoutes);
app.use("/vendors", vendorDetailRoutes);
app.use("/vendor-applications", vendorApplicationRoutes);
// Vendor-only (router-level requireAuth + requireRole("vendor")); mounted before the bare /vendor router.
app.use("/vendor/orders", vendorOrderRoutes);
app.use("/vendor/products", vendorProductRoutes);
// Owner-only review of vendor-created products (router-level requireAuth + requireRole("admin")).
app.use("/admin/products", adminProductRoutes);
app.use("/vendor", vendorAccountRoutes);
app.use("/rooms", roomRoutes);
app.use("/ai", requireAuth, aiChatRoutes);
app.use("/orders", requireAuth, orderRoutes);
app.use("/wishlist", requireAuth, wishlistRoutes);
app.use("/webhooks/shiprocket", shiprocketWebhookRoutes);
// /essentials/categories, /essentials/orders and /essentials/designs MUST all be mounted
// before /essentials — otherwise those requests would be swallowed by
// essentialRoutes' GET /:id (treating "categories"/"orders" as an
// essential id) before ever reaching these routers, since Express tries
// mounts in registration order.
app.use("/essentials/categories", essentialCategoryRoutes);
app.use("/essentials/orders", requireAuth, essentialOrderRoutes);
// Shared Customize designs: public on purpose (no login) - validated and rate limited in the router.
app.use("/essentials/designs", designRoutes);
app.use("/essentials", essentialRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
});


app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Malformed JSON body" });
  }
  // The client sent too much, or hung up / was cut off mid-upload: not a server fault, so no 500
  // and no error log (there is nobody left to answer in the second case).
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body too large" });
  }
  if (err?.type === "request.aborted") {
    return;
  }
  console.error("Unhandled request error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Node only enforces requestTimeout when it sweeps connections (every 30s by default, so a stall could
// last up to a minute longer); sweep every 5s so the limit below is close to exact.
const server = http.createServer({ connectionsCheckingInterval: 5000 }, app);

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

// Render's proxy keeps connections open longer than Node's 5s default, which causes sporadic 502s;
// keep-alive must outlast the proxy's idle time, and headersTimeout must exceed keep-alive.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
// A client has this long to finish sending a request (slow-sender attacks; Node's default is 300s).
// It must be >= headersTimeout or Node enforces the larger one instead (checked by a stall test).
// Long WebSocket connections and slow responses (AI replies) are not affected.
server.requestTimeout = 70_000;

server.listen(port, () => {
  console.log(`Server running @ port ${port} !`);
});

// Render sends SIGTERM on every deploy/restart: stop taking new connections, let in-flight requests
// finish, close the database, then exit (forced after 10s so a stuck connection cannot hang a deploy).
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  const force = setTimeout(() => {
    console.error("Forced shutdown after 10s");
    process.exit(1);
  }, 10_000);
  force.unref();
  io.close(() => {
    mongoose.connection
      .close()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
  server.closeIdleConnections();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
