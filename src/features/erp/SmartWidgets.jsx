import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Badge, Btn, Icon, Modal, EmptyState, Portal } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { NAV, adminCan, inPlan } from "../../lib/constants.js";
import { fmt, fmtTime, fmtTime12h, humanize, statusMeta, today } from "../../lib/utils.js";
import { useLoad, useAction } from "./hooks.js";

// Cross-cutting pieces of the smart layer that live inside other screens:
// the "needs attention" feed, notification bell, command palette, live
// attendance check-in, fee payment claims and the timetable generator.

// ═══════════════════════════ NEEDS ATTENTION ═══════════════════════════════
// Top of every dashboard: what is waiting on this person, each row a link
// to where it gets done. Renders nothing while loading or when all clear
// would be noise — an explicit "all caught up" line is shown instead.
export function AttentionCard() {
  const navigate = useNavigate();
  const [items, , loading] = useLoad("/api/smart/today", []);
  if (loading) return null;
  const list = items || [];
  return (
    <Card style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: list.length ? 12 : 0 }}>
        <Icon name={list.length ? "alert" : "check"} size={15} />
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase" }}>{list.length ? "Needs your attention" : "You're all caught up"}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 8 }}>
        {list.map(it => (
          <button key={it.key} onClick={() => navigate(it.to)} className="search-hit" style={{ border: "1px solid var(--border)", background: "var(--surface-alt)", textAlign: "left", font: "inherit", color: "inherit", width: "100%" }}>
            {/^[A-Z]/.test(it.label) ? <Badge tone={it.tone}>!</Badge> : <Badge tone={it.tone}>{it.count}</Badge>}
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{it.label}</span>
            <Icon name="chevronRight" size={13} />
          </button>
        ))}
      </div>
    </Card>
  );
}

// ═══════════════════════════ NOTIFICATION BELL ═════════════════════════════
export function NotificationBell() {
  const { api } = useSession();
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);

  const load = () => api.call("GET", "/api/smart/inbox").then(setData).catch(() => {});
  useEffect(() => {
    load();
    // Light polling keeps the badge fresh without needing the socket server
    // (which doesn't exist on the serverless deployment).
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [api]);

  const openItem = async n => {
    setOpen(false);
    if (!n.isRead) { await api.call("POST", "/api/smart/inbox/read", { id: n._id }).catch(() => {}); load(); }
    if (n.actionUrl) navigate(n.actionUrl);
  };
  const readAll = () => api.call("POST", "/api/smart/inbox/read", {}).then(load).catch(() => {});

  return (
    <div style={{ position: "relative" }}>
      <button className="icon-btn" onClick={() => { setOpen(o => !o); if (!open) load(); }} aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ""}`} style={{ position: "relative" }}>
        <Icon name="bell" size={16} />
        {data.unread > 0 && <span style={{ position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 99, background: "var(--danger)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{data.unread > 9 ? "9+" : data.unread}</span>}
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div className="card" style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, width: 340, maxWidth: "86vw", maxHeight: 440, overflowY: "auto", zIndex: 50, padding: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Notifications</div>
              {data.unread > 0 && <button onClick={readAll} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Mark all read</button>}
            </div>
            {data.items.length === 0 && <div style={{ padding: "18px 12px", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>Nothing yet. Fee, result, exam and helpdesk updates will appear here.</div>}
            {data.items.map(n => (
              <div key={n._id} className="search-hit" style={{ alignItems: "flex-start" }} onClick={() => openItem(n)}>
                <span style={{ width: 8, height: 8, borderRadius: 99, marginTop: 6, flexShrink: 0, background: n.isRead ? "transparent" : "var(--accent)" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.isRead ? 500 : 700 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45 }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{fmt(n.sentAt)} · {fmtTime(n.sentAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════ COMMAND PALETTE ═══════════════════════════════
// Ctrl/⌘+K from anywhere: jump to any screen in the current portal by name.
// For admins it also searches records (students, staff, books, tickets…).
export function CommandPalette() {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [records, setRecords] = useState([]);
  const inputRef = useRef(null);
  const role = session?.role;

  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(o => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) { setQ(""); setActive(0); setRecords([]); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  const pages = useMemo(() => !role ? [] : NAV[role].flatMap(sec => sec.items.filter(it => !it.locked && inPlan(session, it) && (role !== "admin" || adminCan(session, it.module)))
    .map(it => ({ kind: sec.label || "Go to", title: it.label, to: `/${role}/${it.key}`, icon: it.icon }))), [role, session]);

  useEffect(() => {
    if (!open || role !== "admin" || q.trim().length < 2) { setRecords([]); return; }
    let cancelled = false;
    const t = setTimeout(() => api.call("GET", `/api/system/search?q=${encodeURIComponent(q.trim())}`).then(r => { if (!cancelled) setRecords(r.map(x => ({ ...x, icon: "search" }))); }).catch(() => {}), 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open, role, api]);

  if (!open || !role) return null;
  const needle = q.trim().toLowerCase();
  const hits = [...pages.filter(p => !needle || `${p.title} ${p.kind}`.toLowerCase().includes(needle)), ...records].slice(0, 12);
  const go = h => { setOpen(false); navigate(h.to); };
  const onKeyDown = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === "Enter" && hits[active]) go(hits[active]);
  };

  return (
    <Portal>
      <div className="modal-overlay" style={{ alignItems: "flex-start", paddingTop: "12vh" }} onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div className="modal" style={{ maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <Icon name="search" size={16} />
            <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setActive(0); }} onKeyDown={onKeyDown} placeholder={role === "admin" ? "Jump to a page, or search students, staff, books…" : "Jump to a page…"}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--ink)", fontSize: 15, fontFamily: "inherit" }} />
            <span className="badge neutral">Esc</span>
          </div>
          <div style={{ padding: 6, maxHeight: "52vh", overflowY: "auto" }}>
            {hits.length === 0 && <div style={{ padding: 18, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>No matches.</div>}
            {hits.map((h, i) => (
              <div key={h.to + h.title + i} className="search-hit" style={{ background: i === active ? "var(--surface-alt)" : undefined }} onMouseEnter={() => setActive(i)} onClick={() => go(h)}>
                <Icon name={h.icon} size={15} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{h.title}</div>
                  {h.sub && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{h.sub}</div>}
                </div>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{h.kind}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ═══════════════════════════ LIVE ATTENDANCE ═══════════════════════════════
// Teacher side: project this on the board. The code changes every 30
// seconds; students type it into their own portal to mark themselves in.
export function LiveAttendancePanel({ cls, onChanged }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [sessionId, setSessionId] = useState(null);
  const [state, setState] = useState(null);
  const [minutes, setMinutes] = useState(5);

  useEffect(() => {
    if (!sessionId) return;
    let stopped = false;
    const poll = () => api.call("GET", `/api/smart/attendance/session/${sessionId}`).then(d => { if (!stopped) setState(d); }).catch(() => {});
    poll();
    const t = setInterval(poll, 3000);
    return () => { stopped = true; clearInterval(t); };
  }, [sessionId, api]);

  const start = () => run(() => api.call("POST", `/api/smart/attendance/${cls._id}/open`, { minutes })).then(s => { if (s) { setState(null); setSessionId(s._id); } });
  const finish = markAbsent => run(() => api.call("POST", `/api/smart/attendance/session/${sessionId}/close`, { markAbsent }), o => `Check-in closed — ${o.present} present${o.markedAbsent ? `, ${o.markedAbsent} marked absent` : ""}`)
    .then(o => { if (o) { setSessionId(null); setState(null); onChanged?.(); } });

  if (!sessionId) {
    return (
      <Card style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Live check-in</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Show a rotating code on the board and let students mark themselves present from their own phones.</div>
        </div>
        <select className="input" style={{ width: "auto" }} value={minutes} onChange={e => setMinutes(Number(e.target.value))}>{[3, 5, 10, 15].map(m => <option key={m} value={m}>Open for {m} min</option>)}</select>
        <Btn variant="accent" onClick={start} disabled={busy}><Icon name="clock" size={13} />Start Check-in</Btn>
      </Card>
    );
  }
  const live = state?.live;
  const secondsLeft = state ? Math.max(0, Math.round((new Date(state.expiresAt) - Date.now()) / 1000)) : 0;
  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ textAlign: "center", flex: "1 1 240px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1.2, textTransform: "uppercase" }}>{live ? "Attendance code" : "Check-in ended"}</div>
          <div className="font-display" style={{ fontSize: 64, fontWeight: 600, letterSpacing: 10, lineHeight: 1.15 }}>{state ? (live ? state.code : "— — —") : "······"}</div>
          {live && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>New code in {state.rotatesIn}s · closes in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</div>}
        </div>
        <div style={{ flex: "1 1 240px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{state?.checkedIn.length ?? 0} of {state?.total ?? "…"} checked in</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 120, overflowY: "auto" }}>
            {(state?.checkedIn || []).map(s => <Badge key={s._id} tone="success">{s.name}</Badge>)}
            {state && state.checkedIn.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Waiting for students…</span>}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        <Btn variant="accent" disabled={busy} onClick={() => finish(true)}>Close & mark everyone else absent</Btn>
        <Btn variant="ghost" disabled={busy} onClick={() => finish(false)}>Close only</Btn>
      </div>
    </Card>
  );
}

// Student side: appears on the dashboard only while one of their classes
// has check-in open.
export function AttendanceCheckIn() {
  const { api } = useSession();
  const toast = useToast();
  const [open, reload] = useLoad("/api/smart/attendance/open", []);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setInterval(reload, 20000); return () => clearInterval(t); }, [reload]);

  const pending = (open || []).filter(s => !s.done);
  if (!(open || []).length) return null;
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try { const r = await api.call("POST", "/api/smart/attendance/checkin", { code }); toast(`Marked present — ${r.subject}`, "check"); setCode(""); reload(); }
    catch (err) { toast(err.message, "alert"); }
    finally { setBusy(false); }
  };
  return (
    <Card style={{ padding: 20, marginBottom: 20, borderColor: "var(--accent)" }}>
      {pending.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 600 }}><Icon name="check" size={16} />You're marked present for {open.map(s => s.subject?.name).join(", ")}.</div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Attendance is open — {pending.map(s => s.subject?.name).join(", ")}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Enter the 6-digit code on your teacher's screen.</div>
          </div>
          <input className="input font-mono" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} style={{ width: 130, fontSize: 20, letterSpacing: 4, textAlign: "center" }} />
          <Btn type="submit" variant="accent" disabled={busy || code.length !== 6}>Mark Me Present</Btn>
        </form>
      )}
    </Card>
  );
}

// ═══════════════════════════ PAYMENT CLAIMS ════════════════════════════════
export function ClaimModal({ fee, onClose, onDone }) {
  const { api } = useSession();
  const { money } = useSettings();
  const [run, busy] = useAction();
  const [form, setForm] = useState({ amount: String(fee.balance), method: "bank", reference: "", paidOn: today(), note: "" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const valid = Number(form.amount) > 0 && Number(form.amount) <= fee.balance && form.reference.trim();
  return (
    <Modal title="Report a payment" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" disabled={busy || !valid} onClick={() => run(() => api.call("POST", "/api/smart/claims", { ...form, fee: fee._id, amount: Number(form.amount) }), "Sent to the accounts office for verification").then(r => r && onDone())}>Submit</Btn>
    </>}>
      <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>Paid “{fee.title}” at the bank or online? Give the accounts office your deposit details. The fee is marked paid once they have verified it — balance now: <strong>{money(fee.balance)}</strong>.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label className="field-label">Amount paid</label><input className="input" type="number" min="1" max={fee.balance} value={form.amount} onChange={e => set("amount", e.target.value)} /></div>
        <div><label className="field-label">Paid on</label><input className="input" type="date" max={today()} value={form.paidOn} onChange={e => set("paidOn", e.target.value)} /></div>
        <div><label className="field-label">How</label><select className="input" value={form.method} onChange={e => set("method", e.target.value)}>{["bank", "online", "card", "cheque"].map(m => <option key={m} value={m}>{humanize(m)}</option>)}</select></div>
        <div><label className="field-label">Transaction / deposit slip no.</label><input className="input" value={form.reference} onChange={e => set("reference", e.target.value)} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Note (optional)</label><input className="input" value={form.note} onChange={e => set("note", e.target.value)} /></div>
      </div>
    </Modal>
  );
}

// Accounts office: the verification queue, shown above the fee list.
export function ClaimsQueue({ onChanged }) {
  const { api } = useSession();
  const { money } = useSettings();
  const [run, busy] = useAction();
  const [claims, reload] = useLoad("/api/finance/claims?status=pending", []);
  const list = claims || [];
  if (!list.length) return null;
  const review = (c, decision) => {
    let note = "";
    if (decision === "reject") { note = window.prompt("Why is this claim being rejected? The student will see this."); if (!note?.trim()) return; }
    else if (!window.confirm(`Confirm ${money(c.amount)} from ${c.student?.name} (ref ${c.reference}) has arrived? This credits the fee and issues a receipt.`)) return;
    run(() => api.call("POST", `/api/finance/claims/${c._id}/review`, { decision, note }), decision === "approve" ? o => `Credited — receipt ${o.receiptNo}` : "Claim rejected").then(r => { if (r) { reload(); onChanged?.(); } });
  };
  return (
    <Card style={{ padding: 0, overflow: "auto", marginBottom: 20, borderColor: "var(--accent)" }}>
      <div style={{ padding: "14px 18px", fontWeight: 700, fontSize: 14 }}>Payments reported by students — verify against the bank statement ({list.length})</div>
      <table className="table">
        <thead><tr><th>Student</th><th>Fee</th><th>Amount</th><th>Method</th><th>Reference</th><th>Paid On</th><th /></tr></thead>
        <tbody>{list.map(c => (
          <tr key={c._id}>
            <td style={{ fontWeight: 600, color: "var(--ink)" }}>{c.student?.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>#{c.student?.rollNo}</span>{c.submittedByRole === "parent" && <> <Badge tone="neutral">by parent</Badge></>}</td>
            <td>{c.fee?.title}</td><td>{money(c.amount)}</td><td>{humanize(c.method)}</td><td className="font-mono">{c.reference}{c.note ? <div style={{ fontSize: 11.5, color: "var(--muted)", fontFamily: "inherit" }}>{c.note}</div> : null}</td><td>{fmt(c.paidOn)}</td>
            <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
              <Btn variant="accent" style={{ padding: "5px 10px", fontSize: 12, marginRight: 6 }} disabled={busy} onClick={() => review(c, "approve")}><Icon name="check" size={12} />Verify</Btn>
              <Btn variant="danger" style={{ padding: "5px 10px", fontSize: 12 }} disabled={busy} onClick={() => review(c, "reject")}>Reject</Btn>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </Card>
  );
}

// ═══════════════════════════ AUTO TIMETABLE ════════════════════════════════
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_SLOTS = [{ start: "08:30", end: "10:00" }, { start: "10:00", end: "11:30" }, { start: "11:30", end: "13:00" }, { start: "13:30", end: "15:00" }];

export function AutoTimetableModal({ onClose, onDone }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [sessions] = useLoad("/api/academic-sessions", []);
  const [session, setSession] = useState("");
  const [days, setDays] = useState(DAYS.slice(0, 5));
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [replace, setReplace] = useState(false);
  const [preview, setPreview] = useState(null);
  useEffect(() => { if (!session && sessions?.length) setSession((sessions.find(s => s.status === "active") || sessions[0])._id); }, [sessions]);

  const body = { academicSession: session, days, slots, replace };
  const generate = () => run(() => api.call("POST", "/api/smart/timetable/generate", body)).then(r => r && setPreview(r));
  const apply = () => {
    if (replace && !window.confirm("This deletes the session's current timetable and replaces it with the generated one. Continue?")) return;
    run(() => api.call("POST", "/api/smart/timetable/generate", { ...body, commit: true }), o => `${o.placed.length} period(s) added to the timetable`).then(r => r && onDone());
  };
  const patchSlot = (i, k, v) => { setSlots(p => p.map((s, j) => (j === i ? { ...s, [k]: v } : s))); setPreview(null); };
  const byDay = d => (preview?.placed || []).filter(p => p.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <Modal wide title="Generate Timetable" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant={preview ? "ghost" : "accent"} onClick={generate} disabled={busy || !session || !days.length}>{preview ? "Regenerate" : "Preview"}</Btn>
      {preview && <Btn variant="accent" onClick={apply} disabled={busy || preview.placed.length === 0}>Add {preview.placed.length} Periods to Timetable</Btn>}
    </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Places every class (one period per credit hour each week) so that no teacher, section or room is double-booked, rooms are big enough, and each section's week is spread out. Nothing is saved until you accept the preview.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <div><label className="field-label">Academic session</label>
            <select className="input" value={session} onChange={e => { setSession(e.target.value); setPreview(null); }}>{(sessions || []).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
          <div><label className="field-label">Existing timetable</label>
            <select className="input" value={replace ? "1" : ""} onChange={e => { setReplace(!!e.target.value); setPreview(null); }}><option value="">Keep it — only schedule what's missing</option><option value="1">Replace it entirely</option></select></div>
        </div>
        <div><label className="field-label">Teaching days</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{DAYS.map(d => {
            const on = days.includes(d);
            return <button key={d} className={"badge " + (on ? "accent" : "neutral")} style={{ border: "none", cursor: "pointer", padding: "6px 12px", fontFamily: "inherit", opacity: on ? 1 : 0.6 }} onClick={() => { setDays(p => DAYS.filter(x => (x === d ? !on : p.includes(x)))); setPreview(null); }}>{d}</button>;
          })}</div></div>
        <div><label className="field-label">Daily periods</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {slots.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 4, alignItems: "center", background: "var(--surface-alt)", borderRadius: 9, padding: "5px 8px" }}>
                <input className="input" type="time" style={{ width: 112, padding: "5px 6px" }} value={s.start} onChange={e => patchSlot(i, "start", e.target.value)} />–
                <input className="input" type="time" style={{ width: 112, padding: "5px 6px" }} value={s.end} onChange={e => patchSlot(i, "end", e.target.value)} />
                {slots.length > 1 && <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => { setSlots(p => p.filter((_, j) => j !== i)); setPreview(null); }}><Icon name="x" size={11} /></button>}
              </div>
            ))}
            <Btn variant="ghost" onClick={() => { const last = slots[slots.length - 1]; setSlots(p => [...p, { start: last.end, end: last.end.replace(/^(\d\d)/, h => String(Math.min(23, Number(h) + 1)).padStart(2, "0")) }]); setPreview(null); }}><Icon name="plus" size={12} />Period</Btn>
          </div></div>

        {preview && (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="kv">
              <div><div className="k">Periods placed</div><div className="v">{preview.placed.length} of {preview.capacity.requested}</div></div>
              <div><div className="k">Could not be placed</div><div className="v" style={{ color: preview.unplaced.length ? "var(--danger)" : undefined }}>{preview.unplaced.length}</div></div>
              <div><div className="k">Already scheduled (kept)</div><div className="v">{preview.kept}</div></div>
              <div><div className="k">Rooms × weekly periods</div><div className="v">{preview.capacity.rooms} × {preview.capacity.periodsPerWeek}</div></div>
            </div>
            {preview.unplaced.length > 0 && (
              <div style={{ background: "var(--danger-soft)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5 }}>
                <strong style={{ color: "var(--danger)" }}>Not placed</strong> — add teaching days, periods or rooms, then regenerate:
                {preview.unplaced.slice(0, 8).map((u, i) => <div key={i} style={{ marginTop: 4 }}>{u.subject} · {u.section} · {u.teacher} — {u.reason}</div>)}
                {preview.unplaced.length > 8 && <div style={{ marginTop: 4 }}>…and {preview.unplaced.length - 8} more</div>}
              </div>
            )}
            {preview.placed.length === 0 && preview.unplaced.length === 0 && <EmptyState icon="check" title="Every class already has its periods" desc="There is nothing left to schedule in this session." />}
            {days.filter(d => byDay(d).length).map(d => (
              <div key={d}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{d}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 6 }}>
                  {byDay(d).map((p, i) => (
                    <div key={i} style={{ background: "var(--surface-alt)", borderRadius: 9, padding: "8px 11px", fontSize: 12.5 }}>
                      <div style={{ fontWeight: 700 }}>{p.subject}</div>
                      <div style={{ color: "var(--ink-soft)" }}>{fmtTime12h(p.startTime)} · {p.section} · {p.room}</div>
                      <div style={{ color: "var(--muted)" }}>{p.teacher}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export const claimStatus = s => statusMeta(s === "pending" ? "pending" : s);
