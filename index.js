// index.js - just wires everything together!
require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const db = require("./config/database");
const authMiddleware = require("./middleware/auth");
const messageHandler = require("./handlers/messageHandler");
const messageRoutes = require("./routes/messageRoutes");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/messages", messageRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.use(authMiddleware);
io.on("connection", (socket) => messageHandler(io, socket));

server.listen(process.env.PORT, () => {
  console.log(`🚀 Messaging service running on port ${process.env.PORT}`);
});
