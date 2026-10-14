// Breadcrumb pill chain, e.g. "BS AI  ›  Section A  ›  Data Structures" with
// the final node styled as the accent "you are here" pill.
export default function Chain({ items }) {
  const clean = items.filter(Boolean);
  return (
    <div className="chain">
      {clean.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
          {i > 0 && <span className="chain-sep">›</span>}
          <span className={"chain-node" + (i === clean.length - 1 ? " final" : "")}>{it}</span>
        </span>
      ))}
    </div>
  );
}
