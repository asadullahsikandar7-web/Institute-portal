import { NavLink } from "react-router-dom";
import Icon from "../ui/Icon.jsx";
import { NAV, adminCan, inPlan } from "../../lib/constants.js";
import { useSession } from "../../context/SessionContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";

export default function Sidebar({ role, collapsed, mobileOpen, setMobileOpen }) {
  const { session } = useSession();
  const { settings } = useSettings();
  // Staff sub-roles only see the modules they can actually use.
  const sections = NAV[role]
    .map(sec => ({ ...sec, items: sec.items.filter(it => inPlan(session, it) && (role !== "admin" || adminCan(session, it.module))) }))
    .filter(sec => sec.items.length > 0);
  return (
    <aside className={"sidebar" + (collapsed ? " collapsed" : "") + (mobileOpen ? " mobile-open" : "")}>
      <div className="brand">
        <div className="brand-mark">A</div>
        {!collapsed && <div className="brand-text"><div className="name">ACADEXA</div><div className="by" title={settings.instituteName}>{session?.institute?.name || `${settings.instituteType} portal`}</div></div>}
      </div>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 14 }}>
        {sections.map((sec, i) => (
          <div className="nav-section" key={i}>
            {sec.label && !collapsed && <div className="nav-label">{sec.label}</div>}
            {sec.items.map(it => (
              it.locked ? (
                <div key={it.key} className="nav-item locked" title={collapsed ? it.label : it.lockMsg}>
                  <Icon name={it.icon} size={17} />
                  {!collapsed && <span style={{ flex: 1 }}>{it.label}</span>}
                  {!collapsed && <Icon name="lock" size={13} />}
                </div>
              ) : (
                <NavLink
                  key={it.key}
                  to={`/${role}/${it.key}`}
                  className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
                  title={collapsed ? it.label : ""}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon name={it.icon} size={17} />
                  {!collapsed && <span style={{ flex: 1 }}>{it.label}</span>}
                </NavLink>
              )
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
