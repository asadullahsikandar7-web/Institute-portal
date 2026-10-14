import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, Btn, Icon, Badge, Select, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { fmt } from "../../../lib/utils.js";

const TYPES = ["announcement", "complaint", "achievement", "warning"];
const TYPE_TONE = { announcement: "accent", complaint: "warn", achievement: "success", warning: "danger" };
const STATUS_TONE = { sent: "success", failed: "danger", sending: "warn", pending: "warn" };

export default function ParentsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const EMPTY = { studentId: "", parentName: "", parentEmail: "", title: "", message: "", type: "announcement" };
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([api.getParentMessages(), api.getStudents()])
      .then(([m, s]) => { setMessages(m); setStudents(s); })
      .catch(e => toast(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  useEffect(() => {
    const s = students.find(x => x._id === form.studentId);
    if (s) setForm(p => ({ ...p, parentName: s.parentId?.name || s.parentName || "", parentEmail: s.parentId?.email || s.parentEmail || "" }));
  }, [form.studentId, students]);

  const send = async () => {
    if (!form.studentId || !form.parentEmail || !form.title || !form.message) return toast("Fill all required fields");
    setSending(true);
    try {
      const selected = students.find(s => s._id === form.studentId);
      await api.sendParentMessage({ ...form, studentName: selected?.name, rollNo: selected?.rollNo, author: "Admin" });
      toast("Message sent to parent", "check");
      setForm(EMPTY); setShowForm(false); reload();
    } catch (e) { toast(e.message); }
    finally { setSending(false); }
  };

  const retry = async id => {
    try { await api.resendParentMsg(id); toast("Email re-sent", "check"); reload(); } catch (e) { toast(e.message); }
  };
  const remove = async id => {
    if (!confirm("Delete this message?")) return;
    try { await api.deleteParentMsg(id); toast("Deleted", "check"); reload(); } catch (e) { toast(e.message); }
  };

  const filtered = messages.filter(m => filterType === "all" || m.type === filterType);
  const sentCount = messages.filter(m => m.emailStatus === "sent").length;
  const failedCount = messages.filter(m => m.emailStatus === "failed").length;

  return (
    <>
      <SectionHeader eyebrow="Communication" title="Parent Messages" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Messages" value={messages.length} icon="message" />
        <StatCard label="Emails Sent" value={sentCount} icon="check" />
        <StatCard label="Failed" value={failedCount} icon="alert" />
        <StatCard label="Parents Contacted" value={new Set(messages.map(m => m.parentEmail)).size} icon="users" />
      </div>
      <Card style={{ padding: 18 }}>
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all", ...TYPES].map(t => (
              <button key={t} onClick={() => setFilterType(t)} className="btn" style={{
                padding: "6px 12px", textTransform: "capitalize",
                background: filterType === t ? "var(--accent-soft)" : "transparent",
                color: filterType === t ? "var(--accent-ink)" : "var(--muted)",
                border: `1px solid ${filterType === t ? "transparent" : "var(--border)"}`,
              }}>{t}</button>
            ))}
          </div>
          <Btn variant="accent" onClick={() => setShowForm(p => !p)}><Icon name="message" size={13} />{showForm ? "Cancel" : "New Message"}</Btn>
        </div>
        {showForm && (
          <div style={{ display: "grid", gap: 12, padding: 16, background: "var(--surface-alt)", borderRadius: 12, marginBottom: 16 }}>
            <Select value={form.studentId} onChange={e => setForm(p => ({ ...p, studentId: e.target.value }))}>
              <option value="">— Select student —</option>
              {students.map(s => <option key={s._id} value={s._id}>{s.name} (#{s.rollNo})</option>)}
            </Select>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              <input className="input" placeholder="Parent name" value={form.parentName} onChange={e => setForm(p => ({ ...p, parentName: e.target.value }))} />
              <input className="input" type="email" placeholder="Parent email *" value={form.parentEmail} onChange={e => setForm(p => ({ ...p, parentEmail: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TYPES.map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))} className="btn" style={{
                  padding: "6px 12px", textTransform: "capitalize",
                  background: form.type === t ? "var(--accent-soft)" : "transparent",
                  color: form.type === t ? "var(--accent-ink)" : "var(--muted)",
                  border: `1px solid ${form.type === t ? "transparent" : "var(--border)"}`,
                }}>{t}</button>
              ))}
            </div>
            <input className="input" placeholder="Subject / Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <textarea className="input" rows={3} placeholder="Message *" value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
            <Btn variant="accent" onClick={send} disabled={sending}><Icon name="send" size={13} />Send to Parent</Btn>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}
        {!loading && filtered.length === 0 && <EmptyState icon="message" title="No messages yet" />}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(m => (
            <div key={m._id} style={{ padding: 14, background: "var(--surface-alt)", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge tone={TYPE_TONE[m.type]}>{m.type}</Badge>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{m.studentName} · #{m.rollNo}</span>
                </div>
                <Badge tone={STATUS_TONE[m.emailStatus] || "neutral"}>{m.emailStatus || "pending"}</Badge>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{m.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{m.message}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>To {m.parentEmail} · {fmt(m.date || m.createdAt)}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {m.emailStatus === "failed" && <Btn variant="ghost" onClick={() => retry(m._id)}>Retry</Btn>}
                  <button className="icon-btn" onClick={() => remove(m._id)} style={{ color: "var(--danger)" }}><Icon name="x" size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
