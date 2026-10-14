import { lazy, Suspense } from "react";

// Lazy — pulls in socket.io-client, only worth loading once a teacher
// actually opens this tab, matching how Chat.jsx/AI.jsx are already
// deferred elsewhere in this app.
const ClassCallRoom = lazy(() => import("../../shared/ClassCallRoom.jsx"));

export default function CallTab({ cls }) {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}>
      <ClassCallRoom teacherAssignmentId={cls._id} subtitle={`${cls.program?.name} ${cls.section?.name} — everyone in this class can join`} />
    </Suspense>
  );
}
