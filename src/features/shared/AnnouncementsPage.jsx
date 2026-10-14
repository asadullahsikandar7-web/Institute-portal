import { useEffect, useState } from "react";
import { SectionHeader, Card, Badge, Btn, Icon, Modal, EmptyState } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { fmtShort, fmtTime } from "../../lib/utils.js";

// Admin posts institute-wide announcements here (recipientId: null). Class-
// scoped announcements a teacher posts (My Classes → a class →
// Announcements) already fan out into this same Notification collection
// per-student server-side, so a student's list below shows both kinds
// automatically — no client-side merge needed.
export default function AnnouncementsPage({ canCreate = false }) {
  const { api } = useSession();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [msg, setMsg] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    api.getAnnouncements().then(setItems).catch(e => toast(e.message)).finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  const post = async () => {
    if (!msg.trim()) return toast("Message is required");
    setSaving(true);
    try {
      await api.addAnnouncement({ title: title.trim() || "Announcement", message: msg });
      toast("Announcement posted", "check");
      setMsg(""); setTitle(""); setModal(false); reload();
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <SectionHeader eyebrow="Communication" title="Announcements" action={canCreate && <Btn variant="accent" onClick={() => setModal(true)}><Icon name="plus" size={14} />New Announcement</Btn>} />
      <div style={{ display: "grid", gap: 12 }}>
        {loading && <Card style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>}
        {!loading && items.map(a => (
          <Card key={a._id} style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <Badge tone="accent">{a.recipientId ? "Class" : "Institute-wide"}</Badge>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmtShort(a.sentAt || a.createdAt)} · {fmtTime(a.sentAt || a.createdAt)}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{a.title}</div>
            <div style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>{a.message}</div>
            {a.sender && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>— {a.sender}</div>}
          </Card>
        ))}
        {!loading && items.length === 0 && <Card style={{ padding: 24 }}><EmptyState icon="megaphone" title="No announcements yet" /></Card>}
      </div>
      {modal && (
        <Modal title="New Announcement" onClose={() => setModal(false)} footer={<>
          <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
          <Btn variant="accent" onClick={post} disabled={saving}>Post Announcement</Btn>
        </>}>
          <div style={{ marginBottom: 10, fontSize: 12.5, color: "var(--muted)" }}>Audience: <b style={{ color: "var(--ink)" }}>Institute-wide</b></div>
          <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 10 }} />
          <textarea className="input" rows={4} placeholder="Write your announcement…" value={msg} onChange={e => setMsg(e.target.value)} />
        </Modal>
      )}
    </>
  );
}
