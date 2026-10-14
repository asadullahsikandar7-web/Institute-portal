import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ResourcePage from "../../components/resource/ResourcePage.jsx";
import { SectionHeader, StatCard, Card, Badge, Btn, Icon, EmptyState, Modal, Avatar, ProgressBar, Tabs } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { downloadCsv, fmt, fmtTime12h, html, humanize, printDocument, statusMeta } from "../../lib/utils.js";
import { useLoad, useAction } from "./hooks.js";

// Full-page screens of the smart layer: Student Success (early warning),
// the examination suite, teacher evaluation, and public certificate
// verification.

// ═══════════════════════════ STUDENT SUCCESS ═══════════════════════════════
const LEVEL = { high: { tone: "danger", label: "High risk" }, medium: { tone: "warn", label: "Watch" }, low: { tone: "success", label: "On track" } };
const FACTOR_LABEL = { attendance: "Attendance", academics: "Academics", fees: "Fees", coursework: "Coursework", conduct: "Conduct" };
const INTERVENTIONS = ["counselling", "parent_contact", "warning_letter", "academic_support", "fee_plan", "other"];

function RiskMeter({ score, level }) {
  const color = level === "high" ? "var(--danger)" : level === "medium" ? "var(--warn)" : "var(--success)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }} title={`Risk score ${score} of 100`}>
      <div className="progress-track" style={{ flex: 1 }}><div className="progress-fill" style={{ width: `${score}%`, background: color }} /></div>
      <strong style={{ fontSize: 12.5, width: 24, textAlign: "right" }}>{score}</strong>
    </div>
  );
}

function StudentRiskModal({ row, onClose, onChanged }) {
  const { api, session } = useSession();
  const [run, busy] = useAction();
  const [data, reload, loading] = useLoad(`/api/success/student/${row.student._id}`);
  const [form, setForm] = useState({ type: "counselling", notes: "", followUpOn: "" });
  const log = () => run(() => api.call("POST", "/api/success/interventions", { ...form, student: row.student._id }), "Intervention logged").then(r => { if (r) { setForm({ type: "counselling", notes: "", followUpOn: "" }); reload(); onChanged(); } });
  const close = iv => run(() => api.call("PATCH", `/api/success/interventions/${iv._id}`, { status: "done" }), "Marked done").then(r => { if (r) { reload(); onChanged(); } });
  const d = data || row;
  return (
    <Modal wide title={row.student.name} onClose={onClose}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <Avatar name={row.student.name} size={46} img={row.student.photo || undefined} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Roll #{row.student.rollNo} · {row.program?.name} · {row.section?.name}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}><Badge tone={LEVEL[d.level].tone}>{LEVEL[d.level].label}</Badge><div style={{ flex: 1, maxWidth: 220 }}><RiskMeter score={d.score} level={d.level} /></div></div>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Why this score</div>
      {d.reasons.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>{d.hasData ? "No warning signs in attendance, results, fees, coursework or conduct." : "Not enough data yet — no attendance, results or fees recorded for this student."}</div> : (
        <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
          {d.reasons.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--surface-alt)", borderRadius: 9, padding: "8px 12px", fontSize: 13 }}>
              <Badge tone="neutral">{FACTOR_LABEL[r.factor]}</Badge><span style={{ flex: 1 }}>{r.text}</span>{r.points > 0 && <strong style={{ color: "var(--ink-soft)" }}>+{r.points}</strong>}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Follow-up log</div>
      {loading ? <div style={{ fontSize: 13, color: "var(--muted)" }}>Loading…</div> : (data?.interventions || []).length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>Nothing logged yet.</div> : (
        <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
          {data.interventions.map(iv => (
            <div key={iv._id} style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "9px 12px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
                <Badge tone={iv.status === "done" ? "success" : "warn"}>{iv.status === "done" ? "Done" : "Open"}</Badge>
                <strong style={{ color: "var(--ink-soft)" }}>{humanize(iv.type)}</strong> · {iv.byName} · {fmt(iv.createdAt)}{iv.followUpOn ? ` · follow up ${fmt(iv.followUpOn)}` : ""}
                <div style={{ flex: 1 }} />
                {iv.status === "open" && (session.role === "admin" || iv.byId === String(session.teacher?._id)) && <Btn variant="ghost" style={{ padding: "3px 9px", fontSize: 11.5 }} disabled={busy} onClick={() => close(iv)}>Mark done</Btn>}
              </div>
              <div style={{ fontSize: 13, marginTop: 5, whiteSpace: "pre-wrap" }}>{iv.notes}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, background: "var(--surface-alt)", borderRadius: 12, padding: 14 }}>
        <div><label className="field-label">Action taken</label><select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>{INTERVENTIONS.map(t => <option key={t} value={t}>{humanize(t)}</option>)}</select></div>
        <div><label className="field-label">Follow up on</label><input className="input" type="date" value={form.followUpOn} onChange={e => setForm(p => ({ ...p, followUpOn: e.target.value }))} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Notes</label><textarea className="input" rows={2} placeholder="What was discussed or agreed?" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
        <Btn variant="accent" disabled={busy || !form.notes.trim()} onClick={log} style={{ width: "fit-content" }}><Icon name="plus" size={13} />Log Intervention</Btn>
      </div>
    </Modal>
  );
}

function RiskBoard({ path, eyebrow, title, filters }) {
  const [data, reload, loading] = useLoad(path);
  const [level, setLevel] = useState("");
  const [factor, setFactor] = useState("");
  const [open, setOpen] = useState(null);
  const rows = (data?.rows || []).filter(r => (!level || r.level === level) && (!factor || r.reasons.some(x => x.factor === factor && x.points > 0)));
  const s = data?.summary;
  return (
    <>
      <SectionHeader eyebrow={eyebrow} title={title} action={
        <Btn variant="ghost" disabled={!rows.length} onClick={() => downloadCsv("student-risk.csv", ["Student", "Roll No", "Section", "Score", "Level", "Reasons", "Attendance %", "Average %", "Overdue balance", "Interventions"], rows.map(r => [r.student.name, r.student.rollNo, r.section?.name, r.score, r.level, r.reasons.map(x => x.text).join(" | "), r.metrics.attendance, r.metrics.average, r.metrics.overdueBalance, r.interventions.total]))}><Icon name="file" size={13} />Export CSV</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 16 }}>
        <StatCard label="High Risk" value={loading ? "…" : s?.high} icon="alert" active={level === "high"} onClick={() => setLevel(level === "high" ? "" : "high")} />
        <StatCard label="Watch List" value={loading ? "…" : s?.medium} icon="eye" active={level === "medium"} onClick={() => setLevel(level === "medium" ? "" : "medium")} />
        <StatCard label="On Track" value={loading ? "…" : s?.low} icon="check" active={level === "low"} onClick={() => setLevel(level === "low" ? "" : "low")} />
        <StatCard label="High Risk, No Follow-up" value={loading ? "…" : s?.unattended} icon="clock" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {filters}
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Flagged for:</span>
        {(s?.byFactor || []).map(f => (
          <button key={f.factor} className={"badge " + (factor === f.factor ? "accent" : "neutral")} style={{ border: "none", cursor: "pointer", padding: "5px 11px", fontFamily: "inherit" }} onClick={() => setFactor(factor === f.factor ? "" : f.factor)}>{FACTOR_LABEL[f.factor]} · {f.students}</button>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead><tr><th>Student</th><th>Class</th><th>Risk</th><th>Main reasons</th><th>Follow-up</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.student._id} className="clickable" onClick={() => setOpen(r)}>
              <td style={{ whiteSpace: "nowrap" }}><span style={{ fontWeight: 600, color: "var(--ink)" }}>{r.student.name}</span> <span style={{ color: "var(--muted)" }}>#{r.student.rollNo}</span></td>
              <td style={{ whiteSpace: "nowrap" }}>{r.program?.code} · {r.section?.name}</td>
              <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Badge tone={LEVEL[r.level].tone}>{LEVEL[r.level].label}</Badge><RiskMeter score={r.score} level={r.level} /></div></td>
              <td style={{ fontSize: 12.5 }}>{r.reasons.slice(0, 2).map(x => x.text).join(" · ") || <span style={{ color: "var(--muted)" }}>{r.hasData ? "No warning signs" : "No data yet"}</span>}</td>
              <td style={{ whiteSpace: "nowrap" }}>{r.interventions.total ? <Badge tone={r.interventions.open ? "warn" : "success"}>{r.interventions.open ? `${r.interventions.open} open` : `${r.interventions.total} done`}</Badge> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
            </tr>
          ))}</tbody>
        </table>
        {loading && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Calculating…</div>}
        {!loading && rows.length === 0 && <EmptyState icon="check" title={data?.rows?.length ? "No students match these filters" : "No enrolled students yet"} />}
      </Card>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>Score out of 100, recalculated live from attendance (up to 35), results (30), overdue fees (20), missing coursework (10) and discipline records (10). 50+ is high risk, 25–49 is the watch list.</div>
      {open && <StudentRiskModal row={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

export function StudentSuccessPage() {
  const [sections] = useLoad("/api/sections", []);
  const [section, setSection] = useState("");
  return <RiskBoard eyebrow="People" title="Student Success" path={`/api/success/overview${section ? `?section=${section}` : ""}`} filters={
    <select className="input" style={{ width: "auto" }} value={section} onChange={e => setSection(e.target.value)}>
      <option value="">All sections</option>{(sections || []).map(s => <option key={s._id} value={s._id}>{s.program?.name ? `${s.program.name} — ` : ""}{s.name}</option>)}
    </select>} />;
}

export function TeacherSuccessPage() {
  const { api } = useSession();
  const [classes, setClasses] = useState(null);
  const [cls, setCls] = useState("");
  useEffect(() => { api.getMyClasses().then(c => { setClasses(c); if (c.length) setCls(c[0]._id); }).catch(() => setClasses([])); }, [api]);
  if (classes && !classes.length) return <><SectionHeader eyebrow="Teaching" title="Students at Risk" /><Card style={{ padding: 24 }}><EmptyState icon="users" title="No classes assigned to you yet" /></Card></>;
  if (!cls) return <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>;
  return <RiskBoard eyebrow="Teaching" title="Students at Risk" path={`/api/success/class/${cls}`} filters={
    <select className="input" style={{ width: "auto" }} value={cls} onChange={e => setCls(e.target.value)}>{classes.map(c => <option key={c._id} value={c._id}>{c.subject?.name} — {c.section?.name}</option>)}</select>} />;
}

// ═══════════════════════════ EXAMINATIONS ══════════════════════════════════
const dayLabel = d => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

function printSeating(paper, sessionName, settings) {
  printDocument(`Seating — ${paper.subject?.name}`, html`
    <h2>Seating Plan</h2>
    <div class="meta">
      <div><span>Examination:</span> <strong>${sessionName}</strong></div><div><span>Paper:</span> <strong>${paper.subject?.name}</strong> ${paper.subject?.code || ""}</div>
      <div><span>Date:</span> ${dayLabel(paper.date)}</div><div><span>Time:</span> ${fmtTime12h(paper.startTime)} – ${fmtTime12h(paper.endTime)}</div>
      <div><span>Room:</span> ${paper.room?.name || "—"}</div><div><span>Invigilator:</span> ${paper.invigilator?.name || "—"}</div>
    </div>
    <table><tr><th class="r">Seat</th><th>Roll No</th><th>Name</th><th>Signature</th></tr>
      ${paper.seats.map(s => html`<tr><td class="r">${s.seatNo}</td><td>${s.student?.rollNo}</td><td>${s.student?.name}</td><td style="width:34%"></td></tr>`)}
    </table>
    <div class="sign"><div>Invigilator</div><div>Controller of Examinations</div></div>`, { institute: settings });
}

function DatesheetModal({ session, onClose, onChanged }) {
  const { api } = useSession();
  const { settings } = useSettings();
  const [run, busy] = useAction();
  const [papers, reload, loading] = useLoad(`/api/examsuite/sessions/${session._id}/papers`, []);
  const [rooms] = useLoad("/api/rooms", []);
  const [status, setStatus] = useState(session.status);
  const [report, setReport] = useState(null);
  const [moving, setMoving] = useState(null);
  const list = papers || [];
  const draft = status === "draft";

  const generate = replace => (!replace || window.confirm("Discard the current datesheet and build a new one from scratch?")) &&
    run(() => api.call("POST", `/api/examsuite/sessions/${session._id}/generate`, { replace })).then(r => { if (r) { setReport(r); reload(); } });
  const setTo = next => (next !== "published" || window.confirm("Publish this datesheet? Students are notified and can see their rooms, seats and admit cards.")) &&
    run(() => api.call("POST", `/api/examsuite/sessions/${session._id}/status`, { status: next }), next === "published" ? "Datesheet published — students notified" : "Moved back to draft").then(r => { if (r) { setStatus(r.status); onChanged(); } });
  const saveMove = () => run(() => api.call("PATCH", `/api/examsuite/papers/${moving._id}`, { date: moving.date, startTime: moving.startTime, endTime: moving.endTime, room: moving.room?._id || moving.room }), "Paper moved").then(r => { if (r) { setMoving(null); reload(); } });
  const dates = [...new Set(list.map(p => p.date))];

  return (
    <Modal wide title={`${session.name} — Datesheet`} onClose={onClose} footer={<>
      <Badge tone={draft ? "warn" : "success"}>{humanize(status)}</Badge>
      <div style={{ flex: 1 }} />
      {draft && list.length > 0 && <Btn variant="ghost" disabled={busy} onClick={() => generate(true)}>Rebuild from scratch</Btn>}
      {draft && <Btn variant={list.length ? "ghost" : "accent"} disabled={busy} onClick={() => generate(false)}><Icon name="history" size={13} />{list.length ? "Schedule missing papers" : "Generate Datesheet"}</Btn>}
      {draft ? <Btn variant="accent" disabled={busy || !list.length} onClick={() => setTo("published")}>Publish</Btn> : <Btn variant="ghost" disabled={busy} onClick={() => setTo("draft")}>Back to draft</Btn>}
    </>}>
      {report && (
        <div style={{ background: report.unplaced.length ? "var(--danger-soft)" : "var(--success-soft)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 14 }}>
          <strong>{report.scheduled} paper(s) scheduled</strong> across {report.days} working day(s){report.kept ? `, ${report.kept} kept` : ""}{report.skippedEmpty ? `, ${report.skippedEmpty} class(es) skipped (no students)` : ""}.
          {report.unplaced.map((u, i) => <div key={i} style={{ marginTop: 4, color: "var(--danger)" }}>{u.subject}: {u.reason}</div>)}
        </div>
      )}
      {loading ? <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading…</div> : list.length === 0 ? (
        <EmptyState icon="calendar" title="No papers scheduled yet" desc="Generate builds a clash-free datesheet for every class in the session: one paper per section per day where possible, rooms sized to the class, Sundays and calendar holidays skipped, seats numbered by roll no." />
      ) : dates.map(d => (
        <div key={d} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{dayLabel(d)}</div>
          <table className="table" style={{ background: "var(--surface-alt)", borderRadius: 10 }}>
            <tbody>{list.filter(p => p.date === d).map(p => (
              <tr key={p._id}>
                <td style={{ whiteSpace: "nowrap", width: 150 }}>{fmtTime12h(p.startTime)} – {fmtTime12h(p.endTime)}</td>
                <td><strong style={{ color: "var(--ink)" }}>{p.subject?.name}</strong> <span style={{ color: "var(--muted)" }}>{p.program?.code} · {p.section?.name}</span></td>
                <td>{p.room?.name || "—"}</td><td>{p.invigilator?.name || <span style={{ color: "var(--muted)" }}>No invigilator</span>}</td><td>{p.seats.length} seats</td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  <Btn variant="ghost" style={{ padding: "4px 9px", fontSize: 12, marginRight: 6 }} onClick={() => printSeating(p, session.name, settings)}><Icon name="printer" size={12} />Seating</Btn>
                  {draft && <Btn variant="ghost" style={{ padding: "4px 9px", fontSize: 12 }} onClick={() => setMoving({ ...p })}>Move</Btn>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ))}
      {moving && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, background: "var(--accent-soft)", borderRadius: 12, padding: 14, alignItems: "end" }}>
          <div style={{ gridColumn: "1 / -1", fontWeight: 700, fontSize: 13 }}>Move {moving.subject?.name} ({moving.section?.name})</div>
          <div><label className="field-label">Date</label><input className="input" type="date" value={moving.date} onChange={e => setMoving(m => ({ ...m, date: e.target.value }))} /></div>
          <div><label className="field-label">From</label><input className="input" type="time" value={moving.startTime} onChange={e => setMoving(m => ({ ...m, startTime: e.target.value }))} /></div>
          <div><label className="field-label">To</label><input className="input" type="time" value={moving.endTime} onChange={e => setMoving(m => ({ ...m, endTime: e.target.value }))} /></div>
          <div><label className="field-label">Room</label><select className="input" value={moving.room?._id || moving.room || ""} onChange={e => setMoving(m => ({ ...m, room: e.target.value }))}>{(rooms || []).map(r => <option key={r._id} value={r._id}>{r.name}{r.capacity ? ` (${r.capacity})` : ""}</option>)}</select></div>
          <div style={{ display: "flex", gap: 8 }}><Btn variant="accent" disabled={busy} onClick={saveMove}>Save</Btn><Btn variant="ghost" onClick={() => setMoving(null)}>Cancel</Btn></div>
        </div>
      )}
    </Modal>
  );
}

export function ExamsAdminPage() {
  const [open, setOpen] = useState(null);
  const [tick, setTick] = useState(0);
  return (
    <>
      <ResourcePage eyebrow="Examinations" title="Exam Sessions & Datesheets" base="/api/examsuite/sessions" addLabel="New Exam Session" searchable={false} reloadKey={tick}
        emptyDesc="Create an exam session (e.g. “Midterm — Fall 2026”), then generate its clash-free datesheet with rooms, invigilators and seating in one click."
        columns={[
          { key: "name", label: "Examination" }, { key: "kind", label: "Kind", type: "enum" }, { key: "academicSession.name", label: "Session" },
          { key: "startDate", label: "From", type: "date" }, { key: "endDate", label: "To", type: "date" },
          { key: "rules", label: "Admit-card rules", render: r => [r.requireAttendance && "attendance", r.requireFeeClearance && "fee clearance"].filter(Boolean).join(" + ") || "none", csv: r => `${r.requireAttendance}/${r.requireFeeClearance}` },
          { key: "status", label: "Status", render: r => <Badge tone={r.status === "draft" ? "warn" : "success"}>{humanize(r.status)}</Badge>, csv: r => r.status },
        ]}
        filters={[{ name: "status", label: "Status", options: ["draft", "published", "completed"] }]}
        fields={[
          { name: "name", label: "Name", required: true, placeholder: "e.g. Midterm — Fall 2026", full: true },
          { name: "academicSession", label: "Academic Session", type: "select", required: true, source: { path: "/api/academic-sessions", label: s => s.name } },
          { name: "kind", label: "Kind", type: "select", options: ["midterm", "final", "sessional", "supplementary", "entry_test"], default: "midterm" },
          { name: "startDate", label: "First exam day", type: "date", required: true }, { name: "endDate", label: "Last exam day", type: "date", required: true },
          { name: "slots", label: "Daily paper slots (24-hour, HH:MM)", type: "lines", lineLabel: "slot", lineFields: [{ name: "start", label: "Starts e.g. 09:00", default: "09:00" }, { name: "end", label: "Ends e.g. 12:00", default: "12:00" }], default: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "17:00" }] },
          { name: "requireAttendance", label: "Bar a student from a paper when their attendance in that subject is below the minimum", type: "checkbox", default: true, full: true },
          { name: "requireFeeClearance", label: "Withhold the admit card while the student has overdue fees", type: "checkbox", default: true, full: true },
          { name: "instructions", label: "Instructions printed on the admit card", type: "textarea" },
        ]}
        rowActions={row => [{ label: "Datesheet", icon: "calendar", variant: "accent", onClick: () => setOpen(row) }]} />
      {open && <DatesheetModal session={open} onClose={() => { setOpen(null); setTick(t => t + 1); }} onChanged={() => setTick(t => t + 1)} />}
    </>
  );
}

function printAdmitCard(exam, student, settings) {
  const ok = exam.papers.filter(p => p.eligible);
  printDocument(`Admit Card — ${exam.session.name}`, html`
    <h2>Admit Card</h2>
    <div class="meta">
      <div><span>Examination:</span> <strong>${exam.session.name}</strong></div><div><span>Roll No:</span> <strong>${student.rollNo}</strong></div>
      <div><span>Name:</span> ${student.name}</div><div><span>Registration No:</span> ${student.registrationNo || "—"}</div>
    </div>
    <table><tr><th>Date</th><th>Time</th><th>Paper</th><th>Room</th><th class="r">Seat</th></tr>
      ${ok.map(p => html`<tr><td>${dayLabel(p.date)}</td><td>${fmtTime12h(p.startTime)} – ${fmtTime12h(p.endTime)}</td><td>${p.subject?.name} ${p.subject?.code || ""}</td><td>${p.room?.name || "—"}</td><td class="r">${p.seatNo ?? "—"}</td></tr>`)}
    </table>
    ${exam.admitCard.barredPapers ? html`<p><strong>Not permitted to sit ${exam.admitCard.barredPapers} paper(s)</strong> due to attendance shortage — see the student portal.</p>` : ""}
    ${exam.session.instructions ? html`<h3>Instructions</h3><p>${exam.session.instructions}</p>` : ""}
    <div class="sign"><div>Student's signature</div><div>Controller of Examinations</div></div>
    <div class="foot">Bring this card and your student ID to every paper. Issued ${fmt(new Date())}.</div>`, { institute: settings });
}

export function StudentExamsPage() {
  const { session } = useSession();
  const { settings, money } = useSettings();
  const navigate = useNavigate();
  const [exams, , loading] = useLoad("/api/examsuite/mine", []);
  return (
    <>
      <SectionHeader eyebrow="Academics" title="Exams & Admit Card" />
      {loading ? <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
        : !(exams || []).length ? <Card style={{ padding: 24 }}><EmptyState icon="file" title="No exam schedule published yet" desc="Your datesheet, room and seat numbers will appear here once the examinations office publishes them." /></Card>
        : exams.map(ex => (
          <Card key={ex.session._id} style={{ padding: 0, overflow: "auto", marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", flexWrap: "wrap", gap: 10 }}>
              <div><div style={{ fontWeight: 700, fontSize: 15 }}>{ex.session.name}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{fmt(ex.session.startDate)} – {fmt(ex.session.endDate)}</div></div>
              {ex.admitCard.allowed ? <Btn variant="accent" onClick={() => printAdmitCard(ex, session.student, settings)}><Icon name="printer" size={13} />Print Admit Card</Btn> : <Badge tone="danger" icon="lock">Admit card withheld</Badge>}
            </div>
            {ex.admitCard.feeBlocked && (
              <div style={{ margin: "0 18px 14px", background: "var(--danger-soft)", borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ flex: 1 }}>Your admit card is on hold because {money(ex.admitCard.feeDue)} in fees is overdue. It unlocks automatically as soon as the payment is recorded.</span>
                <Btn variant="ghost" onClick={() => navigate("/student/fees")}>Go to Fees</Btn>
              </div>
            )}
            <table className="table">
              <thead><tr><th>Date</th><th>Time</th><th>Paper</th><th>Room</th><th>Seat</th><th>Status</th></tr></thead>
              <tbody>{ex.papers.map(p => (
                <tr key={p._id}>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 600, color: "var(--ink)" }}>{dayLabel(p.date)}</td><td style={{ whiteSpace: "nowrap" }}>{fmtTime12h(p.startTime)} – {fmtTime12h(p.endTime)}</td>
                  <td>{p.subject?.name}</td><td>{p.room?.name || "—"}</td><td>{p.seatNo ?? "—"}</td>
                  <td>{p.eligible ? <Badge tone="success">Eligible</Badge> : <><Badge tone="danger">Not eligible</Badge><div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 3 }}>{p.reason}</div></>}</td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        ))}
    </>
  );
}

export function TeacherExamsPage() {
  const [papers, , loading] = useLoad("/api/examsuite/teaching", []);
  return (
    <>
      <SectionHeader eyebrow="Teaching" title="Exam Duties" />
      <Card style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead><tr><th>Date</th><th>Time</th><th>Examination</th><th>Paper</th><th>Room</th><th>Students</th><th>My role</th></tr></thead>
          <tbody>{(papers || []).map(p => (
            <tr key={p._id}><td style={{ whiteSpace: "nowrap", fontWeight: 600, color: "var(--ink)" }}>{dayLabel(p.date)}</td><td style={{ whiteSpace: "nowrap" }}>{fmtTime12h(p.startTime)} – {fmtTime12h(p.endTime)}</td>
              <td>{p.examSession?.name}</td><td>{p.subject?.name} <span style={{ color: "var(--muted)" }}>{p.section?.name}</span></td><td>{p.room?.name || "—"}</td><td>{p.students}</td>
              <td>{p.invigilating ? <Badge tone="accent">Invigilating</Badge> : <Badge tone="neutral">My paper</Badge>}</td></tr>
          ))}</tbody>
        </table>
        {!loading && !(papers || []).length && <EmptyState icon="file" title="No exam duties yet" desc="Papers for your classes and your invigilation duties appear here once a datesheet is published." />}
      </Card>
    </>
  );
}

// ═══════════════════════════ TEACHER EVALUATION ════════════════════════════
const Stars = ({ value }) => <span title={`${value} of 5`} style={{ whiteSpace: "nowrap" }}><strong>{value?.toFixed(2)}</strong><span style={{ color: "var(--muted)" }}> / 5</span></span>;

function SurveyResultsModal({ survey, onClose }) {
  const [data, , loading] = useLoad(`/api/smart/surveys/${survey._id}/results`);
  const [open, setOpen] = useState(null);
  return (
    <Modal wide title={`${survey.title} — Results`} onClose={onClose} footer={
      <Btn variant="ghost" disabled={!data?.classes?.length} onClick={() => downloadCsv("teacher-evaluation.csv", ["Teacher", "Subject", "Section", "Responses", "Overall", ...survey.questions], data.classes.map(c => [c.teacher?.name, c.subject?.name, c.section?.name, c.responses, c.overall, ...c.perQuestion.map(q => q.average)]))}><Icon name="file" size={13} />Export CSV</Btn>}>
      {loading || !data ? <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading…</div> : !data.classes.length ? <EmptyState icon="users" title="No responses yet" desc="Students fill this in from their portal while the survey is open. Responses are anonymous." /> : (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{data.total} anonymous response(s). Click a class for the breakdown and comments.</div>
          {data.classes.map((c, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10 }}>
              <div className="search-hit" style={{ padding: "11px 14px" }} onClick={() => setOpen(open === i ? null : i)}>
                <div style={{ flex: 1 }}><strong>{c.teacher?.name}</strong> <span style={{ color: "var(--muted)" }}>· {c.subject?.name} · {c.section?.name}</span></div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{c.responses} response{c.responses === 1 ? "" : "s"}</span><Stars value={c.overall} /><Icon name={open === i ? "chevronDown" : "chevronRight"} size={13} />
              </div>
              {open === i && (
                <div style={{ padding: "0 14px 14px", display: "grid", gap: 9 }}>
                  {c.perQuestion.map((q, j) => <div key={j}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4, gap: 10 }}><span>{q.text}</span><strong>{q.average?.toFixed(2)}</strong></div><ProgressBar pct={(q.average / 5) * 100} /></div>)}
                  {c.comments.length > 0 && <div style={{ display: "grid", gap: 5, marginTop: 4 }}>{c.comments.map((m, j) => <div key={j} style={{ background: "var(--surface-alt)", borderRadius: 8, padding: "7px 11px", fontSize: 12.5 }}>“{m}”</div>)}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function SurveysAdminPage() {
  const { api } = useSession();
  const [run] = useAction();
  const [viewing, setViewing] = useState(null);
  const setStatus = (row, status, ctx) => run(() => api.call("PATCH", `/api/smart/surveys/${row._id}`, { status }), `Survey ${status}`).then(ctx.reload);
  return (
    <>
      <ResourcePage eyebrow="Examinations" title="Teacher Evaluation" base="/api/smart/surveys" addLabel="New Survey" searchable={false}
        emptyDesc="Run an anonymous end-of-term evaluation: each student rates each of their teachers once. No response can be traced to a student."
        columns={[
          { key: "title", label: "Survey" }, { key: "academicSession.name", label: "Session" }, { key: "questions", label: "Questions", render: r => r.questions.length, csv: r => r.questions.length },
          { key: "closesOn", label: "Closes", type: "date" }, { key: "status", label: "Status", render: r => <Badge tone={r.status === "open" ? "success" : r.status === "draft" ? "warn" : "neutral"}>{humanize(r.status)}</Badge>, csv: r => r.status },
        ]}
        fields={[
          { name: "title", label: "Title", required: true, placeholder: "e.g. Fall 2026 Teacher Evaluation", full: true },
          { name: "academicSession", label: "Academic Session", type: "select", required: true, source: { path: "/api/academic-sessions", label: s => s.name } },
          { name: "closesOn", label: "Closes on", type: "date" },
        ]}
        rowActions={(row, ctx) => [
          row.status !== "open" && { label: row.status === "closed" ? "Reopen" : "Open to students", icon: "check", variant: "accent", onClick: () => setStatus(row, "open", ctx) },
          row.status === "open" && { label: "Close", icon: "x", onClick: () => setStatus(row, "closed", ctx) },
          { label: "Results", icon: "trend", onClick: () => setViewing(row) },
        ]} />
      {viewing && <SurveyResultsModal survey={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

const SCALE = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
export function StudentSurveysPage() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [pending, reload, loading] = useLoad("/api/smart/surveys/pending", []);
  const [open, setOpen] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [comment, setComment] = useState("");
  const start = p => { setOpen(p); setRatings(p.survey.questions.map(() => 0)); setComment(""); };
  const submit = () => run(() => api.call("POST", `/api/smart/surveys/${open.survey._id}/respond`, { teacherAssignment: open.teacherAssignment, ratings, comment }), "Thank you — your feedback was recorded anonymously").then(r => { if (r) { setOpen(null); reload(); } });
  return (
    <>
      <SectionHeader eyebrow="Support" title="Teacher Evaluation" />
      {loading ? <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
        : !(pending || []).length ? <Card style={{ padding: 24 }}><EmptyState icon="check" title="Nothing to fill in" desc="When an evaluation is open, your teachers are listed here. Your answers are anonymous — your name is never stored with them." /></Card> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
            {pending.map(p => (
              <Card key={p.survey._id + p.teacherAssignment} style={{ padding: 18 }}>
                <div style={{ fontSize: 11, color: "var(--accent-ink)", fontWeight: 700 }}>{p.survey.title}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{p.teacher?.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{p.subject?.name}</div>
                <Btn variant="accent" full onClick={() => start(p)} style={{ marginTop: 14 }}>Give Feedback</Btn>
              </Card>
            ))}
          </div>
        )}
      {open && (
        <Modal wide title={`${open.teacher?.name} — ${open.subject?.name}`} onClose={() => setOpen(null)} footer={<>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Anonymous · can't be changed once sent</span><div style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={() => setOpen(null)}>Cancel</Btn><Btn variant="accent" disabled={busy || ratings.some(r => !r)} onClick={submit}>Submit</Btn>
        </>}>
          <div style={{ display: "grid", gap: 14 }}>
            {open.survey.questions.map((q, i) => (
              <div key={i}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 7 }}>{i + 1}. {q}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {SCALE.map((label, j) => <button key={j} className={"badge " + (ratings[i] === j + 1 ? "accent" : "neutral")} style={{ border: "none", cursor: "pointer", padding: "7px 12px", fontFamily: "inherit", opacity: ratings[i] && ratings[i] !== j + 1 ? 0.55 : 1 }} onClick={() => setRatings(p => p.map((r, k) => (k === i ? j + 1 : r)))}>{j + 1} · {label}</button>)}
                </div>
              </div>
            ))}
            <div><label className="field-label">Anything else? (optional)</label><textarea className="input" rows={3} maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} placeholder="Avoid details that could identify you." /></div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function TeacherFeedbackPage() {
  const [data, , loading] = useLoad("/api/smart/surveys/mine", []);
  return (
    <>
      <SectionHeader eyebrow="My Employment" title="Student Feedback" />
      {loading ? <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
        : !(data || []).length ? <Card style={{ padding: 24 }}><EmptyState icon="trend" title="No feedback to show yet" desc="Results of teacher evaluations appear here after each survey closes." /></Card>
        : data.map(s => (
          <Card key={s.survey._id} style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.survey.title}</div>
              {!s.withheld && <span style={{ fontSize: 13 }}>{s.responses} responses · overall <Stars value={s.overall} /></span>}
            </div>
            {s.withheld ? <div style={{ fontSize: 13, color: "var(--muted)" }}>Only {s.responses} response(s) so far. Results are shown once at least 3 students have answered, so that no one's answers can be identified.</div> : (
              <div style={{ display: "grid", gap: 10 }}>
                {s.perQuestion.map((q, i) => <div key={i}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4, gap: 10 }}><span>{q.text}</span><strong>{q.average?.toFixed(2)}</strong></div><ProgressBar pct={(q.average / 5) * 100} /></div>)}
                {s.comments.length > 0 && <div style={{ display: "grid", gap: 5, marginTop: 6 }}>{s.comments.map((m, i) => <div key={i} style={{ background: "var(--surface-alt)", borderRadius: 8, padding: "7px 11px", fontSize: 12.5 }}>“{m}”</div>)}</div>}
              </div>
            )}
          </Card>
        ))}
    </>
  );
}

// ═══════════════════════════ PUBLIC VERIFICATION ═══════════════════════════
const CERT_NAMES = { bonafide: "Bonafide Certificate", character: "Character Certificate", transfer: "Transfer Certificate", completion: "Course Completion Certificate", id_card: "Student Identity Card", fee_clearance: "Fee Clearance Certificate" };
export function VerifyPage() {
  const { serial: fromUrl } = useParams();
  const { anonApi } = useSession();
  const { settings } = useSettings();
  const [serial, setSerial] = useState(fromUrl || "");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const check = async value => {
    if (!value.trim()) return;
    setBusy(true);
    try { setResult({ ok: true, ...(await anonApi.call("GET", `/api/engage/certificates/verify/${encodeURIComponent(value.trim())}`)) }); }
    catch (e) { setResult({ ok: false, message: e.message }); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (fromUrl) check(fromUrl); }, [fromUrl]);
  const meta = result?.ok ? statusMeta(result.status) : null;
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 18px" }}>
      <SectionHeader eyebrow={settings.instituteName} title="Verify a Certificate" />
      <form className="card" style={{ padding: 22 }} onSubmit={e => { e.preventDefault(); check(serial); }}>
        <label className="field-label">Serial number printed on the certificate</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input font-mono" placeholder="e.g. BON-000123" value={serial} onChange={e => setSerial(e.target.value)} />
          <Btn type="submit" variant="accent" disabled={busy || !serial.trim()}>{busy ? "Checking…" : "Verify"}</Btn>
        </div>
      </form>
      {result && (
        <div className="card" style={{ padding: 22, marginTop: 16, borderColor: result.ok && result.status === "valid" ? "var(--success)" : "var(--danger)" }}>
          {result.ok ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}><Icon name={result.status === "valid" ? "check" : "alert"} size={20} /><div style={{ fontWeight: 700, fontSize: 16 }}>{result.status === "valid" ? "Genuine certificate" : "This certificate has been revoked"}</div><Badge tone={meta.tone}>{meta.label}</Badge></div>
              <div className="kv">
                <div><div className="k">Issued to</div><div className="v">{result.studentName}</div></div><div><div className="k">Roll No</div><div className="v">{result.rollNo}</div></div>
                <div><div className="k">Document</div><div className="v">{CERT_NAMES[result.type] || humanize(result.type)}</div></div><div><div className="k">Issued on</div><div className="v">{fmt(result.issuedOn)}</div></div>
                <div><div className="k">Serial</div><div className="v font-mono">{result.serialNo}</div></div><div><div className="k">Issued by</div><div className="v">{result.institute}</div></div>
              </div>
            </>
          ) : <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600 }}><Icon name="alert" size={18} />{result.message}</div>}
        </div>
      )}
      <a href="/login" style={{ display: "inline-block", marginTop: 18, fontSize: 13, color: "var(--muted)" }}>← {settings.instituteName} portal</a>
    </div>
  );
}
