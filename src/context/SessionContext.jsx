import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { makeApi, setInstitute, getInstitute } from "../lib/api.js";

const SessionCtx = createContext(null);
const STORAGE_KEY = "acadexa_session";

// Session persistence: only {token, role} are written to localStorage —
// small, and safe to keep around (a bearer token the backend already trusts
// for a day, not a secret we're inventing exposure for). The full
// student/teacher profile is re-fetched from the server on load rather than
// cached, so a stale/edited profile is never served after a refresh.
function readStored() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null); // {token, role, student?, teacher?, parent?, isSuperAdmin?, email?, adminRole?}
  const [restoring, setRestoring] = useState(true);

  const anonApi = useMemo(() => makeApi(null), []);

  useEffect(() => {
    const stored = readStored();
    if (!stored?.token || !stored?.role) {
      setRestoring(false);
      return;
    }
    (async () => {
      try {
        const api = makeApi(stored.token);
        // The institute travels with the session; a stale code from another
        // institute would otherwise be rejected by the server.
        if (stored.institute?.code && stored.institute.code !== getInstitute()) setInstitute(stored.institute.code);
        const institute = await api.call("GET", "/api/system/institute").catch(() => stored.institute || null);
        if (stored.role === "admin") {
          setSession({ token: stored.token, role: "admin", isSuperAdmin: stored.isSuperAdmin, email: stored.email, adminRole: stored.adminRole || "admin", institute });
        } else if (stored.role === "teacher") {
          const teacher = await api.getMyTeacherProfile();
          setSession({ token: stored.token, role: "teacher", teacher, institute });
        } else if (stored.role === "student") {
          const student = await api.getMyStudentProfile();
          setSession({ token: stored.token, role: "student", student, institute });
        } else if (stored.role === "parent") {
          const parent = await api.call("GET", "/api/parent-portal/me");
          setSession({ token: stored.token, role: "parent", parent, institute });
        }
      } catch {
        // Token expired/invalid — drop the stored session and fall through to login.
        window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  const handleLogin = useCallback((data) => {
    const next = {
      token: data.token,
      role: data.role,
      student: data.student || null,
      teacher: data.teacher || null,
      parent: data.parent || null,
      isSuperAdmin: data.isSuperAdmin,
      email: data.email,
      adminRole: data.adminRole || "admin",
      institute: data.institute || null,
    };
    if (data.institute?.code) setInstitute(data.institute.code);
    setSession(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      token: next.token, role: next.role, isSuperAdmin: next.isSuperAdmin, email: next.email, adminRole: next.adminRole, institute: next.institute,
    }));
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Patches the in-memory profile (teacher/student) after a self-service
  // edit — e.g. name or photo — so the topbar/avatar update immediately
  // without needing a full re-login. Never touches localStorage: per the
  // comment above, only {token,role,...} live there, and the profile is
  // always re-fetched fresh from the server on the next page load anyway.
  const updateProfile = useCallback((role, patch) => {
    setSession(prev => (prev ? { ...prev, [role]: { ...prev[role], ...patch } } : prev));
  }, []);

  const api = useMemo(() => (session?.token ? makeApi(session.token) : anonApi), [session?.token, anonApi]);

  return (
    <SessionCtx.Provider value={{ session, restoring, handleLogin, logout, updateProfile, api, anonApi }}>
      {children}
    </SessionCtx.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
