import { useCallback, useEffect, useState } from "react";
import { StatCard, Card, Avatar, Btn } from "../../../components/ui/index.js";
import { today, fmt } from "../../../lib/utils.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { LiveAttendancePanel } from "../../erp/SmartWidgets.jsx";
import { CsvImportButton } from "../../../components/CsvImport.jsx";

const STATUSES = ["present", "absent", "leave"];

export default function AttendanceTab({ cls }) {
  const { api } = useSession();
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadDay = useCallback(() => {
    setLoading(true);
    api.getClassAttendance(cls._id, date).then(d => setStudents(Array.isArray(d.students) ? d.students : []))
      .catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [cls._id, date, api]);
  useEffect(loadDay, [date]);

  const loadHistory = useCallback(() => {
    api.getClassAttendanceHistory(cls._id).then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoadingHistory(false));
  }, [cls._id, api]);
  useEffect(loadHistory, [cls._id]);

  const setStatus = (studentId, status) => setStudents(p => p.map(s => s.studentId === studentId ? { ...s, status } : s));
  const markAllPresent = () => setStudents(p => p.map(s => ({ ...s, status: "present" })));

  const save = async () => {
    const records = students.filter(s => s.status !== "unmarked").map(s => ({ student: s.studentId, status: s.status }));
    if (records.length === 0) return toast("Mark at least one student first");
    setSaving(true);
    try {
      const res = await api.markClassAttendance(cls._id, { date, records });
      toast(`Attendance saved for ${res.marked} student(s)`, "check");
      loadDay(); loadHistory();
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  const windowStats = days => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const recs = history.filter(r => new Date(r.date) >= cutoff);
    const present = recs.filter(r => r.status === "present").length;
    return { total: recs.length, rate: recs.length ? Math.round(present / recs.length * 100) : null };
  };
  const week = windowStats(7), month = windowStats(30);
  const byDate = history.reduce((acc, r) => { (acc[r.date] = acc[r.date] || []).push(r); return acc; }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <LiveAttendancePanel cls={cls} onChanged={() => { loadDay(); loadHistory(); }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
        <StatCard label="Today Marked" value={`${students.filter(s => s.status !== "unmarked").length}/${students.length}`} icon="clipboard" />
        <StatCard label="7-Day Rate" value={week.rate != null ? `${week.rate}%` : "—"} icon="trend" />
        <StatCard label="30-Day Rate" value={month.rate != null ? `${month.rate}%` : "—"} icon="trend" />
      </div>
      <Card style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Mark Attendance — {fmt(date)}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="date" className="input" value={date} max={today()} onChange={e => setDate(e.target.value)} style={{ width: "auto" }} />
            <CsvImportButton title="Import attendance" filename={`attendance-${cls.section?.name || "class"}`}
              note="One row per student per day — e.g. a register you kept in Excel. The template lists this class with today's date; add rows for other days as needed."
              columns={[
                { key: "student", label: "Roll No", required: true, aliases: ["rollNumber", "student"], lookup: async () => students.map(s => ({ value: s.studentId, label: s.rollNo, keys: [s.name] })) },
                { key: "name", label: "Student Name", hint: "Optional — for your reference only" },
                { key: "date", label: "Date", type: "date", required: true },
                { key: "status", label: "Status", required: true, options: STATUSES.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })), aliases: ["attendance"] },
              ]}
              samples={students.map(s => ({ student: s.rollNo, name: s.name, date: today(), status: "Present" }))}
              submit={row => {
                if (row.date > today()) throw new Error("Attendance can't be marked for a future date");
                return api.markClassAttendance(cls._id, { date: row.date, records: [{ student: row.student, status: row.status }] });
              }}
              onDone={() => { loadDay(); loadHistory(); }} />
            <Btn variant="ghost" onClick={markAllPresent}>Mark All Present</Btn>
            <Btn variant="accent" onClick={save} disabled={saving || loading}>Save Attendance</Btn>
          </div>
        </div>
        {loading ? <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Loading…</div> :
          students.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>No students enrolled in this section yet.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {students.map(s => (
                <div key={s.studentId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--surface-alt)", borderRadius: 10, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Avatar name={s.name} size={32} img={s.photo || undefined} />
                    <div><div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>Roll #{s.rollNo}</div></div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {STATUSES.map(st => (
                      <button
                        key={st}
                        onClick={() => setStatus(s.studentId, st)}
                        className="btn"
                        style={{
                          padding: "6px 12px", textTransform: "capitalize",
                          background: s.status === st ? "var(--accent-soft)" : "transparent",
                          color: s.status === st ? "var(--accent-ink)" : "var(--muted)",
                          border: `1px solid ${s.status === st ? "transparent" : "var(--border)"}`,
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
      </Card>
      <Card style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: "var(--ink-soft)" }}>ATTENDANCE HISTORY</div>
        {loadingHistory ? <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Loading…</div> :
          Object.keys(byDate).length === 0 ? <div style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>No attendance recorded yet.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
              {Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])).map(([d, recs]) => {
                const present = recs.filter(r => r.status === "present").length;
                return (
                  <div key={d} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "var(--surface-alt)", fontSize: 12 }}>
                    <span>{fmt(d)}</span>
                    <span style={{ color: "var(--muted)" }}>{present}/{recs.length} present ({Math.round(present / recs.length * 100)}%)</span>
                  </div>
                );
              })}
            </div>
          )}
      </Card>
    </div>
  );
}
