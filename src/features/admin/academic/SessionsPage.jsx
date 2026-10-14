import { useEffect, useState } from "react";
import { SectionHeader, Card, Badge, Btn, Icon, Modal } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { CsvImportButton } from "../../../components/CsvImport.jsx";
import SuggestionsButton from "../../../components/Suggestions.jsx";
import { sessionSuggestions } from "../../../lib/suggestions.js";
import { sessionsImport } from "../../../lib/csvImports.js";
import { fmt } from "../../../lib/utils.js";

const STATUS_TONE = { active: "success", inactive: "neutral", archived: "neutral" };

function CreateSessionModal({ onClose, onCreated }) {
  const { api } = useSession();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) return toast("All fields are required");
    setSaving(true);
    try {
      const created = await api.addAcademicSession(form);
      toast("Session created", "check");
      onCreated(created);
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Create Session" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" onClick={submit} disabled={saving}>Create Session</Btn>
    </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div><label className="field-label">Session Name</label><input className="input" placeholder="e.g. 2026-27" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
        <div><label className="field-label">Start Date</label><input className="input" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} /></div>
        <div><label className="field-label">End Date</label><input className="input" type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} /></div>
      </div>
    </Modal>
  );
}

export default function SessionsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [programCount, setProgramCount] = useState(0);
  const [sectionCounts, setSectionCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const reload = () => {
    setLoading(true);
    Promise.all([api.getAcademicSessions(), api.getPrograms(), api.getSections()])
      .then(([s, programs, sections]) => {
        setSessions(s);
        setProgramCount(programs.length);
        const counts = {};
        sections.forEach(sec => { const id = sec.academicSession?._id || sec.academicSession; counts[id] = (counts[id] || 0) + 1; });
        setSectionCounts(counts);
      })
      .catch(e => toast(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  const activate = async id => {
    setBusyId(id);
    try { await api.activateAcademicSession(id); toast("Session activated", "check"); reload(); }
    catch (e) { toast(e.message); }
    finally { setBusyId(null); }
  };
  const archive = async id => {
    if (!confirm("Archive this session?")) return;
    setBusyId(id);
    try { await api.archiveAcademicSession(id); toast("Session archived", "check"); reload(); }
    catch (e) { toast(e.message); }
    finally { setBusyId(null); }
  };

  return (
    <>
      <SectionHeader eyebrow="Academic" title="Academic Sessions" action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><SuggestionsButton title="Suggested sessions" catalog={sessionSuggestions()} existing={sessions.map(s => s.name)} submit={d => api.addAcademicSession(d)} onDone={reload} note="Pick the academic years or semesters to create. Activate one afterwards to make it current." /><CsvImportButton {...sessionsImport(api)} onDone={reload} /><Btn variant="accent" onClick={() => setModal(true)}><Icon name="plus" size={14} />Create Session</Btn></div>} />
      {loading ? (
        <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          {sessions.map(s => (
            <Card key={s._id} style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div className="font-display" style={{ fontSize: 19, fontWeight: 600 }}>{s.name}</div>
                <Badge tone={STATUS_TONE[s.status] || "neutral"}>{s.status}</Badge>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>{fmt(s.startDate)} – {fmt(s.endDate)}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>{programCount} programs · {sectionCounts[s._id] || 0} sections</div>
              <div style={{ display: "flex", gap: 8 }}>
                {s.status !== "active" && <Btn variant="accent" onClick={() => activate(s._id)} disabled={busyId === s._id}>Activate</Btn>}
                {s.status !== "archived" && <Btn variant="ghost" onClick={() => archive(s._id)} disabled={busyId === s._id}>Archive</Btn>}
              </div>
            </Card>
          ))}
          {sessions.length === 0 && <Card style={{ padding: 24, gridColumn: "1/-1", textAlign: "center", color: "var(--muted)" }}>No sessions yet.</Card>}
        </div>
      )}
      {modal && <CreateSessionModal onClose={() => setModal(false)} onCreated={() => { setModal(false); reload(); }} />}
    </>
  );
}
