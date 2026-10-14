import { useEffect, useState } from "react";
import { SectionHeader, Card, Avatar, Btn, Icon, Modal, Chain, Badge, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { CsvImportButton } from "../../../components/CsvImport.jsx";
import { teachersImport } from "../../../lib/csvImports.js";

function AddTeacherModal({ onClose, onCreated }) {
  const { api } = useSession();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) return toast("Name, email, and a password (6+ chars) are required");
    setSaving(true);
    try {
      const created = await api.addTeacherAccount(form);
      toast("Teacher account created", "check");
      onCreated(created);
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Add Teacher" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" onClick={submit} disabled={saving}>Create Account</Btn>
    </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div><label className="field-label">Full Name</label><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
        <div><label className="field-label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
        <div><label className="field-label">Phone</label><input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
        <div><label className="field-label">Password</label><input className="input" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
      </div>
    </Modal>
  );
}

export default function TeachersPage() {
  const { api } = useSession();
  const toast = useToast();
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([api.getTeachersList(), api.getTeacherAssignments()])
      .then(([t, ta]) => { setTeachers(t); setAssignments(ta); })
      .catch(e => toast(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  const toggleActive = async t => {
    try { await api.editTeacherAccount(t._id, { isActive: !t.isActive }); toast(t.isActive ? "Teacher deactivated" : "Teacher reactivated", "check"); reload(); }
    catch (e) { toast(e.message); }
  };

  return (
    <>
      <SectionHeader eyebrow="People" title="Teachers" action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><CsvImportButton {...teachersImport(api)} onDone={reload} /><Btn variant="accent" onClick={() => setModal(true)}><Icon name="plus" size={14} />Add Teacher</Btn></div>} />
      {loading ? (
        <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          {teachers.map(t => {
            const tas = assignments.filter(a => (a.teacher?._id || a.teacher) === t._id);
            return (
              <Card key={t._id} style={{ padding: 18, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <Avatar name={t.name} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.email}>{t.email}</div>
                  </div>
                  <Badge tone={t.isActive ? "success" : "neutral"}>{t.isActive ? "Active" : "Inactive"}</Badge>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>Assignments ({tas.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {tas.map(ta => <div key={ta._id} style={{ fontSize: 12 }}><Chain items={[ta.program?.name, ta.section?.name, ta.subject?.name]} /></div>)}
                  {tas.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>No classes assigned yet.</div>}
                </div>
                <Btn variant="ghost" full onClick={() => toggleActive(t)}>{t.isActive ? "Deactivate" : "Reactivate"}</Btn>
              </Card>
            );
          })}
          {teachers.length === 0 && <Card style={{ padding: 24, gridColumn: "1/-1" }}><EmptyState icon="grad" title="No teachers yet" /></Card>}
        </div>
      )}
      {modal && <AddTeacherModal onClose={() => setModal(false)} onCreated={() => { setModal(false); reload(); }} />}
    </>
  );
}
