import { useEffect, useState } from "react";
import { StatCard, Card } from "../../../components/ui/index.js";
import { today } from "../../../lib/utils.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";

export default function OverviewTab({ cls }) {
  const { api } = useSession();
  const toast = useToast();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getClassStudents(cls._id).catch(() => []),
      api.getClassAttendance(cls._id, today()).catch(() => ({ students: [] })),
      api.getClassCoursework(cls._id).catch(() => []),
      api.getClassQuizzes(cls._id).catch(() => []),
    ]).then(([students, att, cw, qz]) => {
      const todayStudents = att.students || [];
      setStats({
        students: students.length,
        todayMarked: todayStudents.filter(s => s.status !== "unmarked").length,
        todayTotal: todayStudents.length,
        coursework: cw.filter(x => x.status === "active").length,
        quizzes: qz.filter(x => x.status === "active").length,
      });
    }).catch(e => toast(e.message));
  }, [cls._id, api]);

  if (!stats) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
        <StatCard label="Students" value={stats.students} icon="users" />
        <StatCard label="Today's Attendance" value={`${stats.todayMarked}/${stats.todayTotal}`} icon="clipboard" />
        <StatCard label="Active Assignments" value={stats.coursework} icon="file" />
        <StatCard label="Active Quizzes" value={stats.quizzes} icon="trend" />
      </div>
      <Card style={{ padding: 22 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "var(--ink-soft)" }}>CLASS DETAILS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
          {[["Academic Session", cls.academicSession?.name], ["Program", cls.program?.name], ["Section", cls.section?.name], ["Subject", cls.subject?.name]].map(([l, v]) => (
            <div key={l}>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{v || "—"}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
