// Thin wrapper so pages don't hand-roll <table className="table"> + overflow
// scaffolding every time. `columns`/`rows` are optional convenience props —
// pass raw children instead for full control over <thead>/<tbody>.
export default function Table({ columns, rows, renderRow, emptyState, children }) {
  if (children) {
    return (
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="table">{children}</table>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: 0, overflow: "auto" }}>
      <table className="table">
        <thead>
          <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length}>{emptyState}</td></tr>
          )}
          {rows.map(renderRow)}
        </tbody>
      </table>
    </div>
  );
}
