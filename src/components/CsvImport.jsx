import { useState } from "react";
import { Badge, Btn, Icon, Modal } from "./ui/index.js";
import { downloadCsv, parseCsv } from "../lib/utils.js";

// Generic "Import CSV" for any list page: a downloadable template with
// sample rows, a column guide, per-row validation and preview, then the rows
// are sent one by one through the page's normal create call (so every
// server-side rule still applies). Rows that fail come back as a CSV with an
// Error column — fix them and upload that file again.
//
// column: { key, label, required, type, options, lookup, sample, hint, aliases }
//   type    text (default) | number | date | datetime | time | boolean | email | list
//   options ["a","b"] or [{ value, label }] — the cell may hold the value or the label
//   lookup  async () => [{ value, label, keys: ["code", "name", …], id }] — the
//           cell holds a name/code and is replaced by the matching id; `id` is
//           what the template writes when it swaps in a real record
//   parse   (cell) => value — custom conversion; throw to reject the row
// samples: [{ key: value }] rows for the template (defaults to column.sample)
// submit:  async (row, line) => any — creates one record from a converted row;
//          return { login: { Name, Email, Password… } } to list generated
//          logins in a downloadable file at the end
// prepare: async (rows) => rows — optional pass over all rows before sending

const norm = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const toOptions = opts => (opts || []).map(o => (typeof o === "string" ? { value: o, label: o } : o));

function parseDate(s) {
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // day/month/year, as written in Pakistan & the UK
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  throw new Error("use YYYY-MM-DD or DD/MM/YYYY");
}
function parseTime(s) {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!m) throw new Error("use HH:MM, e.g. 09:30 or 2:15 PM");
  let h = Number(m[1]);
  if (m[3]) h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0);
  if (h > 23 || Number(m[2]) > 59) throw new Error("not a valid time");
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function convert(col, raw, lookups) {
  const s = String(raw ?? "").replace(/^'(?=[=+\-@])/, "").trim(); // undo the spreadsheet-safety quote our exports add
  if (!s) {
    if (col.required) throw new Error("is required");
    return undefined;
  }
  if (col.parse) return col.parse(s);
  switch (col.type) {
    case "number": {
      const n = Number(s.replace(/,/g, ""));
      if (!Number.isFinite(n)) throw new Error("must be a number");
      return n;
    }
    case "date": return parseDate(s);
    case "datetime": { const d = new Date(s.replace(" ", "T")); if (isNaN(d)) throw new Error("use YYYY-MM-DD HH:MM"); return d.toISOString(); }
    case "time": return parseTime(s);
    case "boolean":
      if (/^(y|yes|true|1|active)$/i.test(s)) return true;
      if (/^(n|no|false|0|inactive)$/i.test(s)) return false;
      throw new Error("use yes or no");
    case "email":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error("is not a valid email");
      return s.toLowerCase();
    case "list": return s.split(/[;|]/).map(x => x.trim()).filter(Boolean);
  }
  if (col.options) {
    const hit = toOptions(col.options).find(o => norm(o.value) === norm(s) || norm(o.label) === norm(s));
    if (!hit) throw new Error(`must be one of: ${toOptions(col.options).map(o => o.label).join(", ")}`);
    return hit.value;
  }
  if (col.lookup) {
    const list = lookups[col.key] || [];
    const hits = list.filter(o => [o.label, ...(o.keys || [])].some(k => k != null && norm(k) === norm(s)));
    if (!hits.length) throw new Error(`“${s}” was not found${list.length ? "" : " (add those first)"}`);
    if (hits.length > 1) throw new Error(`“${s}” matches ${hits.length} records — use the code instead`);
    return hits[0].value;
  }
  return s;
}

export function templateRows(columns, samples) {
  const rows = samples?.length ? samples : [Object.fromEntries(columns.map(c => [c.key, c.sample ?? ""]))];
  return rows.map(r => columns.map(c => r[c.key] ?? ""));
}

function describe(col) {
  if (col.hint) return col.hint;
  if (col.options) return `One of: ${toOptions(col.options).map(o => o.label).join(", ")}`;
  if (col.lookup) return "Name or code of an existing record";
  return { number: "Number", date: "Date — YYYY-MM-DD or DD/MM/YYYY", datetime: "Date & time — YYYY-MM-DD HH:MM", time: "Time — HH:MM (24h) or 2:15 PM", boolean: "yes / no", email: "Email address", list: "Several values separated by ;" }[col.type] || "Text";
}

export default function CsvImport({ title, filename, columns, samples, submit, prepare, onDone, onClose, note, concurrency = 4 }) {
  const [rows, setRows] = useState(null); // [{ line, raw, data, error }]
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(null); // { done, total }
  const [result, setResult] = useState(null); // { added, failed: [{ line, raw, error }] }
  const [problem, setProblem] = useState("");
  const base = (filename || title || "import").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Sample values that point at other records ("Class 1", a roll number…) are
  // swapped for this institute's real ones, so the template imports as-is.
  const template = async () => {
    let rows = templateRows(columns, samples);
    const linked = columns.map((c, i) => [c, i]).filter(([c]) => c.lookup);
    try {
      const lists = await Promise.all(linked.map(([c]) => c.lookup()));
      linked.forEach(([, i], j) => {
        const list = lists[j] || [];
        if (!list.length) return;
        let n = 0;
        rows = rows.map(r => {
          const v = r[i];
          if (v === "" || v == null || list.some(o => [o.label, ...(o.keys || [])].some(k => k != null && norm(k) === norm(v)))) return r;
          const o = list[n++ % list.length];
          return r.map((x, k) => (k === i ? o.id ?? o.label : x));
        });
      });
    } catch { /* keep the generic samples */ }
    downloadCsv(`${base}-template.csv`, columns.map(c => c.label), rows);
  };

  const onFile = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null); setProblem(""); setFileName(file.name);
    const parsed = parseCsv(await file.text());
    if (!parsed.length) { setRows(null); return setProblem("That file has no data rows."); }
    // Match the file's headers to our columns by label, key or alias,
    // ignoring case, spaces and punctuation (and a trailing "*").
    const headers = Object.keys(parsed[0]);
    const pick = {};
    for (const c of columns) {
      const names = [c.label, c.key, ...(c.aliases || [])].map(norm);
      const h = headers.find(x => names.includes(norm(x.replace(/\*$/, "").replace(/^﻿/, ""))));
      if (h) pick[c.key] = h;
    }
    const missing = columns.filter(c => c.required && !pick[c.key]);
    if (missing.length) { setRows(null); return setProblem(`The file is missing these columns: ${missing.map(c => c.label).join(", ")}. Download the template to see the expected layout.`); }

    let lookups = {};
    try {
      const withLookup = columns.filter(c => c.lookup);
      const lists = await Promise.all(withLookup.map(c => c.lookup()));
      lookups = Object.fromEntries(withLookup.map((c, i) => [c.key, lists[i] || []]));
    } catch (err) { return setProblem(`Could not load the lists needed to check the file: ${err.message}`); }

    setRows(parsed.map((raw, i) => {
      const data = {}; const errors = [];
      for (const c of columns) {
        try { const v = convert(c, pick[c.key] ? raw[pick[c.key]] : "", lookups); if (v !== undefined) data[c.key] = v; }
        catch (err) { errors.push(`${c.label} ${err.message}`); }
      }
      return { line: i + 2, raw, data, error: errors.join("; ") };
    }));
  };

  const valid = rows?.filter(r => !r.error) || [];
  const invalid = rows?.filter(r => r.error) || [];

  const run = async () => {
    let list = valid;
    if (prepare) {
      try { const out = await prepare(valid.map(r => r.data)); list = valid.map((r, i) => ({ ...r, data: out[i] })); }
      catch (err) { return setProblem(err.message); }
    }
    setProgress({ done: 0, total: list.length });
    const failed = [], logins = []; let added = 0; let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const r = list[next++];
        try { const out = await submit(r.data, r.line); added++; if (out?.login) logins.push(out.login); }
        catch (err) { failed.push({ ...r, error: err.message || "Failed" }); }
        setProgress(p => ({ ...p, done: p.done + 1 }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
    setProgress(null); setRows(null);
    setResult({ added, logins, failed: [...invalid, ...failed].sort((a, b) => a.line - b.line) });
    if (added) onDone?.();
  };

  const failedCsv = () => {
    const heads = Object.keys(result.failed[0].raw);
    downloadCsv(`${base}-to-fix.csv`, [...heads, "Error"], result.failed.map(f => [...heads.map(h => f.raw[h]), f.error]));
  };

  const shown = rows ? [...invalid, ...valid].slice(0, 100) : [];
  return (
    <Modal wide title={title || "Import from CSV"} onClose={progress ? () => {} : onClose} footer={<>
      <Btn variant="ghost" onClick={template}><Icon name="file" size={13} />Download template</Btn>
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" onClick={onClose} disabled={!!progress}>{result ? "Close" : "Cancel"}</Btn>
      {rows && <Btn variant="accent" onClick={run} disabled={!valid.length || !!progress}>
        {progress ? `Importing ${progress.done} / ${progress.total}…` : `Import ${valid.length} row${valid.length === 1 ? "" : "s"}`}
      </Btn>}
    </>}>
      {!rows && !result && <>
        {note && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>{note}</p>}
        <ol style={{ fontSize: 13, color: "var(--muted)", paddingLeft: 18, margin: "0 0 14px", lineHeight: 1.7 }}>
          <li><b style={{ color: "var(--ink)" }}>Download the template</b> — it has the right columns and a sample row.</li>
          <li>Fill it in Excel or Google Sheets (one row per record) and save as <b>CSV</b>.</li>
          <li>Upload it here — you'll see a preview and any problems before anything is saved.</li>
        </ol>
        <label className="field-label">CSV file</label>
        <input className="input" type="file" accept=".csv,text/csv" onChange={onFile} />
        {fileName && problem && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{problem}</div>}
        <div style={{ marginTop: 18, fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Columns</div>
        <table className="table" style={{ marginTop: 6 }}>
          <thead><tr><th>Column</th><th>Required</th><th>What to enter</th><th>Example</th></tr></thead>
          <tbody>{columns.map((c, i) => (
            <tr key={c.key}>
              <td style={{ fontWeight: 600, color: "var(--ink)" }}>{c.label}</td>
              <td>{c.required ? <Badge tone="warn">Required</Badge> : <span style={{ color: "var(--muted)" }}>Optional</span>}</td>
              <td style={{ fontSize: 12.5 }}>{describe(c)}</td>
              <td className="font-mono" style={{ fontSize: 12 }}>{templateRows(columns, samples)[0][i] || "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </>}

      {rows && <>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <b style={{ fontSize: 13.5 }}>{fileName}</b>
          <Badge tone="success">{valid.length} ready</Badge>
          {invalid.length > 0 && <Badge tone="danger">{invalid.length} with problems — will be skipped</Badge>}
          <div style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={() => { setRows(null); setFileName(""); }} disabled={!!progress}>Choose another file</Btn>
        </div>
        {problem && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{problem}</div>}
        <div style={{ overflow: "auto", maxHeight: 420, border: "1px solid var(--line)", borderRadius: 10 }}>
          <table className="table">
            <thead><tr><th>Line</th>{columns.map(c => <th key={c.key}>{c.label}</th>)}<th>Check</th></tr></thead>
            <tbody>{shown.map(r => (
              <tr key={r.line}>
                <td className="font-mono">{r.line}</td>
                {columns.map(c => { const v = Object.entries(r.raw).find(([h]) => [c.label, c.key, ...(c.aliases || [])].map(norm).includes(norm(h.replace(/\*$/, ""))))?.[1]; return <td key={c.key} style={{ fontSize: 12.5 }}>{v || <span style={{ color: "var(--muted)" }}>—</span>}</td>; })}
                <td style={{ fontSize: 12, color: r.error ? "var(--danger)" : "var(--success)", minWidth: 180 }}>{r.error || "OK"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {rows.length > shown.length && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Showing problems first, then the first {shown.length} of {rows.length} rows.</div>}
      </>}

      {result && <div style={{ fontSize: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <Icon name="check" size={18} /><b>{result.added} record{result.added === 1 ? "" : "s"} added.</b>
          {result.failed.length > 0 && <Badge tone="danger">{result.failed.length} not imported</Badge>}
        </div>
        {result.logins.length > 0 && <div style={{ margin: "0 0 14px" }}>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>New sign-in details were created. Download them now — the passwords aren't shown again.</p>
          <Btn variant="accent" onClick={() => downloadCsv(`${base}-logins.csv`, Object.keys(result.logins[0]), result.logins.map(l => Object.values(l)))}><Icon name="file" size={13} />Download logins ({result.logins.length})</Btn>
        </div>}
        {result.failed.length > 0 && <>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Download the rows that weren't imported — the file has an <b>Error</b> column explaining each one. Fix them and upload that file again.</p>
          <Btn variant="accent" onClick={failedCsv}><Icon name="file" size={13} />Download rows to fix</Btn>
          <ul style={{ fontSize: 12.5, marginTop: 12, maxHeight: 200, overflow: "auto" }}>
            {result.failed.slice(0, 50).map(f => <li key={f.line}>Line {f.line}: {f.error}</li>)}
          </ul>
        </>}
      </div>}
    </Modal>
  );
}

// Button + modal in one, for page headers.
export function CsvImportButton({ label = "Import CSV", variant = "ghost", ...props }) {
  const [open, setOpen] = useState(false);
  return <>
    <Btn variant={variant} onClick={() => setOpen(true)}><Icon name="upload" size={13} />{label}</Btn>
    {open && <CsvImport {...props} onClose={() => setOpen(false)} />}
  </>;
}

// Lookup builder for "name or code" columns: loads a list and indexes each
// record by its label plus a few identifying fields.
export const lookupFrom = (load, label, keys = ["name", "code", "rollNo", "email", "employeeId", "title", "isbn"]) => async () => {
  const list = await load();
  return (Array.isArray(list) ? list : []).map(r => ({ value: r._id, label: label ? label(r) : r.name, keys: keys.map(k => r[k]), id: r.code || r.rollNo || r.employeeId || r.email || r.name }));
};
