import { useEffect, useState } from "react";
import { SectionHeader, StatCard, Card, Btn, Icon, Select, Badge, Modal, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { generateRooms } from "../../../lib/utils.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ROOMS = generateRooms();

function TomorrowEditModal({ cls, onClose, onSaved }) {
  const { api } = useSession();
  const toast = useToast();
  const [form, setForm] = useState({ topic: cls.tomorrowTopic || "", materials: (cls.tomorrowMaterials || []).join(", "), assignment: cls.tomorrowAssignment || "", deadline: cls.tomorrowDeadline || "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.topic) return toast("Topic is required");
    setSaving(true);
    try {
      await api.setTomorrowClass(cls._id, { topic: form.topic, materials: form.materials ? form.materials.split(",").map(m => m.trim()) : [], assignment: form.assignment, deadline: form.deadline });
      toast("Tomorrow's class updated — students notified", "check");
      onSaved();
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Manage Tomorrow — ${cls.className}`} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" onClick={save} disabled={saving}>Save & Notify Students</Btn>
    </>}>
      <div style={{ display: "grid", gap: 12 }}>
        <div><label className="field-label">Topic for Tomorrow</label><input className="input" value={form.topic} onChange={e => setForm(p => ({ ...p, topic: e.target.value }))} /></div>
        <div><label className="field-label">Materials (comma-separated)</label><input className="input" value={form.materials} onChange={e => setForm(p => ({ ...p, materials: e.target.value }))} /></div>
        <div><label className="field-label">Assignment</label><input className="input" value={form.assignment} onChange={e => setForm(p => ({ ...p, assignment: e.target.value }))} /></div>
        <div><label className="field-label">Deadline (optional)</label><input className="input" type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} /></div>
      </div>
    </Modal>
  );
}

export default function ClassesPage() {
  const { api } = useSession();
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [tomorrow, setTomorrow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const EMPTY = { classCode: "", className: "", semester: 1, teacher: "", scheduleDay: "Monday", scheduleTime: "08:00-09:30", room: "" };
  const [form, setForm] = useState(EMPTY);
  const [editingTomorrow, setEditingTomorrow] = useState(null);

  const reload = () => {
    setLoading(true);
    Promise.all([api.getClasses(), api.getTomorrowClasses()])
      .then(([c, t]) => { setClasses(Array.isArray(c) ? c : []); setTomorrow(t); })
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  const addClass = async () => {
    if (!form.classCode || !form.className || !form.teacher || !form.room) return toast("Fill all required fields");
    const conflict = classes.find(c => c.room === form.room && c.scheduleDay === form.scheduleDay && c.scheduleTime === form.scheduleTime);
    if (conflict) return toast(`Room ${form.room} is already booked at ${form.scheduleDay} ${form.scheduleTime}`);
    try {
      await api.addClass(form);
      toast("Class created", "check");
      setForm(EMPTY); setShowAdd(false); reload();
    } catch (e) { toast(e.message); }
  };

  const semesters = [...new Set(classes.map(c => c.semester))].sort();

  return (
    <>
      <SectionHeader eyebrow="Other" title="Classes (Legacy)" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard label="Total Classes" value={classes.length} icon="book" />
        <StatCard label="Tomorrow's Classes" value={tomorrow?.classes?.length || 0} icon="calendar" />
        <StatCard label="Active Semesters" value={semesters.length} icon="layers" />
      </div>

      {tomorrow && (
        <Card style={{ padding: 22, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Tomorrow's Classes ({tomorrow.date})</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>{tomorrow.day}</div>
          {tomorrow.classes.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No classes scheduled for tomorrow</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
              {tomorrow.classes.map(cls => (
                <Card key={cls._id} style={{ padding: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{cls.className}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>{cls.room} · {cls.scheduleTime} · {cls.teacher}</div>
                  {cls.tomorrowTopic && <div style={{ background: "var(--info-soft)", color: "var(--info)", borderRadius: 8, padding: 8, marginBottom: 6, fontSize: 12 }}><b>Topic:</b> {cls.tomorrowTopic}</div>}
                  {cls.tomorrowAssignment && <div style={{ background: "var(--warn-soft)", color: "var(--warn)", borderRadius: 8, padding: 8, marginBottom: 6, fontSize: 12 }}><b>Assignment:</b> {cls.tomorrowAssignment}</div>}
                  <Btn variant="ghost" full onClick={() => setEditingTomorrow(cls)}><Icon name="check" size={11} />Edit Tomorrow</Btn>
                </Card>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>All Classes</div>
          <Btn variant="accent" onClick={() => setShowAdd(p => !p)}><Icon name="plus" size={13} />{showAdd ? "Cancel" : "Add Class"}</Btn>
        </div>
        {showAdd && (
          <div style={{ padding: 14, background: "var(--surface-alt)", borderRadius: 12, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 12 }}>
              <input className="input" placeholder="Class Code *" value={form.classCode} onChange={e => setForm(p => ({ ...p, classCode: e.target.value }))} />
              <input className="input" placeholder="Class Name *" value={form.className} onChange={e => setForm(p => ({ ...p, className: e.target.value }))} />
              <input className="input" placeholder="Teacher *" value={form.teacher} onChange={e => setForm(p => ({ ...p, teacher: e.target.value }))} />
              <Select value={form.scheduleDay} onChange={e => setForm(p => ({ ...p, scheduleDay: e.target.value }))}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
              <input className="input" type="time" value={form.scheduleTime.split("-")[0] || ""} onChange={e => setForm(p => ({ ...p, scheduleTime: e.target.value + "-" + (p.scheduleTime.split("-")[1] || "09:30") }))} />
              <input className="input" type="time" value={form.scheduleTime.split("-")[1] || ""} onChange={e => setForm(p => ({ ...p, scheduleTime: (p.scheduleTime.split("-")[0] || "08:00") + "-" + e.target.value }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
              <Select value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))}>
                <option value="">Select Room *</option>
                {ROOMS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
              </Select>
              <Btn variant="accent" onClick={addClass}><Icon name="check" size={14} />Add Class</Btn>
            </div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}
        {!loading && classes.length === 0 && <EmptyState icon="book" title="No classes yet" />}
        {semesters.map(sem => (
          <div key={sem} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-ink)", letterSpacing: 1, marginBottom: 8 }}>SEMESTER {sem}</div>
            {classes.filter(c => c.semester === sem).map(c => (
              <Card key={c._id} style={{ padding: 16, marginBottom: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", alignItems: "center", gap: 12 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 700 }}>{c.className}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{c.classCode} · {c.teacher}</div></div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.scheduleDay} {c.scheduleTime}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.room}</div>
                  <div style={{ fontSize: 12, color: "var(--info)", fontWeight: 600 }}>{c.students?.length || 0} students</div>
                  <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </Card>
            ))}
          </div>
        ))}
      </Card>
      {editingTomorrow && <TomorrowEditModal cls={editingTomorrow} onClose={() => setEditingTomorrow(null)} onSaved={() => { setEditingTomorrow(null); reload(); }} />}
    </>
  );
}
