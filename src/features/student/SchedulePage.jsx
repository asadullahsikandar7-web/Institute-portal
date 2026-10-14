import { useEffect, useState } from "react";
import { SectionHeader } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import WeeklyTimetable from "../shared/WeeklyTimetable.jsx";

// Only this student's own section's real timetable — GET /api/schedule/student
// is resolved server-side from the student's active enrollment, never a
// client-supplied program/section id.
export default function StudentSchedulePage() {
  const { api } = useSession();
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStudentSchedule().then(setEntries).catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [api]);

  return (
    <>
      <SectionHeader eyebrow="Academics" title="Timetable" />
      <WeeklyTimetable entries={entries} loading={loading} emptyLabel="No timetable published for your section yet." />
    </>
  );
}
