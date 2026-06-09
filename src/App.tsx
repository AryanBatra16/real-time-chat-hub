import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { User, Message, Room } from "./types";
import LoginScreen from "./components/LoginScreen";
import RoomSidebar from "./components/RoomSidebar";
import ChatWindow from "./components/ChatWindow";
import InfoSidebar from "./components/InfoSidebar";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, ShieldCheck, WifiOff } from "lucide-react";

const MESSAGES_STORAGE_KEY = "chat_hub_messages_v1";
const STORED_USERNAME_KEY = "chat_hub_remembered_name";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("general");
  const [activeChatType, setActiveChatType] = useState<'room' | 'dm'>("room");
  
  // Unread badge tracking: chat id (roomId or userId of sender) -> count
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // Typing indicators: targetId (roomId or DM room partner Id) -> list of usernames typing
  const [typingMap, setTypingMap] = useState<Record<string, Record<string, boolean>>>({});
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [infoSidebarOpen, setInfoSidebarOpen] = useState(true);
  
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // 1. Initial State Sync: Load local message history & checked cached user credentials
  useEffect(() => {
    try {
      const cachedMessages = localStorage.getItem(MESSAGES_STORAGE_KEY);
      if (cachedMessages) {
        setMessages(JSON.parse(cachedMessages));
      }
    } catch (e) {
      console.error("Failed to load local storage message history", e);
    }
  }, []);

  // Sync client-side message state mutations directly back to localStorage so user doesn't lose logs
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Hook up full Socket.io and lifecycle bindings
  const setupSocketAndLogin = (username: string) => {
    setLoginLoading(true);
    setLoginError("");

    // Create single persistent socket client targeting current base port
    const socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setReconnecting(false);

      // Initialize credentials setup with server
      socket.emit("user-init", username, (res: {
        success?: boolean;
        error?: string;
        user?: User;
        users?: User[];
        rooms?: Room[];
        history?: Message[];
      }) => {
        setLoginLoading(false);
        if (res.error) {
          setLoginError(res.error);
          socket.disconnect();
          return;
        }

        if (res.success && res.user) {
          setCurrentUser(res.user);
          localStorage.setItem(STORED_USERNAME_KEY, username);
          
          if (res.users) setUsers(res.users);
          if (res.rooms) setRooms(res.rooms);
          
          // Seed local messages store with server-side cached items, preserving existing unique messages
          if (res.history) {
            setMessages((prev) => {
              const prevMap = new Map<string, Message>(prev.map(m => [m.id, m]));
              res.history?.forEach((msg) => {
                // If it was delivered or read locally, don't overwrite with 'sent' status
                if (!prevMap.has(msg.id)) {
                  prevMap.set(msg.id, msg);
                }
              });
              const combinedList = Array.from(prevMap.values());
              return combinedList.sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
            });
          }
        }
      });
    });

    socket.on("connect_error", () => {
      setLoginLoading(false);
      setLoginError("Could not establish a connection to WebSocket server.");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setReconnecting(true);
    });

    // Real-Time Event triggers
    socket.on("user-joined", (newUser: User) => {
      setUsers((prev) => {
        // Idempotency: prevent duplicates
        if (prev.some((u) => u.id === newUser.id)) return prev;
        return [...prev, newUser];
      });
    });

    socket.on("user-left", (leftData: { id: string; username: string }) => {
      setUsers((prev) => prev.filter((u) => u.id !== leftData.id));
      
      // Clean up typing status of deleted user
      setTypingMap((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (next[k][leftData.id]) {
            const inner = { ...next[k] };
            delete inner[leftData.id];
            next[k] = inner;
          }
        });
        return next;
      });
    });

    // Incoming messages
    socket.on("message-receive", (msg: Message) => {
      // Add message locally safely avoiding duplicates
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });

      // Update unread badges if we are not currently focused on the sender or specific room
      const isCurrentLocation = 
        (msg.roomId && activeChatType === 'room' && activeChatId === msg.roomId) ||
        (msg.receiverId && !msg.roomId && activeChatType === 'dm' && activeChatId === msg.senderId);

      const isMine = msg.senderId === socket.id;

      if (!isCurrentLocation && !isMine) {
        // Trigger unread increment
        const senderKey = msg.roomId ? msg.roomId : msg.senderId;
        setUnreadCounts((prev) => ({
          ...prev,
          [senderKey]: (prev[senderKey] || 0) + 1
        }));
      }

      // If DM and is current active screen, let's reply back with a read receipt right away!
      if (msg.receiverId && !msg.roomId && isCurrentLocation) {
        socket.emit("mark-as-read", { senderId: msg.senderId });
      }
    });

    // Handle incoming typing triggers
    socket.on("typing-status-update", (payload: { userId: string; username: string; targetId: string; isTyping: boolean }) => {
      setTypingMap((prev) => {
        const targetValue = prev[payload.targetId] || {};
        return {
          ...prev,
          [payload.targetId]: {
            ...targetValue,
            [payload.userId]: payload.isTyping
          }
        };
      });
    });

    // Received read acknowledgement from DM partner
    socket.on("messages-read-ack", (payload: { readerId: string; senderId: string }) => {
      // The person who read our messages is readerId.
      // Filter previous messages where we sent to viewer and change their state to 'read'
      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderId === payload.senderId && m.receiverId === payload.readerId && m.status !== "read") {
            return { ...m, status: "read" };
          }
          return m;
        })
      );
    });

    // Room created externally
    socket.on("room-created", (newRoom: Room) => {
      setRooms((prev) => {
        if (prev.some((r) => r.id === newRoom.id)) return prev;
        return [...prev, newRoom];
      });
    });
  };

  // Run on first login attempts
  const handleLogin = (username: string) => {
    setupSocketAndLogin(username);
  };

  // Perform message deliveries
  const handleSendMessage = (text: string) => {
    if (!socketRef.current || !currentUser) return;

    const payload = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      content: text,
      roomId: activeChatType === 'room' ? activeChatId : undefined,
      receiverId: activeChatType === 'dm' ? activeChatId : undefined
    };

    socketRef.current.emit("send-message", payload);
  };

  // Handle typing statuses broadcast
  const handleSendTypingStatus = (isTyping: boolean) => {
    if (!socketRef.current) return;
    socketRef.current.emit("typing-status", {
      targetId: activeChatId,
      isTyping
    });
  };

  // Create new collaboration channel
  const handleCreateRoom = (name: string, description: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socketRef.current) return resolve(false);

      socketRef.current.emit("create-room", { name, description }, (res: { success?: boolean; error?: string; room?: Room }) => {
        if (res.success && res.room) {
          setRooms((prev) => [...prev, res.room!]);
          // Focus on newly spawned channel automatically
          setActiveChatId(res.room.id);
          setActiveChatType("room");
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  };

  // Read receipts checking routines on active focus change
  useEffect(() => {
    if (!socketRef.current || !currentUser) return;

    // Reset unread badges for the focused room/DM
    setUnreadCounts((prev) => {
      if (!prev[activeChatId]) return prev;
      const next = { ...prev };
      delete next[activeChatId];
      return next;
    });

    // If focused chat is a Direct Message, let's mark all its messages as read instantly!
    if (activeChatType === "dm") {
      socketRef.current.emit("mark-as-read", { senderId: activeChatId });
      
      // Update our local state status for these messages as read as well
      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderId === activeChatId && m.receiverId === currentUser.id && m.status !== "read") {
            return { ...m, status: "read" };
          }
          return m;
        })
      );
    }
  }, [activeChatId, activeChatType, currentUser, messages.length]);

  // Logout cleanups
  const handleLogout = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setCurrentUser(null);
    localStorage.removeItem(STORED_USERNAME_KEY);
    setUsers([]);
  };

  // Try auto-login if they have a remembered name
  useEffect(() => {
    const cachedName = localStorage.getItem(STORED_USERNAME_KEY);
    if (cachedName) {
      handleLogin(cachedName);
    }
  }, []);

  // Gather current active screen typers
  const getCurrentActiveTypers = () => {
    const subTarget = typingMap[activeChatId] || {};
    return Object.entries(subTarget)
      .filter(([userId, isCurrentlyTyping]) => isCurrentlyTyping && userId !== currentUser?.id)
      .map(([userId]) => {
        const matchingUser = users.find((u) => u.id === userId);
        return matchingUser ? matchingUser.username : "Someone";
      });
  };

  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        error={loginError}
        loading={loginLoading}
      />
    );
  }

  return (
    <div id="app-root" className="h-screen bg-[#1E1F22] flex flex-col text-[#DBDEE1] select-none overflow-hidden font-sans">
      
      {/* Top micro reconnecting alert pill */}
      {reconnecting && (
        <div className="bg-[#F23F43]/10 border-b border-[#F23F43]/20 text-[#F23F43] py-1.5 px-4 text-xs font-bold text-center flex items-center justify-center gap-2 animate-pulse">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Connection interrupted. Re-establishing socket feed...</span>
        </div>
      )}

      {/* Main content container */}
      <div className="flex-1 flex overflow-hidden relative bg-[#1E1F22]">
        
        {/* Navigation Sidebar Panel (Drawers on mobile) */}
        <div className={`
          absolute z-30 h-full md:static md:block transition-all duration-300 md:animate-none
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}>
          <RoomSidebar
            currentUser={currentUser}
            users={users}
            rooms={rooms}
            activeChatId={activeChatId}
            activeChatType={activeChatType}
            unreadCounts={unreadCounts}
            onSelectChat={(id, type) => {
              setActiveChatId(id);
              setActiveChatType(type);
              // Close on select on smaller screens
              if (window.innerWidth < 768) {
                setSidebarOpen(false);
              }
            }}
            onCreateRoom={handleCreateRoom}
            onLogout={handleLogout}
          />
        </div>

        {/* Mobile Sidebar Overlay backdrops */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="md:hidden absolute inset-0 z-20 bg-[#1E1F22]/85 backdrop-blur-sm"
          />
        )}

        {/* Active chat layout */}
        <ChatWindow
          currentUser={currentUser}
          activeChatId={activeChatId}
          activeChatType={activeChatType}
          rooms={rooms}
          users={users}
          messages={messages}
          activeTypers={getCurrentActiveTypers()}
          onSendMessage={handleSendMessage}
          onSendTypingStatus={handleSendTypingStatus}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Info panel */}
        {infoSidebarOpen && (
          <InfoSidebar
            activeChatId={activeChatId}
            activeChatType={activeChatType}
            rooms={rooms}
            users={users}
            messages={messages}
            onClose={() => setInfoSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
