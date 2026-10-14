import { useMemo, useState } from "react";
import { SectionHeader, StatCard, Card, Badge, Btn, Icon, EmptyState, Modal } from "../../components/ui/index.js";
import { FormField, bodyFromForm, importColumns, validateForm } from "../../components/resource/ResourcePage.jsx";
import { CsvImportButton } from "../../components/CsvImport.jsx";
import SuggestionsButton from "../../components/Suggestions.jsx";
import { calendarSuggestions } from "../../lib/suggestions.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { fmt, fmtTime, humanize, statusMeta, toDateInput } from "../../lib/utils.js";
import { useLoad, useAction } from "./hooks.js";

// Pages shared by more than one portal: the academic calendar, the
// helpdesk, and the change-password dialog.

// ═══════════════════════════ ACADEMIC CALENDAR ═════════════════════════════
const EVENT_TYPES = ["holiday", "exam", "event", "meeting", "deadline", "term"];
const TYPE_TONE = { holiday: "success", exam: "danger", event: "accent", meeting: "info", deadline: "warn", term: "neutral" };
const EVENT_FIELDS = [
  { name: "title", label: "Title", required: true, full: true },
  { name: "type", label: "Type", type: "select", options: EVENT_TYPES, default: "event" },
  { name: "audience", label: "Visible To", type: "select", options: ["all", "students", "teachers", "parents", "staff"], default: "all" },
  { name: "start", label: "Starts", type: "date", required: true }, { name: "end", label: "Ends (optional)", type: "date" },
  { name: "location", label: "Location" }, { name: "description", label: "Description", type: "textarea" },
];
const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function CalendarPage({ canEdit = false, eyebrow = "Academics" }) {
  const { api } = useSession();
  const toast = useToast();
  const [events, reload, loading] = useLoad("/api/engage/calendar", []);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [editing, setEditing] = useState(undefined);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Expand multi-day events onto every day they cover.
  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of events || []) {
      const start = new Date(e.start), end = e.end ? new Date(e.end) : start;
      for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()), n = 0; d <= end && n < 120; d.setDate(d.getDate() + 1), n++) {
        const k = dayKey(d);
        map.set(k, [...(map.get(k) || []), e]);
      }
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7)); // week starts Monday
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);

  const open = (ev, date) => {
    if (!canEdit) return;
    setForm(ev ? { ...Object.fromEntries(EVENT_FIELDS.map(f => [f.name, ev[f.name] ?? ""])), start: toDateInput(ev.start), end: toDateInput(ev.end) }
      : { ...Object.fromEntries(EVENT_FIELDS.map(f => [f.name, f.default ?? ""])), start: date ? toDateInput(new Date(date.getTime() - date.getTimezoneOffset() * 60000)) : "" });
    setEditing(ev || null);
  };
  const save = async () => {
    const problem = validateForm(EVENT_FIELDS, form);
    if (problem) return toast(problem, "alert");
    setSaving(true);
    try {
      const body = bodyFromForm(EVENT_FIELDS, form);
      if (editing) await api.call("PATCH", `/api/engage/calendar/${editing._id}`, body); else await api.call("POST", "/api/engage/calendar", body);
      toast("Calendar updated", "check"); setEditing(undefined); reload();
    } catch (e) { toast(e.message, "alert"); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!window.confirm("Delete this event?")) return;
    try { await api.call("DELETE", `/api/engage/calendar/${editing._id}`); setEditing(undefined); reload(); } catch (e) { toast(e.message, "alert"); }
  };

  const todayKey = dayKey(new Date());
  const upcoming = (events || []).filter(e => new Date(e.end || e.start) >= new Date(new Date().toDateString())).slice(0, 8);
  const shift = n => setCursor(c => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <>
      <SectionHeader eyebrow={eyebrow} title="Academic Calendar" action={canEdit && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SuggestionsButton title="Suggested holidays & dates" catalog={{ school: calendarSuggestions("school"), college: calendarSuggestions("college"), university: calendarSuggestions("university") }}
          existing={(events || []).map(e => `${e.title}|${toDateInput(e.start)}`)} match={item => [`${item.data.title}|${item.data.start}`]}
          submit={d => api.call("POST", "/api/engage/calendar", d)} onDone={reload}
          note="Pakistan's public holidays and a typical academic year, dated from today. Islamic holidays depend on moon sighting — edit the date once announced." />
        <CsvImportButton title="Import calendar events" filename="academic-calendar" columns={importColumns(EVENT_FIELDS, api)} onDone={reload}
          note="Holidays, exams, meetings and term dates — one row per event. Leave “Ends” empty for a single-day event."
          samples={[
            { title: "Quaid-e-Azam Day", type: "holiday", audience: "all", start: "2026-12-25" },
            { title: "Winter Vacation", type: "holiday", audience: "all", start: "2026-12-22", end: "2026-12-31" },
            { title: "Parent-Teacher Meeting", type: "meeting", audience: "parents", start: "2026-11-21", location: "School Hall", description: "Report cards will be shared" },
            { title: "Midterm Exams", type: "exam", audience: "students", start: "2026-11-16", end: "2026-11-27" },
          ]}
          submit={row => api.call("POST", "/api/engage/calendar", { type: "event", audience: "all", ...row })} />
        <Btn variant="accent" onClick={() => open(null)}><Icon name="plus" size={13} />Add Event</Btn>
      </div>} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="arrowLeft" size={15} /></button>
        <div className="font-display" style={{ fontSize: 18, fontWeight: 600, minWidth: 170, textAlign: "center" }}>{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevronRight" size={15} /></button>
        <Btn variant="ghost" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Btn>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{EVENT_TYPES.map(t => <Badge key={t} tone={TYPE_TONE[t]}>{humanize(t)}</Badge>)}</div>
      </div>
      <div className="cal-grid" style={{ marginBottom: 20 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <div key={d} className="cal-head">{d}</div>)}
        {cells.map(d => {
          const list = byDay.get(dayKey(d)) || [];
          return (
            <div key={d.toISOString()} className={"cal-cell" + (d.getMonth() !== cursor.getMonth() ? " dim" : "") + (dayKey(d) === todayKey ? " today" : "")} onDoubleClick={() => open(null, d)}>
              <div className="cal-day">{d.getDate()}</div>
              {list.slice(0, 3).map(e => (
                <div key={e._id} className={"cal-ev badge " + TYPE_TONE[e.type]} style={{ borderRadius: 5, cursor: canEdit ? "pointer" : "default" }} title={`${e.title}${e.location ? ` — ${e.location}` : ""}`} onClick={() => open(e)}>{e.title}</div>
              ))}
              {list.length > 3 && <div style={{ fontSize: 10, color: "var(--muted)" }}>+{list.length - 3} more</div>}
            </div>
          );
        })}
      </div>
      <Card style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Coming up</div>
        {loading ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</div> : upcoming.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Nothing scheduled.{canEdit ? " Add an event, or double-click a day." : ""}</div> : (
          <div style={{ display: "grid", gap: 10 }}>
            {upcoming.map(e => (
              <div key={e._id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <Badge tone={TYPE_TONE[e.type]}>{humanize(e.type)}</Badge>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{e.title}</span>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{fmt(e.start)}{e.end && toDateInput(e.end) !== toDateInput(e.start) ? ` – ${fmt(e.end)}` : ""}{e.location ? ` · ${e.location}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      {editing !== undefined && (
        <Modal title={editing ? "Edit Event" : "Add Event"} onClose={() => setEditing(undefined)} footer={<>
          {editing && <Btn variant="danger" onClick={remove}><Icon name="x" size={13} />Delete</Btn>}
          <div style={{ flex: 1 }} /><Btn variant="ghost" onClick={() => setEditing(undefined)}>Cancel</Btn><Btn variant="accent" onClick={save} disabled={saving}>Save</Btn>
        </>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {EVENT_FIELDS.map(f => <FormField key={f.name} field={f} value={form[f.name]} options={(f.options || []).map(o => ({ value: o, label: humanize(o) }))} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} />)}
          </div>
        </Modal>
      )}
    </>
  );
}

// ═══════════════════════════ HELPDESK ══════════════════════════════════════
const CATEGORIES = ["academic", "fee", "it", "facility", "hostel", "transport", "library", "harassment", "other"];
const PRIORITY_TONE = { low: "neutral", normal: "info", high: "warn", urgent: "danger" };

function TicketModal({ ticket, isAdmin, onClose, onChanged }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [t, setT] = useState(ticket);
  const [message, setMessage] = useState("");
  const apply = out => { if (out) { setT(out); onChanged(); } };
  const reply = () => run(() => api.call("POST", `/api/engage/tickets/${t._id}/reply`, { message })).then(out => { if (out) setMessage(""); apply(out); });
  const patch = body => run(() => api.call("PATCH", `/api/engage/tickets/${t._id}`, body), "Ticket updated").then(apply);
  const meta = statusMeta(t.status);

  return (
    <Modal wide title={`${t.ticketNo} — ${t.subject}`} onClose={onClose}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <Badge tone={meta.tone}>{meta.label}</Badge><Badge tone={PRIORITY_TONE[t.priority]}>{humanize(t.priority)} priority</Badge><Badge tone="neutral">{humanize(t.category)}</Badge>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Raised by {t.raisedByName} ({t.raisedByRole}) · {fmt(t.createdAt)}</span>
      </div>
      {isAdmin && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <select className="input" style={{ width: "auto" }} value={t.status} disabled={busy} onChange={e => patch({ status: e.target.value })}>{["open", "in_progress", "resolved", "closed"].map(s => <option key={s} value={s}>{statusMeta(s).label}</option>)}</select>
          <select className="input" style={{ width: "auto" }} value={t.priority} disabled={busy} onChange={e => patch({ priority: e.target.value })}>{Object.keys(PRIORITY_TONE).map(p => <option key={p} value={p}>{humanize(p)} priority</option>)}</select>
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "11px 14px", fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{t.description}</div>
        {t.replies.map(r => (
          <div key={r._id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", marginLeft: r.byRole === "admin" ? 24 : 0, marginRight: r.byRole === "admin" ? 0 : 24 }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}><strong style={{ color: "var(--ink-soft)" }}>{r.byRole === "admin" ? "Support team" : r.byName}</strong> · {fmt(r.at)} {fmtTime(r.at)}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.message}</div>
          </div>
        ))}
      </div>
      {t.status === "closed" ? <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 14 }}>This ticket is closed.</div> : (
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "flex-end" }}>
          <textarea className="input" rows={2} placeholder="Write a reply…" value={message} onChange={e => setMessage(e.target.value)} />
          <Btn variant="accent" onClick={reply} disabled={busy || !message.trim()}><Icon name="send" size={13} />Send</Btn>
        </div>
      )}
    </Modal>
  );
}

export function HelpdeskPage({ eyebrow = "Support" }) {
  const { api, session } = useSession();
  const isAdmin = session.role === "admin";
  const [run, busy] = useAction();
  const [status, setStatus] = useState("");
  const [tickets, reload, loading] = useLoad(`/api/engage/tickets${status ? `?status=${status}` : ""}`, []);
  const [openTicket, setOpenTicket] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", category: "other", priority: "normal" });
  const list = tickets || [];

  const create = () => run(() => api.call("POST", "/api/engage/tickets", form), o => `Ticket ${o.ticketNo} raised`).then(out => {
    if (out) { setCreating(false); setForm({ subject: "", description: "", category: "other", priority: "normal" }); reload(); }
  });

  return (
    <>
      <SectionHeader eyebrow={eyebrow} title="Helpdesk" action={<Btn variant="accent" onClick={() => setCreating(true)}><Icon name="plus" size={13} />New Ticket</Btn>} />
      {isAdmin && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14, marginBottom: 18 }}>
          {["open", "in_progress", "resolved"].map(s => <StatCard key={s} label={statusMeta(s).label} value={loading ? "…" : list.filter(t => t.status === s).length} active={status === s} onClick={() => setStatus(status === s ? "" : s)} />)}
          <StatCard label="Urgent / High" value={loading ? "…" : list.filter(t => ["urgent", "high"].includes(t.priority) && !["resolved", "closed"].includes(t.status)).length} icon="alert" />
        </div>
      )}
      <Card style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead><tr><th>Ticket</th><th>Subject</th>{isAdmin && <th>Raised By</th>}<th>Category</th><th>Priority</th><th>Updated</th><th>Status</th></tr></thead>
          <tbody>{list.map(t => {
            const m = statusMeta(t.status);
            return (
              <tr key={t._id} className="clickable" onClick={() => setOpenTicket(t)}>
                <td className="font-mono">{t.ticketNo}</td><td style={{ fontWeight: 600, color: "var(--ink)" }}>{t.subject}{t.replies.length > 0 && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {t.replies.length} repl{t.replies.length === 1 ? "y" : "ies"}</span>}</td>
                {isAdmin && <td>{t.raisedByName} <span style={{ color: "var(--muted)" }}>({t.raisedByRole})</span></td>}
                <td>{humanize(t.category)}</td><td><Badge tone={PRIORITY_TONE[t.priority]}>{humanize(t.priority)}</Badge></td><td>{fmt(t.updatedAt)}</td><td><Badge tone={m.tone}>{m.label}</Badge></td>
              </tr>
            );
          })}</tbody>
        </table>
        {loading && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}
        {!loading && list.length === 0 && <EmptyState icon="lifebuoy" title={status ? "No tickets with this status" : "No tickets yet"} desc={isAdmin ? "Requests raised by students, teachers and parents show up here." : "Have a problem with fees, IT, facilities or anything else? Raise a ticket and the office will reply here."} />}
      </Card>
      {creating && (
        <Modal title="New Ticket" onClose={() => setCreating(false)} footer={<><Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn><Btn variant="accent" onClick={create} disabled={busy || !form.subject.trim() || !form.description.trim()}>Submit Ticket</Btn></>}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Subject</label><input className="input" maxLength={200} value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} /></div>
            <div><label className="field-label">Category</label><select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c} value={c}>{humanize(c)}</option>)}</select></div>
            <div><label className="field-label">Priority</label><select className="input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>{["low", "normal", "high", ...(isAdmin ? ["urgent"] : [])].map(c => <option key={c} value={c}>{humanize(c)}</option>)}</select></div>
            <div style={{ gridColumn: "1 / -1" }}><label className="field-label">What's the problem?</label><textarea className="input" rows={5} maxLength={5000} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          </div>
        </Modal>
      )}
      {openTicket && <TicketModal ticket={openTicket} isAdmin={isAdmin} onClose={() => setOpenTicket(null)} onChanged={reload} />}
    </>
  );
}

// ═══════════════════════════ CHANGE PASSWORD ═══════════════════════════════
export default function ChangePasswordModal({ onClose }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const problem = form.next && form.next.length < 8 ? "New password must be at least 8 characters."
    : form.confirm && form.next !== form.confirm ? "The two new passwords don't match." : "";
  const ready = form.current && form.next.length >= 8 && form.next === form.confirm;
  return (
    <Modal title="Change Password" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" disabled={busy || !ready} onClick={() => run(() => api.changePassword(form.current, form.next), "Password changed").then(r => r && onClose())}>Change Password</Btn>
    </>}>
      <div style={{ display: "grid", gap: 12 }}>
        {[["current", "Current password", "current-password"], ["next", "New password", "new-password"], ["confirm", "Confirm new password", "new-password"]].map(([k, label, ac]) => (
          <div key={k}><label className="field-label">{label}</label><input className="input" type="password" autoComplete={ac} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} /></div>
        ))}
        {problem && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{problem}</div>}
      </div>
    </Modal>
  );
}
