import { useCallback, useEffect, useState } from "react";
import { Card, Btn, Icon, EmptyState } from "../../../components/ui/index.js";
import { fmt } from "../../../lib/utils.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { SubmissionsModal } from "../../erp/PortalPages.jsx";

const EMPTY = { title: "", description: "", dueDate: "", totalMarks: "" };

export default function CourseworkTab({ cls }) {
  const { api } = useSession();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    api.getClassCoursework(cls._id).then(d => setItems(Array.isArray(d) ? d : [])).catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [cls._id, api]);
  useEffect(reload, [cls._id]);

  const save = async () => {
    if (!form.title.trim() || !form.dueDate) return toast("Title and due date are required");
    setSaving(true);
    try {
      await api.addCoursework(cls._id, { ...form, totalMarks: form.totalMarks || undefined });
      toast("Assignment created", "check");
      setForm(EMPTY); setShowForm(false); reload();
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };
  const remove = async id => {
    if (!confirm("Delete this assignment?")) return;
    try { await api.deleteCoursework(id); toast("Deleted", "check"); reload(); } catch (e) { toast(e.message); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Assignments ({items.length})</div>
          <Btn variant="accent" onClick={() => setShowForm(p => !p)}><Icon name="plus" size={14} />{showForm ? "Cancel" : "New Assignment"}</Btn>
        </div>
        {showForm && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 16 }}>
            <div><label className="field-label">Title</label><input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><label className="field-label">Due Date</label><input className="input" type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
            <div><label className="field-label">Total Marks</label><input className="input" type="number" value={form.totalMarks} onChange={e => setForm(p => ({ ...p, totalMarks: e.target.value }))} /></div>
            <div style={{ gridColumn: "1/-1" }}><label className="field-label">Description</label><input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <Btn variant="accent" onClick={save} disabled={saving} style={{ gridColumn: "1/-1", justifyContent: "center" }}>Save</Btn>
          </div>
        )}
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
        {loading ? <div style={{ padding: 30, textAlign: "center", gridColumn: "1/-1", color: "var(--muted)" }}>Loading…</div> :
          items.length === 0 ? <Card style={{ padding: 32, gridColumn: "1/-1" }}><EmptyState icon="file" title="No assignments yet." /></Card> :
            items.map(it => (
              <Card key={it._id} style={{ padding: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{it.title}</div>
                {it.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{it.description}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Due {fmt(it.dueDate)}{it.totalMarks ? ` · ${it.totalMarks} marks` : ""}</div>
                  <button className="icon-btn" onClick={() => remove(it._id)} style={{ color: "var(--danger)" }}><Icon name="x" size={13} /></button>
                </div>
                <Btn variant="ghost" full onClick={() => setViewing(it)} style={{ marginTop: 12 }}><Icon name="clipboard" size={13} />Submissions & Grading</Btn>
              </Card>
            ))}
      </div>
      {viewing && <SubmissionsModal item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
