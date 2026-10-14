import { useEffect, useState } from "react";
import { Card, Icon } from "../../../components/ui/index.js";
import GroupChatBox from "../../../components/GroupChatBox.jsx";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";

const MODES = [["teacher_only", "Teacher Only"], ["teacher_selected", "Teacher + Selected Students"], ["teacher_all", "Teacher + All Students"]];

export default function ChatTab({ cls }) {
  const { api } = useSession();
  const toast = useToast();
  const [group, setGroup] = useState(null);
  const [students, setStudents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [savingMode, setSavingMode] = useState(false);

  useEffect(() => {
    api.getClassChatGroup(cls._id).then(setGroup).catch(e => toast(e.message)).finally(() => setLoadingGroup(false));
    api.getClassStudents(cls._id).then(d => setStudents(Array.isArray(d) ? d : [])).catch(() => {});
  }, [cls._id, api]);

  useEffect(() => {
    if (!group?._id) return;
    let stop = false;
    const load = () => api.getGroupMessages(group._id).then(m => { if (!stop) setMessages(Array.isArray(m) ? m : []); }).catch(() => {}).finally(() => setLoadingMsgs(false));
    load();
    const t = setInterval(load, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [group?._id, api]);

  const send = text => {
    api.sendGroupMessage(group._id, text).then(m => setMessages(p => [...p, m])).catch(e => toast(e.message));
  };
  const setMode = async mode => {
    setSavingMode(true);
    try {
      const updated = await api.updateChatGroup(group._id, { mode });
      setGroup(p => ({ ...p, mode: updated.mode, members: updated.members }));
    } catch (e) { toast(e.message); }
    finally { setSavingMode(false); }
  };
  const toggleMember = async studentId => {
    const current = group.members || [];
    const has = current.map(String).includes(String(studentId));
    const next = has ? current.filter(id => String(id) !== String(studentId)) : [...current, studentId];
    try {
      const updated = await api.updateChatGroup(group._id, { members: next });
      setGroup(p => ({ ...p, members: updated.members }));
    } catch (e) { toast(e.message); }
  };

  if (loadingGroup) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>;
  if (!group) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Could not load this class's chat group.</div>;

  const memberIds = (group.memberIds || []).map(String);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Group Settings</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>{memberIds.length} student(s) currently see this group</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {MODES.map(([k, label]) => (
            <button
              key={k}
              disabled={savingMode}
              onClick={() => setMode(k)}
              className="btn"
              style={{
                background: group.mode === k ? "var(--accent-soft)" : "transparent",
                color: group.mode === k ? "var(--accent-ink)" : "var(--muted)",
                border: `1px solid ${group.mode === k ? "transparent" : "var(--border)"}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {group.mode === "teacher_selected" && (
          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {students.map(s => {
              const active = memberIds.includes(String(s._id));
              return (
                <button
                  key={s._id}
                  onClick={() => toggleMember(s._id)}
                  className="btn"
                  style={{
                    padding: "6px 10px",
                    background: active ? "var(--success-soft)" : "transparent",
                    color: active ? "var(--success)" : "var(--muted)",
                    border: `1px solid ${active ? "transparent" : "var(--border)"}`,
                  }}
                >
                  <Icon name={active ? "check" : "plus"} size={11} />{s.name}
                </button>
              );
            })}
          </div>
        )}
      </Card>
      <GroupChatBox messages={messages} loading={loadingMsgs} onSend={send} myModel="Teacher" disabled={group.mode === "teacher_only"} placeholder="Message the class…" />
    </div>
  );
}
