import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, Badge, Btn, Icon, EmptyState, Modal, Tabs, ProgressBar } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { downloadCsv, fmt, html, printDocument } from "../../lib/utils.js";
import { useLoad, useAction } from "./hooks.js";
import { CsvImportButton } from "../../components/CsvImport.jsx";

const gpa = v => (v == null ? "—" : Number(v).toFixed(2));

// ═══════════════════════════ TRANSCRIPT (shared) ═══════════════════════════
export function printTranscript(student, t, settings) {
  const enrollment = student.currentEnrollment;
  printDocument(`Transcript — ${student.name}`, html`
    <h2>Academic Transcript</h2>
    <div class="meta">
      <div><span>Name:</span> <strong>${student.name}</strong></div><div><span>Roll No:</span> ${student.rollNo}</div>
      <div><span>Registration No:</span> ${student.registrationNo || "—"}</div><div><span>Program:</span> ${enrollment?.program?.name || "—"}</div>
    </div>
    ${t.terms.map(term => html`
      <h3>${term.session?.name || "Session"}${term.section?.name ? ` — Section ${term.section.name}` : ""}</h3>
      <table>
        <tr><th>Code</th><th>Course</th><th class="r">Cr. Hrs</th><th class="r">Marks %</th><th>Grade</th><th class="r">Grade Pts</th></tr>
        ${term.courses.map(c => html`<tr><td>${c.subject?.code || ""}</td><td>${c.subject?.name || ""}</td><td class="r">${c.creditHours}</td><td class="r">${c.percentage}</td><td>${c.grade}</td><td class="r">${Number(c.gradePoint).toFixed(2)}</td></tr>`)}
        <tr class="total"><td colspan="2">Term GPA</td><td class="r">${term.credits}</td><td colspan="2"></td><td class="r">${gpa(term.gpa)}</td></tr>
      </table>`)}
    <table><tr class="total"><td>Cumulative GPA (CGPA)</td><td class="r">${gpa(t.cgpa)}</td><td>Credit hours attempted</td><td class="r">${t.totalCredits}</td><td>Credit hours earned</td><td class="r">${t.creditsEarned}</td></tr></table>
    <div class="sign"><div>Controller of Examinations</div><div>${settings.registrarName ? `${settings.registrarName}, ` : ""}Registrar</div></div>
    <div class="foot">Issued ${fmt(new Date())}. Grading scale: ${t.gradingScheme.map(g => `${g.grade} ≥ ${g.min}% (${g.points})`).join(" · ")}</div>`, { institute: settings });
}

export function TranscriptView({ transcript: t, student, emptyDesc }) {
  const { settings } = useSettings();
  if (!t) return null;
  if (!t.terms.length) return <Card style={{ padding: 24 }}><EmptyState icon="grad" title="No results published yet" desc={emptyDesc || "Results appear here once the examinations office publishes them."} /></Card>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
        <StatCard label="CGPA" value={gpa(t.cgpa)} icon="award" />
        <StatCard label="Credit Hours Earned" value={`${t.creditsEarned} / ${t.totalCredits}`} icon="book" />
        <StatCard label="Terms" value={t.terms.length} icon="calendar" />
        <StatCard label="Courses Failed" value={t.failed} icon="alert" />
      </div>
      {t.degree && (
        <Card style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
            <strong>Degree progress — {t.degree.program}</strong>
            <span style={{ color: "var(--ink-soft)" }}>{t.degree.earned} of {t.degree.requiredCredits} credit hours · {t.degree.remaining} to go</span>
          </div>
          <ProgressBar pct={t.degree.percent} />
        </Card>
      )}
      {student && <div><Btn variant="ghost" onClick={() => printTranscript(student, t, settings)}><Icon name="printer" size={13} />Print Transcript</Btn></div>}
      {t.terms.map(term => (
        <Card key={term.session?._id || "x"} style={{ padding: 0, overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{term.session?.name || "Session"} <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {term.program?.name}{term.section?.name ? ` · ${term.section.name}` : ""}</span></div>
            <Badge tone="accent">Term GPA {gpa(term.gpa)}</Badge>
          </div>
          <table className="table">
            <thead><tr><th>Course</th><th>Credit Hrs</th><th>Marks</th><th>Grade</th><th>Grade Points</th><th>Remarks</th></tr></thead>
            <tbody>{term.courses.map(c => (
              <tr key={c._id}>
                <td style={{ fontWeight: 600, color: "var(--ink)" }}>{c.subject?.name}<span style={{ color: "var(--muted)", fontWeight: 400 }}> {c.subject?.code}</span>{!c.published && <> <Badge tone="warn">Draft</Badge></>}</td>
                <td>{c.creditHours}</td><td>{c.percentage}%</td><td><strong>{c.grade}</strong></td><td>{Number(c.gradePoint).toFixed(2)}</td><td>{c.remarks || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════ ADMIN: EXAMINATIONS OFFICE ════════════════════
function ClassResultsModal({ row, onClose }) {
  const [data, , loading] = useLoad(`/api/results/class-admin/${row.assignment._id}`);
  const comps = data?.components || [];
  return (
    <Modal wide title={`${row.assignment.subject?.name} — ${row.assignment.section?.name}`} onClose={onClose} footer={
      <Btn variant="ghost" disabled={!data?.results?.length} onClick={() => downloadCsv(`results-${row.assignment.subject?.code || "class"}.csv`, ["Roll No", "Student", ...comps.map(c => `${c.name} /${c.max}`), "%", "Grade", "GP"], data.results.map(r => [r.student?.rollNo, r.student?.name, ...comps.map(c => r.marks?.[c.name] ?? ""), r.percentage, r.grade, r.gradePoint]))}>
        <Icon name="file" size={13} />Export CSV</Btn>}>
      {loading ? <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading…</div> : !data?.results?.length ? <EmptyState icon="grad" title="No marks entered yet" /> : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Student</th>{comps.map(c => <th key={c.name}>{c.name} <span style={{ fontWeight: 400 }}>/{c.max}</span></th>)}<th>%</th><th>Grade</th></tr></thead>
            <tbody>{data.results.map(r => (
              <tr key={r._id}><td style={{ fontWeight: 600, color: "var(--ink)" }}>{r.student?.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>#{r.student?.rollNo}</span></td>
                {comps.map(c => <td key={c.name}>{r.marks?.[c.name] ?? "—"}</td>)}<td>{r.percentage}</td><td><strong>{r.grade}</strong></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

export function ExamOfficePage() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [tab, setTab] = useState("classes");
  const [sessions] = useLoad("/api/academic-sessions", []);
  const [session, setSession] = useState("");
  const [rows, reload, loading] = useLoad(`/api/results/overview${session ? `?academicSession=${session}` : ""}`, []);
  const [viewing, setViewing] = useState(null);
  const [sections] = useLoad("/api/sections", []);
  const [meritSection, setMeritSection] = useState("");
  const [merit, , meritLoading] = useLoad(meritSection ? `/api/results/merit?section=${meritSection}` : null, []);

  const list = rows || [];
  const withMarks = list.filter(r => r.entered > 0);
  const publish = (r, published) => run(() => api.call("POST", "/api/results/publish", { teacherAssignment: r.assignment._id, published }), published ? "Results published to students" : "Results unpublished").then(reload);
  const publishAll = () => session && window.confirm("Publish every class with marks in this session? Students and parents will see them immediately.") &&
    run(() => api.call("POST", "/api/results/publish", { academicSession: session, published: true }), o => `${o.updated} result(s) published`).then(reload);

  return (
    <>
      <SectionHeader eyebrow="Examinations" title="Results & Grading" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Classes" value={loading ? "…" : list.length} icon="layers" />
        <StatCard label="Marks Entered" value={loading ? "…" : withMarks.length} icon="clipboard" />
        <StatCard label="Published" value={loading ? "…" : list.filter(r => r.published).length} icon="check" />
        <StatCard label="Awaiting Publication" value={loading ? "…" : withMarks.filter(r => !r.published).length} icon="clock" />
      </div>
      <Tabs items={[{ key: "classes", label: "Class Results" }, { key: "merit", label: "Merit List" }]} active={tab} onChange={setTab} style={{ marginBottom: 16 }} />

      {tab === "classes" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <select className="input" style={{ width: "auto" }} value={session} onChange={e => setSession(e.target.value)}>
              <option value="">All sessions</option>{(sessions || []).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            <div style={{ flex: 1 }} />
            <Btn variant="accent" disabled={!session || busy} onClick={publishAll}><Icon name="check" size={13} />Publish Whole Session</Btn>
          </div>
          <Card style={{ padding: 0, overflow: "auto" }}>
            <table className="table">
              <thead><tr><th>Subject</th><th>Class</th><th>Teacher</th><th>Entered</th><th>Average</th><th>Range</th><th>Pass Rate</th><th>Status</th><th /></tr></thead>
              <tbody>{list.map(r => (
                <tr key={r.assignment._id}>
                  <td style={{ fontWeight: 600, color: "var(--ink)" }}>{r.assignment.subject?.name}</td>
                  <td>{r.assignment.program?.code} · {r.assignment.section?.name}</td><td>{r.assignment.teacher?.name || "—"}</td>
                  <td>{r.entered}</td><td>{r.average != null ? `${r.average}%` : "—"}</td><td>{r.entered ? `${r.low}–${r.top}%` : "—"}</td><td>{r.passRate != null ? `${r.passRate}%` : "—"}</td>
                  <td>{!r.entered ? <Badge tone="neutral">No marks</Badge> : r.published ? <Badge tone="success">Published</Badge> : <Badge tone="warn">Draft</Badge>}</td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    {r.entered > 0 && <Btn variant="ghost" style={{ padding: "5px 10px", fontSize: 12, marginRight: 6 }} onClick={() => setViewing(r)}>View</Btn>}
                    {r.entered > 0 && <Btn variant={r.published ? "ghost" : "accent"} style={{ padding: "5px 10px", fontSize: 12 }} disabled={busy} onClick={() => publish(r, !r.published)}>{r.published ? "Unpublish" : "Publish"}</Btn>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {!loading && list.length === 0 && <EmptyState icon="award" title="No classes yet" desc="Results are entered per class by the assigned teacher — create teacher assignments first." />}
          </Card>
        </>
      )}

      {tab === "merit" && (
        <>
          <select className="input" style={{ width: "auto", marginBottom: 14 }} value={meritSection} onChange={e => setMeritSection(e.target.value)}>
            <option value="">Choose a section…</option>
            {(sections || []).map(s => <option key={s._id} value={s._id}>{s.program?.name ? `${s.program.name} — ` : ""}{s.name}</option>)}
          </select>
          <Card style={{ padding: 0, overflow: "auto" }}>
            {!meritSection ? <EmptyState icon="award" title="Pick a section" desc="Students are ranked by GPA across every course they have marks in." /> :
              meritLoading ? <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading…</div> :
              !(merit || []).length ? <EmptyState icon="award" title="No results for this section yet" /> : (
                <table className="table">
                  <thead><tr><th>Rank</th><th>Student</th><th>Roll No</th><th>Courses</th><th>Average</th><th>GPA</th></tr></thead>
                  <tbody>{merit.map(m => (
                    <tr key={m.student._id}><td><Badge tone={m.rank <= 3 ? "accent" : "neutral"}>#{m.rank}</Badge></td>
                      <td style={{ fontWeight: 600, color: "var(--ink)" }}>{m.student.name}</td><td>{m.student.rollNo}</td><td>{m.courses}</td><td>{m.average}%</td><td><strong>{gpa(m.gpa)}</strong></td></tr>
                  ))}</tbody>
                </table>
              )}
          </Card>
        </>
      )}
      {viewing && <ClassResultsModal row={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

export function TranscriptsPage() {
  const [students] = useLoad("/api/students", []);
  const [id, setId] = useState("");
  const [draft, setDraft] = useState(false);
  const [data, , loading] = useLoad(id ? `/api/results/transcript/${id}${draft ? "?includeDraft=1" : ""}` : null);
  return (
    <>
      <SectionHeader eyebrow="Examinations" title="Transcripts" />
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <select className="input" style={{ maxWidth: 360 }} value={id} onChange={e => setId(e.target.value)}>
          <option value="">Choose a student…</option>{(students || []).map(s => <option key={s._id} value={s._id}>{s.name} · #{s.rollNo}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={draft} onChange={e => setDraft(e.target.checked)} />Include unpublished (draft) results</label>
      </div>
      {!id ? <Card style={{ padding: 24 }}><EmptyState icon="grad" title="Select a student" desc="View and print the official transcript with term GPA and CGPA." /></Card>
        : loading || !data ? <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
        : <TranscriptView transcript={data} student={data.student} emptyDesc="No results on record for this student." />}
    </>
  );
}

// ═══════════════════════════ TEACHER: GRADEBOOK TAB ════════════════════════
export function GradebookTab({ cls }) {
  const { api } = useSession();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [components, setComponents] = useState([]);
  const [marks, setMarks] = useState({}); // studentId → { component: value }
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editScheme, setEditScheme] = useState(false);

  const load = () => api.call("GET", `/api/results/class/${cls._id}`).then(d => {
    setData(d);
    setComponents(d.components.map(c => ({ ...c })));
    setMarks(Object.fromEntries(d.rows.map(r => [r.student._id, { ...(r.result?.marks || {}) }])));
    setDirty(false);
  }).catch(e => toast(e.message, "alert"));
  useEffect(() => { load(); }, [cls._id]);

  if (!data) return <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>;
  const locked = data.published;
  const setMark = (sid, name, value) => { setMarks(p => ({ ...p, [sid]: { ...p[sid], [name]: value } })); setDirty(true); };
  const invalid = (name, value) => value !== "" && value != null && (Number(value) < 0 || Number(value) > (components.find(c => c.name === name)?.max ?? Infinity));
  const hasInvalid = data.rows.some(r => components.some(c => invalid(c.name, marks[r.student._id]?.[c.name])));

  const save = async () => {
    setSaving(true);
    try {
      await api.call("PUT", `/api/results/class/${cls._id}`, { components, rows: data.rows.map(r => ({ student: r.student._id, marks: marks[r.student._id] || {} })) });
      toast("Gradebook saved", "check");
      setEditScheme(false);
      await load();
    } catch (e) { toast(e.message, "alert"); }
    finally { setSaving(false); }
  };
  const patchComp = (i, k, v) => { setComponents(p => p.map((c, j) => (j === i ? { ...c, [k]: v } : c))); setDirty(true); };
  const totalWeight = components.reduce((s, c) => s + (Number(c.weight) || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Gradebook {locked && <Badge tone="success">Published</Badge>}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {locked ? "These results are published and locked. Ask the examinations office to unpublish them to make changes."
                : "Grade and GPA are calculated from the marks entered so far. Students see nothing until the examinations office publishes."}
            </div>
          </div>
          {!locked && (
            <div style={{ display: "flex", gap: 8 }}>
              <CsvImportButton label="Import marks" title="Import marks from CSV" filename={`marks-${cls.subject?.code || "class"}-${cls.section?.name || ""}`}
                note={`The template is your current gradebook — one row per student, one column per assessment (${data.components.map(c => `${c.name} out of ${c.max}`).join(", ")}). Marks fill the gradebook below — check them, then click Save Marks.`}
                columns={[
                  { key: "student", label: "Roll No", required: true, aliases: ["rollNumber", "student"], lookup: async () => data.rows.map(r => ({ value: r.student._id, label: r.student.rollNo, keys: [r.student.name] })) },
                  { key: "name", label: "Student Name", hint: "Optional — for your reference only" },
                  ...data.components.map(c => ({ key: `m:${c.name}`, label: c.name, type: "number", hint: `Marks out of ${c.max} — leave empty to keep what's entered`,
                    parse: v => { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > c.max) throw new Error(`must be 0–${c.max}`); return n; } })),
                ]}
                samples={data.rows.map(r => ({ student: r.student.rollNo, name: r.student.name, ...Object.fromEntries(data.components.map(c => [`m:${c.name}`, marks[r.student._id]?.[c.name] ?? ""])) }))}
                concurrency={1}
                submit={async row => {
                  const entered = Object.fromEntries(data.components.filter(c => row[`m:${c.name}`] !== undefined).map(c => [c.name, String(row[`m:${c.name}`])]));
                  setMarks(p => ({ ...p, [row.student]: { ...p[row.student], ...entered } }));
                  setDirty(true);
                }} />
              <Btn variant="ghost" onClick={() => setEditScheme(p => !p)}><Icon name="settings" size={13} />Assessment Scheme</Btn>
              <Btn variant="accent" onClick={save} disabled={saving || !dirty || hasInvalid}>{saving ? "Saving…" : "Save Marks"}</Btn>
            </div>
          )}
        </div>
        {editScheme && !locked && (
          <div style={{ marginTop: 16, display: "grid", gap: 8, maxWidth: 520 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 34px", gap: 8, fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}><span>Component</span><span>Max marks</span><span>Weight</span><span /></div>
            {components.map((c, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 34px", gap: 8 }}>
                <input className="input" value={c.name} onChange={e => patchComp(i, "name", e.target.value)} />
                <input className="input" type="number" min="1" value={c.max} onChange={e => patchComp(i, "max", e.target.value)} />
                <input className="input" type="number" min="0" value={c.weight} onChange={e => patchComp(i, "weight", e.target.value)} />
                <button className="icon-btn" onClick={() => { setComponents(p => p.filter((_, j) => j !== i)); setDirty(true); }}><Icon name="x" size={13} /></button>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Btn variant="ghost" onClick={() => { setComponents(p => [...p, { name: "", max: 10, weight: 10 }]); setDirty(true); }}><Icon name="plus" size={13} />Add component</Btn>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Total weight {totalWeight} — weights are relative, they don't have to add up to 100. Renaming or removing a component discards the marks entered under it.</span>
            </div>
          </div>
        )}
      </Card>
      <Card style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead><tr><th>Student</th>{data.components.map(c => <th key={c.name}>{c.name} <span style={{ fontWeight: 400 }}>/{c.max}</span></th>)}<th>%</th><th>Grade</th></tr></thead>
          <tbody>{data.rows.map(r => (
            <tr key={r.student._id}>
              <td style={{ fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>{r.student.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>#{r.student.rollNo}</span></td>
              {data.components.map(c => {
                const v = marks[r.student._id]?.[c.name] ?? "";
                return <td key={c.name}><input className={"input grade-input" + (invalid(c.name, v) ? " err" : "")} type="number" min="0" max={c.max} step="0.5" disabled={locked} value={v} onChange={e => setMark(r.student._id, c.name, e.target.value)} /></td>;
              })}
              <td>{r.result ? `${r.result.percentage}%` : "—"}</td><td><strong>{r.result?.grade || "—"}</strong></td>
            </tr>
          ))}</tbody>
        </table>
        {data.rows.length === 0 && <EmptyState icon="users" title="No students in this section yet" />}
      </Card>
      {hasInvalid && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>Some marks are above the component maximum — fix the highlighted cells to save.</div>}
    </div>
  );
}

// ═══════════════════════════ STUDENT ═══════════════════════════════════════
export function MyTranscript() {
  const { session } = useSession();
  const [data, , loading] = useLoad("/api/results/mine");
  if (loading) return <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>;
  return <TranscriptView transcript={data} student={session.student} />;
}
