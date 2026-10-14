import { useEffect, useState } from "react";
import { SectionHeader, Card, StatCard, Btn, Icon } from "../../../components/ui/index.js";
import { AutoTimetableModal } from "../../erp/SmartWidgets.jsx";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { CsvImportButton } from "../../../components/CsvImport.jsx";
import { scheduleImport } from "../../../lib/csvImports.js";
import WeeklyTimetable, { todayName } from "../../shared/WeeklyTimetable.jsx";

// Real, relational class schedule — GET /api/schedule, filtered client-side
// by the dropdowns below. This is a different feature from the legacy
// "Timetable" page under Other (free-text teacher/room, no conflict
// checking) — that page is untouched; this one is backed by the real
// Program/Section/Subject/Room/TeacherAssignment hierarchy.
export default function ClassSchedulePage() {
  const { api } = useSession();
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ day: "", teacher: "", subject: "", section: "", room: "" });
  const [generating, setGenerating] = useState(false);

  const reload = () => {
    Promise.all([api.getScheduleAdmin(), api.getTeachersList(), api.getSubjects(), api.getSections(), api.getRooms()])
      .then(([sched, t, subj, sec, rm]) => {
        setEntries(sched); setTeachers(t); setSubjects(subj); setSections(sec); setRooms(rm);
      })
      .catch(e => toast(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  const filtered = entries.filter(e =>
    (!filters.day || e.day === filters.day) &&
    (!filters.teacher || e.teacher?._id === filters.teacher) &&
    (!filters.subject || e.subject?._id === filters.subject) &&
    (!filters.section || e.section?._id === filters.section) &&
    (!filters.room || e.room?._id === filters.room)
  );

  const todayCount = entries.filter(e => e.day === todayName()).length;
  const teacherCountToday = new Set(entries.filter(e => e.day === todayName() && e.teacher).map(e => e.teacher._id)).size;
  const roomCountToday = new Set(entries.filter(e => e.day === todayName()).map(e => e.room?._id)).size;
  const tbaCount = entries.filter(e => !e.teacher).length;

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <>
      <SectionHeader eyebrow="Academic" title="Class Schedule" action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><CsvImportButton {...scheduleImport(api)} onDone={reload} /><Btn variant="accent" onClick={() => setGenerating(true)}><Icon name="calendar" size={13} />Generate Timetable</Btn></div>} />
      {generating && <AutoTimetableModal onClose={() => setGenerating(false)} onDone={() => { setGenerating(false); reload(); }} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Today's Classes" value={loading ? "…" : todayCount} icon="calendar" />
        <StatCard label="Teachers Today" value={loading ? "…" : teacherCountToday} icon="grad" />
        <StatCard label="Rooms in Use Today" value={loading ? "…" : roomCountToday} icon="layers" />
        <StatCard label="TBA Slots" value={loading ? "…" : tbaCount} icon="alert" />
      </div>

      <Card style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <select className="input" value={filters.day} onChange={e => setFilters(f => ({ ...f, day: e.target.value }))}>
            <option value="">All days</option>
            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="input" value={filters.teacher} onChange={e => setFilters(f => ({ ...f, teacher: e.target.value }))}>
            <option value="">All teachers</option>
            {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          <select className="input" value={filters.subject} onChange={e => setFilters(f => ({ ...f, subject: e.target.value }))}>
            <option value="">All subjects</option>
            {subjects.map(s => <option key={s._id} value={s._id}>{s.code} — {s.name}</option>)}
          </select>
          <select className="input" value={filters.section} onChange={e => setFilters(f => ({ ...f, section: e.target.value }))}>
            <option value="">All sections</option>
            {sections.map(s => <option key={s._id} value={s._id}>{s.program?.name} {s.name}</option>)}
          </select>
          <select className="input" value={filters.room} onChange={e => setFilters(f => ({ ...f, room: e.target.value }))}>
            <option value="">All rooms</option>
            {rooms.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
          </select>
        </div>
      </Card>

      <WeeklyTimetable entries={filtered} loading={loading} showSection emptyLabel="No schedule entries match these filters." />
    </>
  );
}
