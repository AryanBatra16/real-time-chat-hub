import React, { useState, useEffect, useRef } from "react";
import { User, Message, Room } from "../types";
import { 
  Send, Menu, Smile, HelpCircle, Check, CheckCheck, 
  CornerUpLeft, Copy, Forward, Edit2, Star, Trash2, X, Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatLastSeen } from "../utils/formatTime";

interface ChatWindowProps {
  currentUser: User;
  activeChatId: string;
  activeChatType: 'room' | 'dm';
  rooms: Room[];
  users: User[];
  messages: Message[];
  activeTypers: string[];
  onSendMessage: (content: string, replyToId?: string, replyToName?: string, replyToContent?: string) => void;
  onSendTypingStatus: (isTyping: boolean) => void;
  onToggleSidebar: () => void;
  onEditMessage: (id: string, newContent: string) => void;
  onDeleteMessage: (id: string) => void;
  onStarMessage: (id: string, isStarred: boolean) => void;
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
  onToggleSidebar,
  onEditMessage,
  onDeleteMessage,
  onStarMessage
}: ChatWindowProps) {
  const [inputText, setInputText] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingStateRef = useRef<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // States for advanced actions
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showForwardMessage, setShowForwardMessage] = useState<Message | null>(null);
  const [showInfoMessage, setShowInfoMessage] = useState<Message | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Find info about the target room or user
  const activeRoom = activeChatType === 'room' ? rooms.find((r) => r.id === activeChatId) : null;
  const activeDMUser = activeChatType === 'dm' ? users.find((u) => u.id === activeChatId) : null;

  const chatTitle = activeRoom ? `#${activeRoom.name}` : activeDMUser ? activeDMUser.username : "ChatRoom";
  const chatDescription = activeRoom ? activeRoom.description : activeDMUser ? (activeDMUser.online ? "Online now" : `Last seen ${formatLastSeen(activeDMUser.lastSeen)}`) : "";

  // Filter messages for current context
  const filteredMessages = messages.filter((m) => {
    if (activeChatType === 'room') {
      return m.roomId === activeChatId;
    } else {
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
  }, [filteredMessages.length, activeTypers.length]);

  // Handle typing status throttling
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    // Auto-grow height logic
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;

    if (!isTypingStateRef.current) {
      isTypingStateRef.current = true;
      onSendTypingStatus(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingStateRef.current = false;
      onSendTypingStatus(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    if (replyToMessage) {
      onSendMessage(text, replyToMessage.id, replyToMessage.senderName, replyToMessage.content);
      setReplyToMessage(null);
    } else {
      onSendMessage(text);
    }

    setInputText("");

    // Reset height of compose area
    const textarea = document.getElementById("compose-textarea") as HTMLTextAreaElement;
    if (textarea) {
      textarea.style.height = 'auto';
    }

    // Clear typing indicator instantly
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingStateRef.current) {
      isTypingStateRef.current = false;
      onSendTypingStatus(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    setTimeout(() => {
      const textarea = document.getElementById("compose-textarea") as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
      }
    }, 50);
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

  const renderGroupReadReceipt = (msg: Message) => {
    const readers = msg.readBy || [];
    const otherReaders = readers.filter(uid => uid !== currentUser.id);
    if (otherReaders.length === 0) return null;

    const names = otherReaders.map(uid => {
      const u = users.find(user => user.id === uid);
      return u ? u.username : "Someone";
    }).join(", ");

    return (
      <span 
        className="text-[9px] text-[#949BA4] cursor-help hover:text-white select-none mt-1 block text-right font-medium"
        title={`Read by: ${names}`}
      >
        Read by {otherReaders.length}
      </span>
    );
  };

  // Actions handlers
  const handleCopy = (msg: Message) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedMessageId(msg.id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.content);
  };

  const handleSaveEdit = () => {
    if (editingMessageId && editingText.trim()) {
      onEditMessage(editingMessageId, editingText.trim());
      setEditingMessageId(null);
    }
  };

  const handleForward = (recipientId: string, recipientType: 'room' | 'dm') => {
    if (showForwardMessage) {
      const content = `[Forwarded] ${showForwardMessage.content}`;
      if (recipientType === 'room') {
        onSendMessage(content, undefined, undefined, undefined);
      } else {
        // Find if target is registered and map send event
        const payload = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          content,
          receiverId: recipientId
        };
        onSendMessage(content, undefined, undefined, undefined);
      }
      setShowForwardMessage(null);
    }
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
              Be the first to say hello! Your conversation history is securely saved and synchronized in the cloud.
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

            const isEditing = editingMessageId === msg.id;

            return (
              <div key={msg.id} className="space-y-4">
                {showDateHeader && (
                  <div className="flex justify-center my-6">
                    <span className="bg-[#2B2D31] border border-[#1e1f22]/40 rounded-full px-3 py-1 text-[10px] text-[#949BA4] uppercase tracking-widest font-bold">
                      {currentDateLabel}
                    </span>
                  </div>
                )}

                <div className={`flex items-start gap-3 group/msg ${isMine ? "flex-row-reverse" : ""}`}>
                  {/* Sender initials avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border border-[#1e1f22]/20 flex-shrink-0 ${
                    isMine ? currentUser.color : msg.senderColor
                  }`}>
                    {msg.senderName.substring(0, 2).toUpperCase()}
                  </div>

                  <div className={`max-w-[70%] space-y-1 relative ${isMine ? "items-end" : ""}`}>
                    {/* Header info */}
                    {!isMine && (
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-xs font-bold text-white">{msg.senderName}</span>
                      </div>
                    )}

                    {/* Message Bubble + Hover Action Buttons */}
                    <div className="relative group/bubble flex items-center gap-2">
                      
                      {/* Hover Actions Menu Bar */}
                      <div className={`absolute top-[-20px] z-10 hidden group-hover/msg:flex items-center bg-[#2B2D31] border border-[#1E1F22] rounded-lg p-0.5 shadow-md text-[#B5BAC1] ${
                        isMine ? "left-0" : "right-0"
                      }`}>
                        <button 
                          onClick={() => setReplyToMessage(msg)}
                          title="Reply"
                          className="p-1 hover:bg-[#3F4147] hover:text-white rounded transition-all cursor-pointer"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleCopy(msg)}
                          title={copiedMessageId === msg.id ? "Copied!" : "Copy"}
                          className={`p-1 hover:bg-[#3F4147] hover:text-white rounded transition-all cursor-pointer ${
                            copiedMessageId === msg.id ? "text-emerald-500" : ""
                          }`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => setShowForwardMessage(msg)}
                          title="Forward"
                          className="p-1 hover:bg-[#3F4147] hover:text-white rounded transition-all cursor-pointer"
                        >
                          <Forward className="w-3.5 h-3.5" />
                        </button>
                        {isMine && (
                          <button 
                            onClick={() => handleStartEdit(msg)}
                            title="Edit"
                            className="p-1 hover:bg-[#3F4147] hover:text-white rounded transition-all cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button 
                          onClick={() => onStarMessage(msg.id, !msg.isStarred)}
                          title={msg.isStarred ? "Unstar" : "Star"}
                          className={`p-1 hover:bg-[#3F4147] hover:text-white rounded transition-all cursor-pointer ${
                            msg.isStarred ? "text-[#FAA81A]" : ""
                          }`}
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        {isMine && (
                          <button 
                            onClick={() => onDeleteMessage(msg.id)}
                            title="Delete"
                            className="p-1 hover:bg-[#3F4147] text-rose-500 hover:text-rose-400 rounded transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isMine && activeChatType === 'dm' && (
                          <button 
                            onClick={() => setShowInfoMessage(msg)}
                            title="Info"
                            className="p-1 hover:bg-[#3F4147] hover:text-white rounded transition-all cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Actual Bubble */}
                      <div className={`px-4.5 py-2.5 text-sm leading-relaxed break-words relative shadow-sm min-w-[80px] ${
                        isMine
                          ? "bg-[#5865F2] text-white rounded-tl-xl rounded-bl-xl rounded-br-xl"
                          : "bg-[#2B2D31] text-[#DBDEE1] rounded-tr-xl rounded-bl-xl rounded-br-xl"
                      }`}>
                        
                        {/* Starred tag */}
                        {msg.isStarred && (
                          <div className="absolute top-1 right-1 flex items-center text-[#FAA81A]">
                            <Star className="w-2.5 h-2.5 fill-[#FAA81A]" />
                          </div>
                        )}

                        {/* Reply tag container */}
                        {msg.replyToId && (
                          <div className="mb-2 bg-black/15 border-l-4 border-white/40 p-2 rounded text-xs select-none cursor-pointer flex flex-col gap-0.5 opacity-90">
                            <span className="font-bold text-white">{msg.replyToName}</span>
                            <span className="truncate max-w-xs">{msg.replyToContent}</span>
                          </div>
                        )}

                        {isEditing ? (
                          <div className="space-y-2 py-1">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              rows={2}
                              className="w-full bg-[#1E1F22] border border-[#1e1f22] rounded p-2 text-xs text-[#DBDEE1] focus:outline-none focus:border-[#5865F2] resize-none"
                            />
                            <div className="flex items-center gap-1.5 justify-end">
                              <button 
                                onClick={() => setEditingMessageId(null)}
                                className="px-2 py-1 bg-[#2B2D31] hover:bg-[#3F4147] text-white text-[10px] font-bold rounded cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={handleSaveEdit}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p>{msg.content}</p>
                        )}

                        {/* Receipt & Timestamp area */}
                        {!isEditing && (
                          <div className={`flex items-center justify-end gap-1.5 mt-1.5 -mb-0.5 text-[10px] select-none ${isMine ? "text-[#E3E5E8]" : "text-[#949BA4]"}`}>
                            <span>{formatTime(msg.timestamp)}</span>
                            {isMine && activeChatType === 'dm' && (
                              <span className="flex-shrink-0">
                                {renderReadReceipt(msg.status)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {isMine && activeChatType === 'room' && renderGroupReadReceipt(msg)}
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
          
          {/* Reply Preview Banner inside composer box */}
          {replyToMessage && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="bg-[#2B2D31] border border-[#1E1F22] rounded-lg p-3 relative flex justify-between items-center text-xs"
            >
              <div className="border-l-4 border-[#5865F2] pl-3 overflow-hidden">
                <p className="font-bold text-[#5865F2] mb-0.5">Replying to {replyToMessage.senderName}</p>
                <p className="text-[#949BA4] truncate max-w-lg leading-relaxed">{replyToMessage.content}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setReplyToMessage(null)}
                className="p-1 hover:bg-[#3F4147] rounded text-[#B5BAC1] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          <div className="flex items-center gap-2.5 relative">
            <div className="flex-1 relative flex bg-[#383A40] rounded-lg items-center px-4 py-0.5 border border-[#1e1f22]/5">
              <textarea
                id="compose-textarea"
                rows={1}
                placeholder={activeDMUser ? `Send private message to ${activeDMUser.username}...` : `Message #${chatTitle}...`}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                maxLength={2000}
                className="flex-1 bg-transparent border-none outline-none text-sm text-[#DBDEE1] placeholder-[#6D6F78] focus:ring-0 py-2.5 resize-none overflow-y-auto"
                style={{ height: '40px', maxHeight: '120px' }}
              />
              
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center text-[#B5BAC1]">
                <Smile className="w-4.5 h-4.5 text-[#949BA4] hover:text-white cursor-pointer transition-colors" />
              </div>
            </div>

            {inputText.length > 1800 && (
              <div className="absolute right-14 bottom-[-16px] text-[10px] text-[#949BA4] font-semibold select-none">
                {inputText.length} / 2000
              </div>
            )}

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

      {/* 1. Forward Modal */}
      <AnimatePresence>
        {showForwardMessage && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#2B2D31] border border-[#1E1F22] w-full max-w-sm rounded-xl overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-[#1E1F22] flex items-center justify-between bg-[#2B2D31]">
                <h4 className="font-bold text-white text-sm">Forward Message</h4>
                <button 
                  onClick={() => setShowForwardMessage(null)}
                  className="p-1 hover:bg-[#3F4147] rounded text-[#B5BAC1] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                <p className="text-[11px] text-[#949BA4] uppercase font-bold tracking-wider mb-2 px-1">Channels</p>
                {rooms.map(r => (
                  <button 
                    key={r.id} 
                    onClick={() => handleForward(r.id, 'room')}
                    className="w-full text-left p-2.5 hover:bg-[#3F4147] rounded-md text-xs font-semibold text-[#DBDEE1] flex justify-between items-center transition-colors cursor-pointer"
                  >
                    <span>#{r.name}</span>
                    <Forward className="w-3.5 h-3.5 text-[#949BA4]" />
                  </button>
                ))}

                <p className="text-[11px] text-[#949BA4] uppercase font-bold tracking-wider pt-3 mb-2 px-1">Colleagues</p>
                {users.filter(u => u.id !== currentUser.id).map(u => (
                  <button 
                    key={u.id} 
                    onClick={() => handleForward(u.id, 'dm')}
                    className="w-full text-left p-2.5 hover:bg-[#3F4147] rounded-md text-xs font-semibold text-[#DBDEE1] flex justify-between items-center transition-colors cursor-pointer"
                  >
                    <span>{u.username}</span>
                    <Forward className="w-3.5 h-3.5 text-[#949BA4]" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Message Info Modal */}
      <AnimatePresence>
        {showInfoMessage && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#2B2D31] border border-[#1E1F22] w-full max-w-sm rounded-xl overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-[#1E1F22] flex items-center justify-between bg-[#2B2D31]">
                <h4 className="font-bold text-white text-sm">Message Info</h4>
                <button 
                  onClick={() => setShowInfoMessage(null)}
                  className="p-1 hover:bg-[#3F4147] rounded text-[#B5BAC1] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Bubble Preview */}
                <div className="flex justify-end">
                  <div className="bg-[#5865F2] text-white p-3 rounded-tl-xl rounded-bl-xl rounded-br-xl text-xs max-w-xs break-words shadow-sm">
                    {showInfoMessage.content}
                    <p className="text-[9px] text-[#E3E5E8] text-right mt-1.5 select-none">{formatTime(showInfoMessage.timestamp)}</p>
                  </div>
                </div>

                {/* Status Timestamps */}
                <div className="border-t border-[#1E1F22] pt-4 space-y-4 text-xs font-medium text-[#DBDEE1]">
                  <div className="flex items-start gap-3">
                    <CheckCheck className="w-4.5 h-4.5 text-sky-400 stroke-[2.5] mt-0.5" />
                    <div>
                      <p className="font-bold">Read</p>
                      <p className="text-[11px] text-[#949BA4] mt-0.5">
                        {showInfoMessage.status === 'read' && showInfoMessage.readAt 
                          ? new Date(showInfoMessage.readAt).toLocaleString() 
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCheck className="w-4.5 h-4.5 text-zinc-500 mt-0.5" />
                    <div>
                      <p className="font-bold">Delivered</p>
                      <p className="text-[11px] text-[#949BA4] mt-0.5">
                        {showInfoMessage.deliveredAt 
                          ? new Date(showInfoMessage.deliveredAt).toLocaleString() 
                          : new Date(showInfoMessage.timestamp).toLocaleString() /* fallback */}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
