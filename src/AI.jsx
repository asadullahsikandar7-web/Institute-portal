// ═══════════════════════════════════════════════════════════════════
//  ACADEXA AI — frontend. Talks only to /api/ai/... (via the api object
//  passed down from the page, same makeApi() client every other page
//  uses — no separate AI API client). Reuses shared UI primitives from
//  asad.jsx exactly like Chat.jsx does, and for the same reason avoids a
//  static circular import (see the lazy-load comment in asad.jsx).
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, Mic, MicOff, Volume2, X, Loader2, Copy, Check,
  AlertTriangle, CreditCard, GraduationCap, Activity, CalendarDays, MessageSquare,
} from "lucide-react";
import { C, F, Card, Btn, useToast } from "./asad.jsx";

// ── Voice: browser-native Web Speech API ────────────────────────────
// First-version voice per the brief ("browser-native speech APIs are
// sufficient for a first version, ensure the architecture can later
// support server-side speech services"). Voice only ever produces text
// that's sent through the exact same /api/ai/chat path as typed input —
// there is no separate voice-specific AI path, so it inherits identical
// auth/permission/confirmation behavior automatically.
function useVoice() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const supportsSTT = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const supportsTTS = typeof window !== "undefined" && !!window.speechSynthesis;

  const listen = useCallback(() => new Promise((resolve) => {
    if (!supportsSTT) return resolve(null);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;
    setListening(true);
    rec.onresult = (e) => resolve(e.results[0]?.[0]?.transcript || null);
    rec.onerror = () => resolve(null);
    rec.onend = () => setListening(false);
    rec.start();
  }), [supportsSTT]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const speak = useCallback((text) => {
    if (!supportsTTS || !text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.replace(/[✨📊📚💰🗓📝🎙️⚠️💡]/gu, ""));
    utter.rate = 1.02;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, [supportsTTS]);

  const stopSpeaking = useCallback(() => { window.speechSynthesis?.cancel(); setSpeaking(false); }, []);

  return { listen, stopListening, listening, speak, stopSpeaking, speaking, supportsSTT, supportsTTS };
}

// ── AI conversation state/networking ────────────────────────────────
function useAiChat(api) {
  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', content}
  const [pendingActions, setPendingActions] = useState([]); // [{tool,actionId,preview,resolved?}]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const send = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setLoading(true);
    try {
      const res = await api.aiChat(trimmed, history);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      if (res.pendingActions?.length) {
        setPendingActions((prev) => [...prev, ...res.pendingActions.map((a) => ({ ...a, resolved: null }))]);
      }
    } catch (e) {
      setError(e.message || "ACADEXA AI is temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [api, messages, loading]);

  const resolveAction = useCallback((actionId, status, resultMessage) => {
    setPendingActions((prev) => prev.map((a) => (a.actionId === actionId ? { ...a, resolved: status } : a)));
    if (resultMessage) setMessages((prev) => [...prev, { role: "assistant", content: resultMessage }]);
  }, []);

  const confirmAction = useCallback(async (actionId) => {
    try {
      const res = await api.aiConfirmAction(actionId);
      resolveAction(actionId, "confirmed", `✅ ${res.message || "Done."}`);
    } catch (e) {
      resolveAction(actionId, "error", `⚠️ ${e.message || "That action failed."}`);
    }
  }, [api, resolveAction]);

  const cancelAction = useCallback(async (actionId) => {
    try {
      await api.aiCancelAction(actionId);
      resolveAction(actionId, "cancelled", "Okay, cancelled — nothing was submitted.");
    } catch {
      resolveAction(actionId, "cancelled", "Cancelled.");
    }
  }, [api, resolveAction]);

  const reset = useCallback(() => { setMessages([]); setPendingActions([]); setError(null); }, []);

  return { messages, pendingActions, loading, error, send, confirmAction, cancelAction, reset };
}

// ── UI bits ──────────────────────────────────────────────────────────
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 700, color: copied ? C.emerald : C.txt2, cursor: "pointer", fontFamily: F }}>
      {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copied" : "Copy"}
    </button>
  );
};

const ActionConfirmCard = ({ action, onConfirm, onCancel }) => {
  const { preview, tool, actionId, resolved } = action;
  const isLeave = tool === "createLeaveRequest";
  const isBulk = tool === "sendParentEmailsBulk";

  if (resolved) {
    return (
      <div style={{ padding: "10px 14px", borderRadius: 12, background: resolved === "error" ? `${C.rose}12` : `${C.emerald}12`, border: `1px solid ${resolved === "error" ? C.rose : C.emerald}30`, fontSize: 12.5, color: resolved === "error" ? C.rose : C.emerald, fontWeight: 600 }}>
        {resolved === "confirmed" ? "✅ Confirmed" : resolved === "cancelled" ? "Cancelled" : "⚠️ Failed"}
      </div>
    );
  }

  return (
    <Card style={{ padding: 16, border: `1.5px solid ${C.indigo}40` }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.indigo, letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <AlertTriangle size={13} /> Confirm {isLeave ? "Leave Request" : isBulk ? `Sending ${preview.count} Emails` : "Sending Email"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: C.txt, marginBottom: 14 }}>
        {isLeave && (<>
          <div><b>From:</b> {preview.from}</div>
          <div><b>To:</b> {preview.to} ({preview.days} day{preview.days > 1 ? "s" : ""})</div>
          <div><b>Type:</b> {preview.type}</div>
          <div><b>Reason:</b> {preview.reason}</div>
        </>)}
        {tool === "sendParentEmail" && (<>
          <div><b>To:</b> {preview.studentName}'s parent ({preview.parentEmail})</div>
          <div><b>Subject:</b> {preview.subject}</div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 10, whiteSpace: "pre-wrap" }}>{preview.message}</div>
        </>)}
        {isBulk && (
          <div>{preview.items.map((it, i) => <div key={i} style={{ padding: "4px 0" }}>• {it.studentName} ({it.parentEmail})</div>)}</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn size="sm" variant="ghost" onClick={() => onCancel(actionId)} style={{ flex: 1, justifyContent: "center" }}>Cancel</Btn>
        <Btn size="sm" onClick={() => onConfirm(actionId)} style={{ flex: 1, justifyContent: "center" }}>Confirm{isLeave ? " & Submit" : " & Send"}</Btn>
      </div>
    </Card>
  );
};

const QUICK_ACTIONS = {
  student: [
    { icon: Activity, label: "Analyze My Attendance", prompt: "How is my attendance? Give me a quick summary." },
    { icon: GraduationCap, label: "Analyze My Grades", prompt: "Check my grades and tell me which subject needs the most improvement." },
    { icon: CreditCard, label: "Check My Fee", prompt: "Check my fee status." },
    { icon: CalendarDays, label: "Create Study Plan", prompt: "Create a study plan for me based on my current grades." },
    { icon: MessageSquare, label: "Request Leave", prompt: "I'd like to request leave." },
  ],
  admin: [
    { icon: Activity, label: "Today's Absentees", prompt: "Show me students who are absent today." },
    { icon: GraduationCap, label: "Grade Statistics", prompt: "Give me the school-wide grade statistics." },
    { icon: CreditCard, label: "Fee Statistics", prompt: "Give me a summary of fee statistics." },
    { icon: Activity, label: "Attendance Overview", prompt: "Give me the attendance statistics and which students need attention." },
  ],
};

export const AIPanel = ({ api, role, onClose }) => {
  const { messages, pendingActions, loading, error, send, confirmAction, cancelAction } = useAiChat(api);
  const voice = useVoice();
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, pendingActions.length]);

  const submit = (text) => {
    const t = (text ?? input).trim();
    if (!t) return;
    send(t);
    setInput("");
  };

  const handleMic = async () => {
    if (voice.listening) { voice.stopListening(); return; }
    const transcript = await voice.listen();
    if (transcript) submit(transcript);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }}
      style={{ position: "fixed", bottom: 24, right: 24, width: 400, maxWidth: "calc(100vw - 32px)", height: 600, maxHeight: "calc(100vh - 100px)", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, boxShadow: "0 24px 70px rgba(2,3,12,0.35)", display: "flex", flexDirection: "column", zIndex: 1010, overflow: "hidden", fontFamily: F }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${C.border}`, background: `linear-gradient(135deg,${C.indigo}14,transparent)` }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg,${C.indigo},${C.indigoLt})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Sparkles size={16} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.txt }}>ACADEXA AI</div>
          <div style={{ fontSize: 11, color: C.txt2 }}>Your intelligent academic assistant</div>
        </div>
        {voice.speaking && (
          <button onClick={voice.stopSpeaking} title="Stop speaking" style={{ background: "none", border: "none", cursor: "pointer", color: C.indigo, display: "flex" }}><Volume2 size={16} /></button>
        )}
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 6, cursor: "pointer", color: C.txt2, display: "flex" }}><X size={14} /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12.5, color: C.txt2, marginBottom: 4 }}>Quick actions:</div>
            {QUICK_ACTIONS[role]?.map((qa) => {
              const Icon = qa.icon;
              return (
                <button key={qa.label} onClick={() => submit(qa.prompt)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)", color: C.txt, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: F, textAlign: "left" }}>
                  <Icon size={14} color={C.indigo} /> {qa.label}
                </button>
              );
            })}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
            <div style={{
              maxWidth: "88%", padding: "9px 13px", borderRadius: m.role === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
              background: m.role === "user" ? `linear-gradient(135deg,${C.indigo},${C.indigoLt})` : C.surface2,
              color: m.role === "user" ? "#fff" : C.txt, border: m.role === "user" ? "none" : `1px solid ${C.border}`,
              fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>{m.content}</div>
            {m.role === "assistant" && m.content && <CopyButton text={m.content} />}
          </div>
        ))}
        {pendingActions.map((a) => <ActionConfirmCard key={a.actionId} action={a} onConfirm={confirmAction} onCancel={cancelAction} />)}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.txt2, fontSize: 12 }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Thinking…
          </div>
        )}
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: `${C.rose}12`, border: `1px solid ${C.rose}30`, color: C.rose, fontSize: 12.5 }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: 12, borderTop: `1px solid ${C.border}` }}>
        {voice.supportsSTT && (
          <button onClick={handleMic} title={voice.listening ? "Stop listening" : "Voice input"}
            style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${voice.listening ? C.rose : C.border}`, background: voice.listening ? `${C.rose}18` : "rgba(255,255,255,0.04)", color: voice.listening ? C.rose : C.txt2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {voice.listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Ask ACADEXA anything…"
          rows={1}
          style={{ flex: 1, resize: "none", maxHeight: 90, minHeight: 38, padding: "9px 13px", borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.txt, fontFamily: F, fontSize: 13, outline: "none" }}
          onFocus={(e) => e.target.style.borderColor = C.indigo} onBlur={(e) => e.target.style.borderColor = C.border} />
        <Btn onClick={() => submit()} disabled={loading || !input.trim()} style={{ height: 38 }}><Send size={14} /></Btn>
      </div>
    </motion.div>
  );
};

export const AIFloatingButton = ({ onClick, open }) => {
  const [hovered, setHovered] = useState(false);
  return (
    // bottom:76 (not 24) so this clears the app's fixed .signature-footer bar
    // (position:fixed, bottom:0, ~50px tall, z-index:1000) — at 24 the
    // button's lower edge overlapped the footer's "Feedback" link, which both
    // visually collided and (since the footer paints on top) could swallow
    // clicks meant for this button. zIndex still raised above the footer's
    // 1000 as a second layer of defense.
    <div
      style={{ position: "fixed", bottom: 76, right: 24, zIndex: 1010, display: open ? "none" : "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <AnimatePresence>
        {hovered && (
          <motion.div initial={{ opacity: 0, x: 8, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 8, scale: 0.94 }}
            transition={{ duration: 0.18 }}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, color: C.txt, boxShadow: "0 10px 28px rgba(2,3,12,0.3)", whiteSpace: "nowrap" }}>
            ✨ Ask ACADEXA
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={onClick}
        style={{ position: "relative", width: 60, height: 60, borderRadius: "50%", border: "none", cursor: "pointer", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* radar-ping rings — the "alive, listening" cue */}
        {[0, 1].map((i) => (
          <motion.span key={i}
            initial={{ scale: 1, opacity: 0.55 }}
            animate={{ scale: [1, 1.85], opacity: [0.55, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 1.2, ease: "easeOut" }}
            style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `1.5px solid ${C.indigoLt}`, pointerEvents: "none" }} />
        ))}
        {/* soft ambient glow, breathing */}
        <motion.div
          animate={{ opacity: [0.45, 0.85, 0.45] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: -6, borderRadius: "50%", background: `radial-gradient(circle,${C.indigo}66,transparent 70%)`, filter: "blur(7px)", pointerEvents: "none" }} />
        {/* main orb */}
        <motion.div
          animate={{ scale: [1, 1.045, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "relative", width: 56, height: 56, borderRadius: "50%",
            background: `linear-gradient(135deg,${C.indigo},${C.violet} 55%,${C.indigoLt})`,
            backgroundSize: "200% 200%",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 8px 28px ${C.indigo}60, inset 0 1px 1px rgba(255,255,255,0.3)`,
          }}>
          <motion.div animate={{ rotate: [0, 14, -10, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}>
            <Sparkles size={23} color="#fff" strokeWidth={2.2} />
          </motion.div>
        </motion.div>
        {/* "your partner is here" status dot */}
        <span style={{ position: "absolute", top: 1, right: 1, width: 11, height: 11, borderRadius: "50%", background: C.emerald, border: `2px solid ${C.bg}`, boxShadow: `0 0 6px ${C.emerald}` }} />
      </motion.button>
    </div>
  );
};

// ── Contextual suggestion — reusable, data-driven, shown on specific
// pages. Purely computed from data the page already has (no extra
// network calls), so it never fabricates a stat that isn't real.
export const AISuggestion = ({ text, actionLabel, onAction, tone = "indigo" }) => (
  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, background: `${C[tone]}0f`, border: `1px solid ${C[tone]}30`, marginBottom: 16, flexWrap: "wrap" }}>
    <Sparkles size={15} color={C[tone]} style={{ flexShrink: 0 }} />
    <div style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: C.txt, fontWeight: 600 }}>
      <span style={{ color: C[tone], fontWeight: 800 }}>✨ ACADEXA Suggestion</span>
      <div style={{ marginTop: 2, fontWeight: 500, color: C.txt2 }}>{text}</div>
    </div>
    {actionLabel && <Btn size="sm" onClick={onAction}>{actionLabel}</Btn>}
  </motion.div>
);
