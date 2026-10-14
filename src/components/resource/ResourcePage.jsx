import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionHeader, StatCard, Card, Badge, Btn, Icon, Modal, EmptyState } from "../ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { downloadCsv, fmt, humanize, statusMeta, toDateInput } from "../../lib/utils.js";
import { CsvImportButton } from "../CsvImport.jsx";
import SuggestionsButton from "../Suggestions.jsx";
import { CSV_SAMPLES } from "../../lib/csvSamples.js";

// Config-driven list + create/edit page for the ERP collections, which all
// share one REST shape (backend/src/utils/crudRouter.js). A module page
// describes its columns and form fields; this renders the stats row,
// search/filters, table, modal form, row actions and CSV export.
//
// field: { name, label, type, options, source, required, full, hint, default, createOnly, lineFields }
//   type    text | number | date | datetime | select | textarea | checkbox | lines
//   options ["a","b"] or [{ value, label }] for a select
//   source  { path, label(row) } — select options loaded from another collection
//   lines   repeatable rows of lineFields ([{ name, label, type, options }])
// column: { key, label, render(row), csv(row) } — or type: "status" | "date" | "money"
// Every page with a form also gets "Import CSV": the template, column guide
// and validation come from the same fields (field.sample / importSamples set
// the example row; field.noImport leaves a field out).

const optionList = opts => (opts || []).map(o => (typeof o === "string" ? { value: o, label: humanize(o) } : o));
const idOf = v => (v && typeof v === "object" ? v._id : v) ?? "";

function emptyForm(fields) {
  return Object.fromEntries(fields.map(f => [f.name, f.default ?? (f.type === "checkbox" ? false : f.type === "lines" ? [] : "")]));
}
function formFromRow(fields, row) {
  return Object.fromEntries(fields.map(f => {
    const v = row[f.name];
    if (f.type === "date") return [f.name, toDateInput(v)];
    if (f.type === "datetime") return [f.name, v ? new Date(new Date(v).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""];
    if (f.type === "lines") return [f.name, (v || []).map(x => ({ ...x }))];
    if (f.type === "checkbox") return [f.name, !!v];
    return [f.name, idOf(v) ?? ""];
  }));
}

export function FormField({ field, value, onChange, options }) {
  const set = v => onChange(field.name, v);
  const common = { className: "input", value: value ?? "", onChange: e => set(e.target.value) };
  let control;
  if (field.type === "select") {
    control = (
      <select {...common}>
        <option value="">{field.placeholder || "Select…"}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (field.type === "textarea") {
    control = <textarea {...common} rows={field.rows || 3} placeholder={field.placeholder} />;
  } else if (field.type === "checkbox") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, gridColumn: field.full ? "1 / -1" : undefined, cursor: "pointer" }}>
        <input type="checkbox" checked={!!value} onChange={e => set(e.target.checked)} />{field.label}
      </label>
    );
  } else if (field.type === "lines") {
    const rows = value || [];
    const patch = (i, k, v) => set(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
    control = (
      <div style={{ display: "grid", gap: 6 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 6 }}>
            {field.lineFields.map(lf => lf.options ? (
              <select key={lf.name} className="input" value={r[lf.name] ?? ""} onChange={e => patch(i, lf.name, e.target.value)}>
                {optionList(lf.options).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input key={lf.name} className="input" type={lf.type || "text"} min={lf.type === "number" ? 0 : undefined} placeholder={lf.label} value={r[lf.name] ?? ""} onChange={e => patch(i, lf.name, e.target.value)} />
            ))}
            <button type="button" className="icon-btn" onClick={() => set(rows.filter((_, j) => j !== i))}><Icon name="x" size={13} /></button>
          </div>
        ))}
        <Btn variant="ghost" onClick={() => set([...rows, Object.fromEntries(field.lineFields.map(lf => [lf.name, lf.default ?? ""]))])} style={{ width: "fit-content" }}>
          <Icon name="plus" size={13} />Add {field.lineLabel || "line"}
        </Btn>
      </div>
    );
  } else {
    control = <input {...common} type={field.type === "datetime" ? "datetime-local" : field.type || "text"} min={field.type === "number" ? (field.min ?? 0) : undefined} max={field.max} step={field.step} placeholder={field.placeholder} />;
  }
  return (
    <div style={{ gridColumn: field.full || field.type === "lines" || field.type === "textarea" ? "1 / -1" : undefined }}>
      <label className="field-label">{field.label}{field.required && <span style={{ color: "var(--danger)" }}> *</span>}</label>
      {control}
      {field.hint && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{field.hint}</div>}
    </div>
  );
}

// Loads select options for every field/filter that names a `source`.
export function useFieldSources(fields) {
  const { api } = useSession();
  const [sources, setSources] = useState({});
  const key = fields.filter(f => f.source).map(f => f.source.path).join("|");
  useEffect(() => {
    let cancelled = false;
    const wanted = fields.filter(f => f.source);
    Promise.all(wanted.map(f => api.call("GET", f.source.path).catch(() => []))).then(lists => {
      if (cancelled) return;
      setSources(Object.fromEntries(wanted.map((f, i) => [f.name, (Array.isArray(lists[i]) ? lists[i] : []).map(r => ({ value: r._id, label: f.source.label(r) }))])));
    });
    return () => { cancelled = true; };
  }, [api, key]);
  return f => (f.source ? sources[f.name] || [] : optionList(f.options));
}

export function validateForm(fields, form) {
  const missing = fields.find(f => f.required && (form[f.name] === "" || form[f.name] == null || (f.type === "lines" && !form[f.name].length)));
  return missing ? `${missing.label} is required` : null;
}
export function bodyFromForm(fields, form) {
  const body = {};
  for (const f of fields) {
    const v = form[f.name];
    if (f.type === "number") body[f.name] = v === "" ? null : Number(v);
    else if (f.type === "lines") body[f.name] = v.map(r => Object.fromEntries(f.lineFields.map(lf => [lf.name, lf.type === "number" ? Number(r[lf.name]) || 0 : r[lf.name]])));
    else body[f.name] = v;
  }
  return body;
}

export function renderCell(col, row, money) {
  if (col.render) return col.render(row);
  const v = col.key.split(".").reduce((o, k) => o?.[k], row);
  if (col.type === "status") { const m = statusMeta(v); return <Badge tone={m.tone}>{m.label}</Badge>; }
  if (col.type === "date") return fmt(v);
  if (col.type === "money") return money ? money(v) : v;
  if (col.type === "enum") return humanize(v);
  return v === undefined || v === null || v === "" ? "—" : String(v);
}
// Turns form fields into CsvImport columns. A select with a `source` is
// matched by its visible label or the record's name/code; "lines" fields are
// written as "Title=Amount; Title=Amount".
const sampleFor = f => {
  if (f.sample !== undefined) return f.sample;
  if (f.placeholder) return String(f.placeholder).replace(/^e\.g\.\s*/i, "");
  if (f.default !== undefined && f.default !== "") return f.type === "checkbox" ? (f.default ? "yes" : "no") : String(f.default);
  if (f.options) return optionList(f.options)[0]?.label ?? "";
  return { date: "2026-11-01", datetime: "2026-11-01 09:00", number: "1", checkbox: "no" }[f.type] ?? "";
};
export function importColumns(fields, api) {
  return fields.filter(f => !f.noImport).map(f => {
    const col = { key: f.name, label: f.label, required: !!f.required, sample: sampleFor(f), hint: f.importHint };
    if (f.type === "number") col.type = "number";
    else if (f.type === "date") col.type = "date";
    else if (f.type === "datetime") col.type = "datetime";
    else if (f.type === "checkbox") col.type = "boolean";
    else if (f.type === "select" && f.source) {
      col.lookup = async () => {
        const list = await api.call("GET", f.source.path);
        return (Array.isArray(list) ? list : []).map(r => ({ value: r._id, label: f.source.label(r), keys: [r.name, r.code, r.rollNo, r.email, r.employeeId, r.title, r.isbn, r.vehicleNo, r.roomNo], id: r.code || r.rollNo || r.employeeId || r.email || r.name || r.title || r.number }));
      };
      col.hint = f.importHint || `${f.label} — name or code as it appears in the app`;
    } else if (f.type === "select") col.options = optionList(f.options);
    else if (f.type === "lines") {
      // "Label=Amount": the first text part and the number part (or the
      // first two parts when none is a number, e.g. "09:00=12:00").
      const a = f.lineFields.find(lf => lf.type !== "number") || f.lineFields[0];
      const b = f.lineFields.find(lf => lf.type === "number" && lf !== a) || f.lineFields.find(lf => lf !== a);
      col.hint = f.importHint || `${a.label}=${b?.label || "value"}, separated by ; — e.g. Tuition=5000; Exam=1000`;
      col.parse = s => s.split(";").map(x => x.trim()).filter(Boolean).map(part => {
        const [x, y = ""] = part.split("=").map(v => v.trim());
        const line = Object.fromEntries(f.lineFields.map(lf => [lf.name, lf.default ?? ""]));
        line[a.name] = a.type === "number" ? Number(x) || 0 : x;
        if (b) {
          if (b.type === "number" && !Number.isFinite(Number(y))) throw new Error(`“${part}” needs a number after =`);
          line[b.name] = b.type === "number" ? Number(y) : y;
        }
        return line;
      });
    }
    return col;
  });
}

const csvCell = (col, row) => {
  if (col.csv) return col.csv(row);
  const v = col.key.split(".").reduce((o, k) => o?.[k], row);
  return col.type === "date" && v ? new Date(v).toISOString().slice(0, 10) : v;
};

export default function ResourcePage({
  eyebrow, title, base, columns, fields = [], filters = [], stats, searchable = true,
  canCreate = true, canEdit = true, canDelete = true, deleteLabel = "Delete",
  addLabel, rowActions, headerActions, money, embedded, emptyTitle, emptyDesc, exportName, reloadKey,
  importable = true, importSamples, importNote, importPrepare, suggestions,
}) {
  const { api } = useSession();
  const toast = useToast();
  const res = useMemo(() => api.resource(base), [api, base]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterValues, setFilterValues] = useState({});
  const [editing, setEditing] = useState(undefined); // undefined closed · null new · row = edit
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const optionsFor = useFieldSources([...fields, ...filters]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    Object.entries(filterValues).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [q, filterValues]);

  const reload = useCallback(() => {
    res.list(query).then(d => setRows(Array.isArray(d) ? d : [])).catch(e => toast(e.message, "alert")).finally(() => setLoading(false));
  }, [res, query]);
  // Debounced so typing in the search box doesn't fire a request per key.
  useEffect(() => { const t = setTimeout(reload, q ? 280 : 0); return () => clearTimeout(t); }, [reload, reloadKey]);

  const visibleFields = fields.filter(f => !(f.createOnly && editing));
  const open = row => { setForm(row ? formFromRow(fields, row) : emptyForm(fields)); setEditing(row); };

  const save = async () => {
    const problem = validateForm(visibleFields, form);
    if (problem) return toast(problem, "alert");
    setSaving(true);
    try {
      const body = bodyFromForm(visibleFields, form);
      if (editing) await res.update(editing._id, body); else await res.create(body);
      toast(editing ? "Saved" : "Added", "check");
      setEditing(undefined);
      reload();
    } catch (e) { toast(e.message, "alert"); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm(`${deleteLabel} this record? This can't be undone.`)) return;
    setSaving(true);
    try { await res.remove(editing._id); toast("Done", "check"); setEditing(undefined); reload(); }
    catch (e) { toast(e.message, "alert"); }
    finally { setSaving(false); }
  };

  const ctx = { reload, toast, api, edit: open };
  const statItems = stats ? stats(rows) : [];
  const actions = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {headerActions?.(ctx)}
      {rows.length > 0 && (
        <Btn variant="ghost" onClick={() => downloadCsv(`${exportName || title || "export"}.csv`.toLowerCase().replace(/\s+/g, "-"), columns.map(c => c.label), rows.map(r => columns.map(c => csvCell(c, r))))}>
          <Icon name="file" size={13} />Export CSV
        </Btn>
      )}
      {canCreate && suggestions && (
        <SuggestionsButton title={suggestions.title || `Suggested ${(title || "records").toLowerCase()}`} catalog={suggestions.catalog} note={suggestions.note}
          existing={rows.flatMap(r => [r.name, r.code, r.title])} match={suggestions.match}
          submit={d => res.create({ ...emptyForm(fields), ...d })} onDone={reload} />
      )}
      {canCreate && importable && fields.length > 0 && (
        <CsvImportButton title={`Import ${title || "records"} from CSV`} filename={exportName || title} columns={importColumns(fields, api)}
          samples={importSamples || CSV_SAMPLES[base.split("?")[0]]} note={importNote} prepare={importPrepare}
          submit={row => res.create(Object.fromEntries(fields.map(f => [f.name, row[f.name] ?? (f.type === "lines" ? [] : f.type === "checkbox" ? !!f.default : f.default ?? (f.type === "number" ? null : ""))])))}
          onDone={reload} />
      )}
      {canCreate && fields.length > 0 && <Btn variant="accent" onClick={() => open(null)}><Icon name="plus" size={13} />{addLabel || "Add"}</Btn>}
    </div>
  );

  return (
    <>
      {!embedded && <SectionHeader eyebrow={eyebrow} title={title} action={actions} />}
      {statItems.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
          {statItems.map(s => <StatCard key={s.label} label={s.label} value={loading ? "…" : s.value} icon={s.icon} />)}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {searchable && (
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 340 }}>
            <span style={{ position: "absolute", left: 11, top: 9, color: "var(--muted)" }}><Icon name="search" size={15} /></span>
            <input className="input" placeholder="Search…" style={{ paddingLeft: 34 }} value={q} onChange={e => setQ(e.target.value)} />
          </div>
        )}
        {filters.map(f => (
          <select key={f.name} className="input" style={{ width: "auto" }} value={filterValues[f.name] || ""} onChange={e => setFilterValues(p => ({ ...p, [f.name]: e.target.value }))}>
            <option value="">{f.label}: all</option>
            {optionsFor(f).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        {embedded && <><div style={{ flex: 1 }} />{actions}</>}
      </div>

      <Card style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead><tr>{columns.map(c => <th key={c.label}>{c.label}</th>)}{rowActions && <th />}</tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row._id} className={canEdit && fields.length ? "clickable" : ""} onClick={() => canEdit && fields.length && open(row)}>
                {columns.map((c, i) => <td key={c.label} style={i === 0 ? { fontWeight: 600, color: "var(--ink)" } : undefined}>{renderCell(c, row, money)}</td>)}
                {rowActions && (
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      {rowActions(row, ctx).filter(Boolean).map(a => (
                        <Btn key={a.label} variant={a.variant || "ghost"} onClick={a.onClick} style={{ padding: "5px 10px", fontSize: 12 }}>
                          {a.icon && <Icon name={a.icon} size={12} />}{a.label}
                        </Btn>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}
        {!loading && rows.length === 0 && (
          <EmptyState icon="clipboard" title={query ? "Nothing matches your search" : emptyTitle || "Nothing here yet"} desc={query ? "Try a different search or clear the filters." : emptyDesc} />
        )}
      </Card>

      {editing !== undefined && (
        <Modal wide title={editing ? `Edit ${addLabel?.replace(/^Add\s+/i, "") || "record"}` : addLabel || "Add"} onClose={() => setEditing(undefined)} footer={<>
          {editing && canDelete && <Btn variant="danger" onClick={remove} disabled={saving}><Icon name="x" size={13} />{deleteLabel}</Btn>}
          <div style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={() => setEditing(undefined)}>Cancel</Btn>
          <Btn variant="accent" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
        </>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {visibleFields.map(f => <FormField key={f.name} field={f} value={form[f.name]} options={optionsFor(f)} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} />)}
          </div>
        </Modal>
      )}
    </>
  );
}
