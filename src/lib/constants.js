// Nav structure per role. The original groupings (Academic / People /
// Finance / Communication / Other) are kept; the ERP layer adds
// Admissions, Examinations, HR & Payroll and Campus Services for admins,
// self-service entries for teachers and students, and a parent portal.
//
// `module` on an admin item ties it to a backend permission module (see
// backend/src/services/permissions.js): a staff sub-role only sees the
// items for modules it can use. Items without one are visible to every
// admin account.
export const NAV = {
  admin: [
    { label: "", items: [
      { key: "dashboard", label: "Dashboard", icon: "home" },
      { key: "overview", label: "Command Center", icon: "trend" },
      { key: "insights", label: "Insights", icon: "trend" },
    ]},
    { label: "Admissions", items: [
      { key: "admissions", label: "Applications", icon: "upload", module: "admissions" },
    ]},
    { label: "Academic", items: [
      { key: "sessions", label: "Sessions", icon: "calendar", module: "academics" },
      { key: "programs", label: "Classes / Programs", icon: "layers", module: "academics" },
      { key: "subjects", label: "Subjects", icon: "book", module: "academics" },
      { key: "assignments-teacher", label: "Teacher Assignments", icon: "users", module: "academics" },
      { key: "class-schedule", label: "Class Schedule", icon: "calendar", module: "academics" },
      { key: "substitutions", label: "Substitute Cover", icon: "users", module: "academics" },
      { key: "rooms", label: "Rooms & Facilities", icon: "monitor", module: "academics" },
      { key: "attendance", label: "Attendance", icon: "clipboard", module: "academics" },
      { key: "calendar", label: "Academic Calendar", icon: "calendar" },
    ]},
    { label: "Examinations", items: [
      { key: "results", label: "Results & Grading", icon: "award", module: "exams" },
      { key: "transcripts", label: "Transcripts", icon: "grad", module: "exams" },
      { key: "exam-sessions", label: "Exams & Datesheets", icon: "calendar", module: "exams" },
      { key: "surveys", label: "Teacher Evaluation", icon: "trend", module: "exams" },
      { key: "exams", label: "Exam Notices (Legacy)", icon: "file", module: "exams" },
    ]},
    { label: "People", items: [
      { key: "students", label: "Students", icon: "users", module: "students" },
      { key: "success", label: "Student Success", icon: "alert", module: "lifecycle" },
      { key: "student360", label: "Student 360", icon: "user", module: "lifecycle" },
      { key: "import", label: "Bulk Import", icon: "upload", module: "lifecycle" },
      { key: "promotion", label: "Promotion", icon: "arrowUp", module: "lifecycle" },
      { key: "teachers", label: "Teachers", icon: "grad", module: "academics" },
      { key: "records", label: "Student Records", icon: "clipboard", module: "engage" },
      { key: "certificates", label: "Certificates", icon: "idcard", module: "engage" },
      { key: "alumni", label: "Alumni", icon: "award", module: "engage" },
    ]},
    { label: "Finance", items: [
      { key: "fees", label: "Fee Collection", icon: "dollar", module: "finance" },
      { key: "fee-structures", label: "Fee Structures", icon: "layers", module: "finance" },
      { key: "scholarships", label: "Scholarships", icon: "award", module: "finance" },
      { key: "expenses", label: "Expenses", icon: "wallet", module: "finance" },
      { key: "finance-reports", label: "Finance Reports", icon: "trend", module: "finance" },
    ]},
    { label: "HR & Payroll", items: [
      { key: "departments", label: "Departments", icon: "layers", module: "hr" },
      { key: "staff", label: "Staff", icon: "briefcase", module: "hr" },
      { key: "staff-attendance", label: "Staff Attendance", icon: "clipboard", module: "hr" },
      { key: "staff-leaves", label: "Staff Leave", icon: "clock", module: "hr" },
      { key: "payroll", label: "Payroll", icon: "wallet", module: "payroll" },
    ]},
    { label: "Campus Services", items: [
      { key: "library", label: "Library", icon: "library", module: "library" },
      { key: "transport", label: "Transport", icon: "bus", module: "campus" },
      { key: "hostel", label: "Hostel", icon: "bed", module: "campus" },
      { key: "assets", label: "Inventory", icon: "box", module: "campus" },
      { key: "visitors", label: "Visitors", icon: "idcard", module: "campus" },
    ]},
    { label: "Communication", items: [
      { key: "announcements", label: "Announcements", icon: "megaphone" },
      { key: "parents", label: "Parents", icon: "message", module: "students" },
      { key: "helpdesk", label: "Helpdesk", icon: "lifebuoy" },
      { key: "notifications", label: "Notifications", icon: "bell" },
      { key: "chat", label: "Support Chat", icon: "message" },
    ]},
    { label: "Other", items: [
      { key: "classes", label: "Classes (Legacy)", icon: "layers", module: "academics" },
      { key: "timetable", label: "Timetable", icon: "calendar", module: "academics" },
      { key: "leaves", label: "Student Leave", icon: "clipboard" },
      { key: "analytics", label: "Analytics", icon: "trend" },
    ]},
    { label: "", items: [
      { key: "settings", label: "Settings", icon: "settings", module: "system" },
      { key: "automations", label: "Automations", icon: "clock", module: "system" },
      { key: "ai", label: "AI Assistant", icon: "bot" },
    ]},
  ],
  teacher: [
    { label: "", items: [{ key: "dashboard", label: "Dashboard", icon: "home" }] },
    { label: "Teaching", items: [
      { key: "myclasses", label: "My Classes", icon: "layers" },
      { key: "schedule", label: "My Timetable", icon: "calendar" },
      { key: "call", label: "Class Call", icon: "video" },
      { key: "success", label: "Students at Risk", icon: "alert", plan: "lifecycle" },
      { key: "exams", label: "Exam Duties", icon: "file", plan: "exams" },
      { key: "covers", label: "Cover Duties", icon: "users" },
      { key: "results", label: "Results", icon: "grad" },
      { key: "analytics", label: "Analytics", icon: "trend" },
      { key: "calendar", label: "Academic Calendar", icon: "calendar" },
    ]},
    { label: "Communication", items: [
      { key: "announcements", label: "Announcements", icon: "megaphone" },
      { key: "chat", label: "Chat", icon: "message" },
      { key: "meetings", label: "Parent Meetings", icon: "calendar", plan: "engage" },
      { key: "helpdesk", label: "Helpdesk", icon: "lifebuoy" },
    ]},
    { label: "My Employment", items: [
      { key: "payslips", label: "Payslips", icon: "wallet", plan: "payroll" },
      { key: "feedback", label: "Student Feedback", icon: "trend", plan: "exams" },
    ]},
    { label: "Restricted", items: [{ key: "fees", label: "Fees", icon: "dollar", locked: true, lockMsg: "This section is only available to Admin accounts." }] },
    { label: "", items: [{ key: "ai", label: "AI Assistant", icon: "bot" }] },
  ],
  student: [
    { label: "", items: [{ key: "dashboard", label: "Dashboard", icon: "home" }] },
    { label: "Academics", items: [
      { key: "mysubjects", label: "My Subjects", icon: "book" },
      { key: "schedule", label: "Timetable", icon: "calendar" },
      { key: "call", label: "Class Call", icon: "video" },
      { key: "attendance", label: "Attendance", icon: "clipboard" },
      { key: "assignments", label: "Assignments", icon: "file" },
      { key: "quizzes", label: "Quizzes", icon: "trend" },
      { key: "exams", label: "Exams & Admit Card", icon: "idcard", plan: "exams" },
      { key: "results", label: "Results & Transcript", icon: "grad" },
      { key: "calendar", label: "Academic Calendar", icon: "calendar" },
    ]},
    { label: "Campus", items: [
      { key: "fees", label: "Fees", icon: "dollar", plan: "finance" },
      { key: "library", label: "Library", icon: "library", plan: "library" },
      { key: "services", label: "Transport & Hostel", icon: "bus", plan: "campus" },
    ]},
    { label: "Communication", items: [
      { key: "announcements", label: "Announcements", icon: "megaphone" },
      { key: "messages", label: "Messages", icon: "message" },
    ]},
    { label: "Support", items: [
      { key: "leaves", label: "Leave Requests", icon: "clipboard" },
      { key: "surveys", label: "Teacher Evaluation", icon: "trend", plan: "exams" },
      { key: "helpdesk", label: "Helpdesk", icon: "lifebuoy" },
      { key: "chat", label: "Support Chat", icon: "message" },
    ]},
    { label: "", items: [{ key: "ai", label: "AI Assistant", icon: "bot" }] },
  ],
  parent: [
    { label: "", items: [{ key: "dashboard", label: "My Children", icon: "home" }] },
    { label: "School", items: [
      { key: "meetings", label: "Teacher Meetings", icon: "users", plan: "engage" },
      { key: "calendar", label: "Academic Calendar", icon: "calendar" },
      { key: "helpdesk", label: "Helpdesk", icon: "lifebuoy" },
    ]},
  ],
};

export const ROLE_LABEL = { admin: "Admin", teacher: "Teacher", student: "Student", parent: "Parent" };

// Mirror of ADMIN_ROLE_MODULES in backend/src/services/permissions.js —
// used only to hide nav items a sub-role can't use. The backend is what
// actually enforces access; keep the two lists in step.
export const ADMIN_ROLE_MODULES = {
  admin: "*",
  registrar: ["admissions", "students", "academics", "exams", "engage", "lifecycle"],
  accountant: ["finance", "payroll"],
  librarian: ["library"],
  hr: ["hr", "payroll"],
  warden: ["campus"],
  frontdesk: ["admissions", "engage", "campus"],
};
export const ADMIN_ROLE_LABEL = {
  admin: "Administrator", registrar: "Registrar", accountant: "Accountant", librarian: "Librarian",
  hr: "HR Officer", warden: "Warden / Campus", frontdesk: "Front Desk",
};
// Optional modules an institute's plan may not include (set by the
// platform owner). Mirrors OPTIONAL_PLAN_MODULES on the backend.
const PLAN_MODULES = new Set(["admissions", "exams", "finance", "payroll", "hr", "library", "campus", "engage", "lifecycle", "ai"]);
export function inPlan(session, item) {
  const mod = item.plan || item.module || (item.key === "ai" ? "ai" : null);
  const modules = session?.institute?.modules;
  return !mod || !modules || !PLAN_MODULES.has(mod) || modules.includes(mod);
}

export function adminCan(session, module) {
  if (!module) return true;
  if (session?.isSuperAdmin) return true;
  const allowed = ADMIN_ROLE_MODULES[session?.adminRole || "admin"];
  return allowed === "*" || (allowed || []).includes(module);
}
