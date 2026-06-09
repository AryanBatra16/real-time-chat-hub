import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { createServer as createViteServer } from "vite";
import { User, Message, Room } from "./src/types.js";

// Beautiful Tailwind color pool for assigning to users
const COLOR_POOL = [
  "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  "text-sky-500 bg-sky-500/10 border-sky-500/20",
  "text-rose-500 bg-rose-500/10 border-rose-500/20",
  "text-amber-500 bg-amber-500/10 border-amber-500/20",
  "text-violet-500 bg-violet-500/10 border-violet-500/20",
  "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
  "text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20",
  "text-orange-500 bg-orange-500/10 border-orange-500/20",
  "text-teal-500 bg-teal-500/10 border-teal-500/20"
];

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Server state
  const users: Map<string, User> = new Map();
  const rooms: Room[] = [
    { id: "general", name: "general", description: "Default channel for greetings and casual chit-chat 👋" },
    { id: "tech-talk", name: "tech-talk", description: "Programming, layouts, tech-stacks, and code talk 💻" },
    { id: "random", name: "random", description: "Lounge for random memes, links, and everything else ⚡" },
    { id: "music-lounge", name: "music-lounge", description: "Share your daily tunes, beats, and atmospheric synths 🎵" }
  ];
  
  // In-memory message history (latest 50 messages per room/DM)
  const messageCache: Message[] = [];

  // API dynamic checks
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", sockets: io.engine.clientsCount });
  });

  // Socket.IO real-time event pipeline
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Create unique random user attributes but wait for registration
    socket.on("user-init", (username: string, callback) => {
      if (!username || typeof username !== "string" || username.trim() === "") {
        return callback({ error: "Username cannot be empty" });
      }

      const trimmedName = username.trim().substring(0, 20);
      const isNameTaken = Array.from(users.values()).some(
        (u) => u.username.toLowerCase() === trimmedName.toLowerCase()
      );

      if (isNameTaken) {
        return callback({ error: "Username is already taken" });
      }

      // Generate visual attributes
      const randomColor = COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
      // Initial letters avatar
      const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(trimmedName)}`;

      const user: User = {
        id: socket.id,
        username: trimmedName,
        online: true,
        avatarUrl,
        color: randomColor
      };

      // Add to server memory
      users.set(socket.id, user);

      // Join standard rooms automatically
      rooms.forEach((r) => {
        socket.join(r.id);
      });

      // Filter global message cache for rooms the user has joined to send as initial history
      const relevantHistory = messageCache.filter((m) => m.roomId);

      // Reply with success packet
      callback({
        success: true,
        user,
        users: Array.from(users.values()),
        rooms,
        history: relevantHistory
      });

      // Broadcast join event to all other clients
      socket.broadcast.emit("user-joined", user);
    });

    // Handle messages
    socket.on("send-message", (payload: { id: string; content: string; roomId?: string; receiverId?: string }) => {
      const sender = users.get(socket.id);
      if (!sender) return;

      const message: Message = {
        id: payload.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        senderId: sender.id,
        senderName: sender.username,
        senderColor: sender.color,
        content: payload.content,
        roomId: payload.roomId,
        receiverId: payload.receiverId,
        timestamp: new Date().toISOString(),
        status: "sent"
      };

      // If it exists, mark status as delivered if target is online
      if (payload.receiverId) {
        const receiver = users.get(payload.receiverId);
        if (receiver && receiver.online) {
          message.status = "delivered";
        }
      }

      // Add to server-side cache
      messageCache.push(message);
      if (messageCache.length > 500) {
        messageCache.shift(); // Evict oldest
      }

      // Dispatch to room or receivers
      if (payload.roomId) {
        // Broadcast to everyone in group including sender
        io.to(payload.roomId).emit("message-receive", message);
      } else if (payload.receiverId) {
        // Send to receiver
        io.to(payload.receiverId).emit("message-receive", message);
        // Send copy back to sender's other tabs/sockets (redundant here, but good for robustness)
        socket.emit("message-receive", message);
      }
    });

    // Typing activity transmission
    socket.on("typing-status", (payload: { targetId: string; isTyping: boolean }) => {
      const sender = users.get(socket.id);
      if (!sender) return;

      // Broadcast to other recipients
      socket.broadcast.emit("typing-status-update", {
        userId: sender.id,
        username: sender.username,
        targetId: payload.targetId,
        isTyping: payload.isTyping
      });
    });

    // Read receipt updates
    socket.on("mark-as-read", (payload: { senderId: string }) => {
      // Receiver (socket.id) has read senderId's messages. Let's broadcast back.
      // Update our cache status
      messageCache.forEach((m) => {
        if (m.senderId === payload.senderId && m.receiverId === socket.id && m.status !== "read") {
          m.status = "read";
        }
      });

      // Target sender gets updated status
      io.to(payload.senderId).emit("messages-read-ack", {
        readerId: socket.id,
        senderId: payload.senderId
      });
    });

    // Handle room creation
    socket.on("create-room", (payload: { name: string; description: string }, callback) => {
      const sender = users.get(socket.id);
      if (!sender) return callback({ error: "Not authorized" });

      const nameNormalized = payload.name.trim().toLowerCase().replace(/\s+/g, "-").substring(0, 30);
      
      const alreadyExists = rooms.some((r) => r.id === nameNormalized);
      if (alreadyExists) {
        return callback({ error: "Channel already exists" });
      }

      const newRoom: Room = {
        id: nameNormalized,
        name: nameNormalized,
        description: payload.description.substring(0, 100) || "Custom room created by a user."
      };

      rooms.push(newRoom);
      
      // Let everyone know about the brand new channel
      io.emit("room-created", newRoom);
      callback({ success: true, room: newRoom });
    });

    // Handle disconnects
    socket.on("disconnect", () => {
      const user = users.get(socket.id);
      if (user) {
        user.online = false;
        user.lastSeen = new Date().toISOString();
        users.delete(socket.id);

        console.log(`User left: ${user.username} (${socket.id})`);
        socket.broadcast.emit("user-left", {
          id: socket.id,
          username: user.username
        });
      }
    });
  });

  // Vite development vs production orchestration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to 0.0.0.0 and port 3000
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Real-Time Service listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("FATAL: Failed to launch application server", err);
});
