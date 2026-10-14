import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../ui/Icon.jsx";
import Avatar from "../ui/Avatar.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useSession } from "../../context/SessionContext.jsx";
import { ROLE_LABEL } from "../../lib/constants.js";
import ChangePasswordModal from "../../features/erp/SharedPages.jsx";
import { NotificationBell } from "../../features/erp/SmartWidgets.jsx";

// Lazy so admin/student (who never open it) don't pay for this bundle.
const EditProfileModal = lazy(() => import("../../features/teacher/EditProfileModal.jsx"));

function UserMenu() {
  const { session, logout } = useSession();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const name = session.role === "admin" ? (session.email || "Admin")
    : session.role === "teacher" ? session.teacher?.name
    : session.role === "parent" ? session.parent?.name
    : session.student?.name;
  const photo = session.role === "teacher" ? session.teacher?.photo
    : session.role === "student" ? session.student?.photo
    : null;
  // Self-service profile editing only exists for teachers so far (Admin has
  // no name/photo field at all; Student wasn't asked for) — see the
  // EditProfileModal comment for the exact scoping.
  const canEditProfile = session.role === "teacher";

  return (
    <div style={{ position: "relative" }}>
      <button className="btn btn-ghost" onClick={() => setOpen(o => !o)} style={{ minWidth: 160, justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={name || "?"} size={24} img={photo || undefined} />
          <span style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        </span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div className="card" style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, width: 190, padding: 6, zIndex: 50 }}>
            <div style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>{ROLE_LABEL[session.role]}</div>
            {canEditProfile && (
              <div
                onClick={() => { setEditing(true); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}
              >
                <Icon name="user" size={14} />Edit Profile
              </div>
            )}
            {session.role !== "admin" && (
              <div
                onClick={() => { setChangingPassword(true); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}
              >
                <Icon name="lock" size={14} />Change Password
              </div>
            )}
            <div
              onClick={logout}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--danger)" }}
            >
              <Icon name="x" size={14} />Log out
            </div>
          </div>
        </>
      )}
      {editing && (
        <Suspense fallback={null}>
          <EditProfileModal onClose={() => setEditing(false)} />
        </Suspense>
      )}
      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </div>
  );
}

// Admin-only: one box across students, teachers, staff, books, applicants
// and tickets (GET /api/system/search). Other roles keep the inert field.
function GlobalSearch() {
  const { api, session } = useSession();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const isAdmin = session.role === "admin";

  useEffect(() => {
    if (!isAdmin || q.trim().length < 2) { setHits(null); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      api.call("GET", `/api/system/search?q=${encodeURIComponent(q.trim())}`).then(r => { if (!cancelled) setHits(r); }).catch(() => { if (!cancelled) setHits([]); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, isAdmin, api]);

  const go = hit => { setQ(""); setHits(null); navigate(hit.to); };
  return (
    <div style={{ flex: 1, maxWidth: 380, position: "relative" }}>
      <span style={{ position: "absolute", left: 11, top: 9, color: "var(--muted)" }}><Icon name="search" size={15} /></span>
      <input className="input" placeholder={isAdmin ? "Search students, staff, books, tickets…" : "Search…"} style={{ paddingLeft: 34 }} disabled={!isAdmin}
        value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Escape") { setQ(""); setHits(null); } if (e.key === "Enter" && hits?.[0]) go(hits[0]); }} />
      {hits && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 59 }} onClick={() => setHits(null)} />
          <div className="card search-pop">
            {hits.length === 0 && <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>No matches for “{q.trim()}”.</div>}
            {hits.map((h, i) => (
              <div key={i} className="search-hit" onClick={() => go(h)}>
                <span className="badge neutral" style={{ minWidth: 70, justifyContent: "center" }}>{h.kind}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function TopBar({ onToggleSidebar }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="topbar">
      <button className="icon-btn" onClick={onToggleSidebar}><Icon name="menu" size={17} /></button>
      <GlobalSearch />
      <div style={{ flex: 1 }} />
      <button className="btn btn-ghost topbar-kbd" title="Jump to any page" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}>
        <Icon name="search" size={13} />Jump to… <span className="badge neutral">Ctrl K</span>
      </button>
      <NotificationBell />
      <button className="icon-btn" onClick={toggle}>{theme === "dark" ? <Icon name="sun" size={16} /> : <Icon name="moon" size={16} />}</button>
      <UserMenu />
    </div>
  );
}
