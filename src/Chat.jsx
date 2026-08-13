// ═══════════════════════════════════════════════════════════════════
//  CHAT — real-time student/admin messaging
//  Reuses the app's existing theme, API client (via props), and design
//  primitives (imported from asad.jsx) instead of duplicating them.
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Search, Check, CheckCheck, WifiOff, Loader2, MessageSquare,
  Shield, User, ArrowLeft, RefreshCw, Inbox,
} from "lucide-react";
import { themes, C, F, Card, Btn, Input, Avatar, useToast } from "./asad.jsx";

// ── Socket URL resolution ──────────────────────────────────────────
// Mirrors asad.jsx's BASE-URL resolution so behavior stays consistent,
// plus an env-var override for when the real-time server lives somewhere
// other than the REST API (see server.js / chat architecture notes: a
// Vercel-only deployment has no persistent process for Socket.IO to run
// on, so a separate always-on host needs VITE_SOCKET_URL pointed at it).
function resolveSocketUrl() {
  const envUrl = import.meta.env?.VITE_SOCKET_URL;
  if (envUrl) return envUrl;
  if (typeof window === "undefined") return "http://localhost:5001";
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return "http://localhost:5001";
  return window.location.origin;
}

// ── Timestamp formatting ────────────────────────────────────────────
const sameDay = (a, b) => a.toDateString() === b.toDateString();

function formatBubbleTime(date) {
  return new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDaySeparator(date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function formatListTime(date) {
  if (!date) return "";
  const d = new Date(date);
  const today = new Date();
  if (sameDay(d, today)) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}

// ── Socket connection hook ──────────────────────────────────────────
// One connection per mounted chat page (student/admin chat screens), torn
// down on unmount. Handles auth via the same JWT used for REST calls,
// auto-reconnects, and surfaces connection state so the UI can show a
// clear offline/reconnecting banner instead of silently failing.
function useChatSocket(token, handlers = {}) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [socketError, setSocketError] = useState(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token) return undefined;
    setConnecting(true);
    setSocketError(null);

    const socket = io(resolveSocketUrl(), {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 8000,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => { setConnected(true); setConnecting(false); setSocketError(null); });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => { setConnecting(false); setConnected(false); setSocketError(err.message || "Connection failed"); });
    socket.io.on("reconnect_attempt", () => setConnecting(true));

    socket.on("receive_message", (msg) => handlersRef.current.onReceiveMessage?.(msg));
    socket.on("conversation_updated", (data) => handlersRef.current.onConversationUpdated?.(data));
    socket.on("typing", (data) => handlersRef.current.onTyping?.(data));
    socket.on("stop_typing", (data) => handlersRef.current.onStopTyping?.(data));
    socket.on("message_read", (data) => handlersRef.current.onMessageRead?.(data));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const joinConversation = useCallback((conversationId) => new Promise((resolve) => {
    if (!socketRef.current?.connected) return resolve({ ok: false, error: "Not connected" });
    socketRef.current.emit("join_conversation", conversationId, (ack) => resolve(ack || { ok: false }));
  }), []);

  const leaveConversation = useCallback((conversationId) => {
    socketRef.current?.emit("leave_conversation", conversationId);
  }, []);

  const sendMessage = useCallback((conversationId, message) => new Promise((resolve) => {
    if (!socketRef.current?.connected) return resolve({ ok: false, error: "Not connected" });
    socketRef.current.emit("send_message", { conversationId, message }, (ack) => resolve(ack || { ok: false }));
  }), []);

  const startTyping = useCallback((conversationId) => socketRef.current?.emit("typing", { conversationId }), []);
  const stopTyping  = useCallback((conversationId) => socketRef.current?.emit("stop_typing", { conversationId }), []);
  const markRead    = useCallback((conversationId) => socketRef.current?.emit("message_read", { conversationId, all: true }), []);

  return { connected, connecting, socketError, joinConversation, leaveConversation, sendMessage, startTyping, stopTyping, markRead };
}

// ── Small shared pieces ─────────────────────────────────────────────
const UnreadBadge = ({ count }) => {
  if (!count) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9,
      background: C.rose, color: "#fff", fontSize: 10, fontWeight: 800,
      fontFamily: F, lineHeight: 1,
    }}>
      {count > 99 ? "99+" : count}
    </span>
  );
};

const TypingIndicator = ({ label = "typing" }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", color: C.txt2, fontSize: 12 }}>
    <div style={{ display: "flex", gap: 3 }}>
      {[0, 1, 2].map(i => (
        <motion.span key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
          style={{ width: 5, height: 5, borderRadius: "50%", background: C.indigo, display: "inline-block" }} />
      ))}
    </div>
    {label}…
  </div>
);

const ConnectionBanner = ({ connecting, connected, socketError }) => {
  if (connected) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
      background: connecting ? `${C.amber}15` : `${C.rose}15`,
      borderBottom: `1px solid ${connecting ? C.amber : C.rose}30`,
      color: connecting ? C.amber : C.rose, fontSize: 12, fontWeight: 600,
    }}>
      {connecting
        ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Reconnecting…</>
        : <><WifiOff size={13} /> Offline — messages will still send, but won't arrive instantly{socketError ? ` (${socketError})` : ""}</>}
    </div>
  );
};

// ── Message bubble + list ───────────────────────────────────────────
const MessageBubble = ({ msg, isOwn }) => (
  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
    style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start", padding: "2px 14px" }}>
    <div style={{
      maxWidth: "72%", padding: "9px 13px", borderRadius: isOwn ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
      background: isOwn ? `linear-gradient(135deg,${C.indigo},${C.indigoLt})` : C.surface2,
      color: isOwn ? "#fff" : C.txt,
      border: isOwn ? "none" : `1px solid ${C.border}`,
      fontSize: 13.5, lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap",
    }}>
      {msg.message}
      <div style={{
        display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end",
        marginTop: 4, fontSize: 10, opacity: 0.75,
      }}>
        {formatBubbleTime(msg.createdAt)}
        {isOwn && (msg.read ? <CheckCheck size={12} /> : <Check size={12} />)}
      </div>
    </div>
  </motion.div>
);

const MessageList = ({ messages, myModel, typingLabel, loading, error, onRetry, emptyHint }) => {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typingLabel]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.txt2 }}>
        <Loader2 size={22} color={C.indigo} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: C.rose, padding: 20, textAlign: "center" }}>
        <WifiOff size={22} />
        <div style={{ fontSize: 13 }}>{error}</div>
        {onRetry && <Btn size="sm" variant="ghost" onClick={onRetry}><RefreshCw size={12} />Retry</Btn>}
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: C.txt2, padding: 20, textAlign: "center" }}>
        <Inbox size={26} color={C.dim} />
        <div style={{ fontSize: 13 }}>{emptyHint || "No messages yet — say hello!"}</div>
      </div>
    );
  }

  let lastDay = null;
  return (
    <div ref={containerRef} style={{ flex: 1, overflowY: "auto", padding: "14px 0", display: "flex", flexDirection: "column", gap: 4 }}>
      {messages.map((msg) => {
        const day = formatDaySeparator(msg.createdAt);
        const showSeparator = day !== lastDay;
        lastDay = day;
        return (
          <div key={msg._id}>
            {showSeparator && (
              <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: C.txt2, background: "rgba(127,127,127,0.08)", padding: "3px 12px", borderRadius: 20, letterSpacing: 0.5 }}>{day}</span>
              </div>
            )}
            <MessageBubble msg={msg} isOwn={msg.senderModel === myModel} />
          </div>
        );
      })}
      {typingLabel && <TypingIndicator label={typingLabel} />}
      <div ref={bottomRef} />
    </div>
  );
};

const MessageInput = ({ onSend, onTypingChange, disabled, placeholder = "Type your message…" }) => {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const typingTimeoutRef = useRef(null);

  const handleChange = (e) => {
    setValue(e.target.value);
    onTypingChange?.(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTypingChange?.(false), 1500);
  };

  const submit = async () => {
    const text = value.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    clearTimeout(typingTimeoutRef.current);
    onTypingChange?.(false);
    const ok = await onSend(text);
    setSending(false);
    if (ok !== false) setValue("");
  };

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: "12px 14px", borderTop: `1px solid ${C.border}` }}>
      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
        style={{
          flex: 1, resize: "none", maxHeight: 100, minHeight: 38, padding: "9px 14px",
          borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)",
          color: C.txt, fontFamily: F, fontSize: 13.5, outline: "none", lineHeight: 1.4,
        }}
        onFocus={e => e.target.style.borderColor = C.indigo}
        onBlur={e => e.target.style.borderColor = C.border}
      />
      <Btn onClick={submit} disabled={disabled || sending || !value.trim()} style={{ height: 38 }}>
        {sending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
      </Btn>
    </div>
  );
};

// ── Chat window (shared by both student + admin views) ─────────────
const ChatWindow = ({
  headerIcon, title, subtitle, messages, myModel, loading, error, onRetry,
  connected, connecting, socketError, typingLabel, onSend, onTypingChange,
  disabled, emptyHint, mobileBackButton,
}) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
      {mobileBackButton}
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${C.indigo}18`, display: "flex", alignItems: "center", justifyContent: "center", color: C.indigo, flexShrink: 0 }}>
        {headerIcon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.txt, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: C.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>}
      </div>
      <div title={connected ? "Connected" : connecting ? "Reconnecting" : "Offline"} style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? C.emerald : connecting ? C.amber : C.rose, flexShrink: 0 }} />
    </div>
    <ConnectionBanner connected={connected} connecting={connecting} socketError={socketError} />
    <MessageList messages={messages} myModel={myModel} typingLabel={typingLabel} loading={loading} error={error} onRetry={onRetry} emptyHint={emptyHint} />
    <MessageInput onSend={onSend} onTypingChange={onTypingChange} disabled={disabled} />
  </div>
);

// ── Admin: conversation list ────────────────────────────────────────
const ConversationItem = ({ conv, active, onClick }) => {
  const name = conv.student?.name || "Unknown student";
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
      padding: "10px 12px", borderRadius: 12, border: "none", cursor: "pointer",
      background: active ? `${C.indigo}18` : "transparent",
      borderLeft: active ? `2px solid ${C.indigo}` : "2px solid transparent",
      fontFamily: F,
    }}>
      <Avatar name={name} size={38} color={C.indigo} img={conv.student?.photo || undefined} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: conv.unreadCount ? 800 : 600, color: C.txt, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
          <span style={{ fontSize: 10, color: C.txt2, flexShrink: 0 }}>{formatListTime(conv.lastMessageAt)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 11.5, color: conv.unreadCount ? C.txt : C.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {conv.lastMessage || "No messages yet"}
          </span>
          <UnreadBadge count={conv.unreadCount} />
        </div>
      </div>
    </button>
  );
};

const ConversationList = ({ conversations, activeId, onSelect, loading, error, onRetry }) => {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(c =>
      (c.student?.name || "").toLowerCase().includes(q) ||
      (c.student?.rollNo || "").toLowerCase().includes(q)
    );
  }, [conversations, search]);

  return (
    <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ padding: "14px 14px 10px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.txt, marginBottom: 10 }}>Conversations</div>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.txt2 }} />
          <Input placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {loading && (
          <div style={{ padding: 30, textAlign: "center", color: C.txt2 }}><Loader2 size={18} color={C.indigo} style={{ animation: "spin 1s linear infinite" }} /></div>
        )}
        {!loading && error && (
          <div style={{ padding: 20, textAlign: "center", color: C.rose, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
            {error}
            {onRetry && <Btn size="xs" variant="ghost" onClick={onRetry}><RefreshCw size={11} />Retry</Btn>}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 30, textAlign: "center", color: C.txt2, fontSize: 12.5 }}>
            {conversations.length === 0 ? "No conversations yet" : "No matches"}
          </div>
        )}
        {!loading && !error && filtered.map(c => (
          <ConversationItem key={c._id} conv={c} active={c._id === activeId} onClick={() => onSelect(c)} />
        ))}
      </div>
    </div>
  );
};

function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

// Appends a message unless one with the same _id is already present — a
// message can arrive both as the direct result of sending it (socket ack or
// REST response) and via the `receive_message` broadcast the sender's own
// socket is also subscribed to; this keeps that idempotent either way.
function appendMessage(list, msg) {
  if (!msg?._id) return list;
  if (list.some(m => m._id === msg._id)) return list;
  return [...list, msg];
}

// ═══════════════════════════════════════════════════════════════════
//  STUDENT CHAT PAGE
// ═══════════════════════════════════════════════════════════════════
export const StudentChatPage = ({ api, token }) => {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typingLabel, setTypingLabel] = useState(null);
  const typingClearRef = useRef(null);
  const conversationRef = useRef(null);
  conversationRef.current = conversation;

  const socket = useChatSocket(token, {
    onReceiveMessage: (msg) => {
      if (String(msg.conversation) !== String(conversationRef.current?._id)) return;
      setMessages(prev => appendMessage(prev, msg));
      if (msg.senderModel === "Admin") socket.markRead(msg.conversation);
    },
    onTyping: () => {
      setTypingLabel("Support");
      clearTimeout(typingClearRef.current);
      typingClearRef.current = setTimeout(() => setTypingLabel(null), 4000);
    },
    onStopTyping: () => { clearTimeout(typingClearRef.current); setTypingLabel(null); },
    onMessageRead: () => {
      setMessages(prev => prev.map(m => (m.senderModel === "Student" ? { ...m, read: true } : m)));
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const conv = await api.openConversation();
      setConversation(conv);
      const history = await api.getChatMessages(conv._id);
      setMessages(history);
      api.markConversationRead(conv._id).catch(() => {});
    } catch (e) {
      setError(e.message || "Failed to load chat");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket.connected || !conversation?._id) return;
    socket.joinConversation(conversation._id);
    socket.markRead(conversation._id);
  }, [socket.connected, conversation?._id]);

  const handleSend = async (text) => {
    if (!conversation?._id) return false;
    if (socket.connected) {
      const ack = await socket.sendMessage(conversation._id, text);
      if (ack.ok) { setMessages(prev => appendMessage(prev, ack.message)); return true; }
    }
    // Socket unavailable or the send failed over it — fall back to REST so
    // the message still goes out and gets persisted.
    try {
      const msg = await api.sendChatMessage(conversation._id, text);
      setMessages(prev => appendMessage(prev, msg));
      return true;
    } catch (e) {
      setError(e.message || "Failed to send message");
      return false;
    }
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 160px)", minHeight: 420 }}>
      <ChatWindow
        headerIcon={<Shield size={17} />}
        title="Admin Support"
        subtitle="We usually reply within a few hours"
        messages={messages}
        myModel="Student"
        loading={loading}
        error={error}
        onRetry={load}
        connected={socket.connected}
        connecting={socket.connecting}
        socketError={socket.socketError}
        typingLabel={typingLabel}
        onSend={handleSend}
        onTypingChange={(t) => (t ? socket.startTyping : socket.stopTyping)(conversation?._id)}
        disabled={!conversation}
        emptyHint="No messages yet — ask us anything about attendance, fees, or classes."
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  ADMIN CHAT PAGE
// ═══════════════════════════════════════════════════════════════════
export const AdminChatPage = ({ api, token }) => {
  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState(null);
  const [typingLabel, setTypingLabel] = useState(null);
  const typingClearRef = useRef(null);
  const selectedRef = useRef(null);
  selectedRef.current = selected;
  const isMobile = useIsMobile();

  const loadConversations = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      setConversations(await api.getConversations());
    } catch (e) {
      setListError(e.message || "Failed to load conversations");
    } finally {
      setListLoading(false);
    }
  }, [api]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const bumpConversation = useCallback((conversationId, patch) => {
    setConversations(prev => {
      const idx = prev.findIndex(c => String(c._id) === String(conversationId));
      if (idx === -1) return prev;
      const updated = { ...prev[idx], ...patch };
      const rest = prev.filter((_, i) => i !== idx);
      return [updated, ...rest];
    });
  }, []);

  const socket = useChatSocket(token, {
    onReceiveMessage: (msg) => {
      const isOpen = String(msg.conversation) === String(selectedRef.current?._id);
      if (isOpen) {
        setMessages(prev => appendMessage(prev, msg));
        if (msg.senderModel === "Student") socket.markRead(msg.conversation);
      }
      bumpConversation(msg.conversation, { lastMessage: msg.message, lastMessageAt: msg.createdAt });
      if (!isOpen && msg.senderModel === "Student") {
        setConversations(prev => prev.map(c => String(c._id) === String(msg.conversation) ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c));
      }
    },
    onConversationUpdated: (data) => {
      if (String(data.conversationId) === String(selectedRef.current?._id)) return; // already handled via receive_message
      bumpConversation(data.conversationId, { lastMessage: data.lastMessage, lastMessageAt: data.lastMessageAt });
    },
    onTyping: () => {
      setTypingLabel("Student");
      clearTimeout(typingClearRef.current);
      typingClearRef.current = setTimeout(() => setTypingLabel(null), 4000);
    },
    onStopTyping: () => { clearTimeout(typingClearRef.current); setTypingLabel(null); },
    onMessageRead: () => {
      setMessages(prev => prev.map(m => (m.senderModel === "Admin" ? { ...m, read: true } : m)));
    },
  });

  const openConversation = async (conv) => {
    if (selected?._id && socket.connected) socket.leaveConversation(selected._id);
    setSelected(conv);
    setMessages([]);
    setMsgLoading(true);
    setMsgError(null);
    setConversations(prev => prev.map(c => c._id === conv._id ? { ...c, unreadCount: 0 } : c));
    try {
      setMessages(await api.getChatMessages(conv._id));
      api.markConversationRead(conv._id).catch(() => {});
      if (socket.connected) { socket.joinConversation(conv._id); socket.markRead(conv._id); }
    } catch (e) {
      setMsgError(e.message || "Failed to load messages");
    } finally {
      setMsgLoading(false);
    }
  };

  useEffect(() => {
    if (socket.connected && selected?._id) { socket.joinConversation(selected._id); socket.markRead(selected._id); }
  }, [socket.connected]);

  const handleSend = async (text) => {
    if (!selected?._id) return false;
    if (socket.connected) {
      const ack = await socket.sendMessage(selected._id, text);
      if (ack.ok) {
        setMessages(prev => appendMessage(prev, ack.message));
        bumpConversation(selected._id, { lastMessage: text, lastMessageAt: ack.message.createdAt });
        return true;
      }
    }
    try {
      const msg = await api.sendChatMessage(selected._id, text);
      setMessages(prev => appendMessage(prev, msg));
      bumpConversation(selected._id, { lastMessage: text, lastMessageAt: msg.createdAt });
      return true;
    } catch (e) {
      setMsgError(e.message || "Failed to send message");
      return false;
    }
  };

  const showList = !isMobile || !selected;
  const showChat = !isMobile || !!selected;

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 160px)", minHeight: 420 }}>
      {showList && (
        <ConversationList
          conversations={conversations}
          activeId={selected?._id}
          onSelect={openConversation}
          loading={listLoading}
          error={listError}
          onRetry={loadConversations}
        />
      )}
      {showChat && (
        selected ? (
          <ChatWindow
            headerIcon={<User size={17} />}
            title={selected.student?.name || "Student"}
            subtitle={selected.student?.rollNo ? `Roll #${selected.student.rollNo}` : ""}
            messages={messages}
            myModel="Admin"
            loading={msgLoading}
            error={msgError}
            onRetry={() => openConversation(selected)}
            connected={socket.connected}
            connecting={socket.connecting}
            socketError={socket.socketError}
            typingLabel={typingLabel}
            onSend={handleSend}
            onTypingChange={(t) => (t ? socket.startTyping : socket.stopTyping)(selected?._id)}
            disabled={false}
            emptyHint="No messages in this conversation yet."
            mobileBackButton={isMobile ? (
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.txt2, display: "flex", padding: 4 }}>
                <ArrowLeft size={17} />
              </button>
            ) : null}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.txt2, background: C.surface, borderRadius: 18, border: `1px solid ${C.border}` }}>
            <div style={{ textAlign: "center" }}>
              <MessageSquare size={28} color={C.dim} />
              <div style={{ marginTop: 8, fontSize: 13 }}>Select a conversation to start chatting</div>
            </div>
          </div>
        )
      )}
    </div>
  );
};
