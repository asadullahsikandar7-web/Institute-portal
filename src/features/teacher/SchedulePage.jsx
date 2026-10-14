import { useEffect, useState } from "react";
import { SectionHeader } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import WeeklyTimetable from "../shared/WeeklyTimetable.jsx";

// Only this teacher's own real, assigned classes — GET /api/schedule/mine
// is scoped server-side to req.user.id, never a client-supplied teacherId.
export default function TeacherSchedulePage() {
  const { api } = useSession();
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMySchedule().then(setEntries).catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [api]);

  return (
    <>
      <SectionHeader eyebrow="Teaching" title="My Timetable" />
      <WeeklyTimetable entries={entries} loading={loading} emptyLabel="No classes scheduled for you yet." />
    </>
  );
}
