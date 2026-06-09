import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { User, Message, Room } from "./types";
import LoginScreen from "./components/LoginScreen";
import LandingPage from "./components/LandingPage";
import RoomSidebar from "./components/RoomSidebar";
import ChatWindow from "./components/ChatWindow";
import InfoSidebar from "./components/InfoSidebar";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, ShieldCheck, WifiOff } from "lucide-react";

const MESSAGES_STORAGE_KEY = "chat_hub_messages_v1";
const STORED_TOKEN_KEY = "chat_hub_jwt_token";

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
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
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [timeTick, setTimeTick] = useState(0);

  const socketRef = useRef<Socket | null>(null);

  // Trigger relative time recalculation every 60s
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(prev => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // 1. Initial State Sync: Load local message history
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

  // Persistent Socket Initialization
  useEffect(() => {
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

      // Try automatic token session recovery
      const cachedToken = localStorage.getItem(STORED_TOKEN_KEY);
      if (cachedToken) {
        setLoginLoading(true);
        socket.emit("user-init-auth", { token: cachedToken }, (res: {
          success?: boolean;
          error?: string;
          user?: User;
          users?: User[];
          rooms?: Room[];
          history?: Message[];
        }) => {
          setLoginLoading(false);
          if (res.success && res.user) {
            setCurrentUser(res.user);
            if (res.users) setUsers(res.users);
            if (res.rooms) setRooms(res.rooms);
            if (res.history) {
              setMessages((prev) => {
                const prevMap = new Map<string, Message>(prev.map(m => [m.id, m]));
                res.history?.forEach((msg) => {
                  if (!prevMap.has(msg.id)) prevMap.set(msg.id, msg);
                });
                return Array.from(prevMap.values()).sort(
                  (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
              });
            }
          } else {
            // Token expired or invalid, clear from storage
            localStorage.removeItem(STORED_TOKEN_KEY);
          }
        });
      }
    });

    socket.on("connect_error", () => {
      setLoginLoading(false);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setReconnecting(true);
    });

    // Real-Time Event triggers
    socket.on("user-joined", (newUser: User) => {
      setUsers((prev) => {
        if (prev.some((u) => u.id === newUser.id)) return prev;
        return [...prev, newUser];
      });
    });

    socket.on("user-left", (leftData: { id: string; username: string }) => {
      setUsers((prev) => prev.filter((u) => u.id !== leftData.id));
      
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

    socket.on("message-receive", (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });

      // Update unread badges
      const isCurrentLocation = 
        (msg.roomId && activeChatType === 'room' && activeChatId === msg.roomId) ||
        (msg.receiverId && !msg.roomId && activeChatType === 'dm' && activeChatId === msg.senderId);

      const isMine = msg.senderId === socket.id;

      if (!isCurrentLocation && !isMine) {
        const senderKey = msg.roomId ? msg.roomId : msg.senderId;
        setUnreadCounts((prev) => ({
          ...prev,
          [senderKey]: (prev[senderKey] || 0) + 1
        }));
      }

      if (msg.receiverId && !msg.roomId && isCurrentLocation) {
        socket.emit("mark-as-read", { senderId: msg.senderId });
      }
    });

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

    socket.on("messages-read-ack", (payload: { readerId: string; senderId: string }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderId === payload.senderId && m.receiverId === payload.readerId && m.status !== "read") {
            return { ...m, status: "read" };
          }
          return m;
        })
      );
    });

    socket.on("room-created", (newRoom: Room) => {
      setRooms((prev) => {
        if (prev.some((r) => r.id === newRoom.id)) return prev;
        return [...prev, newRoom];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Submit Login credentials to server via WebSocket
  const handleLogin = (identifier: string, password: string, callback: (err?: string) => void) => {
    if (!socketRef.current) return callback("Server not available");
    setLoginLoading(true);

    socketRef.current.emit("user-login", { identifier, password }, (res: {
      success?: boolean;
      error?: string;
      token?: string;
      user?: User;
    }) => {
      if (res.error) {
        setLoginLoading(false);
        callback(res.error);
        return;
      }

      if (res.success && res.token && res.user) {
        localStorage.setItem(STORED_TOKEN_KEY, res.token);
        
        // Re-authenticate session setup
        socketRef.current?.emit("user-init-auth", { token: res.token }, (authRes: {
          success?: boolean;
          error?: string;
          user?: User;
          users?: User[];
          rooms?: Room[];
          history?: Message[];
        }) => {
          setLoginLoading(false);
          if (authRes.error) {
            callback(authRes.error);
          } else if (authRes.success && authRes.user) {
            setCurrentUser(authRes.user);
            if (authRes.users) setUsers(authRes.users);
            if (authRes.rooms) setRooms(authRes.rooms);
            if (authRes.history) {
              setMessages((prev) => {
                const prevMap = new Map<string, Message>(prev.map(m => [m.id, m]));
                authRes.history?.forEach((msg) => {
                  if (!prevMap.has(msg.id)) prevMap.set(msg.id, msg);
                });
                return Array.from(prevMap.values()).sort(
                  (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
              });
            }
            callback();
          }
        });
      }
    });
  };

  // Submit Registration credentials to server
  const handleRegister = (username: string, email: string, password: string, callback: (err?: string) => void) => {
    if (!socketRef.current) return callback("Server not available");
    setLoginLoading(true);

    socketRef.current.emit("user-register", { username, email, password }, (res: { success?: boolean; error?: string }) => {
      setLoginLoading(false);
      if (res.error) {
        callback(res.error);
      } else {
        callback();
      }
    });
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

    if (activeChatType === "dm") {
      socketRef.current.emit("mark-as-read", { senderId: activeChatId });
      
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
    localStorage.removeItem(STORED_TOKEN_KEY);
    setUsers([]);
  };

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

  if (showLanding && !currentUser) {
    return <LandingPage onLaunch={() => setShowLanding(false)} />;
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onRegister={handleRegister}
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
