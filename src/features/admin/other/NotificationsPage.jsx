import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, Btn, Icon, Select, Badge, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";

const TYPES = ["attendance", "grade", "fee", "notice", "announcement", "alert"];
const TYPE_ICON = { attendance: "clipboard", grade: "grad", fee: "dollar", notice: "megaphone", announcement: "megaphone", alert: "alert", assignment: "file", exam: "file", leave: "calendar" };

export default function NotificationsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [filter, setFilter] = useState("all");
  const EMPTY = { title: "", message: "", type: "notice", priority: "normal" };
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    api.getNotifications().then(setItems).catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [api]);

  const broadcast = async () => {
    if (!form.title || !form.message) return toast("Title and message are required");
    setBroadcasting(true);
    try {
      const result = await api.broadcastNotification(form);
      toast(`Notification sent to ${result.count ?? "all"} students`, "check");
      setForm(EMPTY); setShowForm(false);
      api.getNotifications().then(setItems);
    } catch (e) { toast(e.message); }
    finally { setBroadcasting(false); }
  };

  const filtered = items.filter(n => filter === "all" || n.type === filter);
  const unread = items.filter(n => !n.isRead).length;

  return (
    <>
      <SectionHeader eyebrow="Other" title="Notifications" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Total" value={items.length} icon="bell" />
        <StatCard label="Unread" value={unread} icon="alert" />
        <StatCard label="Today" value={items.filter(n => n.createdAt && new Date(n.createdAt).toDateString() === new Date().toDateString()).length} icon="calendar" />
        <StatCard label="High Priority" value={items.filter(n => n.priority === "high").length} icon="alert" />
      </div>
      <Card style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all", ...TYPES].map(t => (
              <button key={t} onClick={() => setFilter(t)} className="btn" style={{
                padding: "6px 12px", textTransform: "capitalize",
                background: filter === t ? "var(--accent-soft)" : "transparent",
                color: filter === t ? "var(--accent-ink)" : "var(--muted)",
                border: `1px solid ${filter === t ? "transparent" : "var(--border)"}`,
              }}>{t}</button>
            ))}
          </div>
          <Btn variant="accent" onClick={() => setShowForm(p => !p)}><Icon name="send" size={13} />{showForm ? "Cancel" : "Broadcast"}</Btn>
        </div>
        {showForm && (
          <div style={{ marginTop: 14, padding: 14, background: "var(--surface-alt)", borderRadius: 12 }}>
            <input className="input" placeholder="Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={{ marginBottom: 10 }} />
            <textarea className="input" rows={3} placeholder="Message for all students…" value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} style={{ marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <Select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ flex: 1 }}>
                {["notice", "announcement", "alert", "attendance", "grade", "fee"].map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={{ flex: 1 }}>
                {["low", "normal", "high"].map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            <Btn variant="accent" full onClick={broadcast} disabled={broadcasting}><Icon name="send" size={13} />{broadcasting ? "Sending…" : "Send to All Students"}</Btn>
          </div>
        )}
      </Card>
      {loading && <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>}
      {!loading && filtered.length === 0 && <Card style={{ padding: 24 }}><EmptyState icon="bell" title="No notifications" /></Card>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(n => (
          <Card key={n._id} style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Icon name={TYPE_ICON[n.type] || "megaphone"} size={18} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{n.title}</div>
                  {n.priority === "high" && <Badge tone="danger">Urgent</Badge>}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{n.message}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{n.sender} · {n.sentAt ? new Date(n.sentAt).toLocaleString() : ""}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
