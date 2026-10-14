import { lazy, Suspense, useState } from "react";
import { useSession } from "../context/SessionContext.jsx";

// Real, working AI assistant (chat + voice + agentic action confirm/cancel),
// mounted once at the shell level so it's available from every page for
// every role — not a per-page placeholder. Lazy-loaded for the same reason
// as always: keeps socket/speech-recognition code out of the initial bundle.
const AIFloatingButton = lazy(() => import("../AI.jsx").then(m => ({ default: m.AIFloatingButton })));
const AIPanel = lazy(() => import("../AI.jsx").then(m => ({ default: m.AIPanel })));

export default function AIWidget() {
  const { session, api } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <Suspense fallback={null}>
      <AIFloatingButton open={open} onClick={() => setOpen(o => !o)} />
      {open && <AIPanel api={api} role={session.role} onClose={() => setOpen(false)} />}
    </Suspense>
  );
}
