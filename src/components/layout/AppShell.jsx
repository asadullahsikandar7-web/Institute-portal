import { useState } from "react";
import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import AIWidget from "../AIWidget.jsx";
import { CommandPalette } from "../../features/erp/SmartWidgets.jsx";

// Unifies what AdminDashboard/TeacherDashboard/StudentPortal each used to
// hand-roll independently in the monolith: Sidebar + TopBar + scrollable
// content well. `role` picks the nav set; page content comes from the
// router's <Outlet/> (see App.jsx).
export default function AppShell({ role, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar role={role} collapsed={collapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="main-col">
        <TopBar onToggleSidebar={() => { setCollapsed(c => !c); setMobileOpen(m => !m); }} />
        <div className="content">{children}</div>
      </div>
      <CommandPalette />
      {/* The AI assistant has no parent-facing tools (and the API refuses parent tokens). */}
      {role !== "parent" && <AIWidget />}
    </div>
  );
}
