import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionHeader, Card, Avatar, Badge, Btn, Icon, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import AddStudentWizard from "./AddStudentWizard.jsx";
import StudentDrawer from "./StudentDrawer.jsx";

export default function StudentsPage() {
  const navigate = useNavigate();
  const { api } = useSession();
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [sections, setSections] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [openStudent, setOpenStudent] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([api.getStudents(), api.getAcademicSessions(), api.getPrograms(), api.getSections(), api.getTeacherAssignments()])
      .then(([st, se, pr, sec, ta]) => { setStudents(st); setSessions(se); setPrograms(pr); setSections(sec); setAssignments(ta); })
      .catch(e => toast(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  const rows = students.filter(s => {
    const progId = s.currentEnrollment?.program?._id || s.currentEnrollment?.program;
    return (!filterProgram || progId === filterProgram) &&
      (!q || s.name.toLowerCase().includes(q.toLowerCase()) || s.rollNo.toLowerCase().includes(q.toLowerCase()));
  });

  return (
    <>
      <SectionHeader eyebrow="People" title="Students" action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Btn variant="ghost" onClick={() => navigate("/admin/import")}><Icon name="upload" size={13} />Import CSV</Btn><Btn variant="accent" onClick={() => setAddOpen(true)}><Icon name="plus" size={14} />Add Student</Btn></div>} />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search name or roll no…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 220 }} value={filterProgram} onChange={e => setFilterProgram(e.target.value)}>
          <option value="">All programs</option>
          {programs.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </div>
      <Card style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead><tr><th>Student</th><th>Roll No.</th><th>Program</th><th>Section</th><th>Session</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>Loading…</td></tr>}
            {!loading && rows.map(st => {
              const e = st.currentEnrollment;
              return (
                <tr key={st._id} className="clickable" onClick={() => setOpenStudent(st)}>
                  <td style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink)", fontWeight: 600 }}><Avatar name={st.name} size={28} img={st.photo || undefined} />{st.name}</td>
                  <td className="font-mono">{st.rollNo}</td>
                  <td>{e?.program?.name || "—"}</td>
                  <td>{e?.section?.name || "—"}</td>
                  <td>{e?.academicSession?.name || "—"}</td>
                  <td><Badge tone={st.isActive === false ? "neutral" : "success"}>{st.isActive === false ? "Inactive" : "Active"}</Badge></td>
                  <td><Icon name="chevronRight" size={15} /></td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && <tr><td colSpan={7}><EmptyState icon="users" title="No students found" desc="Try adjusting your search or filters." /></td></tr>}
          </tbody>
        </table>
      </Card>
      {openStudent && <StudentDrawer student={openStudent} assignments={assignments} onClose={() => setOpenStudent(null)} />}
      {addOpen && <AddStudentWizard sessions={sessions} programs={programs} sections={sections} onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); reload(); }} />}
    </>
  );
}
