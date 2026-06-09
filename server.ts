import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createServer as createViteServer } from "vite";
import { User, Message, Room } from "./src/types.js";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://your-supabase-url.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "your-supabase-anon-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

    // Registration Handler - Supabase Auth & Profiles
    socket.on("user-register", async (payload: { username: string; email: string; password?: string }, callback) => {
      const { username, email, password } = payload;
      if (!username || !email || !password) {
        return callback({ error: "All fields are required" });
      }

      const trimmedName = username.trim();
      const trimmedEmail = email.trim().toLowerCase();

      // Simple validation checks
      if (trimmedName.length < 2 || trimmedName.length > 24 || !/^[a-zA-Z0-9 _]+$/.test(trimmedName)) {
        return callback({ error: "Username must be 2-24 characters (letters, numbers, spaces, underscores)." });
      }

      try {
        // 1. Sign up user in Supabase Auth
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: password
        });

        if (signUpError) {
          return callback({ error: signUpError.message });
        }

        const authUser = signUpData.user;
        if (!authUser) {
          return callback({ error: "Registration failed." });
        }

        const randomColor = COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
        const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(trimmedName)}`;

        // 2. Create profile row linked to Auth User
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: authUser.id,
            username: trimmedName,
            email: trimmedEmail,
            color: randomColor,
            avatar_url: avatarUrl
          });

        if (profileError) {
          return callback({ error: profileError.message });
        }

        callback({ success: true });
      } catch (err) {
        callback({ error: "Registration failed due to server error" });
      }
    });

    // Login Handler - Supabase Auth
    socket.on("user-login", async (payload: { identifier?: string; password?: string }, callback) => {
      const { identifier, password } = payload;
      if (!identifier || !password) {
        return callback({ error: "All fields are required" });
      }

      const trimmedIdentifier = identifier.trim();
      let emailToAuth = trimmedIdentifier;

      try {
        // If username is passed instead of email, lookup email in profiles table
        if (!trimmedIdentifier.includes("@")) {
          const { data: profile, error: profileErr } = await supabase
            .from("profiles")
            .select("email")
            .eq("username", trimmedIdentifier)
            .maybeSingle();

          if (profileErr || !profile) {
            return callback({ error: "Invalid username/email or password" });
          }
          emailToAuth = profile.email;
        }

        // Authenticate using Supabase Auth client credentials
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: emailToAuth,
          password: password
        });

        if (signInError) {
          return callback({ error: signInError.message });
        }

        const session = signInData.session;
        const authUser = signInData.user;

        if (!session || !authUser) {
          return callback({ error: "Authentication failed" });
        }

        // Retrieve profile details
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profileErr || !profile) {
          return callback({ error: "User profile not found" });
        }

        callback({
          success: true,
          token: session.access_token,
          user: {
            id: profile.id,
            username: profile.username,
            email: profile.email,
            online: true,
            avatarUrl: profile.avatar_url,
            color: profile.color
          }
        });
      } catch (err) {
        callback({ error: "Login failed due to server error" });
      }
    });

    // Session Initialization Handler - Supabase token validation and DB sync
    socket.on("user-init-auth", async (payload: { token?: string }, callback) => {
      const { token } = payload;
      if (!token) {
        return callback({ error: "Authentication token is required" });
      }

      try {
        const { data: { user: authUser }, error: verifyError } = await supabase.auth.getUser(token);

        if (verifyError || !authUser) {
          return callback({ error: "Session expired or invalid token" });
        }

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profileErr || !profile) {
          return callback({ error: "Profile not found" });
        }

        // Disconnect duplicate socket connections if already logged in elsewhere
        for (const [sid, u] of users.entries()) {
          if (u.id === profile.id) {
            io.sockets.sockets.get(sid)?.disconnect();
            users.delete(sid);
          }
        }

        const user: User = {
          id: socket.id,
          username: profile.username,
          email: profile.email,
          online: true,
          avatarUrl: profile.avatar_url,
          color: profile.color
        };

        // Add to active online users list
        users.set(socket.id, user);

        // Join rooms
        rooms.forEach((r) => {
          socket.join(r.id);
        });

        // Retrieve last 100 messages history from Supabase database
        const { data: historyData, error: historyErr } = await supabase
          .from("messages")
          .select("*")
          .order("timestamp", { ascending: true })
          .limit(100);

        const historyList = historyErr ? [] : (historyData || []).map(m => ({
          id: m.id,
          senderId: m.sender_id,
          senderName: m.sender_name,
          senderColor: m.sender_color,
          receiverId: m.receiver_id || undefined,
          roomId: m.room_id || undefined,
          content: m.content,
          timestamp: m.timestamp,
          status: m.status,
          readBy: m.read_by || []
        }));

        // Filter messages for room context
        const relevantHistory = historyList.filter(m => m.roomId);

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

    // Handle messages - Persist to Supabase
    socket.on("send-message", async (payload: { id: string; content: string; roomId?: string; receiverId?: string }) => {
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
        status: "sent",
        readBy: []
      };

      if (payload.receiverId) {
        const receiver = Array.from(users.values()).find(u => u.id === payload.receiverId);
        if (receiver && receiver.online) {
          message.status = "delivered";
        }
      }

      // Persist to Supabase
      try {
        console.log(`[DB] Attempting to persist message from ${message.senderName}: "${message.content}"`);
        const { error: dbErr } = await supabase
          .from("messages")
          .insert({
            id: message.id,
            sender_id: message.senderId,
            sender_name: message.senderName,
            sender_color: message.senderColor,
            receiver_id: message.receiverId || null,
            room_id: message.roomId || null,
            content: message.content,
            timestamp: message.timestamp,
            status: message.status,
            read_by: []
          });
        if (dbErr) {
          console.error("[DB Error] Failed to persist message in Supabase:", dbErr);
        } else {
          console.log("[DB] Message persisted successfully");
        }
      } catch (e) {
        console.error("Error persisting message to Supabase (Exception):", e);
      }

      // Dispatch to room or receivers
      if (payload.roomId) {
        io.to(payload.roomId).emit("message-receive", message);
      } else if (payload.receiverId) {
        const receiverSocketId = Array.from(users.entries()).find(([sid, u]) => u.id === payload.receiverId)?.[0];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("message-receive", message);
        }
        socket.emit("message-receive", message);
      }
    });

    // Typing activity transmission
    socket.on("typing-status", (payload: { targetId: string; isTyping: boolean }) => {
      const sender = users.get(socket.id);
      if (!sender) return;

      socket.broadcast.emit("typing-status-update", {
        userId: sender.id,
        username: sender.username,
        targetId: payload.targetId,
        isTyping: payload.isTyping
      });
    });

    // Read receipt updates - Persist status to Supabase
    socket.on("mark-as-read", async (payload: { senderId: string }) => {
      const reader = users.get(socket.id);
      if (!reader) return;

      try {
        await supabase
          .from("messages")
          .update({ status: "read" })
          .eq("sender_id", payload.senderId)
          .eq("receiver_id", reader.id)
          .neq("status", "read");
      } catch (e) {
        console.error("Error updating read status in Supabase", e);
      }

      const senderSocketId = Array.from(users.entries()).find(([sid, u]) => u.id === payload.senderId)?.[0];
      if (senderSocketId) {
        io.to(senderSocketId).emit("messages-read-ack", {
          readerId: reader.id,
          senderId: payload.senderId
        });
      }
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
          id: user.id,
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
