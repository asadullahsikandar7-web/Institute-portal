export default function Tabs({ items, active, onChange, style = {} }) {
  // items: [{key,label}] or string[]
  const norm = items.map(it => (typeof it === "string" ? { key: it, label: it[0].toUpperCase() + it.slice(1) } : it));
  return (
    <div className="tabs" style={style}>
      {norm.map(t => (
        <div key={t.key} className={"tab" + (active === t.key ? " active" : "")} onClick={() => onChange(t.key)}>
          {t.label}
        </div>
      ))}
    </div>
  );
}
