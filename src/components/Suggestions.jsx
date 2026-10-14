import { useMemo, useState } from "react";
import { Badge, Btn, Icon, Modal, Tabs } from "./ui/index.js";
import { useSettings } from "../context/SettingsContext.jsx";

// "Suggestions" picker: a ready-made list (see lib/suggestions.js) shown as
// chips grouped by heading. The admin taps the ones they want — or "Select
// all" on a group — and adds them in one go. Anything that already exists is
// shown ticked and can't be added twice.
//
// catalog   [{ label, items: [{ label, sub, data }] }], or { school, college,
//           university } of those — picked by the institute type, switchable
// existing  strings already in use (names, codes…); an item whose label or
//           match keys hit one of them is shown as "Added"
// match     item => [keys] (default: label and data.code)
// submit    async (data, options) => any — creates one item
// options   [{ key, label, default }] — checkboxes passed to submit

const norm = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const LEVELS = [{ key: "school", label: "School" }, { key: "college", label: "College" }, { key: "university", label: "University" }];

function SuggestionsModal({ title, note, catalog, existing = [], match, submit, options = [], onClose, onDone }) {
  const { settings } = useSettings();
  const leveled = !Array.isArray(catalog);
  const [level, setLevel] = useState(leveled && catalog[settings.instituteType] ? settings.instituteType : "school");
  const groups = leveled ? catalog[level] || [] : catalog;
  const [picked, setPicked] = useState(() => new Set());
  const [opts, setOpts] = useState(() => Object.fromEntries(options.map(o => [o.key, o.default ?? true])));
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  const have = useMemo(() => new Set(existing.filter(Boolean).map(norm)), [existing]);
  const keysOf = item => (match ? match(item) : [item.label, item.data?.code]).filter(Boolean).map(norm);
  const exists = item => keysOf(item).some(k => have.has(k));
  const id = (g, i) => `${level}:${g}:${i}`;
  const all = groups.flatMap((g, gi) => g.items.map((item, i) => ({ item, key: id(gi, i) })));
  const chosen = all.filter(x => picked.has(x.key) && !exists(x.item));

  const toggle = key => setPicked(p => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const setGroup = (gi, on) => setPicked(p => {
    const n = new Set(p);
    groups[gi].items.forEach((item, i) => { if (!exists(item)) on ? n.add(id(gi, i)) : n.delete(id(gi, i)); });
    return n;
  });

  const add = async () => {
    setProgress({ done: 0, total: chosen.length });
    const failed = []; let added = 0;
    for (const { item } of chosen) { // one at a time, in list order (Class 1 before Class 2)
      try { await submit(item.data, opts); added++; }
      catch (e) { failed.push(`${item.label}: ${e.message}`); }
      setProgress(p => ({ ...p, done: p.done + 1 }));
    }
    setProgress(null); setPicked(new Set());
    setResult({ added, failed });
    if (added) onDone?.();
  };

  return (
    <Modal wide title={title} onClose={progress ? () => {} : onClose} footer={<>
      {!result && <span style={{ fontSize: 13, color: "var(--muted)" }}>{chosen.length ? `${chosen.length} selected` : "Tap items to select them"}</span>}
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" onClick={onClose} disabled={!!progress}>{result ? "Close" : "Cancel"}</Btn>
      {result ? <Btn variant="accent" onClick={() => setResult(null)}>Add more</Btn>
        : <Btn variant="accent" onClick={add} disabled={!chosen.length || !!progress}>
          <Icon name="plus" size={13} />{progress ? `Adding ${progress.done} / ${progress.total}…` : `Add ${chosen.length || ""} selected`}
        </Btn>}
    </>}>
      {result ? (
        <div style={{ fontSize: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}><Icon name="check" size={18} /><b>{result.added} added.</b>
            {result.failed.length > 0 && <Badge tone="danger">{result.failed.length} not added</Badge>}</div>
          {result.failed.length > 0 && <ul style={{ fontSize: 12.5, color: "var(--muted)" }}>{result.failed.map(f => <li key={f}>{f}</li>)}</ul>}
        </div>
      ) : <>
        {note && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>{note}</p>}
        {leveled && <Tabs items={LEVELS.filter(l => catalog[l.key])} active={level} onChange={l => { setLevel(l); setPicked(new Set()); }} style={{ marginBottom: 14 }} />}
        {options.length > 0 && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
            {options.map(o => (
              <label key={o.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={!!opts[o.key]} onChange={e => setOpts(p => ({ ...p, [o.key]: e.target.checked }))} />{o.label}
              </label>
            ))}
          </div>
        )}
        <div style={{ display: "grid", gap: 18 }}>
          {groups.map((g, gi) => {
            const open = g.items.filter(item => !exists(item));
            const allOn = open.length > 0 && g.items.every((item, i) => exists(item) || picked.has(id(gi, i)));
            return (
              <div key={g.label}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".03em" }}>{g.label}</div>
                  {open.length > 0 && <button type="button" onClick={() => setGroup(gi, !allOn)} style={{ fontSize: 12, color: "var(--accent-ink, var(--accent))", background: "none", border: 0, cursor: "pointer", padding: 0 }}>{allOn ? "Clear" : "Select all"}</button>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {g.items.map((item, i) => {
                    const done = exists(item), on = picked.has(id(gi, i));
                    return (
                      <button key={i} type="button" disabled={done} onClick={() => toggle(id(gi, i))} title={done ? "Already added" : item.sub}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, fontSize: 13, cursor: done ? "default" : "pointer",
                          border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                          background: on ? "var(--accent-soft)" : done ? "var(--surface-alt)" : "transparent",
                          color: done ? "var(--muted)" : on ? "var(--accent-ink, var(--ink))" : "var(--ink)", fontWeight: on ? 600 : 500,
                        }}>
                        {(on || done) && <Icon name="check" size={12} />}
                        {item.label}
                        {item.sub && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>{done ? "added" : item.sub}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </>}
    </Modal>
  );
}

export default function SuggestionsButton({ label = "Suggestions", ...props }) {
  const [open, setOpen] = useState(false);
  return <>
    <Btn variant="ghost" onClick={() => setOpen(true)}><Icon name="bulb" size={13} />{label}</Btn>
    {open && <SuggestionsModal {...props} onClose={() => setOpen(false)} />}
  </>;
}
