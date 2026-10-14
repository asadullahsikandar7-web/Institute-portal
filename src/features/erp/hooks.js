import { useCallback, useEffect, useState } from "react";
import { useSession } from "../../context/SessionContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

// GET a path and keep the result in state. Returns [data, reload, loading].
// `path` may be null to skip the request (e.g. until a filter is chosen).
export function useLoad(path, initial = null) {
  const { api } = useSession();
  const toast = useToast();
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!!path);

  const reload = useCallback(() => {
    if (!path) { setData(initial); setLoading(false); return; }
    setLoading(true);
    let cancelled = false;
    api.call("GET", path)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) toast(e.message, "alert"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, path]);
  useEffect(() => reload(), [reload]);

  return [data, reload, loading];
}

// Wraps an async action with a busy flag and toast feedback.
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, successMsg) => {
    setBusy(true);
    try {
      const out = await fn();
      if (successMsg) toast(typeof successMsg === "function" ? successMsg(out) : successMsg, "check");
      return out;
    } catch (e) {
      toast(e.message, "alert");
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [toast]);
  return [run, busy];
}

export const STUDENT_SOURCE = { path: "/api/students", label: s => `${s.name} · #${s.rollNo}` };
