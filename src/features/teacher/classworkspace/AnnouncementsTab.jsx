import { useCallback, useEffect, useState } from "react";
import { Card, Btn, Icon, EmptyState } from "../../../components/ui/index.js";
import { fmt } from "../../../lib/utils.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";

export default function AnnouncementsTab({ cls }) {
  const { api } = useSession();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", message: "" });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    api.getClassAnnouncements(cls._id).then(d => setItems(Array.isArray(d) ? d : [])).catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [cls._id, api]);
  useEffect(reload, [cls._id]);

  const send = async () => {
    if (!form.title.trim() || !form.message.trim()) return toast("Title and message are required");
    setSaving(true);
    try {
      const res = await api.addClassAnnouncement(cls._id, form);
      toast(`Sent to ${res.recipientCount} student(s)`, "check");
      setForm({ title: "", message: "" }); setShowForm(false); reload();
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Class Announcements ({items.length})</div>
          <Btn variant="accent" onClick={() => setShowForm(p => !p)}><Icon name="plus" size={14} />{showForm ? "Cancel" : "New Announcement"}</Btn>
        </div>
        {showForm && (
          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <div><label className="field-label">Title</label><input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><label className="field-label">Message</label><textarea className="input" rows={3} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} /></div>
            <Btn variant="accent" onClick={send} disabled={saving}><Icon name="send" size={13} />Send to Class</Btn>
          </div>
        )}
      </Card>
      {loading ? <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Loading…</div> :
        items.length === 0 ? <Card style={{ padding: 32 }}><EmptyState icon="megaphone" title="No announcements sent yet." /></Card> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map(a => (
              <Card key={a._id} style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{fmt(a.createdAt)}</div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 6 }}>{a.message}</div>
                <div style={{ fontSize: 11, color: "var(--accent-ink)", marginTop: 8, fontWeight: 700 }}>Sent to {a.recipientCount} student(s)</div>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
