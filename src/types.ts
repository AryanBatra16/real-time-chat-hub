export interface User {
  id: string; // Socket ID
  username: string;
  email?: string;
  online: boolean;
  lastSeen?: string;
  avatarUrl: string;
  color: string; // Custom Tailwind color class or hex string for visually polished indicator
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  receiverId?: string; // Present if DM
  roomId?: string; // Present if group room
  content: string;
  timestamp: string; // ISO string
  status: 'sent' | 'delivered' | 'read';
  readBy?: string[]; // List of user IDs who have read this group message
  replyToId?: string;
  replyToName?: string;
  replyToContent?: string;
  isStarred?: boolean;
  deliveredAt?: string;
  readAt?: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  isPrivate?: boolean;
}

export interface TypingStatus {
  userId: string;
  username: string;
  targetId: string; // roomId or userDmId
  isTyping: boolean;
}

export interface PresenceEvent {
  type: 'join' | 'leave' | 'list';
  users: User[];
  user?: User; // The user who joined or left
}
