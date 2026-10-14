import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionHeader, StatCard, Card, Badge, Btn, Icon, EmptyState, ProgressBar } from "../../components/ui/index.js";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { downloadCsv, fmt, humanize, statusMeta } from "../../lib/utils.js";
import { useLoad } from "./hooks.js";

// Two-series palette for income vs expense. Deliberately not the app's
// green/red: those are status colours, and "expense" isn't a failure state.
// Each theme has its own steps, validated against that theme's card surface
// for colour-blind separation and contrast.
const SERIES = {
  light: { income: "#2F6FB2", expense: "#AD7C24" },
  dark: { income: "#4A8FD4", expense: "#B8892F" },
};

// Grouped monthly bars on one shared axis, with a hover readout. The exact
// figures are also in the table beneath it.
function IncomeExpenseChart({ months, money }) {
  const { theme } = useTheme();
  const colors = SERIES[theme] || SERIES.light;
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...months.flatMap(m => [m.income, m.expense]));
  const H = 180;
  const active = hover != null ? months[hover] : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12, minHeight: 22 }}>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--ink-soft)" }}>
          {[["income", "Fees collected"], ["expense", "Expenses"]].map(([k, label]) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[k] }} />{label}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          {active ? <><strong style={{ color: "var(--ink)" }}>{active.label}</strong> · collected {money(active.income)} · spent {money(active.expense)}</> : `Scale: 0 – ${money(max)}`}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: H, borderBottom: "1px solid var(--border)" }} onMouseLeave={() => setHover(null)}>
        {months.map((m, i) => (
          <div key={m.key} onMouseEnter={() => setHover(i)} title={`${m.label}: collected ${money(m.income)}, spent ${money(m.expense)}`}
            style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2, background: hover === i ? "var(--surface-alt)" : "transparent", borderRadius: "6px 6px 0 0", minWidth: 0 }}>
            {["income", "expense"].map(k => (
              <div key={k} style={{ width: "34%", maxWidth: 18, height: `${(m[k] / max) * 100}%`, minHeight: m[k] > 0 ? 2 : 0, background: colors[k], borderRadius: "4px 4px 0 0" }} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        {months.map(m => <div key={m.key} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: "var(--muted)", minWidth: 0, overflow: "hidden" }}>{m.label}</div>)}
      </div>
    </div>
  );
}

// Ranked breakdown: one hue, length carries the value, the number is the label.
function Breakdown({ title, entries, money, empty }) {
  const max = Math.max(1, ...entries.map(e => e[1]));
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>{title}</div>
      {entries.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>{empty}</div>}
      <div style={{ display: "grid", gap: 11 }}>
        {entries.map(([label, value]) => (
          <div key={label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ color: "var(--ink-soft)" }}>{humanize(label)}</span><strong>{money(value)}</strong>
            </div>
            <ProgressBar pct={(value / max) * 100} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function FinanceReportsPage() {
  const { money } = useSettings();
  const navigate = useNavigate();
  const [data, , loading] = useLoad("/api/finance/summary");
  if (loading || !data) return <><SectionHeader eyebrow="Finance" title="Finance Reports" /><Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card></>;
  const t = data.totals;
  const sorted = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <SectionHeader eyebrow="Finance" title="Finance Reports" action={
        <Btn variant="ghost" onClick={() => downloadCsv("income-expense-by-month.csv", ["Month", "Fees collected", "Expenses", "Net"], data.months.map(m => [m.key, m.income, m.expense, m.income - m.expense]))}>
          <Icon name="file" size={13} />Export Monthly CSV
        </Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Billed (net)" value={money(t.billed)} icon="dollar" />
        <StatCard label={`Collected · ${t.collectionRate}%`} value={money(t.collected)} icon="check" />
        <StatCard label="Outstanding" value={money(t.outstanding)} icon="alert" />
        <StatCard label="Overdue" value={money(t.overdueAmount)} icon="clock" />
        <StatCard label="Expenses" value={money(t.expenses)} icon="wallet" />
        <StatCard label="Net Position" value={money(t.net)} icon="trend" />
      </div>

      <Card style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Fees collected vs expenses — last 12 months</div>
        <IncomeExpenseChart months={data.months} money={money} />
        <div style={{ overflowX: "auto", marginTop: 18 }}>
          <table className="table">
            <thead><tr><th>Month</th><th>Collected</th><th>Expenses</th><th>Net</th></tr></thead>
            <tbody>{data.months.filter(m => m.income || m.expense).map(m => (
              <tr key={m.key}><td>{m.key}</td><td>{money(m.income)}</td><td>{money(m.expense)}</td><td style={{ fontWeight: 600, color: "var(--ink)" }}>{money(m.income - m.expense)}</td></tr>
            ))}</tbody>
          </table>
          {!data.months.some(m => m.income || m.expense) && <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 14px" }}>No payments or expenses recorded in the last 12 months.</div>}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16, marginBottom: 20 }}>
        <Breakdown title="Collected by fee category" money={money} empty="Nothing collected yet." entries={sorted(Object.fromEntries(Object.entries(data.byCategory).map(([k, v]) => [k, v.collected]))).filter(e => e[1] > 0)} />
        <Breakdown title="Collected by payment method" money={money} empty="Nothing collected yet." entries={sorted(data.byMethod)} />
        <Breakdown title="Expenses by category" money={money} empty="No expenses recorded." entries={sorted(data.expenseByCategory)} />
      </div>

      <Card style={{ padding: 0, overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Defaulters — overdue balances ({data.defaulters.length})</div>
          {data.defaulters.length > 0 && (
            <Btn variant="ghost" onClick={() => downloadCsv("defaulters.csv", ["Student", "Roll No", "Overdue amount", "Lines", "Oldest due"], data.defaulters.map(d => [d.student.name, d.student.rollNo, d.amount, d.items, new Date(d.oldestDue).toISOString().slice(0, 10)]))}>
              <Icon name="file" size={13} />Export
            </Btn>
          )}
        </div>
        {data.defaulters.length === 0 ? <EmptyState icon="check" title="No overdue balances" desc="Every billed fee is either paid or not yet due." /> : (
          <table className="table">
            <thead><tr><th>Student</th><th>Roll No</th><th>Overdue</th><th>Lines</th><th>Oldest Due</th><th /></tr></thead>
            <tbody>{data.defaulters.map(d => (
              <tr key={d.student._id}>
                <td style={{ fontWeight: 600, color: "var(--ink)" }}>{d.student.name}</td><td>{d.student.rollNo}</td><td>{money(d.amount)}</td><td>{d.items}</td>
                <td>{fmt(d.oldestDue)} <Badge tone={statusMeta("overdue").tone}>{Math.floor((Date.now() - new Date(d.oldestDue)) / 86400000)}d</Badge></td>
                <td style={{ textAlign: "right" }}><Btn variant="ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => navigate(`/admin/student360/${d.student._id}`)}>Open</Btn></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}

// ── Command Center: one headline per module ────────────────────────────────
export function OverviewPage() {
  const { money, settings } = useSettings();
  const navigate = useNavigate();
  const [data, , loading] = useLoad("/api/system/overview");
  if (loading || !data) return <><SectionHeader eyebrow="Overview" title="Command Center" /><Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card></>;
  const { people, finance, admissions, operations, upcoming } = data;
  const Group = ({ title, to, children }) => (
    <Card style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase" }}>{title}</div>
        {to && <Btn variant="ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => navigate(to)}>Open<Icon name="chevronRight" size={12} /></Btn>}
      </div>
      <div className="kv">{children}</div>
    </Card>
  );
  const KV = ({ k, v }) => <div><div className="k">{k}</div><div className="v" style={{ fontSize: 17 }}>{v}</div></div>;
  const pipeline = ["applied", "under_review", "test_scheduled", "interview", "offered", "accepted"].reduce((s, k) => s + (admissions[k] || 0), 0);

  return (
    <>
      <SectionHeader eyebrow={settings.instituteName} title="Command Center" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
        <Group title="People" to="/admin/students">
          <KV k="Students" v={people.students} /><KV k="Currently enrolled" v={people.activeEnrollments} /><KV k="Teachers" v={people.teachers} /><KV k="Staff on payroll" v={people.staff} />
        </Group>
        {finance && (
          <Group title="Finance" to="/admin/finance-reports">
            <KV k="Collected this month" v={money(finance.collectedThisMonth)} /><KV k="Spent this month" v={money(finance.expensesThisMonth)} />
            <KV k="Outstanding" v={money(finance.outstanding)} /><KV k="Collection rate" v={`${finance.collectionRate}%`} />
          </Group>
        )}
        <Group title="Admissions" to="/admin/admissions">
          <KV k="In pipeline" v={pipeline} /><KV k="Offered / accepted" v={(admissions.offered || 0) + (admissions.accepted || 0)} /><KV k="Enrolled" v={admissions.enrolled || 0} /><KV k="Rejected" v={admissions.rejected || 0} />
        </Group>
        <Group title="Operations" to="/admin/helpdesk">
          <KV k="Open tickets" v={operations.openTickets} /><KV k="Student leave pending" v={operations.pendingLeaves} />
          <KV k="Books on loan" v={`${operations.booksOut}${operations.overdueBooks ? ` (${operations.overdueBooks} overdue)` : ""}`} />
          <KV k="Hostel residents" v={operations.hostelResidents} /><KV k="Transport riders" v={operations.transportRiders} />
        </Group>
        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Next 30 days</div>
          {upcoming.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>Nothing on the academic calendar.</div>}
          <div style={{ display: "grid", gap: 9 }}>
            {upcoming.map(e => (
              <div key={e._id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{e.title}</span><span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{fmt(e.start)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
