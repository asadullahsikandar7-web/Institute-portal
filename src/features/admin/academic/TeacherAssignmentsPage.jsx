import { useEffect, useState } from "react";
import { SectionHeader, Card, Btn, Icon, Modal, Avatar, Badge, Chain, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { CsvImportButton } from "../../../components/CsvImport.jsx";
import { assignmentsImport } from "../../../lib/csvImports.js";

function AssignTeacherModal({ sessions, programs, sections, subjects, teachers, onClose, onCreated }) {
  const { api } = useSession();
  const toast = useToast();
  const activeSession = sessions.find(s => s.status === "active");
  const [form, setForm] = useState({ teacher: "", academicSession: activeSession?._id || "", program: "", section: "", subject: "" });
  const [saving, setSaving] = useState(false);

  const secOptions = sections.filter(s => (s.program?._id || s.program) === form.program);
  const canSubmit = form.teacher && form.program && form.section && form.subject;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const created = await api.addTeacherAssignment(form);
      toast("Teacher assigned successfully", "check");
      onCreated(created);
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  const teacherObj = teachers.find(t => t._id === form.teacher);
  const programObj = programs.find(p => p._id === form.program);
  const sectionObj = secOptions.find(s => s._id === form.section);
  const subjectObj = subjects.find(s => s._id === form.subject);

  return (
    <Modal title="Assign Teacher" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" disabled={!canSubmit || saving} onClick={submit}>Assign Teacher</Btn>
    </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div><label className="field-label">Teacher</label>
          <select className="input" value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })}>
            <option value="">Select teacher…</option>
            {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
        <div><label className="field-label">Academic Session</label>
          <select className="input" value={form.academicSession} onChange={e => setForm({ ...form, academicSession: e.target.value })}>
            {sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div><label className="field-label">Program</label>
          <select className="input" value={form.program} onChange={e => setForm({ ...form, program: e.target.value, section: "" })}>
            <option value="">Select program…</option>
            {programs.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div><label className="field-label">Section</label>
          <select className="input" value={form.section} disabled={!form.program} onChange={e => setForm({ ...form, section: e.target.value })}>
            <option value="">Select section…</option>
            {secOptions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div><label className="field-label">Subject</label>
          <select className="input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
            <option value="">Select subject…</option>
            {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        {canSubmit && (
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>Preview</div>
            <Chain items={[teacherObj?.name, programObj?.name, sectionObj?.name, subjectObj?.name]} />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function TeacherAssignmentsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [data, setData] = useState({ assignments: [], sessions: [], programs: [], sections: [], subjects: [], teachers: [] });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([api.getTeacherAssignments(), api.getAcademicSessions(), api.getPrograms(), api.getSections(), api.getSubjects(), api.getTeachersList()])
      .then(([assignments, sessions, programs, sections, subjects, teachers]) => setData({ assignments, sessions, programs, sections, subjects, teachers }))
      .catch(e => toast(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  const deactivate = async id => {
    if (!confirm("Remove this teacher assignment?")) return;
    try { await api.deactivateTeacherAssignment(id); toast("Assignment removed", "check"); reload(); }
    catch (e) { toast(e.message); }
  };

  return (
    <>
      <SectionHeader eyebrow="Academic" title="Teacher Assignments" action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><CsvImportButton {...assignmentsImport(api)} onDone={reload} /><Btn variant="accent" onClick={() => setModal(true)}><Icon name="plus" size={14} />Assign Teacher</Btn></div>} />
      <div style={{ display: "grid", gap: 12 }}>
        {loading && <Card style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>}
        {!loading && data.assignments.map(ta => (
          <Card key={ta._id} style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={ta.teacher?.name} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{ta.teacher?.name}</div>
                <Chain items={[ta.program?.name, ta.section?.name, ta.subject?.name]} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{ta.academicSession?.name}</span>
              <Badge tone={ta.status === "active" ? "success" : "neutral"}>{ta.status}</Badge>
              {ta.status === "active" && <button className="icon-btn" onClick={() => deactivate(ta._id)} style={{ color: "var(--danger)" }}><Icon name="x" size={13} /></button>}
            </div>
          </Card>
        ))}
        {!loading && data.assignments.length === 0 && <Card style={{ padding: 24 }}><EmptyState icon="users" title="No teacher assignments yet" /></Card>}
      </div>
      {modal && <AssignTeacherModal {...data} onClose={() => setModal(false)} onCreated={() => { setModal(false); reload(); }} />}
    </>
  );
}
