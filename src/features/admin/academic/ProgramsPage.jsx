import { useEffect, useState } from "react";
import { SectionHeader, Card, Btn, Icon, Modal, Avatar, Badge, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { CsvImportButton } from "../../../components/CsvImport.jsx";
import SuggestionsButton from "../../../components/Suggestions.jsx";
import { CLASS_SUGGESTIONS, SECTION_SUGGESTIONS } from "../../../lib/suggestions.js";
import { useSettings } from "../../../context/SettingsContext.jsx";
import { ensureSession, programsImport, sectionsImport } from "../../../lib/csvImports.js";

function CreateProgramModal({ sessions, onClose, onCreated }) {
  const { api } = useSession();
  const toast = useToast();
  const activeSession = sessions.find(s => s.status === "active");
  const [form, setForm] = useState({ name: "", code: "", description: "", academicSession: activeSession?._id || "", requiredCredits: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.academicSession) return toast("Name, code and session are required");
    setSaving(true);
    try {
      const created = await api.addProgram(form);
      toast("Program created", "check");
      onCreated(created);
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Create Program" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" onClick={submit} disabled={saving}>Create Program</Btn>
    </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div><label className="field-label">Program Name</label><input className="input" placeholder="e.g. BS Artificial Intelligence" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
        <div><label className="field-label">Code</label><input className="input" placeholder="e.g. BS-AI" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
        <div><label className="field-label">Academic Session</label>
          <select className="input" value={form.academicSession} onChange={e => setForm(p => ({ ...p, academicSession: e.target.value }))}>
            <option value="">Select session…</option>
            {sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div><label className="field-label">Description</label><input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
        <div><label className="field-label">Credit hours to graduate (optional)</label><input className="input" type="number" min="0" placeholder="e.g. 130 — drives the degree progress bar" value={form.requiredCredits} onChange={e => setForm(p => ({ ...p, requiredCredits: e.target.value }))} /></div>
      </div>
    </Modal>
  );
}

function CreateSectionModal({ program, sessions, onClose, onCreated }) {
  const { api } = useSession();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", code: "", capacity: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) return toast("Section name is required");
    setSaving(true);
    try {
      const created = await api.addSection({ ...form, program: program._id, academicSession: program.academicSession?._id || program.academicSession, capacity: form.capacity || undefined });
      toast("Section created", "check");
      onCreated(created);
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`New Section — ${program.name}`} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" onClick={submit} disabled={saving}>Create Section</Btn>
    </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div><label className="field-label">Section Name</label><input className="input" placeholder="e.g. Section A" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
        <div><label className="field-label">Code (optional)</label><input className="input" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
        <div><label className="field-label">Capacity (optional)</label><input className="input" type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} /></div>
      </div>
    </Modal>
  );
}

export default function ProgramsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [sections, setSections] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openProgram, setOpenProgram] = useState(null);
  const [openSection, setOpenSection] = useState(null);
  const [roster, setRoster] = useState(null);
  const [modal, setModal] = useState(null); // "program" | "section"
  const { settings } = useSettings();
  // One-click classes: uses the active session (creating this year's on a
  // new institute) and, unless unticked, gives each class a section "A" so
  // students can be enrolled straight away.
  const addSuggestedClass = async (data, opts) => {
    const academicSession = await ensureSession(api, settings.instituteType);
    const program = await api.addProgram({ ...data, academicSession });
    if (opts.sectionA) await api.addSection({ name: "A", code: "A", program: program._id, academicSession });
  };
  const addSuggestedSection = program => data => api.addSection({ ...data, code: data.name, program: program._id, academicSession: program.academicSession?._id || program.academicSession });

  // No loading flag on reloads: the page swaps to a spinner while loading,
  // which would close an open import dialog before it shows its summary.
  const reload = () => {
    Promise.all([api.getAcademicSessions(), api.getPrograms(), api.getSections(), api.getTeacherAssignments()])
      .then(([s, p, sec, ta]) => { setSessions(s); setPrograms(p); setSections(sec); setAssignments(ta); })
      .catch(e => toast(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  useEffect(() => {
    if (!openSection) { setRoster(null); return; }
    api.getEnrollments(`section=${openSection._id}`)
      .then(rows => setRoster(rows.filter(r => r.status === "active")))
      .catch(e => toast(e.message));
  }, [openSection, api]);

  if (loading) return <><SectionHeader eyebrow="Academic" title="Classes / Programs" /><Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card></>;

  // ── Section drill-down: roster ──
  if (openSection) {
    const taForSection = assignments.filter(a => a.section?._id === openSection._id);
    const subjIds = [...new Set(taForSection.map(a => a.subject?._id))];
    const teacherIds = [...new Set(taForSection.map(a => a.teacher?._id))];
    return (
      <>
        <Btn variant="ghost" onClick={() => setOpenSection(null)} style={{ marginBottom: 16 }}><Icon name="arrowLeft" size={14} />Back to {openProgram.name}</Btn>
        <SectionHeader eyebrow={openProgram.name} title={openSection.name} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 22 }}>
          <div className="stat-card"><div className="val">{roster?.length ?? "…"}</div><div className="lbl">Students</div></div>
          <div className="stat-card"><div className="val">{subjIds.length}</div><div className="lbl">Subjects</div></div>
          <div className="stat-card"><div className="val">{teacherIds.length}</div><div className="lbl">Teachers</div></div>
        </div>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead><tr><th>Student</th><th>Roll No.</th><th>Email</th></tr></thead>
            <tbody>
              {(roster || []).map(r => (
                <tr key={r._id}>
                  <td style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, color: "var(--ink)" }}><Avatar name={r.student?.name} size={28} />{r.student?.name}</td>
                  <td className="font-mono">{r.student?.rollNo}</td>
                  <td>{r.student?.email}</td>
                </tr>
              ))}
              {roster && roster.length === 0 && <tr><td colSpan={3}><EmptyState title="No students yet" desc="Add students to this section from People → Students." /></td></tr>}
            </tbody>
          </table>
        </Card>
      </>
    );
  }

  // ── Program drill-down: sections ──
  if (openProgram) {
    const secs = sections.filter(s => (s.program?._id || s.program) === openProgram._id);
    return (
      <>
        <Btn variant="ghost" onClick={() => setOpenProgram(null)} style={{ marginBottom: 16 }}><Icon name="arrowLeft" size={14} />All Programs</Btn>
        <SectionHeader eyebrow={openProgram.academicSession?.name} title={openProgram.name} action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><SuggestionsButton title={`Suggested sections — ${openProgram.name}`} catalog={SECTION_SUGGESTIONS} existing={secs.flatMap(s => [s.name, s.code])} submit={addSuggestedSection(openProgram)} onDone={reload} /><CsvImportButton label="Import sections" {...sectionsImport(api)} onDone={reload} /><Btn variant="accent" onClick={() => setModal("section")}><Icon name="plus" size={14} />New Section</Btn></div>} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          {secs.map(sec => {
            const taForSection = assignments.filter(a => a.section?._id === sec._id);
            const subjIds = [...new Set(taForSection.map(a => a.subject?._id))];
            const teacherIds = [...new Set(taForSection.map(a => a.teacher?._id))];
            return (
              <Card key={sec._id} style={{ padding: 20, cursor: "pointer" }} onClick={() => setOpenSection(sec)}>
                <div className="font-display" style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>{sec.name}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.9 }}>{subjIds.length} Subjects<br />{teacherIds.length} Teachers</div>
              </Card>
            );
          })}
          {secs.length === 0 && <Card style={{ padding: 24, gridColumn: "1/-1", textAlign: "center", color: "var(--muted)" }}>No sections yet — create one above.</Card>}
        </div>
        {modal === "section" && <CreateSectionModal program={openProgram} sessions={sessions} onClose={() => setModal(null)} onCreated={() => { setModal(null); reload(); }} />}
      </>
    );
  }

  // ── Root: program grid ──
  return (
    <>
      <SectionHeader eyebrow="Academic" title="Classes / Programs" action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><SuggestionsButton title="Suggested classes & programs" catalog={CLASS_SUGGESTIONS} existing={programs.flatMap(p => [p.name, p.code])} submit={addSuggestedClass} onDone={reload} options={[{ key: "sectionA", label: "Also create section “A” in each new class", default: true }]} note="Tap the classes or programs you run, then add them all at once. Switch level to see school, college or university lists." /><CsvImportButton label="Import classes" {...programsImport(api)} onDone={reload} /><CsvImportButton label="Import sections" {...sectionsImport(api)} onDone={reload} /><Btn variant="accent" onClick={() => setModal("program")}><Icon name="plus" size={14} />Create Program</Btn></div>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
        {programs.map(p => {
          const secs = sections.filter(s => (s.program?._id || s.program) === p._id);
          const taForProgram = assignments.filter(a => (a.program?._id || a.program) === p._id);
          const subjIds = [...new Set(taForProgram.map(a => a.subject?._id))];
          const teacherIds = [...new Set(taForProgram.map(a => a.teacher?._id))];
          return (
            <Card key={p._id} style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="font-display" style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>{p.name}</div>
                {p.status === "inactive" && <Badge tone="neutral">Inactive</Badge>}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 2 }}>
                Sections: <b style={{ color: "var(--ink)" }}>{secs.length}</b><br />
                Subjects: <b style={{ color: "var(--ink)" }}>{subjIds.length}</b><br />
                Teachers: <b style={{ color: "var(--ink)" }}>{teacherIds.length}</b>
              </div>
              <Btn variant="ghost" full style={{ marginTop: 14 }} onClick={() => setOpenProgram(p)}>View Program</Btn>
            </Card>
          );
        })}
        {programs.length === 0 && <Card style={{ padding: 24, gridColumn: "1/-1", textAlign: "center", color: "var(--muted)" }}>No programs yet.</Card>}
      </div>
      {modal === "program" && <CreateProgramModal sessions={sessions} onClose={() => setModal(null)} onCreated={() => { setModal(null); reload(); }} />}
    </>
  );
}
