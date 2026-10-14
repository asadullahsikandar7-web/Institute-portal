import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionHeader, StatCard, Card, Chain, Badge, Icon } from "../../components/ui/index.js";
import { AttentionCard } from "../erp/SmartWidgets.jsx";
import { BarGroup } from "../../components/charts/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { today, fmtTime12h, firstName } from "../../lib/utils.js";
import { chartColor } from "../../styles/theme.js";
import { todayName } from "../shared/WeeklyTimetable.jsx";

export default function TeacherDashboardPage() {
  const { session, api } = useSession();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [todayRates, setTodayRates] = useState({});
  const [todaysSchedule, setTodaysSchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getMyClasses().then(async data => {
      if (cancelled) return;
      setClasses(data);
      const rates = {};
      await Promise.all(data.map(async c => {
        try {
          const att = await api.getClassAttendance(c._id, today());
          const students = att.students || [];
          const marked = students.filter(s => s.status !== "unmarked");
          rates[c._id] = marked.length ? Math.round(100 * marked.filter(s => s.status === "present").length / marked.length) : 0;
        } catch { rates[c._id] = 0; }
      }));
      if (!cancelled) setTodayRates(rates);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    api.getMySchedule()
      .then(entries => { if (!cancelled) setTodaysSchedule(entries.filter(e => e.day === todayName()).sort((a, b) => a.startTime.localeCompare(b.startTime))); })
      .catch(() => { if (!cancelled) setTodaysSchedule([]); })
      .finally(() => { if (!cancelled) setScheduleLoading(false); });
    return () => { cancelled = true; };
  }, [api]);

  const avgRate = classes.length ? Math.round(classes.reduce((s, c) => s + (todayRates[c._id] || 0), 0) / classes.length) : 0;

  return (
    <>
      <SectionHeader eyebrow="Overview" title={`Good day, ${firstName(session.teacher?.name) || "Teacher"}`} />
      <AttentionCard />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="My Classes" value={loading ? "…" : classes.length} icon="layers" />
        <StatCard label="Avg. Today's Attendance" value={loading ? "…" : avgRate + "%"} icon="clipboard" />
      </div>

      <Card style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>Today's Classes ({todayName()})</div>
        {scheduleLoading ? (
          <div style={{ padding: 10, color: "var(--muted)", fontSize: 13 }}>Loading…</div>
        ) : todaysSchedule.length === 0 ? (
          <div style={{ padding: 10, color: "var(--muted)", fontSize: 13 }}>No real-timetable classes scheduled for you today.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {todaysSchedule.map(e => (
              <div key={e._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", background: "var(--surface-alt)", borderRadius: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, minWidth: 78 }}>{fmtTime12h(e.startTime)} – {fmtTime12h(e.endTime)}</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{e.subject?.name}</span>
                      <Badge tone={e.type === "Lab" ? "info" : "accent"}>{e.type}</Badge>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{e.program?.name} {e.section?.name} · {e.room?.name}</div>
                  </div>
                </div>
                {e.teacherAssignment && (
                  <button className="btn btn-ghost" onClick={() => navigate(`/teacher/myclasses/${e.teacherAssignment}/attendance`)}>
                    <Icon name="clipboard" size={13} />Take Attendance
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {!loading && classes.length > 0 && (
        <Card style={{ padding: 22, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>Today's Attendance by Class</div>
          <BarGroup data={classes.map(c => todayRates[c._id] || 0)} maxVal={100} colors={classes.map((_, i) => chartColor(theme, i))} />
          <div style={{ display: "flex", gap: 3, marginTop: 8 }}>
            {classes.map(c => (
              <div key={c._id} style={{ flex: 1, minWidth: 4, textAlign: "center", fontSize: 9, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.subject?.name}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase" }}>My Classes</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
        {classes.map(c => (
          <Card key={c._id} style={{ padding: 16, cursor: "pointer" }} onClick={() => navigate(`/teacher/myclasses/${c._id}/overview`)}>
            <Chain items={[c.program?.name, c.section?.name, c.subject?.name]} />
            {todayRates[c._id] != null && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Today: {todayRates[c._id]}% present</div>}
          </Card>
        ))}
        {!loading && classes.length === 0 && (
          <Card style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>No classes assigned yet.</Card>
        )}
      </div>
    </>
  );
}
