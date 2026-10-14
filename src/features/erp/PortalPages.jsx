import { useEffect, useRef, useState } from "react";
import { SectionHeader, StatCard, Card, Badge, Btn, Icon, EmptyState, Modal, Avatar, Chain, ProgressBar, Tabs } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { dateRange, fmt, fmtTime, humanize, statusMeta, today } from "../../lib/utils.js";
import { useLoad, useAction } from "./hooks.js";
import { TranscriptView } from "./ResultsPages.jsx";
import { ClaimModal } from "./SmartWidgets.jsx";

// Self-service screens for the student, parent and teacher portals.

// ═══════════════════════════ STUDENT: ASSIGNMENTS ══════════════════════════
function SubmitModal({ item, submission, onClose, onDone }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [form, setForm] = useState({ text: submission?.text || "", link: submission?.link || "" });
  const graded = !!submission?.gradedAt;
  return (
    <Modal wide title={item.title} onClose={onClose} footer={graded ? <Btn variant="accent" onClick={onClose}>Close</Btn> : <>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" disabled={busy || (!form.text.trim() && !form.link.trim())} onClick={() => run(() => api.call("POST", `/api/lms/student/coursework/${item._id}/submit`, form), "Work submitted").then(r => r && onDone())}>{submission ? "Resubmit" : "Submit"}</Btn>
    </>}>
      {item.description && <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 14, whiteSpace: "pre-wrap" }}>{item.description}</div>}
      {graded ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div className="kv">
            <div><div className="k">Marks</div><div className="v">{submission.marks}{item.totalMarks ? ` / ${item.totalMarks}` : ""}</div></div>
            <div><div className="k">Submitted</div><div className="v">{fmt(submission.submittedAt)}{submission.late ? " (late)" : ""}</div></div>
          </div>
          {submission.feedback && <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "11px 14px", fontSize: 13.5 }}><div className="k" style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>TEACHER FEEDBACK</div>{submission.feedback}</div>}
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{submission.text}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div><label className="field-label">Your answer</label><textarea className="input" rows={8} value={form.text} onChange={e => setForm(p => ({ ...p, text: e.target.value }))} /></div>
          <div><label className="field-label">Link to your work (Drive, GitHub, …)</label><input className="input" type="url" placeholder="https://" value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} /></div>
          {new Date(item.dueDate) < new Date() && <div style={{ fontSize: 12.5, color: "var(--warn)" }}>The due date has passed — this will be marked as a late submission.</div>}
        </div>
      )}
    </Modal>
  );
}

export function StudentAssignmentsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [subs, setSubs] = useState({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  const reload = () => Promise.all([api.getMyCoursework(), api.call("GET", "/api/lms/student/submissions")])
    .then(([list, s]) => { setItems(list); setSubs(Object.fromEntries(s.map(x => [x.assignment, x]))); })
    .catch(e => toast(e.message, "alert")).finally(() => setLoading(false));
  useEffect(() => { reload(); }, [api]);

  const pending = items.filter(i => !subs[i._id]);
  return (
    <>
      <SectionHeader eyebrow="Academics" title="Assignments" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="To Do" value={loading ? "…" : pending.length} icon="file" />
        <StatCard label="Overdue" value={loading ? "…" : pending.filter(i => new Date(i.dueDate) < new Date()).length} icon="alert" />
        <StatCard label="Submitted" value={loading ? "…" : items.length - pending.length} icon="check" />
        <StatCard label="Graded" value={loading ? "…" : Object.values(subs).filter(s => s.gradedAt).length} icon="award" />
      </div>
      {loading ? <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
        : items.length === 0 ? <Card style={{ padding: 24 }}><EmptyState icon="file" title="No assignments yet" desc="Work set by your teachers will appear here." /></Card> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 14 }}>
            {items.map(it => {
              const sub = subs[it._id];
              const overdue = !sub && new Date(it.dueDate) < new Date();
              return (
                <Card key={it._id} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--accent-ink)", fontWeight: 700 }}>{it.teacherAssignment?.subject?.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{it.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{it.teacherAssignment?.teacher?.name || "—"}{it.totalMarks ? ` · ${it.totalMarks} marks` : ""}</div>
                  <div style={{ marginTop: 6 }}>
                    {sub?.gradedAt ? <Badge tone="success">Graded {sub.marks}{it.totalMarks ? `/${it.totalMarks}` : ""}</Badge>
                      : sub ? <Badge tone="info">Submitted{sub.late ? " late" : ""}</Badge>
                      : <Badge tone={overdue ? "danger" : "warn"}>{overdue ? "Overdue" : `Due ${fmt(it.dueDate)}`}</Badge>}
                  </div>
                  <div style={{ flex: 1 }} />
                  <Btn variant={sub ? "ghost" : "accent"} full onClick={() => setOpen(it)} style={{ marginTop: 8 }}>{sub?.gradedAt ? "View feedback" : sub ? "Edit submission" : "Submit work"}</Btn>
                </Card>
              );
            })}
          </div>
        )}
      {open && <SubmitModal item={open} submission={subs[open._id]} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload(); }} />}
    </>
  );
}

// ═══════════════════════════ STUDENT: QUIZZES ══════════════════════════════
function QuizRunner({ quizId, onClose, onDone }) {
  const { api } = useSession();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [left, setLeft] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    api.call("POST", `/api/lms/student/quizzes/${quizId}/start`).then(d => { setData(d); setAnswers(d.questions.map(() => -1)); })
      .catch(e => { toast(e.message, "alert"); onClose(); });
  }, [quizId]);

  const submit = async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    try { setResult(await api.call("POST", `/api/lms/student/quizzes/${quizId}/submit`, { answers })); }
    catch (e) { toast(e.message, "alert"); submitted.current = false; }
    finally { setBusy(false); }
  };
  // Countdown runs off the server's end time, so reloading the page can't
  // reset it; the quiz hands itself in when it reaches zero.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (!data?.endsAt || result) return;
    const tick = () => { const s = Math.max(0, Math.round((new Date(data.endsAt) - Date.now()) / 1000)); setLeft(s); if (s === 0) submitRef.current(); };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data?.endsAt, !!result]);

  if (!data) return null;
  const unanswered = answers.filter(a => a < 0).length;
  const mmss = left == null ? null : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  if (result) {
    return (
      <Modal wide title={`${data.quiz.title} — Result`} onClose={onDone} footer={<Btn variant="accent" onClick={onDone}>Done</Btn>}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div className="font-display" style={{ fontSize: 40, fontWeight: 600 }}>{result.score} <span style={{ fontSize: 20, color: "var(--muted)" }}>/ {result.maxScore}</span></div>
          {result.overtime && <div style={{ fontSize: 13, color: "var(--danger)", marginTop: 4 }}>Submitted after the time limit — no marks awarded.</div>}
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {result.review.map((q, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>{i + 1}. {q.text}</div>
              {q.options.map((o, j) => (
                <div key={j} style={{ fontSize: 13, padding: "3px 0", display: "flex", gap: 8, alignItems: "center", color: j === q.correct ? "var(--success)" : j === q.chosen ? "var(--danger)" : "var(--ink-soft)", fontWeight: j === q.correct || j === q.chosen ? 600 : 400 }}>
                  <Icon name={j === q.correct ? "check" : j === q.chosen ? "x" : "chevronRight"} size={12} />{o}{j === q.chosen ? " (your answer)" : ""}{j === q.correct && j !== q.chosen ? " (correct answer)" : ""}
                </div>
              ))}
              {q.chosen < 0 && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Not answered</div>}
            </div>
          ))}
        </div>
      </Modal>
    );
  }
  return (
    <Modal wide title={data.quiz.title} onClose={() => window.confirm("Leave the quiz? The clock keeps running and your answers so far are not saved.") && onClose()} footer={<>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{unanswered ? `${unanswered} unanswered` : "All answered"}</span>
      <div style={{ flex: 1 }} />
      {mmss && <Badge tone={left < 60 ? "danger" : "info"} icon="clock">{mmss} left</Badge>}
      <Btn variant="accent" disabled={busy} onClick={() => (unanswered === 0 || window.confirm(`${unanswered} question(s) are unanswered. Submit anyway?`)) && submit()}>{busy ? "Submitting…" : "Submit Quiz"}</Btn>
    </>}>
      <div style={{ display: "grid", gap: 14 }}>
        {data.questions.map((q, i) => (
          <div key={q._id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>{i + 1}. {q.text} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({q.marks} mark{q.marks === 1 ? "" : "s"})</span></div>
            {q.options.map((o, j) => (
              <label key={j} style={{ display: "flex", gap: 9, alignItems: "center", padding: "6px 8px", borderRadius: 8, cursor: "pointer", fontSize: 13.5, background: answers[i] === j ? "var(--accent-soft)" : "transparent" }}>
                <input type="radio" name={`q${i}`} checked={answers[i] === j} onChange={() => setAnswers(p => p.map((a, k) => (k === i ? j : a)))} />{o}
              </label>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function StudentQuizzesPage() {
  const { api } = useSession();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [attempts, setAttempts] = useState({});
  const [loading, setLoading] = useState(true);
  const [taking, setTaking] = useState(null);

  const reload = () => Promise.all([api.getMyQuizzes(), api.call("GET", "/api/lms/student/attempts")])
    .then(([list, a]) => { setItems(list); setAttempts(Object.fromEntries(a.map(x => [x.quiz, x]))); })
    .catch(e => toast(e.message, "alert")).finally(() => setLoading(false));
  useEffect(() => { reload(); }, [api]);

  const start = q => window.confirm(`Start “${q.title}”?${q.durationMinutes ? ` You'll have ${q.durationMinutes} minutes, and the clock can't be paused.` : ""} You get one attempt.`) && setTaking(q._id);

  return (
    <>
      <SectionHeader eyebrow="Academics" title="Quizzes" />
      {loading ? <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
        : items.length === 0 ? <Card style={{ padding: 24 }}><EmptyState icon="trend" title="No quizzes yet" /></Card> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 14 }}>
            {items.map(it => {
              const done = attempts[it._id];
              const opens = new Date(it.scheduledAt), closed = it.closesAt && new Date(it.closesAt) < new Date();
              return (
                <Card key={it._id} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--accent-ink)", fontWeight: 700 }}>{it.teacherAssignment?.subject?.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{it.title}</div>
                  {it.description && <div style={{ fontSize: 12, color: "var(--muted)" }}>{it.description}</div>}
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{opens.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}{it.durationMinutes ? ` · ${it.durationMinutes} min` : ""}{it.totalMarks ? ` · ${it.totalMarks} marks` : ""}</div>
                  <div style={{ flex: 1 }} />
                  {done ? <Badge tone="success">Scored {done.score} / {done.maxScore}</Badge>
                    : opens > new Date() ? <Badge tone="info">Opens {fmt(opens)} {fmtTime(opens)}</Badge>
                    : closed ? <Badge tone="neutral">Closed</Badge>
                    : it.online ? <Btn variant="accent" full onClick={() => start(it)} style={{ marginTop: 6 }}>Start Quiz</Btn>
                    : <Badge tone="neutral">Held in class</Badge>}
                </Card>
              );
            })}
          </div>
        )}
      {taking && <QuizRunner quizId={taking} onClose={() => { setTaking(null); reload(); }} onDone={() => { setTaking(null); reload(); }} />}
    </>
  );
}

// ═══════════════════════════ STUDENT: LIBRARY / SERVICES / LEAVE ═══════════
export function StudentLibraryPage() {
  const { money } = useSettings();
  const [loans, , loading] = useLoad("/api/library/mine", []);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [books] = useLoad(`/api/library/catalogue${term ? `?q=${encodeURIComponent(term)}` : ""}`, []);
  useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const current = (loans || []).filter(l => l.status === "issued");
  const fines = (loans || []).filter(l => !l.finePaid).reduce((s, l) => s + (l.accruedFine || 0), 0);
  return (
    <>
      <SectionHeader eyebrow="Campus" title="Library" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Books With Me" value={loading ? "…" : current.length} icon="library" />
        <StatCard label="Overdue" value={loading ? "…" : current.filter(l => new Date(l.dueOn) < new Date()).length} icon="alert" />
        <StatCard label="Fines Due" value={loading ? "…" : money(fines)} icon="dollar" />
      </div>
      <Card style={{ padding: 0, overflow: "auto", marginBottom: 20 }}>
        <div style={{ padding: "14px 18px", fontWeight: 700, fontSize: 14 }}>My loans</div>
        {!loading && (loans || []).length === 0 ? <EmptyState icon="library" title="You haven't borrowed any books" desc="Ask at the library desk to borrow — search what's available below." /> : (
          <table className="table"><thead><tr><th>Book</th><th>Issued</th><th>Due</th><th>Fine</th><th>Status</th></tr></thead>
            <tbody>{(loans || []).map(l => {
              const overdue = l.status === "issued" && new Date(l.dueOn) < new Date();
              return <tr key={l._id}><td style={{ fontWeight: 600, color: "var(--ink)" }}>{l.book?.title}<span style={{ color: "var(--muted)", fontWeight: 400 }}> {l.book?.author}</span></td><td>{fmt(l.issuedOn)}</td><td>{fmt(l.dueOn)}</td><td>{l.accruedFine ? money(l.accruedFine) : "—"}</td>
                <td><Badge tone={overdue ? "danger" : statusMeta(l.status).tone}>{overdue ? "Overdue" : statusMeta(l.status).label}</Badge></td></tr>;
            })}</tbody></table>
        )}
      </Card>
      <Card style={{ padding: 0, overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Catalogue</div>
          <input className="input" style={{ maxWidth: 280 }} placeholder="Search title, author or category…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <table className="table"><thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Shelf</th><th>Availability</th></tr></thead>
          <tbody>{(books || []).map(b => <tr key={b._id}><td style={{ fontWeight: 600, color: "var(--ink)" }}>{b.title}</td><td>{b.author || "—"}</td><td>{b.category}</td><td>{b.shelf || "—"}</td><td><Badge tone={b.available > 0 ? "success" : "neutral"}>{b.available > 0 ? `${b.available} available` : "All on loan"}</Badge></td></tr>)}</tbody></table>
        {(books || []).length === 0 && <EmptyState icon="search" title={term ? "No books match" : "The catalogue is empty"} />}
      </Card>
    </>
  );
}

export function StudentServicesPage() {
  const { money } = useSettings();
  const [data, , loading] = useLoad("/api/campus/mine");
  const t = data?.transport, h = data?.hostel;
  const Block = ({ icon, title, empty, children }) => (
    <Card style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}><Icon name={icon} size={18} /><div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div></div>
      {children || <div style={{ fontSize: 13, color: "var(--muted)" }}>{empty}</div>}
    </Card>
  );
  return (
    <>
      <SectionHeader eyebrow="Campus" title="Transport & Hostel" />
      {loading ? <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
          <Block icon="bus" title="Transport" empty="You're not assigned to a transport route. Contact the transport office to register.">
            {t && <div className="kv">
              <div><div className="k">Route</div><div className="v">{t.route?.name}</div></div><div><div className="k">Vehicle</div><div className="v">{t.route?.vehicleNo || "—"}</div></div>
              <div><div className="k">My stop</div><div className="v">{t.stop || "—"}</div></div><div><div className="k">Driver</div><div className="v">{t.route?.driverName || "—"}{t.route?.driverPhone ? ` · ${t.route.driverPhone}` : ""}</div></div>
              <div><div className="k">Monthly fare</div><div className="v">{money(t.route?.monthlyFare)}</div></div>
              {t.route?.stops && <div style={{ gridColumn: "1 / -1" }}><div className="k">Stops</div><div className="v">{t.route.stops}</div></div>}
            </div>}
          </Block>
          <Block icon="bed" title="Hostel" empty="You don't have a hostel room. Contact the hostel warden to apply.">
            {h && <div className="kv">
              <div><div className="k">Hostel</div><div className="v">{h.room?.hostel?.name}</div></div><div><div className="k">Room</div><div className="v">{h.room?.number}{h.room?.floor ? ` · Floor ${h.room.floor}` : ""}</div></div>
              <div><div className="k">Since</div><div className="v">{fmt(h.from)}</div></div><div><div className="k">Monthly rent</div><div className="v">{money(h.room?.monthlyRent)}</div></div>
              <div><div className="k">Warden</div><div className="v">{h.room?.hostel?.warden || "—"}{h.room?.hostel?.wardenPhone ? ` · ${h.room.hostel.wardenPhone}` : ""}</div></div>
            </div>}
          </Block>
        </div>
      )}
    </>
  );
}

const LEAVE_TYPES = ["Medical", "casual", "Family Emergency", "Personal", "Academic", "Travel", "Other"];
export function StudentLeavesPage() {
  const { api } = useSession();
  const toast = useToast();
  const [run, busy] = useAction();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: "Medical", from: "", to: "", reason: "" });
  const reload = () => api.getLeaves().then(setLeaves).catch(e => toast(e.message, "alert")).finally(() => setLoading(false));
  useEffect(() => { reload(); }, [api]);

  const apply = () => {
    if (!form.from || !form.to) return toast("Choose the first and last day of leave", "alert");
    if (form.to < form.from) return toast("The last day can't be before the first day", "alert");
    if (!form.reason.trim()) return toast("Add a reason for the leave", "alert");
    run(() => api.applyLeave(form), "Leave request sent").then(r => { if (r) { setForm({ type: "Medical", from: "", to: "", reason: "" }); reload(); } });
  };
  const cancel = l => window.confirm("Cancel this leave request?") && run(() => api.deleteLeave(l._id), "Request cancelled").then(reload);

  return (
    <>
      <SectionHeader eyebrow="Support" title="Leave Requests" />
      <Card style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Apply for leave</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
          <div><label className="field-label">Type</label><select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>{LEAVE_TYPES.map(t => <option key={t} value={t}>{humanize(t)}</option>)}</select></div>
          <div><label className="field-label">First day</label><input className="input" type="date" min={today()} value={form.from} onChange={e => setForm(p => ({ ...p, from: e.target.value }))} /></div>
          <div><label className="field-label">Last day</label><input className="input" type="date" min={form.from || today()} value={form.to} onChange={e => setForm(p => ({ ...p, to: e.target.value }))} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Reason</label><textarea className="input" rows={2} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} /></div>
        </div>
        <Btn variant="accent" onClick={apply} disabled={busy} style={{ marginTop: 12 }}>Send Request</Btn>
      </Card>
      <Card style={{ padding: 0, overflow: "auto" }}>
        <table className="table"><thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th /></tr></thead>
          <tbody>{leaves.map(l => { const m = statusMeta(l.status); return (
            <tr key={l._id}><td style={{ fontWeight: 600, color: "var(--ink)" }}>{humanize(l.type)}</td><td>{fmt(l.from)}</td><td>{fmt(l.to)}</td><td>{dateRange(l.from, l.to).length}</td><td style={{ maxWidth: 260 }}>{l.reason}</td>
              <td><Badge tone={m.tone}>{m.label}</Badge></td><td style={{ textAlign: "right" }}>{l.status === "pending" && <Btn variant="ghost" style={{ padding: "5px 10px", fontSize: 12 }} disabled={busy} onClick={() => cancel(l)}>Cancel</Btn>}</td></tr>); })}</tbody></table>
        {!loading && leaves.length === 0 && <EmptyState icon="clipboard" title="No leave requests yet" />}
      </Card>
    </>
  );
}

// ═══════════════════════════ PARENT PORTAL ═════════════════════════════════
export function ParentDashboardPage() {
  const { session } = useSession();
  const { money } = useSettings();
  const [children, , loadingKids] = useLoad("/api/parent-portal/children", []);
  const [childId, setChildId] = useState("");
  const [tab, setTab] = useState("overview");
  useEffect(() => { if (!childId && children?.length) setChildId(children[0]._id); }, [children]);
  const [data, reloadChild, loading] = useLoad(childId ? `/api/parent-portal/children/${childId}/overview` : null);
  const [claims, reloadClaims] = useLoad("/api/smart/claims", []);
  const [claiming, setClaiming] = useState(null);
  const waitingFor = id => (claims || []).some(c => (c.fee?._id || c.fee) === id && c.status === "pending");

  if (!loadingKids && !(children || []).length) {
    return <><SectionHeader eyebrow="Parent Portal" title={`Welcome, ${session.parent?.name || "Parent"}`} /><Card style={{ padding: 24 }}><EmptyState icon="users" title="No students are linked to your account yet" desc="Please contact the institute office so they can link your child's record to you." /></Card></>;
  }
  const c = data?.child, enr = c?.currentEnrollment, att = data?.attendance;
  const low = att?.rate != null && att.rate < (data?.minAttendancePercent ?? 75);

  return (
    <>
      <SectionHeader eyebrow="Parent Portal" title={`Welcome, ${session.parent?.name || "Parent"}`} />
      {(children || []).length > 1 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {children.map(k => (
            <Card key={k._id} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", borderColor: k._id === childId ? "var(--accent)" : "var(--border)" }} onClick={() => setChildId(k._id)}>
              <Avatar name={k.name} size={30} img={k.photo || undefined} /><div><div style={{ fontWeight: 700, fontSize: 13 }}>{k.name}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>#{k.rollNo}</div></div>
            </Card>
          ))}
        </div>
      )}
      {loading || !data ? <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card> : (
        <>
          <Card style={{ padding: 18, marginBottom: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <Avatar name={c.name} size={54} img={c.photo || undefined} />
            <div><div className="font-display" style={{ fontSize: 20, fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>Roll #{c.rollNo}</div>
              {enr && <Chain items={[enr.program?.name, enr.section?.name, enr.academicSession?.name]} />}</div>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 16 }}>
            <StatCard label={low ? `Attendance (below ${data.minAttendancePercent}%)` : "Attendance"} value={att.rate != null ? `${att.rate}%` : "—"} icon={low ? "alert" : "clipboard"} />
            <StatCard label="CGPA" value={data.transcript.cgpa != null ? data.transcript.cgpa.toFixed(2) : "—"} icon="award" />
            <StatCard label="Fee Balance" value={money(data.fees.balance)} icon="dollar" />
            <StatCard label="Work Due" value={data.coursework.length} icon="file" />
          </div>
          <Tabs items={[{ key: "overview", label: "Overview" }, { key: "results", label: "Results" }, { key: "fees", label: "Fees" }]} active={tab} onChange={setTab} style={{ marginBottom: 16 }} />
          {tab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
              <Card style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Attendance by subject</div>
                {att.subjects.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>No attendance recorded yet.</div> : (
                  <div style={{ display: "grid", gap: 12 }}>{att.subjects.map(a => (
                    <div key={a.subject?._id || a.subject}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}><span>{a.subject?.name}</span><strong>{a.rate}% <span style={{ color: "var(--muted)", fontWeight: 400 }}>({a.present}/{a.total})</span></strong></div><ProgressBar pct={a.rate} /></div>
                  ))}</div>
                )}
              </Card>
              <Card style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Subjects & teachers</div>
                {data.subjects.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>Not enrolled in any subjects yet.</div> : (
                  <div style={{ display: "grid", gap: 9 }}>{data.subjects.map(s => <div key={s.subject?._id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 10 }}><span style={{ fontWeight: 600 }}>{s.subject?.name}</span><span style={{ color: "var(--muted)" }}>{s.teacher?.name || "—"}</span></div>)}</div>
                )}
              </Card>
              <Card style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Upcoming assignments</div>
                {data.coursework.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>Nothing due.</div> : (
                  <div style={{ display: "grid", gap: 9 }}>{data.coursework.map(w => <div key={w._id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 10 }}><span><strong>{w.title}</strong> <span style={{ color: "var(--muted)" }}>{w.teacherAssignment?.subject?.name}</span></span><span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>Due {fmt(w.dueDate)}</span></div>)}</div>
                )}
              </Card>
              <Card style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Recent leave requests</div>
                {data.leaves.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>None.</div> : (
                  <div style={{ display: "grid", gap: 9 }}>{data.leaves.map(l => <div key={l._id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 10, alignItems: "center" }}><span>{humanize(l.type)} · {fmt(l.from)} – {fmt(l.to)}</span><Badge tone={statusMeta(l.status).tone}>{statusMeta(l.status).label}</Badge></div>)}</div>
                )}
              </Card>
            </div>
          )}
          {tab === "results" && <TranscriptView transcript={data.transcript} student={c} />}
          {tab === "fees" && (
            <Card style={{ padding: 0, overflow: "auto" }}>
              <table className="table"><thead><tr><th>Fee</th><th>Due</th><th>Net Payable</th><th>Paid</th><th>Balance</th><th>Status</th><th /></tr></thead>
                <tbody>{data.fees.items.map(f => { const overdue = f.balance > 0 && new Date(f.dueDate) < new Date(); const m = statusMeta(overdue ? "overdue" : f.status); return (
                  <tr key={f._id}><td style={{ fontWeight: 600, color: "var(--ink)" }}>{f.title}{f.period ? <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {f.period}</span> : null}</td><td>{fmt(f.dueDate)}</td><td>{money(f.netAmount)}</td><td>{money(f.netAmount - f.balance)}</td><td>{money(f.balance)}</td><td>{waitingFor(f._id) ? <Badge tone="info">Awaiting verification</Badge> : <Badge tone={m.tone}>{m.label}</Badge>}</td>
                    <td style={{ textAlign: "right" }}>{f.balance > 0 && !waitingFor(f._id) && <Btn variant="accent" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setClaiming(f)}>I've paid this</Btn>}</td></tr>); })}</tbody></table>
              {data.fees.items.length === 0 && <EmptyState icon="dollar" title="No fees billed yet" />}
              {claiming && <ClaimModal fee={claiming} onClose={() => setClaiming(null)} onDone={() => { setClaiming(null); reloadClaims(); reloadChild(); }} />}
            </Card>
          )}
        </>
      )}
    </>
  );
}

// ═══════════════════════════ TEACHER: SUBMISSIONS & QUIZ BUILDER ═══════════
export function SubmissionsModal({ item, onClose }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [data, reload, loading] = useLoad(`/api/lms/teacher/coursework/${item._id}/submissions`);
  const [grading, setGrading] = useState({}); // submissionId → { marks, feedback }
  const [similarity, setSimilarity] = useState(null);
  const checkSimilarity = () => run(() => api.call("GET", `/api/lms/teacher/coursework/${item._id}/similarity`)).then(r => r && setSimilarity(r));
  const rows = data?.rows || [];
  const handed = rows.filter(r => r.submission);
  const edit = (id, k, v) => setGrading(p => ({ ...p, [id]: { ...p[id], [k]: v } }));
  const save = sub => {
    const g = grading[sub._id] || {};
    run(() => api.call("PATCH", `/api/lms/teacher/submissions/${sub._id}/grade`, { marks: g.marks ?? sub.marks, feedback: g.feedback ?? sub.feedback }), "Grade saved").then(r => r && reload());
  };
  return (
    <Modal wide title={`Submissions — ${item.title}`} onClose={onClose}>
      {loading ? <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading…</div> : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{handed.length} of {rows.length} submitted · {handed.filter(r => r.submission.gradedAt).length} graded{item.totalMarks ? ` · out of ${item.totalMarks}` : ""}</div>
            {handed.length >= 2 && <Btn variant="ghost" disabled={busy} onClick={checkSimilarity}><Icon name="search" size={13} />Check for copying</Btn>}
          </div>
          {similarity && (
            <div style={{ background: similarity.pairs.length ? "var(--warn-soft)" : "var(--success-soft)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 14 }}>
              {similarity.pairs.length === 0 ? <>No suspicious overlap among {similarity.compared} submissions{similarity.tooShort ? ` (${similarity.tooShort} too short to compare)` : ""}.</> : (
                <>
                  <strong>{similarity.pairs.length} pair(s) worth reading side by side</strong> — overlap is a reason to look, not proof.
                  {similarity.pairs.map((p, i) => <div key={i} style={{ marginTop: 5 }}><Badge tone={p.score >= 80 ? "danger" : "warn"}>{p.score}%</Badge> {p.a.student.name} ↔ {p.b.student.name} — {p.why}</div>)}
                </>
              )}
            </div>
          )}
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map(({ student, submission: sub }) => (
              <div key={student._id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{student.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>#{student.rollNo}</span></div>
                  {!sub ? <Badge tone="neutral">Not submitted</Badge> : <Badge tone={sub.gradedAt ? "success" : sub.late ? "warn" : "info"}>{sub.gradedAt ? `Graded ${sub.marks}` : sub.late ? "Submitted late" : "Submitted"} · {fmt(sub.submittedAt)}</Badge>}
                </div>
                {sub && (
                  <>
                    {sub.text && <div style={{ fontSize: 13, marginTop: 8, whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 160, overflowY: "auto", background: "var(--surface-alt)", borderRadius: 8, padding: "8px 10px" }}>{sub.text}</div>}
                    {sub.link && <a href={sub.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "var(--accent)", display: "inline-block", marginTop: 6, overflowWrap: "anywhere" }}>{sub.link}</a>}
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <input className="input" type="number" min="0" max={item.totalMarks ?? undefined} placeholder="Marks" style={{ width: 90 }} value={grading[sub._id]?.marks ?? sub.marks ?? ""} onChange={e => edit(sub._id, "marks", e.target.value)} />
                      <input className="input" placeholder="Feedback for the student" style={{ flex: "1 1 200px" }} value={grading[sub._id]?.feedback ?? sub.feedback ?? ""} onChange={e => edit(sub._id, "feedback", e.target.value)} />
                      <Btn variant="accent" disabled={busy || (grading[sub._id]?.marks ?? sub.marks ?? "") === ""} onClick={() => save(sub)}>{sub.gradedAt ? "Update" : "Grade"}</Btn>
                    </div>
                  </>
                )}
              </div>
            ))}
            {rows.length === 0 && <EmptyState icon="users" title="No students in this section" />}
          </div>
        </>
      )}
    </Modal>
  );
}

export function QuizBuilderModal({ quiz, onClose, onSaved }) {
  const { api } = useSession();
  const toast = useToast();
  const [run, busy] = useAction();
  const [tab, setTab] = useState("questions");
  const [questions, setQuestions] = useState(null);
  const [results, , resultsLoading] = useLoad(`/api/lms/teacher/quizzes/${quiz._id}/results`);
  useEffect(() => {
    api.call("GET", `/api/lms/teacher/quizzes/${quiz._id}`).then(q => setQuestions(q.questions.map(x => ({ text: x.text, options: [...x.options], correctIndex: x.correctIndex, marks: x.marks })))).catch(e => toast(e.message, "alert"));
  }, [quiz._id]);

  const started = (results?.rows || []).some(r => r.status !== "not_started");
  const patch = (i, k, v) => setQuestions(p => p.map((q, j) => (j === i ? { ...q, [k]: v } : q)));
  const patchOpt = (i, o, v) => setQuestions(p => p.map((q, j) => (j === i ? { ...q, options: q.options.map((x, y) => (y === o ? v : x)) } : q)));
  // Removing an option keeps the answer key pointing at the same option
  // (or falls back to the first one if the correct option itself went).
  const removeOpt = (i, o) => setQuestions(p => p.map((q, j) => (j !== i ? q : {
    ...q, options: q.options.filter((_, y) => y !== o),
    correctIndex: o < q.correctIndex ? q.correctIndex - 1 : o === q.correctIndex ? 0 : q.correctIndex,
  })));
  const save = () => run(() => api.call("PUT", `/api/lms/teacher/quizzes/${quiz._id}/questions`, { questions }), "Questions saved").then(r => r && onSaved());

  return (
    <Modal wide title={`Quiz — ${quiz.title}`} onClose={onClose} footer={tab === "questions" && !started ? <>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{questions?.length || 0} question(s) · {(questions || []).reduce((s, q) => s + (Number(q.marks) || 0), 0)} marks</span>
      <div style={{ flex: 1 }} /><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={save} disabled={busy || !questions}>Save Questions</Btn>
    </> : null}>
      <Tabs items={[{ key: "questions", label: "Questions" }, { key: "results", label: "Results" }]} active={tab} onChange={setTab} style={{ marginBottom: 16 }} />
      {tab === "questions" && (!questions ? <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading…</div> : (
        <div style={{ display: "grid", gap: 12 }}>
          {started && <div style={{ fontSize: 12.5, color: "var(--warn)" }}>Students have started this quiz, so its questions are locked.</div>}
          {questions.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>No questions yet. Add multiple-choice questions and students can take this quiz online — it is marked automatically.</div>}
          {questions.map((q, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input" disabled={started} placeholder={`Question ${i + 1}`} value={q.text} onChange={e => patch(i, "text", e.target.value)} />
                <input className="input" disabled={started} type="number" min="1" title="Marks" style={{ width: 74 }} value={q.marks} onChange={e => patch(i, "marks", e.target.value)} />
                {!started && <button className="icon-btn" onClick={() => setQuestions(p => p.filter((_, j) => j !== i))}><Icon name="x" size={13} /></button>}
              </div>
              {q.options.map((o, j) => (
                <div key={j} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="radio" disabled={started} name={`correct-${i}`} checked={q.correctIndex === j} onChange={() => patch(i, "correctIndex", j)} title="Mark as the correct answer" />
                  <input className="input" disabled={started} placeholder={`Option ${j + 1}`} value={o} onChange={e => patchOpt(i, j, e.target.value)} />
                  {!started && q.options.length > 2 && <button className="icon-btn" onClick={() => removeOpt(i, j)}><Icon name="x" size={12} /></button>}
                </div>
              ))}
              {!started && q.options.length < 6 && <Btn variant="ghost" style={{ width: "fit-content", padding: "5px 10px", fontSize: 12 }} onClick={() => patch(i, "options", [...q.options, ""])}><Icon name="plus" size={12} />Option</Btn>}
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Select the radio button beside the correct answer.</div>
            </div>
          ))}
          {!started && <Btn variant="ghost" style={{ width: "fit-content" }} onClick={() => setQuestions(p => [...p, { text: "", options: ["", "", "", ""], correctIndex: 0, marks: 1 }])}><Icon name="plus" size={13} />Add question</Btn>}
        </div>
      ))}
      {tab === "results" && (resultsLoading || !results ? <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading…</div> : (
        <div style={{ display: "grid", gap: 14 }}>
          <div className="kv">
            <div><div className="k">Submitted</div><div className="v">{results.rows.filter(r => r.status === "submitted").length} / {results.rows.length}</div></div>
            <div><div className="k">Class average</div><div className="v">{results.average != null ? `${results.average} / ${results.quiz.totalMarks ?? "—"}` : "—"}</div></div>
          </div>
          {results.questionStats.some(q => q.correctRate != null) && (
            <div style={{ display: "grid", gap: 9 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>How the class did on each question</div>
              {results.questionStats.map((q, i) => <div key={i}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4, gap: 10 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i + 1}. {q.text}</span><strong>{q.correctRate}% correct</strong></div><ProgressBar pct={q.correctRate} /></div>)}
            </div>
          )}
          <table className="table"><thead><tr><th>Student</th><th>Status</th><th>Score</th><th>Submitted</th></tr></thead>
            <tbody>{results.rows.map(r => <tr key={r.student._id}><td style={{ fontWeight: 600, color: "var(--ink)" }}>{r.student.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>#{r.student.rollNo}</span></td>
              <td><Badge tone={r.status === "submitted" ? "success" : r.status === "in_progress" ? "info" : "neutral"}>{humanize(r.status)}</Badge></td><td>{r.score != null ? `${r.score} / ${r.maxScore}` : "—"}</td><td>{r.submittedAt ? `${fmt(r.submittedAt)} ${fmtTime(r.submittedAt)}` : "—"}</td></tr>)}</tbody></table>
        </div>
      ))}
    </Modal>
  );
}
