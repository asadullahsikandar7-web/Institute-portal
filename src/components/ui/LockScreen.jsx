import Icon from "./Icon.jsx";

export default function LockScreen({ reason }) {
  return (
    <div className="lock-screen">
      <div style={{ width: 54, height: 54, borderRadius: 14, background: "var(--danger-soft)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <Icon name="lock" size={24} />
      </div>
      <div className="font-display" style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Access Restricted</div>
      <div style={{ fontSize: 13.5, color: "var(--muted)" }}>{reason}</div>
    </div>
  );
}
