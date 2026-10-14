import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, Badge } from "../../components/ui/index.js";
import { RingChart } from "../../components/charts/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { chartColor } from "../../styles/theme.js";
import { fmtTime12h } from "../../lib/utils.js";
import { todayName } from "../shared/WeeklyTimetable.jsx";
import { AttentionCard, AttendanceCheckIn } from "../erp/SmartWidgets.jsx";

export default function StudentDashboardPage() {
  const { session, api } = useSession();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [todaysSchedule, setTodaysSchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getMySubjects().then(data => { if (!cancelled) setSubjects(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    api.getStudentSchedule()
      .then(entries => { if (!cancelled) setTodaysSchedule(entries.filter(e => e.day === todayName()).sort((a, b) => a.startTime.localeCompare(b.startTime))); })
      .catch(() => { if (!cancelled) setTodaysSchedule([]); })
      .finally(() => { if (!cancelled) setScheduleLoading(false); });
    return () => { cancelled = true; };
  }, [api]);

  const rates = subjects.map(s => s.attendance?.rate ?? 0);
  const overall = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;

  return (
    <>
      <SectionHeader eyebrow="Overview" title={`Welcome, ${session.student?.name || "Student"}`} />
      <AttendanceCheckIn />
      <AttentionCard />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="My Subjects" value={loading ? "…" : subjects.length} icon="book" />
        <StatCard label="Overall Attendance" value={loading ? "…" : (overall != null ? overall + "%" : "—")} icon="clipboard" />
      </div>

      <Card style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>Today's Schedule ({todayName()})</div>
        {scheduleLoading ? (
          <div style={{ padding: 10, color: "var(--muted)", fontSize: 13 }}>Loading…</div>
        ) : todaysSchedule.length === 0 ? (
          <div style={{ padding: 10, color: "var(--muted)", fontSize: 13 }}>No classes scheduled for today.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {todaysSchedule.map(e => (
              <div key={e._id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "var(--surface-alt)", borderRadius: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, minWidth: 78 }}>{fmtTime12h(e.startTime)}</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{e.subject?.name}</span>
                    <Badge tone={e.type === "Lab" ? "info" : "accent"}>{e.type}</Badge>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{e.teacher?.name || "TBA"} · {e.room?.name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {!loading && subjects.length > 0 && (
        <Card style={{ padding: 22, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>Attendance by Subject</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
            {subjects.map((s, i) => (
              <div key={s.teacherAssignmentId} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <RingChart size={68} stroke={7} center={(s.attendance?.rate ?? 0) + "%"} segments={[{ color: chartColor(theme, i), pct: (s.attendance?.rate ?? 0) / 100 }]} />
                <div style={{ fontSize: 11, color: "var(--muted)", maxWidth: 90, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>{s.subject?.name}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
        {subjects.map(s => (
          <Card key={s.teacherAssignmentId} style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>{s.subject?.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Teacher: {s.teacher?.name}</div>
          </Card>
        ))}
        {!loading && subjects.length === 0 && (
          <Card style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>No subjects enrolled yet.</Card>
        )}
      </div>
    </>
  );
}
