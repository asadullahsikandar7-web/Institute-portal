import { useEffect, useState } from "react";
import { SectionHeader, Card, Btn, Icon, Badge, Modal, StatCard, EmptyState } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { CsvImportButton } from "../../../components/CsvImport.jsx";
import SuggestionsButton from "../../../components/Suggestions.jsx";
import { ROOM_SUGGESTIONS } from "../../../lib/suggestions.js";
import { roomsImport } from "../../../lib/csvImports.js";

const TYPES = ["classroom", "lab", "auditorium", "office", "other"];

const BOOL_FACILITIES = [
  { key: "multimedia", label: "Multimedia", icon: "monitor" },
  { key: "ac", label: "AC", icon: "snowflake" },
  { key: "whiteboard", label: "Whiteboard", icon: "clipboard" },
  { key: "internet", label: "Internet", icon: "wifi" },
];
const COUNT_FACILITIES = [
  { key: "fans", label: "Fans", icon: "wind" },
  { key: "lights", label: "Lights", icon: "bulb" },
  { key: "computers", label: "Computers", icon: "monitor" },
];

const EMPTY_FORM = {
  name: "", type: "classroom", capacity: "", building: "", status: "active", notes: "",
  facilities: { multimedia: false, ac: false, whiteboard: false, internet: false, fans: 0, lights: 0, computers: 0 },
};

function RoomModal({ room, onClose, onSaved }) {
  const { api } = useSession();
  const toast = useToast();
  const [form, setForm] = useState(room ? {
    name: room.name, type: room.type, capacity: room.capacity ?? "", building: room.building || "", status: room.status, notes: room.notes || "",
    facilities: { ...EMPTY_FORM.facilities, ...room.facilities },
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const setFacility = (key, value) => setForm(f => ({ ...f, facilities: { ...f.facilities, [key]: value } }));

  const submit = async () => {
    if (!form.name.trim()) return toast("Room name is required");
    setSaving(true);
    try {
      const body = { ...form, capacity: form.capacity === "" ? null : Number(form.capacity) };
      if (room) await api.updateRoom(room._id, body);
      else await api.addRoom(body);
      toast(room ? "Room updated" : "Room added", "check");
      onSaved();
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!room) return;
    if (!window.confirm(`Delete room "${room.name}"? This can't be undone.`)) return;
    setSaving(true);
    try {
      await api.deleteRoom(room._id);
      toast("Room deleted", "check");
      onSaved();
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={room ? `Edit ${room.name}` : "Add Room"} onClose={onClose} footer={<>
      {room && <Btn variant="danger" onClick={remove} disabled={saving}><Icon name="x" size={13} />Delete</Btn>}
      <div style={{ flex: 1 }} />
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="accent" onClick={submit} disabled={saving}>{room ? "Save Changes" : "Add Room"}</Btn>
    </>}>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label className="field-label">Room Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. A2H2" />
          </div>
          <div><label className="field-label">Type</label>
            <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {TYPES.map(t => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div><label className="field-label">Capacity</label>
            <input className="input" type="number" min="0" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="Unknown" />
          </div>
          <div><label className="field-label">Building</label>
            <input className="input" value={form.building} onChange={e => setForm(f => ({ ...f, building: e.target.value }))} placeholder="Unknown" />
          </div>
        </div>

        {room && (
          <div><label className="field-label">Status</label>
            <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        )}

        <div>
          <label className="field-label">Facilities</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginTop: 4 }}>
            {BOOL_FACILITIES.map(f => (
              <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "var(--surface-alt)", borderRadius: 9, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={!!form.facilities[f.key]} onChange={e => setFacility(f.key, e.target.checked)} />
                <Icon name={f.icon} size={14} />{f.label}
              </label>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginTop: 8 }}>
            {COUNT_FACILITIES.map(f => (
              <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name={f.icon} size={14} />
                <span style={{ fontSize: 12.5, color: "var(--muted)", flex: 1 }}>{f.label}</span>
                <input className="input" type="number" min="0" style={{ width: 64 }} value={form.facilities[f.key]} onChange={e => setFacility(f.key, Math.max(0, Number(e.target.value) || 0))} />
              </div>
            ))}
          </div>
        </div>

        <div><label className="field-label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional — anything else worth noting about this room" />
        </div>
      </div>
    </Modal>
  );
}

function FacilityChips({ facilities = {} }) {
  const chips = [];
  BOOL_FACILITIES.forEach(f => { if (facilities[f.key]) chips.push({ key: f.key, label: f.label, icon: f.icon }); });
  COUNT_FACILITIES.forEach(f => { if (facilities[f.key] > 0) chips.push({ key: f.key, label: `${f.label} (${facilities[f.key]})`, icon: f.icon }); });
  if (chips.length === 0) return <span style={{ fontSize: 12, color: "var(--muted)" }}>No facilities recorded yet</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {chips.map(c => <Badge key={c.key} tone="neutral" icon={c.icon}>{c.label}</Badge>)}
    </div>
  );
}

export default function RoomsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [rooms, setRooms] = useState([]);
  const [usage, setUsage] = useState({}); // roomId -> count of schedule entries
  const [loading, setLoading] = useState(true);
  const [modalRoom, setModalRoom] = useState(undefined); // undefined = closed, null = add, object = edit

  const reload = () => {
    setLoading(true);
    Promise.all([api.getRooms(), api.getScheduleAdmin().catch(() => [])])
      .then(([rms, entries]) => {
        setRooms(rms);
        const counts = {};
        entries.forEach(e => { const id = e.room?._id; if (id) counts[id] = (counts[id] || 0) + 1; });
        setUsage(counts);
      })
      .catch(e => toast(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [api]);

  const active = rooms.filter(r => r.status === "active");
  const withAc = rooms.filter(r => r.facilities?.ac).length;
  const withMultimedia = rooms.filter(r => r.facilities?.multimedia).length;

  return (
    <>
      <SectionHeader eyebrow="Academic" title="Rooms & Facilities" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Rooms" value={loading ? "…" : rooms.length} icon="layers" />
        <StatCard label="Active" value={loading ? "…" : active.length} icon="check" />
        <StatCard label="With AC" value={loading ? "…" : withAc} icon="snowflake" />
        <StatCard label="With Multimedia" value={loading ? "…" : withMultimedia} icon="monitor" />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
        <SuggestionsButton title="Suggested rooms" catalog={ROOM_SUGGESTIONS} existing={rooms.map(r => r.name)} submit={d => api.addRoom({ ...d, status: "active", facilities: { ...EMPTY_FORM.facilities, whiteboard: d.type === "classroom" || d.type === "lab" } })} onDone={reload} note="Rename or fill in facilities afterwards by clicking a room." />
        <CsvImportButton {...roomsImport(api)} onDone={reload} />
        <Btn variant="accent" onClick={() => setModalRoom(null)}><Icon name="plus" size={13} />Add Room</Btn>
      </div>

      {loading ? (
        <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
      ) : rooms.length === 0 ? (
        <Card style={{ padding: 24 }}><EmptyState icon="layers" title="No rooms added yet" desc="Add your institute's rooms to track facilities and prevent scheduling conflicts." /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          {rooms.map(r => (
            <Card key={r._id} style={{ padding: 18, cursor: "pointer" }} onClick={() => setModalRoom(r)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                    {r.type[0].toUpperCase() + r.type.slice(1)}
                    {r.capacity != null && ` · Capacity ${r.capacity}`}
                    {r.building && ` · ${r.building}`}
                  </div>
                </div>
                <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</Badge>
              </div>
              <FacilityChips facilities={r.facilities} />
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                {usage[r._id] || 0} scheduled {usage[r._id] === 1 ? "class" : "classes"}
              </div>
            </Card>
          ))}
        </div>
      )}

      {modalRoom !== undefined && (
        <RoomModal room={modalRoom} onClose={() => setModalRoom(undefined)} onSaved={() => { setModalRoom(undefined); reload(); }} />
      )}
    </>
  );
}
