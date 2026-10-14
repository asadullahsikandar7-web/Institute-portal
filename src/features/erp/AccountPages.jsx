import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { SectionHeader, Card, Btn, Icon, Modal, Badge } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { useAction } from "./hooks.js";

// Account security: forgot/reset password for every portal, and two-factor
// sign-in (authenticator app) for admin accounts.

const ROLES = [{ key: "student", label: "Student" }, { key: "teacher", label: "Teacher" }, { key: "parent", label: "Parent" }, { key: "admin", label: "Admin" }];

export function ForgotPasswordModal({ initialRole = "student", onClose }) {
  const { anonApi } = useSession();
  const [run, busy] = useAction();
  const [role, setRole] = useState(initialRole);
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState(null);
  const submit = e => { e.preventDefault(); run(() => anonApi.call("POST", "/api/auth/forgot-password", { role, identifier })).then(r => r && setSent(r.message)); };
  return (
    <Modal title="Reset your password" onClose={onClose}>
      {sent ? (
        <div style={{ display: "grid", gap: 12, fontSize: 13.5 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Icon name="mail" size={18} /><strong>Check your email</strong></div>
          <div style={{ color: "var(--ink-soft)" }}>{sent} The link works once and expires in 30 minutes. If nothing arrives, the account may have no email on file — ask the institute office to reset it for you.</div>
          <Btn variant="accent" onClick={onClose} style={{ width: "fit-content" }}>Done</Btn>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <div><label className="field-label">I am a</label>
            <select className="input" value={role} onChange={e => setRole(e.target.value)}>{ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
          <div><label className="field-label">{role === "student" ? "Roll number or email" : "Email address"}</label>
            <input className="input" autoFocus value={identifier} onChange={e => setIdentifier(e.target.value)} /></div>
          <Btn type="submit" variant="accent" disabled={busy || !identifier.trim()}>{busy ? "Sending…" : "Send reset link"}</Btn>
        </form>
      )}
    </Modal>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const { anonApi } = useSession();
  const { settings } = useSettings();
  const [run, busy] = useAction();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [done, setDone] = useState(false);
  const token = params.get("token") || "";
  const problem = form.password && form.password.length < 8 ? "At least 8 characters." : form.confirm && form.confirm !== form.password ? "The passwords don't match." : "";
  const submit = e => { e.preventDefault(); run(() => anonApi.call("POST", "/api/auth/reset-password", { token, password: form.password })).then(r => r && setDone(true)); };
  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "70px 18px" }}>
      <SectionHeader eyebrow={settings.instituteName} title="Choose a new password" />
      <Card style={{ padding: 22 }}>
        {!token ? <div style={{ fontSize: 13.5 }}>This page needs the link from your reset email. <Link to="/login" style={{ color: "var(--accent)" }}>Back to sign in</Link></div>
          : done ? <div style={{ display: "grid", gap: 12, fontSize: 13.5 }}><div style={{ display: "flex", gap: 8, alignItems: "center" }}><Icon name="check" size={18} /><strong>Password changed.</strong></div><Link to="/login"><Btn variant="accent">Sign in</Btn></Link></div>
          : (
            <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
              <div><label className="field-label">New password</label><input className="input" type="password" autoComplete="new-password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
              <div><label className="field-label">Confirm new password</label><input className="input" type="password" autoComplete="new-password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} /></div>
              {problem && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{problem}</div>}
              <Btn type="submit" variant="accent" disabled={busy || !!problem || !form.password || form.password !== form.confirm}>Change password</Btn>
            </form>
          )}
      </Card>
    </div>
  );
}

// Settings → Security: two-factor sign-in for the signed-in admin.
export function SecuritySettings() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [pw, setPw] = useState("");
  const load = () => api.call("GET", "/api/system/2fa").then(setStatus).catch(() => setStatus({ enabled: false }));
  useEffect(() => { load(); }, [api]);
  useEffect(() => { if (setup) QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 200 }).then(setQr).catch(() => setQr("")); }, [setup]);

  const start = () => run(() => api.call("POST", "/api/system/2fa/setup")).then(r => { if (r) { setSetup(r); setCode(""); } });
  const enable = () => run(() => api.call("POST", "/api/system/2fa/enable", { code }), "Two-factor sign-in is on").then(r => { if (r) { setSetup(null); load(); } });
  const disable = () => run(() => api.call("POST", "/api/system/2fa/disable", { password: pw, code }), "Two-factor sign-in turned off").then(r => { if (r) { setDisabling(false); setPw(""); setCode(""); load(); } });

  return (
    <Card style={{ padding: 22, maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Icon name="shield" size={18} /><div style={{ fontWeight: 700, fontSize: 15 }}>Two-factor sign-in</div>
        {status && <Badge tone={status.enabled ? "success" : "neutral"}>{status.enabled ? "On" : "Off"}</Badge>}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
        Admin accounts can change fees, results and other people's access. With two-factor sign-in on, a stolen password alone isn't enough — signing in also needs the 6-digit code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Authy, 1Password…). This applies to your account only.
      </div>
      {status?.enabled ? (
        disabling ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <div><label className="field-label">Password</label><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} /></div>
            <div><label className="field-label">Current code</label><input className="input font-mono" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} /></div>
            <Btn variant="danger" disabled={busy || !pw || code.length !== 6} onClick={disable}>Turn off</Btn>
          </div>
        ) : <Btn variant="ghost" onClick={() => setDisabling(true)}>Turn off two-factor sign-in</Btn>
      ) : setup ? (
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ background: "#fff", padding: 8, borderRadius: 10, width: 216, height: 216 }}>{qr && <img src={qr} alt="Scan with your authenticator app" width={200} height={200} />}</div>
          <div style={{ flex: "1 1 260px", display: "grid", gap: 12 }}>
            <div style={{ fontSize: 13 }}><strong>1.</strong> Scan this code with your authenticator app, or type the key manually:</div>
            <div className="font-mono" style={{ fontSize: 13, background: "var(--surface-alt)", borderRadius: 8, padding: "8px 10px", wordBreak: "break-all", letterSpacing: 1 }}>{setup.secret.match(/.{1,4}/g).join(" ")}</div>
            <div style={{ fontSize: 13 }}><strong>2.</strong> Enter the 6-digit code it shows:</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input font-mono" inputMode="numeric" maxLength={6} placeholder="000000" style={{ width: 130, fontSize: 18, letterSpacing: 3, textAlign: "center" }} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} />
              <Btn variant="accent" disabled={busy || code.length !== 6} onClick={enable}>Confirm & turn on</Btn>
              <Btn variant="ghost" onClick={() => setSetup(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      ) : <Btn variant="accent" onClick={start} disabled={busy || !status}><Icon name="lock" size={13} />Set up two-factor sign-in</Btn>}
    </Card>
  );
}
