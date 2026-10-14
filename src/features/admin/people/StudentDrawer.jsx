import { useEffect, useState } from "react";
import { Drawer, Avatar, Badge, Chain, ProgressBar, Icon } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";

export default function StudentDrawer({ student, assignments, onClose }) {
  const { api } = useSession();
  const [attendance, setAttendance] = useState(null);
  const [grades, setGrades] = useState([]);
  const enrollment = student.currentEnrollment;

  const subs = assignments.filter(a => (a.section?._id || a.section) === (enrollment?.section?._id || enrollment?.section));

  useEffect(() => {
    api.getSubjectAttendanceAdmin(`student=${student._id}`).then(rows => {
      if (!rows.length) return setAttendance(0);
      const present = rows.filter(r => r.status === "present").length;
      setAttendance(Math.round(100 * present / rows.length));
    }).catch(() => setAttendance(null));
    api.getGrades(student._id).then(setGrades).catch(() => setGrades([]));
  }, [student._id, api]);

  return (
    <Drawer title={student.name} subtitle={student.rollNo} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <Avatar name={student.name} size={56} img={student.photo || undefined} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{student.name}</div>
          <div className="font-mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>{student.registrationNo || "—"}</div>
          <Badge tone={student.isActive === false ? "neutral" : "success"}>{student.isActive === false ? "Inactive" : "Active"}</Badge>
        </div>
      </div>
      <Chain items={[enrollment?.program?.name, enrollment?.section?.name, enrollment?.academicSession?.name]} />
      <div style={{ height: 18 }} />

      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>Subjects</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {subs.map(s => <Badge tone="neutral" key={s._id}>{s.subject?.name}</Badge>)}
        {subs.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>No subjects assigned to this section yet.</span>}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>Parent / Guardian</div>
      <div className="card" style={{ padding: 14, marginBottom: 20 }}>
        {student.parentId ? (
          <>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{student.parentId.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{student.parentId.phone} · {student.parentId.email}</div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{student.parentName || "No parent record linked"} {student.parentEmail && `· ${student.parentEmail}`}</div>
        )}
        <div style={{ marginTop: 12, padding: "9px 11px", background: "var(--surface-alt)", borderRadius: 9, fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="message" size={14} /> WhatsApp integration coming soon
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>Attendance Summary</div>
      <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span>Overall</span><b>{attendance == null ? "—" : attendance + "%"}</b>
      </div>
      <ProgressBar pct={attendance || 0} />
      <div style={{ height: 20 }} />

      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>Results Summary</div>
      {grades.map(r => (
        <div key={r._id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
          <span>{r.subject} · {r.examName}</span><b>{r.marks}/{r.maxMarks}</b>
        </div>
      ))}
      {grades.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No results recorded yet.</div>}
    </Drawer>
  );
}
