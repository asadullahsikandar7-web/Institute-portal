import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, Badge, Btn, Icon, EmptyState, Modal, ProgressBar } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { fmt, fmtTime, fmtTime12h, humanize, statusMeta, today } from "../../lib/utils.js";
import { useLoad, useAction } from "./hooks.js";

// Operations screens: automations, substitute cover, parent–teacher
// meetings and institutional insights.

// ═══════════════════════════ AUTOMATIONS ═══════════════════════════════════
export function AutomationsPage() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [rules, reload, loading] = useLoad("/api/automations", []);
  const patch = (r, body) => run(() => api.call("PATCH", `/api/automations/${r.key}`, body), body.enabled === true ? `“${r.title}” is on` : body.enabled === false ? `“${r.title}” is off` : "Saved").then(reload);
  const runNow = r => run(() => api.call("POST", `/api/automations/${r.key}/run`), o => `${r.title}: ${o.detail}${o.emailed ? ` · ${o.emailed} email(s)` : ""}`).then(reload);
  const list = rules || [];
  return (
    <>
      <SectionHeader eyebrow="System" title="Automations" />
      <Card style={{ padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "var(--ink-soft)" }}>
        Rules that do routine follow-up on their own, every hour. Each one acts at most once per student / fee / book, so nobody is messaged twice. <strong>All rules start switched off</strong> — several of them contact parents, so turn on only what your institute wants. Email also needs the mail server configured; in-app notifications always work.
      </Card>
      {loading ? <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card> : (
        <div style={{ display: "grid", gap: 12 }}>
          {list.map(r => (
            <Card key={r.key} style={{ padding: 18, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", borderColor: r.enabled ? "var(--accent)" : undefined }}>
              <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14.5 }}>{r.title}</strong><Badge tone="neutral">{r.audience}</Badge>{r.enabled && <Badge tone="success">On</Badge>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>{r.description}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
                  {r.lastRunAt ? `Last run ${fmt(r.lastRunAt)} ${fmtTime(r.lastRunAt)} — ${r.lastResult}` : "Never run"} · {r.actionsLast30Days} action(s) in the last 30 days
                </div>
              </div>
              {!["risk-escalation", "ticket-autoclose"].includes(r.key) && (
                <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}><input type="checkbox" checked={r.email} disabled={busy} onChange={e => patch(r, { email: e.target.checked })} />Also email</label>
              )}
              <Btn variant="ghost" disabled={busy} onClick={() => runNow(r)}>Run now</Btn>
              <Btn variant={r.enabled ? "danger" : "accent"} disabled={busy} onClick={() => patch(r, { enabled: !r.enabled })}>{r.enabled ? "Turn off" : "Turn on"}</Btn>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════ SUBSTITUTE COVER ══════════════════════════════
export function SubstitutionsPage() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [teachers] = useLoad("/api/teachers", []);
  const [form, setForm] = useState({ teacher: "", from: today(), to: today() });
  const [plan, setPlan] = useState(null);
  const [upcoming, reloadUpcoming] = useLoad("/api/ops/substitutions", []);
  const load = () => form.teacher && run(() => api.call("GET", `/api/ops/substitutions/plan?teacher=${form.teacher}&from=${form.from}&to=${form.to}`)).then(r => r && setPlan(r));
  const assign = (p, substitute) => run(() => api.call("POST", "/api/ops/substitutions", { date: p.date, entry: p.entry._id, substitute, reason: "Teacher absent" }), "Cover arranged — the teacher has been notified").then(r => { if (r) { load(); reloadUpcoming(); } });
  const remove = id => run(() => api.call("DELETE", `/api/ops/substitutions/${id}`), "Cover removed").then(() => { load(); reloadUpcoming(); });

  return (
    <>
      <SectionHeader eyebrow="Academic" title="Substitute Cover" />
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>Pick the teacher who will be away. Every period they would have taught is listed with colleagues who are genuinely free then — not teaching, not already covering, not on leave — best fit first.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, alignItems: "end" }}>
          <div><label className="field-label">Teacher away</label>
            <select className="input" value={form.teacher} onChange={e => setForm(p => ({ ...p, teacher: e.target.value }))}><option value="">Select…</option>{(teachers || []).filter(t => t.isActive !== false).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
          <div><label className="field-label">From</label><input className="input" type="date" value={form.from} onChange={e => setForm(p => ({ ...p, from: e.target.value, to: p.to < e.target.value ? e.target.value : p.to }))} /></div>
          <div><label className="field-label">To</label><input className="input" type="date" min={form.from} value={form.to} onChange={e => setForm(p => ({ ...p, to: e.target.value }))} /></div>
          <Btn variant="accent" disabled={busy || !form.teacher} onClick={load}><Icon name="search" size={13} />Find cover</Btn>
        </div>
      </Card>
      {plan && (
        <Card style={{ padding: 0, overflow: "auto", marginBottom: 18 }}>
          <div style={{ padding: "14px 18px", fontWeight: 700, fontSize: 14 }}>{plan.periods.length ? `${plan.periods.length} period(s) to cover — ${plan.covered} arranged` : "No periods to cover in that range (no timetable, weekends or holidays)."}</div>
          {plan.periods.map(p => (
            <div key={p.date + p.entry._id} style={{ borderTop: "1px solid var(--border)", padding: "12px 18px", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{fmt(p.date)} · {fmtTime12h(p.entry.startTime)}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{p.entry.subject?.name} · {p.entry.program?.code} {p.entry.section?.name} · {p.entry.room?.name}</div>
              </div>
              {p.substitution ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
                  <Badge tone="success" icon="check">Covered by {p.substitution.substitute?.name}</Badge>
                  <Btn variant="ghost" style={{ padding: "4px 9px", fontSize: 12 }} disabled={busy} onClick={() => remove(p.substitution._id)}>Remove</Btn>
                </div>
              ) : p.suggestions.length === 0 ? <Badge tone="danger">Nobody is free at this time</Badge> : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
                  {p.suggestions.map((s, i) => (
                    <button key={s.teacher._id} className="search-hit" disabled={busy} onClick={() => assign(p, s.teacher._id)} style={{ border: `1px solid ${i === 0 ? "var(--accent)" : "var(--border)"}`, background: "var(--surface-alt)", font: "inherit", color: "inherit", textAlign: "left", padding: "7px 11px" }}>
                      <div><div style={{ fontSize: 13, fontWeight: 700 }}>{s.teacher.name}{i === 0 && <span style={{ color: "var(--accent)", fontWeight: 600 }}> · best fit</span>}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{s.reasons.join(" · ")}</div></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
      <Card style={{ padding: 0, overflow: "auto" }}>
        <div style={{ padding: "14px 18px", fontWeight: 700, fontSize: 14 }}>Upcoming cover</div>
        {!(upcoming || []).length ? <EmptyState icon="calendar" title="No cover arranged" /> : (
          <table className="table"><thead><tr><th>Date</th><th>Time</th><th>Class</th><th>Away</th><th>Covering</th><th /></tr></thead>
            <tbody>{upcoming.map(s => (
              <tr key={s._id}><td style={{ fontWeight: 600, color: "var(--ink)" }}>{fmt(s.date)}</td><td>{fmtTime12h(s.entry?.startTime)}</td><td>{s.entry?.subject?.name} · {s.entry?.section?.name} · {s.entry?.room?.name}</td><td>{s.absentTeacher?.name}</td><td>{s.substitute?.name}</td>
                <td style={{ textAlign: "right" }}><Btn variant="ghost" style={{ padding: "4px 9px", fontSize: 12 }} disabled={busy} onClick={() => remove(s._id)}>Remove</Btn></td></tr>
            ))}</tbody></table>
        )}
      </Card>
    </>
  );
}

export function TeacherCoversPage() {
  const [covers, , loading] = useLoad("/api/ops/substitutions/mine", []);
  return (
    <>
      <SectionHeader eyebrow="Teaching" title="Cover Duties" />
      <Card style={{ padding: 0, overflow: "auto" }}>
        {loading ? <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading…</div> : !(covers || []).length ? <EmptyState icon="calendar" title="No cover duties" desc="When you are asked to take a colleague's class, it appears here and in your notifications." /> : (
          <table className="table"><thead><tr><th>Date</th><th>Time</th><th>Class</th><th>Room</th><th>Covering for</th><th>Note</th></tr></thead>
            <tbody>{covers.map(c => (
              <tr key={c._id}><td style={{ fontWeight: 600, color: "var(--ink)" }}>{fmt(c.date)}</td><td>{fmtTime12h(c.entry?.startTime)} – {fmtTime12h(c.entry?.endTime)}</td><td>{c.entry?.subject?.name} · {c.entry?.program?.code} {c.entry?.section?.name}</td><td>{c.entry?.room?.name}</td><td>{c.absentTeacher?.name}</td><td>{c.note || "—"}</td></tr>
            ))}</tbody></table>
        )}
      </Card>
    </>
  );
}

// ═══════════════════════════ PARENT–TEACHER MEETINGS ═══════════════════════
const MODES = { in_person: "In person", online: "Online", phone: "Phone" };

export function TeacherMeetingsPage() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [slots, reload, loading] = useLoad("/api/ops/meetings/mine", []);
  const [form, setForm] = useState({ date: "", from: "14:00", to: "16:00", minutes: 15, mode: "in_person", location: "" });
  const [closing, setClosing] = useState(null);
  const [outcome, setOutcome] = useState("");
  const publish = () => {
    const start = new Date(`${form.date}T${form.from}`), end = new Date(`${form.date}T${form.to}`);
    run(() => api.call("POST", "/api/ops/meetings/slots", { start: start.toISOString(), end: end.toISOString(), minutes: form.minutes, mode: form.mode, location: form.location }), o => `${o.created} slot(s) published${o.skipped ? `, ${o.skipped} already existed` : ""}`).then(reload);
  };
  const setStatus = (s, status, extra = {}) => run(() => api.call("PATCH", `/api/ops/meetings/${s._id}`, { status, ...extra }), status === "done" ? "Meeting notes saved" : "Slot cancelled").then(() => { setClosing(null); setOutcome(""); reload(); });
  const list = slots || [];
  const booked = list.filter(s => s.status === "booked");
  return (
    <>
      <SectionHeader eyebrow="Communication" title="Parent Meetings" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 16 }}>
        <StatCard label="Booked" value={loading ? "…" : booked.length} icon="users" /><StatCard label="Open Slots" value={loading ? "…" : list.filter(s => s.status === "open").length} icon="calendar" /><StatCard label="Held" value={loading ? "…" : list.filter(s => s.status === "done").length} icon="check" />
      </div>
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Publish meeting slots</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, alignItems: "end" }}>
          <div><label className="field-label">Date</label><input className="input" type="date" min={today()} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
          <div><label className="field-label">From</label><input className="input" type="time" value={form.from} onChange={e => setForm(p => ({ ...p, from: e.target.value }))} /></div>
          <div><label className="field-label">To</label><input className="input" type="time" value={form.to} onChange={e => setForm(p => ({ ...p, to: e.target.value }))} /></div>
          <div><label className="field-label">Each meeting</label><select className="input" value={form.minutes} onChange={e => setForm(p => ({ ...p, minutes: Number(e.target.value) }))}>{[10, 15, 20, 30].map(m => <option key={m} value={m}>{m} min</option>)}</select></div>
          <div><label className="field-label">Mode</label><select className="input" value={form.mode} onChange={e => setForm(p => ({ ...p, mode: e.target.value }))}>{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="field-label">Where / link</label><input className="input" placeholder="Staff room, or meeting link" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} /></div>
          <Btn variant="accent" disabled={busy || !form.date} onClick={publish}>Publish</Btn>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>Parents of students you teach can book these from the parent portal. You'll get a notification for each booking.</div>
      </Card>
      <Card style={{ padding: 0, overflow: "auto" }}>
        {!list.length ? <EmptyState icon="calendar" title="No slots yet" /> : (
          <table className="table"><thead><tr><th>When</th><th>Status</th><th>Parent</th><th>About</th><th>Agenda / notes</th><th /></tr></thead>
            <tbody>{list.map(s => (
              <tr key={s._id}>
                <td style={{ whiteSpace: "nowrap", fontWeight: 600, color: "var(--ink)" }}>{fmt(s.start)} · {fmtTime(s.start)}<div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 400 }}>{MODES[s.mode]}{s.location ? ` · ${s.location}` : ""}</div></td>
                <td><Badge tone={s.status === "booked" ? "accent" : s.status === "done" ? "success" : "neutral"}>{humanize(s.status)}</Badge></td>
                <td>{s.parent ? <>{s.parent.name}<div style={{ fontSize: 11.5, color: "var(--muted)" }}>{s.parent.phone || s.parent.email}</div></> : "—"}</td>
                <td>{s.student?.name || "—"}</td>
                <td style={{ maxWidth: 260, fontSize: 12.5 }}>{s.outcome || s.agenda || "—"}</td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  {s.status === "booked" && <Btn variant="accent" style={{ padding: "4px 9px", fontSize: 12, marginRight: 6 }} onClick={() => { setClosing(s); setOutcome(""); }}>Record outcome</Btn>}
                  {["open", "booked"].includes(s.status) && <Btn variant="ghost" style={{ padding: "4px 9px", fontSize: 12 }} disabled={busy} onClick={() => window.confirm(s.parent ? "Cancel this booked meeting? The parent will be notified." : "Remove this slot?") && setStatus(s, "cancelled")}>Cancel</Btn>}
                </td>
              </tr>
            ))}</tbody></table>
        )}
      </Card>
      {closing && (
        <Modal title={`Meeting with ${closing.parent?.name}`} onClose={() => setClosing(null)} footer={<><Btn variant="ghost" onClick={() => setClosing(null)}>Cancel</Btn><Btn variant="accent" disabled={busy || !outcome.trim()} onClick={() => setStatus(closing, "done", { outcome })}>Save</Btn></>}>
          <label className="field-label">What was discussed and agreed?</label>
          <textarea className="input" rows={5} value={outcome} onChange={e => setOutcome(e.target.value)} />
        </Modal>
      )}
    </>
  );
}

export function ParentMeetingsPage() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [available, reloadAvail, loading] = useLoad("/api/ops/meetings/available", []);
  const [booked, reloadBooked] = useLoad("/api/ops/meetings/booked", []);
  const [picking, setPicking] = useState(null);
  const [agenda, setAgenda] = useState("");
  const reload = () => { reloadAvail(); reloadBooked(); };
  const book = slot => run(() => api.call("POST", `/api/ops/meetings/${slot._id}/book`, { student: picking.child._id, agenda }), "Meeting booked — the teacher has been notified").then(r => { if (r) { setPicking(null); setAgenda(""); reload(); } });
  const cancel = s => window.confirm("Cancel this meeting?") && run(() => api.call("POST", `/api/ops/meetings/${s._id}/cancel`), "Meeting cancelled").then(reload);
  const upcoming = (booked || []).filter(s => s.status === "booked");
  return (
    <>
      <SectionHeader eyebrow="School" title="Parent–Teacher Meetings" />
      {upcoming.length > 0 && (
        <Card style={{ padding: 0, overflow: "auto", marginBottom: 16, borderColor: "var(--accent)" }}>
          <div style={{ padding: "14px 18px", fontWeight: 700, fontSize: 14 }}>Your upcoming meetings</div>
          <table className="table"><tbody>{upcoming.map(s => (
            <tr key={s._id}><td style={{ fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>{fmt(s.start)} · {fmtTime(s.start)}</td><td>{s.teacher?.name}</td><td>about {s.student?.name}</td><td>{MODES[s.mode]}{s.location ? ` · ${s.location}` : ""}</td>
              <td style={{ textAlign: "right" }}><Btn variant="ghost" style={{ padding: "4px 9px", fontSize: 12 }} disabled={busy} onClick={() => cancel(s)}>Cancel</Btn></td></tr>
          ))}</tbody></table>
        </Card>
      )}
      {loading ? <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card> : !(available || []).length ? <Card style={{ padding: 24 }}><EmptyState icon="users" title="No linked students" /></Card> : available.map(k => (
        <Card key={k.child._id} style={{ padding: 20, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{k.child.name}'s teachers</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 10 }}>
            {k.teachers.map(t => (
              <div key={t.teacher._id + t.subject?._id} style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.teacher.name}</div><div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{t.subject?.name}</div>
                {t.slots.length ? <Btn variant="accent" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => { setPicking({ child: k.child, teacher: t }); setAgenda(""); }}>Book a meeting · {t.slots.length} slot{t.slots.length === 1 ? "" : "s"}</Btn> : <span style={{ fontSize: 12, color: "var(--muted)" }}>No open slots right now</span>}
              </div>
            ))}
          </div>
        </Card>
      ))}
      {picking && (
        <Modal title={`Meet ${picking.teacher.teacher.name}`} onClose={() => setPicking(null)}>
          <div style={{ display: "grid", gap: 12 }}>
            <div><label className="field-label">What would you like to discuss? (optional)</label><input className="input" maxLength={500} value={agenda} onChange={e => setAgenda(e.target.value)} /></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {picking.teacher.slots.map(s => <Btn key={s._id} variant="ghost" disabled={busy} onClick={() => book(s)}>{new Date(s.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {fmtTime(s.start)} <span style={{ color: "var(--muted)" }}>{MODES[s.mode]}</span></Btn>)}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ═══════════════════════════ INSIGHTS ══════════════════════════════════════
// Single-series bar charts share one validated hue per theme (see
// FinanceReportsPage.jsx for the palette check); bars below the institute's
// threshold are drawn in the theme's status red, always paired with a label.
const BAR = { light: "#2F6FB2", dark: "#4A8FD4" };

function Bars({ data, unit = "", threshold, height = 170 }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(null);
  const max = Math.max(unit === "%" ? 100 : 1, ...data.map(d => d.value));
  const active = hover != null ? data[hover] : null;
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", minHeight: 18, marginBottom: 8 }}>{active ? <><strong style={{ color: "var(--ink)" }}>{active.label}</strong> · {active.value}{unit}{active.records != null ? ` (${active.records} records)` : ""}</> : threshold != null ? `Dashed line: ${threshold}${unit} minimum` : " "}</div>
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 6, height, borderBottom: "1px solid var(--border)" }} onMouseLeave={() => setHover(null)}>
        {threshold != null && <div style={{ position: "absolute", left: 0, right: 0, bottom: `${(threshold / max) * 100}%`, borderTop: "1px dashed var(--muted)" }} />}
        {data.map((d, i) => (
          <div key={d.label} onMouseEnter={() => setHover(i)} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", minWidth: 0, background: hover === i ? "var(--surface-alt)" : "transparent", borderRadius: "6px 6px 0 0" }}>
            <div style={{ fontSize: 10.5, color: "var(--ink-soft)", marginBottom: 3 }}>{d.value}{unit}</div>
            <div style={{ width: "62%", maxWidth: 34, height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0, background: threshold != null && d.value < threshold ? "var(--danger)" : BAR[theme] || BAR.light, borderRadius: "4px 4px 0 0" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>{data.map(d => <div key={d.label} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: "var(--muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.label}>{d.label}</div>)}</div>
    </div>
  );
}

const Panel = ({ title, note, children }) => (
  <Card style={{ padding: 20 }}>
    <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
    {note && <div style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 12px" }}>{note}</div>}
    {children}
  </Card>
);

export function InsightsPage() {
  const { money } = useSettings();
  const [d, , loading] = useLoad("/api/ops/insights");
  if (loading || !d) return <><SectionHeader eyebrow="Overview" title="Insights" /><Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card></>;
  const weakest = d.subjectPerformance.slice(0, 6);
  const totalGrades = d.gradeDistribution.reduce((s, g) => s + g.value, 0);
  return (
    <>
      <SectionHeader eyebrow="Overview" title="Insights" />
      {d.feeForecast && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 16 }}>
          <StatCard label="Collected this month" value={money(d.feeForecast.collectedSoFar)} icon="check" />
          <StatCard label="Still due this month" value={money(d.feeForecast.stillDueThisMonth)} icon="clock" />
          <StatCard label={`Projected month total (at ${d.feeForecast.historicalCollectionRate}% collection)`} value={money(d.feeForecast.projectedMonthTotal)} icon="trend" />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 16 }}>
        <Panel title="Attendance by weekday" note="Last 8 weeks, all classes. A weak day is often a timetable problem, not a student one.">
          {d.attendanceByWeekday.length ? <Bars data={d.attendanceByWeekday} unit="%" threshold={d.minAttendancePercent} /> : <EmptyState icon="clipboard" title="No attendance yet" />}
        </Panel>
        <Panel title="Attendance trend" note="Weekly attendance rate, last 8 weeks (week starting).">
          {d.attendanceTrend.length ? <Bars data={d.attendanceTrend} unit="%" threshold={d.minAttendancePercent} /> : <EmptyState icon="trend" title="No attendance yet" />}
        </Panel>
        <Panel title="Grade distribution" note={`${totalGrades} course results across all classes.`}>
          {totalGrades ? <Bars data={d.gradeDistribution} /> : <EmptyState icon="award" title="No results yet" />}
        </Panel>
        <Panel title="Students by programme" note="Active enrolments.">
          {d.enrollmentByProgram.length ? <Bars data={d.enrollmentByProgram} /> : <EmptyState icon="users" title="No enrolments yet" />}
        </Panel>
        <Panel title="Subjects needing attention" note="Lowest average first, with the share of students passing.">
          {!weakest.length ? <EmptyState icon="book" title="No results yet" /> : (
            <div style={{ display: "grid", gap: 11 }}>{weakest.map(s => (
              <div key={s.label}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4, gap: 10 }}><span>{s.label}</span><span><strong>{s.average}%</strong> avg · <span style={{ color: s.passRate < 70 ? "var(--danger)" : "var(--ink-soft)" }}>{s.passRate}% pass</span></span></div><ProgressBar pct={s.average} /></div>
            ))}</div>
          )}
        </Panel>
        <Panel title="Admissions funnel" note="Applicants currently at each stage.">
          <Bars data={d.admissionsFunnel.map(f => ({ ...f, label: statusMeta(f.label).label }))} />
        </Panel>
      </div>
    </>
  );
}
