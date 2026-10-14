import { useState } from "react";
import ResourcePage from "../../components/resource/ResourcePage.jsx";
import { SectionHeader, StatCard, Tabs, Modal, Btn, Icon, Badge } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import { fmt, fmtTime, humanize, num } from "../../lib/utils.js";
import { useLoad, useAction, STUDENT_SOURCE } from "./hooks.js";
import { DEPARTMENT_SUGGESTIONS } from "../../lib/suggestions.js";

// The straightforward ERP modules — each is a ResourcePage configuration
// (columns + form fields) plus whatever module-specific action it needs.

const ACTIVE = ["active", "inactive"];
const METHODS = ["cash", "bank", "card", "online", "cheque"];
const Stats = ({ items, loading }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
    {items.map(s => <StatCard key={s.label} label={s.label} value={loading ? "…" : s.value} icon={s.icon} />)}
  </div>
);

// ═══════════════════════════ HR ════════════════════════════════════════════
export function DepartmentsPage() {
  return (
    <ResourcePage eyebrow="HR & Payroll" title="Departments" base="/api/hr/departments" addLabel="Add Department" deleteLabel="Deactivate"
      suggestions={{ catalog: DEPARTMENT_SUGGESTIONS, note: "Academic departments plus the usual offices — tap the ones you have." }}
      emptyDesc="Departments group staff for reporting and payroll."
      columns={[{ key: "name", label: "Department" }, { key: "code", label: "Code" }, { key: "kind", label: "Kind", type: "enum" }, { key: "head", label: "Head" }, { key: "status", label: "Status", type: "status" }]}
      filters={[{ name: "kind", label: "Kind", options: ["academic", "administrative", "support"] }]}
      fields={[
        { name: "name", label: "Name", required: true }, { name: "code", label: "Code", required: true, placeholder: "e.g. CS" },
        { name: "kind", label: "Kind", type: "select", options: ["academic", "administrative", "support"], default: "academic" },
        { name: "head", label: "Head of Department" }, { name: "status", label: "Status", type: "select", options: ACTIVE, default: "active" },
        { name: "description", label: "Description", type: "textarea" },
      ]} />
  );
}

export function StaffPage() {
  const { money } = useSettings();
  const [summary, , loading] = useLoad("/api/hr/summary");
  const gross = r => (r.basicSalary || 0) + (r.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
  const line = [{ name: "label", label: "Label" }, { name: "amount", label: "Amount", type: "number" }];
  return (
    <>
      <SectionHeader eyebrow="HR & Payroll" title="Staff" />
      <Stats loading={loading} items={[
        { label: "Active Staff", value: summary?.active, icon: "briefcase" },
        { label: "Departments", value: summary?.departments, icon: "layers" },
        { label: "Monthly Payroll", value: money(summary?.monthlyPayroll), icon: "wallet" },
        { label: "Leave Pending", value: summary?.pendingLeaves, icon: "clock" },
      ]} />
      <ResourcePage embedded title="Staff" base="/api/hr/staff" addLabel="Add Staff" deleteLabel="Mark resigned" money={money}
        emptyDesc="Add teaching and non-teaching staff to run attendance and payroll."
        columns={[
          { key: "employeeId", label: "ID" }, { key: "name", label: "Name" }, { key: "designation", label: "Designation" },
          { key: "department.name", label: "Department" }, { key: "category", label: "Category", type: "enum" },
          { key: "gross", label: "Gross / month", render: r => money(gross(r)), csv: gross }, { key: "status", label: "Status", type: "status" },
        ]}
        filters={[
          { name: "department", label: "Department", source: { path: "/api/hr/departments", label: d => d.name } },
          { name: "category", label: "Category", options: ["teaching", "administrative", "support", "management"] },
          { name: "status", label: "Status", options: ["active", "on_leave", "resigned", "terminated"] },
        ]}
        fields={[
          { name: "name", label: "Full Name", required: true }, { name: "designation", label: "Designation", placeholder: "e.g. Lecturer" },
          { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone" },
          { name: "department", label: "Department", type: "select", source: { path: "/api/hr/departments", label: d => d.name } },
          { name: "category", label: "Category", type: "select", options: ["teaching", "administrative", "support", "management"], default: "teaching" },
          { name: "employmentType", label: "Employment", type: "select", options: ["permanent", "contract", "visiting", "part_time"], default: "permanent" },
          { name: "teacher", label: "Linked Teacher Login", type: "select", source: { path: "/api/teachers", label: t => `${t.name} (${t.email})` }, hint: "Lets this teacher see their own payslips in the teacher portal." },
          { name: "joinDate", label: "Joining Date", type: "date" }, { name: "qualification", label: "Qualification" },
          { name: "basicSalary", label: "Basic Salary / month", type: "number", default: 0 },
          { name: "status", label: "Status", type: "select", options: ["active", "on_leave", "resigned", "terminated"], default: "active" },
          { name: "bankName", label: "Bank" }, { name: "bankAccount", label: "Account No." },
          { name: "allowances", label: "Allowances", type: "lines", lineLabel: "allowance", lineFields: line },
          { name: "deductions", label: "Fixed Deductions", type: "lines", lineLabel: "deduction", lineFields: line },
        ]} />
    </>
  );
}

export function StaffLeavesPage() {
  const { api } = useSession();
  const [run] = useAction();
  const review = (row, status, ctx) => run(() => api.call("PATCH", `/api/hr/leaves/${row._id}/review`, { status }), `Leave ${status}`).then(ctx.reload);
  return (
    <ResourcePage eyebrow="HR & Payroll" title="Staff Leave" base="/api/hr/leaves" addLabel="Record Leave Request" canEdit={false}
      columns={[
        { key: "staff.name", label: "Staff" }, { key: "type", label: "Type", type: "enum" }, { key: "from", label: "From", type: "date" }, { key: "to", label: "To", type: "date" },
        { key: "reason", label: "Reason" }, { key: "status", label: "Status", type: "status" },
      ]}
      searchable={false}
      filters={[{ name: "status", label: "Status", options: ["pending", "approved", "rejected"] }]}
      fields={[
        { name: "staff", label: "Staff Member", type: "select", required: true, source: { path: "/api/hr/staff?status=active", label: s => `${s.name} · ${s.employeeId}` } },
        { name: "type", label: "Leave Type", type: "select", options: ["casual", "sick", "annual", "maternity", "unpaid", "other"], default: "casual" },
        { name: "from", label: "From", type: "date", required: true }, { name: "to", label: "To", type: "date", required: true },
        { name: "reason", label: "Reason", type: "textarea" },
      ]}
      rowActions={(row, ctx) => row.status === "pending" ? [
        { label: "Approve", icon: "check", variant: "accent", onClick: () => review(row, "approved", ctx) },
        { label: "Reject", icon: "x", variant: "danger", onClick: () => review(row, "rejected", ctx) },
      ] : []} />
  );
}

// ═══════════════════════════ FINANCE ═══════════════════════════════════════
export function ScholarshipsPage() {
  const { money } = useSettings();
  return (
    <ResourcePage eyebrow="Finance" title="Scholarships & Discounts" base="/api/finance/scholarships" addLabel="Award Scholarship"
      emptyDesc="An active scholarship is applied automatically whenever a fee structure is billed to that student."
      columns={[
        { key: "student.name", label: "Student" }, { key: "title", label: "Scholarship" }, { key: "kind", label: "Kind", type: "enum" },
        { key: "value", label: "Value", render: r => r.type === "percent" ? `${r.value}%` : money(r.value), csv: r => `${r.value}${r.type === "percent" ? "%" : ""}` },
        { key: "validUntil", label: "Valid Until", type: "date" }, { key: "status", label: "Status", type: "status" },
      ]}
      filters={[{ name: "status", label: "Status", options: ["active", "expired", "revoked"] }, { name: "kind", label: "Kind", options: ["merit", "need", "sports", "sibling", "staff_child", "other"] }]}
      fields={[
        { name: "student", label: "Student", type: "select", required: true, source: STUDENT_SOURCE, createOnly: true },
        { name: "title", label: "Title", required: true, placeholder: "e.g. Dean's Merit Award" },
        { name: "kind", label: "Kind", type: "select", options: ["merit", "need", "sports", "sibling", "staff_child", "other"], default: "merit" },
        { name: "type", label: "Discount Type", type: "select", options: [{ value: "percent", label: "Percentage of fee" }, { value: "fixed", label: "Fixed amount" }], default: "percent" },
        { name: "value", label: "Value", type: "number", required: true, hint: "Percent (0–100) or an amount, per fee line." },
        { name: "validUntil", label: "Valid Until", type: "date", hint: "Leave empty for no expiry." },
        { name: "status", label: "Status", type: "select", options: ["active", "expired", "revoked"], default: "active" },
        { name: "notes", label: "Notes", type: "textarea" },
      ]} />
  );
}

const EXPENSE_CATEGORIES = ["salaries", "utilities", "maintenance", "supplies", "transport", "events", "it", "rent", "marketing", "other"];
export function ExpensesPage() {
  const { money } = useSettings();
  return (
    <ResourcePage eyebrow="Finance" title="Expenses" base="/api/finance/expenses" addLabel="Record Expense" money={money}
      stats={rows => [
        { label: "Shown Total", value: money(rows.reduce((s, r) => s + r.amount, 0)), icon: "wallet" },
        { label: "Entries", value: rows.length, icon: "file" },
      ]}
      columns={[
        { key: "date", label: "Date", type: "date" }, { key: "title", label: "Expense" }, { key: "category", label: "Category", type: "enum" },
        { key: "paidTo", label: "Paid To" }, { key: "method", label: "Method", type: "enum" }, { key: "amount", label: "Amount", type: "money" },
      ]}
      filters={[{ name: "category", label: "Category", options: EXPENSE_CATEGORIES }]}
      fields={[
        { name: "title", label: "Title", required: true }, { name: "amount", label: "Amount", type: "number", required: true },
        { name: "category", label: "Category", type: "select", options: EXPENSE_CATEGORIES, default: "other" }, { name: "date", label: "Date", type: "date" },
        { name: "paidTo", label: "Paid To" }, { name: "method", label: "Method", type: "select", options: METHODS, default: "bank" },
        { name: "reference", label: "Reference / Voucher No." }, { name: "notes", label: "Notes", type: "textarea" },
      ]} />
  );
}

function GenerateBillsModal({ structure, onClose }) {
  const { api } = useSession();
  const { money } = useSettings();
  const [run, busy] = useAction();
  const [sections] = useLoad("/api/sections", []);
  const [form, setForm] = useState({ period: "", dueDate: "", section: "" });
  const [result, setResult] = useState(null);
  const total = structure.items.reduce((s, i) => s + i.amount, 0);
  const programId = structure.program?._id;
  const eligible = (sections || []).filter(s => s.status === "active" && (!programId || (s.program?._id || s.program) === programId));

  const submit = async () => {
    const out = await run(() => api.call("POST", `/api/finance/structures/${structure._id}/generate`, { ...form, section: form.section || undefined }));
    if (out) setResult(out);
  };

  return (
    <Modal title={`Bill “${structure.name}”`} onClose={onClose} footer={result
      ? <Btn variant="accent" onClick={onClose}>Done</Btn>
      : <><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="accent" onClick={submit} disabled={busy || !form.period.trim() || !form.dueDate}>{busy ? "Generating…" : "Generate Bills"}</Btn></>}>
      {result ? (
        <div className="kv">
          <div><div className="k">Fee lines created</div><div className="v">{result.created}</div></div>
          <div><div className="k">Students billed</div><div className="v">{result.students}</div></div>
          <div><div className="k">Already billed (skipped)</div><div className="v">{result.skipped}</div></div>
          <div><div className="k">Total billed</div><div className="v">{money(result.total)}</div></div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            {structure.items.length} item(s), {money(total)} per student{structure.program ? ` · ${structure.program.name}` : " · all students"}. Active scholarships are applied automatically.
          </div>
          <div><label className="field-label">Billing period *</label>
            <input className="input" placeholder="e.g. Fall 2026 or 2026-10" value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} />
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>A student is billed once per period — running the same period again only picks up students who were missed.</div>
          </div>
          <div><label className="field-label">Due date *</label><input className="input" type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
          <div><label className="field-label">Limit to one section</label>
            <select className="input" value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))}>
              <option value="">{structure.program ? "Whole program" : "Everyone"}</option>
              {eligible.map(s => <option key={s._id} value={s._id}>{s.program?.name ? `${s.program.name} — ` : ""}{s.name}</option>)}
            </select>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function FeeStructuresPage() {
  const { money } = useSettings();
  const [billing, setBilling] = useState(null);
  const total = r => r.items.reduce((s, i) => s + i.amount, 0);
  return (
    <>
      <ResourcePage eyebrow="Finance" title="Fee Structures" base="/api/finance/structures" addLabel="Add Structure" deleteLabel="Deactivate"
        emptyDesc="Define a fee template once (tuition, lab, exam…), then bill a whole program or section in one step."
        columns={[
          { key: "name", label: "Structure" }, { key: "program.name", label: "Program", render: r => r.program?.name || "All students" },
          { key: "items", label: "Items", render: r => r.items.map(i => i.title).join(", "), csv: r => r.items.map(i => `${i.title}=${i.amount}`).join("; ") },
          { key: "total", label: "Per Student", render: r => money(total(r)), csv: total }, { key: "frequency", label: "Frequency", type: "enum" }, { key: "status", label: "Status", type: "status" },
        ]}
        fields={[
          { name: "name", label: "Name", required: true, placeholder: "e.g. BSCS Semester Fee" },
          { name: "program", label: "Program", type: "select", placeholder: "All students", source: { path: "/api/programs", label: p => p.name } },
          { name: "frequency", label: "Frequency", type: "select", options: ["one_time", "monthly", "quarterly", "semester", "annual"], default: "semester" },
          { name: "status", label: "Status", type: "select", options: ACTIVE, default: "active" },
          { name: "items", label: "Fee Items", type: "lines", required: true, lineLabel: "item", lineFields: [
            { name: "title", label: "Title" }, { name: "category", label: "Category", options: ["tuition", "lab", "library", "exam", "other"], default: "tuition" }, { name: "amount", label: "Amount", type: "number" },
          ] },
        ]}
        rowActions={row => row.status === "active" ? [{ label: "Bill Students", icon: "dollar", variant: "accent", onClick: () => setBilling(row) }] : []} />
      {billing && <GenerateBillsModal structure={billing} onClose={() => setBilling(null)} />}
    </>
  );
}

// ═══════════════════════════ CAMPUS ════════════════════════════════════════
export function AssetsPage() {
  const { money } = useSettings();
  const [summary, reload, loading] = useLoad("/api/campus/assets/summary");
  const CATS = ["furniture", "it_equipment", "lab_equipment", "vehicle", "sports", "stationery", "other"];
  const COND = ["new", "good", "fair", "needs_repair", "disposed"];
  return (
    <>
      <SectionHeader eyebrow="Campus Services" title="Inventory & Assets" />
      <Stats loading={loading} items={[
        { label: "Asset Lines", value: summary?.items, icon: "box" }, { label: "Total Units", value: num(summary?.units), icon: "layers" },
        { label: "Book Value", value: money(summary?.value), icon: "wallet" }, { label: "Needs Repair", value: summary?.needsRepair, icon: "alert" },
      ]} />
      <ResourcePage embedded title="Assets" base="/api/campus/assets" addLabel="Add Asset" money={money} reloadKey={summary?.items}
        columns={[
          { key: "name", label: "Asset" }, { key: "tag", label: "Tag" }, { key: "category", label: "Category", type: "enum" }, { key: "location", label: "Location" },
          { key: "quantity", label: "Qty" }, { key: "unitCost", label: "Unit Cost", type: "money" },
          { key: "condition", label: "Condition", render: r => <Badge tone={r.condition === "needs_repair" ? "danger" : r.condition === "disposed" ? "neutral" : "success"}>{humanize(r.condition)}</Badge>, csv: r => r.condition },
        ]}
        filters={[{ name: "category", label: "Category", options: CATS }, { name: "condition", label: "Condition", options: COND }]}
        fields={[
          { name: "name", label: "Name", required: true }, { name: "tag", label: "Asset Tag" },
          { name: "category", label: "Category", type: "select", options: CATS, default: "other" }, { name: "location", label: "Location / Room" },
          { name: "quantity", label: "Quantity", type: "number", default: 1 }, { name: "unitCost", label: "Unit Cost", type: "number", default: 0 },
          { name: "purchaseDate", label: "Purchase Date", type: "date" }, { name: "condition", label: "Condition", type: "select", options: COND, default: "good" },
          { name: "assignedTo", label: "Assigned To" }, { name: "notes", label: "Notes", type: "textarea" },
        ]}
        headerActions={() => <Btn variant="ghost" onClick={reload}><Icon name="history" size={13} />Refresh totals</Btn>} />
    </>
  );
}

export function VisitorsPage() {
  const { api } = useSession();
  const [run] = useAction();
  return (
    <ResourcePage eyebrow="Campus Services" title="Visitor Log" base="/api/campus/visitors" addLabel="Check In Visitor" canEdit={false}
      stats={rows => [
        { label: "On Campus Now", value: rows.filter(r => !r.checkOut).length, icon: "idcard" },
        { label: "Today", value: rows.filter(r => new Date(r.checkIn).toDateString() === new Date().toDateString()).length, icon: "calendar" },
      ]}
      columns={[
        { key: "name", label: "Visitor" }, { key: "phone", label: "Phone" }, { key: "purpose", label: "Purpose" }, { key: "toMeet", label: "Meeting" }, { key: "badgeNo", label: "Badge" },
        { key: "checkIn", label: "In", render: r => `${fmt(r.checkIn)} ${fmtTime(r.checkIn)}`, csv: r => r.checkIn },
        { key: "checkOut", label: "Out", render: r => r.checkOut ? fmtTime(r.checkOut) : <Badge tone="warn">On campus</Badge>, csv: r => r.checkOut || "" },
      ]}
      fields={[
        { name: "name", label: "Name", required: true }, { name: "phone", label: "Phone" }, { name: "nationalId", label: "ID / CNIC" },
        { name: "toMeet", label: "Here to Meet" }, { name: "badgeNo", label: "Badge No." }, { name: "purpose", label: "Purpose", full: true },
      ]}
      rowActions={(row, ctx) => row.checkOut ? [] : [{ label: "Check Out", icon: "check", onClick: () => run(() => api.call("PATCH", `/api/campus/visitors/${row._id}/checkout`), "Checked out").then(ctx.reload) }]} />
  );
}

export function TransportPage() {
  const { money } = useSettings();
  const [tab, setTab] = useState("routes");
  const [summary, , loading] = useLoad("/api/campus/transport/summary");
  const routeSource = { path: "/api/campus/transport/routes?status=active", label: r => `${r.name}${r.vehicleNo ? ` (${r.vehicleNo})` : ""}` };
  const riders = id => summary?.occupancy?.find(o => o._id === id)?.riders ?? 0;
  return (
    <>
      <SectionHeader eyebrow="Campus Services" title="Transport" />
      <Stats loading={loading} items={[
        { label: "Active Routes", value: summary?.routes, icon: "bus" }, { label: "Riders", value: summary?.riders, icon: "users" },
        { label: "Seats", value: summary?.seats, icon: "layers" }, { label: "Seats Free", value: (summary?.seats ?? 0) - (summary?.riders ?? 0), icon: "check" },
      ]} />
      <Tabs items={[{ key: "routes", label: "Routes & Vehicles" }, { key: "riders", label: "Student Assignments" }]} active={tab} onChange={setTab} style={{ marginBottom: 16 }} />
      {tab === "routes" ? (
        <ResourcePage embedded title="Routes" base="/api/campus/transport/routes" addLabel="Add Route" money={money}
          columns={[
            { key: "name", label: "Route" }, { key: "vehicleNo", label: "Vehicle" }, { key: "driverName", label: "Driver" }, { key: "driverPhone", label: "Phone" },
            { key: "capacity", label: "Seats", render: r => `${riders(r._id)} / ${r.capacity}`, csv: r => r.capacity }, { key: "monthlyFare", label: "Fare / month", type: "money" }, { key: "status", label: "Status", type: "status" },
          ]}
          fields={[
            { name: "name", label: "Route Name", required: true, placeholder: "e.g. Route 3 — Gulberg" }, { name: "vehicleNo", label: "Vehicle No." },
            { name: "driverName", label: "Driver" }, { name: "driverPhone", label: "Driver Phone" },
            { name: "capacity", label: "Seats", type: "number", default: 40, min: 1 }, { name: "monthlyFare", label: "Monthly Fare", type: "number", default: 0 },
            { name: "status", label: "Status", type: "select", options: ACTIVE, default: "active" },
            { name: "stops", label: "Stops (in pickup order, comma-separated)", type: "textarea" },
          ]} />
      ) : (
        <ResourcePage embedded title="Assignments" base="/api/campus/transport/assignments" addLabel="Assign Student" deleteLabel="Remove from route" searchable={false}
          emptyDesc="Assign students to a route — seats are checked against the vehicle's capacity."
          columns={[{ key: "student.name", label: "Student" }, { key: "student.rollNo", label: "Roll No" }, { key: "route.name", label: "Route" }, { key: "stop", label: "Stop" }, { key: "since", label: "Since", type: "date" }]}
          filters={[{ name: "route", label: "Route", source: routeSource }]}
          fields={[
            { name: "student", label: "Student", type: "select", required: true, source: STUDENT_SOURCE, createOnly: true },
            { name: "route", label: "Route", type: "select", required: true, source: routeSource }, { name: "stop", label: "Pickup Stop" },
          ]} />
      )}
    </>
  );
}

function AllocateModal({ onClose, onDone }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [students] = useLoad("/api/students", []);
  const [rooms] = useLoad("/api/campus/hostel/rooms?status=available", []);
  const [summary] = useLoad("/api/campus/hostel/summary");
  const [form, setForm] = useState({ student: "", room: "" });
  const used = id => summary?.occupancy?.[id] || 0;
  return (
    <Modal title="Allocate Hostel Room" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" disabled={busy || !form.student || !form.room} onClick={() => run(() => api.call("POST", "/api/campus/hostel/allocations", form), "Room allocated").then(r => r && onDone())}>Allocate</Btn>
    </>}>
      <div style={{ display: "grid", gap: 12 }}>
        <div><label className="field-label">Student</label>
          <select className="input" value={form.student} onChange={e => setForm(p => ({ ...p, student: e.target.value }))}>
            <option value="">Select…</option>{(students || []).map(s => <option key={s._id} value={s._id}>{s.name} · #{s.rollNo}</option>)}
          </select></div>
        <div><label className="field-label">Room</label>
          <select className="input" value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))}>
            <option value="">Select…</option>
            {(rooms || []).map(r => <option key={r._id} value={r._id} disabled={used(r._id) >= r.capacity}>{r.hostel?.name} — Room {r.number} ({used(r._id)}/{r.capacity}{used(r._id) >= r.capacity ? ", full" : ""})</option>)}
          </select></div>
      </div>
    </Modal>
  );
}

export function HostelPage() {
  const { api } = useSession();
  const { money } = useSettings();
  const [run] = useAction();
  const [tab, setTab] = useState("residents");
  const [allocating, setAllocating] = useState(false);
  const [tick, setTick] = useState(0);
  const [summary, reloadSummary, loading] = useLoad("/api/campus/hostel/summary");
  const hostelSource = { path: "/api/campus/hostel/hostels", label: h => h.name };
  const refresh = () => { reloadSummary(); setTick(t => t + 1); };
  return (
    <>
      <SectionHeader eyebrow="Campus Services" title="Hostel" />
      <Stats loading={loading} items={[
        { label: "Hostels", value: summary?.hostels, icon: "bed" }, { label: "Rooms", value: summary?.rooms, icon: "layers" },
        { label: "Residents", value: summary?.residents, icon: "users" }, { label: "Beds Vacant", value: summary?.vacant, icon: "check" },
      ]} />
      <Tabs items={[{ key: "residents", label: "Residents" }, { key: "rooms", label: "Rooms" }, { key: "hostels", label: "Hostels" }]} active={tab} onChange={setTab} style={{ marginBottom: 16 }} />
      {tab === "residents" && (
        <ResourcePage embedded title="Residents" base="/api/campus/hostel/allocations" searchable={false} reloadKey={tick} emptyDesc="Allocate a student to a room to get started."
          columns={[
            { key: "student.name", label: "Student" }, { key: "student.rollNo", label: "Roll No" }, { key: "room.hostel.name", label: "Hostel" }, { key: "room.number", label: "Room" },
            { key: "from", label: "From", type: "date" }, { key: "to", label: "To", type: "date" }, { key: "status", label: "Status", type: "status" },
          ]}
          filters={[{ name: "status", label: "Status", options: ["active", "vacated"] }]}
          headerActions={() => <Btn variant="accent" onClick={() => setAllocating(true)}><Icon name="plus" size={13} />Allocate Room</Btn>}
          rowActions={row => row.status === "active" ? [{ label: "Vacate", icon: "x", onClick: () => window.confirm(`Vacate ${row.student?.name} from room ${row.room?.number}?`) && run(() => api.call("PATCH", `/api/campus/hostel/allocations/${row._id}/vacate`), "Room vacated").then(refresh) }] : []} />
      )}
      {tab === "rooms" && (
        <ResourcePage embedded title="Rooms" base="/api/campus/hostel/rooms" addLabel="Add Room" money={money}
          columns={[
            { key: "hostel.name", label: "Hostel" }, { key: "number", label: "Room" }, { key: "floor", label: "Floor" },
            { key: "capacity", label: "Occupancy", render: r => `${summary?.occupancy?.[r._id] || 0} / ${r.capacity}`, csv: r => r.capacity },
            { key: "monthlyRent", label: "Rent / month", type: "money" }, { key: "status", label: "Status", type: "status" },
          ]}
          filters={[{ name: "hostel", label: "Hostel", source: hostelSource }]}
          fields={[
            { name: "hostel", label: "Hostel", type: "select", required: true, source: hostelSource }, { name: "number", label: "Room No.", required: true }, { name: "floor", label: "Floor" },
            { name: "capacity", label: "Beds", type: "number", default: 2, min: 1 }, { name: "monthlyRent", label: "Monthly Rent", type: "number", default: 0 },
            { name: "status", label: "Status", type: "select", options: ["available", "maintenance", "closed"], default: "available" },
          ]} />
      )}
      {tab === "hostels" && (
        <ResourcePage embedded title="Hostels" base="/api/campus/hostel/hostels" addLabel="Add Hostel" deleteLabel="Deactivate"
          columns={[{ key: "name", label: "Hostel" }, { key: "type", label: "Type", type: "enum" }, { key: "warden", label: "Warden" }, { key: "wardenPhone", label: "Phone" }, { key: "status", label: "Status", type: "status" }]}
          fields={[
            { name: "name", label: "Name", required: true }, { name: "type", label: "Type", type: "select", options: ["boys", "girls", "staff", "mixed"], default: "boys" },
            { name: "warden", label: "Warden" }, { name: "wardenPhone", label: "Warden Phone" }, { name: "status", label: "Status", type: "select", options: ACTIVE, default: "active" },
            { name: "address", label: "Address", type: "textarea" },
          ]} />
      )}
      {allocating && <AllocateModal onClose={() => setAllocating(false)} onDone={() => { setAllocating(false); refresh(); }} />}
    </>
  );
}

// ═══════════════════════════ LIBRARY ═══════════════════════════════════════
function IssueModal({ onClose, onDone }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [students] = useLoad("/api/students", []);
  const [books] = useLoad("/api/library/books?status=active", []);
  const [form, setForm] = useState({ student: "", book: "", dueOn: "" });
  return (
    <Modal title="Issue Book" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" disabled={busy || !form.student || !form.book} onClick={() => run(() => api.call("POST", "/api/library/issues", { ...form, dueOn: form.dueOn || undefined }), "Book issued").then(r => r && onDone())}>Issue</Btn>
    </>}>
      <div style={{ display: "grid", gap: 12 }}>
        <div><label className="field-label">Student</label>
          <select className="input" value={form.student} onChange={e => setForm(p => ({ ...p, student: e.target.value }))}>
            <option value="">Select…</option>{(students || []).map(s => <option key={s._id} value={s._id}>{s.name} · #{s.rollNo}</option>)}
          </select></div>
        <div><label className="field-label">Book</label>
          <select className="input" value={form.book} onChange={e => setForm(p => ({ ...p, book: e.target.value }))}>
            <option value="">Select…</option>
            {(books || []).map(b => <option key={b._id} value={b._id} disabled={b.available < 1}>{b.title}{b.author ? ` — ${b.author}` : ""} ({b.available} available)</option>)}
          </select></div>
        <div><label className="field-label">Due date</label>
          <input className="input" type="date" value={form.dueOn} onChange={e => setForm(p => ({ ...p, dueOn: e.target.value }))} />
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>Leave empty to use the standard loan period from Settings.</div></div>
      </div>
    </Modal>
  );
}

export function LibraryPage() {
  const { api } = useSession();
  const { money } = useSettings();
  const [run] = useAction();
  const [tab, setTab] = useState("circulation");
  const [issuing, setIssuing] = useState(false);
  const [tick, setTick] = useState(0);
  const [summary, reloadSummary, loading] = useLoad("/api/library/summary");
  const refresh = () => { reloadSummary(); setTick(t => t + 1); };
  const overdue = r => r.status === "issued" && new Date(r.dueOn) < new Date();

  const close = (row, lost) => {
    let body = {};
    if (lost) {
      const cost = window.prompt(`Mark “${row.book?.title}” as lost?\nEnter the replacement cost to charge (0 for none):`, "0");
      if (cost === null) return;
      body = { action: "lost", replacementCost: Number(cost) || 0 };
    }
    run(() => api.call("PATCH", `/api/library/issues/${row._id}/return`, body), r => r.fine > 0 ? `Closed — fine due: ${money(r.fine)}` : "Returned").then(refresh);
  };

  return (
    <>
      <SectionHeader eyebrow="Campus Services" title="Library" />
      <Stats loading={loading} items={[
        { label: "Titles", value: summary?.titles, icon: "library" }, { label: "Copies on Shelf", value: `${summary?.available ?? 0} / ${summary?.copies ?? 0}`, icon: "book" },
        { label: "On Loan", value: summary?.out, icon: "users" }, { label: "Overdue", value: summary?.overdue, icon: "alert" }, { label: "Unpaid Fines", value: money(summary?.unpaidFines), icon: "dollar" },
      ]} />
      <Tabs items={[{ key: "circulation", label: "Circulation" }, { key: "catalogue", label: "Catalogue" }]} active={tab} onChange={setTab} style={{ marginBottom: 16 }} />
      {tab === "circulation" ? (
        <ResourcePage embedded title="Loans" base="/api/library/issues" searchable={false} reloadKey={tick} exportName="library-loans" emptyDesc="Issue a book to a student to start tracking loans."
          columns={[
            { key: "book.title", label: "Book" }, { key: "student.name", label: "Student" }, { key: "student.rollNo", label: "Roll No" },
            { key: "issuedOn", label: "Issued", type: "date" }, { key: "dueOn", label: "Due", type: "date" }, { key: "returnedOn", label: "Returned", type: "date" },
            { key: "fine", label: "Fine", render: r => r.fine > 0 ? <span style={{ color: r.finePaid ? "var(--muted)" : "var(--danger)", fontWeight: 600 }}>{money(r.fine)}{r.finePaid ? " (paid)" : ""}</span> : "—", csv: r => r.fine },
            { key: "status", label: "Status", render: r => overdue(r) ? <Badge tone="danger">Overdue</Badge> : <Badge tone={r.status === "issued" ? "info" : r.status === "lost" ? "danger" : "success"}>{humanize(r.status)}</Badge>, csv: r => overdue(r) ? "overdue" : r.status },
          ]}
          filters={[{ name: "status", label: "Show", options: [{ value: "issued", label: "On loan" }, { value: "overdue", label: "Overdue" }, { value: "returned", label: "Returned" }, { value: "lost", label: "Lost" }] }]}
          headerActions={() => <Btn variant="accent" onClick={() => setIssuing(true)}><Icon name="plus" size={13} />Issue Book</Btn>}
          rowActions={row => row.status === "issued" ? [
            { label: "Return", icon: "check", variant: "accent", onClick: () => close(row, false) },
            { label: "Lost", icon: "alert", onClick: () => close(row, true) },
          ] : row.fine > 0 && !row.finePaid ? [{ label: "Fine Paid", icon: "dollar", onClick: () => run(() => api.call("PATCH", `/api/library/issues/${row._id}/fine-paid`), "Fine marked paid").then(refresh) }] : []} />
      ) : (
        <ResourcePage embedded title="Books" base="/api/library/books" addLabel="Add Book" reloadKey={tick}
          columns={[
            { key: "title", label: "Title" }, { key: "author", label: "Author" }, { key: "category", label: "Category" }, { key: "isbn", label: "ISBN" }, { key: "shelf", label: "Shelf" },
            { key: "available", label: "Available", render: r => <Badge tone={r.available > 0 ? "success" : "danger"}>{r.available} / {r.copies}</Badge>, csv: r => `${r.available}/${r.copies}` },
          ]}
          fields={[
            { name: "title", label: "Title", required: true, full: true }, { name: "author", label: "Author" }, { name: "isbn", label: "ISBN" },
            { name: "category", label: "Category", default: "General" }, { name: "publisher", label: "Publisher" }, { name: "year", label: "Year", type: "number", min: 1000 },
            { name: "shelf", label: "Shelf / Rack" }, { name: "copies", label: "Total Copies", type: "number", default: 1 },
            { name: "status", label: "Status", type: "select", options: ["active", "withdrawn"], default: "active" },
          ]} />
      )}
      {issuing && <IssueModal onClose={() => setIssuing(false)} onDone={() => { setIssuing(false); refresh(); }} />}
    </>
  );
}

// ═══════════════════════════ ENGAGEMENT ════════════════════════════════════
const SEVERITY_TONE = { info: "neutral", minor: "warn", major: "danger", critical: "danger" };
export function RecordsPage() {
  const KINDS = ["discipline", "health", "achievement", "counselling", "document", "note"];
  return (
    <ResourcePage eyebrow="People" title="Student Records" base="/api/engage/records" addLabel="Add Record"
      emptyDesc="Keep a dated log of discipline, health, achievements and counselling notes per student."
      columns={[
        { key: "date", label: "Date", type: "date" }, { key: "student.name", label: "Student" }, { key: "kind", label: "Kind", type: "enum" }, { key: "title", label: "Title" },
        { key: "severity", label: "Severity", render: r => <Badge tone={SEVERITY_TONE[r.severity]}>{humanize(r.severity)}</Badge>, csv: r => r.severity }, { key: "actionTaken", label: "Action Taken" },
      ]}
      filters={[{ name: "kind", label: "Kind", options: KINDS }, { name: "student", label: "Student", source: STUDENT_SOURCE }]}
      fields={[
        { name: "student", label: "Student", type: "select", required: true, source: STUDENT_SOURCE }, { name: "kind", label: "Kind", type: "select", options: KINDS, default: "note" },
        { name: "title", label: "Title", required: true }, { name: "date", label: "Date", type: "date" },
        { name: "severity", label: "Severity", type: "select", options: ["info", "minor", "major", "critical"], default: "info" }, { name: "actionTaken", label: "Action Taken" },
        { name: "details", label: "Details", type: "textarea", rows: 4 },
      ]} />
  );
}

export function AlumniPage() {
  return (
    <ResourcePage eyebrow="People" title="Alumni Directory" base="/api/engage/alumni" addLabel="Add Alumnus"
      emptyDesc="Graduating a section from the Promotion page adds its students here automatically."
      columns={[
        { key: "name", label: "Name" }, { key: "rollNo", label: "Roll No" }, { key: "program", label: "Program" }, { key: "graduationYear", label: "Class Of" },
        { key: "cgpa", label: "CGPA" }, { key: "currentOrganization", label: "Organization" }, { key: "currentPosition", label: "Position" }, { key: "city", label: "City" },
      ]}
      fields={[
        { name: "name", label: "Name", required: true }, { name: "rollNo", label: "Roll No" }, { name: "program", label: "Program" }, { name: "graduationYear", label: "Graduation Year", type: "number", min: 1950 },
        { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone" }, { name: "currentOrganization", label: "Current Organization" }, { name: "currentPosition", label: "Position" },
        { name: "city", label: "City" }, { name: "cgpa", label: "CGPA", type: "number", step: "0.01", max: 4 }, { name: "notes", label: "Notes", type: "textarea" },
      ]} />
  );
}
