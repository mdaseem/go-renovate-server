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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const mongoose_1 = __importDefault(require("mongoose"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const prductRoutes_1 = __importDefault(require("./routes/prductRoutes"));
const vendorDetailRoutes_1 = __importDefault(require("./routes/vendorDetailRoutes"));
const vendorApplicationRoutes_1 = __importDefault(require("./routes/vendorApplicationRoutes"));
const vendorAccountRoutes_1 = __importDefault(require("./routes/vendorAccountRoutes"));
const addUser_1 = __importDefault(require("./routes/addUser"));
const roomRoutes_1 = __importDefault(require("./routes/roomRoutes"));
const authorizeUser_1 = __importDefault(require("./routes/authorizeUser"));
const aiChatRoutes_1 = __importDefault(require("./routes/aiChatRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const wishlistRoutes_1 = __importDefault(require("./routes/wishlistRoutes"));
const shiprocketWebhookRoutes_1 = __importDefault(require("./routes/shiprocketWebhookRoutes"));
const essentialCategoryRoutes_1 = __importDefault(require("./routes/essentialCategoryRoutes"));
const essentialOrderRoutes_1 = __importDefault(require("./routes/essentialOrderRoutes"));
const essentialRoutes_1 = __importDefault(require("./routes/essentialRoutes"));
const designRoutes_1 = __importDefault(require("./routes/designRoutes"));
const authMiddleware_1 = require("./middleware/authMiddleware");
const socket_io_1 = require("socket.io");
const messageModel_1 = __importDefault(require("./models/messageModel"));
dotenv_1.default.config();
const { DB_USER, DB_PASS, DB_HOST, DB_NAME, MONGODB_URI } = process.env;
mongoose_1.default
    // MONGODB_URI is optional (used for local testing against a throwaway database); the normal
    // setup keeps using the four DB_* variables.
    .connect(MONGODB_URI || `mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`)
    .then(() => console.log(" Connected to MongoDB Atlas"))
    .catch((err) => console.error(" Connection error:", err));
mongoose_1.default.connection.on("open", () => {
    console.log(`DB connected !`);
});
const app = (0, express_1.default)();
const port = process.env.SERVER_PORT || 3000;
// How many proxies sit between the internet and this server (Render has one). Express then takes
// the client address from the entry that proxy appended (req.ip), not from the start of
// X-Forwarded-For, which the client can fake. Override with TRUST_PROXY_HOPS; 0 = no proxy (local).
const trustProxyHops = Number((_a = process.env.TRUST_PROXY_HOPS) !== null && _a !== void 0 ? _a : "1");
app.set("trust proxy", Number.isInteger(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 1);
app.disable("x-powered-by");
// Standard security headers (nosniff, frame protection, HSTS, referrer policy, ...). This API only
// returns JSON, so cross-origin reads stay governed by the CORS list below.
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use((0, cors_1.default)({
    origin: ["http://localhost:3000", "https://gorenovate.in"],
    credentials: true,
}));
// app.use(cors());
app.use(express_1.default.json());
// Public, unauthenticated — pinged by .github/workflows/keep-alive.yml on a
// schedule to stop Render's free tier from spinning the service down after
// ~15 minutes idle. Deliberately lightweight (no DB round trip required to
// answer) so the ping itself never becomes the slow part.
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        dbConnected: mongoose_1.default.connection.readyState === 1,
    });
});
app.use("/user", authMiddleware_1.requireAuth, userRoutes_1.default);
app.use("/signup", addUser_1.default);
// Login responses carry a token: never let a browser or proxy cache them.
app.use("/auth", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
}, authorizeUser_1.default);
app.use("/products", authMiddleware_1.requireAuth, prductRoutes_1.default);
app.use("/vendors", vendorDetailRoutes_1.default);
app.use("/vendor-applications", vendorApplicationRoutes_1.default);
app.use("/vendor", vendorAccountRoutes_1.default);
app.use("/rooms", roomRoutes_1.default);
app.use("/ai", authMiddleware_1.requireAuth, aiChatRoutes_1.default);
app.use("/orders", authMiddleware_1.requireAuth, orderRoutes_1.default);
app.use("/wishlist", authMiddleware_1.requireAuth, wishlistRoutes_1.default);
app.use("/webhooks/shiprocket", shiprocketWebhookRoutes_1.default);
// /essentials/categories, /essentials/orders and /essentials/designs MUST all be mounted
// before /essentials — otherwise those requests would be swallowed by
// essentialRoutes' GET /:id (treating "categories"/"orders" as an
// essential id) before ever reaching these routers, since Express tries
// mounts in registration order.
app.use("/essentials/categories", essentialCategoryRoutes_1.default);
app.use("/essentials/orders", authMiddleware_1.requireAuth, essentialOrderRoutes_1.default);
// Shared Customize designs: public on purpose (no login) - validated and rate limited in the router.
app.use("/essentials/designs", designRoutes_1.default);
app.use("/essentials", essentialRoutes_1.default);
app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
});
app.use((err, req, res, next) => {
    if ((err === null || err === void 0 ? void 0 : err.type) === "entity.parse.failed") {
        return res.status(400).json({ message: "Malformed JSON body" });
    }
    // The client sent too much, or hung up / was cut off mid-upload: not a server fault, so no 500
    // and no error log (there is nobody left to answer in the second case).
    if ((err === null || err === void 0 ? void 0 : err.type) === "entity.too.large") {
        return res.status(413).json({ message: "Request body too large" });
    }
    if ((err === null || err === void 0 ? void 0 : err.type) === "request.aborted") {
        return;
    }
    console.error("Unhandled request error:", err);
    res.status(500).json({ message: "Internal server error" });
});
// Node only enforces requestTimeout when it sweeps connections (every 30s by default, so a stall could
// last up to a minute longer); sweep every 5s so the limit below is close to exact.
const server = http_1.default.createServer({ connectionsCheckingInterval: 5000 }, app);
const io = new socket_io_1.Server(server, {
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
// Render's proxy keeps connections open longer than Node's 5s default, which causes sporadic 502s;
// keep-alive must outlast the proxy's idle time, and headersTimeout must exceed keep-alive.
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
// A client has this long to finish sending a request (slow-sender attacks; Node's default is 300s).
// It must be >= headersTimeout or Node enforces the larger one instead (checked by a stall test).
// Long WebSocket connections and slow responses (AI replies) are not affected.
server.requestTimeout = 70000;
server.listen(port, () => {
    console.log(`Server running @ port ${port} !`);
});
// Render sends SIGTERM on every deploy/restart: stop taking new connections, let in-flight requests
// finish, close the database, then exit (forced after 10s so a stuck connection cannot hang a deploy).
let shuttingDown = false;
function shutdown(signal) {
    if (shuttingDown)
        return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);
    const force = setTimeout(() => {
        console.error("Forced shutdown after 10s");
        process.exit(1);
    }, 10000);
    force.unref();
    io.close(() => {
        mongoose_1.default.connection
            .close()
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    });
    server.closeIdleConnections();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
