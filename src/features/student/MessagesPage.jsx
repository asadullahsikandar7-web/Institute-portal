import { useEffect, useState } from "react";
import { SectionHeader, Card, EmptyState, Icon } from "../../components/ui/index.js";
import GroupChatBox from "../../components/GroupChatBox.jsx";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

// Per-subject group chat with your teacher and classmates — separate from
// the 1:1 institute Support Chat under "Other". Send permission depends on
// the group's mode (teacher_only/teacher_selected/teacher_all), enforced
// server-side; GroupChatBox just reflects it via `disabled`.
export default function StudentMessagesPage() {
  const { api } = useSession();
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    api.getMyChatGroups().then(d => setGroups(Array.isArray(d) ? d : [])).catch(e => toast(e.message)).finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    if (!selected?._id) return;
    let stop = false;
    setLoadingMsgs(true);
    const load = () => api.getStudentGroupMessages(selected._id).then(m => { if (!stop) setMessages(Array.isArray(m) ? m : []); }).catch(() => {}).finally(() => setLoadingMsgs(false));
    load();
    const t = setInterval(load, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [selected?._id, api]);

  const send = text => {
    api.sendStudentGroupMessage(selected._id, text).then(m => setMessages(p => [...p, m])).catch(e => toast(e.message));
  };

  return (
    <>
      <SectionHeader eyebrow="Communication" title="Messages" />
      {loading ? (
        <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
      ) : groups.length === 0 ? (
        <Card style={{ padding: 24 }}><EmptyState icon="message" title="No class chat groups yet" desc="These appear once a teacher's class chat is available to you." /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {groups.map(g => (
              <Card
                key={g._id}
                onClick={() => setSelected(g)}
                style={{ padding: 14, cursor: "pointer", borderColor: selected?._id === g._id ? "var(--accent)" : "var(--border)" }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{g.teacherAssignment?.subject?.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{g.teacherAssignment?.teacher?.name}</div>
              </Card>
            ))}
          </div>
          {selected ? (
            <GroupChatBox
              messages={messages}
              loading={loadingMsgs}
              onSend={send}
              myModel="Student"
              disabled={selected.mode === "teacher_only"}
              placeholder="Message the class…"
              height={480}
            />
          ) : (
            <Card style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>
              <Icon name="message" size={22} />
              <div style={{ marginTop: 8 }}>Select a group to view messages.</div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
