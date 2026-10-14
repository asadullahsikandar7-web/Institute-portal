import Icon from "./Icon.jsx";

export default function StatCard({ label, value, icon, onClick, active }) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        borderColor: active ? "var(--accent)" : "var(--border)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="val">{value}</div>
          <div className="lbl">{label}</div>
        </div>
        {icon && (
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={icon} size={16} />
          </div>
        )}
      </div>
    </div>
  );
}
