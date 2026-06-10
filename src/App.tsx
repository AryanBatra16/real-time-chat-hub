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
import NotFound from "./components/NotFound";

const MESSAGES_STORAGE_KEY = "chat_hub_messages_v1";
const STORED_TOKEN_KEY = "chat_hub_jwt_token";

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [restoringSession, setRestoringSession] = useState(() => {
    return !!localStorage.getItem(STORED_TOKEN_KEY);
  });
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

  // Client-side lightweight routing state
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  const socketRef = useRef<Socket | null>(null);

  const activeChatIdRef = useRef(activeChatId);
  const activeChatTypeRef = useRef(activeChatType);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
    activeChatTypeRef.current = activeChatType;
    currentUserRef.current = currentUser;
  }, [activeChatId, activeChatType, currentUser]);

  // Safety timeout fallback for restoring session to prevent blank loading screens
  useEffect(() => {
    if (restoringSession) {
      const timer = setTimeout(() => {
        setRestoringSession(false);
        setShowLanding(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [restoringSession]);

  // Listen to browser URL changes
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState(null, "", path);
    setCurrentPath(path);
  };

  // Sync URL pathname changes to active chat state
  useEffect(() => {
    if (!currentUser) return;

    const isRoot = currentPath === "/" || currentPath === "/index.html" || currentPath === "";
    if (isRoot) {
      window.history.replaceState(null, "", "/channels/general");
      setCurrentPath("/channels/general");
      setActiveChatId("general");
      setActiveChatType("room");
    } else if (currentPath.startsWith("/channels/")) {
      const parts = currentPath.split("/").filter(Boolean);
      const roomId = parts[1];
      if (roomId && rooms.some(r => r.id === roomId)) {
        setActiveChatId(roomId);
        setActiveChatType("room");
      }
    } else if (currentPath.startsWith("/dm/")) {
      const parts = currentPath.split("/").filter(Boolean);
      const userId = parts[1];
      if (userId && users.some(u => u.id === userId)) {
        setActiveChatId(userId);
        setActiveChatType("dm");
      }
    }
  }, [currentPath, currentUser, rooms, users]);

  // Routing validation checks
  const isPathValid = (() => {
    if (currentPath === "/" || currentPath === "/index.html" || currentPath === "") return true;
    
    const parts = currentPath.split("/").filter(Boolean);
    if (parts.length === 2) {
      const [type, id] = parts;
      if (type === "channels") {
        if (rooms.length > 0) {
          return rooms.some(r => r.id === id);
        }
        return true;
      }
      if (type === "dm") {
        if (users.length > 0) {
          return users.some(u => u.id === id);
        }
        return true;
      }
    }
    return false; // Unrecognized routes
  })();

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
        setRestoringSession(true);
        socket.emit("user-init-auth", { token: cachedToken }, (res: {
          success?: boolean;
          error?: string;
          user?: User;
          users?: User[];
          rooms?: Room[];
          history?: Message[];
        }) => {
          setLoginLoading(false);
          setRestoringSession(false);
          if (res.success && res.user) {
            setCurrentUser(res.user);
            setShowLanding(false);
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
            setShowLanding(true);
          }
        });
      } else {
        setRestoringSession(false);
      }
    });

    socket.on("connect_error", () => {
      setLoginLoading(false);
      setRestoringSession(false);
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
        (msg.roomId && activeChatTypeRef.current === 'room' && activeChatIdRef.current === msg.roomId) ||
        (msg.receiverId && !msg.roomId && activeChatTypeRef.current === 'dm' && activeChatIdRef.current === msg.senderId);

      const isMine = msg.senderId === currentUserRef.current?.id;

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

    socket.on("messages-read-ack", (payload: { readerId: string; senderId: string; readAt?: string }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderId === payload.senderId && m.receiverId === payload.readerId && m.status !== "read") {
            return { 
              ...m, 
              status: "read",
              readAt: payload.readAt || new Date().toISOString(),
              deliveredAt: m.deliveredAt || new Date().toISOString()
            };
          }
          return m;
        })
      );
    });

    socket.on("message-edited", (payload: { id: string; content: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.id ? { ...m, content: payload.content } : m))
      );
    });

    socket.on("message-deleted", (payload: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== payload.id));
    });

    socket.on("message-starred", (payload: { id: string; isStarred: boolean }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.id ? { ...m, isStarred: payload.isStarred } : m))
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
  const handleSendMessage = (text: string, replyToId?: string, replyToName?: string, replyToContent?: string) => {
    if (!socketRef.current || !currentUser) return;

    const payload = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      content: text,
      roomId: activeChatType === 'room' ? activeChatId : undefined,
      receiverId: activeChatType === 'dm' ? activeChatId : undefined,
      replyToId,
      replyToName,
      replyToContent
    };

    socketRef.current.emit("send-message", payload);
  };

  const handleEditMessage = (id: string, newContent: string) => {
    socketRef.current?.emit("edit-message", { id, content: newContent });
  };

  const handleDeleteMessage = (id: string) => {
    socketRef.current?.emit("delete-message", { id });
  };

  const handleStarMessage = (id: string, isStarred: boolean) => {
    socketRef.current?.emit("star-message", { id, isStarred });
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
          const path = `/channels/${res.room.id}`;
          window.history.pushState(null, "", path);
          setCurrentPath(path);
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

  // 404 rendering check
  const show404 = (() => {
    if (restoringSession) return false;
    const isRoot = currentPath === "/" || currentPath === "/index.html" || currentPath === "";
    if (!currentPath.startsWith("/channels/") && !currentPath.startsWith("/dm/") && !isRoot) {
      return true; // Completely invalid route
    }
    // Room/DM route check - wait until lists are synchronized
    if (currentUser && rooms.length > 0 && !isPathValid) {
      return true;
    }
    return false;
  })();

  if (show404) {
    return <NotFound onReturn={() => navigateTo("/")} />;
  }

  if (restoringSession) {
    return (
      <div className="h-screen w-screen bg-[#1E1F22] flex flex-col items-center justify-center select-none font-sans">
        <div className="relative flex flex-col items-center gap-6">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <img 
              src="/collabspace_logo.png" 
              alt="CollabSpace Logo" 
              className="w-16 h-16 object-contain rounded-2xl shadow-xl shadow-[#5865F2]/20 animate-pulse" 
            />
            <div className="absolute inset-0 border-2 border-[#5865F2] border-t-transparent rounded-2xl animate-spin" />
          </div>
          <div className="text-center space-y-1.5">
            <h3 className="text-white font-bold text-sm tracking-wide">Restoring Session</h3>
            <p className="text-[#949BA4] text-xs font-medium">Synchronizing workspace details...</p>
          </div>
        </div>
      </div>
    );
  }

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
              const path = type === 'room' ? `/channels/${id}` : `/dm/${id}`;
              window.history.pushState(null, "", path);
              setCurrentPath(path);
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
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onStarMessage={handleStarMessage}
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
