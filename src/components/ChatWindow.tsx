import React, { useState, useEffect, useRef } from "react";
import { User, Message, Room } from "../types";
import { Send, Menu, Smile, Search, HelpCircle, Check, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ChatWindowProps {
  currentUser: User;
  activeChatId: string;
  activeChatType: 'room' | 'dm';
  rooms: Room[];
  users: User[];
  messages: Message[];
  activeTypers: string[]; // usernames of users currently typing here
  onSendMessage: (content: string) => void;
  onSendTypingStatus: (isTyping: boolean) => void;
  onToggleSidebar: () => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "🎉", "🚀", "💡", "👀"];

export default function ChatWindow({
  currentUser,
  activeChatId,
  activeChatType,
  rooms,
  users,
  messages,
  activeTypers,
  onSendMessage,
  onSendTypingStatus,
  onToggleSidebar
}: ChatWindowProps) {
  const [inputText, setInputText] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingStateRef = useRef<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Find info about the target room or user
  const activeRoom = activeChatType === 'room' ? rooms.find((r) => r.id === activeChatId) : null;
  const activeDMUser = activeChatType === 'dm' ? users.find((u) => u.id === activeChatId) : null;

  const chatTitle = activeRoom ? `#${activeRoom.name}` : activeDMUser ? activeDMUser.username : "ChatRoom";
  const chatDescription = activeRoom ? activeRoom.description : activeDMUser ? (activeDMUser.online ? "Online now" : "Offline") : "";

  // Filter messages for current context
  const filteredMessages = messages.filter((m) => {
    if (activeChatType === 'room') {
      return m.roomId === activeChatId;
    } else {
      // DM messages between currentUser and selected DM user
      return (
        (m.senderId === currentUser.id && m.receiverId === activeChatId) ||
        (m.senderId === activeChatId && m.receiverId === currentUser.id)
      );
    }
  });

  // Automatically scroll to bottom of messages container
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredMessages, activeTypers]);

  // Handle typing status throttling
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!isTypingStateRef.current) {
      isTypingStateRef.current = true;
      onSendTypingStatus(true);
    }

    // Reset keyboard activity timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingStateRef.current = false;
      onSendTypingStatus(false);
    }, 1500);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    onSendMessage(text);
    setInputText("");

    // Clear typing indicator instantly
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingStateRef.current) {
      isTypingStateRef.current = false;
      onSendTypingStatus(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  // Convert individual timestamp to localized layout
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "00:00";
    }
  };

  const formatDateLabel = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return "Today";
      
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return "";
    }
  };

  // Render receipt tick status
  const renderReadReceipt = (status: 'sent' | 'delivered' | 'read') => {
    if (status === 'sent') {
      return <Check className="w-3.5 h-3.5 text-zinc-500" />;
    }
    if (status === 'delivered') {
      return <CheckCheck className="w-3.5 h-3.5 text-zinc-500" />;
    }
    if (status === 'read') {
      return <CheckCheck className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />;
    }
    return null;
  };

  return (
    <div id="chat-window-viewport" className="flex-1 bg-[#313338] flex flex-col h-full relative font-sans">
      {/* Header bar */}
      <header className="h-12 border-b border-[#1e1f22] px-4 flex items-center justify-between flex-shrink-0 bg-[#313338] shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 -ml-2 text-[#949BA4] hover:text-white rounded-lg hover:bg-[#3F4147] transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="overflow-hidden">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
              {activeChatType === 'room' && <span className="text-[#949BA4] font-normal">#</span>}
              {chatTitle}
            </h3>
            {chatDescription && (
              <p className="text-xs text-[#949BA4] truncate mt-0.5 max-w-md font-medium">
                {chatDescription}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Messages layout */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
      >
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#2B2D31] border border-[#1e1f22]/60 flex items-center justify-center text-[#949BA4] mb-4">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h4 className="text-[#DBDEE1] font-bold text-sm">No Messages Yet</h4>
            <p className="text-[#949BA4] text-xs mt-1.5 leading-relaxed">
              Be the first to say hello! Your conversation history is cached in local storage for upcoming visits.
            </p>
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const isMine = msg.senderId === currentUser.id;
            const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;

            // Date separator
            const currentDateLabel = formatDateLabel(msg.timestamp);
            const prevDateLabel = prevMsg ? formatDateLabel(prevMsg.timestamp) : "";
            const showDateHeader = currentDateLabel !== prevDateLabel;

            return (
              <div key={msg.id} className="space-y-4">
                {showDateHeader && (
                  <div className="flex justify-center my-6">
                    <span className="bg-[#2B2D31] border border-[#1e1f22]/40 rounded-full px-3 py-1 text-[10px] text-[#949BA4] uppercase tracking-widest font-bold">
                      {currentDateLabel}
                    </span>
                  </div>
                )}

                <div className={`flex items-start gap-3 group ${isMine ? "flex-row-reverse" : ""}`}>
                  {/* Sender initials avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border border-[#1e1f22]/20 flex-shrink-0 ${
                    isMine ? currentUser.color : msg.senderColor
                  }`}>
                    {msg.senderName.substring(0, 2).toUpperCase()}
                  </div>

                  <div className={`max-w-[70%] space-y-1 ${isMine ? "items-end" : ""}`}>
                    {/* Header info */}
                    {!isMine && (
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-xs font-bold text-white">{msg.senderName}</span>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div className={`px-4.5 py-2.5 text-sm leading-relaxed break-words relative shadow-sm ${
                      isMine
                        ? "bg-[#5865F2] text-white rounded-tl-xl rounded-bl-xl rounded-br-xl"
                        : "bg-[#2B2D31] text-[#DBDEE1] rounded-tr-xl rounded-bl-xl rounded-br-xl"
                    }`}>
                      <p>{msg.content}</p>

                      {/* Receipt & Timestamp area */}
                      <div className={`flex items-center justify-end gap-1.5 mt-1.5 -mb-0.5 text-[10px] select-none ${isMine ? "text-[#E3E5E8]" : "text-[#949BA4]"}`}>
                        <span>{formatTime(msg.timestamp)}</span>
                        {isMine && activeChatType === 'dm' && (
                          <span className="flex-shrink-0">
                            {renderReadReceipt(msg.status)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Typing Indicators & Composition Footer bar */}
      <div className="border-t border-[#1e1f22] px-6 py-4 flex-shrink-0 bg-[#313338]">
        {/* Typing Notification Drawer */}
        <div className="h-5 mb-1.5 overflow-hidden">
          <AnimatePresence>
            {activeTypers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-[11px] text-[#5865F2] font-semibold flex items-center gap-1.5"
              >
                <div className="flex gap-0.5 items-center">
                  <span className="w-1 h-1 bg-[#5865F2] rounded-full animate-bounce delay-100" />
                  <span className="w-1 h-1 bg-[#5865F2] rounded-full animate-bounce delay-300" />
                  <span className="w-1 h-1 bg-[#5865F2] rounded-full animate-bounce delay-500" />
                </div>
                <span>
                  {activeTypers.length === 1
                    ? `${activeTypers[0]} is typing...`
                    : activeTypers.length === 2
                    ? `${activeTypers[0]} and ${activeTypers[1]} are typing...`
                    : "Multiple colleagues are typing..."}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dynamic Compose Box */}
        <form onSubmit={handleSend} className="space-y-3">
          <div className="flex items-center gap-2.5">
            {/* Quick action bar */}
            <div className="flex-1 relative flex bg-[#383A40] rounded-lg items-center px-4 py-0.5 border border-[#1e1f22]/5">
              <input
                type="text"
                placeholder={activeDMUser ? `Send private message to ${activeDMUser.username}...` : `Message #${chatTitle}...`}
                value={inputText}
                onChange={handleInputChange}
                maxLength={2000}
                className="flex-1 bg-transparent border-none outline-none text-sm text-[#DBDEE1] placeholder-[#6D6F78] focus:ring-0 py-2.5"
              />
              
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center text-[#B5BAC1]">
                <Smile className="w-4.5 h-4.5 text-[#949BA4] hover:text-white cursor-pointer transition-colors" />
              </div>
            </div>

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-3 bg-[#5865F2] hover:bg-opacity-95 text-white font-bold rounded-lg transition-all shadow-md flex-shrink-0 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Quick emoji helper buttons */}
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="text-[10px] text-[#949BA4] uppercase tracking-wider font-bold mr-1.5">Quick reacts:</span>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="text-xs hover:bg-[#3F4147] p-1 px-1.5 rounded text-[#949BA4] hover:text-[#DBDEE1] transition-all cursor-pointer border border-transparent"
              >
                {emoji}
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
