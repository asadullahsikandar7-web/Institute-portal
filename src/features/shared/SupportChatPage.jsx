import { lazy, Suspense } from "react";
import { SectionHeader, Icon } from "../../components/ui/index.js";
import { useSession } from "../../context/SessionContext.jsx";

// Real-time 1:1 chat with the institute office (student side) or with any
// student (admin side) — socket.io-backed, lazy-loaded (see Chat.jsx header
// for why). Distinct from the per-subject group chat (GroupChatBox).
const StudentChatPage = lazy(() => import("../../Chat.jsx").then(m => ({ default: m.StudentChatPage })));
const AdminChatPage = lazy(() => import("../../Chat.jsx").then(m => ({ default: m.AdminChatPage })));

function Fallback() {
  return (
    <div style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>
      <Icon name="message" size={22} />
      <div style={{ marginTop: 8 }}>Loading chat…</div>
    </div>
  );
}

export default function SupportChatPage() {
  const { session, api } = useSession();
  return (
    <>
      <SectionHeader eyebrow="Other" title="Support Chat" />
      <Suspense fallback={<Fallback />}>
        {session.role === "admin"
          ? <AdminChatPage api={api} token={session.token} />
          : <StudentChatPage api={api} token={session.token} />}
      </Suspense>
    </>
  );
}
