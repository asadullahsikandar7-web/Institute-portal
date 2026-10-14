import { useEffect, useState } from "react";
import { SectionHeader, Card, EmptyState, Icon } from "../../components/ui/index.js";
import GroupChatBox from "../../components/GroupChatBox.jsx";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

// Browse chat groups across every class you teach, in one place — the
// per-class chat management (mode/member controls) lives inside that
// class's workspace (My Classes → open a class → Chat tab); this is just
// the quick cross-class inbox.
export default function TeacherChatGroupsPage() {
  const { api } = useSession();
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getMyClasses().then(classes => {
      if (classes.length === 0) { if (!cancelled) setLoading(false); return; }
      return Promise.all(classes.map(c => api.getClassChatGroup(c._id).then(g => ({ ...g, cls: c })).catch(() => null)))
        .then(list => { if (!cancelled) setGroups(list.filter(Boolean)); });
    }).catch(e => toast(e.message)).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    if (!selected?._id) return;
    let stop = false;
    setLoadingMsgs(true);
    const load = () => api.getGroupMessages(selected._id).then(m => { if (!stop) setMessages(Array.isArray(m) ? m : []); }).catch(() => {}).finally(() => setLoadingMsgs(false));
    load();
    const t = setInterval(load, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [selected?._id, api]);

  const send = text => {
    api.sendGroupMessage(selected._id, text).then(m => setMessages(p => [...p, m])).catch(e => toast(e.message));
  };

  return (
    <>
      <SectionHeader eyebrow="Communication" title="Chat" />
      {loading ? (
        <Card style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</Card>
      ) : groups.length === 0 ? (
        <Card style={{ padding: 24 }}><EmptyState icon="message" title="No class chat groups yet" desc="Open a class under My Classes to create one." /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {groups.map(g => (
              <Card
                key={g._id}
                onClick={() => setSelected(g)}
                style={{ padding: 14, cursor: "pointer", borderColor: selected?._id === g._id ? "var(--accent)" : "var(--border)" }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{g.cls.subject?.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{g.cls.program?.name} · {g.cls.section?.name}</div>
              </Card>
            ))}
          </div>
          {selected ? (
            <GroupChatBox
              messages={messages}
              loading={loadingMsgs}
              onSend={send}
              myModel="Teacher"
              disabled={selected.mode === "teacher_only"}
              placeholder="Message the class…"
              height={520}
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
