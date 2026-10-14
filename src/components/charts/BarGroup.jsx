export default function BarGroup({ data, maxVal, colors, height = 60 }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height }}>
      {data.map((v, i) => (
        <div key={i} title={v} style={{
          flex: 1, minWidth: 4, borderRadius: "3px 3px 0 0",
          height: `${Math.round((v / Math.max(maxVal, 1)) * 100)}%`,
          background: colors?.[i] || "var(--accent)",
          transition: "height 0.6s cubic-bezier(0.34,1.56,0.64,1)", transitionDelay: `${i * 0.04}s`, opacity: 0.9,
        }} />
      ))}
    </div>
  );
}
