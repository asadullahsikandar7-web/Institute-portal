// Page-level title block: eyebrow + Fraunces heading + optional right-aligned action.
export default function SectionHeader({ eyebrow, title, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
      <div>
        {eyebrow && (
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--accent-ink)", marginBottom: 4 }}>
            {eyebrow}
          </div>
        )}
        <h1 className="font-display" style={{ fontSize: 23, fontWeight: 600, margin: 0 }}>{title}</h1>
      </div>
      {action}
    </div>
  );
}
