import { useEffect, useState } from "react";
import { SectionHeader, Card, Select, Btn, Icon, EmptyState } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

// Grade entry for the teacher's own classes — a real gap in the previous
// app (only Admin could record marks). Uses the existing legacy Grade
// model/endpoints (subject stored as free text, tagged with this class's
// subject name) since that's the only results data source that exists;
// no new backend model was warranted for this.
export default function TeacherResultsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [roster, setRoster] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [grades, setGrades] = useState([]);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [form, setForm] = useState({ examName: "", marks: "", maxMarks: "100" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getMyClasses().then(data => { setClasses(data); if (data[0]) setClassId(data[0]._id); }).catch(e => toast(e.message));
  }, [api]);

  const cls = classes.find(c => c._id === classId);

  useEffect(() => {
    if (!classId) return;
    setStudentId("");
    api.getClassStudents(classId).then(d => setRoster(Array.isArray(d) ? d : [])).catch(e => toast(e.message));
  }, [classId, api]);

  useEffect(() => {
    if (!studentId || !cls) { setGrades([]); return; }
    setLoadingGrades(true);
    api.getGrades(studentId)
      .then(d => setGrades((Array.isArray(d) ? d : []).filter(g => g.subject === cls.subject?.name)))
      .catch(e => toast(e.message))
      .finally(() => setLoadingGrades(false));
  }, [studentId, cls, api]);

  const save = async () => {
    if (!studentId) return toast("Choose a student first");
    if (!form.examName.trim() || form.marks === "") return toast("Exam name and marks are required");
    setSaving(true);
    try {
      const g = await api.addGrade({ studentId, subject: cls.subject?.name, examName: form.examName, marks: Number(form.marks), maxMarks: Number(form.maxMarks) || 100 });
      setGrades(p => [...p, g]);
      setForm({ examName: "", marks: "", maxMarks: "100" });
      toast("Grade recorded", "check");
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <SectionHeader eyebrow="Teaching" title="Results" />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Select value={classId} onChange={e => setClassId(e.target.value)} style={{ maxWidth: 320 }}>
          {classes.map(c => <option key={c._id} value={c._id}>{c.subject?.name} — {c.program?.name} {c.section?.name}</option>)}
        </Select>
        <Select value={studentId} onChange={e => setStudentId(e.target.value)} style={{ maxWidth: 260 }} disabled={!roster.length}>
          <option value="">Select student…</option>
          {roster.map(s => <option key={s._id} value={s._id}>{s.name} · {s.rollNo}</option>)}
        </Select>
      </div>

      {!studentId ? (
        <Card style={{ padding: 24 }}><EmptyState icon="grad" title="Pick a class and student" desc="Select a student above to view or record their grades for this subject." /></Card>
      ) : (
        <>
          <Card style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Record a Grade</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
              <input className="input" placeholder="Exam name (e.g. Mid Term)" value={form.examName} onChange={e => setForm(p => ({ ...p, examName: e.target.value }))} />
              <input className="input" type="number" placeholder="Marks obtained" value={form.marks} onChange={e => setForm(p => ({ ...p, marks: e.target.value }))} />
              <input className="input" type="number" placeholder="Out of" value={form.maxMarks} onChange={e => setForm(p => ({ ...p, maxMarks: e.target.value }))} />
              <Btn variant="accent" onClick={save} disabled={saving}><Icon name="check" size={13} />Save</Btn>
            </div>
          </Card>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table className="table">
              <thead><tr><th>Exam</th><th>Marks</th></tr></thead>
              <tbody>
                {loadingGrades && <tr><td colSpan={2} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>Loading…</td></tr>}
                {!loadingGrades && grades.map(g => (
                  <tr key={g._id}><td>{g.examName}</td><td>{g.marks}/{g.maxMarks}</td></tr>
                ))}
                {!loadingGrades && grades.length === 0 && (
                  <tr><td colSpan={2} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>No grades recorded yet for this subject.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
