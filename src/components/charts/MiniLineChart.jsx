export default function MiniLineChart({ data, color = "var(--accent)", height = 52 }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data, 1);
  const gradId = "mlc-" + Math.random().toString(36).slice(2);
  return (
    <div style={{ height, width: "100%", position: "relative", overflow: "hidden" }}>
      <svg viewBox={`0 0 ${Math.max(data.length - 1, 1)} 10`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={data.map((v, i) => `${i},${10 - (v / max) * 9}`).join(" ")}
          fill="none" stroke={color} strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={`0,10 ${data.map((v, i) => `${i},${10 - (v / max) * 9}`).join(" ")} ${data.length - 1},10`}
          fill={`url(#${gradId})`} />
      </svg>
    </div>
  );
}
