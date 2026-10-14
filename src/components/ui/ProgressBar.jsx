export default function ProgressBar({ pct = 0 }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: clamped + "%" }} />
    </div>
  );
}
