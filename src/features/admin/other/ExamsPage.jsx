import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, Btn, Icon, Badge, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { fmt } from "../../../lib/utils.js";

export default function ExamsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [exams, setExams] = useState([]);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const EMPTY = { name: "", subject: "", date: "", maxMarks: 100, venue: "" };
  const [form, setForm] = useState(EMPTY);

  const reload = () => {
    setLoading(true);
    Promise.all([api.getExams(), api.getStudents()])
      .then(([e, s]) => { setExams(e); setStudentCount(s.length); })
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  const addExam = async () => {
    if (!form.name || !form.subject || !form.date) return toast("Name, subject, date required");
    setAdding(true);
    try {
      const result = await api.addExam(form);
      toast(`Exam added — notified ${result.emailCount || 0} students`, "check");
      setForm(EMPTY); setShowAdd(false); reload();
    } catch (e) { toast(e.message); }
    finally { setAdding(false); }
  };

  return (
    <>
      <SectionHeader eyebrow="Other" title="Exams" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Total Exams" value={exams.length} icon="file" />
        <StatCard label="Completed" value={exams.filter(e => e.status === "completed").length} icon="check" />
        <StatCard label="Upcoming" value={exams.filter(e => e.status === "upcoming").length} icon="calendar" />
      </div>
      <Card style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Exam Schedule</div>
          <Btn variant="accent" onClick={() => setShowAdd(p => !p)}><Icon name="plus" size={13} />{showAdd ? "Cancel" : "Add Exam"}</Btn>
        </div>
        {showAdd && (
          <div style={{ padding: 16, background: "var(--surface-alt)", borderRadius: 12, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
              <input className="input" placeholder="Exam name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <input className="input" placeholder="Subject" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
              <input className="input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              <input className="input" type="number" placeholder="Max marks" value={form.maxMarks} onChange={e => setForm(p => ({ ...p, maxMarks: e.target.value }))} />
            </div>
            <input className="input" placeholder="Venue (optional)" value={form.venue} onChange={e => setForm(p => ({ ...p, venue: e.target.value }))} />
            {form.name && <Badge tone="info">Will email {studentCount} students about this exam</Badge>}
            <Btn variant="accent" onClick={addExam} disabled={adding} style={{ width: "fit-content" }}><Icon name="check" size={14} />Save & Notify Students</Btn>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}
        {!loading && exams.length === 0 && <EmptyState icon="file" title="No exams yet" desc="Add one above." />}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {exams.map(exam => (
            <div key={exam._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", background: "var(--surface-alt)", borderRadius: 14, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{exam.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{exam.subject} · {fmt(exam.date)}{exam.venue ? ` · ${exam.venue}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Max Marks</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{exam.maxMarks}</div>
                </div>
                <Badge tone={exam.status === "completed" ? "success" : "warn"}>{exam.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
