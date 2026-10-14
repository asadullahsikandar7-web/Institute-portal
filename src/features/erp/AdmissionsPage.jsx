import { useState } from "react";
import ResourcePage from "../../components/resource/ResourcePage.jsx";
import { SectionHeader, StatCard, Modal, Btn, Icon, Badge } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { fmt, statusMeta } from "../../lib/utils.js";
import { useLoad, useAction } from "./hooks.js";

// Pipeline order. "enrolled" is reached only through the Enroll action,
// which creates the student account — never by picking it from this list.
const STAGES = ["applied", "under_review", "test_scheduled", "interview", "offered", "accepted", "rejected", "withdrawn"];
const FUNNEL = ["applied", "under_review", "test_scheduled", "interview", "offered", "accepted", "enrolled"];

function EnrollModal({ application, onClose, onDone }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [sections] = useLoad("/api/sections", []);
  const [form, setForm] = useState({ rollNo: "", section: "" });
  const [result, setResult] = useState(null);
  const programId = application.program?._id;
  const eligible = (sections || []).filter(s => s.status === "active" && (!programId || (s.program?._id || s.program) === programId));

  const submit = async () => {
    const out = await run(() => api.call("POST", `/api/admissions/${application._id}/enroll`, { rollNo: form.rollNo, section: form.section || undefined }));
    if (out) setResult(out);
  };

  if (result) {
    return (
      <Modal title="Student Enrolled" onClose={onDone} footer={<Btn variant="accent" onClick={onDone}>Done</Btn>}>
        <div style={{ fontSize: 13.5, marginBottom: 14 }}>{result.student.name} now has a student account. Hand over these login details — the password is shown only this once.</div>
        <div className="kv">
          <div><div className="k">Roll Number (login)</div><div className="v font-mono">{result.student.rollNo}</div></div>
          <div><div className="k">One-time Password</div><div className="v font-mono">{result.tempPassword}</div></div>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>The student can change it from their profile menu after signing in.</div>
      </Modal>
    );
  }
  return (
    <Modal title={`Enroll ${application.name}`} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" onClick={submit} disabled={busy || !form.rollNo.trim()}>{busy ? "Enrolling…" : "Create Student Account"}</Btn>
    </>}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Creates the student account{application.guardianName ? ", a parent record for " + application.guardianName : ""} and, if you pick a section, the enrolment.</div>
        <div><label className="field-label">Roll Number *</label><input className="input" value={form.rollNo} onChange={e => setForm(p => ({ ...p, rollNo: e.target.value }))} placeholder="e.g. AI-2627-014" /></div>
        <div><label className="field-label">Section</label>
          <select className="input" value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))}>
            <option value="">Decide later</option>
            {eligible.map(s => <option key={s._id} value={s._id}>{s.program?.name ? `${s.program.name} — ` : ""}{s.name}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

export default function AdmissionsPage() {
  const { api } = useSession();
  const [run] = useAction();
  const [stats, reloadStats, loading] = useLoad("/api/admissions/stats");
  const [enrolling, setEnrolling] = useState(null);
  const [tick, setTick] = useState(0);
  const refresh = () => { reloadStats(); setTick(t => t + 1); };
  const by = stats?.byStage || {};

  const setStage = (row, stage) => run(() => api.call("PATCH", `/api/admissions/${row._id}/stage`, { stage }), `Moved to ${statusMeta(stage).label}`).then(refresh);

  return (
    <>
      <SectionHeader eyebrow="Admissions" title="Applications" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Total Applications" value={loading ? "…" : stats?.total} icon="upload" />
        {FUNNEL.slice(1).map(s => <StatCard key={s} label={statusMeta(s).label} value={loading ? "…" : by[s] ?? 0} />)}
        <StatCard label="Conversion" value={loading ? "…" : `${stats?.conversionRate ?? 0}%`} icon="trend" />
      </div>
      <ResourcePage embedded title="Applications" base="/api/admissions" addLabel="New Application" reloadKey={tick} exportName="admissions"
        emptyDesc="Applications arrive from the public “Apply” page or can be entered here for walk-ins."
        columns={[
          { key: "applicationNo", label: "App No." }, { key: "name", label: "Applicant" }, { key: "program.name", label: "Program" },
          { key: "previousPercentage", label: "Prev %" }, { key: "testScore", label: "Test" }, { key: "interviewScore", label: "Interview" },
          { key: "meritScore", label: "Merit", render: r => r.meritScore != null ? <strong>{r.meritScore}</strong> : "—", csv: r => r.meritScore },
          { key: "createdAt", label: "Applied", type: "date" },
          { key: "stage", label: "Stage", render: r => { const m = statusMeta(r.stage); return <Badge tone={m.tone}>{m.label}</Badge>; }, csv: r => r.stage },
        ]}
        filters={[
          { name: "stage", label: "Stage", options: [...STAGES, "enrolled"].map(s => ({ value: s, label: statusMeta(s).label })) },
          { name: "program", label: "Program", source: { path: "/api/programs", label: p => p.name } },
        ]}
        fields={[
          { name: "name", label: "Applicant Name", required: true }, { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone" },
          { name: "dob", label: "Date of Birth", type: "date" }, { name: "gender", label: "Gender", type: "select", options: ["male", "female", "other"] },
          { name: "program", label: "Program Applied For", type: "select", source: { path: "/api/programs", label: p => p.name } },
          { name: "academicSession", label: "Session", type: "select", source: { path: "/api/academic-sessions", label: s => s.name } },
          { name: "source", label: "Source", type: "select", options: ["online", "walk_in", "referral", "agent", "other"], default: "walk_in" },
          { name: "guardianName", label: "Guardian Name" }, { name: "guardianPhone", label: "Guardian Phone" }, { name: "guardianEmail", label: "Guardian Email", type: "email" },
          { name: "city", label: "City" }, { name: "previousInstitute", label: "Previous Institute" },
          { name: "previousPercentage", label: "Previous Result %", type: "number", max: 100 }, { name: "testScore", label: "Entry Test %", type: "number", max: 100 },
          { name: "interviewScore", label: "Interview %", type: "number", max: 100, hint: "Merit = 50% previous result, 35% test, 15% interview (of whichever are entered)." },
          { name: "address", label: "Address", type: "textarea", rows: 2 }, { name: "notes", label: "Office Notes", type: "textarea", rows: 2 },
        ]}
        rowActions={row => {
          if (row.stage === "enrolled") return [];
          const next = FUNNEL[FUNNEL.indexOf(row.stage) + 1];
          return [
            next && next !== "enrolled" && { label: statusMeta(next).label, icon: "chevronRight", onClick: () => setStage(row, next) },
            ["offered", "accepted"].includes(row.stage) && { label: "Enroll", icon: "check", variant: "accent", onClick: () => setEnrolling(row) },
            !["rejected", "withdrawn"].includes(row.stage) && { label: "Reject", icon: "x", variant: "danger", onClick: () => window.confirm(`Reject ${row.name}'s application?`) && setStage(row, "rejected") },
            ["rejected", "withdrawn"].includes(row.stage) && { label: "Reopen", icon: "history", onClick: () => setStage(row, "under_review") },
          ];
        }} />
      {enrolling && <EnrollModal application={enrolling} onClose={() => setEnrolling(null)} onDone={() => { setEnrolling(null); refresh(); }} />}
    </>
  );
}

// ── Public online application (no login) ───────────────────────────────────
export function ApplyPage() {
  const { anonApi } = useSession();
  const [run, busy] = useAction();
  const [form, setForm] = useState({ name: "", email: "", phone: "", dob: "", gender: "", guardianName: "", guardianPhone: "", guardianEmail: "", city: "", previousInstitute: "", previousPercentage: "", address: "" });
  const [done, setDone] = useState(null);
  const [trackNo, setTrackNo] = useState("");
  const [tracked, setTracked] = useState(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const input = (k, label, type = "text", extra = {}) => (
    <div><label className="field-label">{label}</label><input className="input" type={type} value={form[k]} onChange={e => set(k, e.target.value)} {...extra} /></div>
  );

  const submit = async e => {
    e.preventDefault();
    const out = await run(() => anonApi.call("POST", "/api/admissions/apply", { ...form, previousPercentage: form.previousPercentage === "" ? undefined : Number(form.previousPercentage), dob: form.dob || undefined }));
    if (out) setDone(out);
  };
  const track = async e => {
    e.preventDefault();
    const out = await run(() => anonApi.call("GET", `/api/admissions/track/${encodeURIComponent(trackNo.trim())}`));
    setTracked(out || null);
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 18px 80px" }}>
      <a href="/login" style={{ fontSize: 13, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18 }}><Icon name="arrowLeft" size={13} />Back to sign in</a>
      <SectionHeader eyebrow="Admissions" title="Apply for Admission" />
      {done ? (
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Application received</div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>Keep this number — you'll need it to check your status.</div>
          <div className="font-display" style={{ fontSize: 30, fontWeight: 600, letterSpacing: 1 }}>{done.applicationNo}</div>
        </div>
      ) : (
        <form className="card" style={{ padding: 22 }} onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
            {input("name", "Full Name *", "text", { required: true, minLength: 2 })}
            {input("email", "Email *", "email", { required: true })}
            {input("phone", "Phone")}
            {input("dob", "Date of Birth", "date")}
            <div><label className="field-label">Gender</label>
              <select className="input" value={form.gender} onChange={e => set("gender", e.target.value)}><option value="">Select…</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
            {input("city", "City")}
            {input("guardianName", "Parent / Guardian Name")}
            {input("guardianPhone", "Guardian Phone")}
            {input("guardianEmail", "Guardian Email", "email")}
            {input("previousInstitute", "Previous School / College")}
            {input("previousPercentage", "Previous Result %", "number", { min: 0, max: 100, step: "0.01" })}
            <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Address</label><textarea className="input" rows={2} value={form.address} onChange={e => set("address", e.target.value)} /></div>
          </div>
          <Btn type="submit" variant="accent" disabled={busy} style={{ marginTop: 16 }}>{busy ? "Submitting…" : "Submit Application"}</Btn>
        </form>
      )}

      <form className="card" style={{ padding: 22, marginTop: 20 }} onSubmit={track}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Already applied? Check your status</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" style={{ flex: "1 1 200px" }} placeholder="Application number, e.g. APP-00012" value={trackNo} onChange={e => setTrackNo(e.target.value)} />
          <Btn type="submit" variant="ghost" disabled={busy || !trackNo.trim()}>Check Status</Btn>
        </div>
        {tracked && (
          <div style={{ marginTop: 14, fontSize: 13.5 }}>
            {tracked.name} — <Badge tone={statusMeta(tracked.stage).tone}>{statusMeta(tracked.stage).label}</Badge>
            <span style={{ color: "var(--muted)", marginLeft: 8 }}>updated {fmt(tracked.updatedAt)}</span>
          </div>
        )}
      </form>
    </div>
  );
}
