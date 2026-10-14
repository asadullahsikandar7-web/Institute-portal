import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, Avatar, Badge, EmptyState } from "../../../components/ui/index.js";
import { MiniLineChart, BarGroup } from "../../../components/charts/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useTheme } from "../../../context/ThemeContext.jsx";
import { chartColor } from "../../../styles/theme.js";

// Shows only real fields from GET /api/analytics — the original app quietly
// substituted fabricated demo numbers whenever a field was missing (a known
// pre-existing wart); this version shows "no data yet" instead, since a
// fabricated 76%/"B" grade indistinguishable from real data is worse than
// an honest gap.
export default function AnalyticsPage() {
  const { api } = useSession();
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [api]);

  const weeklyAtt = data?.weeklyAttendance;
  const gradeDist = data?.gradeDistribution;
  const subjPerf = data?.subjectPerformance || [];
  const atRisk = data?.atRiskStudents || [];

  return (
    <>
      <SectionHeader eyebrow="Other" title="Analytics" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Avg Attendance" value={data?.avgAttendance != null ? data.avgAttendance + "%" : "—"} icon="trend" />
        <StatCard label="Class Avg Grade" value={data?.avgGrade || "—"} icon="grad" />
        <StatCard label="Passing Rate" value={data?.passingRate != null ? data.passingRate + "%" : "—"} icon="trend" />
        <StatCard label="At-Risk Students" value={atRisk.length} icon="alert" />
      </div>
      {loading && <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>}
      {!loading && !data && <Card style={{ padding: 24 }}><EmptyState icon="trend" title="No analytics data available" /></Card>}
      {!loading && data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginBottom: 20 }}>
            <Card style={{ padding: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>Attendance Trend</div>
              {weeklyAtt?.length ? (
                <>
                  <div className="font-display" style={{ fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{weeklyAtt[weeklyAtt.length - 1]}%</div>
                  <MiniLineChart data={weeklyAtt} color={chartColor(theme, 0)} height={70} />
                </>
              ) : <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No trend data yet.</div>}
            </Card>
            <Card style={{ padding: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>Grade Distribution</div>
              {gradeDist?.length ? (
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
          {atRisk.length > 0 && (
            <Card style={{ padding: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>At-Risk Students</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
                {atRisk.map((s, i) => (
                  <div key={i} style={{ padding: "14px 16px", background: "var(--danger-soft)", borderRadius: 12 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                      <Avatar name={s.name} size={36} />
                      <div><div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>#{s.rollNo}</div></div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Badge tone="warn">Att: {s.attendance}%</Badge>
                      <Badge tone="danger">Grade: {s.grade}</Badge>
                    </div>
                    {s.issue && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 8, fontWeight: 600 }}>{s.issue}</div>}
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
