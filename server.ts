import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createServer as createViteServer } from "vite";
import { User, Message, Room } from "./src/types.js";

const USERS_DB_PATH = path.join(process.cwd(), "users-db.json");
const JWT_SECRET = "chat-hub-secret-key-12345";

interface RegisteredUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  color: string;
  avatarUrl: string;
}

function loadUsers(): RegisteredUser[] {
  try {
    if (fs.existsSync(USERS_DB_PATH)) {
      const data = fs.readFileSync(USERS_DB_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error loading users database", e);
  }
  return [];
}

function saveUsers(usersList: RegisteredUser[]) {
  try {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(usersList, null, 2), "utf8");
  } catch (e) {
    console.error("Error saving users database", e);
  }
}

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

  // Server state - keeps track of online user sessions
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

    // Registration Handler
    socket.on("user-register", async (payload: { username: string; email: string; password?: string }, callback) => {
      const { username, email, password } = payload;
      if (!username || !email || !password) {
        return callback({ error: "All fields are required" });
      }

      const trimmedName = username.trim();
      const trimmedEmail = email.trim().toLowerCase();

      // Simple validation checks
      if (trimmedName.length < 2 || trimmedName.length > 24 || !/^[a-zA-Z0-9 _]+$/.test(trimmedName)) {
        return callback({ error: "Invalid username pattern" });
      }

      const usersList = loadUsers();
      const nameConflict = usersList.some(u => u.username.toLowerCase() === trimmedName.toLowerCase());
      const emailConflict = usersList.some(u => u.email.toLowerCase() === trimmedEmail);

      if (nameConflict) {
        return callback({ error: "Username is already taken" });
      }
      if (emailConflict) {
        return callback({ error: "Email is already registered" });
      }

      try {
        const passwordHash = await bcrypt.hash(password, 10);
        const randomColor = COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
        const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(trimmedName)}`;
        
        const newRegUser: RegisteredUser = {
          id: `u-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          username: trimmedName,
          email: trimmedEmail,
          passwordHash,
          color: randomColor,
          avatarUrl
        };

        usersList.push(newRegUser);
        saveUsers(usersList);

        callback({ success: true });
      } catch (err) {
        callback({ error: "Registration failed due to server error" });
      }
    });

    // Login Handler
    socket.on("user-login", async (payload: { identifier?: string; password?: string }, callback) => {
      const { identifier, password } = payload;
      if (!identifier || !password) {
        return callback({ error: "All fields are required" });
      }

      const trimmedIdentifier = identifier.trim().toLowerCase();
      const usersList = loadUsers();

      const matchedUser = usersList.find(
        u => u.username.toLowerCase() === trimmedIdentifier || u.email.toLowerCase() === trimmedIdentifier
      );

      if (!matchedUser) {
        return callback({ error: "Invalid username/email or password" });
      }

      try {
        const isMatch = await bcrypt.compare(password, matchedUser.passwordHash);
        if (!isMatch) {
          return callback({ error: "Invalid username/email or password" });
        }

        // Generate JWT Token
        const token = jwt.sign(
          { userId: matchedUser.id, username: matchedUser.username },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        callback({
          success: true,
          token,
          user: {
            id: matchedUser.id,
            username: matchedUser.username,
            email: matchedUser.email,
            online: true,
            avatarUrl: matchedUser.avatarUrl,
            color: matchedUser.color
          }
        });
      } catch (err) {
        callback({ error: "Login failed due to server error" });
      }
    });

    // Token-based Session Initialization Handler
    socket.on("user-init-auth", (payload: { token?: string }, callback) => {
      const { token } = payload;
      if (!token) {
        return callback({ error: "Authentication token is required" });
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
        const usersList = loadUsers();
        const dbUser = usersList.find(u => u.id === decoded.userId);

        if (!dbUser) {
          return callback({ error: "Authenticated user no longer exists" });
        }

        // Check if user is already marked online elsewhere and disconnect old socket if needed
        for (const [sid, u] of users.entries()) {
          if (u.id === dbUser.id) {
            io.sockets.sockets.get(sid)?.disconnect();
            users.delete(sid);
          }
        }

        const user: User = {
          id: socket.id, // Keep socket.id for real-time delivery routing compatibility
          username: dbUser.username,
          email: dbUser.email,
          online: true,
          avatarUrl: dbUser.avatarUrl,
          color: dbUser.color
        };

        // Add to online store
        users.set(socket.id, user);

        // Join standard rooms
        rooms.forEach((r) => {
          socket.join(r.id);
        });

        const relevantHistory = messageCache.filter((m) => m.roomId);

        callback({
          success: true,
          user,
          users: Array.from(users.values()),
          rooms,
          history: relevantHistory
        });

        // Broadcast join event
        socket.broadcast.emit("user-joined", user);
        console.log(`User authenticated: ${user.username} (${user.id})`);
      } catch (err) {
        callback({ error: "Session expired or invalid token" });
      }
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
