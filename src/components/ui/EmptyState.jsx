import Icon from "./Icon.jsx";

export default function EmptyState({ icon = "file", title, desc }) {
  return (
    <div className="empty-state">
      <div style={{ width: 52, height: 52, margin: "0 auto 14px", borderRadius: 14, background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
        <Icon name={icon} size={22} />
      </div>
      <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{title}</div>
      {desc && <div style={{ fontSize: 13 }}>{desc}</div>}
    </div>
  );
}
