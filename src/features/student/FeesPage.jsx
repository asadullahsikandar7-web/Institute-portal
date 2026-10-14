import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, Badge, Btn, Icon, EmptyState } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { fmt, humanize, statusMeta } from "../../lib/utils.js";
import { printReceipt } from "../admin/finance/FeesPage.jsx";
import { ClaimModal } from "../erp/SmartWidgets.jsx";

// The student's fee ledger. Students never mark a fee paid themselves —
// that's the accounts office (PATCH/POST are admin-only). What they can do
// is report a bank/online payment with its reference, which sits as
// "awaiting verification" until the office confirms it.
export default function StudentFeesPage() {
  const { session, api } = useSession();
  const ctx = useSettings();
  const { money } = ctx;
  const [fees, setFees] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const reload = () => Promise.all([api.getFees(session.student._id), api.call("GET", "/api/smart/claims").catch(() => [])])
    .then(([f, c]) => { setFees(Array.isArray(f) ? f : []); setClaims(c); })
    .finally(() => setLoading(false));
  useEffect(() => { reload(); }, [api, session.student._id]);

  const net = f => f.netAmount ?? f.amount;
  const balance = f => f.balance ?? (f.status === "paid" ? 0 : net(f));
  const billed = fees.reduce((s, f) => s + net(f), 0);
  const owed = fees.reduce((s, f) => s + balance(f), 0);
  const overdue = fees.filter(f => balance(f) > 0 && new Date(f.dueDate) < new Date());
  const pendingFor = id => claims.find(c => (c.fee?._id || c.fee) === id && c.status === "pending");
  const rejected = claims.filter(c => c.status === "rejected").slice(0, 3);

  return (
    <>
      <SectionHeader eyebrow="Campus" title="Fees" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Billed" value={loading ? "…" : money(billed)} icon="dollar" />
        <StatCard label="Paid" value={loading ? "…" : money(billed - owed)} icon="check" />
        <StatCard label="Balance Due" value={loading ? "…" : money(owed)} icon="alert" />
        <StatCard label="Overdue Items" value={loading ? "…" : overdue.length} icon="clock" />
      </div>

      {rejected.map(c => (
        <Card key={c._id} style={{ padding: "12px 16px", marginBottom: 12, borderColor: "var(--danger)", fontSize: 13 }}>
          <strong>Payment report for “{c.fee?.title}” was not accepted</strong> (ref {c.reference}, {money(c.amount)}): {c.reviewNote || "no reason given"}. You can submit it again with the correct details.
        </Card>
      ))}

      <Card style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead><tr><th>Fee</th><th>Due</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th /></tr></thead>
          <tbody>
            {fees.map(f => {
              const isOverdue = balance(f) > 0 && new Date(f.dueDate) < new Date();
              const meta = statusMeta(isOverdue && f.status !== "paid" ? "overdue" : f.status || "unpaid");
              const waiting = pendingFor(f._id);
              const open = expanded === f._id;
              return [
                <tr key={f._id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--ink)" }}>{f.title}{f.period ? <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {f.period}</span> : null}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "capitalize" }}>
                      {f.category}{f.discount > 0 ? ` · ${money(f.discount)} discount${f.discountNote ? ` (${f.discountNote})` : ""}` : ""}{f.fine > 0 ? ` · ${money(f.fine)} late fee` : ""}
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmt(f.dueDate)}</td>
                  <td>{money(net(f))}</td><td>{money(net(f) - balance(f))}</td><td style={{ fontWeight: 600, color: balance(f) > 0 ? "var(--ink)" : undefined }}>{money(balance(f))}</td>
                  <td>{waiting ? <Badge tone="info">Awaiting verification</Badge> : <Badge tone={meta.tone}>{meta.label}</Badge>}</td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    {balance(f) > 0 && !waiting && <Btn variant="accent" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setClaiming({ ...f, balance: balance(f) })}>I've paid this</Btn>}
                    {f.payments?.length > 0 && <button className="icon-btn" style={{ marginLeft: 6 }} title="Receipts" onClick={() => setExpanded(open ? null : f._id)}><Icon name={open ? "chevronDown" : "chevronRight"} size={14} /></button>}
                  </td>
                </tr>,
                open && (
                  <tr key={f._id + "-p"}><td colSpan={7} style={{ background: "var(--surface-alt)" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      {f.payments.map(p => (
                        <div key={p.receiptNo} style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
                          <span className="font-mono">{p.receiptNo}</span><span>{fmt(p.paidOn)}</span><span>{humanize(p.method)}</span><strong>{money(p.amount)}</strong>
                          <div style={{ flex: 1 }} />
                          <Btn variant="ghost" style={{ padding: "4px 9px", fontSize: 12 }} onClick={() => printReceipt({ ...f, studentId: session.student }, p, ctx)}><Icon name="printer" size={12} />Receipt</Btn>
                        </div>
                      ))}
                    </div>
                  </td></tr>
                ),
              ];
            })}
          </tbody>
        </table>
        {!loading && fees.length === 0 && <EmptyState icon="dollar" title="No fees billed yet" />}
      </Card>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>Paid at the bank or online? Use “I've paid this” to send the accounts office your deposit reference. Paying at the counter needs nothing from you — it shows here once recorded.</div>
      {claiming && <ClaimModal fee={claiming} onClose={() => setClaiming(null)} onDone={() => { setClaiming(null); reload(); }} />}
    </>
  );
}
