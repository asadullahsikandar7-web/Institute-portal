import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card } from "../../components/ui/index.js";
import { RingChart } from "../../components/charts/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { chartColor } from "../../styles/theme.js";

export default function StudentAttendancePage() {
  const { api } = useSession();
  const { theme } = useTheme();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMySubjects().then(setSubjects).finally(() => setLoading(false));
  }, [api]);

  const totalPresent = subjects.reduce((s, x) => s + (x.attendance?.present || 0), 0);
  const total = subjects.reduce((s, x) => s + (x.attendance?.total || 0), 0);
  const rate = total ? Math.round(100 * totalPresent / total) : null;

  return (
    <>
      <SectionHeader eyebrow="Academics" title="Attendance" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Overall Rate" value={loading ? "…" : (rate != null ? rate + "%" : "—")} icon="clipboard" />
        <StatCard label="Classes Present" value={loading ? "…" : totalPresent} icon="check" />
        <StatCard label="Classes Recorded" value={loading ? "…" : total} icon="calendar" />
      </div>
      {!loading && subjects.length > 0 && (
        <Card style={{ padding: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>By Subject</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
            {subjects.map((s, i) => (
              <div key={s.teacherAssignmentId} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <RingChart size={80} stroke={8} center={(s.attendance?.rate ?? 0) + "%"} segments={[{ color: chartColor(theme, i), pct: (s.attendance?.rate ?? 0) / 100 }]} />
                <div style={{ fontSize: 11, color: "var(--muted)", maxWidth: 100, textAlign: "center" }}>{s.subject?.name}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
