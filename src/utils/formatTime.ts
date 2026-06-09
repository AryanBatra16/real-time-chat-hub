export function formatMessageTime(timestamp: string | number) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return "00:00";
  }
}

export function formatLastSeen(timestamp?: string | number) {
  if (!timestamp) return "a while ago";
  try {
    const timeMs = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
    const diff = Date.now() - timeMs;
    const mins = Math.floor(diff / 60000);
    
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
    
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `today at ${formatMessageTime(timeMs)}`;
    if (hours < 48) return `yesterday at ${formatMessageTime(timeMs)}`;
    
    return new Date(timeMs).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return "offline";
  }
}
