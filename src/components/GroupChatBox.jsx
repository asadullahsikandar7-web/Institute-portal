import { useEffect, useRef, useState } from "react";
import { Icon, Btn } from "./ui/index.js";
import { fmtTime } from "../lib/utils.js";

// Polling-based subject/section group chat — distinct from the socket-backed
// 1:1 support chat in Chat.jsx. Used by both the teacher (class chat
// management) and student (academic groups) sides.
export default function GroupChatBox({ messages, loading, onSend, myModel, disabled, placeholder, height = 420 }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages?.length]);
  const submit = () => { if (!text.trim() || disabled) return; onSend(text.trim()); setText(""); };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", height, overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ margin: "auto", color: "var(--muted)" }}>Loading…</div>
        ) : !messages || messages.length === 0 ? (
          <div style={{ margin: "auto", color: "var(--muted)", fontSize: 13, textAlign: "center" }}>
            <Icon name="message" size={22} style={{ opacity: 0.3, display: "block", margin: "0 auto 8px" }} />
            No messages yet. Say hello.
          </div>
        ) : messages.map(m => {
          const own = m.senderModel === myModel;
          return (
            // Full-width flex row first, THEN a maxWidth child — the bubble's
            // percentage width needs a definite-width containing block to
            // resolve against. Without this outer row (see the fixed bug),
            // an alignSelf'd shrink-to-fit wrapper made that percentage
            // ambiguous and short, unbreakable strings could render wider
            // than the panel and get clipped by its overflow:hidden.
            <div key={m._id} style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "78%", minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2, textAlign: own ? "right" : "left", fontWeight: 700 }}>
                  {own ? "You" : m.senderModel} · {fmtTime(m.createdAt)}
                </div>
                <div className="chat-bubble" style={{
                  background: own ? "var(--accent)" : "var(--surface-alt)",
                  color: own ? "#1a1204" : "var(--ink)",
                  borderRadius: own ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
                }}>
                  {m.message}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="msg-input-bar">
        <input
          className="input"
          value={text}
          disabled={disabled}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={disabled ? "This group is announcement-only" : (placeholder || "Type a message…")}
        />
        <Btn variant="accent" onClick={submit} disabled={disabled || !text.trim()}><Icon name="send" size={14} /></Btn>
      </div>
    </div>
  );
}
