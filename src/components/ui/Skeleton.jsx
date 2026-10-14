export default function Skeleton({ h = 16, w = "100%", r = 8 }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}
