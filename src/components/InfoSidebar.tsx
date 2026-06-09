import React, { useState } from "react";
import { User, Room, Message } from "../types";
import { Search, Calendar, ShieldCheck, HelpCircle, FileText, X } from "lucide-react";

interface InfoSidebarProps {
  activeChatId: string;
  activeChatType: 'room' | 'dm';
  rooms: Room[];
  users: User[];
  messages: Message[];
  onClose: () => void;
}

export default function InfoSidebar({
  activeChatId,
  activeChatType,
  rooms,
  users,
  messages,
  onClose
}: InfoSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const activeRoom = activeChatType === 'room' ? rooms.find((r) => r.id === activeChatId) : null;
  const activeDMUser = activeChatType === 'dm' ? users.find((u) => u.id === activeChatId) : null;

  // Filter messages for current context
  const contextMessages = messages.filter((m) => {
    if (activeChatType === 'room') {
      return m.roomId === activeChatId;
    } else {
      return m.receiverId === activeChatId || m.senderId === activeChatId;
    }
  });

  // Filter search matches
  const searchResults = searchQuery.trim()
    ? contextMessages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <aside id="info-sidebar-container" className="w-68 bg-[#2B2D31] border-l border-[#1e1f22] flex flex-col h-full flex-shrink-0 hidden lg:flex">
      {/* Header */}
      <div className="h-12 border-b border-[#1e1f22] px-4 flex items-center justify-between bg-[#2B2D31] flex-shrink-0">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#949BA4]">Hub Information</h4>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[#3F4147] rounded text-[#949BA4] hover:text-white transition-colors cursor-pointer"
          title="Collapse Information bar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        {/* About section */}
        <div className="space-y-3">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#949BA4]">About Context</h5>
          <div className="bg-[#1E1F22] p-3.5 rounded-lg border border-[#1e1f22]/40">
            {activeRoom ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-white">#{activeRoom.name}</p>
                <p className="text-xs text-[#949BA4] leading-relaxed font-medium">{activeRoom.description}</p>
              </div>
            ) : activeDMUser ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border border-zinc-800/20 ${activeDMUser.color}`}>
                    {activeDMUser.username.substring(0, 2).toUpperCase()}
                  </div>
                  <p className="text-xs font-bold text-white">{activeDMUser.username}</p>
                </div>
                <p className="text-xs text-[#949BA4] leading-relaxed font-medium">
                  Direct conversation with user. {activeDMUser.online ? "Currently active and connected." : "Offline right now."}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Message search engine */}
        <div className="space-y-3">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#949BA4]">Search Chat History</h5>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#949BA4]" />
            <input
              type="text"
              placeholder="Search terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1E1F22] border-none rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-650 focus:outline-none"
            />
          </div>

          {searchQuery && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {searchResults.length === 0 ? (
                <p className="text-[11px] text-zinc-600 italic">No matches found for "{searchQuery}"</p>
              ) : (
                searchResults.map((m) => (
                  <div key={m.id} className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#1e1f22]/40 text-[11.5px] space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-[#949BA4]">
                      <span className="font-bold text-white">{m.senderName}</span>
                      <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[#DBDEE1] break-words leading-normal">{m.content}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Dynamic Channel members/Online participants */}
        <div className="space-y-3">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#949BA4]">Hub Channels & Users</h5>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-[#949BA4]">
              <ShieldCheck className="w-4 h-4 text-[#23A559]" />
              <span className="font-medium">Full-mesh Socket.io presence enabled.</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#949BA4]">
              <Calendar className="w-4 h-4 text-[#949BA4]" />
              <span className="font-medium">Session started: {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
