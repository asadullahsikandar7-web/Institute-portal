import { lazy, Suspense, useEffect, useState } from "react";
import { SectionHeader, Card, EmptyState, Icon } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

// Top-level "Call" entry point for teachers, mirroring the student side's
// Class Call page exactly (same list+detail layout, same shared
// ClassCallRoom) — one room per TeacherAssignment ("class"), sourced from
// the teacher's own real classes. This is IN ADDITION TO the "Call" tab
// inside each class's workspace (ClassWorkspace.jsx / CallTab.jsx), not a
// replacement for it — that stays for when a teacher is already inside a
// specific class; this is for jumping straight into a call without
// navigating through a class's other tabs first.
const ClassCallRoom = lazy(() => import("../shared/ClassCallRoom.jsx"));

export default function TeacherClassCallPage() {
  const { api } = useSession();
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.getMyClasses().then(d => setClasses(Array.isArray(d) ? d : [])).catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [api]);

  return (
    <>
      <SectionHeader eyebrow="Teaching" title="Class Call" />
      {loading ? (
        <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
      ) : classes.length === 0 ? (
        <Card style={{ padding: 24 }}><EmptyState icon="video" title="No classes assigned to you yet" /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {classes.map(c => (
              <Card
                key={c._id}
                onClick={() => setSelected(c)}
                style={{ padding: 14, cursor: "pointer", borderColor: selected?._id === c._id ? "var(--accent)" : "var(--border)" }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{c.subject?.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{c.program?.name} {c.section?.name}</div>
              </Card>
            ))}
          </div>
          {selected ? (
            <Suspense fallback={<Card style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>}>
              <ClassCallRoom key={selected._id} teacherAssignmentId={selected._id} subtitle={`${selected.program?.name} ${selected.section?.name} — everyone in this class can join`} />
            </Suspense>
          ) : (
            <Card style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>
              <Icon name="video" size={22} />
              <div style={{ marginTop: 8 }}>Select a class to start or join its call.</div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
