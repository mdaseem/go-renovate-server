"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const prductRoutes_1 = __importDefault(require("./routes/prductRoutes"));
const addUser_1 = __importDefault(require("./routes/addUser"));
const authorizeUser_1 = __importDefault(require("./routes/authorizeUser"));
dotenv_1.default.config();
mongoose_1.default.connect("mongodb+srv://go-renovate-userDB:3AsOY7MQsPeCNaYV@cluster0.cjpxkja.mongodb.net/")
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ Connection error:", err));
mongoose_1.default.connection.on("open", () => {
    console.log(`Online Training DB connected !`);
});
const app = (0, express_1.default)();
const port = process.env.SERVER_PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/user", userRoutes_1.default);
app.use("/signup", addUser_1.default);
app.use("/auth", authorizeUser_1.default);
app.use("/products", prductRoutes_1.default);
app.listen(port, () => {
    console.log(`Server running @ port ${port} !`);
});
