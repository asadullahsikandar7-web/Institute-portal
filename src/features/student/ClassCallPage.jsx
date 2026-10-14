import { lazy, Suspense, useEffect, useState } from "react";
import { SectionHeader, Card, EmptyState, Icon } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

// Lazy — pulls in socket.io-client, only worth loading once a student
// actually opens a class's call, matching how Chat.jsx/AI.jsx are already
// deferred elsewhere in this app.
const ClassCallRoom = lazy(() => import("../shared/ClassCallRoom.jsx"));

// One call room per real subject (TeacherAssignment) — same list source as
// "My Subjects", not the chat-group list, since a call is scoped to the
// class itself rather than to whether a chat group happens to exist for it.
export default function ClassCallPage() {
  const { api } = useSession();
  const toast = useToast();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.getMySubjects().then(d => setSubjects(Array.isArray(d) ? d : [])).catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [api]);

  return (
    <>
      <SectionHeader eyebrow="Academics" title="Class Call" />
      {loading ? (
        <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
      ) : subjects.length === 0 ? (
        <Card style={{ padding: 24 }}><EmptyState icon="video" title="No classes available yet" /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {subjects.map(s => (
              <Card
                key={s.teacherAssignmentId}
                onClick={() => setSelected(s)}
                style={{ padding: 14, cursor: "pointer", borderColor: selected?.teacherAssignmentId === s.teacherAssignmentId ? "var(--accent)" : "var(--border)" }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.subject?.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.teacher?.name}</div>
              </Card>
            ))}
          </div>
          {selected ? (
            <Suspense fallback={<Card style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>}>
              <ClassCallRoom key={selected.teacherAssignmentId} teacherAssignmentId={selected.teacherAssignmentId} subtitle={`${selected.subject?.name} — everyone in this class can join`} />
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
