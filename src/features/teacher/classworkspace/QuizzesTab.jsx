import { useCallback, useEffect, useState } from "react";
import { Card, Btn, Icon, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { QuizBuilderModal } from "../../erp/PortalPages.jsx";

const EMPTY = { title: "", description: "", scheduledAt: "", durationMinutes: "", totalMarks: "" };

export default function QuizzesTab({ cls }) {
  const { api } = useSession();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [building, setBuilding] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    api.getClassQuizzes(cls._id).then(d => setItems(Array.isArray(d) ? d : [])).catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [cls._id, api]);
  useEffect(reload, [cls._id]);

  const save = async () => {
    if (!form.title.trim() || !form.scheduledAt) return toast("Title and scheduled date/time are required");
    setSaving(true);
    try {
      await api.addQuiz(cls._id, { ...form, durationMinutes: form.durationMinutes || undefined, totalMarks: form.totalMarks || undefined });
      toast("Quiz created", "check");
      setForm(EMPTY); setShowForm(false); reload();
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };
  const remove = async id => {
    if (!confirm("Delete this quiz?")) return;
    try { await api.deleteQuiz(id); toast("Deleted", "check"); reload(); } catch (e) { toast(e.message); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Quizzes ({items.length})</div>
          <Btn variant="accent" onClick={() => setShowForm(p => !p)}><Icon name="plus" size={14} />{showForm ? "Cancel" : "New Quiz"}</Btn>
        </div>
        {showForm && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 16 }}>
            <div><label className="field-label">Title</label><input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><label className="field-label">Scheduled</label><input className="input" type="datetime-local" value={form.scheduledAt} onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))} /></div>
            <div><label className="field-label">Duration (min)</label><input className="input" type="number" value={form.durationMinutes} onChange={e => setForm(p => ({ ...p, durationMinutes: e.target.value }))} /></div>
            <div><label className="field-label">Total Marks</label><input className="input" type="number" value={form.totalMarks} onChange={e => setForm(p => ({ ...p, totalMarks: e.target.value }))} /></div>
            <div style={{ gridColumn: "1/-1" }}><label className="field-label">Description</label><input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <Btn variant="accent" onClick={save} disabled={saving} style={{ gridColumn: "1/-1", justifyContent: "center" }}>Save</Btn>
          </div>
        )}
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
        {loading ? <div style={{ padding: 30, textAlign: "center", gridColumn: "1/-1", color: "var(--muted)" }}>Loading…</div> :
          items.length === 0 ? <Card style={{ padding: 32, gridColumn: "1/-1" }}><EmptyState icon="trend" title="No quizzes yet." /></Card> :
            items.map(it => (
              <Card key={it._id} style={{ padding: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{it.title}</div>
                {it.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{it.description}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {new Date(it.scheduledAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {it.totalMarks ? ` · ${it.totalMarks} marks` : ""}
                  </div>
                  <button className="icon-btn" onClick={() => remove(it._id)} style={{ color: "var(--danger)" }}><Icon name="x" size={13} /></button>
                </div>
                <Btn variant="ghost" full onClick={() => setBuilding(it)} style={{ marginTop: 12 }}>
                  <Icon name="file" size={13} />{it.questions?.length ? `${it.questions.length} questions · Results` : "Add questions (online quiz)"}
                </Btn>
              </Card>
            ))}
      </div>
      {building && <QuizBuilderModal quiz={building} onClose={() => setBuilding(null)} onSaved={() => { setBuilding(null); reload(); }} />}
    </div>
  );
}
