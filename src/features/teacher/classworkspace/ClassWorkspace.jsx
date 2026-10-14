import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SectionHeader, Btn, Icon, Tabs } from "../../../components/ui/index.js";
import { useSession } from "../../../context/SessionContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import OverviewTab from "./OverviewTab.jsx";
import StudentsTab from "./StudentsTab.jsx";
import AttendanceTab from "./AttendanceTab.jsx";
import CourseworkTab from "./CourseworkTab.jsx";
import QuizzesTab from "./QuizzesTab.jsx";
import AnnouncementsTab from "./AnnouncementsTab.jsx";
import ChatTab from "./ChatTab.jsx";
import CallTab from "./CallTab.jsx";
import { GradebookTab } from "../../erp/ResultsPages.jsx";

const TABS = ["overview", "students", "attendance", "coursework", "quizzes", "gradebook", "announcements", "chat", "call"];
const TAB_LABELS = { overview: "Overview", students: "Students", attendance: "Attendance", coursework: "Assignments", quizzes: "Quizzes", gradebook: "Gradebook", announcements: "Announcements", chat: "Chat", call: "Call" };

export default function ClassWorkspace() {
  const { assignmentId, tab = "overview" } = useParams();
  const navigate = useNavigate();
  const { api } = useSession();
  const toast = useToast();
  const [cls, setCls] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getMyClass(assignmentId).then(d => { if (!cancelled) setCls(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [assignmentId, api]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>;
  if (error || !cls) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--danger)" }}>
        {error || "Class not found."} — this class may not be assigned to you.
      </div>
    );
  }

  return (
    <>
      <Btn variant="ghost" onClick={() => navigate("/teacher/myclasses")} style={{ marginBottom: 14 }}>
        <Icon name="arrowLeft" size={14} />My Classes
      </Btn>
      <SectionHeader title={cls.subject?.name} eyebrow={`${cls.program?.name} · ${cls.section?.name}`} />
      <Tabs items={TABS.map(t => ({ key: t, label: TAB_LABELS[t] }))} active={tab} onChange={t => navigate(`/teacher/myclasses/${assignmentId}/${t}`)} style={{ marginBottom: 18 }} />
      {tab === "overview" && <OverviewTab cls={cls} />}
      {tab === "students" && <StudentsTab cls={cls} />}
      {tab === "attendance" && <AttendanceTab cls={cls} />}
      {tab === "coursework" && <CourseworkTab cls={cls} />}
      {tab === "quizzes" && <QuizzesTab cls={cls} />}
      {tab === "gradebook" && <GradebookTab cls={cls} />}
      {tab === "announcements" && <AnnouncementsTab cls={cls} />}
      {tab === "chat" && <ChatTab cls={cls} />}
      {tab === "call" && <CallTab cls={cls} />}
    </>
  );
}
