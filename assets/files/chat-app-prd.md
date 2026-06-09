# Product Requirements Document
## Real-Time Chat Application
**Version:** 1.0  
**Timeline:** 24 hours  
**Stack:** React + Vite · Node.js · Express · Socket.IO  
**Style:** Dark modern (Discord-inspired)

---

## 1. Project Overview

A full-stack real-time chat application supporting one-to-one direct messaging and multi-user group chats. Users identify themselves with a username (no authentication), communicate instantly via WebSockets, and get a polished Discord-style dark UI with transitions, typing indicators, online/offline status, in-memory message history, DM + group read receipts, and LocalStorage persistence of username and message history.

---

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React 18 + Vite | Fast HMR, minimal config |
| Styling | Plain CSS + CSS Variables | Full control, no class bloat |
| Real-time | Socket.IO client | Pairs with server, auto-reconnect |
| Backend | Node.js + Express | Simple, widely known |
| WebSocket | Socket.IO server | Rooms support, namespace, events |
| State | React Context + useState/useReducer | No Redux needed at this scale |
| Persistence | localStorage (client-side) | Username + message history across refreshes |
| Database | None — in-memory JS Maps | Clean, fast, no setup overhead |

---

## 3. Repository Structure

```
/
├── client/                        # Vite + React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── LoginScreen.jsx
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.jsx
│   │   │   │   └── Sidebar.jsx
│   │   │   ├── chat/
│   │   │   │   ├── ChatWindow.jsx
│   │   │   │   ├── MessageBubble.jsx
│   │   │   │   ├── MessageInput.jsx
│   │   │   │   ├── TypingIndicator.jsx
│   │   │   │   └── ReadReceipt.jsx
│   │   │   ├── users/
│   │   │   │   ├── UserList.jsx
│   │   │   │   └── UserAvatar.jsx
│   │   │   ├── groups/
│   │   │   │   ├── GroupList.jsx
│   │   │   │   └── CreateGroupModal.jsx
│   │   │   └── shared/
│   │   │       ├── Modal.jsx
│   │   │       ├── EmptyState.jsx
│   │   │       └── Toast.jsx
│   │   ├── context/
│   │   │   ├── SocketContext.jsx
│   │   │   └── ChatContext.jsx
│   │   ├── hooks/
│   │   │   ├── useSocket.js
│   │   │   ├── useLocalStorage.js
│   │   │   └── useTyping.js
│   │   ├── utils/
│   │   │   ├── formatTime.js
│   │   │   └── validators.js
│   │   ├── styles/
│   │   │   ├── index.css          # CSS variables + reset
│   │   │   ├── layout.css
│   │   │   ├── chat.css
│   │   │   ├── sidebar.css
│   │   │   └── animations.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── userHandlers.js
│   │   │   ├── messageHandlers.js
│   │   │   └── groupHandlers.js
│   │   ├── store/
│   │   │   └── inMemoryStore.js
│   │   ├── utils/
│   │   │   └── validators.js
│   │   └── index.js               # Entry point
│   └── .env
│
├── .env.example
└── README.md
```

---

## 4. Data Models (In-Memory)

### 4.1 User
```js
{
  id: "uuid-v4",                  // socket.id at connection time
  username: "string",
  socketId: "string",
  isOnline: true,
  joinedAt: Date.now(),
  lastSeen: Date.now()            // updated on disconnect
}
```

### 4.2 Direct Message
```js
{
  id: "uuid-v4",
  senderId: "string",
  recipientId: "string",
  content: "string",
  timestamp: Date.now(),
  status: "sent" | "delivered" | "read"
}
```

### 4.3 Group
```js
{
  id: "uuid-v4",
  name: "string",
  createdBy: "userId",
  members: ["userId", ...],
  createdAt: Date.now()
}
```

### 4.4 Group Message
```js
{
  id: "uuid-v4",
  groupId: "string",
  senderId: "string",
  content: "string",
  timestamp: Date.now(),
  readBy: ["userId", ...]          // array grows as members open the chat
}
```

### 4.5 Server Store (inMemoryStore.js)
```js
const users    = new Map()         // socketId → User
const dms      = new Map()         // "uid1:uid2" → Message[]
const groups   = new Map()         // groupId → Group
const gMessages = new Map()        // groupId → GroupMessage[]
```

---

## 5. Socket.IO Events Reference

### Client → Server (emit)

| Event | Payload | Description |
|---|---|---|
| `user:join` | `{ username }` | User enters app, registers on server |
| `message:direct` | `{ recipientId, content }` | Send DM to a user |
| `message:direct:read` | `{ senderId, messageIds[] }` | Mark DMs as read |
| `group:create` | `{ name, memberIds[] }` | Create a group |
| `group:join` | `{ groupId }` | Join an existing group room |
| `group:message` | `{ groupId, content }` | Send message to group |
| `group:message:read` | `{ groupId, messageIds[] }` | Mark group messages as read |
| `typing:start` | `{ targetId, isGroup }` | Started typing in DM or group |
| `typing:stop` | `{ targetId, isGroup }` | Stopped typing |
| `user:disconnect` | _(automatic)_ | Built-in Socket.IO disconnect |

### Server → Client (emit/broadcast)

| Event | Payload | Recipients | Description |
|---|---|---|---|
| `user:joined` | `{ user }` | All | New user connected |
| `users:list` | `{ users[] }` | Requester | Full online user list |
| `user:offline` | `{ userId, lastSeen }` | All | User disconnected |
| `message:direct:receive` | `{ message }` | Recipient | Incoming DM |
| `message:direct:delivered` | `{ messageId }` | Sender | Message reached recipient |
| `message:direct:read:ack` | `{ messageIds[], readBy }` | Sender | DMs marked read |
| `group:created` | `{ group }` | All members | New group ready |
| `group:message:receive` | `{ message }` | All group members | Incoming group message |
| `group:message:read:ack` | `{ groupId, messageId, readBy, readCount }` | All group members | Read receipt update |
| `typing:update` | `{ userId, username, targetId, isGroup, isTyping }` | Target | Typing state change |
| `error` | `{ code, message }` | Requester | Validation or server error |

---

## 6. Feature Specifications

### 6.1 Login / Identification

**Behaviour:**
- Full-screen centered card on a dark background
- Single text input: "Your name" placeholder
- "Join Chat" button — disabled until input has ≥1 non-whitespace character
- On submit: trim username, validate (2–24 chars, alphanumeric + spaces/underscores), emit `user:join`
- On `user:joined` ack from server: save username to localStorage, transition to app layout
- If localStorage has a saved username on page load: pre-fill the input and show "Welcome back, {name}" subtitle
- Error state: inline red text below input, no browser alerts

**Validation rules:**
```
- Required: yes
- Min length: 2 characters
- Max length: 24 characters
- Allowed: letters, numbers, spaces, underscores
- Forbidden: empty/whitespace-only, special characters
```

**LocalStorage on login:**
```js
localStorage.setItem('chat_username', username)
```

---

### 6.2 App Layout

**Structure:** Two-column layout (sidebar + chat pane)

```
┌─────────────────────────────────────────────────────┐
│  SIDEBAR (260px fixed)  │  CHAT PANE (flex: 1)      │
│  ┌───────────────────┐  │  ┌─────────────────────┐  │
│  │ Current user info │  │  │ Chat header          │  │
│  │ ─────────────────│  │  │ ─────────────────── │  │
│  │ DIRECT MESSAGES  │  │  │ Messages list        │  │
│  │  User 1    ● 2   │  │  │                      │  │
│  │  User 2          │  │  │                      │  │
│  │ ─────────────────│  │  │ ─────────────────── │  │
│  │ GROUPS           │  │  │ Message input        │  │
│  │  Group 1   ● 5   │  │  └─────────────────────┘  │
│  │  + Create Group  │  │                             │
│  └───────────────────┘  │                             │
└─────────────────────────────────────────────────────┘
```

**Responsive (mobile <768px):** Sidebar slides in/out via hamburger button. Chat pane is full width. CSS `transform: translateX` transition for the slide.

---

### 6.3 Sidebar

**Sections:**

**Current user panel (top):**
- Avatar circle with initials (first letter of username, colored by hash of username)
- Username in bold
- Green "Online" dot

**Direct Messages section:**
- Label "Direct Messages"
- List of all online users (excluding self)
- Each row: avatar + username + online dot (green = online, gray = offline with "last seen X ago")
- Unread DM count badge (red pill, top-right of avatar)
- Active chat highlighted with accent background

**Groups section:**
- Label "Groups"
- List of groups the user is a member of
- Each row: # icon + group name + unread count badge
- "+ Create Group" button at bottom of section

**Behaviour:**
- Click user → open DM chat
- Click group → open group chat
- Unread badges clear when chat is opened

---

### 6.4 Direct Message Chat

**Chat header:**
- Recipient avatar + username
- Online status dot + text ("Online" / "Last seen {time}")

**Messages area:**
- Sent messages: right-aligned, accent color bubble
- Received messages: left-aligned, dark gray bubble
- Each message: content + timestamp (HH:MM) + read receipt icon
- Date separator when messages span multiple days ("Today", "Yesterday", "Dec 12")
- Auto-scroll to bottom on new message
- Scroll anchor: `useRef` + `scrollIntoView({ behavior: 'smooth' })`

**Read receipts (DM):**
- Single gray tick (✓) = sent (delivered to server)
- Double gray tick (✓✓) = delivered (recipient is online / message reached their socket)
- Double blue tick (✓✓) = read (recipient opened this chat)
- Icons rendered as SVG, not Unicode, for precise styling
- Receipt updates in real time via `message:direct:read:ack`

**Typing indicator:**
- Shown below messages list when recipient is typing
- Animated 3-dot pulse (CSS keyframes)
- Disappears after 3 seconds of no `typing:start` events (server-side timeout not needed — client uses a `setTimeout` reset)
- Text: "{username} is typing..."

**Message input:**
- Multiline `<textarea>`, auto-grows up to 5 lines, then scrolls
- Send on Enter key (Shift+Enter = newline)
- Send button (arrow icon), disabled when empty
- Emits `typing:start` on first keystroke, `typing:stop` on send or 2s idle
- Validation: trim whitespace, reject empty, max 2000 chars
- Character counter shown when >1800 chars

**Empty state (no chat selected):**
- Centered illustration (CSS-drawn speech bubble or simple SVG)
- Text: "Select a conversation to start chatting"

---

### 6.5 Group Chat

**Group creation modal:**
- Input: group name (2–32 chars)
- Checkbox list of all online users (excluding self) to add as members
- "Create Group" button — disabled if no name or no members selected
- Validation: name required, at least 1 member
- On submit: emit `group:create`, close modal on `group:created` ack

**Chat header:**
- # icon + group name
- Member count: "N members" (clickable to show member list popover)
- Member list popover: avatar + username + online dot for each member

**Messages area:**
- Same layout as DM but received messages also show sender username above bubble
- Sender username colored by hash (consistent per user across all chats)

**Read receipts (group):**
- Below each sent message: "Read by N" in small muted text
- Hover/tap on "Read by N" shows popover with list of who has read it
- Updates in real time as members open the chat
- Own messages only show read receipt — received messages don't

**Typing indicator:**
- Multiple users can show at once: "Alice and Bob are typing..."
- If 3+ users: "Alice and 2 others are typing..."

---

### 6.6 Online / Offline Status

**Online:**
- Green filled circle dot (8px) next to username in sidebar and chat header
- Text label "Online" in chat header

**Offline / Last seen:**
- Gray circle dot
- Text label "Last seen {relative time}" — e.g. "Last seen 2 mins ago", "Last seen today at 14:32", "Last seen Dec 8"
- `lastSeen` timestamp stored on server at disconnect, broadcast via `user:offline`
- Relative time formatted client-side, recalculated every minute via `setInterval`

**Reconnection:**
- Socket.IO auto-reconnect is enabled by default
- On reconnect: re-emit `user:join` with stored username, re-sync user list

---

### 6.7 Message History (In-Memory)

**Server-side:**
- DMs stored in `Map<"uid1:uid2", Message[]>` — key is sorted user IDs joined with `:`
- Group messages stored in `Map<groupId, GroupMessage[]>`
- Max 200 messages per conversation (oldest dropped when limit hit — simple `shift()`)
- On `user:join`, server sends back DM history for all conversations involving that user
- On `group:join`, server sends back that group's message history

**Client-side:**
- `ChatContext` holds `dmHistory: Map<userId, Message[]>` and `groupHistory: Map<groupId, Message[]>`
- Merged with any history loaded from localStorage on init
- New messages appended in real time

---

### 6.8 LocalStorage Persistence

**What is saved:**
```js
localStorage.setItem('chat_username', username)
localStorage.setItem('chat_dm_history', JSON.stringify(dmHistoryMap))
localStorage.setItem('chat_group_history', JSON.stringify(groupHistoryMap))
```

**Merge strategy on page load:**
1. Load localStorage history → populate `ChatContext` immediately (so UI renders past messages instantly)
2. Connect to socket → emit `user:join`
3. Receive server history → merge with localStorage (server is source of truth; deduplicate by message `id`)
4. Save merged result back to localStorage

**When to save:**
- On every new message received or sent (debounced 500ms to avoid thrashing)
- On page `beforeunload`

**Max storage:**
- Cap localStorage history at 100 messages per conversation to avoid quota errors
- If quota exceeded, catch error and clear oldest 50% of messages silently

**Custom hook:**
```js
// hooks/useLocalStorage.js
export function useLocalStorage(key, initialValue) {
  // read on init, write on change, handle parse errors
}
```

---

## 7. Validation Rules Summary

| Field | Rule |
|---|---|
| Username | Required, 2–24 chars, alphanumeric + spaces/underscores |
| Message content | Required, 1–2000 chars, not whitespace-only |
| Group name | Required, 2–32 chars |
| Group members | At least 1 member must be selected |
| Recipient (DM) | Must select a user before sending |
| Group (group msg) | Must be a member of the group |

**Server-side validation** mirrors all client rules. Any invalid payload returns `error` event with a `code` and human-readable `message`. Client shows a Toast notification for server errors.

---

## 8. UI / UX Specifications

### 8.1 Color Palette (CSS Variables)

```css
:root {
  /* Backgrounds */
  --bg-primary:     #1a1a2e;   /* deepest background */
  --bg-secondary:   #16213e;   /* sidebar */
  --bg-tertiary:    #0f3460;   /* chat area */
  --bg-elevated:    #1e2a45;   /* message bubbles (received) */
  --bg-input:       #2a2a4a;   /* input fields */

  /* Accent */
  --accent:         #7289da;   /* Discord-like blue-purple */
  --accent-hover:   #5f73bc;
  --accent-muted:   #3a4a7a;

  /* Text */
  --text-primary:   #dcddde;
  --text-secondary: #8e9297;
  --text-muted:     #6c6f76;
  --text-white:     #ffffff;

  /* Status */
  --online:         #3ba55c;
  --offline:        #747f8d;
  --unread-badge:   #ed4245;
  --read-tick:      #5b9dd9;

  /* Borders */
  --border:         rgba(255,255,255,0.06);
  --border-strong:  rgba(255,255,255,0.12);

  /* Misc */
  --radius-sm:      4px;
  --radius-md:      8px;
  --radius-lg:      12px;
  --radius-xl:      18px;
  --sidebar-width:  260px;
  --font:           'Inter', system-ui, sans-serif;
}
```

### 8.2 Typography

- Font: Inter (import from Google Fonts)
- Body: 14px / 400
- Usernames: 14px / 600
- Timestamps: 11px / 400 / --text-muted
- Section labels: 11px / 700 / uppercase / --text-secondary / letter-spacing: 0.08em
- Message content: 15px / 400 / line-height 1.5

### 8.3 Animations

All defined in `animations.css`:

```css
/* Message slide-in */
@keyframes messageIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0);   }
}
.message-bubble { animation: messageIn 0.18s ease-out; }

/* Login fade transition */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0);    }
}
.login-card { animation: fadeIn 0.3s ease-out; }

/* Typing dots */
@keyframes typingDot {
  0%, 60%, 100% { transform: translateY(0);    opacity: 0.4; }
  30%            { transform: translateY(-4px); opacity: 1;   }
}
.typing-dot:nth-child(1) { animation: typingDot 1.2s infinite 0s;    }
.typing-dot:nth-child(2) { animation: typingDot 1.2s infinite 0.2s;  }
.typing-dot:nth-child(3) { animation: typingDot 1.2s infinite 0.4s;  }

/* Sidebar mobile slide */
.sidebar { transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.sidebar.hidden { transform: translateX(-100%); }

/* Unread badge pop */
@keyframes badgePop {
  0%   { transform: scale(0.5); }
  70%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}
.unread-badge { animation: badgePop 0.2s ease-out; }

/* Toast slide-in */
@keyframes toastIn {
  from { opacity: 0; transform: translateX(100%); }
  to   { opacity: 1; transform: translateX(0);    }
}
```

### 8.4 Component Sizing

| Component | Size |
|---|---|
| Sidebar width | 260px (fixed) |
| User avatar (sidebar) | 32px circle |
| User avatar (chat header) | 40px circle |
| Message input min-height | 44px |
| Message input max-height | 120px (5 lines) |
| Online dot | 8px circle, 2px white border |
| Unread badge | min 18px, 10px font |
| Toast | 320px wide, bottom-right, 3s auto-dismiss |
| Modal overlay | full screen, rgba(0,0,0,0.6) |
| Modal card | 440px wide, centered |

---

## 9. Context Architecture

### 9.1 SocketContext
```jsx
// Provides: socket instance, connectionStatus
// Initializes socket on mount, cleans up on unmount
// Handles reconnection logic
const SocketContext = createContext()
export const useSocket = () => useContext(SocketContext)
```

### 9.2 ChatContext
```jsx
// Provides:
//   currentUser, setCurrentUser
//   users (online list)
//   groups (user's groups)
//   dmHistory: Map<userId, Message[]>
//   groupHistory: Map<groupId, Message[]>
//   activeChatId, activeChatType ('dm' | 'group')
//   setActiveChat(id, type)
//   unreadCounts: Map<chatId, number>
//   typingUsers: Map<chatId, string[]>
//   sendDM(recipientId, content)
//   sendGroupMessage(groupId, content)
//   createGroup(name, memberIds)
//   markAsRead(chatId, type)
const ChatContext = createContext()
export const useChat = () => useContext(ChatContext)
```

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| Socket connection failed | Toast: "Unable to connect. Retrying..." with spinner |
| Socket disconnected mid-session | Toast: "Connection lost. Reconnecting..." auto-dismissed on reconnect |
| Username taken (same name already in room) | Inline error on login screen: "This name is already taken, choose another" |
| Empty message send attempt | Button disabled — no error shown (prevent by UI) |
| Server returns `error` event | Toast notification with error message, auto-dismiss 4s |
| localStorage quota exceeded | Silent catch, clear oldest messages, continue |
| Invalid group (user not member) | Toast: "You are not a member of this group" |

---

## 11. Build & Run Instructions (for README)

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Setup
```bash
# Clone
git clone <repo-url>
cd chat-app

# Install server deps
cd server && npm install

# Install client deps
cd ../client && npm install
```

### Environment Variables
```bash
# server/.env
PORT=3001

# client/.env
VITE_SERVER_URL=http://localhost:3001
```

### Run (development)
```bash
# Terminal 1 — server
cd server && npm run dev

# Terminal 2 — client
cd client && npm run dev
```

### Run (production build)
```bash
cd client && npm run build
# Serve /dist from Express (add static middleware in server/src/index.js)
```

---

## 12. Implementation Priority Order

Given the 24-hour constraint, build in this exact sequence:

### Hour 0–3: Foundation
- [ ] Repo setup, folder structure, install all deps
- [ ] CSS variables, global reset, Inter font
- [ ] `.env.example`, README skeleton

### Hour 3–6: Backend complete
- [ ] `inMemoryStore.js` with all Maps
- [ ] `userHandlers.js`: join, disconnect, user list
- [ ] `messageHandlers.js`: DM send, deliver, read
- [ ] `groupHandlers.js`: create, join, message, read
- [ ] Typing event handlers
- [ ] Server-side validation utils

### Hour 6–9: Frontend core
- [ ] `SocketContext` + `ChatContext`
- [ ] `useLocalStorage` hook
- [ ] `LoginScreen` component wired to socket
- [ ] `AppLayout` + `Sidebar` shell (static first)

### Hour 9–13: Real-time features
- [ ] `UserList` with online status dots
- [ ] `ChatWindow` (DM) + `MessageBubble` + `MessageInput`
- [ ] DM send/receive wired end-to-end
- [ ] `GroupList` + `CreateGroupModal`
- [ ] Group send/receive wired end-to-end

### Hour 13–17: Bonus features
- [ ] Typing indicator (hook + UI component)
- [ ] Read receipts DM (ticks in `MessageBubble`)
- [ ] Read receipts group ("Read by N" + popover)
- [ ] Message history: server sends on join, client merges
- [ ] LocalStorage save/load/merge logic

### Hour 17–20: UI polish
- [ ] All CSS animations (`animations.css`)
- [ ] Sidebar unread badges with pop animation
- [ ] Responsive mobile layout + hamburger
- [ ] Toast component for errors
- [ ] Empty states
- [ ] Auto-scroll behavior

### Hour 20–22: Testing
- [ ] 3 browser tabs: multi-user DM + group test
- [ ] All validations: empty fields, long input, no recipient
- [ ] Disconnect/reconnect flow
- [ ] LocalStorage refresh test (close tab, reopen)
- [ ] Mobile responsive check

### Hour 22–24: Submission
- [ ] Remove all `console.log` statements
- [ ] Write full README (setup, events table, screenshots)
- [ ] Take screenshots: Login, DM, Group chat
- [ ] Push to GitHub, verify repo is public

---

## 13. Assumptions

1. No authentication — username uniqueness is enforced per session (server checks active users), not globally.
2. Message history is cleared when the server restarts. LocalStorage persists client-side history independently.
3. Users can only see groups they are a member of.
4. A user can message any online user — no friend/contact list needed.
5. Offline users cannot receive messages; messages sent while someone is offline are not queued.
6. Socket.IO is used for all real-time communication — no REST API endpoints are needed beyond the Express + Socket.IO setup.
7. The app is single-tab per user; multiple tabs with the same username is not supported.
8. No file/image sharing, only text messages.
9. Group membership is set at creation; no ability to add members to an existing group (keeps scope clean).
10. Read receipts for groups show "Read by N" but only update for currently online members.

---

*Document end — PRD v1.0*
