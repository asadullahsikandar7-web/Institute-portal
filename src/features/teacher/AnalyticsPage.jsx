import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, EmptyState } from "../../components/ui/index.js";
import { MiniLineChart, BarGroup } from "../../components/charts/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { chartColor } from "../../styles/theme.js";

// Scoped entirely to this teacher's own classes (see GET /api/teacher/analytics) —
// the admin/upper-management Analytics page shows schoolwide aggregates, this one
// shows this teacher's own teaching performance, per-class performance, and
// per-subject performance instead.
export default function TeacherAnalyticsPage() {
  const { api } = useSession();
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyTeacherAnalytics().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [api]);

  const overall = data?.overall;
  const weeklyAtt = data?.weeklyAttendance;
  const gradeDist = data?.gradeDistribution;
  const classPerf = data?.classPerformance || [];
  const subjPerf = data?.subjectPerformance || [];

  return (
    <>
      <SectionHeader eyebrow="Teaching" title="Analytics" />
      {loading && <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>}
      {!loading && !data && <Card style={{ padding: 24 }}><EmptyState icon="trend" title="No analytics data available" /></Card>}
      {!loading && data && overall.classCount === 0 && (
        <Card style={{ padding: 24 }}><EmptyState icon="trend" title="No active classes yet" desc="You'll see performance charts here once you're assigned a class." /></Card>
      )}
      {!loading && data && overall.classCount > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 20 }}>
            <StatCard label="Avg Attendance" value={overall.avgAttendance + "%"} icon="trend" />
            <StatCard label="Avg Grade" value={overall.avgGrade} icon="grad" />
            <StatCard label="Passing Rate" value={overall.passingRate + "%"} icon="trend" />
            <StatCard label="My Classes" value={overall.classCount} icon="layers" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginBottom: 20 }}>
            <Card style={{ padding: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>Attendance Trend</div>
              {weeklyAtt?.some(v => v > 0) ? (
                <>
                  <div className="font-display" style={{ fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{weeklyAtt[weeklyAtt.length - 1]}%</div>
                  <MiniLineChart data={weeklyAtt} color={chartColor(theme, 0)} height={70} />
                </>
              ) : <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No trend data yet.</div>}
            </Card>
            <Card style={{ padding: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>Grade Distribution</div>
              {gradeDist?.some(g => g.count > 0) ? (
                <>
                  <BarGroup data={gradeDist.map(g => g.count)} maxVal={Math.max(...gradeDist.map(g => g.count), 1)} colors={gradeDist.map((_, i) => chartColor(theme, i))} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    {gradeDist.map((g, i) => (
                      <div key={i} style={{ textAlign: "center", flex: 1 }}>
                        <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>{g.label}</div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>{g.count}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No grade data yet.</div>}
            </Card>
          </div>

          {subjPerf.length > 0 && (
            <Card style={{ padding: 22, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Subject Performance</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {subjPerf.map((s, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: 13 }}>
                      <span>{s.subject}</span><span style={{ color: "var(--muted)" }}>{s.avg}%</span>
                    </div>
                    <div style={{ height: 7, background: "var(--border)", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: s.avg + "%", borderRadius: 6, background: chartColor(theme, i) }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {classPerf.length > 0 && (
            <Card style={{ padding: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Class Performance</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
                {classPerf.map((c, i) => (
                  <div key={c.id} style={{ padding: "14px 16px", background: "var(--surface-alt)", borderRadius: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{c.label}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>
                      <span>Attendance</span><span>{c.avgAttendance}%</span>
                    </div>
                    <div style={{ height: 6, background: "var(--border)", borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", width: c.avgAttendance + "%", borderRadius: 6, background: chartColor(theme, i * 2) }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>
                      <span>Avg Grade</span><span>{c.avgGradePct}%</span>
                    </div>
                    <div style={{ height: 6, background: "var(--border)", borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", width: c.avgGradePct + "%", borderRadius: 6, background: chartColor(theme, i * 2 + 1) }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.studentCount} students</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
