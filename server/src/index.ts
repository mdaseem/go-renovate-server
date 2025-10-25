import express, { Express, Request, Response } from "express";
import dotenv from "dotenv"; 
import cors from "cors";
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes";
import prductRoutes from "./routes/prductRoutes"
import addUser from "./routes/addUser"
import authorize from "./routes/authorizeUser"



dotenv.config();
mongoose.connect("mongodb+srv://go-renovate-userDB:3AsOY7MQsPeCNaYV@cluster0.cjpxkja.mongodb.net/")
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch(err => console.error("❌ Connection error:", err));

mongoose.connection.on("open", () => {
  console.log(`Online Training DB connected !`);
});

const app: Express = express();
const port = process.env.SERVER_PORT;

app.use(cors());
app.use(express.json());
app.use("/user", userRoutes);
app.use("/signup", addUser);
app.use("/auth", authorize);
app.use("/products", prductRoutes);


app.listen(port, () => {
    console.log(`Server running @ port ${port} !`);
  });