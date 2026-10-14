import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, Badge, Btn, Icon, EmptyState } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { CsvImportButton } from "../../components/CsvImport.jsx";
import { staffAttendanceImport } from "../../lib/csvImports.js";
import { downloadCsv, fmt, html, humanize, printDocument, statusMeta, today } from "../../lib/utils.js";
import { useLoad, useAction } from "./hooks.js";

const STATUSES = ["present", "absent", "half_day", "leave", "holiday"];
const TONE = { present: "success", absent: "danger", half_day: "warn", leave: "info", holiday: "neutral" };
const thisMonth = () => new Date().toISOString().slice(0, 7);

// ═══════════════════════════ STAFF ATTENDANCE ══════════════════════════════
export function StaffAttendancePage() {
  const { api } = useSession();
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [rows, reloadDay, loading] = useLoad(`/api/hr/attendance?date=${date}`, []);
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setMarks(Object.fromEntries((rows || []).map(r => [r.staff._id, r.status || ""]))); }, [rows]);

  const list = rows || [];
  const count = s => list.filter(r => marks[r.staff._id] === s).length;
  const unmarked = list.filter(r => !marks[r.staff._id]).length;
  const save = async () => {
    const records = Object.entries(marks).filter(([, s]) => s).map(([staff, status]) => ({ staff, status }));
    if (!records.length) return toast("Mark at least one person first", "alert");
    setSaving(true);
    try { await api.call("POST", "/api/hr/attendance", { date, records }); toast(`Attendance saved for ${records.length} staff`, "check"); }
    catch (e) { toast(e.message, "alert"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <SectionHeader eyebrow="HR & Payroll" title="Staff Attendance" action={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" type="date" style={{ width: "auto" }} max={today()} value={date} onChange={e => setDate(e.target.value)} />
          <CsvImportButton {...staffAttendanceImport(api)} onDone={reloadDay} />
          <Btn variant="ghost" onClick={() => setMarks(Object.fromEntries(list.map(r => [r.staff._id, marks[r.staff._id] || "present"])))}>Mark rest present</Btn>
          <Btn variant="accent" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
        </div>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Present" value={count("present")} icon="check" /><StatCard label="Absent" value={count("absent")} icon="x" />
        <StatCard label="Half Day" value={count("half_day")} /><StatCard label="On Leave" value={count("leave")} /><StatCard label="Unmarked" value={unmarked} icon="clock" />
      </div>
      <Card style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead><tr><th>Staff</th><th>Department</th><th>Designation</th><th>Status</th></tr></thead>
          <tbody>{list.map(r => (
            <tr key={r.staff._id}>
              <td style={{ fontWeight: 600, color: "var(--ink)" }}>{r.staff.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{r.staff.employeeId}</span></td>
              <td>{r.staff.department?.name || "—"}</td><td>{r.staff.designation || "—"}</td>
              <td><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {STATUSES.map(s => {
                  const on = marks[r.staff._id] === s;
                  return <button key={s} className={"badge " + (on ? TONE[s] : "neutral")} style={{ border: "none", cursor: "pointer", opacity: on ? 1 : 0.6, fontFamily: "inherit" }} onClick={() => setMarks(p => ({ ...p, [r.staff._id]: on ? "" : s }))}>{humanize(s)}</button>;
                })}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
        {loading && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}
        {!loading && list.length === 0 && <EmptyState icon="briefcase" title="No active staff" desc="Add staff under HR & Payroll → Staff first." />}
      </Card>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>Absences and half days recorded here are deducted from that month's payroll at basic salary ÷ 30 per day.</div>
    </>
  );
}

// ═══════════════════════════ PAYROLL ═══════════════════════════════════════
export function payslipBody(p, staff, money) {
  const lines = arr => (arr || []).map(a => html`<tr><td>${a.label}</td><td class="r">${money(a.amount)}</td></tr>`);
  return html`
    <h2>Payslip — ${p.month}</h2>
    <div class="meta">
      <div><span>Employee:</span> <strong>${staff.name}</strong></div><div><span>Employee ID:</span> ${staff.employeeId}</div>
      <div><span>Designation:</span> ${staff.designation || "—"}</div><div><span>Department:</span> ${staff.department?.name || "—"}</div>
      <div><span>Bank:</span> ${staff.bankName || "—"}</div><div><span>Account:</span> ${staff.bankAccount || "—"}</div>
    </div>
    <table>
      <tr><th>Earnings</th><th class="r">Amount</th></tr>
      <tr><td>Basic salary</td><td class="r">${money(p.basic)}</td></tr>${lines(p.allowances)}
      <tr class="total"><td>Gross</td><td class="r">${money(p.gross)}</td></tr>
    </table>
    <table>
      <tr><th>Deductions</th><th class="r">Amount</th></tr>
      ${lines(p.deductions)}
      <tr><td>Unpaid absence (${p.absentDays} day${p.absentDays === 1 ? "" : "s"})</td><td class="r">${money(p.absenceDeduction)}</td></tr>
      <tr class="total"><td>Net pay</td><td class="r">${money(p.net)}</td></tr>
    </table>
    <div class="meta"><div><span>Status:</span> ${p.status === "paid" ? `Paid on ${fmt(p.paidOn)}` : "Not yet paid"}</div></div>
    <div class="sign"><div>Employee</div><div>Accounts Office</div></div>`;
}

export function PayrollPage() {
  const { api } = useSession();
  const { money, settings } = useSettings();
  const [run, busy] = useAction();
  const [month, setMonth] = useState(thisMonth());
  const [slips, reload, loading] = useLoad(`/api/hr/payroll?month=${month}`, []);
  const list = slips || [];
  const unpaid = list.filter(p => p.status === "generated");
  const total = list.reduce((s, p) => s + p.net, 0);

  const generate = () => run(() => api.call("POST", "/api/hr/payroll/run", { month }), o => `Payroll ready: ${o.created} new, ${o.refreshed} refreshed${o.locked ? `, ${o.locked} already paid` : ""}`).then(reload);
  const pay = ids => window.confirm(`Mark ${ids ? "this payslip" : `all ${unpaid.length} unpaid payslips`} as paid? The total is booked as a salaries expense.`) &&
    run(() => api.call("POST", "/api/hr/payroll/pay", { month, ids }), o => `${o.paid} payslip(s) paid — ${money(o.total)}`).then(reload);
  const print = p => printDocument(`Payslip ${p.staff?.name} ${p.month}`, payslipBody(p, p.staff || {}, money), { institute: settings });

  return (
    <>
      <SectionHeader eyebrow="HR & Payroll" title="Payroll" action={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" type="month" style={{ width: "auto" }} max={thisMonth()} value={month} onChange={e => setMonth(e.target.value)} />
          <Btn variant="ghost" disabled={!list.length} onClick={() => downloadCsv(`payroll-${month}.csv`, ["Employee ID", "Name", "Basic", "Gross", "Absent days", "Absence deduction", "Net", "Bank", "Account", "Status"], list.map(p => [p.staff?.employeeId, p.staff?.name, p.basic, p.gross, p.absentDays, p.absenceDeduction, p.net, p.staff?.bankName, p.staff?.bankAccount, p.status]))}><Icon name="file" size={13} />Bank Sheet CSV</Btn>
          <Btn variant="ghost" onClick={generate} disabled={busy}><Icon name="history" size={13} />{list.length ? "Recalculate" : "Run Payroll"}</Btn>
          <Btn variant="accent" onClick={() => pay()} disabled={busy || !unpaid.length}><Icon name="check" size={13} />Pay All Unpaid</Btn>
        </div>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Payslips" value={loading ? "…" : list.length} icon="file" /><StatCard label="Net Payroll" value={loading ? "…" : money(total)} icon="wallet" />
        <StatCard label="Paid" value={loading ? "…" : list.length - unpaid.length} icon="check" /><StatCard label="Unpaid" value={loading ? "…" : unpaid.length} icon="clock" />
      </div>
      <Card style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead><tr><th>Employee</th><th>Basic</th><th>Gross</th><th>Deductions</th><th>Absent</th><th>Net Pay</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map(p => {
            const m = statusMeta(p.status);
            return (
              <tr key={p._id}>
                <td style={{ fontWeight: 600, color: "var(--ink)" }}>{p.staff?.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{p.staff?.employeeId}</span></td>
                <td>{money(p.basic)}</td><td>{money(p.gross)}</td><td>{money(p.gross - p.net)}</td><td>{p.absentDays || "—"}</td>
                <td style={{ fontWeight: 700, color: "var(--ink)" }}>{money(p.net)}</td><td><Badge tone={m.tone}>{m.label}</Badge></td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  <Btn variant="ghost" style={{ padding: "5px 10px", fontSize: 12, marginRight: 6 }} onClick={() => print(p)}><Icon name="printer" size={12} />Slip</Btn>
                  {p.status === "generated" && <Btn variant="accent" style={{ padding: "5px 10px", fontSize: 12 }} disabled={busy} onClick={() => pay([p._id])}>Pay</Btn>}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
        {!loading && list.length === 0 && <EmptyState icon="wallet" title={`No payroll for ${month} yet`} desc="Run Payroll to generate a payslip for every active staff member from their salary and this month's attendance." />}
      </Card>
    </>
  );
}

// ═══════════════════════════ TEACHER: MY PAYSLIPS ══════════════════════════
export function TeacherPayslipsPage() {
  const { money, settings } = useSettings();
  const [data, , loading] = useLoad("/api/hr/my/payslips");
  const print = p => printDocument(`Payslip ${p.month}`, payslipBody(p, data.staff, money), { institute: settings });
  return (
    <>
      <SectionHeader eyebrow="My Employment" title="Payslips" />
      {loading ? <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
        : !data?.staff ? <Card style={{ padding: 24 }}><EmptyState icon="wallet" title="No payroll record linked" desc="Your login hasn't been linked to a staff payroll record yet. Please contact the HR office." /></Card>
        : !data.payslips.length ? <Card style={{ padding: 24 }}><EmptyState icon="wallet" title="No payslips yet" desc="Payslips appear here after HR runs each month's payroll." /></Card>
        : (
          <Card style={{ padding: 0, overflow: "auto" }}>
            <table className="table">
              <thead><tr><th>Month</th><th>Gross</th><th>Deductions</th><th>Net Pay</th><th>Status</th><th /></tr></thead>
              <tbody>{data.payslips.map(p => (
                <tr key={p._id}>
                  <td style={{ fontWeight: 600, color: "var(--ink)" }}>{p.month}</td><td>{money(p.gross)}</td><td>{money(p.gross - p.net)}</td><td style={{ fontWeight: 700, color: "var(--ink)" }}>{money(p.net)}</td>
                  <td><Badge tone={p.status === "paid" ? "success" : "warn"}>{p.status === "paid" ? `Paid ${fmt(p.paidOn)}` : "Processing"}</Badge></td>
                  <td style={{ textAlign: "right" }}><Btn variant="ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => print(p)}><Icon name="printer" size={12} />Print</Btn></td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        )}
    </>
  );
}
