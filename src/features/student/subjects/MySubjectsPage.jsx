import { useEffect, useState } from "react";
import { SectionHeader, Card, Badge, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { fmt, statusMeta } from "../../../lib/utils.js";

export default function MySubjectsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    api.getMySubjects().then(setSubjects).catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [api]);

  const toggleExpand = async s => {
    if (expanded === s.teacherAssignmentId) { setExpanded(null); return; }
    setExpanded(s.teacherAssignmentId);
    setLoadingHistory(true);
    try { setHistory(await api.getMySubjectHistory(s.teacherAssignmentId)); }
    catch (e) { toast(e.message); }
    finally { setLoadingHistory(false); }
  };

  if (loading) return <><SectionHeader eyebrow="Academics" title="My Subjects" /><Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card></>;

  return (
    <>
      <SectionHeader eyebrow="Academics" title="My Subjects" />
      {subjects.length === 0 ? (
        <Card style={{ padding: 24 }}><EmptyState icon="book" title="No academic data available yet" /></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {subjects.map(s => {
            const rate = s.attendance?.rate;
            const open = expanded === s.teacherAssignmentId;
            return (
              <Card key={s.teacherAssignmentId} style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, cursor: "pointer" }} onClick={() => toggleExpand(s)}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{s.subject?.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Teacher: {s.teacher?.name || "—"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: rate == null ? "var(--muted)" : rate >= 75 ? "var(--success)" : "var(--danger)" }}>{rate == null ? "—" : `${rate}%`}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>Attendance</div>
                  </div>
                </div>
                {open && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                    {loadingHistory ? <div style={{ textAlign: "center", padding: 10, color: "var(--muted)" }}>Loading…</div> :
                      history.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>No attendance recorded yet.</div> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 200, overflowY: "auto" }}>
                          {history.map(r => {
                            const meta = statusMeta(r.status);
                            return (
                              <div key={r._id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                <span style={{ color: "var(--muted)" }}>{fmt(r.date)}</span>
                                <Badge tone={meta.tone}>{meta.label}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
