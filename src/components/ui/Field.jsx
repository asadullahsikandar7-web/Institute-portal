export function Input({ label, error, style = {}, ...props }) {
  return (
    <div>
      {label && <label className="field-label">{label}</label>}
      <input className={"input" + (error ? " err" : "")} style={style} {...props} />
      {error && <div style={{ color: "var(--danger)", fontSize: 11.5, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export function Select({ label, error, children, style = {}, ...props }) {
  return (
    <div>
      {label && <label className="field-label">{label}</label>}
      <select className={"input" + (error ? " err" : "")} style={style} {...props}>
        {children}
      </select>
      {error && <div style={{ color: "var(--danger)", fontSize: 11.5, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export function Textarea({ label, error, style = {}, ...props }) {
  return (
    <div>
      {label && <label className="field-label">{label}</label>}
      <textarea className={"input" + (error ? " err" : "")} style={style} {...props} />
      {error && <div style={{ color: "var(--danger)", fontSize: 11.5, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
