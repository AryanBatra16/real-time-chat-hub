import React, { useState } from "react";
import { User } from "../types";
import { X, Plus, Search, UserCheck, Users } from "lucide-react";

interface MemberModalProps {
  roomId: string;
  members: string[]; // array of userIds currently in room
  allUsers: User[];  // ALL users from DB (online + offline)
  onClose: () => void;
  onAddMember: (roomId: string, userId: string) => void;
  onRemoveMember: (roomId: string, userId: string) => void;
}

export default function MemberModal({
  roomId,
  members,
  allUsers,
  onClose,
  onAddMember,
  onRemoveMember,
}: MemberModalProps) {
  const [search, setSearch] = useState("");

  const getUserById = (id: string) => allUsers.find((u) => u.id === id);

  // Users currently in the room
  const currentMembers = members
    .map((uid) => getUserById(uid))
    .filter(Boolean) as User[];

  // Users NOT yet in the room, filtered by search
  const availableUsers = allUsers
    .filter((u) => !members.includes(u.id))
    .filter((u) =>
      u.username.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="bg-[#2B2D31] rounded-xl w-[420px] max-h-[85vh] flex flex-col shadow-2xl border border-[#1e1f22] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1f22] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-[#5865F2]" />
            <h3 className="text-sm font-bold text-white">Manage Members</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#3F4147] rounded-lg text-[#949BA4] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-5">
          {/* Current Members */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#949BA4] mb-2.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              Current Members ({currentMembers.length})
            </h4>

            {currentMembers.length === 0 ? (
              <p className="text-xs text-[#5C5F66] italic px-1">No members added yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {currentMembers.map((user) => (
                  <li
                    key={user.id}
                    className="flex items-center justify-between bg-[#232428] rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-7 h-7 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/30 flex items-center justify-center text-[10px] font-bold text-[#5865F2]">
                          {user.username.substring(0, 2).toUpperCase()}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#232428] ${
                            user.online ? "bg-[#23A559]" : "bg-[#80848E]"
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#DBDEE1] truncate">{user.username}</p>
                        <p className="text-[10px] text-[#5C5F66]">{user.online ? "Online" : "Offline"}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveMember(roomId, user.id)}
                      className="p-1.5 hover:bg-[#F23F43]/20 rounded-lg text-[#949BA4] hover:text-[#F23F43] transition-colors cursor-pointer flex-shrink-0"
                      title="Remove from room"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[#1e1f22]" />

          {/* Add Members */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#949BA4] mb-2.5 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add Members ({availableUsers.length} available)
            </h4>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5C5F66]" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1E1F22] border border-[#1e1f22] rounded-lg pl-8 pr-3 py-2 text-xs text-[#DBDEE1] placeholder-[#5C5F66] focus:outline-none focus:border-[#5865F2] transition-colors"
              />
            </div>

            {availableUsers.length === 0 ? (
              <p className="text-xs text-[#5C5F66] italic px-1">
                {search ? "No users match your search." : "All users are already members."}
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                {availableUsers.map((user) => (
                  <li
                    key={user.id}
                    className="flex items-center justify-between bg-[#232428] rounded-lg px-3 py-2 hover:bg-[#2E3035] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-7 h-7 rounded-full bg-[#3F4147] border border-[#1e1f22] flex items-center justify-center text-[10px] font-bold text-[#949BA4]">
                          {user.username.substring(0, 2).toUpperCase()}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#232428] ${
                            user.online ? "bg-[#23A559]" : "bg-[#80848E]"
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#DBDEE1] truncate">{user.username}</p>
                        <p className="text-[10px] text-[#5C5F66]">{user.online ? "Online" : "Offline"}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onAddMember(roomId, user.id)}
                      className="p-1.5 hover:bg-[#23A559]/20 rounded-lg text-[#949BA4] hover:text-[#23A559] transition-colors cursor-pointer flex-shrink-0"
                      title="Add to room"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
