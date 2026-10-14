import { useEffect, useMemo, useState } from "react";
import { SectionHeader, StatCard, Card, Badge, Btn, Icon, Select, EmptyState, Modal } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useSettings } from "../../../context/SettingsContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { CsvImportButton } from "../../../components/CsvImport.jsx";
import { feesImport } from "../../../lib/csvImports.js";
import { downloadCsv, fmt, html, humanize, printDocument, statusMeta } from "../../../lib/utils.js";
import { ClaimsQueue } from "../../erp/SmartWidgets.jsx";

const CATEGORIES = ["tuition", "lab", "library", "exam", "other"];
const METHODS = ["cash", "bank", "card", "online", "cheque"];

// Older rows (and API responses from before the ledger fields existed)
// have no netAmount/balance virtuals — derive them the same way the model does.
const net = f => f.netAmount ?? Math.max(0, (f.amount || 0) - (f.discount || 0) + (f.fine || 0));
const balance = f => f.balance ?? (f.status === "paid" ? 0 : Math.max(0, net(f) - (f.paidAmount || 0)));
const isOverdue = f => balance(f) > 0 && new Date(f.dueDate) < new Date();
const displayStatus = f => (f.status !== "paid" && isOverdue(f) ? "overdue" : f.status || "unpaid");

export function printReceipt(fee, payment, { settings, money }) {
  const student = fee.studentId || {};
  printDocument(`Receipt ${payment.receiptNo}`, html`
    <h2>Fee Receipt</h2>
    <div class="meta">
      <div><span>Receipt No:</span> <strong>${payment.receiptNo}</strong></div>
      <div><span>Date:</span> ${fmt(payment.paidOn)}</div>
      <div><span>Student:</span> ${student.name || "—"}</div>
      <div><span>Roll No:</span> ${student.rollNo || "—"}</div>
      <div><span>Payment method:</span> ${humanize(payment.method)}</div>
      <div><span>Reference:</span> ${payment.reference || "—"}</div>
    </div>
    <table>
      <tr><th>Description</th><th class="r">Amount</th></tr>
      <tr><td>${fee.title}${fee.period ? ` — ${fee.period}` : ""} (${humanize(fee.category)})</td><td class="r">${money(fee.amount)}</td></tr>
      ${fee.discount > 0 ? html`<tr><td>Discount${fee.discountNote ? ` — ${fee.discountNote}` : ""}</td><td class="r">− ${money(fee.discount)}</td></tr>` : ""}
      ${fee.fine > 0 ? html`<tr><td>Late fee / fine</td><td class="r">${money(fee.fine)}</td></tr>` : ""}
      <tr class="total"><td>Net payable</td><td class="r">${money(net(fee))}</td></tr>
      <tr><td>Paid with this receipt</td><td class="r">${money(payment.amount)}</td></tr>
      <tr class="total"><td>Balance remaining</td><td class="r">${money(balance(fee))}</td></tr>
    </table>
    <div class="sign"><div>Received by${payment.receivedBy ? ` (${payment.receivedBy})` : ""}</div><div>Accounts Office</div></div>
    <div class="foot">This is a computer-generated receipt.</div>`, { institute: settings });
}

function CollectModal({ fee, onClose, onSaved }) {
  const { api } = useSession();
  const ctx = useSettings();
  const toast = useToast();
  const due = balance(fee);
  const [form, setForm] = useState({ amount: String(due), method: "cash", reference: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const amount = Number(form.amount);
    if (!(amount > 0)) return toast("Enter an amount greater than 0", "alert");
    if (amount > due) return toast(`That's more than the balance (${ctx.money(due)})`, "alert");
    setSaving(true);
    try {
      const out = await api.call("POST", `/api/finance/fees/${fee._id}/pay`, { ...form, amount });
      toast(`Payment recorded — ${out.receiptNo}`, "check");
      const payment = out.fee.payments[out.fee.payments.length - 1];
      if (window.confirm("Payment recorded. Print the receipt now?")) printReceipt(out.fee, payment, ctx);
      onSaved();
    } catch (e) { toast(e.message, "alert"); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Collect Payment" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Record Payment"}</Btn>
    </>}>
      <div className="kv" style={{ marginBottom: 16 }}>
        <div><div className="k">Student</div><div className="v">{fee.studentId?.name || "—"}</div></div>
        <div><div className="k">Fee</div><div className="v">{fee.title}</div></div>
        <div><div className="k">Net payable</div><div className="v">{ctx.money(net(fee))}</div></div>
        <div><div className="k">Balance</div><div className="v">{ctx.money(due)}</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label className="field-label">Amount received</label>
          <input className="input" type="number" min="1" max={due} value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>Enter less than the balance for a part payment.</div></div>
        <div><label className="field-label">Method</label>
          <select className="input" value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}>{METHODS.map(m => <option key={m} value={m}>{humanize(m)}</option>)}</select></div>
        <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Reference (cheque / transaction no.)</label>
          <input className="input" value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} /></div>
      </div>
    </Modal>
  );
}

function AdjustModal({ fee, onClose, onSaved }) {
  const { api } = useSession();
  const ctx = useSettings();
  const toast = useToast();
  const [form, setForm] = useState({ discount: fee.discount || 0, discountNote: fee.discountNote || "", fine: fee.fine || 0, dueDate: fee.dueDate ? new Date(fee.dueDate).toISOString().slice(0, 10) : "" });
  const [plan, setPlan] = useState({ count: 3, intervalDays: 30, firstDue: new Date(Math.max(Date.now(), new Date(fee.dueDate).getTime())).toISOString().slice(0, 10) });
  const canSplit = !fee.payments?.length && !(fee.paidAmount > 0) && !/\(\d+\/\d+\)$/.test(fee.title);
  const [saving, setSaving] = useState(false);
  const act = async fn => { setSaving(true); try { await fn(); onSaved(); } catch (e) { toast(e.message, "alert"); } finally { setSaving(false); } };

  return (
    <Modal title={`Adjust — ${fee.title}`} onClose={onClose} footer={<>
      {!fee.payments?.length && <Btn variant="danger" disabled={saving} onClick={() => window.confirm("Remove this fee line entirely?") && act(async () => { await api.call("DELETE", `/api/finance/fees/${fee._id}`); toast("Fee removed", "check"); })}><Icon name="x" size={13} />Remove Fee</Btn>}
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" disabled={saving} onClick={() => act(async () => { await api.call("PATCH", `/api/finance/fees/${fee._id}/adjust`, { ...form, discount: Number(form.discount) || 0, fine: Number(form.fine) || 0 }); toast("Fee adjusted", "check"); })}>Save</Btn>
    </>}>
      <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>{fee.studentId?.name} · billed {ctx.money(fee.amount)} · paid so far {ctx.money(fee.paidAmount || 0)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label className="field-label">Discount / waiver</label><input className="input" type="number" min="0" max={fee.amount} value={form.discount} onChange={e => setForm(p => ({ ...p, discount: e.target.value }))} /></div>
        <div><label className="field-label">Fine / late fee</label><input className="input" type="number" min="0" value={form.fine} onChange={e => setForm(p => ({ ...p, fine: e.target.value }))} /></div>
        <div><label className="field-label">Due date</label><input className="input" type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
        <div><label className="field-label">Reason for discount</label><input className="input" value={form.discountNote} onChange={e => setForm(p => ({ ...p, discountNote: e.target.value }))} /></div>
      </div>
      {canSplit && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Instalment plan</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Replace this fee with equal instalments, each with its own due date. Discount and fine are split in proportion.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <div><label className="field-label">Instalments</label><select className="input" value={plan.count} onChange={e => setPlan(p => ({ ...p, count: Number(e.target.value) }))}>{[2, 3, 4, 5, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n} × {ctx.money(net(fee) / n)}</option>)}</select></div>
            <div><label className="field-label">Every</label><select className="input" value={plan.intervalDays} onChange={e => setPlan(p => ({ ...p, intervalDays: Number(e.target.value) }))}>{[[14, "2 weeks"], [30, "month"], [60, "2 months"], [90, "3 months"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className="field-label">First due</label><input className="input" type="date" value={plan.firstDue} onChange={e => setPlan(p => ({ ...p, firstDue: e.target.value }))} /></div>
            <Btn variant="ghost" disabled={saving} onClick={() => window.confirm(`Split “${fee.title}” into ${plan.count} instalments?`) && act(async () => { await api.call("POST", `/api/finance/fees/${fee._id}/installments`, plan); toast("Instalment plan created", "check"); })}>Split</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function AdminFeesPage() {
  const { api } = useSession();
  const ctx = useSettings();
  const { money } = ctx;
  const toast = useToast();
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const EMPTY = { title: "", amount: "", due: "", category: "tuition", target: "" };
  const [form, setForm] = useState(EMPTY);
  const [collecting, setCollecting] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState("due");

  const reload = () => {
    Promise.all([api.getFees(), api.getStudents()])
      .then(([f, s]) => { setFees(f); setStudents(s); })
      .catch(e => toast(e.message, "alert"))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  const addFee = async () => {
    if (!form.title || !form.amount || !form.due) return toast("Title, amount, and due date are required", "alert");
    if (!form.target) return toast("Choose a student, or 'All Students' to bill everyone", "alert");
    if (form.target === "__all__" && !window.confirm(`Bill this fee to all ${students.length} students?`)) return;
    const body = { title: form.title, amount: form.amount, due: form.due, category: form.category, ...(form.target === "__all__" ? { applyToAll: true } : { studentId: form.target }) };
    try {
      await api.addFee(body);
      toast("Fee added", "check");
      setForm(EMPTY); setShowAdd(false); reload();
    } catch (e) { toast(e.message, "alert"); }
  };

  const applyLateFees = async () => {
    if (!window.confirm("Apply the late-fee rule from Settings to every overdue fee that has no fine yet?")) return;
    try { const out = await api.call("POST", "/api/finance/late-fees/apply"); toast(`Late fee added to ${out.applied} overdue line(s)`, "check"); reload(); }
    catch (e) { toast(e.message, "alert"); }
  };

  const sendReminders = async () => {
    if (!window.confirm("Email every student with an overdue balance (and their parent, where an address is on file) a statement of what they owe?")) return;
    try { const o = await api.call("POST", "/api/finance/reminders/send"); toast(`Reminders: ${o.sent} emailed${o.failed ? `, ${o.failed} failed` : ""}${o.noEmail ? `, ${o.noEmail} have no email` : ""} — all ${o.defaulters} notified in the portal`, "check"); }
    catch (e) { toast(e.message, "alert"); }
  };

  const billed = fees.reduce((s, f) => s + net(f), 0);
  const outstanding = fees.reduce((s, f) => s + balance(f), 0);
  const overdueCount = fees.filter(isOverdue).length;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return fees.filter(f => {
      if (view === "due" && balance(f) <= 0) return false;
      if (view === "overdue" && !isOverdue(f)) return false;
      if (view === "paid" && f.status !== "paid") return false;
      if (!needle) return true;
      return [f.studentId?.name, f.studentId?.rollNo, f.title, f.period].some(v => String(v || "").toLowerCase().includes(needle));
    });
  }, [fees, q, view]);

  const exportCsv = () => downloadCsv("fees.csv",
    ["Student", "Roll No", "Fee", "Period", "Category", "Amount", "Discount", "Fine", "Net", "Paid", "Balance", "Due", "Status"],
    shown.map(f => [f.studentId?.name, f.studentId?.rollNo, f.title, f.period, f.category, f.amount, f.discount || 0, f.fine || 0, net(f), net(f) - balance(f), balance(f), new Date(f.dueDate).toISOString().slice(0, 10), displayStatus(f)]));

  return (
    <>
      <SectionHeader eyebrow="Finance" title="Fee Collection" action={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={sendReminders}><Icon name="mail" size={13} />Remind Defaulters</Btn>
          <Btn variant="ghost" onClick={applyLateFees}><Icon name="clock" size={13} />Apply Late Fees</Btn>
          <Btn variant="ghost" onClick={exportCsv} disabled={!shown.length}><Icon name="file" size={13} />Export CSV</Btn>
          <CsvImportButton {...feesImport(api, CATEGORIES)} onDone={reload} />
          <Btn variant="accent" onClick={() => setShowAdd(p => !p)}><Icon name="plus" size={13} />{showAdd ? "Cancel" : "Add Fee"}</Btn>
        </div>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Billed" value={loading ? "…" : money(billed)} icon="dollar" />
        <StatCard label="Collected" value={loading ? "…" : money(billed - outstanding)} icon="check" />
        <StatCard label="Outstanding" value={loading ? "…" : money(outstanding)} icon="alert" />
        <StatCard label="Overdue Lines" value={loading ? "…" : overdueCount} icon="clock" />
      </div>
      <ClaimsQueue onChanged={reload} />
      <Card style={{ padding: 22 }}>
        {showAdd && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, padding: 14, background: "var(--surface-alt)", borderRadius: 12, marginBottom: 16 }}>
            <Select value={form.target} onChange={e => setForm(p => ({ ...p, target: e.target.value }))} style={{ gridColumn: "1 / -1" }}>
              <option value="">Bill to…</option>
              <option value="__all__">⚠ All Students ({students.length})</option>
              {students.map(s => <option key={s._id} value={s._id}>{s.name} · #{s.rollNo}</option>)}
            </Select>
            <input className="input" placeholder="Fee title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <input className="input" type="number" min="1" placeholder={`Amount ${ctx.settings.currency}`} value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
            <input className="input" type="date" value={form.due} onChange={e => setForm(p => ({ ...p, due: e.target.value }))} />
            <Select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Btn variant="accent" onClick={addFee}><Icon name="check" size={14} />Save</Btn>
            <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "var(--muted)" }}>For a whole program or section, use Fee Structures → Bill Students — it applies scholarships and never double-bills a period.</div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 340 }}>
            <span style={{ position: "absolute", left: 11, top: 9, color: "var(--muted)" }}><Icon name="search" size={15} /></span>
            <input className="input" placeholder="Search student, roll no or fee…" style={{ paddingLeft: 34 }} value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select className="input" style={{ width: "auto" }} value={view} onChange={e => setView(e.target.value)}>
            <option value="due">Outstanding</option><option value="overdue">Overdue only</option><option value="paid">Paid</option><option value="all">All records</option>
          </select>
        </div>
        {loading && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}
        {!loading && shown.length === 0 && <EmptyState icon="dollar" title={fees.length ? "No fees match this view" : "No fee records yet"} desc={fees.length ? "Change the filter or search." : "Add a fee, or bill a program from Fee Structures."} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map(fee => {
            const meta = statusMeta(displayStatus(fee));
            const open = expanded === fee._id;
            return (
              <div key={fee._id} style={{ background: "var(--surface-alt)", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{fee.studentId?.name || "Unknown student"} <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 12 }}>#{fee.studentId?.rollNo}</span></div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{fee.title}{fee.period ? ` · ${fee.period}` : ""} · Due {fmt(fee.dueDate)}{fee.discount > 0 ? ` · discount ${money(fee.discount)}` : ""}{fee.fine > 0 ? ` · fine ${money(fee.fine)}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{money(balance(fee) > 0 ? balance(fee) : net(fee))}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>{balance(fee) > 0 && balance(fee) < net(fee) ? `balance of ${money(net(fee))}` : fee.category}</div>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {fee.status !== "paid" && <Btn variant="accent" onClick={() => setCollecting(fee)}><Icon name="check" size={12} />Collect</Btn>}
                    {fee.status !== "paid" && <button className="icon-btn" title="Adjust discount, fine or due date" onClick={() => setAdjusting(fee)}><Icon name="settings" size={14} /></button>}
                    {fee.payments?.length > 0 && <button className="icon-btn" title="Payments & receipts" onClick={() => setExpanded(open ? null : fee._id)}><Icon name={open ? "chevronDown" : "chevronRight"} size={14} /></button>}
                  </div>
                </div>
                {open && (
                  <div style={{ padding: "0 16px 14px" }}>
                    <table className="table" style={{ background: "var(--surface)", borderRadius: 10 }}>
                      <thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th><th /></tr></thead>
                      <tbody>
                        {fee.payments.map(p => (
                          <tr key={p.receiptNo}>
                            <td className="font-mono">{p.receiptNo}</td><td>{fmt(p.paidOn)}</td><td>{humanize(p.method)}</td><td>{p.reference || "—"}</td><td>{money(p.amount)}</td>
                            <td style={{ textAlign: "right" }}><Btn variant="ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => printReceipt(fee, p, ctx)}><Icon name="printer" size={12} />Receipt</Btn></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      {collecting && <CollectModal fee={collecting} onClose={() => setCollecting(null)} onSaved={() => { setCollecting(null); reload(); }} />}
      {adjusting && <AdjustModal fee={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); reload(); }} />}
    </>
  );
}
