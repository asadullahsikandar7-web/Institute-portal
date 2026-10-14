import { useEffect, useState } from "react";
import { SectionHeader, Card, Badge, Btn, Icon, EmptyState, Tabs, Modal } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { ADMIN_ROLE_LABEL, ADMIN_ROLE_MODULES } from "../../lib/constants.js";
import { downloadCsv, fmt, fmtTime, humanize } from "../../lib/utils.js";
import { useLoad, useAction } from "./hooks.js";
import { SecuritySettings } from "./AccountPages.jsx";

const Field = ({ label, hint, children, full }) => (
  <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
    <label className="field-label">{label}</label>{children}
    {hint && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{hint}</div>}
  </div>
);
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 };

// ═══════════════════════════ INSTITUTE & POLICY ════════════════════════════
function InstituteSettings() {
  const { api } = useSession();
  const { refresh } = useSettings();
  const toast = useToast();
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.call("GET", "/api/system/settings").then(setS).catch(e => toast(e.message, "alert")); }, [api]);
  if (!s) return <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>;

  const set = (k, v) => setS(p => ({ ...p, [k]: v }));
  const text = (k, label, props = {}) => <Field label={label} hint={props.hint} full={props.full}><input className="input" value={s[k] ?? ""} onChange={e => set(k, e.target.value)} type={props.type || "text"} min={props.min} max={props.max} /></Field>;
  const patchGrade = (i, k, v) => set("gradingScheme", s.gradingScheme.map((g, j) => (j === i ? { ...g, [k]: v } : g)));

  const save = async () => {
    setSaving(true);
    try {
      setS(await api.call("PATCH", "/api/system/settings", {
        ...s,
        minAttendancePercent: Number(s.minAttendancePercent), passingPercent: Number(s.passingPercent), lateFeeValue: Number(s.lateFeeValue),
        libraryFinePerDay: Number(s.libraryFinePerDay), libraryMaxBooks: Number(s.libraryMaxBooks), libraryLoanDays: Number(s.libraryLoanDays),
      }));
      refresh();
      toast("Settings saved", "check");
    } catch (e) { toast(e.message, "alert"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card style={{ padding: 22 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Institute profile</div>
        <div style={grid}>
          {text("instituteName", "Institute Name")}
          <Field label="Institute Type" hint="Sets the wording used across the portals.">
            <select className="input" value={s.instituteType} onChange={e => set("instituteType", e.target.value)}><option value="school">School</option><option value="college">College</option><option value="university">University</option></select>
          </Field>
          {text("tagline", "Tagline")}{text("phone", "Phone")}{text("email", "Email", { type: "email" })}{text("website", "Website")}
          {text("principalName", "Head of Institute", { hint: "Printed as a signatory on certificates." })}{text("registrarName", "Registrar", { hint: "Printed on transcripts and certificates." })}
          {text("currency", "Currency Symbol")}
          {text("address", "Address", { full: true, hint: "Appears in the header of every printed receipt, payslip, transcript and certificate." })}
        </div>
      </Card>

      <Card style={{ padding: 22 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Academic policy</div>
        <div style={{ ...grid, marginBottom: 18 }}>
          {text("minAttendancePercent", "Minimum Attendance %", { type: "number", min: 0, max: 100, hint: "Shown to parents as the required level." })}
          {text("passingPercent", "Passing Marks %", { type: "number", min: 0, max: 100, hint: "Below this a course counts as failed and earns no credit." })}
          <Field label="Online admissions"><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "9px 0", cursor: "pointer" }}><input type="checkbox" checked={!!s.admissionsOpen} onChange={e => set("admissionsOpen", e.target.checked)} />Accept applications from the public Apply page</label></Field>
        </div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Grading scale</div>
        <div style={{ display: "grid", gap: 6, maxWidth: 440 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 34px", gap: 8, fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}><span>Grade</span><span>From %</span><span>Grade points</span><span /></div>
          {s.gradingScheme.map((g, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 34px", gap: 8 }}>
              <input className="input" value={g.grade} onChange={e => patchGrade(i, "grade", e.target.value)} />
              <input className="input" type="number" min="0" max="100" value={g.min} onChange={e => patchGrade(i, "min", e.target.value)} />
              <input className="input" type="number" min="0" step="0.1" value={g.points} onChange={e => patchGrade(i, "points", e.target.value)} />
              <button className="icon-btn" onClick={() => set("gradingScheme", s.gradingScheme.filter((_, j) => j !== i))}><Icon name="x" size={13} /></button>
            </div>
          ))}
          <Btn variant="ghost" style={{ width: "fit-content" }} onClick={() => set("gradingScheme", [...s.gradingScheme, { grade: "", min: 0, points: 0 }])}><Icon name="plus" size={13} />Add grade</Btn>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>A mark gets the highest grade whose “From %” it reaches. Keep one grade starting at 0 as the fail grade. Changes apply the next time a teacher saves a gradebook — results already saved keep their grade.</div>
      </Card>

      <Card style={{ padding: 22 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Finance & library rules</div>
        <div style={grid}>
          <Field label="Late fee" hint="Applied from Fee Collection → Apply Late Fees, once per overdue line.">
            <select className="input" value={s.lateFeeType} onChange={e => set("lateFeeType", e.target.value)}><option value="none">No late fee</option><option value="flat">Flat amount</option><option value="percent">Percent of the fee</option></select>
          </Field>
          {s.lateFeeType !== "none" && text("lateFeeValue", s.lateFeeType === "flat" ? "Late fee amount" : "Late fee %", { type: "number", min: 0 })}
          {text("libraryLoanDays", "Library loan period (days)", { type: "number", min: 1 })}
          {text("libraryMaxBooks", "Max books per student", { type: "number", min: 1 })}
          {text("libraryFinePerDay", "Library fine per overdue day", { type: "number", min: 0 })}
        </div>
      </Card>
      <div><Btn variant="accent" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Settings"}</Btn></div>
    </div>
  );
}

// ═══════════════════════════ ADMIN USERS & ROLES ═══════════════════════════
function AdminUsers() {
  const { api, session } = useSession();
  const [run, busy] = useAction();
  const [admins, reload, loading] = useLoad(session.isSuperAdmin ? "/api/admin/admins" : null, []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", adminRole: "admin", isSuperAdmin: false });

  if (!session.isSuperAdmin) return <Card style={{ padding: 24 }}><EmptyState icon="shield" title="Super admin only" desc="Only a super admin can create staff accounts and assign their roles." /></Card>;
  const create = () => run(() => api.call("POST", "/api/admin/admins", form), "Account created").then(r => { if (r) { setAdding(false); setForm({ email: "", password: "", name: "", adminRole: "admin", isSuperAdmin: false }); reload(); } });
  const setRole = (a, adminRole) => run(() => api.call("PUT", `/api/admin/admins/${a._id}`, { adminRole }), "Role updated").then(reload);
  const remove = a => window.confirm(`Delete the account ${a.email}? They will no longer be able to sign in.`) && run(() => api.call("DELETE", `/api/admin/admins/${a._id}`), "Account deleted").then(reload);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card style={{ padding: 0, overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Staff accounts</div>
          <Btn variant="accent" onClick={() => setAdding(true)}><Icon name="plus" size={13} />Add Account</Btn>
        </div>
        <table className="table">
          <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Can access</th><th /></tr></thead>
          <tbody>{(admins || []).map(a => {
            const mods = a.isSuperAdmin ? "*" : ADMIN_ROLE_MODULES[a.adminRole || "admin"];
            return (
              <tr key={a._id}>
                <td style={{ fontWeight: 600, color: "var(--ink)" }}>{a.email} {a.isSuperAdmin && <Badge tone="accent">Super admin</Badge>}</td><td>{a.name || "—"}</td>
                <td><select className="input" style={{ width: "auto" }} disabled={busy || a.isSuperAdmin} value={a.adminRole || "admin"} onChange={e => setRole(a, e.target.value)}>{Object.entries(ADMIN_ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td>{mods === "*" ? "Everything" : mods.map(humanize).join(", ")}</td>
                <td style={{ textAlign: "right" }}>{a.email !== session.email && <Btn variant="danger" style={{ padding: "5px 10px", fontSize: 12 }} disabled={busy} onClick={() => remove(a)}>Delete</Btn>}</td>
              </tr>
            );
          })}</tbody>
        </table>
        {loading && <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}
      </Card>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>A role limits which modules an account can change. Every staff account can still look up students and classes, since most jobs need to. A role change takes effect the next time that person signs in.</div>
      {adding && (
        <Modal title="Add Staff Account" onClose={() => setAdding(false)} footer={<><Btn variant="ghost" onClick={() => setAdding(false)}>Cancel</Btn><Btn variant="accent" onClick={create} disabled={busy || !form.email || form.password.length < 8}>Create</Btn></>}>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Email (login)"><input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Field>
            <Field label="Name"><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></Field>
            <Field label="Password" hint="At least 8 characters."><input className="input" type="password" autoComplete="new-password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></Field>
            <Field label="Role"><select className="input" value={form.adminRole} onChange={e => setForm(p => ({ ...p, adminRole: e.target.value }))}>{Object.entries(ADMIN_ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════ AUDIT LOG ═════════════════════════════════════
function AuditLog() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [failed, setFailed] = useState(false);
  const params = new URLSearchParams({ limit: "300", ...(q.trim() && { q: q.trim() }), ...(role && { actorRole: role }), ...(failed && { failed: "1" }) }).toString();
  const [rows, , loading] = useLoad(`/api/system/audit?${params}`, []);
  const list = rows || [];
  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Filter by path or user…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input" style={{ width: "auto" }} value={role} onChange={e => setRole(e.target.value)}><option value="">All roles</option>{["admin", "teacher", "student", "parent", "anonymous"].map(r => <option key={r} value={r}>{humanize(r)}</option>)}</select>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={failed} onChange={e => setFailed(e.target.checked)} />Failed / denied only</label>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" disabled={!list.length} onClick={() => downloadCsv("audit-log.csv", ["When", "Role", "User", "Method", "Path", "Status", "IP", "Fields changed"], list.map(r => [r.at, r.actorRole, r.actorLabel || r.actorId, r.method, r.path, r.status, r.ip, r.fields.join(" ")]))}><Icon name="file" size={13} />Export CSV</Btn>
      </div>
      <Card style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Fields sent</th><th>Result</th><th>IP</th></tr></thead>
          <tbody>{list.map(r => (
            <tr key={r._id}>
              <td style={{ whiteSpace: "nowrap" }}>{fmt(r.at)} {fmtTime(r.at)}</td>
              <td>{r.actorLabel || (r.actorId ? `…${r.actorId.slice(-6)}` : "—")} <span style={{ color: "var(--muted)" }}>({r.actorRole})</span></td>
              <td className="font-mono" style={{ fontSize: 12 }}><strong>{r.method}</strong> {r.path}</td>
              <td style={{ fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.fields.join(", ")}>{r.fields.join(", ") || "—"}</td>
              <td><Badge tone={r.status < 400 ? "success" : r.status === 401 || r.status === 403 || r.status === 429 ? "danger" : "warn"}>{r.status}</Badge></td><td>{r.ip}</td>
            </tr>
          ))}</tbody>
        </table>
        {loading && <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}
        {!loading && list.length === 0 && <EmptyState icon="history" title="No matching activity" />}
      </Card>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>Every change made through the system is recorded with who made it and which fields they sent. Values (passwords, marks, amounts) are never stored in the log.</div>
    </>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState("institute");
  return (
    <>
      <SectionHeader eyebrow="System" title="Settings" />
      <Tabs items={[{ key: "institute", label: "Institute & Policies" }, { key: "users", label: "Staff Accounts & Roles" }, { key: "security", label: "My Security" }, { key: "audit", label: "Audit Log" }]} active={tab} onChange={setTab} style={{ marginBottom: 18 }} />
      {tab === "institute" && <InstituteSettings />}
      {tab === "users" && <AdminUsers />}
      {tab === "security" && <SecuritySettings />}
      {tab === "audit" && <AuditLog />}
    </>
  );
}
