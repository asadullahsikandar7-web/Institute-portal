import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionHeader, Card, Chain, Btn } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

export default function MyClassesPage() {
  const { api } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [rosterCounts, setRosterCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getMyClasses().then(async data => {
      if (cancelled) return;
      setClasses(data);
      const counts = {};
      await Promise.all(data.map(async c => {
        try { counts[c._id] = (await api.getClassStudents(c._id)).length; } catch { counts[c._id] = null; }
      }));
      if (!cancelled) setRosterCounts(counts);
    }).catch(e => toast(e.message)).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api]);

  return (
    <>
      <SectionHeader eyebrow="Teaching" title="My Classes" />
      {loading ? (
        <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          {classes.map(c => (
            <Card key={c._id} style={{ padding: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{c.subject?.name}</div>
              <Chain items={[c.program?.name, c.section?.name, c.academicSession?.name]} />
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>
                Students: <b style={{ color: "var(--ink)" }}>{rosterCounts[c._id] ?? "…"}</b>
              </div>
              <Btn variant="ghost" full style={{ marginTop: 14 }} onClick={() => navigate(`/teacher/myclasses/${c._id}/overview`)}>Open Class</Btn>
            </Card>
          ))}
          {classes.length === 0 && (
            <Card style={{ padding: 24, gridColumn: "1/-1", textAlign: "center", color: "var(--muted)" }}>No classes assigned to you yet.</Card>
          )}
        </div>
      )}
    </>
  );
}
