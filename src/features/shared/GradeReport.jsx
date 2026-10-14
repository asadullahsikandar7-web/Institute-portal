import { useEffect, useState } from "react";
import { StatCard, Card, Avatar, Btn, Icon } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { fmt, gradeLabel, gradeColorVar } from "../../lib/utils.js";

// Shared between Admin (pick any student, can add grades) and Student
// (their own grades, read-only) — both use the legacy Grade model, the
// only results data source that exists (free-text subject/examName, not
// linked to the new Subject hierarchy — a known, accepted limitation).
export default function GradeReport({ student, students, onSelectStudent, isAdmin }) {
  const { api } = useSession();
  const toast = useToast();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newGrade, setNewGrade] = useState({ subject: "", examName: "", marks: "", maxMarks: 100 });

  useEffect(() => {
    if (!student) return;
    setLoading(true);
    api.getGrades(student._id).then(d => setGrades(Array.isArray(d) ? d : [])).catch(() => setGrades([])).finally(() => setLoading(false));
  }, [student, api]);

  const avgPct = grades.length ? Math.round(grades.reduce((s, g) => s + (g.marks / g.maxMarks * 100), 0) / grades.length) : 0;

  const saveGrade = async () => {
    if (!newGrade.subject || !newGrade.examName || newGrade.marks === "") return toast("Fill all fields");
    try {
      const result = await api.addGrade({ ...newGrade, studentId: student._id, marks: Number(newGrade.marks), maxMarks: Number(newGrade.maxMarks) || 100 });
      setGrades(p => [...p, result.grade || result]);
      setNewGrade({ subject: "", examName: "", marks: "", maxMarks: 100 });
      setShowAdd(false);
      toast("Grade saved", "check");
    } catch (e) { toast(e.message); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
        <StatCard label="Subjects Recorded" value={grades.length} icon="book" />
        <StatCard label="Average Score" value={`${avgPct}%`} icon="trend" />
        <StatCard label="Overall Grade" value={gradeLabel(avgPct)} icon="grad" />
      </div>
      <Card style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Grade Report</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {isAdmin && students?.length > 1 && (
              <select className="input" style={{ width: "auto" }} value={student?._id || ""} onChange={e => onSelectStudent(students.find(s => s._id === e.target.value))}>
                {students.map(s => <option key={s._id} value={s._id}>{s.name} (#{s.rollNo})</option>)}
              </select>
            )}
            {isAdmin && <Btn variant="accent" onClick={() => setShowAdd(p => !p)}><Icon name="plus" size={13} />Add Grade</Btn>}
          </div>
        </div>
        {student && (
          <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "16px 18px", background: "var(--accent-soft)", borderRadius: 14, marginBottom: 18, flexWrap: "wrap" }}>
            <Avatar name={student.name} size={44} img={student.photo || undefined} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{student.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Roll #{student.rollNo}</div>
            </div>
            <div style={{ textAlign: "center", padding: "0 20px" }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: gradeColorVar(avgPct) }} className="font-display">{gradeLabel(avgPct)}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>OVERALL GRADE</div>
            </div>
            <div style={{ textAlign: "center", padding: "0 20px", borderLeft: "1px solid var(--border)" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }} className="font-display">{avgPct}%</div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>AVERAGE</div>
            </div>
          </div>
        )}
        {showAdd && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8, padding: 14, background: "var(--surface-alt)", borderRadius: 12, marginBottom: 16 }}>
            <input className="input" placeholder="Subject" value={newGrade.subject} onChange={e => setNewGrade(p => ({ ...p, subject: e.target.value }))} />
            <input className="input" placeholder="Exam name" value={newGrade.examName} onChange={e => setNewGrade(p => ({ ...p, examName: e.target.value }))} />
            <input className="input" type="number" placeholder="Marks" value={newGrade.marks} onChange={e => setNewGrade(p => ({ ...p, marks: e.target.value }))} />
            <input className="input" type="number" placeholder="Max" value={newGrade.maxMarks} onChange={e => setNewGrade(p => ({ ...p, maxMarks: e.target.value }))} />
            <Btn variant="accent" onClick={saveGrade}><Icon name="check" size={14} />Save</Btn>
          </div>
        )}
        {loading && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}
        {!loading && grades.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No grades recorded yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {grades.map((g, i) => {
            const pct = Math.round(g.marks / g.maxMarks * 100);
            return (
              <div key={g._id || i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", alignItems: "center", gap: 10, padding: "14px 16px", background: "var(--surface-alt)", borderRadius: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{g.subject}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{g.examName}</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{g.date ? fmt(g.date) : ""}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{g.marks}/{g.maxMarks}</div>
                <div>
                  <div style={{ height: 5, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", borderRadius: 4, background: gradeColorVar(pct) }} />
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{pct}%</div>
                </div>
                <div style={{ textAlign: "center" }}><span style={{ fontSize: 18, fontWeight: 700, color: gradeColorVar(pct) }}>{gradeLabel(pct)}</span></div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
