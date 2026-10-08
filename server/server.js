const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

// ======================================================
// PASTE YOUR MONGODB URI HERE
// ======================================================

const MONGO_URI = process.env.MONGO_URI;

// ======================================================
// APP SETUP
// ======================================================

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ======================================================
// MONGOOSE SCHEMAS
// ======================================================

const messageSchema = new mongoose.Schema(
  {
    participantId: String,

    text: String,

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const roomSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    required: true,
  },

  participants: [
    {
      participantId: String,

      name: {
        type: String,
        default: "Anonymous",
      },

      socketId: {
        type: String,
        default: "",
      },
    },
  ],

  hearts: {
    type: Number,
    default: 10,
  },

  messages: [messageSchema],
});

const Room = mongoose.model("Room", roomSchema);

// ======================================================
// BASIC ROUTE
// ======================================================

app.get("/", (req, res) => {
  res.send("Love Chat Server is Running ❤️");
});

// ======================================================
// CREATE UNIQUE 6 DIGIT ROOM CODE
// ======================================================

async function createRoomCode() {
  while (true) {
    const code = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const existingRoom = await Room.findOne({
      code,
    });

    if (!existingRoom) {
      return code;
    }
  }
}

// ======================================================
// SOCKET.IO
// ======================================================

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // ====================================================
  // CREATE ROOM
  // ====================================================

  socket.on("create-room", async (data, callback) => {
    try {
      const participantId = data.participantId;

      const code = await createRoomCode();

      const room = new Room({
        code,

        participants: [
          {
            participantId,

            name: data.name || "Anonymous",

            socketId: socket.id,
          },
        ],

        hearts: 10,

        messages: [],
      });

      await room.save();

      socket.join(code);

      callback({
        success: true,

        code,

        hearts: room.hearts,

        messages: [],

        participants: room.participants.map((p) => ({
          participantId: p.participantId,

          name: p.name,
        })),
      });

      console.log(`Room created: ${code}`);
    } catch (error) {
      console.log("Create room error:", error);

      callback({
        success: false,

        message: "Could not create room.",
      });
    }
  });

  // ====================================================
  // JOIN ROOM
  // ====================================================

  socket.on("join-room", async (data, callback) => {
    try {
      const {
        code,
        participantId,
        name,
      } = data;

      const cleanCode = String(code).trim();

      const room = await Room.findOne({
        code: cleanCode,
      });

      if (!room) {
        return callback({
          success: false,

          message: "Room not found.",
        });
      }

      // Check existing participant

      const existingParticipant =
        room.participants.find(
          (p) =>
            p.participantId === participantId
        );

      if (existingParticipant) {
        existingParticipant.socketId =
          socket.id;

        existingParticipant.name =
          name || existingParticipant.name;

        await room.save();
      } else {
        // New participant

        if (room.participants.length >= 2) {
          return callback({
            success: false,

            message:
              "This room already has two people.",
          });
        }

        room.participants.push({
          participantId,

          name: name || "Anonymous",

          socketId: socket.id,
        });

        await room.save();
      }

      socket.join(cleanCode);

      callback({
        success: true,

        code: room.code,

        hearts: room.hearts,

        messages: room.messages.map(
          (message) => ({
            id: message._id,

            participantId:
              message.participantId,

            text: message.text,

            createdAt:
              message.createdAt,
          })
        ),

        participants:
          room.participants.map((p) => ({
            participantId:
              p.participantId,

            name: p.name,
          })),
      });

      // Update both users

      io.to(cleanCode).emit(
        "room-users-update",
        {
          participants:
            room.participants.map((p) => ({
              participantId:
                p.participantId,

              name: p.name,
            })),
        }
      );

      console.log(
        `${participantId} joined ${cleanCode}`
      );
    } catch (error) {
      console.log("Join room error:", error);

      callback({
        success: false,

        message: "Could not join room.",
      });
    }
  });

  // ====================================================
  // CHANGE NAME
  // ====================================================

  socket.on("change-name", async (data) => {
    try {
      const {
        code,
        participantId,
        name,
      } = data;

      const room = await Room.findOne({
        code,
      });

      if (!room) return;

      const participant =
        room.participants.find(
          (p) =>
            p.participantId === participantId
        );

      if (!participant) return;

      participant.name =
        String(name || "").trim() ||
        "Anonymous";

      await room.save();

      io.to(code).emit(
        "room-users-update",
        {
          participants:
            room.participants.map((p) => ({
              participantId:
                p.participantId,

              name: p.name,
            })),
        }
      );
    } catch (error) {
      console.log(
        "Name update error:",
        error.message
      );
    }
  });

  // ====================================================
  // SEND MESSAGE
  // ====================================================

  socket.on("send-message", async (data) => {
    try {
      const {
        code,
        participantId,
        text,
      } = data;

      const cleanText =
        String(text || "").trim();

      if (!cleanText) return;

      const room = await Room.findOne({
        code,
      });

      if (!room) return;

      const participant =
        room.participants.find(
          (p) =>
            p.participantId === participantId
        );

      if (!participant) return;

      const newMessage = {
        participantId,

        text: cleanText,

        createdAt: new Date(),
      };

      room.messages.push(newMessage);

      await room.save();

      const savedMessage =
        room.messages[
          room.messages.length - 1
        ];

      // Send message to both users

      io.to(code).emit("new-message", {
        id: savedMessage._id,

        participantId:
          savedMessage.participantId,

        text: savedMessage.text,

        createdAt:
          savedMessage.createdAt,
      });

      console.log(
        `${participantId}: ${cleanText}`
      );
    } catch (error) {
      console.log(
        "Message error:",
        error.message
      );
    }
  });

  // ====================================================
  // DISCONNECT
  // ====================================================

  socket.on("disconnect", async () => {
    console.log(
      "User disconnected:",
      socket.id
    );

    try {
      const room =
        await Room.findOne({
          "participants.socketId":
            socket.id,
        });

      if (!room) return;

      const participant =
        room.participants.find(
          (p) =>
            p.socketId === socket.id
        );

      if (participant) {
        participant.socketId = "";
      }

      await room.save();

      io.to(room.code).emit(
        "room-users-update",
        {
          participants:
            room.participants.map((p) => ({
              participantId:
                p.participantId,

              name: p.name,
            })),
        }
      );
    } catch (error) {
      console.log(
        "Disconnect error:",
        error.message
      );
    }
  });
});

// ======================================================
// MONGODB + SERVER
// ======================================================

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");

    const PORT =
      process.env.PORT || 5000;

    server.listen(PORT, () => {
      console.log(
        `Server running on port ${PORT}`
      );
    });
  })
  .catch((error) => {
    console.log(
      "MongoDB connection failed:",
      error.message
    );
  });