import { useEffect, useState } from "react";
import { SectionHeader, Card, Btn, Icon, Modal, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { CsvImportButton } from "../../../components/CsvImport.jsx";
import SuggestionsButton from "../../../components/Suggestions.jsx";
import { SUBJECT_SUGGESTIONS } from "../../../lib/suggestions.js";
import { subjectsImport } from "../../../lib/csvImports.js";

function AddSubjectModal({ onClose, onCreated }) {
  const { api } = useSession();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", code: "", creditHours: "", description: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.code.trim()) return toast("Name and code are required");
    setSaving(true);
    try {
      const created = await api.addSubject({ ...form, creditHours: Number(form.creditHours) || undefined });
      toast("Subject added", "check");
      onCreated(created);
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Add Subject" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" onClick={submit} disabled={saving}>Add Subject</Btn>
    </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div><label className="field-label">Subject Name</label><input className="input" placeholder="e.g. Data Structures" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
        <div><label className="field-label">Code</label><input className="input" placeholder="e.g. CS-201" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
        <div><label className="field-label">Credit Hours</label><input className="input" type="number" value={form.creditHours} onChange={e => setForm(p => ({ ...p, creditHours: e.target.value }))} /></div>
        <div><label className="field-label">Description</label><input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
      </div>
    </Modal>
  );
}

export default function SubjectsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([api.getSubjects(), api.getTeacherAssignments()])
      .then(([s, ta]) => { setSubjects(s); setAssignments(ta); })
      .catch(e => toast(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  return (
    <>
      <SectionHeader eyebrow="Academic" title="Subjects" action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><SuggestionsButton title="Suggested subjects" catalog={SUBJECT_SUGGESTIONS} existing={subjects.flatMap(s => [s.name, s.code])} submit={d => api.addSubject(d)} onDone={reload} note="Subjects are shared by all classes — link them to a class & teacher under Teacher Assignments." /><CsvImportButton {...subjectsImport(api)} onDone={reload} /><Btn variant="accent" onClick={() => setModal(true)}><Icon name="plus" size={14} />Add Subject</Btn></div>} />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead><tr><th>Subject</th><th>Code</th><th>Credit Hours</th><th>Assigned Classes</th><th>Assigned Teachers</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>Loading…</td></tr>}
            {!loading && subjects.map(sub => {
              const tas = assignments.filter(a => (a.subject?._id || a.subject) === sub._id);
              const classes = [...new Set(tas.map(t => t.program?._id || t.program))].length;
              const teachers = [...new Set(tas.map(t => t.teacher?._id || t.teacher))].length;
              return (
                <tr key={sub._id}>
                  <td style={{ fontWeight: 600, color: "var(--ink)" }}>{sub.name}</td>
                  <td className="font-mono">{sub.code}</td>
                  <td>{sub.creditHours ?? "—"}</td>
                  <td>{classes} classes</td>
                  <td>{teachers} teachers</td>
                </tr>
              );
            })}
            {!loading && subjects.length === 0 && <tr><td colSpan={5}><EmptyState icon="book" title="No subjects yet" /></td></tr>}
          </tbody>
        </table>
      </Card>
      {modal && <AddSubjectModal onClose={() => setModal(false)} onCreated={() => { setModal(false); reload(); }} />}
    </>
  );
}
