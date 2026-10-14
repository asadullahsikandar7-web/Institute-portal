import { useEffect, useState } from "react";
import { SectionHeader, Card, Btn, Icon, Select } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function TimetablePage() {
  const { api } = useSession();
  const toast = useToast();
  const [timetable, setTimetable] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const [activeDay, setActiveDay] = useState(DAYS.includes(todayName) ? todayName : DAYS[0]);
  const EMPTY = { day: "Monday", time: "", subject: "", teacher: "", room: "" };
  const [form, setForm] = useState(EMPTY);

  const reload = () => {
    setLoading(true);
    api.getTimetable().then(d => {
      const obj = {};
      (Array.isArray(d) ? d : []).forEach(cls => { (obj[cls.day] = obj[cls.day] || []).push(cls); });
      setTimetable(obj);
    }).catch(() => setTimetable({})).finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  const addClass = async () => {
    if (!form.day || !form.time || !form.subject || !form.teacher) return toast("Day, time, subject, teacher required");
    try {
      await api.addTimetable(form);
      toast("Class added", "check");
      setForm(EMPTY); setShowAdd(false); reload();
    } catch (e) { toast(e.message); }
  };

  const schedule = timetable[activeDay] || [];

  return (
    <>
      <SectionHeader eyebrow="Other" title="Timetable" />
      <Card style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Class Timetable</div>
          <Btn variant="accent" onClick={() => setShowAdd(p => !p)}><Icon name="plus" size={13} />{showAdd ? "Cancel" : "Add Class"}</Btn>
        </div>
        {showAdd && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8, padding: 14, background: "var(--surface-alt)", borderRadius: 12, marginBottom: 16 }}>
            <Select value={form.day} onChange={e => setForm(p => ({ ...p, day: e.target.value }))}>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
            <input className="input" placeholder="08:00-09:30" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
            <input className="input" placeholder="Subject" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
            <input className="input" placeholder="Teacher" value={form.teacher} onChange={e => setForm(p => ({ ...p, teacher: e.target.value }))} />
            <input className="input" placeholder="Room" value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))} />
            <Btn variant="accent" onClick={addClass}><Icon name="check" size={14} />Save</Btn>
          </div>
        )}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--surface-alt)", borderRadius: 12, padding: 4, width: "fit-content" }}>
          {DAYS.map(d => (
            <button key={d} onClick={() => setActiveDay(d)} className="btn" style={{
              padding: "8px 16px",
              background: activeDay === d ? "var(--accent)" : "transparent",
              color: activeDay === d ? "#1a1204" : d === todayName ? "var(--accent-ink)" : "var(--muted)",
            }}>
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
        {loading && <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}
        {!loading && schedule.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>No classes scheduled for {activeDay}.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {schedule.map((cls, i) => (
            <div key={i} style={{ display: "flex", gap: 16, alignItems: "stretch", padding: "14px 18px", background: "var(--surface-alt)", borderRadius: 14, borderLeft: "3px solid var(--accent)" }}>
              <div style={{ width: 80, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{(cls.time || "").split("-")[0]}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{(cls.time || "").split("-")[1]}</div>
              </div>
              <div style={{ width: 1, background: "var(--border)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{cls.subject}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 12 }}>
                  <span>{cls.teacher}</span>{cls.room && <span>{cls.room}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
