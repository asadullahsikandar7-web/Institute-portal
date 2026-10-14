import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { SessionProvider, useSession } from "./context/SessionContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { SettingsProvider } from "./context/SettingsContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import SignatureFooter from "./components/SignatureFooter.jsx";
import ComingSoonPage from "./components/ComingSoonPage.jsx";
import LoginPage from "./features/auth/LoginPage.jsx";
import AIPage from "./features/shared/AIPage.jsx";
import SupportChatPage from "./features/shared/SupportChatPage.jsx";
import SharedAnnouncementsPage from "./features/shared/AnnouncementsPage.jsx";

// ERP + smart layers — see src/features/erp/. Loaded on demand so the
// sign-in page and each portal's dashboard don't pay for ~40 screens most
// visits never open.
const lz = (loader, name) => lazy(() => loader().then(m => ({ default: name ? m[name] : m.default })));
const admissions = () => import("./features/erp/AdmissionsPage.jsx");
const reports = () => import("./features/erp/FinanceReportsPage.jsx");
const modules = () => import("./features/erp/ModulePages.jsx");
const results = () => import("./features/erp/ResultsPages.jsx");
const hr = () => import("./features/erp/HrPages.jsx");
const people = () => import("./features/erp/PeoplePages.jsx");
const shared = () => import("./features/erp/SharedPages.jsx");
const portal = () => import("./features/erp/PortalPages.jsx");
const smart = () => import("./features/erp/SmartPages.jsx");

const AdmissionsPage = lz(admissions), ApplyPage = lz(admissions, "ApplyPage");
const FinanceReportsPage = lz(reports), OverviewPage = lz(reports, "OverviewPage");
const [DepartmentsPage, StaffPage, StaffLeavesPage, ScholarshipsPage, ExpensesPage, FeeStructuresPage, AssetsPage, VisitorsPage, TransportPage, HostelPage, LibraryPage, RecordsPage, AlumniPage] =
  ["DepartmentsPage", "StaffPage", "StaffLeavesPage", "ScholarshipsPage", "ExpensesPage", "FeeStructuresPage", "AssetsPage", "VisitorsPage", "TransportPage", "HostelPage", "LibraryPage", "RecordsPage", "AlumniPage"].map(n => lz(modules, n));
const ExamOfficePage = lz(results, "ExamOfficePage"), TranscriptsPage = lz(results, "TranscriptsPage");
const StaffAttendancePage = lz(hr, "StaffAttendancePage"), PayrollPage = lz(hr, "PayrollPage"), TeacherPayslipsPage = lz(hr, "TeacherPayslipsPage");
const Student360Page = lz(people, "Student360Page"), ImportPage = lz(people, "ImportPage"), PromotionPage = lz(people, "PromotionPage"), CertificatesPage = lz(people, "CertificatesPage");
const CalendarPage = lz(shared, "CalendarPage"), HelpdeskPage = lz(shared, "HelpdeskPage");
const StudentLibraryPage = lz(portal, "StudentLibraryPage"), StudentServicesPage = lz(portal, "StudentServicesPage"), StudentLeavesPage = lz(portal, "StudentLeavesPage"), ParentDashboardPage = lz(portal, "ParentDashboardPage");
const [StudentSuccessPage, TeacherSuccessPage, ExamsAdminPage, StudentExamsPage, TeacherExamsPage, SurveysAdminPage, StudentSurveysPage, TeacherFeedbackPage, VerifyPage] =
  ["StudentSuccessPage", "TeacherSuccessPage", "ExamsAdminPage", "StudentExamsPage", "TeacherExamsPage", "SurveysAdminPage", "StudentSurveysPage", "TeacherFeedbackPage", "VerifyPage"].map(n => lz(smart, n));
const ops = () => import("./features/erp/OpsPages.jsx");
const [AutomationsPage, SubstitutionsPage, TeacherCoversPage, TeacherMeetingsPage, ParentMeetingsPage, InsightsPage] =
  ["AutomationsPage", "SubstitutionsPage", "TeacherCoversPage", "TeacherMeetingsPage", "ParentMeetingsPage", "InsightsPage"].map(n => lz(ops, n));
const ResetPasswordPage = lz(() => import("./features/erp/AccountPages.jsx"), "ResetPasswordPage");
const SettingsPage = lz(() => import("./features/erp/SettingsPage.jsx"));
const PlatformConsole = lz(() => import("./features/platform/PlatformConsole.jsx"));
const ParentAccountsPage = lz(() => import("./features/erp/ParentAccountsPage.jsx"));

import AdminDashboardPage from "./features/admin/DashboardPage.jsx";
import SessionsPage from "./features/admin/academic/SessionsPage.jsx";
import ProgramsPage from "./features/admin/academic/ProgramsPage.jsx";
import SubjectsPage from "./features/admin/academic/SubjectsPage.jsx";
import TeacherAssignmentsPage from "./features/admin/academic/TeacherAssignmentsPage.jsx";
import ClassSchedulePage from "./features/admin/academic/ClassSchedulePage.jsx";
import RoomsPage from "./features/admin/academic/RoomsPage.jsx";
import StudentsPage from "./features/admin/people/StudentsPage.jsx";
import AdminTeachersPage from "./features/admin/people/TeachersPage.jsx";
import AttendanceOverviewPage from "./features/admin/attendance/AttendanceOverviewPage.jsx";
import AdminFeesPage from "./features/admin/finance/FeesPage.jsx";
import AdminClassesPage from "./features/admin/other/ClassesPage.jsx";
import AdminTimetablePage from "./features/admin/other/TimetablePage.jsx";
import AdminExamsPage from "./features/admin/other/ExamsPage.jsx";
import LeavesPage from "./features/admin/other/LeavesPage.jsx";
import AdminNotificationsPage from "./features/admin/other/NotificationsPage.jsx";
import AdminAnalyticsPage from "./features/admin/other/AnalyticsPage.jsx";

import TeacherDashboardPage from "./features/teacher/DashboardPage.jsx";
import MyClassesPage from "./features/teacher/MyClassesPage.jsx";
import ClassWorkspace from "./features/teacher/classworkspace/ClassWorkspace.jsx";
import TeacherResultsPage from "./features/teacher/ResultsPage.jsx";
import TeacherAnalyticsPage from "./features/teacher/AnalyticsPage.jsx";
import TeacherSchedulePage from "./features/teacher/SchedulePage.jsx";
import TeacherClassCallPage from "./features/teacher/ClassCallPage.jsx";
import TeacherChatGroupsPage from "./features/teacher/ChatGroupsPage.jsx";
import TeacherAnnouncementsPage from "./features/teacher/AnnouncementsPage.jsx";

import StudentDashboardPage from "./features/student/DashboardPage.jsx";
import MySubjectsPage from "./features/student/subjects/MySubjectsPage.jsx";
import StudentSchedulePage from "./features/student/SchedulePage.jsx";
import ClassCallPage from "./features/student/ClassCallPage.jsx";
import StudentAttendancePage from "./features/student/AttendancePage.jsx";
import StudentAssignmentsPage from "./features/student/AssignmentsPage.jsx";
import StudentQuizzesPage from "./features/student/QuizzesPage.jsx";
import StudentResultsPage from "./features/student/ResultsPage.jsx";
import StudentFeesPage from "./features/student/FeesPage.jsx";
import StudentMessagesPage from "./features/student/MessagesPage.jsx";

const PageLoading = () => <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>;

function RoleLayout({ role }) {
  return (
    <ProtectedRoute role={role}>
      <AppShell role={role}><Suspense fallback={<PageLoading />}><Outlet /></Suspense></AppShell>
    </ProtectedRoute>
  );
}

function RootRedirect() {
  const { session, restoring } = useSession();
  if (restoring) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={`/${session.role}/dashboard`} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SettingsProvider>
        <SessionProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route path="/admin" element={<RoleLayout role="admin" />}>
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="sessions" element={<SessionsPage />} />
                <Route path="programs" element={<ProgramsPage />} />
                <Route path="subjects" element={<SubjectsPage />} />
                <Route path="assignments-teacher" element={<TeacherAssignmentsPage />} />
                <Route path="class-schedule" element={<ClassSchedulePage />} />
                <Route path="rooms" element={<RoomsPage />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="teachers" element={<AdminTeachersPage />} />
                <Route path="attendance" element={<AttendanceOverviewPage />} />
                <Route path="fees" element={<AdminFeesPage />} />
                <Route path="announcements" element={<SharedAnnouncementsPage canCreate />} />
                <Route path="parents" element={<ParentAccountsPage />} />
                <Route path="classes" element={<AdminClassesPage />} />
                <Route path="timetable" element={<AdminTimetablePage />} />
                <Route path="exams" element={<AdminExamsPage />} />
                <Route path="leaves" element={<LeavesPage />} />
                <Route path="notifications" element={<AdminNotificationsPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="chat" element={<SupportChatPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="overview" element={<OverviewPage />} />
                <Route path="admissions" element={<AdmissionsPage />} />
                <Route path="calendar" element={<CalendarPage canEdit eyebrow="Academic" />} />
                <Route path="results" element={<ExamOfficePage />} />
                <Route path="exam-sessions" element={<ExamsAdminPage />} />
                <Route path="surveys" element={<SurveysAdminPage />} />
                <Route path="success" element={<StudentSuccessPage />} />
                <Route path="insights" element={<InsightsPage />} />
                <Route path="substitutions" element={<SubstitutionsPage />} />
                <Route path="automations" element={<AutomationsPage />} />
                <Route path="transcripts" element={<TranscriptsPage />} />
                <Route path="student360" element={<Student360Page />} />
                <Route path="student360/:id" element={<Student360Page />} />
                <Route path="import" element={<ImportPage />} />
                <Route path="promotion" element={<PromotionPage />} />
                <Route path="records" element={<RecordsPage />} />
                <Route path="certificates" element={<CertificatesPage />} />
                <Route path="alumni" element={<AlumniPage />} />
                <Route path="fee-structures" element={<FeeStructuresPage />} />
                <Route path="scholarships" element={<ScholarshipsPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="finance-reports" element={<FinanceReportsPage />} />
                <Route path="departments" element={<DepartmentsPage />} />
                <Route path="staff" element={<StaffPage />} />
                <Route path="staff-attendance" element={<StaffAttendancePage />} />
                <Route path="staff-leaves" element={<StaffLeavesPage />} />
                <Route path="payroll" element={<PayrollPage />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="transport" element={<TransportPage />} />
                <Route path="hostel" element={<HostelPage />} />
                <Route path="assets" element={<AssetsPage />} />
                <Route path="visitors" element={<VisitorsPage />} />
                <Route path="helpdesk" element={<HelpdeskPage eyebrow="Communication" />} />
                <Route path="ai" element={<AIPage />} />
                <Route index element={<Navigate to="dashboard" replace />} />
              </Route>

              <Route path="/teacher" element={<RoleLayout role="teacher" />}>
                <Route path="dashboard" element={<TeacherDashboardPage />} />
                <Route path="myclasses" element={<MyClassesPage />} />
                <Route path="myclasses/:assignmentId/:tab" element={<ClassWorkspace />} />
                <Route path="schedule" element={<TeacherSchedulePage />} />
                <Route path="call" element={<TeacherClassCallPage />} />
                <Route path="results" element={<TeacherResultsPage />} />
                <Route path="analytics" element={<TeacherAnalyticsPage />} />
                <Route path="announcements" element={<TeacherAnnouncementsPage />} />
                <Route path="chat" element={<TeacherChatGroupsPage />} />
                <Route path="fees" element={<ComingSoonPage title="Fees" note="This section is only available to Admin accounts." />} />
                <Route path="calendar" element={<CalendarPage eyebrow="Teaching" />} />
                <Route path="helpdesk" element={<HelpdeskPage eyebrow="Communication" />} />
                <Route path="payslips" element={<TeacherPayslipsPage />} />
                <Route path="success" element={<TeacherSuccessPage />} />
                <Route path="exams" element={<TeacherExamsPage />} />
                <Route path="feedback" element={<TeacherFeedbackPage />} />
                <Route path="covers" element={<TeacherCoversPage />} />
                <Route path="meetings" element={<TeacherMeetingsPage />} />
                <Route path="ai" element={<AIPage />} />
                <Route index element={<Navigate to="dashboard" replace />} />
              </Route>

              <Route path="/student" element={<RoleLayout role="student" />}>
                <Route path="dashboard" element={<StudentDashboardPage />} />
                <Route path="mysubjects" element={<MySubjectsPage />} />
                <Route path="schedule" element={<StudentSchedulePage />} />
                <Route path="call" element={<ClassCallPage />} />
                <Route path="attendance" element={<StudentAttendancePage />} />
                <Route path="assignments" element={<StudentAssignmentsPage />} />
                <Route path="quizzes" element={<StudentQuizzesPage />} />
                <Route path="results" element={<StudentResultsPage />} />
                <Route path="fees" element={<StudentFeesPage />} />
                <Route path="announcements" element={<SharedAnnouncementsPage />} />
                <Route path="messages" element={<StudentMessagesPage />} />
                <Route path="leaves" element={<StudentLeavesPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="helpdesk" element={<HelpdeskPage />} />
                <Route path="library" element={<StudentLibraryPage />} />
                <Route path="services" element={<StudentServicesPage />} />
                <Route path="exams" element={<StudentExamsPage />} />
                <Route path="surveys" element={<StudentSurveysPage />} />
                <Route path="chat" element={<SupportChatPage />} />
                <Route path="ai" element={<AIPage />} />
                <Route index element={<Navigate to="dashboard" replace />} />
              </Route>

              <Route path="/parent" element={<RoleLayout role="parent" />}>
                <Route path="dashboard" element={<ParentDashboardPage />} />
                <Route path="calendar" element={<CalendarPage eyebrow="School" />} />
                <Route path="meetings" element={<ParentMeetingsPage />} />
                <Route path="helpdesk" element={<HelpdeskPage eyebrow="School" />} />
                <Route index element={<Navigate to="dashboard" replace />} />
              </Route>

              <Route path="/apply" element={<Suspense fallback={<PageLoading />}><ApplyPage /></Suspense>} />
              <Route path="/platform" element={<Suspense fallback={<PageLoading />}><PlatformConsole /></Suspense>} />
              <Route path="/reset-password" element={<Suspense fallback={<PageLoading />}><ResetPasswordPage /></Suspense>} />
              <Route path="/verify" element={<Suspense fallback={<PageLoading />}><VerifyPage /></Suspense>} />
              <Route path="/verify/:serial" element={<Suspense fallback={<PageLoading />}><VerifyPage /></Suspense>} />
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </BrowserRouter>
          <SignatureFooter />
        </SessionProvider>
        </SettingsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
