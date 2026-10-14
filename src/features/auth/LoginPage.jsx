import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Icon } from "../../components/ui/index.js";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { ForgotPasswordModal } from "../erp/AccountPages.jsx";
import { InstitutePicker } from "../platform/InstitutePicker.jsx";

const ROLES = [
  { key: "student", label: "Student", icon: "user" },
  { key: "teacher", label: "Teacher", icon: "grad" },
  { key: "parent", label: "Parent", icon: "users" },
  { key: "admin", label: "Admin", icon: "shield" },
];

const FEATURES = [
  { icon: "clipboard", label: "Live Attendance Tracking" },
  { icon: "grad", label: "Grades & Results" },
  { icon: "bell", label: "Instant Notices" },
  { icon: "dollar", label: "Fee Management" },
];

function AuthField({ icon, label, error, endAdornment, autoFocus, ...props }) {
  return (
    <div>
      <label className="auth-field-label">{label}</label>
      <div className={"auth-field-wrap" + (error ? " err" : "")}>
        <span className="auth-field-icon"><Icon name={icon} size={16} /></span>
        <input autoFocus={autoFocus} {...props} />
        {endAdornment}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { session, handleLogin, anonApi } = useSession();
  const { theme, toggle } = useTheme();
  const { settings } = useSettings();
  const [role, setRole] = useState("student");
  const [identifier, setIdentifier] = useState(""); // roll no (student) or email (admin/teacher)
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [otp, setOtp] = useState("");
  const [needOtp, setNeedOtp] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [askInstitute, setAskInstitute] = useState(0); // bumped when the server needs an institute code

  if (session) return <Navigate to={`/${session.role}/dashboard`} replace />;

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 420); };

  const submit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) { triggerShake(); return; }
    setLoading(true);
    setError("");
    try {
      const data = role === "admin" ? await anonApi.adminLogin(identifier.trim(), password, needOtp ? otp : undefined)
        : role === "teacher" ? await anonApi.teacherLogin(identifier.trim(), password)
        : role === "parent" ? await anonApi.parentLogin(identifier.trim(), password)
        : await anonApi.studentLogin(identifier.trim(), password);
      handleLogin(data);
    } catch (err) {
      // Admin with two-factor sign-in: password was right, now ask for the code.
      if (err.data?.instituteRequired) { setAskInstitute(n => n + 1); setError(err.message); triggerShake(); return; }
      if (err.data?.twoFactorRequired) {
        if (needOtp) setError(err.message); else setError("");
        setNeedOtp(true);
        if (needOtp) triggerShake();
        return;
      }
      setError(err.message || "Login failed");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const activeIdx = ROLES.findIndex(r => r.key === role);

  return (
    <div className="auth-wrap">
      {/* ── Left: brand / campus hero ─────────────────────── */}
      <div className="auth-hero" aria-hidden="true">
        <div className="auth-hero-photo" />
        <div className="auth-hero-overlay" />
        <div className="auth-orb auth-orb-a" />
        <div className="auth-orb auth-orb-b" />

        <div className="auth-hero-inner">
          <div className="auth-hero-top">
            <div className="auth-crest"><img src="/assets/acadexa-crest.png" alt="ACADEXA" /></div>
            <div className="auth-wordmark">ACADEXA<small>by ASAD</small></div>
          </div>

          <div className="auth-hero-body">
            <div className="auth-eyebrow"><Icon name="trend" size={11} /> Academic Management Platform</div>
            <div className="auth-heading">A Smarter <em>Academic Experience</em> Begins Here</div>
            <div className="auth-sub">Secure, modern, and intuitive workflows for students, teachers, and administrators — all in one place.</div>

            <div className="auth-features">
              {FEATURES.map(f => (
                <div key={f.label} className="auth-feature">
                  <span className="auth-feature-icon"><Icon name={f.icon} size={15} /></span>
                  {f.label}
                </div>
              ))}
            </div>
          </div>

          <div className="auth-hero-foot">
            <span><Icon name="check" size={12} /> Empowering students. Connecting education.</span>
            <span>© 2026 ACADEXA</span>
          </div>
        </div>
      </div>

      {/* ── Right: sign-in form ────────────────────────────── */}
      <div className="auth-form-panel">
        <div className="auth-form-orb auth-form-orb-a" />
        <div className="auth-form-orb auth-form-orb-b" />

        <button className="icon-btn auth-theme-toggle" onClick={toggle}>
          {theme === "dark" ? <Icon name="sun" size={16} /> : <Icon name="moon" size={16} />}
        </button>

        <div className={"auth-card auth-shake" + (shake ? " shaking" : "")}>
          <div className="auth-card-bar" />
          <div className="auth-card-head">
            <div className="auth-card-badge"><img src="/assets/acadexa-crest.png" alt="ACADEXA" /></div>
            <div>
              <div className="auth-card-title">Welcome Back</div>
              <div className="auth-card-sub">Sign in to access your ACADEXA dashboard</div>
            </div>
          </div>

          <InstitutePicker ask={askInstitute} onChange={() => setError("")} />

          <div className="auth-seg">
            <div className="auth-seg-thumb" style={{ width: `calc(${100 / ROLES.length}% - ${8 / ROLES.length}px)`, transform: `translateX(${activeIdx * 100}%)` }} />
            {ROLES.map(r => (
              <button key={r.key} type="button" className={"auth-seg-btn" + (role === r.key ? " active" : "")}
                onClick={() => { setRole(r.key); setError(""); setNeedOtp(false); setOtp(""); }}>
                <Icon name={r.icon} size={12} />{r.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="auth-field-stack">
            <AuthField
              icon={role === "student" ? "user" : "mail"}
              label={role === "student" ? "Roll Number" : "Email address"}
              type={role === "student" ? "text" : "email"}
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder={role === "student" ? "e.g. AI-2627-014" : "e.g. you@academexa.edu"}
              autoFocus
            />
            <div>
              <AuthField
                icon="lock"
                label="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyUp={e => e.getModifierState && setCapsLock(e.getModifierState("CapsLock"))}
                endAdornment={
                  <button type="button" className="auth-field-eye" onClick={() => setShowPassword(s => !s)}>
                    <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                  </button>
                }
              />
              {capsLock && <div className="auth-capswarn"><Icon name="alert" size={12} /> Caps Lock is on</div>}
            </div>

            {needOtp && (
              <AuthField
                icon="shield"
                label="Authenticator code"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code from your app"
                autoFocus
              />
            )}

            {error && <div className="auth-error"><Icon name="alert" size={15} /><span>{error}</span></div>}

            <div className="auth-submit-wrap">
              <button type="submit" className="btn btn-accent" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }}>
                {loading ? "Signing in…" : needOtp ? "Verify & Sign In" : "Sign In"}
              </button>
            </div>
            <div style={{ textAlign: "right", marginTop: -4 }}>
              <button type="button" onClick={() => setForgot(true)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Forgot password?</button>
            </div>
          </form>

          <div className="auth-trust">
            <div className="auth-trust-item"><Icon name="lock" size={13} /> Encrypted session</div>
            <div className="auth-trust-item"><Icon name="check" size={13} /> Role-based access</div>
          </div>

          {settings.admissionsOpen && (
            <div style={{ textAlign: "center", marginTop: 16, fontSize: 12.5 }}>
              <Link to="/apply" style={{ color: "var(--accent)", fontWeight: 700 }}>New here? Apply for admission →</Link>
            </div>
          )}
          <div className="auth-card-foot">© 2026 ACADEXA by ASAD</div>
          {forgot && <ForgotPasswordModal initialRole={role} onClose={() => setForgot(false)} />}
        </div>
      </div>
    </div>
  );
}
