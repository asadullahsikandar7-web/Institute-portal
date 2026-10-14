import { useState } from "react";
import ResourcePage from "../../components/resource/ResourcePage.jsx";
import { SectionHeader, Tabs, Modal, Btn, Icon, Badge } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useLoad, useAction } from "./hooks.js";
import ParentMessagesPage from "../admin/communication/ParentsPage.jsx";

// Parent records + who can sign in to the parent portal + which students
// each parent is linked to. The email-log screen that used to be the whole
// "Parents" page is kept as the second tab.
function PortalModal({ parent, onClose, onSaved }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [students, reloadStudents] = useLoad("/api/students", []);
  const [password, setPassword] = useState("");
  const [linking, setLinking] = useState("");
  const [enabled, setEnabled] = useState(!!parent.portalEnabled);
  const children = (students || []).filter(s => (s.parentId?._id || s.parentId) === parent._id);
  const others = (students || []).filter(s => !s.parentId);

  const link = (studentId, parentId) => run(() => api.call("PATCH", `/api/lifecycle/students/${studentId}/profile`, { parentId }), parentId ? "Student linked" : "Student unlinked").then(() => { setLinking(""); reloadStudents(); });
  const save = () => run(() => api.call("PATCH", `/api/parents/${parent._id}/portal`, { enabled, ...(password ? { password } : {}) }), "Portal access updated").then(r => r && onSaved());

  return (
    <Modal title={`Portal access — ${parent.name}`} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Close</Btn><Btn variant="accent" onClick={save} disabled={busy || (password !== "" && password.length < 8)}>Save</Btn></>}>
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Linked students</div>
          {children.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>No students linked — this parent would see an empty portal.</div>}
          <div style={{ display: "grid", gap: 6 }}>
            {children.map(s => (
              <div key={s._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-alt)", borderRadius: 8, padding: "7px 10px", fontSize: 13 }}>
                <span>{s.name} <span style={{ color: "var(--muted)" }}>#{s.rollNo}</span></span>
                <button className="icon-btn" title="Unlink" disabled={busy} onClick={() => link(s._id, null)}><Icon name="x" size={12} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <select className="input" value={linking} onChange={e => setLinking(e.target.value)}>
              <option value="">Link a student…</option>{others.map(s => <option key={s._id} value={s._id}>{s.name} · #{s.rollNo}</option>)}
            </select>
            <Btn variant="ghost" disabled={busy || !linking} onClick={() => link(linking, parent._id)}>Link</Btn>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Sign-in</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>Login email: <strong style={{ color: "var(--ink-soft)" }}>{parent.email || "none — add an email to this parent first"}</strong></div>
          <label className="field-label">{parent.portalEnabled ? "Reset password (leave empty to keep the current one)" : "Set a password"}</label>
          <input className="input" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Allow this parent to sign in to the parent portal
          </label>
        </div>
      </div>
    </Modal>
  );
}

function Accounts() {
  const [managing, setManaging] = useState(null);
  const [tick, setTick] = useState(0);
  return (
    <>
      <ResourcePage embedded title="Parents" base="/api/parents" addLabel="Add Parent" deleteLabel="Deactivate" searchable={false} reloadKey={tick}
        emptyDesc="Parent records are created with a student, by admissions, or here."
        columns={[
          { key: "name", label: "Parent / Guardian" }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
          { key: "portalEnabled", label: "Portal", render: r => <Badge tone={r.portalEnabled ? "success" : "neutral"}>{r.portalEnabled ? "Can sign in" : "No access"}</Badge>, csv: r => (r.portalEnabled ? "yes" : "no") },
          { key: "status", label: "Status", type: "status" },
        ]}
        fields={[
          { name: "name", label: "Name", required: true }, { name: "email", label: "Email", type: "email", hint: "Also their parent-portal login." },
          { name: "phone", label: "Phone" }, { name: "whatsappNumber", label: "WhatsApp Number" },
        ]}
        rowActions={row => [{ label: "Portal & Children", icon: "users", onClick: () => setManaging(row) }]} />
      {managing && <PortalModal parent={managing} onClose={() => { setManaging(null); setTick(t => t + 1); }} onSaved={() => { setManaging(null); setTick(t => t + 1); }} />}
    </>
  );
}

export default function ParentAccountsPage() {
  const [tab, setTab] = useState("accounts");
  if (tab === "messages") {
    return <><Tabs items={TABS} active={tab} onChange={setTab} style={{ marginBottom: 18 }} /><ParentMessagesPage /></>;
  }
  return (
    <>
      <SectionHeader eyebrow="Communication" title="Parents" />
      <Tabs items={TABS} active={tab} onChange={setTab} style={{ marginBottom: 18 }} />
      <Accounts />
    </>
  );
}
const TABS = [{ key: "accounts", label: "Accounts & Portal Access" }, { key: "messages", label: "Messages Sent" }];
