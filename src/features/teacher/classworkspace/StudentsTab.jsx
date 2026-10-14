import { useEffect, useState } from "react";
import { Card, Avatar, Badge, EmptyState } from "../../../components/ui/index.js";
import { today, statusMeta } from "../../../lib/utils.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";

export default function StudentsTab({ cls }) {
  const { api } = useSession();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getClassAttendance(cls._id, today()).then(d => setRows(Array.isArray(d.students) ? d.students : []))
      .catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [cls._id, api]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>;

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <table className="table">
        <thead><tr><th>Student</th><th>Roll No.</th><th>Today's Status</th></tr></thead>
        <tbody>
          {rows.map(s => {
            const meta = statusMeta(s.status);
            return (
              <tr key={s.studentId}>
                <td style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, color: "var(--ink)" }}>
                  <Avatar name={s.name} size={28} img={s.photo || undefined} />{s.name}
                </td>
                <td className="font-mono">{s.rollNo}</td>
                <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={3}><EmptyState icon="users" title="No students enrolled in this section yet." /></td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
