import { useState } from "react";
import { Card, Badge, EmptyState } from "../../components/ui/index.js";
import { fmtTime12h } from "../../lib/utils.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const todayName = () => new Date().toLocaleDateString("en-US", { weekday: "long" });

// One real class slot — used identically by admin/teacher/student views so
// "what a class looks like" never drifts between roles. `showSection` is
// only true for the admin view, where entries span multiple sections.
function ScheduleRow({ entry, showSection }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "stretch", padding: "14px 18px", background: "var(--surface-alt)", borderRadius: 14, borderLeft: `3px solid ${entry.type === "Lab" ? "var(--info)" : "var(--accent)"}` }}>
      <div style={{ width: 84, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{fmtTime12h(entry.startTime)}</div>
        <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{fmtTime12h(entry.endTime)}</div>
      </div>
      <div style={{ width: 1, background: "var(--border)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{entry.subject?.name}</div>
          <Badge tone={entry.type === "Lab" ? "info" : "accent"}>{entry.type}</Badge>
          {showSection && <Badge tone="neutral">{entry.program?.name} {entry.section?.name}</Badge>}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span>{entry.subject?.code}</span>
          <span>{entry.teacher?.name || "TBA"}</span>
          <span>{entry.room?.name || "—"}</span>
        </div>
      </div>
    </div>
  );
}

// Groups entries by day and renders a day-pill switcher + that day's slots,
// sorted by start time. Pass `entries` already scoped to whatever the
// caller is allowed to see (admin: everything / a filtered set; teacher:
// their own; student: their section's) — this component does no scoping
// itself, only display.
export default function WeeklyTimetable({ entries, loading, showSection = false, emptyLabel = "No classes scheduled." }) {
  const present = [...new Set(entries.map(e => e.day))];
  const orderedDays = DAYS.filter(d => present.includes(d));
  const [activeDay, setActiveDay] = useState(() => (orderedDays.includes(todayName()) ? todayName() : orderedDays[0] || "Monday"));
  const day = orderedDays.includes(activeDay) ? activeDay : (orderedDays[0] || "Monday");

  const dayEntries = entries.filter(e => e.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (loading) return <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>;
  if (entries.length === 0) return <Card style={{ padding: 24 }}><EmptyState icon="calendar" title={emptyLabel} /></Card>;

  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--surface-alt)", borderRadius: 12, padding: 4, width: "fit-content", flexWrap: "wrap" }}>
        {orderedDays.map(d => (
          <button key={d} onClick={() => setActiveDay(d)} className="btn" style={{
            padding: "8px 16px",
            background: day === d ? "var(--accent)" : "transparent",
            color: day === d ? "#1a1204" : d === todayName() ? "var(--accent-ink)" : "var(--muted)",
          }}>
            {d.slice(0, 3)}
          </button>
        ))}
      </div>
      {dayEntries.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>No classes scheduled for {day}.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {dayEntries.map(e => <ScheduleRow key={e._id} entry={e} showSection={showSection} />)}
        </div>
      )}
    </Card>
  );
}

export { todayName };
