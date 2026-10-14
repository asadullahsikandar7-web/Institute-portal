// segments: [{color, pct}] where pct is 0..1 and colors sum to <=1 of the ring.
export default function RingChart({ segments, size = 100, stroke = 11, center }) {
  const r = (size - stroke * 2) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  let offset = -Math.PI / 2;
  const arcs = segments.map(s => {
    const len = circ * s.pct;
    const arc = { color: s.color, len, offset, r, cx, cy, circ };
    offset += s.pct * 2 * Math.PI;
    return arc;
  });
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        {arcs.map((a, i) => (
          <circle key={i} cx={a.cx} cy={a.cy} r={a.r} fill="none" stroke={a.color} strokeWidth={stroke}
            strokeDasharray={`${a.len} ${a.circ}`} strokeLinecap="round"
            transform={`rotate(${(a.offset * 180 / Math.PI) + 90} ${a.cx} ${a.cy})`}
            style={{ transition: "stroke-dasharray 1s ease" }} />
        ))}
      </svg>
      {center != null && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
          {center}
        </div>
      )}
    </div>
  );
}
