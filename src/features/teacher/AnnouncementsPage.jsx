import { useEffect, useState } from "react";
import { SectionHeader, Card, Chain, EmptyState } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { fmtShort } from "../../lib/utils.js";

// Read-only aggregate across every class you teach — to post a new one, open
// My Classes → a class → Announcements (it's inherently class-scoped).
export default function TeacherAnnouncementsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getMyClasses().then(async classes => {
      const lists = await Promise.all(classes.map(c => api.getClassAnnouncements(c._id).then(list => list.map(a => ({ ...a, cls: c }))).catch(() => [])));
      if (!cancelled) setItems(lists.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }).catch(e => toast(e.message)).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api]);

  return (
    <>
      <SectionHeader eyebrow="Communication" title="Announcements" />
      <div style={{ display: "grid", gap: 12 }}>
        {loading && <Card style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>}
        {!loading && items.map(a => (
          <Card key={a._id} style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
              <Chain items={[a.cls.program?.name, a.cls.section?.name, a.cls.subject?.name]} />
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmtShort(a.createdAt)}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{a.title}</div>
            <div style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>{a.message}</div>
            <div style={{ fontSize: 11, color: "var(--accent-ink)", marginTop: 8, fontWeight: 700 }}>Sent to {a.recipientCount} student(s)</div>
          </Card>
        ))}
        {!loading && items.length === 0 && <Card style={{ padding: 24 }}><EmptyState icon="megaphone" title="No announcements sent yet" desc="Open a class under My Classes to send one." /></Card>}
      </div>
    </>
  );
}
