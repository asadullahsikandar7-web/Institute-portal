import { useEffect, useMemo, useState } from "react";
import { SectionHeader, StatCard, Card, Badge, Btn, Icon, EmptyState, Modal } from "../../components/ui/index.js";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { makeApi } from "../../lib/api.js";
import { downloadCsv, fmt, humanize } from "../../lib/utils.js";

// Platform owner console (/platform): every institute on the platform, its
// plan, modules, limits and usage. Separate from the institute portals —
// the owner signs in here with a platform account, and the server only
// accepts that account on /api/platform.

const OWNER_KEY = "acadexa_owner";
const MODULE_LABELS = { admissions: "Admissions", exams: "Exams & results", finance: "Finance", payroll: "Payroll", hr: "HR", library: "Library", campus: "Transport, hostel & assets", engage: "Calendar, helpdesk, records, meetings", lifecycle: "Student success & 360", ai: "AI assistant" };
const PLAN_PRESETS = {
  trial: { modules: ["admissions", "exams", "finance", "engage"], limits: { maxStudents: 100, maxTeachers: 10 } },
  basic: { modules: ["admissions", "exams", "finance", "engage"], limits: { maxStudents: 500, maxTeachers: 40 } },
  standard: { modules: ["admissions", "exams", "finance", "payroll", "hr", "library", "engage", "lifecycle"], limits: { maxStudents: 2000, maxTeachers: 150 } },
  premium: { modules: Object.keys(MODULE_LABELS), limits: { maxStudents: null, maxTeachers: null } },
};
const EMPTY = { name: "", code: "", type: "school", plan: "standard", ...PLAN_PRESETS.standard, contactName: "", contactEmail: "", contactPhone: "", subscriptionEnds: "", notes: "", adminEmail: "", adminPassword: "" };

function readOwner() { try { return JSON.parse(localStorage.getItem(OWNER_KEY) || "null"); } catch { return null; } }

function OwnerLogin({ onIn }) {
  const toast = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true);
    try { const r = await makeApi(null).call("POST", "/api/platform/login", form); localStorage.setItem(OWNER_KEY, JSON.stringify(r)); onIn(r); }
    catch (err) { toast(err.message, "alert"); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ maxWidth: 400, margin: "0 auto", padding: "90px 18px" }}>
      <SectionHeader eyebrow="ACADEXA Platform" title="Owner sign-in" />
      <form className="card" style={{ padding: 22, display: "grid", gap: 12 }} onSubmit={submit}>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>This console is for the platform operator, to create and manage institutes. Institute staff, students and parents sign in on the <a href="/login" style={{ color: "var(--accent)" }}>normal login page</a>.</div>
        <div><label className="field-label">Email</label><input className="input" type="email" autoFocus value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
        <div><label className="field-label">Password</label><input className="input" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
        <Btn type="submit" variant="accent" disabled={busy || !form.email || !form.password}>{busy ? "Signing in…" : "Sign in"}</Btn>
      </form>
    </div>
  );
}

function TenantModal({ tenant, api, onClose, onSaved }) {
  const toast = useToast();
  const creating = !tenant;
  const [form, setForm] = useState(creating ? EMPTY : {
    ...EMPTY, ...tenant, subscriptionEnds: tenant.subscriptionEnds ? tenant.subscriptionEnds.slice(0, 10) : "",
    limits: { maxStudents: tenant.limits?.maxStudents ?? "", maxTeachers: tenant.limits?.maxTeachers ?? "" },
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setPlan = plan => setForm(p => ({ ...p, plan, modules: [...PLAN_PRESETS[plan].modules], limits: { maxStudents: PLAN_PRESETS[plan].limits.maxStudents ?? "", maxTeachers: PLAN_PRESETS[plan].limits.maxTeachers ?? "" } }));
  const toggle = m => set("modules", form.modules.includes(m) ? form.modules.filter(x => x !== m) : [...form.modules, m]);
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...form, limits: { maxStudents: form.limits.maxStudents || null, maxTeachers: form.limits.maxTeachers || null } };
      if (creating) await api.call("POST", "/api/platform/tenants", body);
      else await api.call("PATCH", `/api/platform/tenants/${tenant._id}`, body);
      toast(creating ? `${form.name} is live — share the login details with them` : "Institute updated", "check");
      onSaved();
    } catch (e) { toast(e.message, "alert"); }
    finally { setBusy(false); }
  };
  const input = (k, label, extra = {}) => <div style={{ gridColumn: extra.full ? "1 / -1" : undefined }}><label className="field-label">{label}</label><input className="input" value={form[k] ?? ""} onChange={e => set(k, extra.upper ? e.target.value.toUpperCase() : e.target.value)} type={extra.type || "text"} placeholder={extra.placeholder} disabled={extra.disabled} /></div>;
  return (
    <Modal wide title={creating ? "New institute" : `Manage ${tenant.name}`} onClose={onClose} footer={<>
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" onClick={save} disabled={busy || !form.name || !form.code || (creating && (!form.adminEmail || form.adminPassword.length < 8))}>{busy ? "Saving…" : creating ? "Create institute" : "Save"}</Btn>
    </>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        {input("name", "Institute name", { placeholder: "e.g. Riverside Public School" })}
        {input("code", "Institute code (login + subdomain)", { upper: true, placeholder: "e.g. RIVERSIDE", disabled: !creating })}
        <div><label className="field-label">Type</label><select className="input" value={form.type} onChange={e => set("type", e.target.value)}><option value="school">School</option><option value="college">College</option><option value="university">University</option></select></div>
        <div><label className="field-label">Plan</label><select className="input" value={form.plan} onChange={e => setPlan(e.target.value)}>{Object.keys(PLAN_PRESETS).map(p => <option key={p} value={p}>{humanize(p)}</option>)}</select></div>
        <div><label className="field-label">Max students (empty = unlimited)</label><input className="input" type="number" min="1" value={form.limits.maxStudents} onChange={e => set("limits", { ...form.limits, maxStudents: e.target.value })} /></div>
        <div><label className="field-label">Max teachers (empty = unlimited)</label><input className="input" type="number" min="1" value={form.limits.maxTeachers} onChange={e => set("limits", { ...form.limits, maxTeachers: e.target.value })} /></div>
        {input("subscriptionEnds", "Subscription ends", { type: "date" })}
        {!creating && <div><label className="field-label">Status</label><select className="input" value={form.status} onChange={e => set("status", e.target.value)}><option value="active">Active</option><option value="suspended">Suspended — nobody can sign in</option></select></div>}
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Modules included</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(MODULE_LABELS).map(([m, l]) => <button key={m} type="button" onClick={() => toggle(m)} className={"badge " + (form.modules.includes(m) ? "accent" : "neutral")} style={{ border: "none", cursor: "pointer", padding: "6px 11px", fontFamily: "inherit", opacity: form.modules.includes(m) ? 1 : 0.55 }}>{form.modules.includes(m) ? "✓ " : ""}{l}</button>)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>Students, teachers, classes, attendance, timetable and announcements are always included.</div>
        </div>
        {input("contactName", "Contact person")}{input("contactEmail", "Contact email", { type: "email" })}{input("contactPhone", "Contact phone")}
        {creating && <>
          <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--border)", paddingTop: 12, fontWeight: 700, fontSize: 13 }}>First administrator — they set up everything else</div>
          {input("adminEmail", "Admin email", { type: "email" })}
          {input("adminPassword", "Temporary password (8+ characters)", { type: "text" })}
        </>}
        {input("notes", "Internal notes", { full: true })}
      </div>
    </Modal>
  );
}

function ResetAdminModal({ tenant, api, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const save = async () => {
    try { await api.call("POST", `/api/platform/tenants/${tenant._id}/admin-password`, form); toast("Password reset and two-factor sign-in cleared for that admin", "check"); onClose(); }
    catch (e) { toast(e.message, "alert"); }
  };
  return (
    <Modal title={`Recover an admin — ${tenant.name}`} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="accent" disabled={!form.email || form.password.length < 8} onClick={save}>Reset</Btn></>}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>For an institute whose administrator is locked out. Sets a new password and turns off their two-factor sign-in so they can get back in.</div>
        <div><label className="field-label">Admin email</label><input className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
        <div><label className="field-label">New password</label><input className="input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
      </div>
    </Modal>
  );
}

export default function PlatformConsole() {
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const [owner, setOwner] = useState(readOwner);
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(undefined);
  const [recovering, setRecovering] = useState(null);
  const [q, setQ] = useState("");
  const api = useMemo(() => makeApi(owner?.token), [owner?.token]);

  const load = () => api.call("GET", "/api/platform/tenants").then(setData).catch(e => { if (e.status === 401) { localStorage.removeItem(OWNER_KEY); setOwner(null); } else toast(e.message, "alert"); });
  useEffect(() => { if (owner) load(); }, [owner]);
  if (!owner) return <OwnerLogin onIn={setOwner} />;

  const tenants = (data?.tenants || []).filter(t => !q || `${t.name} ${t.code}`.toLowerCase().includes(q.toLowerCase()));
  const all = data?.tenants || [];
  const sum = k => all.reduce((s, t) => s + (t.usage?.[k] || 0), 0);
  const loginLink = t => `${window.location.origin}/login?i=${t.code}`;
  const setStatus = async (t, status) => {
    if (status === "suspended" && !window.confirm(`Suspend ${t.name}? Nobody at that institute will be able to sign in until you reactivate it. Their data is kept.`)) return;
    try { await api.call("PATCH", `/api/platform/tenants/${t._id}`, { status }); toast(status === "active" ? "Reactivated" : "Suspended", "check"); load(); } catch (e) { toast(e.message, "alert"); }
  };

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: "26px 22px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="brand-mark">A</div><div><div className="font-display" style={{ fontWeight: 600, fontSize: 17 }}>ACADEXA Platform</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>Signed in as {owner.email}</div></div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="icon-btn" onClick={toggle}>{theme === "dark" ? <Icon name="sun" size={16} /> : <Icon name="moon" size={16} />}</button>
          <Btn variant="ghost" onClick={() => { localStorage.removeItem(OWNER_KEY); setOwner(null); }}>Sign out</Btn>
        </div>
      </div>
      <SectionHeader eyebrow="Platform" title="Institutes" action={<div style={{ display: "flex", gap: 8 }}>
        <Btn variant="ghost" disabled={!all.length} onClick={() => downloadCsv("institutes.csv", ["Code", "Name", "Type", "Plan", "Status", "Students", "Teachers", "Staff", "Max students", "Subscription ends", "Last activity"], all.map(t => [t.code, t.name, t.type, t.plan, t.status, t.usage.students, t.usage.teachers, t.usage.staff, t.limits?.maxStudents ?? "", t.subscriptionEnds?.slice(0, 10) ?? "", t.usage.lastActivity?.slice(0, 10) ?? ""]))}><Icon name="file" size={13} />Export</Btn>
        <Btn variant="accent" onClick={() => setEditing(null)}><Icon name="plus" size={13} />New institute</Btn>
      </div>} />
      {data && !data.multiTenant && (
        <Card style={{ padding: "14px 18px", marginBottom: 16, borderColor: "var(--warn)", fontSize: 13 }}>
          This database is still in <strong>single-institute mode</strong>. Run <code>node scripts/migrateToMultiTenant.mjs</code> in <code>backend/</code> first to turn the existing data into your first institute — creating a new institute before that would hide the existing data from its users.
        </Card>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Institutes" value={data ? all.length : "…"} icon="layers" />
        <StatCard label="Active" value={data ? all.filter(t => t.status === "active").length : "…"} icon="check" />
        <StatCard label="Students (all)" value={data ? sum("students").toLocaleString() : "…"} icon="users" />
        <StatCard label="Teachers (all)" value={data ? sum("teachers").toLocaleString() : "…"} icon="grad" />
      </div>
      <input className="input" style={{ maxWidth: 320, marginBottom: 12 }} placeholder="Search institutes…" value={q} onChange={e => setQ(e.target.value)} />
      <Card style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead><tr><th>Institute</th><th>Plan</th><th>Students</th><th>Teachers</th><th>Staff</th><th>Last activity</th><th>Subscription</th><th>Status</th><th /></tr></thead>
          <tbody>{tenants.map(t => {
            const max = t.limits?.maxStudents;
            const expired = t.subscriptionEnds && new Date(t.subscriptionEnds) < new Date();
            return (
              <tr key={t._id}>
                <td><div style={{ fontWeight: 700, color: "var(--ink)" }}>{t.name}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.code} · {humanize(t.type)}</div></td>
                <td><Badge tone="accent">{humanize(t.plan)}</Badge><div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{t.modules.length} of {Object.keys(MODULE_LABELS).length} modules</div></td>
                <td>{t.usage.students}{max ? <span style={{ color: t.usage.students / max > 0.9 ? "var(--danger)" : "var(--muted)" }}> / {max}</span> : ""}</td>
                <td>{t.usage.teachers}{t.limits?.maxTeachers ? <span style={{ color: "var(--muted)" }}> / {t.limits.maxTeachers}</span> : ""}</td>
                <td>{t.usage.staff}</td>
                <td>{t.usage.lastActivity ? fmt(t.usage.lastActivity) : "—"}<div style={{ fontSize: 11, color: "var(--muted)" }}>{t.usage.actions30d} changes in 30 days</div></td>
                <td>{t.subscriptionEnds ? <span style={{ color: expired ? "var(--danger)" : undefined }}>{expired ? "Expired " : "Until "}{fmt(t.subscriptionEnds)}</span> : "—"}</td>
                <td><Badge tone={t.status === "active" ? "success" : "danger"}>{humanize(t.status)}</Badge></td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  <Btn variant="ghost" style={{ padding: "4px 9px", fontSize: 12, marginRight: 6 }} onClick={() => { navigator.clipboard?.writeText(loginLink(t)); toast(`Copied ${loginLink(t)}`, "check"); }}>Copy login link</Btn>
                  <Btn variant="ghost" style={{ padding: "4px 9px", fontSize: 12, marginRight: 6 }} onClick={() => setRecovering(t)}>Recover admin</Btn>
                  <Btn variant="ghost" style={{ padding: "4px 9px", fontSize: 12, marginRight: 6 }} onClick={() => setEditing(t)}>Manage</Btn>
                  {t.status === "active" ? <Btn variant="danger" style={{ padding: "4px 9px", fontSize: 12 }} onClick={() => setStatus(t, "suspended")}>Suspend</Btn> : <Btn variant="accent" style={{ padding: "4px 9px", fontSize: 12 }} onClick={() => setStatus(t, "active")}>Reactivate</Btn>}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
        {data && !tenants.length && <EmptyState icon="layers" title={all.length ? "No institutes match" : "No institutes yet"} desc="Create one to give a school, college or university its own portal." />}
      </Card>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Each institute's users sign in on the normal login page with its institute code (or at code.yourdomain when a wildcard domain is configured). Data never crosses between institutes.</div>
      {editing !== undefined && <TenantModal tenant={editing} api={api} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />}
      {recovering && <ResetAdminModal tenant={recovering} api={api} onClose={() => setRecovering(null)} />}
    </div>
  );
}
