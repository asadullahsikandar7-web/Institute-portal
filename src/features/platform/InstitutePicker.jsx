import { useEffect, useState } from "react";
import { Icon } from "../../components/ui/index.js";
import { makeApi, getInstitute, setInstitute, instituteLockedBySubdomain } from "../../lib/api.js";

// Login-page institute selector. Only appears when the platform hosts more
// than one institute. Shows which institute you're signing in to, and lets
// you enter a different institute code — unless the subdomain already
// decides it (riverside.acadexa.com).
export function InstitutePicker({ ask = 0, onChange }) {
  const [mode, setMode] = useState(null);
  const [current, setCurrent] = useState(null);
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const api = makeApi(null);
  const locked = instituteLockedBySubdomain();

  useEffect(() => {
    api.call("GET", "/api/platform/mode").then(async m => {
      setMode(m);
      const c = getInstitute();
      if (c) { const t = await api.call("GET", `/api/platform/lookup?code=${encodeURIComponent(c)}`).catch(() => null); setCurrent(t); if (!t && !locked) setEditing(true); }
      else if (m.defaultInstitute) setCurrent(m.defaultInstitute);
      else if (m.multiTenant) setEditing(true);
    }).catch(() => setMode({ multiTenant: false }));
  }, []);
  useEffect(() => { if (ask && !locked) setEditing(true); }, [ask]);

  if (!mode?.multiTenant) return null;
  const apply = async e => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const t = await api.call("GET", `/api/platform/lookup?code=${encodeURIComponent(code.trim())}`);
      if (t.status !== "active") throw new Error("This institute's account is suspended.");
      setInstitute(t.code); setCurrent(t); setEditing(false); onChange?.(t);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ marginBottom: 16, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 11, padding: "10px 12px" }}>
      {editing ? (
        <form onSubmit={apply}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 6 }}>Institute code</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" autoFocus placeholder="e.g. RIVERSIDE" value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={{ textTransform: "uppercase" }} />
            <button type="submit" className="btn btn-accent" disabled={busy || code.trim().length < 2}>Continue</button>
          </div>
          <div style={{ fontSize: 11.5, color: error ? "var(--danger)" : "var(--muted)", marginTop: 6 }}>{error || "Your school, college or university gives you this code."}</div>
          {current && <button type="button" onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11.5, cursor: "pointer", padding: 0, marginTop: 4, fontFamily: "inherit" }}>Keep {current.name}</button>}
        </form>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="grad" size={16} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current?.name || "—"}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Institute code {current?.code}</div>
          </div>
          {!locked && <button type="button" onClick={() => { setEditing(true); setCode(""); }} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Change</button>}
        </div>
      )}
    </div>
  );
}
