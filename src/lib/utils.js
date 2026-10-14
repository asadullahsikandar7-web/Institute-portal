export const today = () => new Date().toISOString().split("T")[0];
export const fmt = d => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
export const fmtShort = d => d ? new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—";
export const fmtTime = d => d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—";
// "13:30" -> "1:30 PM" — for the real class-schedule feature, which stores
// times as sortable 24h "HH:mm" strings (see TimetableEntry.js) rather than
// Date objects, since a slot has no calendar date of its own.
export const fmtTime12h = hhmm => {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};
export const dateRange = (f, t) => { const d = [], c = new Date(f); while (c <= new Date(t)) { d.push(c.toISOString().split("T")[0]); c.setDate(c.getDate() + 1); } return d; };

// "Mr. Abdul Malik" -> "Abdul" — strips a leading honorific before taking
// the first name, for greetings like "Good day, {firstName}". Needed
// because some real (non-demo) teacher records keep the honorific as part
// of Teacher.name, per how the source data was provided.
const HONORIFICS = /^(mr|mrs|miss|ms|dr|prof)\.?$/i;
export const firstName = fullName => {
  const parts = (fullName || "").trim().split(/\s+/);
  while (parts.length > 1 && HONORIFICS.test(parts[0])) parts.shift();
  return parts[0] || "";
};

export const gradeLabel = g => g >= 90 ? "A+" : g >= 85 ? "A" : g >= 80 ? "B+" : g >= 75 ? "B" : g >= 70 ? "C+" : g >= 65 ? "C" : g >= 60 ? "D" : "F";
export const gradeColorVar = g => g >= 75 ? "var(--success)" : g >= 60 ? "var(--warn)" : "var(--danger)";

// tone maps to Badge's tone prop (success|danger|info|warn|neutral|accent)
const STATUS_META = {
  present: { label: "Present", tone: "success" },
  absent: { label: "Absent", tone: "danger" },
  leave: { label: "On Leave", tone: "info" },
  unmarked: { label: "Unmarked", tone: "neutral" },
  pending: { label: "Pending", tone: "warn" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  paid: { label: "Paid", tone: "success" },
  unpaid: { label: "Pending", tone: "warn" },
  overdue: { label: "Overdue", tone: "danger" },
  upcoming: { label: "Upcoming", tone: "warn" },
  completed: { label: "Completed", tone: "success" },
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
  partial: { label: "Part Paid", tone: "info" },
  generated: { label: "Unpaid", tone: "warn" },
  issued: { label: "On Loan", tone: "info" },
  returned: { label: "Returned", tone: "success" },
  lost: { label: "Lost", tone: "danger" },
  open: { label: "Open", tone: "warn" },
  in_progress: { label: "In Progress", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
  valid: { label: "Valid", tone: "success" },
  revoked: { label: "Revoked", tone: "danger" },
  vacated: { label: "Vacated", tone: "neutral" },
  available: { label: "Available", tone: "success" },
  maintenance: { label: "Maintenance", tone: "warn" },
  on_leave: { label: "On Leave", tone: "info" },
  resigned: { label: "Resigned", tone: "neutral" },
  terminated: { label: "Terminated", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  applied: { label: "Applied", tone: "neutral" },
  under_review: { label: "Under Review", tone: "info" },
  test_scheduled: { label: "Test Scheduled", tone: "info" },
  interview: { label: "Interview", tone: "info" },
  offered: { label: "Offered", tone: "accent" },
  accepted: { label: "Accepted", tone: "accent" },
  enrolled: { label: "Enrolled", tone: "success" },
  graduated: { label: "Graduated", tone: "success" },
  suspended: { label: "Suspended", tone: "warn" },
  expelled: { label: "Expelled", tone: "danger" },
};
// "needs_repair" -> "Needs repair" — for enum values shown as plain text.
export const humanize = s => (s == null || s === "" ? "—" : String(s).replace(/_/g, " ").replace(/^./, c => c.toUpperCase()));
export const statusMeta = s => STATUS_META[s] || { label: humanize(s), tone: "neutral" };
export const num = n => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const toDateInput = d => (d ? new Date(d).toISOString().slice(0, 10) : "");

// CSV download for any table. Cells starting with = + - @ are prefixed with
// a quote so a spreadsheet opens them as text, not as a formula.
export function downloadCsv(filename, headers, rows) {
  const cell = v => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [headers, ...rows].map(r => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Minimal CSV parser (quoted fields, escaped quotes, CRLF) for the student
// import screen — returns an array of objects keyed by the header row.
export function parseCsv(text) {
  const rows = []; let row = [], cur = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some(c => c.trim() !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some(c => c.trim() !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map(x => x.trim());
  return rows.slice(1).map(r => Object.fromEntries(headers.map((k, i) => [k, (r[i] || "").trim()])));
}

const escHtml = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Tagged template that HTML-escapes every interpolated value — printed
// documents are built from user-entered data (names, remarks), so nothing
// goes into the print window unescaped. Wrap trusted markup in raw().
export const raw = s => ({ __raw: String(s) });
export const html = (strings, ...values) => raw(strings.reduce((out, str, i) => {
  const v = values[i - 1];
  const part = Array.isArray(v) ? v.map(x => (x?.__raw ?? escHtml(x))).join("") : (v?.__raw ?? escHtml(v));
  return out + part + str;
}));

// Opens a clean, print-styled window for receipts, payslips, transcripts
// and certificates. `body` must come from the html`` tag above.
export function printDocument(title, body, { institute } = {}) {
  const w = window.open("", "_blank", "width=860,height=1000");
  if (!w) return false;
  const head = institute ? html`<header><h1>${institute.instituteName}</h1><p>${[institute.address, institute.phone, institute.email].filter(Boolean).join(" · ")}</p></header>` : raw("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title><style>
    *{box-sizing:border-box} body{font-family:Georgia,'Times New Roman',serif;color:#16233D;margin:0;padding:36px 44px;font-size:13.5px;line-height:1.55}
    header{text-align:center;border-bottom:2px solid #16233D;padding-bottom:12px;margin-bottom:22px} header h1{margin:0;font-size:24px;letter-spacing:.4px} header p{margin:4px 0 0;font-size:11.5px;color:#4B5875}
    h2{text-align:center;font-size:16px;letter-spacing:2px;text-transform:uppercase;margin:0 0 20px} h3{font-size:13px;margin:20px 0 6px;text-transform:uppercase;letter-spacing:1px}
    table{width:100%;border-collapse:collapse;margin:8px 0 14px} th,td{border:1px solid #c9c5b6;padding:6px 9px;text-align:left;font-size:12.5px} th{background:#f1eee3;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
    td.r,th.r{text-align:right} .meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 28px;margin-bottom:16px} .meta div span{color:#4B5875}
    .total td{font-weight:700;background:#f7f5ee} .sign{display:flex;justify-content:space-between;margin-top:64px} .sign div{border-top:1px solid #16233D;padding-top:5px;width:200px;text-align:center;font-size:12px}
    .foot{margin-top:28px;font-size:10.5px;color:#4B5875;text-align:center} p.body{font-size:15px;line-height:2;text-align:justify;margin:26px 0}
    @media print{body{padding:14mm}}
  </style></head><body>${head.__raw}${body.__raw}<script>window.onload=function(){setTimeout(function(){window.print()},150)}<\/script></body></html>`);
  w.document.close();
  return true;
}

// Institute room directory (3 blocks × 4 floors × 9 rooms) used by the
// legacy Classes scheduler's room picker + double-booking check.
export function generateRooms() {
  const rooms = [];
  const blocks = ["A", "B", "C"];
  const floors = ["B", "1", "2", "3"];
  blocks.forEach(block => {
    floors.forEach(floor => {
      for (let room = 1; room <= 9; room++) {
        const roomNum = String(room).padStart(2, "0");
        const roomCode = `${block}${floor}${roomNum}`;
        const address = `${block} Block, ${floor === "B" ? "Basement" : `Floor ${floor}`}, Room ${room}`;
        rooms.push({ code: roomCode, label: `${roomCode} - ${address}` });
      }
    });
  });
  return rooms;
}
