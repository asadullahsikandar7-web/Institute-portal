import { useState } from "react";
import { Modal, Btn, Icon, Chain, Avatar, Card } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";

const STEPS = ["Student Info", "Academic Info", "Parent Info", "Review"];

function genPassword() {
  return Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10);
}

export default function AddStudentWizard({ sessions, programs, sections, onClose, onCreated }) {
  const { api } = useSession();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const activeSession = sessions.find(s => s.status === "active");
  const [f, setF] = useState({
    name: "", rollNo: "", email: "", password: genPassword(), registrationNo: "",
    academicSession: activeSession?._id || "", program: "", section: "",
    parentName: "", parentPhone: "", parentEmail: "",
  });
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);

  const secOptions = sections.filter(s => (s.program?._id || s.program) === f.program);

  const err = {
    name: !f.name && "Full name is required",
    rollNo: !f.rollNo && "Roll number is required",
    password: f.password.length < 6 && "Password must be at least 6 characters",
    program: !f.program && "Program is required",
    section: !f.section && "Section is required",
    parentName: !f.parentName && "Parent name is required",
    parentPhone: !f.parentPhone && "Parent phone is required",
    parentEmail: !f.parentEmail && "Parent email is required",
  };
  const stepValid = {
    1: !err.name && !err.rollNo && !err.password,
    2: !err.program && !err.section,
    3: !err.parentName && !err.parentPhone && !err.parentEmail,
    4: true,
  };

  const Field = (key, label, placeholder, type = "text") => (
    <div>
      <label className="field-label">{label}</label>
      <input
        className={"input" + (touched[key] && err[key] ? " err" : "")}
        type={type}
        placeholder={placeholder}
        value={f[key]}
        onChange={e => setF({ ...f, [key]: e.target.value })}
        onBlur={() => setTouched({ ...touched, [key]: true })}
      />
      {touched[key] && err[key] && <div style={{ color: "var(--danger)", fontSize: 11.5, marginTop: 4 }}>{err[key]}</div>}
    </div>
  );

  const create = async () => {
    setSaving(true);
    try {
      const parent = await api.addParent({ name: f.parentName, phone: f.parentPhone, email: f.parentEmail });
      const student = await api.addStudent({
        name: f.name, rollNo: f.rollNo, email: f.email || undefined, password: f.password,
        registrationNo: f.registrationNo || undefined,
        parentName: f.parentName, parentEmail: f.parentEmail, parentId: parent._id,
      });
      await api.addEnrollment({ student: student._id, academicSession: f.academicSession, program: f.program, section: f.section });
      toast("Student created successfully", "check");
      onCreated();
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  const programObj = programs.find(p => p._id === f.program);
  const sectionObj = secOptions.find(s => s._id === f.section);
  const sessionObj = sessions.find(s => s._id === f.academicSession);

  return (
    <Modal title="Add Student" wide onClose={onClose} footer={<>
      {step > 1 && <Btn variant="ghost" onClick={() => setStep(step - 1)}>Back</Btn>}
      <div style={{ flex: 1 }} />
      {step < 4 && <Btn variant="accent" disabled={!stepValid[step]} onClick={() => setStep(step + 1)}>Continue</Btn>}
      {step === 4 && <Btn variant="accent" onClick={create} disabled={saving}>Create Student</Btn>}
    </>}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              width: 26, height: 26, borderRadius: 99, margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
              background: step > i + 1 ? "var(--success-soft)" : step === i + 1 ? "var(--accent)" : "var(--surface-alt)",
              color: step > i + 1 ? "var(--success)" : step === i + 1 ? "#1a1204" : "var(--muted)",
            }}>
              {step > i + 1 ? <Icon name="check" size={13} /> : i + 1}
            </div>
            <div style={{ fontSize: 10.5, color: step === i + 1 ? "var(--ink)" : "var(--muted)", fontWeight: 600 }}>{s}</div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={{ display: "grid", gap: 14 }}>
          {Field("name", "Full Name", "e.g. Asad Ullah")}
          {Field("rollNo", "Roll Number", "e.g. AI-2627-020")}
          {Field("email", "Email (optional)", "e.g. asad@example.com")}
          {Field("registrationNo", "Registration Number (optional)", "e.g. FA25-BAI-020")}
          <div><label className="field-label">Initial Password</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className={"input" + (touched.password && err.password ? " err" : "")} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} onBlur={() => setTouched({ ...touched, password: true })} />
              <Btn variant="ghost" onClick={() => setF({ ...f, password: genPassword() })}>Regenerate</Btn>
            </div>
            {touched.password && err.password && <div style={{ color: "var(--danger)", fontSize: 11.5, marginTop: 4 }}>{err.password}</div>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gap: 14 }}>
          <div><label className="field-label">Academic Session</label>
            <select className="input" value={f.academicSession} onChange={e => setF({ ...f, academicSession: e.target.value })}>
              {sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Program</label>
            <select className={"input" + (touched.program && err.program ? " err" : "")} value={f.program} onBlur={() => setTouched({ ...touched, program: true })} onChange={e => setF({ ...f, program: e.target.value, section: "" })}>
              <option value="">Select program…</option>
              {programs.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Section</label>
            <select className={"input" + (touched.section && err.section ? " err" : "")} value={f.section} disabled={!f.program} onBlur={() => setTouched({ ...touched, section: true })} onChange={e => setF({ ...f, section: e.target.value })}>
              <option value="">Select section…</option>
              {secOptions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ fontSize: 12.5, background: "var(--info-soft)", color: "var(--info)", padding: "9px 12px", borderRadius: 9 }}>
            Parent / Guardian information is required for all students.
          </div>
          {Field("parentName", "Parent Name *", "e.g. Muhammad Sikandar")}
          {Field("parentPhone", "Parent Phone *", "e.g. 0300-1234567")}
          {Field("parentEmail", "Parent Email *", "e.g. parent@example.com", "email")}
        </div>
      )}

      {step === 4 && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={f.name || "New Student"} size={46} />
            <div><div style={{ fontWeight: 700, fontSize: 16 }}>{f.name}</div><div className="font-mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>{f.rollNo}</div></div>
          </div>
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase" }}>Academic</div>
            <Chain items={[programObj?.name || "—", sectionObj?.name || "—", sessionObj?.name || "—"]} />
          </Card>
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase" }}>Parent / Guardian</div>
            <div style={{ fontSize: 13.5 }}>{f.parentName}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{f.parentPhone} · {f.parentEmail}</div>
          </Card>
        </div>
      )}
    </Modal>
  );
}
