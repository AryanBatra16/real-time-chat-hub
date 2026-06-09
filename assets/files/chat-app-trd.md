# Technical Requirements Document (TRD)
## Real-Time Chat Application
**Version:** 1.0
**Timeline:** 24 hours
**Node:** 22.x | **npm:** 11.6.2
**Dev mode:** Concurrently (single root `npm run dev`)
**Deployment:** Vercel (client) + Render (server)

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Monorepo Setup & Package Configuration](#2-monorepo-setup--package-configuration)
3. [Environment Variables](#3-environment-variables)
4. [Server — Technical Specification](#4-server--technical-specification)
5. [Client — Technical Specification](#5-client--technical-specification)
6. [Socket.IO — Protocol & Transport Layer](#6-socketio--protocol--transport-layer)
7. [State Management Architecture](#7-state-management-architecture)
8. [LocalStorage — Persistence Layer](#8-localstorage--persistence-layer)
9. [Read Receipts — Implementation Detail](#9-read-receipts--implementation-detail)
10. [Typing Indicator — Implementation Detail](#10-typing-indicator--implementation-detail)
11. [CSS Architecture & Theming](#11-css-architecture--theming)
12. [Deployment Configuration](#12-deployment-configuration)
13. [Error Handling Strategy](#13-error-handling-strategy)
14. [Performance Constraints](#14-performance-constraints)
15. [Complete File Bootstrapping Guide](#15-complete-file-bootstrapping-guide)

---

## 1. System Architecture

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Vercel)                          │
│   React 18 + Vite 5                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│   │SocketContext │  │ ChatContext  │  │  localStorage       │  │
│   │ (socket.io-  │  │ (all chat    │  │  (username +        │  │
│   │  client)     │  │  state)      │  │   history)          │  │
│   └──────┬───────┘  └──────────────┘  └─────────────────────┘  │
└──────────┼──────────────────────────────────────────────────────┘
           │  WebSocket (WSS in prod, WS in dev)
           │  Polling fallback: HTTP long-poll
           │
┌──────────┼──────────────────────────────────────────────────────┐
│          │             SERVER (Render)                          │
│   ┌──────▼───────┐                                              │
│   │  Socket.IO   │  ← handles all real-time events              │
│   │  Server      │                                              │
│   └──────┬───────┘                                              │
│          │                                                       │
│   ┌──────▼────────────────────────────────────────────────┐     │
│   │                 inMemoryStore.js                       │     │
│   │  users: Map      dms: Map      groups: Map            │     │
│   │  gMessages: Map  typingTimers: Map                    │     │
│   └───────────────────────────────────────────────────────┘     │
│                                                                  │
│   Express (serves health check + optional static in prod)        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Transport

| Environment | Protocol | Fallback |
|---|---|---|
| Development | `ws://localhost:3001` | HTTP long-poll |
| Production | `wss://your-app.onrender.com` | HTTP long-poll |

Socket.IO automatically upgrades from HTTP long-poll → WebSocket on first connection. This matters for Render — the free tier supports WebSockets natively. No extra config needed.

### 1.3 Concurrently Setup (Root)

```
/  (root)
├── package.json          ← root scripts only, no dependencies
├── client/               ← Vite React app
├── server/               ← Node Express + Socket.IO
├── .env.example
└── README.md
```

Root `package.json` uses `concurrently` to start both processes:

```json
{
  "name": "chat-app-root",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently -n CLIENT,SERVER -c cyan,green \"npm run dev --prefix client\" \"npm run dev --prefix server\"",
    "build": "npm run build --prefix client",
    "install:all": "npm install && npm install --prefix client && npm install --prefix server"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

Single command to install everything: `npm run install:all`
Single command to run dev: `npm run dev`

---

## 2. Monorepo Setup & Package Configuration

### 2.1 server/package.json

```json
{
  "name": "chat-app-server",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "socket.io": "^4.7.5",
    "uuid": "^10.0.0"
  }
}
```

> `node --watch` is built into Node 18+. No nodemon needed. On Node 22 it is stable.

### 2.2 client/package.json

```json
{
  "name": "chat-app-client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "socket.io-client": "^4.7.5"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

### 2.3 client/vite.config.js

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,              // proxy WebSocket upgrade
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
```

The `proxy` block is critical for dev: it avoids CORS issues entirely. The client calls `/socket.io` (same origin), Vite proxies to `localhost:3001`. In production, the client calls the full Render URL directly.

---

## 3. Environment Variables

### 3.1 server/.env

```env
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

### 3.2 client/.env

```env
VITE_SERVER_URL=http://localhost:3001
```

> In development, `VITE_SERVER_URL` is not used directly — Vite proxy handles routing. It IS used in production build.

### 3.3 client/.env.production

```env
VITE_SERVER_URL=https://your-app-name.onrender.com
```

Vercel automatically uses `.env.production` values during build. Alternatively set them in Vercel dashboard → Project Settings → Environment Variables.

### 3.4 .env.example (root)

```env
# Server
PORT=3001
CLIENT_ORIGIN=http://localhost:5173

# Client (Vite prefix required)
VITE_SERVER_URL=http://localhost:3001
```

### 3.5 Accessing env vars

```js
// Server (Node — process.env)
const PORT = process.env.PORT || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

// Client (Vite — import.meta.env)
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
```

> Never use `process.env` in Vite/React code. It does not exist at runtime. Always use `import.meta.env.VITE_*`.

---

## 4. Server — Technical Specification

### 4.1 Entry Point: server/src/index.js

```js
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { registerUserHandlers } from './handlers/userHandlers.js'
import { registerMessageHandlers } from './handlers/messageHandlers.js'
import { registerGroupHandlers } from './handlers/groupHandlers.js'

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,       // 60s before considering connection dead
  pingInterval: 25000,      // heartbeat every 25s
  transports: ['websocket', 'polling']  // prefer WS, fall back to polling
})

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

// Health check — Render pings this to keep the instance alive
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }))

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`)
  registerUserHandlers(io, socket)
  registerMessageHandlers(io, socket)
  registerGroupHandlers(io, socket)
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`))
```

### 4.2 In-Memory Store: server/src/store/inMemoryStore.js

```js
// users: Map<socketId, UserObject>
export const users = new Map()

// dms: Map<"sortedUid1:sortedUid2", Message[]>
// Key is always the two user IDs sorted alphabetically and joined with ":"
export const dms = new Map()

// groups: Map<groupId, GroupObject>
export const groups = new Map()

// gMessages: Map<groupId, GroupMessage[]>
export const gMessages = new Map()

// typingTimers: Map<"userId:targetId", TimeoutId>
// Used server-side to auto-clear stale typing states
export const typingTimers = new Map()

// --- Helper: get DM key (always sorted so A:B === B:A) ---
export function getDMKey(uid1, uid2) {
  return [uid1, uid2].sort().join(':')
}

// --- Helper: find user by userId (not socketId) ---
export function findUserById(userId) {
  for (const user of users.values()) {
    if (user.id === userId) return user
  }
  return null
}

// --- Helper: get all users as array (excluding optional socketId) ---
export function getUserList(excludeSocketId = null) {
  return Array.from(users.values())
    .filter(u => u.socketId !== excludeSocketId)
    .map(u => ({
      id: u.id,
      username: u.username,
      isOnline: u.isOnline,
      lastSeen: u.lastSeen
    }))
}
```

### 4.3 User Handlers: server/src/handlers/userHandlers.js

```js
import { v4 as uuidv4 } from 'uuid'
import { users, getUserList, dms, getDMKey, gMessages, groups } from '../store/inMemoryStore.js'
import { validateUsername } from '../utils/validators.js'

export function registerUserHandlers(io, socket) {

  // ── user:join ──────────────────────────────────────────────────
  socket.on('user:join', ({ username }) => {
    const error = validateUsername(username)
    if (error) return socket.emit('error', { code: 'INVALID_USERNAME', message: error })

    // Check username uniqueness among online users
    const taken = Array.from(users.values()).find(
      u => u.username.toLowerCase() === username.trim().toLowerCase() && u.isOnline
    )
    if (taken) return socket.emit('error', { code: 'USERNAME_TAKEN', message: 'This name is already taken' })

    const user = {
      id: uuidv4(),
      username: username.trim(),
      socketId: socket.id,
      isOnline: true,
      joinedAt: Date.now(),
      lastSeen: null
    }
    users.set(socket.id, user)

    // Send current user list to joining user
    socket.emit('users:list', { users: getUserList(socket.id) })

    // Send all DM history this user has (matched by username for localStorage reconnect)
    // This is a best-effort lookup — primary history comes from localStorage
    const dmHistory = {}
    for (const [key, messages] of dms.entries()) {
      if (key.includes(user.id)) {
        dmHistory[key] = messages
      }
    }
    socket.emit('history:dm', { dmHistory })

    // Send group memberships + history
    const userGroups = Array.from(groups.values()).filter(g => g.members.includes(user.id))
    userGroups.forEach(group => {
      socket.join(group.id)
    })
    socket.emit('history:groups', {
      groups: userGroups,
      messages: Object.fromEntries(
        userGroups.map(g => [g.id, gMessages.get(g.id) || []])
      )
    })

    // Broadcast new user to everyone else
    socket.broadcast.emit('user:joined', {
      user: { id: user.id, username: user.username, isOnline: true, lastSeen: null }
    })

    // Confirm join to the socket itself
    socket.emit('user:join:ack', { user })

    console.log(`User joined: ${user.username} (${user.id})`)
  })

  // ── disconnect ─────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const user = users.get(socket.id)
    if (!user) return

    user.isOnline = false
    user.lastSeen = Date.now()
    // Keep user in Map for lastSeen lookups — don't delete
    users.set(socket.id, user)

    io.emit('user:offline', { userId: user.id, lastSeen: user.lastSeen })
    console.log(`User disconnected: ${user.username}`)
  })
}
```

### 4.4 Message Handlers: server/src/handlers/messageHandlers.js

```js
import { v4 as uuidv4 } from 'uuid'
import { users, dms, getDMKey, findUserById } from '../store/inMemoryStore.js'
import { validateMessage } from '../utils/validators.js'

const MAX_DM_HISTORY = 200

export function registerMessageHandlers(io, socket) {

  // ── message:direct ─────────────────────────────────────────────
  socket.on('message:direct', ({ recipientId, content }) => {
    const sender = users.get(socket.id)
    if (!sender) return socket.emit('error', { code: 'NOT_JOINED', message: 'You have not joined yet' })

    const contentError = validateMessage(content)
    if (contentError) return socket.emit('error', { code: 'INVALID_MESSAGE', message: contentError })

    const recipient = findUserById(recipientId)
    if (!recipient) return socket.emit('error', { code: 'USER_NOT_FOUND', message: 'User not found' })

    const message = {
      id: uuidv4(),
      senderId: sender.id,
      recipientId,
      content: content.trim(),
      timestamp: Date.now(),
      status: 'sent'
    }

    // Store in memory
    const key = getDMKey(sender.id, recipientId)
    if (!dms.has(key)) dms.set(key, [])
    const history = dms.get(key)
    history.push(message)
    if (history.length > MAX_DM_HISTORY) history.shift()

    // Ack to sender
    socket.emit('message:direct:sent', { message })

    // Deliver to recipient if online
    if (recipient.isOnline && recipient.socketId) {
      io.to(recipient.socketId).emit('message:direct:receive', { message })
      // Auto-mark as delivered
      message.status = 'delivered'
      socket.emit('message:direct:delivered', { messageId: message.id })
    }
  })

  // ── message:direct:read ────────────────────────────────────────
  // Fired when the recipient opens the DM chat window
  socket.on('message:direct:read', ({ senderId, messageIds }) => {
    const reader = users.get(socket.id)
    if (!reader) return

    const sender = findUserById(senderId)

    // Update status in store
    const key = getDMKey(reader.id, senderId)
    const history = dms.get(key) || []
    messageIds.forEach(id => {
      const msg = history.find(m => m.id === id)
      if (msg) msg.status = 'read'
    })

    // Notify the original sender
    if (sender?.isOnline && sender.socketId) {
      io.to(sender.socketId).emit('message:direct:read:ack', {
        messageIds,
        readBy: reader.id
      })
    }
  })
}
```

### 4.5 Group Handlers: server/src/handlers/groupHandlers.js

```js
import { v4 as uuidv4 } from 'uuid'
import { users, groups, gMessages, findUserById } from '../store/inMemoryStore.js'
import { validateGroupName, validateMessage } from '../utils/validators.js'

const MAX_GROUP_HISTORY = 200

export function registerGroupHandlers(io, socket) {

  // ── group:create ───────────────────────────────────────────────
  socket.on('group:create', ({ name, memberIds }) => {
    const creator = users.get(socket.id)
    if (!creator) return socket.emit('error', { code: 'NOT_JOINED', message: 'Join first' })

    const nameError = validateGroupName(name)
    if (nameError) return socket.emit('error', { code: 'INVALID_GROUP_NAME', message: nameError })

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return socket.emit('error', { code: 'NO_MEMBERS', message: 'Add at least one member' })
    }

    const allMemberIds = [...new Set([creator.id, ...memberIds])]

    const group = {
      id: uuidv4(),
      name: name.trim(),
      createdBy: creator.id,
      members: allMemberIds,
      createdAt: Date.now()
    }
    groups.set(group.id, group)
    gMessages.set(group.id, [])

    // Join all online members to the Socket.IO room
    allMemberIds.forEach(uid => {
      const member = findUserById(uid)
      if (member?.isOnline && member.socketId) {
        io.sockets.sockets.get(member.socketId)?.join(group.id)
        io.to(member.socketId).emit('group:created', { group, messages: [] })
      }
    })
  })

  // ── group:message ──────────────────────────────────────────────
  socket.on('group:message', ({ groupId, content }) => {
    const sender = users.get(socket.id)
    if (!sender) return socket.emit('error', { code: 'NOT_JOINED', message: 'Join first' })

    const group = groups.get(groupId)
    if (!group) return socket.emit('error', { code: 'GROUP_NOT_FOUND', message: 'Group not found' })

    if (!group.members.includes(sender.id)) {
      return socket.emit('error', { code: 'NOT_MEMBER', message: 'You are not a member of this group' })
    }

    const contentError = validateMessage(content)
    if (contentError) return socket.emit('error', { code: 'INVALID_MESSAGE', message: contentError })

    const message = {
      id: uuidv4(),
      groupId,
      senderId: sender.id,
      senderUsername: sender.username,
      content: content.trim(),
      timestamp: Date.now(),
      readBy: [sender.id]    // sender has "read" their own message
    }

    const history = gMessages.get(groupId)
    history.push(message)
    if (history.length > MAX_GROUP_HISTORY) history.shift()

    // Broadcast to all room members (including sender for consistency)
    io.to(groupId).emit('group:message:receive', { message })
  })

  // ── group:message:read ─────────────────────────────────────────
  // Fired when a member opens the group chat
  socket.on('group:message:read', ({ groupId, messageIds }) => {
    const reader = users.get(socket.id)
    if (!reader) return

    const group = groups.get(groupId)
    if (!group || !group.members.includes(reader.id)) return

    const history = gMessages.get(groupId) || []
    messageIds.forEach(msgId => {
      const msg = history.find(m => m.id === msgId)
      if (msg && !msg.readBy.includes(reader.id)) {
        msg.readBy.push(reader.id)
      }
    })

    // Broadcast read update to all group members
    io.to(groupId).emit('group:message:read:ack', {
      groupId,
      messageIds,
      readBy: reader.id,
      readByUsername: reader.username
    })
  })
}
```

### 4.6 Validators: server/src/utils/validators.js

```js
export function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'Username is required'
  const trimmed = username.trim()
  if (trimmed.length < 2) return 'Username must be at least 2 characters'
  if (trimmed.length > 24) return 'Username must be under 24 characters'
  if (!/^[a-zA-Z0-9 _]+$/.test(trimmed)) return 'Only letters, numbers, spaces and underscores allowed'
  return null
}

export function validateMessage(content) {
  if (!content || typeof content !== 'string') return 'Message cannot be empty'
  const trimmed = content.trim()
  if (trimmed.length === 0) return 'Message cannot be empty'
  if (trimmed.length > 2000) return 'Message cannot exceed 2000 characters'
  return null
}

export function validateGroupName(name) {
  if (!name || typeof name !== 'string') return 'Group name is required'
  const trimmed = name.trim()
  if (trimmed.length < 2) return 'Group name must be at least 2 characters'
  if (trimmed.length > 32) return 'Group name must be under 32 characters'
  return null
}
```

---

## 5. Client — Technical Specification

### 5.1 client/src/main.jsx

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

### 5.2 client/src/App.jsx

```jsx
import { SocketProvider } from './context/SocketContext'
import { ChatProvider } from './context/ChatContext'
import { useChat } from './context/ChatContext'
import LoginScreen from './components/auth/LoginScreen'
import AppLayout from './components/layout/AppLayout'

function AppInner() {
  const { currentUser } = useChat()
  return currentUser ? <AppLayout /> : <LoginScreen />
}

export default function App() {
  return (
    <SocketProvider>
      <ChatProvider>
        <AppInner />
      </ChatProvider>
    </SocketProvider>
  )
}
```

### 5.3 Component Responsibilities

| Component | Responsibility | Key props/hooks used |
|---|---|---|
| `LoginScreen` | Username input, validation, emit `user:join` | `useChat`, `useSocket` |
| `AppLayout` | Two-column grid, mobile hamburger state | `useChat` |
| `Sidebar` | User list + group list + create group button | `useChat` |
| `UserAvatar` | Initials circle, color from username hash | `username`, `size` |
| `UserList` | Renders online/offline users, unread badges | `useChat` |
| `GroupList` | Renders user's groups, unread badges | `useChat` |
| `CreateGroupModal` | Group name input + member checkboxes | `useChat`, `useSocket` |
| `ChatWindow` | Switches between DM and group chat view | `useChat` |
| `MessageBubble` | Single message with timestamp + read receipt | `message`, `isSent` |
| `ReadReceipt` | SVG tick icons (sent/delivered/read) | `status` (DM) or `readBy[]` (group) |
| `TypingIndicator` | Animated dots + "{name} is typing..." | `useChat` |
| `MessageInput` | Textarea + send, emits typing events | `useChat`, `useTyping` |
| `Modal` | Reusable overlay wrapper | `isOpen`, `onClose`, `children` |
| `EmptyState` | Placeholder when no chat selected | `icon`, `title`, `subtitle` |
| `Toast` | Error/info notifications, auto-dismiss | `useChat` (toastQueue state) |

### 5.4 client/src/utils/validators.js

```js
// Mirror of server validators — always validate client-side first
export const validateUsername = (v) => {
  if (!v?.trim()) return 'Username is required'
  if (v.trim().length < 2) return 'At least 2 characters'
  if (v.trim().length > 24) return 'Max 24 characters'
  if (!/^[a-zA-Z0-9 _]+$/.test(v.trim())) return 'Letters, numbers, spaces, underscores only'
  return null
}

export const validateMessage = (v) => {
  if (!v?.trim()) return 'empty'
  if (v.trim().length > 2000) return 'Max 2000 characters'
  return null
}

export const validateGroupName = (v) => {
  if (!v?.trim()) return 'Group name is required'
  if (v.trim().length < 2) return 'At least 2 characters'
  if (v.trim().length > 32) return 'Max 32 characters'
  return null
}
```

### 5.5 client/src/utils/formatTime.js

```js
export function formatMessageTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatLastSeen(timestamp) {
  if (!timestamp) return 'a while ago'
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `today at ${formatMessageTime(timestamp)}`
  if (hours < 48) return `yesterday at ${formatMessageTime(timestamp)}`
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function formatDateSeparator(timestamp) {
  const d = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

// Deterministic color from username (for avatar + sender label color)
export function getUserColor(username) {
  const colors = ['#7289da','#43b581','#faa61a','#f04747','#b9bbbe',
                  '#1abc9c','#e91e63','#9c27b0','#00bcd4','#ff5722']
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
```

---

## 6. Socket.IO — Protocol & Transport Layer

### 6.1 Client Socket Initialization

```js
// context/SocketContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

const SocketContext = createContext(null)
export const useSocket = () => useContext(SocketContext)

export function SocketProvider({ children }) {
  const socketRef = useRef(null)
  const [status, setStatus] = useState('disconnected') // 'disconnected'|'connecting'|'connected'

  useEffect(() => {
    const socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling']
    })

    socket.on('connect',    () => setStatus('connected'))
    socket.on('disconnect', () => setStatus('disconnected'))
    socket.on('connect_error', () => setStatus('error'))

    socketRef.current = socket
    return () => socket.disconnect()
  }, [])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, status }}>
      {children}
    </SocketContext.Provider>
  )
}
```

### 6.2 Complete Event Flow Diagrams

**DM Send Flow:**
```
CLIENT A                    SERVER                      CLIENT B
   │                           │                           │
   │─── message:direct ───────►│                           │
   │    {recipientId, content} │                           │
   │                           │ store in dms Map          │
   │◄── message:direct:sent ───│                           │
   │    {message{status:sent}} │                           │
   │                           │─── message:direct ───────►│
   │                           │     :receive              │
   │◄── message:direct ────────│    {message}              │
   │     :delivered            │                           │
   │    {messageId}            │                           │
   │                           │                           │
   │                           │◄── message:direct:read ───│
   │                           │    {senderId,messageIds}  │
   │                           │ update status='read'      │
   │◄── message:direct ────────│                           │
   │     :read:ack             │                           │
   │    {messageIds,readBy}    │                           │
```

**Group Message Flow:**
```
CLIENT A                    SERVER                  ALL GROUP MEMBERS
   │                           │                           │
   │─── group:message ────────►│                           │
   │    {groupId, content}     │ validate membership       │
   │                           │ store in gMessages        │
   │                           │─── group:message ────────►│
   │                           │     :receive              │
   │                           │    {message}              │
   │                           │                           │
   │                           │◄── group:message:read ────│
   │                           │    {groupId, messageIds}  │
   │                           │ push readerId to readBy[] │
   │                           │─── group:message ────────►│
   │                           │     :read:ack             │
   │                           │    {messageIds, readBy}   │
```

### 6.3 Reconnection Strategy

On Socket.IO auto-reconnect, the server creates a new socket with a new `socket.id`. The old user entry in the Map is still there (marked offline). The client must re-emit `user:join` to register again:

```js
// In ChatContext — listen for reconnect and re-join
socket.on('connect', () => {
  if (currentUser) {
    socket.emit('user:join', { username: currentUser.username })
  }
})
```

---

## 7. State Management Architecture

### 7.1 ChatContext Full Shape

```js
// context/ChatContext.jsx — state shape reference

const initialState = {
  currentUser: null,            // { id, username, socketId }
  users: [],                    // all users (online + offline)
  groups: [],                   // groups current user is member of
  dmHistory: {},                // { [userId]: Message[] }
  groupHistory: {},             // { [groupId]: Message[] }
  activeChatId: null,           // userId or groupId
  activeChatType: null,         // 'dm' | 'group'
  unreadCounts: {},             // { [chatId]: number }
  typingUsers: {},              // { [chatId]: string[] } — array of usernames
  toastQueue: [],               // { id, message, type }[]
  connectionStatus: 'disconnected'
}
```

### 7.2 useReducer Action Types

```js
export const ACTION = {
  SET_CURRENT_USER:         'SET_CURRENT_USER',
  SET_USERS:                'SET_USERS',
  USER_JOINED:              'USER_JOINED',
  USER_OFFLINE:             'USER_OFFLINE',
  SET_ACTIVE_CHAT:          'SET_ACTIVE_CHAT',
  DM_RECEIVED:              'DM_RECEIVED',
  DM_SENT:                  'DM_SENT',
  DM_DELIVERED:             'DM_DELIVERED',
  DM_READ_ACK:              'DM_READ_ACK',
  GROUP_CREATED:            'GROUP_CREATED',
  GROUP_MESSAGE_RECEIVED:   'GROUP_MESSAGE_RECEIVED',
  GROUP_READ_ACK:           'GROUP_READ_ACK',
  LOAD_DM_HISTORY:          'LOAD_DM_HISTORY',
  LOAD_GROUP_HISTORY:       'LOAD_GROUP_HISTORY',
  SET_TYPING:               'SET_TYPING',
  CLEAR_TYPING:             'CLEAR_TYPING',
  CLEAR_UNREAD:             'CLEAR_UNREAD',
  ADD_TOAST:                'ADD_TOAST',
  REMOVE_TOAST:             'REMOVE_TOAST',
  SET_CONNECTION_STATUS:    'SET_CONNECTION_STATUS'
}
```

### 7.3 Key Reducer Cases

```js
// Unread count logic — increment only when chat is NOT active
case ACTION.DM_RECEIVED: {
  const { message } = action.payload
  const chatId = message.senderId
  const isActive = state.activeChatId === chatId && state.activeChatType === 'dm'
  return {
    ...state,
    dmHistory: {
      ...state.dmHistory,
      [chatId]: [...(state.dmHistory[chatId] || []), message]
    },
    unreadCounts: isActive ? state.unreadCounts : {
      ...state.unreadCounts,
      [chatId]: (state.unreadCounts[chatId] || 0) + 1
    }
  }
}

// Typing — add username to array, dedup
case ACTION.SET_TYPING: {
  const { chatId, username } = action.payload
  const current = state.typingUsers[chatId] || []
  return {
    ...state,
    typingUsers: {
      ...state.typingUsers,
      [chatId]: current.includes(username) ? current : [...current, username]
    }
  }
}
```

---

## 8. LocalStorage — Persistence Layer

### 8.1 Keys Used

```
chat_username          → string
chat_dm_history        → JSON string of { [userId]: Message[] }
chat_group_history     → JSON string of { [groupId]: GroupMessage[] }
```

### 8.2 useLocalStorage Hook

```js
// hooks/useLocalStorage.js
import { useState } from 'react'

export function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = (value) => {
    try {
      const toStore = value instanceof Function ? value(stored) : value
      setStored(toStore)
      localStorage.setItem(key, JSON.stringify(toStore))
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        // Evict oldest 50% of messages and retry
        console.warn('localStorage quota exceeded — evicting old messages')
        evictOldMessages(key)
      }
    }
  }

  return [stored, setValue]
}

function evictOldMessages(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return
    const history = JSON.parse(raw)
    const evicted = {}
    for (const [id, msgs] of Object.entries(history)) {
      evicted[id] = msgs.slice(-50)  // keep last 50 per conversation
    }
    localStorage.setItem(key, JSON.stringify(evicted))
  } catch { /* silent fail */ }
}
```

### 8.3 Merge Strategy on Reconnect

```
App loads
    │
    ├─ Read localStorage → populate ChatContext immediately
    │   (user sees past messages before socket connects)
    │
    ├─ Socket connects → emit user:join
    │
    ├─ Server sends history:dm and history:groups
    │
    └─ Merge: for each conversation,
         combine localStorage messages + server messages,
         deduplicate by message.id (Set on ids),
         sort by timestamp ascending,
         cap at 100 per conversation,
         save merged result back to localStorage
```

### 8.4 Debounced Save

```js
// In ChatContext — save to localStorage after state changes (debounced)
useEffect(() => {
  const timer = setTimeout(() => {
    saveDMHistory(state.dmHistory)      // from useLocalStorage hook
    saveGroupHistory(state.groupHistory)
  }, 500)
  return () => clearTimeout(timer)
}, [state.dmHistory, state.groupHistory])
```

---

## 9. Read Receipts — Implementation Detail

### 9.1 DM Read Receipts

**Status lifecycle:** `sent` → `delivered` → `read`

**Trigger points:**
- `sent`: immediately on `message:direct:sent` ack from server
- `delivered`: on `message:direct:delivered` event (recipient is online)
- `read`: on `message:direct:read:ack` (recipient opened chat)

**Emit `message:direct:read` when:**
```js
// In ChatWindow — when DM chat becomes active
useEffect(() => {
  if (activeChatType !== 'dm' || !activeChatId) return
  const unreadMessages = dmHistory[activeChatId]
    ?.filter(m => m.senderId === activeChatId && m.status !== 'read')
    ?.map(m => m.id) || []

  if (unreadMessages.length > 0) {
    socket.emit('message:direct:read', {
      senderId: activeChatId,
      messageIds: unreadMessages
    })
  }
}, [activeChatId, activeChatType])
```

**ReadReceipt SVG component:**
```jsx
// components/chat/ReadReceipt.jsx
export function ReadReceipt({ status }) {
  // single gray check = sent
  // double gray check = delivered
  // double blue check = read
  const color = status === 'read' ? 'var(--read-tick)' : 'var(--text-muted)'
  const double = status === 'delivered' || status === 'read'

  return (
    <svg width={double ? 18 : 10} height="10" viewBox={double ? "0 0 18 10" : "0 0 10 10"}>
      {double && (
        <polyline points="0,5 3,8 8,2" fill="none" stroke={color}
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      )}
      <polyline
        points={double ? "5,5 8,8 13,2" : "0,5 3,8 8,2"}
        fill="none" stroke={color}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
```

### 9.2 Group Read Receipts

**Trigger:** emit `group:message:read` when user opens a group chat and there are unread messages.

**Display:** Only on messages sent by the current user.

```jsx
// In MessageBubble (group, sent message)
function GroupReadReceipt({ readBy, groupMembers, currentUserId }) {
  const readers = readBy.filter(id => id !== currentUserId)
  const total = groupMembers.length - 1  // exclude self

  if (readers.length === 0) return <span className="receipt-muted">Sent</span>

  return (
    <span
      className="receipt-group"
      title={readers.map(id => groupMembers.find(m => m.id === id)?.username).join(', ')}
    >
      Read by {readers.length}{total > 1 ? `/${total}` : ''}
    </span>
  )
}
```

The `title` attribute provides the name popover on hover for free — no extra JS needed.

---

## 10. Typing Indicator — Implementation Detail

### 10.1 useTyping Hook

```js
// hooks/useTyping.js
import { useRef, useCallback } from 'react'
import { useSocket } from '../context/SocketContext'

export function useTyping(targetId, isGroup = false) {
  const { socket } = useSocket()
  const isTypingRef = useRef(false)
  const timerRef = useRef(null)

  const onType = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true
      socket?.emit('typing:start', { targetId, isGroup })
    }
    // Reset the stop timer on every keystroke
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      isTypingRef.current = false
      socket?.emit('typing:stop', { targetId, isGroup })
    }, 2000)  // stop after 2s of no keystrokes
  }, [socket, targetId, isGroup])

  const onSend = useCallback(() => {
    // Immediately stop typing on send
    clearTimeout(timerRef.current)
    if (isTypingRef.current) {
      isTypingRef.current = false
      socket?.emit('typing:stop', { targetId, isGroup })
    }
  }, [socket, targetId, isGroup])

  return { onType, onSend }
}
```

### 10.2 Server Typing Handlers (add to userHandlers.js)

```js
// Typing state: stored in typingTimers to auto-clear stale states
socket.on('typing:start', ({ targetId, isGroup }) => {
  const sender = users.get(socket.id)
  if (!sender) return

  const payload = { userId: sender.id, username: sender.username, targetId, isGroup, isTyping: true }

  if (isGroup) {
    socket.to(targetId).emit('typing:update', payload)
  } else {
    const recipient = findUserById(targetId)
    if (recipient?.socketId) io.to(recipient.socketId).emit('typing:update', payload)
  }

  // Server-side safety: auto-stop after 5s if client forgets to emit typing:stop
  const timerKey = `${sender.id}:${targetId}`
  clearTimeout(typingTimers.get(timerKey))
  typingTimers.set(timerKey, setTimeout(() => {
    const stopPayload = { ...payload, isTyping: false }
    if (isGroup) socket.to(targetId).emit('typing:update', stopPayload)
    else {
      const recipient = findUserById(targetId)
      if (recipient?.socketId) io.to(recipient.socketId).emit('typing:update', stopPayload)
    }
  }, 5000))
})

socket.on('typing:stop', ({ targetId, isGroup }) => {
  const sender = users.get(socket.id)
  if (!sender) return
  const timerKey = `${sender.id}:${targetId}`
  clearTimeout(typingTimers.get(timerKey))
  typingTimers.delete(timerKey)

  const payload = { userId: sender.id, username: sender.username, targetId, isGroup, isTyping: false }
  if (isGroup) socket.to(targetId).emit('typing:update', payload)
  else {
    const recipient = findUserById(targetId)
    if (recipient?.socketId) io.to(recipient.socketId).emit('typing:update', payload)
  }
})
```

### 10.3 TypingIndicator Component

```jsx
// components/chat/TypingIndicator.jsx
export function TypingIndicator({ typingUsers }) {
  if (!typingUsers || typingUsers.length === 0) return null

  let label
  if (typingUsers.length === 1) label = `${typingUsers[0]} is typing`
  else if (typingUsers.length === 2) label = `${typingUsers[0]} and ${typingUsers[1]} are typing`
  else label = `${typingUsers[0]} and ${typingUsers.length - 1} others are typing`

  return (
    <div className="typing-indicator">
      <div className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="typing-label">{label}</span>
    </div>
  )
}
```

---

## 11. CSS Architecture & Theming

### 11.1 client/src/styles/index.css

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg-primary:     #1a1a2e;
  --bg-secondary:   #16213e;
  --bg-tertiary:    #0f3460;
  --bg-elevated:    #1e2a45;
  --bg-input:       #2a2a4a;
  --bg-hover:       rgba(255,255,255,0.04);
  --bg-active:      rgba(114,137,218,0.15);

  --accent:         #7289da;
  --accent-hover:   #5f73bc;
  --accent-muted:   rgba(114,137,218,0.25);

  --text-primary:   #dcddde;
  --text-secondary: #8e9297;
  --text-muted:     #6c6f76;
  --text-white:     #ffffff;

  --online:         #3ba55c;
  --offline:        #747f8d;
  --danger:         #ed4245;
  --warning:        #faa61a;
  --read-tick:      #5b9dd9;
  --unread-badge:   #ed4245;

  --border:         rgba(255,255,255,0.06);
  --border-strong:  rgba(255,255,255,0.12);

  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  12px;
  --radius-xl:  18px;
  --radius-full: 9999px;

  --sidebar-width: 260px;
  --font: 'Inter', system-ui, -apple-system, sans-serif;
  --transition: 0.15s ease;
}

html, body, #root {
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: var(--radius-full); }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

button { cursor: pointer; border: none; background: none; font-family: var(--font); color: inherit; }
input, textarea { font-family: var(--font); color: var(--text-primary); background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); outline: none; }
input:focus, textarea:focus { border-color: var(--accent); }
```

### 11.2 client/src/styles/animations.css

```css
@keyframes messageIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0);   }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);    }
}

@keyframes typingDot {
  0%, 60%, 100% { transform: translateY(0);    opacity: 0.3; }
  30%            { transform: translateY(-4px); opacity: 1;   }
}

@keyframes badgePop {
  0%   { transform: scale(0.4); }
  70%  { transform: scale(1.2); }
  100% { transform: scale(1);   }
}

@keyframes toastIn {
  from { opacity: 0; transform: translateX(110%); }
  to   { opacity: 1; transform: translateX(0);    }
}

@keyframes toastOut {
  from { opacity: 1; transform: translateX(0);    }
  to   { opacity: 0; transform: translateX(110%); }
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.95) translateY(-8px); }
  to   { opacity: 1; transform: scale(1)    translateY(0);    }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.animate-message   { animation: messageIn  0.18s ease-out; }
.animate-fade      { animation: fadeIn     0.3s  ease-out; }
.animate-badge     { animation: badgePop   0.2s  ease-out; }
.animate-modal     { animation: modalIn    0.2s  ease-out; }
.animate-spin      { animation: spin       0.8s  linear infinite; }

.typing-dot:nth-child(1) { animation: typingDot 1.2s ease-in-out infinite 0s;    }
.typing-dot:nth-child(2) { animation: typingDot 1.2s ease-in-out infinite 0.2s;  }
.typing-dot:nth-child(3) { animation: typingDot 1.2s ease-in-out infinite 0.4s;  }

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## 12. Deployment Configuration

### 12.1 Render (Server)

**Service type:** Web Service
**Build command:** `npm install`
**Start command:** `node src/index.js`
**Root directory:** `server`
**Environment variables (set in Render dashboard):**

```
PORT=3001
CLIENT_ORIGIN=https://your-app.vercel.app
```

**server/render.yaml** (optional — for auto-deploy):

```yaml
services:
  - type: web
    name: chat-app-server
    env: node
    rootDir: server
    buildCommand: npm install
    startCommand: node src/index.js
    envVars:
      - key: PORT
        value: 3001
      - key: CLIENT_ORIGIN
        fromEnvironment: CLIENT_ORIGIN
```

**Important Render notes:**
- Free tier spins down after 15 min of inactivity. The `/health` endpoint in Express can be pinged by an uptime monitor (e.g. UptimeRobot, free) to keep it alive.
- WebSockets work on Render free tier — no special config needed.
- Render assigns a random port via `process.env.PORT` — never hardcode 3001 in production.

### 12.2 Vercel (Client)

**Framework preset:** Vite
**Root directory:** `client`
**Build command:** `npm run build`
**Output directory:** `dist`
**Environment variables (set in Vercel dashboard):**

```
VITE_SERVER_URL=https://your-app-name.onrender.com
```

**client/vercel.json:**

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This ensures React Router (if used) or any direct URL access works. Since this app uses conditional rendering (not React Router), it's still good practice.

### 12.3 CORS in Production

The server must allow the Vercel domain. Update `CLIENT_ORIGIN` on Render to the exact Vercel URL:

```js
// server/src/index.js — already handled by env var
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN,  // set to https://your-app.vercel.app
    methods: ['GET', 'POST'],
    credentials: true
  }
})
```

If Vercel gives you a preview URL on each deploy (e.g. `chat-app-abc123.vercel.app`), use the production URL (your custom domain or the main project URL ending in `vercel.app`) — not the preview URL.

### 12.4 Production Socket Connection

In production, the Vite proxy no longer exists. The client must call the Render server directly:

```js
// context/SocketContext.jsx — already handled
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
// In dev: VITE_SERVER_URL is not set → falls back to localhost:3001 (Vite proxies it)
// In prod: VITE_SERVER_URL = https://your-app.onrender.com
```

---

## 13. Error Handling Strategy

### 13.1 Error Categories & Handling

| Category | Where caught | User-facing response |
|---|---|---|
| Socket connection fail | `SocketContext` `connect_error` | Toast: "Unable to connect. Retrying…" |
| Socket disconnect | `SocketContext` `disconnect` | Toast: "Disconnected. Reconnecting…" (auto-dismissed on reconnect) |
| Server validation error | `ChatContext` `error` event listener | Toast with server's error message |
| Client validation (empty field) | Component-level, before emit | Inline error text below input |
| localStorage QuotaExceededError | `useLocalStorage` catch block | Silent eviction, log to console |
| Unknown group / user not found | Server emits `error` event | Toast notification |
| Username taken | Server emits `error` event | Inline error on LoginScreen |

### 13.2 Toast System

```js
// In ChatContext
socket.on('error', ({ code, message }) => {
  dispatch({ type: ACTION.ADD_TOAST, payload: {
    id: Date.now(),
    message,
    type: code === 'USERNAME_TAKEN' ? 'inline' : 'toast'  // inline errors stay on the form
  }})
})

// Auto-dismiss after 4 seconds
case ACTION.ADD_TOAST: {
  setTimeout(() => {
    dispatch({ type: ACTION.REMOVE_TOAST, payload: { id: action.payload.id } })
  }, 4000)
  return { ...state, toastQueue: [...state.toastQueue, action.payload] }
}
```

---

## 14. Performance Constraints

### 14.1 Server Limits

| Resource | Limit | Enforcement |
|---|---|---|
| DM history per conversation | 200 messages | `history.shift()` when exceeded |
| Group history per conversation | 200 messages | `history.shift()` when exceeded |
| Message content length | 2000 chars | `validateMessage()` |
| Username length | 24 chars | `validateUsername()` |
| Group name length | 32 chars | `validateGroupName()` |
| Concurrent users | ~50 (Render free tier RAM ~512MB) | No hard limit — in-memory Map |
| Typing timer cleanup | Auto-clear after 5s | `typingTimers` Map + setTimeout |

### 14.2 Client Limits

| Resource | Limit | Enforcement |
|---|---|---|
| localStorage per conversation | 100 messages | Evict oldest on save |
| Rendered messages in DOM | Last 100 per chat | Slice `history.slice(-100)` in render |
| Typing indicator timeout | 2s client, 5s server | `useTyping` hook + server timer |
| Debounce localStorage writes | 500ms | `useEffect` + `setTimeout` |

### 14.3 React Performance Notes

- Wrap `MessageBubble` in `React.memo` — messages list can grow large and re-renders on every new message without memoization.
- Use `useCallback` on all socket emit functions in `ChatContext` to prevent child re-renders.
- `useRef` for the messages scroll container and call `scrollIntoView` directly — avoids state update on every scroll.
- Keys on message list items must be `message.id` (UUID), never array index.

---

## 15. Complete File Bootstrapping Guide

### Step 1 — Root setup

```bash
mkdir chat-app && cd chat-app
npm init -y
npm install -D concurrently
```

Edit root `package.json` with the scripts from Section 2.

### Step 2 — Server bootstrap

```bash
mkdir server && cd server
npm init -y
npm install express socket.io cors uuid
```

Create `src/index.js`, `src/store/inMemoryStore.js`, `src/handlers/userHandlers.js`, `src/handlers/messageHandlers.js`, `src/handlers/groupHandlers.js`, `src/utils/validators.js`.

### Step 3 — Client bootstrap

```bash
cd ..
npm create vite@latest client -- --template react
cd client
npm install socket.io-client
```

Create `src/context/SocketContext.jsx`, `src/context/ChatContext.jsx`, `src/hooks/useLocalStorage.js`, `src/hooks/useTyping.js`, `src/utils/formatTime.js`, `src/utils/validators.js`.

Replace `src/main.jsx` and `src/App.jsx` with the versions in Section 5.

### Step 4 — Environment files

```bash
# From root
cp .env.example server/.env
cp .env.example client/.env
```

Edit each `.env` with correct values.

### Step 5 — Run

```bash
# From root
npm run dev
```

Client: `http://localhost:5173`
Server: `http://localhost:3001`
Health check: `http://localhost:3001/health`

### Step 6 — Deploy

```bash
# Push to GitHub first
git init && git add . && git commit -m "initial commit"
git remote add origin https://github.com/your-username/chat-app.git
git push -u origin main
```

- **Render:** New Web Service → connect GitHub repo → Root Directory: `server` → Build: `npm install` → Start: `node src/index.js` → add env vars
- **Vercel:** New Project → import repo → Root Directory: `client` → Framework: Vite → add `VITE_SERVER_URL` env var → Deploy

---

*TRD v1.0 — All sections map 1:1 to the PRD v1.0 feature set*
