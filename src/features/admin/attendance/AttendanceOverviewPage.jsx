import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { today } from "../../../lib/utils.js";

export default function AttendanceOverviewPage() {
  const { api } = useSession();
  const toast = useToast();
  const [assignments, setAssignments] = useState([]);
  const [todayRecords, setTodayRecords] = useState([]);
  const [weekPct, setWeekPct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const d = today();
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    Promise.all([
      api.getTeacherAssignments(),
      api.getSubjectAttendanceAdmin(`date=${d}`),
      api.getSubjectAttendanceAdmin(),
    ]).then(([ta, todayRows, recentRows]) => {
      setAssignments(ta);
      setTodayRecords(todayRows);
      const inWeek = recentRows.filter(r => new Date(r.date) >= weekAgo);
      if (inWeek.length) setWeekPct(Math.round(100 * inWeek.filter(r => r.status === "present").length / inWeek.length));
    }).catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [api]);

  const todayPresent = todayRecords.filter(r => r.status === "present").length;
  const todayPct = todayRecords.length ? Math.round(100 * todayPresent / todayRecords.length) : null;

  return (
    <>
      <SectionHeader eyebrow="Academic" title="Attendance Overview" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Today" value={todayPct != null ? todayPct + "%" : "—"} icon="clipboard" />
        <StatCard label="Last 7 Days" value={weekPct != null ? weekPct + "%" : "—"} icon="clipboard" />
        <StatCard label="Records Today" value={todayRecords.length} icon="check" />
        <StatCard label="Classes Tracked" value={assignments.length} icon="layers" />
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead><tr><th>Program</th><th>Section</th><th>Subject</th><th>Teacher</th><th>Today's %</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>Loading…</td></tr>}
            {!loading && assignments.map(ta => {
              const rows = todayRecords.filter(r => (r.section?._id || r.section) === (ta.section?._id || ta.section) && (r.subject?._id || r.subject) === (ta.subject?._id || ta.subject));
              const pct = rows.length ? Math.round(100 * rows.filter(r => r.status === "present").length / rows.length) : null;
              return (
                <tr key={ta._id}>
                  <td>{ta.program?.name}</td><td>{ta.section?.name}</td><td>{ta.subject?.name}</td><td>{ta.teacher?.name}</td>
                  <td>{pct == null ? <span style={{ color: "var(--muted)" }}>Not marked</span> : pct + "%"}</td>
                </tr>
              );
            })}
            {!loading && assignments.length === 0 && <tr><td colSpan={5}><EmptyState icon="clipboard" title="No teacher assignments yet" /></td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
