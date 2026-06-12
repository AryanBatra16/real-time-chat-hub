import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
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
  const PORT = Number(process.env.PORT) || 3000;
  
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

  // In‑memory mapping of roomId -> Set of member userIds (including the creator)
  const roomMembers: Map<string, Set<string>> = new Map();
  // Initialise each existing room with an empty member set (will be populated on join)
  rooms.forEach((r) => roomMembers.set(r.id, new Set()));
  
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
        // 0. Pre-validate username and email uniqueness in Profiles table
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", trimmedName)
          .maybeSingle();

        if (existingUser) {
          return callback({ error: "Username is already taken." });
        }

        const { data: existingEmail } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", trimmedEmail)
          .maybeSingle();

        if (existingEmail) {
          return callback({ error: "Email is already registered." });
        }

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
            .ilike("username", trimmedIdentifier)
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
          id: profile.id,
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

        // Retrieve last 150 relevant messages (rooms + DMs involving this user)
        const { data: historyData, error: historyErr } = await supabase
          .from("messages")
          .select("*")
          .or(`room_id.not.is.null,sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
          .order("timestamp", { ascending: true })
          .limit(150);

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
          readBy: m.read_by || [],
          replyToId: m.reply_to_id || undefined,
          replyToName: m.reply_to_name || undefined,
          replyToContent: m.reply_to_content || undefined,
          isStarred: m.is_starred || false,
          deliveredAt: m.delivered_at || undefined,
          readAt: m.read_at || undefined
        }));

        callback({
          success: true,
          user,
          users: Array.from(users.values()),
          rooms,
          history: historyList
        });

        // Broadcast join event
        socket.broadcast.emit("user-joined", user);
        console.log(`User authenticated: ${user.username} (${user.id})`);
      } catch (err) {
        callback({ error: "Session expired or invalid token" });
      }
    });

    // Handle messages - Persist to Supabase
    socket.on("send-message", async (payload: { 
      id: string; 
      content: string; 
      roomId?: string; 
      receiverId?: string;
      replyToId?: string;
      replyToName?: string;
      replyToContent?: string;
    }) => {
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
        readBy: [],
        replyToId: payload.replyToId,
        replyToName: payload.replyToName,
        replyToContent: payload.replyToContent,
        isStarred: false
      };

      if (payload.receiverId) {
        const receiver = Array.from(users.values()).find(u => u.id === payload.receiverId);
        if (receiver && receiver.online) {
          message.status = "delivered";
          message.deliveredAt = new Date().toISOString();
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
            read_by: [],
            reply_to_id: message.replyToId || null,
            reply_to_name: message.replyToName || null,
            reply_to_content: message.replyToContent || null,
            is_starred: false,
            delivered_at: message.deliveredAt || null,
            read_at: null
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

      const readAtTime = new Date().toISOString();

      try {
        await supabase
          .from("messages")
          .update({ 
            status: "read",
            read_at: readAtTime
          })
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
          senderId: payload.senderId,
          readAt: readAtTime
        });
      }
    });

    // Edit Message Handler
    socket.on("edit-message", async (payload: { id: string; content: string }) => {
      const sender = users.get(socket.id);
      if (!sender) return;

      try {
        const { error } = await supabase
          .from("messages")
          .update({ content: payload.content })
          .eq("id", payload.id)
          .eq("sender_id", sender.id);

        if (!error) {
          io.emit("message-edited", {
            id: payload.id,
            content: payload.content
          });
        } else {
          console.error("Supabase Error editing message:", error);
        }
      } catch (e) {
        console.error("Error editing message", e);
      }
    });

    // Delete Message Handler
    socket.on("delete-message", async (payload: { id: string }) => {
      const sender = users.get(socket.id);
      if (!sender) return;

      try {
        const { error } = await supabase
          .from("messages")
          .delete()
          .eq("id", payload.id)
          .eq("sender_id", sender.id);

        if (!error) {
          io.emit("message-deleted", {
            id: payload.id
          });
        } else {
          console.error("Supabase Error deleting message:", error);
        }
      } catch (e) {
        console.error("Error deleting message", e);
      }
    });

    // Star/Pin Message Handler
    socket.on("star-message", async (payload: { id: string; isStarred: boolean }) => {
      const user = users.get(socket.id);
      if (!user) return;

      try {
        const { error } = await supabase
          .from("messages")
          .update({ is_starred: payload.isStarred })
          .eq("id", payload.id);

        if (!error) {
          io.emit("message-starred", {
            id: payload.id,
            isStarred: payload.isStarred
          });
        } else {
          console.error("Supabase Error starring message:", error);
        }
      } catch (e) {
        console.error("Error starring message", e);
      }
    });

    // Handle room creation
    socket.on("create-room", (payload: { name: string; description: string }, callback) => {
      const sender = users.get(socket.id);
      if (!sender) return callback({ error: "Not authorized" });

      const nameNormalized = payload.name.trim().toLowerCase().replace(/^#+/, "").replace(/\s+/g, "-").substring(0, 30);
      
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
      // Initialise member set for the new room and add creator automatically
      const membersSet = new Set<string>();
      membersSet.add(sender.id);
      roomMembers.set(newRoom.id, membersSet);
      
      // Auto‑join all currently active sockets to the new room channel (including creator)
      io.sockets.sockets.forEach((s) => {
        s.join(nameNormalized);
      });
      // Add creator's socket to members set (already added above)
      
      io.emit("room-created", newRoom);
      callback({ success: true, room: newRoom });
    });

    // Fetch ALL registered users from database (online + offline)
    socket.on("get-all-users", async (_, callback) => {
      const requester = users.get(socket.id);
      if (!requester) return callback({ error: "Not authorized" });

      try {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, username, email, avatar_url, color")
          .order("username", { ascending: true });

        if (error || !profiles) {
          return callback({ error: "Failed to fetch users" });
        }

        const onlineIds = new Set(Array.from(users.values()).map(u => u.id));

        const allUsers = profiles.map(p => ({
          id: p.id,
          username: p.username,
          email: p.email,
          avatarUrl: p.avatar_url,
          color: p.color,
          online: onlineIds.has(p.id)
        }));

        callback({ success: true, users: allUsers });
      } catch (e) {
        callback({ error: "Server error fetching users" });
      }
    });

    // Add users to a room (invite)

    socket.on("add-to-room", async (payload: { roomId: string; userId: string }, callback) => {
      const { roomId, userId } = payload;
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return callback({ error: "Room not found" });
      const members = roomMembers.get(roomId);
      if (!members) return callback({ error: "Room members not initialized" });
      members.add(userId);
      // Notify all members of updated list
      io.to(roomId).emit("room-members-updated", { roomId, members: Array.from(members) });
      callback({ success: true });
    });

    // Remove a user from a room
    socket.on("remove-from-room", async (payload: { roomId: string; userId: string }, callback) => {
      const { roomId, userId } = payload;
      const members = roomMembers.get(roomId);
      if (!members) return callback({ error: "Room not found" });
      members.delete(userId);
      io.to(roomId).emit("room-members-updated", { roomId, members: Array.from(members) });
      callback({ success: true });
    });

    // Delete an entire room
    socket.on("delete-room", async (payload: { roomId: string }, callback) => {
      const { roomId } = payload;
      const idx = rooms.findIndex((r) => r.id === roomId);
      if (idx === -1) return callback({ error: "Room not found" });
      rooms.splice(idx, 1);
      roomMembers.delete(roomId);
      // Force all sockets to leave the room
      io.sockets.sockets.forEach((s) => s.leave(roomId));
      io.emit("room-deleted", { roomId });
      callback({ success: true });
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
