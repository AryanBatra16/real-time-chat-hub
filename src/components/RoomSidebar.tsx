import React, { useState } from "react";
import { User, Room } from "../types";
import { Hash, MessageSquare, Plus, Check, X, ShieldAlert, LogOut, Search, UserPlus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatLastSeen } from "../utils/formatTime";

interface RoomSidebarProps {
  currentUser: User;
  users: User[];
  rooms: Room[];
  activeChatId: string; // Could be roomId or userId for DM
  activeChatType: 'room' | 'dm';
  unreadCounts: Record<string, number>;
  onSelectChat: (id: string, type: 'room' | 'dm') => void;
  onCreateRoom: (name: string, description: string) => Promise<boolean>;
  onAddMembers: (roomId: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onLogout: () => void;
}

export default function RoomSidebar({
  currentUser,
  users,
  rooms,
  activeChatId,
  activeChatType,
  unreadCounts,
  onSelectChat,
  onCreateRoom,
  onAddMembers,
  onDeleteRoom,
  onLogout
}: RoomSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [createError, setCreateError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const otherUsers = users.filter((u) => u.id !== currentUser.id);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    const trimmedName = newRoomName.trim();
    if (!trimmedName) {
      setCreateError("Name required");
      return;
    }
    if (trimmedName.includes(" ")) {
      setCreateError("No spaces allowed");
      return;
    }
    const success = await onCreateRoom(trimmedName, newRoomDesc);
    if (success) {
      setNewRoomName("");
      setNewRoomDesc("");
      setIsCreating(false);
    } else {
      setCreateError("Name taken or failed");
    }
  };

  // Extract initials from username for gorgeous avatar letters
  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const filteredUsers = otherUsers.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside id="room-sidebar-container" className="w-68 bg-[#2B2D31] border-r border-[#1e1f22] flex flex-col h-full flex-shrink-0">
      {/* Sleek Header Title */}
      <header className="h-12 px-3 shadow-sm border-b border-[#1e1f22] flex items-center gap-2.5 flex-shrink-0 bg-[#2B2D31]">
        <img src="/collabspace_logo.png" alt="Logo" className="w-8 h-8 object-contain rounded-lg shadow-sm shadow-[#5865F2]/10" />
        <span className="font-bold text-white tracking-tight text-base">CollabSpace</span>
      </header>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {/* Rooms / Channels Section */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#949BA4] mb-2 px-1">
            <span>Rooms ({rooms.length})</span>
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="p-1 hover:bg-[#3F4147] rounded text-white transition-all cursor-pointer"
              title="Create new collaboration channel"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          {/* Create Room Inline Slide-down */}
          <AnimatePresence>
            {isCreating && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-[#1E1F22] p-3 rounded-lg border border-[#2b2d31] mb-3 space-y-2.5"
                onSubmit={handleCreateRoom}
              >
                <div>
                  <input
                    type="text"
                    placeholder="room-name (no spaces)"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value.toLowerCase().replace(/^#+/, ""))}
                    maxLength={20}
                    className="w-full bg-[#2B2D31] border border-[#1e1f22] rounded py-1.5 px-3 text-xs text-[#DBDEE1] placeholder-zinc-650 focus:outline-none focus:border-[#5865F2]"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Short room description..."
                    value={newRoomDesc}
                    onChange={(e) => setNewRoomDesc(e.target.value)}
                    maxLength={100}
                    className="w-full bg-[#2B2D31] border border-[#1e1f22] rounded py-1.5 px-3 text-xs text-[#DBDEE1] placeholder-zinc-650 focus:outline-none focus:border-[#5865F2]"
                  />
                </div>
                {createError && (
                  <p className="text-[10px] text-rose-400 font-medium flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    <span>{createError}</span>
                  </p>
                )}
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-2.5 py-1 text-[11px] text-[#949BA4] hover:text-white font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3 py-1 bg-[#5865F2] hover:bg-opacity-90 text-white font-semibold rounded text-[11px] cursor-pointer shadow-sm transition-colors"
                  >
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    <span>Create</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="space-y-[2px]">
            {rooms.map((room) => {
              const isActive = activeChatType === 'room' && activeChatId === room.id;
              const unread = unreadCounts[room.id] || 0;

              return (
                <button
                  key={room.id}
                  onClick={() => onSelectChat(room.id, "room")}
                  className={`w-full text-left py-2 px-2.5 rounded-md flex items-center justify-between text-sm transition-all group cursor-pointer relative ${
                    isActive
                      ? "bg-[#3F4147] text-white font-medium shadow-sm"
                      : "text-[#949BA4] hover:bg-[#35373C] hover:text-[#DBDEE1]"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Hash className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-[#949BA4] group-hover:text-[#DBDEE1]"}`} />
                    <span className="truncate">{room.name}</span>
                  </div>
                  
                  {unread > 0 && (
                    <span className="bg-[#F23F43] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0 shadow-sm">
                      {unread}
                    </span>
                  )}
                  <div className="flex items-center gap-1 ml-2">
                    <UserPlus
                      className="w-4 h-4 text-[#949BA4] hover:text-white"
                      onClick={(e) => { e.stopPropagation(); onAddMembers(room.id); }}
                    />
                    <Trash2
                      className="w-4 h-4 text-[#F23F43] hover:text-white"
                      onClick={(e) => { e.stopPropagation(); onDeleteRoom(room.id); }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Direct Messages Section */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#949BA4] mb-2 px-1 flex items-center justify-between">
            <span>Direct Messages ({otherUsers.filter(u=>u.online).length})</span>
          </div>

          {/* Quick search online roster */}
          <div className="relative mb-3.5">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#949BA4]" />
            <input
              type="text"
              placeholder="Filter online users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1E1F22] border-none rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-650 focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-[2px]">
            {filteredUsers.length === 0 ? (
              <p className="text-[11px] text-zinc-600 text-center py-4 italic border border-dashed border-[#35373C] rounded-lg">
                No active users found.
              </p>
            ) : (
              filteredUsers.map((u) => {
                const isActive = activeChatType === 'dm' && activeChatId === u.id;
                const unread = unreadCounts[u.id] || 0;

                return (
                  <button
                    key={u.id}
                    onClick={() => onSelectChat(u.id, "dm")}
                    className={`w-full text-left py-1.5 px-2.5 rounded-md flex items-center justify-between text-sm transition-all group cursor-pointer relative ${
                      isActive
                        ? "bg-[#3F4147] text-white font-medium shadow-sm"
                        : "text-[#949BA4] hover:bg-[#35373C] hover:text-[#DBDEE1]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="relative flex-shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border border-zinc-800/10 ${u.color}`}>
                          {getInitials(u.username)}
                        </div>
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#2B2D31] ${
                          u.online ? "bg-[#23A559]" : "bg-[#80848E]"
                        }`} />
                      </div>
                      <div className="truncate flex flex-col justify-center">
                        <span className="truncate leading-tight text-sm">{u.username}</span>
                        {!u.online && u.lastSeen && (
                          <span className="text-[10px] text-[#949BA4] leading-normal font-medium truncate">
                            {formatLastSeen(u.lastSeen)}
                          </span>
                        )}
                      </div>
                    </div>

                    {unread > 0 && (
                      <span className="bg-[#F23F43] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0 shadow-sm">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* User Profile Footer Bottom Section */}
      <footer className="h-14 bg-[#232428] px-3 flex items-center justify-between gap-1 border-t border-[#1e1f22] flex-shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="relative flex-shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border border-zinc-850 shadow-inner ${currentUser.color}`}>
              {getInitials(currentUser.username)}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#23A559] border-2 border-[#232428] rounded-full animate-pulse" />
          </div>
          <div className="overflow-hidden">
            <h4 className="text-xs font-bold text-white truncate leading-tight">{currentUser.username}</h4>
            <span className="text-[10px] text-[#949BA4] font-semibold uppercase tracking-wide">Online</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Exit Hub and sign out"
          className="p-1.5 bg-transparent hover:bg-[#3F4147] rounded-md text-[#B5BAC1] hover:text-white transition-colors cursor-pointer flex-shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </footer>
    </aside>
  );
}
