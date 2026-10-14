import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, Badge } from "../../components/ui/index.js";
import { AttentionCard } from "../erp/SmartWidgets.jsx";
import { RingChart, MiniLineChart } from "../../components/charts/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { chartColor } from "../../styles/theme.js";
import { todayName } from "../shared/WeeklyTimetable.jsx";

export default function DashboardPage() {
  const { api } = useSession();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ students: 0, teachers: 0, sessions: [], pendingFees: 0, analytics: null });
  const [todaysClasses, setTodaysClasses] = useState(null); // null = still loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [students, teachers, sessions, fees, analytics] = await Promise.all([
          api.getStudents(),
          api.getTeachersList(),
          api.getAcademicSessions(),
          // Staff sub-roles without the finance module get a 403 here — the
          // dashboard should still load, just without fee figures.
          api.getFees().catch(() => []),
          api.getAnalytics().catch(() => null),
        ]);
        if (cancelled) return;
        setStats({
          students: students.length,
          teachers: teachers.length,
          sessions,
          pendingFees: fees.filter(f => f.status !== "paid").length,
          analytics,
        });
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    api.getScheduleAdmin(`day=${encodeURIComponent(todayName())}`)
      .then(entries => {
        if (cancelled) return;
        setTodaysClasses({
          classes: entries.length,
          teachers: new Set(entries.filter(e => e.teacher).map(e => e.teacher._id)).size,
          rooms: new Set(entries.map(e => e.room?._id).filter(Boolean)).size,
        });
      })
      .catch(() => { if (!cancelled) setTodaysClasses({ classes: 0, teachers: 0, rooms: 0 }); });
    return () => { cancelled = true; };
  }, [api]);

  const activeSession = stats.sessions.find(s => s.status === "active");
  const a = stats.analytics;
  const todayTotal = a?.today ? Math.max(a.today.present + a.today.absent + a.today.leave + a.today.unmarked, 1) : 1;
  const weekData = a?.weeklyAttendance || [];

  return (
    <>
      <SectionHeader eyebrow="Overview" title="Welcome back, Admin" />
      <AttentionCard />
      {error && <Badge tone="danger" icon="alert">{error}</Badge>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 24, marginTop: error ? 14 : 0 }}>
        <StatCard label="Total Students" value={loading ? "…" : stats.students} icon="users" />
        <StatCard label="Total Teachers" value={loading ? "…" : stats.teachers} icon="grad" />
        <StatCard label="Academic Sessions" value={loading ? "…" : stats.sessions.length} icon="calendar" />
        <StatCard label="Pending Fees" value={loading ? "…" : stats.pendingFees} icon="dollar" />
        <StatCard label="Today's Attendance" value={loading ? "…" : (a?.avgAttendance != null ? a.avgAttendance + "%" : "—")} icon="clipboard" />
      </div>

      {a && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginBottom: 20 }}>
          <Card style={{ padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>Weekly Attendance Trend</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 2 }} className="font-display">{weekData[weekData.length - 1] ?? 0}%</div>
            <MiniLineChart data={weekData} color={chartColor(theme, 0)} height={60} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: "var(--muted)" }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"].map(d => <span key={d}>{d}</span>)}
            </div>
          </Card>
          <Card style={{ padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>Today's Breakdown</div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <RingChart
                size={88}
                stroke={10}
                center={(a.avgAttendance ?? 0) + "%"}
                segments={[
                  { color: chartColor(theme, 2), pct: (a.today?.present || 0) / todayTotal },
                  { color: chartColor(theme, 4), pct: (a.today?.leave || 0) / todayTotal },
                  { color: chartColor(theme, 3), pct: (a.today?.absent || 0) / todayTotal },
                ]}
              />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
                {[
                  { col: chartColor(theme, 2), l: "Present", v: a.today?.present || 0 },
                  { col: chartColor(theme, 4), l: "On Leave", v: a.today?.leave || 0 },
                  { col: chartColor(theme, 3), l: "Absent", v: a.today?.absent || 0 },
                  { col: "var(--muted)", l: "Unmarked", v: a.today?.unmarked || 0 },
                ].map(x => (
                  <div key={x.l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--ink-soft)" }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: x.col }} />{x.l}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{x.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div className="font-display" style={{ fontSize: 17, fontWeight: 600 }}>
            {activeSession ? activeSession.name : "No active session"}
          </div>
          {activeSession && <Badge tone="success">Active</Badge>}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Manage sessions, programs, sections and subjects under Academic in the sidebar.
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>Today's Classes ({todayName()})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 14 }}>
          <div><div className="font-display" style={{ fontSize: 24, fontWeight: 700 }}>{todaysClasses ? String(todaysClasses.classes).padStart(2, "0") : "…"}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>Classes</div></div>
          <div><div className="font-display" style={{ fontSize: 24, fontWeight: 700 }}>{todaysClasses ? String(todaysClasses.teachers).padStart(2, "0") : "…"}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>Teachers</div></div>
          <div><div className="font-display" style={{ fontSize: 24, fontWeight: 700 }}>{todaysClasses ? String(todaysClasses.rooms).padStart(2, "0") : "…"}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>Rooms in use</div></div>
        </div>
      </Card>
    </>
  );
}
