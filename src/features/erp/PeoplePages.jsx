import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ResourcePage from "../../components/resource/ResourcePage.jsx";
import { SectionHeader, StatCard, Card, Badge, Btn, Icon, EmptyState, Avatar, Tabs, Modal, Chain, ProgressBar } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { downloadCsv, fmt, html, humanize, parseCsv, printDocument, statusMeta, toDateInput } from "../../lib/utils.js";
import { useLoad, useAction, STUDENT_SOURCE } from "./hooks.js";
import { getInstitute } from "../../lib/api.js";
import { TranscriptView } from "./ResultsPages.jsx";

// ═══════════════════════════ STUDENT 360 ═══════════════════════════════════
const PROFILE = [
  ["phone", "Phone"], ["dob", "Date of Birth", "date"], ["gender", "Gender", ["male", "female", "other"]], ["bloodGroup", "Blood Group"], ["nationalId", "National ID / B-Form"],
  ["city", "City"], ["emergencyContact", "Emergency Contact"], ["admissionDate", "Admission Date", "date"], ["previousInstitute", "Previous Institute"], ["parentName", "Parent / Guardian"],
  ["registrationNo", "Registration No"], ["lifecycleStatus", "Status", ["active", "graduated", "suspended", "withdrawn", "expelled"]], ["address", "Address"],
];

function ProfileModal({ student, onClose, onSaved }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [form, setForm] = useState(Object.fromEntries(PROFILE.map(([k, , t]) => [k, t === "date" ? toDateInput(student[k]) : student[k] ?? ""])));
  return (
    <Modal wide title={`Edit profile — ${student.name}`} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" disabled={busy} onClick={() => run(() => api.call("PATCH", `/api/lifecycle/students/${student._id}/profile`, form), "Profile updated").then(r => r && onSaved())}>Save</Btn>
    </>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
        {PROFILE.map(([k, label, t]) => (
          <div key={k} style={{ gridColumn: k === "address" ? "1 / -1" : undefined }}>
            <label className="field-label">{label}</label>
            {Array.isArray(t)
              ? <select className="input" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}>{k === "gender" && <option value="">—</option>}{t.map(o => <option key={o} value={o}>{humanize(o)}</option>)}</select>
              : <input className="input" type={t || "text"} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function Student360Page() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { money } = useSettings();
  const [students] = useLoad(id ? null : "/api/students", []);
  const [data, reload, loading] = useLoad(id ? `/api/lifecycle/students/${id}/360` : null);
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState("");

  if (!id) {
    const needle = q.trim().toLowerCase();
    const shown = (students || []).filter(s => !needle || `${s.name} ${s.rollNo} ${s.email || ""}`.toLowerCase().includes(needle)).slice(0, 60);
    return (
      <>
        <SectionHeader eyebrow="People" title="Student 360" />
        <input className="input" style={{ maxWidth: 380, marginBottom: 16 }} placeholder="Find a student by name or roll no…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
          {shown.map(s => (
            <Card key={s._id} style={{ padding: 14, cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }} onClick={() => navigate(`/admin/student360/${s._id}`)}>
              <Avatar name={s.name} size={38} img={s.photo || undefined} />
              <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>#{s.rollNo}</div></div>
            </Card>
          ))}
        </div>
        {students && shown.length === 0 && <Card style={{ padding: 24 }}><EmptyState icon="users" title="No students found" /></Card>}
      </>
    );
  }
  if (loading || !data) return <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>;

  const { student: s, attendance, fees, transcript } = data;
  const enr = s.currentEnrollment;
  const life = statusMeta(s.lifecycleStatus || "active");
  const TABS = [
    { key: "overview", label: "Overview" }, { key: "academics", label: "Results" }, { key: "attendance", label: "Attendance" },
    { key: "fees", label: `Fees${fees.balance > 0 ? " •" : ""}` }, { key: "records", label: `Records (${data.records.length})` }, { key: "history", label: "History" },
  ];
  const Simple = ({ head, rows, empty }) => rows.length === 0 ? <div style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>{empty}</div> : (
    <table className="table"><thead><tr>{head.map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
  );

  return (
    <>
      <Btn variant="ghost" onClick={() => navigate("/admin/student360")} style={{ marginBottom: 14 }}><Icon name="arrowLeft" size={14} />All students</Btn>
      <Card style={{ padding: 20, marginBottom: 16, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <Avatar name={s.name} size={64} img={s.photo || undefined} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="font-display" style={{ fontSize: 22, fontWeight: 600 }}>{s.name} <Badge tone={life.tone}>{life.label}</Badge></div>
          <div style={{ fontSize: 13, color: "var(--muted)", margin: "3px 0 8px" }}>Roll #{s.rollNo}{s.email ? ` · ${s.email}` : ""}</div>
          {enr ? <Chain items={[enr.program?.name, enr.section?.name, enr.academicSession?.name]} /> : <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Not currently enrolled in a section</span>}
        </div>
        <Btn variant="ghost" onClick={() => setEditing(true)}><Icon name="settings" size={13} />Edit Profile</Btn>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 16 }}>
        <StatCard label="CGPA" value={transcript.cgpa != null ? transcript.cgpa.toFixed(2) : "—"} icon="award" />
        <StatCard label="Attendance" value={attendance.rate != null ? `${attendance.rate}%` : "—"} icon="clipboard" />
        <StatCard label="Fee Balance" value={money(fees.balance)} icon="dollar" />
        <StatCard label="Books on Loan" value={data.loans.filter(l => l.status === "issued").length} icon="library" />
      </div>
      <Tabs items={TABS} active={tab} onChange={setTab} style={{ marginBottom: 16 }} />

      {tab === "overview" && (
        <div style={{ display: "grid", gap: 16 }}>
          <Card style={{ padding: 18 }}>
            <div className="kv">
              {PROFILE.filter(([k]) => k !== "lifecycleStatus").map(([k, label, t]) => <div key={k}><div className="k">{label}</div><div className="v">{t === "date" ? fmt(s[k]) : Array.isArray(t) ? humanize(s[k]) : s[k] || "—"}</div></div>)}
              <div><div className="k">Parent Record</div><div className="v">{s.parentId ? `${s.parentId.name}${s.parentId.phone ? ` · ${s.parentId.phone}` : ""}` : "—"}</div></div>
              <div><div className="k">Transport</div><div className="v">{data.transport ? `${data.transport.route?.name}${data.transport.stop ? ` · ${data.transport.stop}` : ""}` : "—"}</div></div>
              <div><div className="k">Hostel</div><div className="v">{data.hostel ? `${data.hostel.room?.hostel?.name} · Room ${data.hostel.room?.number}` : "—"}</div></div>
              <div><div className="k">Scholarships</div><div className="v">{data.scholarships.filter(x => x.status === "active").map(x => x.title).join(", ") || "—"}</div></div>
            </div>
          </Card>
        </div>
      )}
      {tab === "academics" && <TranscriptView transcript={transcript} student={s} emptyDesc="No results on record for this student yet." />}
      {tab === "attendance" && (
        <Card style={{ padding: 18 }}>
          {attendance.subjects.length === 0 ? <EmptyState icon="clipboard" title="No attendance recorded yet" /> : (
            <div style={{ display: "grid", gap: 14 }}>
              {attendance.subjects.map(a => (
                <div key={a.subject?._id || a.subject}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600 }}>{a.subject?.name || "Subject"}</span>
                    <span style={{ color: "var(--ink-soft)" }}>{a.present}/{a.total} present · {a.absent} absent · {a.leave} leave · <strong>{a.rate}%</strong></span>
                  </div>
                  <ProgressBar pct={a.rate} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      {tab === "fees" && (
        <Card style={{ padding: 0, overflow: "auto" }}>
          <Simple empty="No fees billed." head={["Fee", "Period", "Due", "Net", "Paid", "Balance", "Status"]} rows={fees.items.map(f => {
            const m = statusMeta(f.status !== "paid" && f.balance > 0 && new Date(f.dueDate) < new Date() ? "overdue" : f.status);
            return [f.title, f.period || "—", fmt(f.dueDate), money(f.netAmount), money(f.netAmount - f.balance), money(f.balance), <Badge tone={m.tone}>{m.label}</Badge>];
          })} />
        </Card>
      )}
      {tab === "records" && (
        <Card style={{ padding: 0, overflow: "auto" }}>
          <Simple empty="No discipline, health or achievement records." head={["Date", "Kind", "Title", "Severity", "Action Taken"]} rows={data.records.map(r => [fmt(r.date), humanize(r.kind), r.title, humanize(r.severity), r.actionTaken || "—"])} />
        </Card>
      )}
      {tab === "history" && (
        <div style={{ display: "grid", gap: 16 }}>
          <Card style={{ padding: 0, overflow: "auto" }}><div style={{ padding: "14px 18px 4px", fontWeight: 700, fontSize: 13.5 }}>Enrolment history</div>
            <Simple empty="No enrolments." head={["Session", "Program", "Section", "From", "To", "Status"]} rows={data.enrollments.map(e => [e.academicSession?.name, e.program?.name, e.section?.name, fmt(e.enrolledAt), e.endedAt ? fmt(e.endedAt) : "—", humanize(e.status)])} /></Card>
          <Card style={{ padding: 0, overflow: "auto" }}><div style={{ padding: "14px 18px 4px", fontWeight: 700, fontSize: 13.5 }}>Library loans</div>
            <Simple empty="No library activity." head={["Book", "Issued", "Due", "Returned", "Fine"]} rows={data.loans.map(l => [l.book?.title, fmt(l.issuedOn), fmt(l.dueOn), l.returnedOn ? fmt(l.returnedOn) : humanize(l.status), l.fine ? money(l.fine) : "—"])} /></Card>
          <Card style={{ padding: 0, overflow: "auto" }}><div style={{ padding: "14px 18px 4px", fontWeight: 700, fontSize: 13.5 }}>Leave requests</div>
            <Simple empty="No leave requests." head={["Type", "From", "To", "Status"]} rows={data.leaves.map(l => [l.type, fmt(l.from), fmt(l.to), humanize(l.status)])} /></Card>
          <Card style={{ padding: 0, overflow: "auto" }}><div style={{ padding: "14px 18px 4px", fontWeight: 700, fontSize: 13.5 }}>Certificates issued</div>
            <Simple empty="No certificates issued." head={["Serial", "Type", "Issued", "Status"]} rows={data.certificates.map(c => [c.serialNo, humanize(c.type), fmt(c.issuedOn), humanize(c.status)])} /></Card>
        </div>
      )}
      {editing && <ProfileModal student={s} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
    </>
  );
}

// ═══════════════════════════ BULK IMPORT ═══════════════════════════════════
const TEMPLATE_HEADERS = ["name", "rollNo", "email", "phone", "gender", "parentName", "parentEmail", "registrationNo"];

// ── Whole-school roster import ────────────────────────────────────────────
// For an admission sheet with class/section/guardian columns: previews what
// will be created (classes, sections, families, students) and the data
// problems found, then imports and hands back the one-time logins.
const ROSTER_HEADERS = ["name", "fatherName", "gender", "dateOfBirth", "rollNumber", "registration", "className", "section", "email", "phone", "guardianName", "guardianPhone", "guardianEmail", "address", "enrollmentDate", "status", "academicYear", "notes"];
const LEVEL_TONE = { error: "danger", skip: "neutral", check: "warn", fixed: "info", warn: "warn", info: "neutral" };

function RosterImport({ rows, fileName, onReset }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [session, setSession] = useState("");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const call = dryRun => run(() => api.call("POST", "/api/lifecycle/students/import-roster", { rows, session: session || undefined, dryRun }));
  useEffect(() => { call(true).then(r => { if (r) { setPreview(r); setSession(r.session); } }); }, [rows]);
  const out = result || preview;
  const download = () => downloadCsv("student-logins.csv", ["Name", "Father", "Class", "Section", "Roll No (login)", "One-time password"], result.credentials.map(c => [c.name, c.fatherName, c.className, c.section, c.rollNo, c.password]));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{result ? "Import complete" : "Whole-school import — preview"}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{fileName} · {rows.length} rows · classes, sections, families and students are created together</div>
          </div>
          {!result && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div><label className="field-label">Academic session</label><input className="input" style={{ width: 140 }} value={session} onChange={e => setSession(e.target.value)} /></div>
              <Btn variant="ghost" disabled={busy} onClick={() => call(true).then(r => r && setPreview(r))}>Refresh preview</Btn>
              <Btn variant="accent" disabled={busy || !preview?.students} onClick={() => window.confirm(`Import ${preview.students} students into ${preview.classes.length} classes?`) && call(false).then(r => r && setResult(r))}>{busy ? "Working…" : `Import ${preview?.students ?? ""} students`}</Btn>
            </div>
          )}
          {result && <div style={{ display: "flex", gap: 8 }}><Btn variant="accent" onClick={download} disabled={!result.credentials.length}><Icon name="file" size={13} />Download logins</Btn><Btn variant="ghost" onClick={onReset}>Import another file</Btn></div>}
        </div>
        {result?.credentials?.length > 0 && <div style={{ background: "var(--warn-soft)", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginTop: 14 }}>Download the logins now — the one-time passwords are not stored anywhere and can't be shown again.</div>}
      </Card>
      {!out ? <Card style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Reading the sheet…</Card> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
            <StatCard label={result ? "Students imported" : "Students to import"} value={result ? result.credentials.length : out.students} icon="users" />
            <StatCard label="Classes" value={out.classes.length} icon="layers" />
            <StatCard label="Families" value={out.families} icon="user" />
            <StatCard label="Families with siblings" value={out.familiesWithSiblings} icon="users" />
          </div>
          <Card style={{ padding: 0, overflow: "auto" }}>
            <table className="table"><thead><tr><th>Class</th><th>Code</th><th>Sections</th><th>Students</th></tr></thead>
              <tbody>{out.classes.map(c => <tr key={c.name}><td style={{ fontWeight: 600, color: "var(--ink)" }}>{c.name}</td><td>{c.code}</td><td>{c.sections.map(s => `${s.name} (${s.students})`).join(" · ")}</td><td>{c.sections.reduce((t, s) => t + s.students, 0)}</td></tr>)}</tbody></table>
          </Card>
          {Object.values(out.missing || {}).some(Boolean) && (
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Empty in the sheet: {Object.entries(out.missing).filter(([, v]) => v).map(([k, v]) => `${k} for ${v}`).join(" · ")}. Roll numbers are generated per class ({out.classes.map(c => `${c.code}-001`).slice(0, 3).join(", ")}…); the rest can be filled in later from Student 360.</div>
          )}
          {out.warnings.length > 0 && (
            <Card style={{ padding: 0, overflow: "auto" }}>
              <div style={{ padding: "14px 18px", fontWeight: 700, fontSize: 14 }}>Things noticed in the sheet ({out.warnings.length})</div>
              <table className="table"><tbody>{out.warnings.map((w, i) => (
                <tr key={i}><td style={{ width: 90 }}><Badge tone={LEVEL_TONE[w.level] || "neutral"}>{w.level === "check" ? "Please check" : humanize(w.level)}</Badge></td><td style={{ fontSize: 12.5 }}>{w.line ? <span style={{ color: "var(--muted)" }}>line {w.line} · </span> : null}{w.message}</td></tr>
              ))}</tbody></table>
            </Card>
          )}
          {result?.credentials?.length > 0 && (
            <Card style={{ padding: 0, overflow: "auto", maxHeight: 420 }}>
              <table className="table"><thead><tr><th>Roll No</th><th>Name</th><th>Class</th><th>One-time password</th></tr></thead>
                <tbody>{result.credentials.map(c => <tr key={c.rollNo}><td className="font-mono">{c.rollNo}</td><td>{c.name}</td><td>{c.className}{c.section !== "A" ? ` ${c.section}` : ""}</td><td className="font-mono">{c.password}</td></tr>)}</tbody></table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export function ImportPage() {
  const { api } = useSession();
  const toast = useToast();
  const [sections] = useLoad("/api/sections", []);
  const [section, setSection] = useState("");
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [roster, setRoster] = useState(null);

  const onFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const parsed = parseCsv(await file.text());
    setFileName(file.name); setResult(null);
    if (!parsed.length) { setRows([]); return toast("That file has no data rows", "alert"); }
    if ("className" in parsed[0]) { setRows([]); setRoster(parsed); return; } // whole-school sheet
    if (!("name" in parsed[0]) || !("rollNo" in parsed[0])) { setRows([]); return toast("The file needs at least “name” and “rollNo” columns — download the template", "alert"); }
    setRows(parsed);
  };
  const submit = async () => {
    setBusy(true);
    try { setResult(await api.call("POST", "/api/lifecycle/students/import", { rows, section: section || undefined })); setRows([]); }
    catch (e) { toast(e.message, "alert"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <SectionHeader eyebrow="People" title="Bulk Import Students" action={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={() => downloadCsv("whole-school-template.csv", ROSTER_HEADERS, [["Ayesha Khan", "Imran Khan", "Female", "2019-05-03", "", "", "Class 1", "A", "", "", "Imran Khan", "0300-1234567", "", "House 12, Block B", "", "Active", "2026-27", ""]])}><Icon name="file" size={13} />Whole-school template</Btn>
          <Btn variant="ghost" onClick={() => downloadCsv("student-import-template.csv", TEMPLATE_HEADERS, [["Ayesha Khan", "AI-2627-001", "ayesha@example.com", "03001234567", "female", "Imran Khan", "imran@example.com", "REG-1001"]])}><Icon name="file" size={13} />Simple template</Btn>
        </div>} />
      {roster && <RosterImport rows={roster} fileName={fileName} onReset={() => { setRoster(null); setFileName(""); }} />}
      {!roster && <>
      <Card style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, alignItems: "end" }}>
          <div><label className="field-label">CSV file</label><input className="input" type="file" accept=".csv,text/csv" onChange={onFile} /></div>
          <div><label className="field-label">Enrol everyone into section (optional)</label>
            <select className="input" value={section} onChange={e => setSection(e.target.value)}>
              <option value="">Don't enrol yet</option>{(sections || []).filter(s => s.status === "active").map(s => <option key={s._id} value={s._id}>{s.program?.name ? `${s.program.name} — ` : ""}{s.name}</option>)}
            </select></div>
          <Btn variant="accent" onClick={submit} disabled={busy || !rows.length}>{busy ? "Importing…" : `Import ${rows.length || ""} Students`}</Btn>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Up to 500 rows per file. Each student gets a random one-time password, shown once after the import — export it and hand the logins out.</div>
      </Card>

      {rows.length > 0 && (
        <Card style={{ padding: 0, overflow: "auto" }}>
          <div style={{ padding: "14px 18px", fontWeight: 700, fontSize: 13.5 }}>Preview — {fileName} ({rows.length} rows)</div>
          <table className="table"><thead><tr>{TEMPLATE_HEADERS.map(x => <th key={x}>{x}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 15).map((r, i) => <tr key={i}>{TEMPLATE_HEADERS.map(x => <td key={x}>{r[x] || "—"}</td>)}</tr>)}</tbody></table>
          {rows.length > 15 && <div style={{ padding: "10px 18px", fontSize: 12, color: "var(--muted)" }}>…and {rows.length - 15} more</div>}
        </Card>
      )}

      {result && (
        <div style={{ display: "grid", gap: 16 }}>
          <Card style={{ padding: 0, overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}><Badge tone="success">{result.created.length} imported</Badge> Save these logins now — passwords are not shown again.</div>
              <Btn variant="accent" disabled={!result.created.length} onClick={() => downloadCsv("new-student-logins.csv", ["Name", "Roll No (login)", "One-time password"], result.created.map(c => [c.name, c.rollNo, c.tempPassword]))}><Icon name="file" size={13} />Download Logins</Btn>
            </div>
            <table className="table"><thead><tr><th>Name</th><th>Roll No</th><th>One-time password</th></tr></thead>
              <tbody>{result.created.map(c => <tr key={c.rollNo}><td>{c.name}</td><td>{c.rollNo}</td><td className="font-mono">{c.tempPassword}</td></tr>)}</tbody></table>
          </Card>
          {result.errors.length > 0 && (
            <Card style={{ padding: 0, overflow: "auto" }}>
              <div style={{ padding: "14px 18px", fontWeight: 700, fontSize: 13.5 }}><Badge tone="danger">{result.errors.length} skipped</Badge> Fix these rows and import them again.</div>
              <table className="table"><thead><tr><th>File line</th><th>Roll No</th><th>Problem</th></tr></thead>
                <tbody>{result.errors.map(e => <tr key={e.line}><td>{e.line}</td><td>{e.rollNo || "—"}</td><td>{e.error}</td></tr>)}</tbody></table>
            </Card>
          )}
        </div>
      )}
      </>}
    </>
  );
}

// ═══════════════════════════ PROMOTION ═════════════════════════════════════
export function PromotionPage() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [sections] = useLoad("/api/sections", []);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [outcome, setOutcome] = useState("promote");
  const [enrollments, reload, loading] = useLoad(from ? `/api/enrollments?section=${from}` : null, []);
  const [picked, setPicked] = useState(new Set());
  const active = (enrollments || []).filter(e => e.status === "active" && e.student);
  useEffect(() => { setPicked(new Set(active.map(e => e.student._id))); }, [enrollments]);

  const label = s => `${s.program?.name ? `${s.program.name} — ` : ""}${s.name}${s.academicSession?.name ? ` (${s.academicSession.name})` : ""}`;
  const toggle = id => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const submit = () => {
    const target = (sections || []).find(s => s._id === to);
    const msg = outcome === "promote" ? `Move ${picked.size} student(s) into ${label(target)}?` : `Graduate ${picked.size} student(s)? Their enrolment is closed and they are added to the alumni directory.`;
    if (!window.confirm(`${msg}\n\nTheir current enrolment is kept as history.`)) return;
    run(() => api.call("POST", "/api/lifecycle/promote", { fromSection: from, toSection: outcome === "promote" ? to : undefined, outcome, studentIds: [...picked] }), o => `${o.moved} student(s) ${outcome === "promote" ? "promoted" : "graduated"}`).then(r => r && reload());
  };

  return (
    <>
      <SectionHeader eyebrow="People" title="Promotion & Graduation" />
      <Card style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, alignItems: "end" }}>
          <div><label className="field-label">From section</label>
            <select className="input" value={from} onChange={e => setFrom(e.target.value)}><option value="">Select…</option>{(sections || []).map(s => <option key={s._id} value={s._id}>{label(s)}</option>)}</select></div>
          <div><label className="field-label">Outcome</label>
            <select className="input" value={outcome} onChange={e => setOutcome(e.target.value)}><option value="promote">Promote to next section</option><option value="graduate">Graduate (programme complete)</option></select></div>
          {outcome === "promote" && (
            <div><label className="field-label">Into section</label>
              <select className="input" value={to} onChange={e => setTo(e.target.value)}><option value="">Select…</option>{(sections || []).filter(s => s._id !== from && s.status === "active").map(s => <option key={s._id} value={s._id}>{label(s)}</option>)}</select></div>
          )}
          <Btn variant="accent" disabled={busy || !from || picked.size === 0 || (outcome === "promote" && !to)} onClick={submit}><Icon name="arrowUp" size={13} />{outcome === "promote" ? "Promote" : "Graduate"} {picked.size || ""}</Btn>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Untick anyone being held back — they stay in the current section. Create the next session and its sections first if they don't exist yet.</div>
      </Card>
      <Card style={{ padding: 0, overflow: "auto" }}>
        {!from ? <EmptyState icon="arrowUp" title="Choose a section" desc="Its active students are listed here to promote or graduate together." />
          : loading ? <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading…</div>
          : active.length === 0 ? <EmptyState icon="users" title="No active students in this section" />
          : (
            <table className="table">
              <thead><tr><th style={{ width: 40 }}><input type="checkbox" checked={picked.size === active.length} onChange={e => setPicked(e.target.checked ? new Set(active.map(x => x.student._id)) : new Set())} /></th><th>Student</th><th>Roll No</th><th>Enrolled</th></tr></thead>
              <tbody>{active.map(e => (
                <tr key={e._id} className="clickable" onClick={() => toggle(e.student._id)}>
                  <td><input type="checkbox" checked={picked.has(e.student._id)} readOnly /></td>
                  <td style={{ fontWeight: 600, color: "var(--ink)" }}>{e.student.name}</td><td>{e.student.rollNo}</td><td>{fmt(e.enrolledAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
      </Card>
    </>
  );
}

// ═══════════════════════════ CERTIFICATES ══════════════════════════════════
const CERT_TITLES = { bonafide: "Bonafide Certificate", character: "Character Certificate", transfer: "Transfer Certificate", completion: "Course Completion Certificate", id_card: "Student Identity Card", fee_clearance: "Fee Clearance Certificate" };

function printCertificate(cert, settings) {
  const s = cert.student || {};
  const enr = s.currentEnrollment;
  const who = html`<strong>${s.name}</strong>${s.parentName ? html`, son/daughter of <strong>${s.parentName}</strong>,` : ""} bearing Roll No. <strong>${s.rollNo}</strong>`;
  const klass = enr ? html` of <strong>${enr.program?.name || ""}${enr.section?.name ? ` (Section ${enr.section.name})` : ""}</strong>${enr.academicSession?.name ? `, session ${enr.academicSession.name}` : ""}` : "";
  const text = {
    bonafide: html`This is to certify that ${who} is a bonafide student${klass} of this institute.`,
    character: html`This is to certify that ${who}${klass} has, to the best of our knowledge, borne a good moral character and conduct during their time at this institute.`,
    transfer: html`This is to certify that ${who}${klass} has been a student of this institute and is hereby permitted to leave. The institute has no objection to their admission elsewhere.`,
    completion: html`This is to certify that ${who} has successfully completed the prescribed course of study${klass}.`,
    fee_clearance: html`This is to certify that ${who}${klass} has cleared all dues payable to this institute as of the date of issue.`,
    id_card: html`${who}${klass}. This card is the property of the institute and must be carried on campus.`,
  }[cert.type];
  printDocument(`${CERT_TITLES[cert.type]} ${cert.serialNo}`, html`
    <h2>${CERT_TITLES[cert.type]}</h2>
    <div class="meta"><div><span>Serial No:</span> <strong>${cert.serialNo}</strong></div><div><span>Date of issue:</span> ${fmt(cert.issuedOn)}</div></div>
    <p class="body">${text}${cert.purpose ? html` This certificate is issued on the student's request for the purpose of <strong>${cert.purpose}</strong>.` : ""}</p>
    <div class="sign"><div>${settings.registrarName || "Registrar"}</div><div>${settings.principalName || "Head of Institute"}</div></div>
    <div class="foot">Verify this document at ${window.location.origin}/verify/${cert.serialNo}${getInstitute() ? `?i=${getInstitute()}` : ""} — or quote serial ${cert.serialNo} to the institute office.</div>`, { institute: settings });
}

export function CertificatesPage() {
  const { api } = useSession();
  const { settings } = useSettings();
  const [run] = useAction();
  return (
    <ResourcePage eyebrow="People" title="Certificates" base="/api/engage/certificates" addLabel="Issue Certificate" canEdit={false} searchable={false}
      emptyDesc="Every certificate gets a unique serial number that can be verified against this register."
      columns={[
        { key: "serialNo", label: "Serial" }, { key: "student.name", label: "Student" }, { key: "student.rollNo", label: "Roll No" },
        { key: "type", label: "Type", render: r => CERT_TITLES[r.type], csv: r => r.type }, { key: "purpose", label: "Purpose" }, { key: "issuedOn", label: "Issued", type: "date" }, { key: "status", label: "Status", type: "status" },
      ]}
      filters={[{ name: "type", label: "Type", options: Object.entries(CERT_TITLES).map(([value, label]) => ({ value, label })) }, { name: "student", label: "Student", source: STUDENT_SOURCE }]}
      fields={[
        { name: "student", label: "Student", type: "select", required: true, source: STUDENT_SOURCE },
        { name: "type", label: "Certificate", type: "select", required: true, options: Object.entries(CERT_TITLES).map(([value, label]) => ({ value, label })) },
        { name: "purpose", label: "Purpose (printed on the certificate)", full: true, placeholder: "e.g. visa application, bank account" },
      ]}
      rowActions={(row, ctx) => [
        row.status === "valid" && { label: "Print", icon: "printer", variant: "accent", onClick: () => printCertificate(row, settings) },
        row.status === "valid" && { label: "Revoke", icon: "x", variant: "danger", onClick: () => window.confirm(`Revoke ${row.serialNo}? It will fail verification from now on.`) && run(() => api.call("PATCH", `/api/engage/certificates/${row._id}/revoke`), "Certificate revoked").then(ctx.reload) },
      ]} />
  );
}
