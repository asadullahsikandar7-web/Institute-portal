// API client factory — ported verbatim from the original asad.jsx (token
// passed as an argument, never read from storage inside this module; the
// caller/context decides where the token comes from).
let BASE = "http://localhost:5001"; // default for Node/tooling
if (typeof window !== "undefined") {
  if (import.meta.env.DEV) {
    // Dev server — target the backend on whatever host the page was
    // actually loaded from (localhost, 127.0.0.1, or a LAN IP when
    // testing from another device on the same Wi-Fi), always on the
    // backend's own port. Never same-origin here: Vite (5173) and the API
    // (5001) are different ports even when reached via the same host.
    // VITE_API_PORT lets a second local backend (e.g. the demo database on
    // another port) be used without touching the default.
    BASE = `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT || 5001}`;
  } else {
    BASE = "";
  }
}
export { BASE };

// ── Which institute ─────────────────────────────────────────────────────
// Sent as X-Institute on every request so the server knows whose data a
// not-yet-signed-in request is about (login, admissions, verification).
// Comes from, in order: the subdomain (riverside.<VITE_PLATFORM_DOMAIN>),
// a ?i=CODE link, or the code the user entered last time on this device.
const INSTITUTE_KEY = "acadexa_institute";
function instituteFromHost() {
  const domain = (import.meta.env?.VITE_PLATFORM_DOMAIN || "").toLowerCase();
  if (typeof window === "undefined" || !domain) return null;
  const host = window.location.hostname.toLowerCase();
  if (!host.endsWith("." + domain)) return null;
  const sub = host.slice(0, -(domain.length + 1));
  return sub && !sub.includes(".") && !["www", "app", "api"].includes(sub) ? sub.toUpperCase() : null;
}
let INSTITUTE = null;
export const instituteLockedBySubdomain = () => !!instituteFromHost();
export function getInstitute() { return INSTITUTE; }
export function setInstitute(code) {
  INSTITUTE = code ? String(code).trim().toUpperCase() : null;
  try { if (INSTITUTE) localStorage.setItem(INSTITUTE_KEY, INSTITUTE); else localStorage.removeItem(INSTITUTE_KEY); } catch { /* private mode */ }
  instituteListeners.forEach(fn => fn(INSTITUTE));
}
const instituteListeners = new Set();
export const onInstituteChange = (fn) => { instituteListeners.add(fn); return () => instituteListeners.delete(fn); };
if (typeof window !== "undefined") {
  let fromUrl = null;
  try { fromUrl = new URLSearchParams(window.location.search).get("i"); } catch { /* ignore */ }
  let stored = null;
  try { stored = localStorage.getItem(INSTITUTE_KEY); } catch { /* private mode */ }
  INSTITUTE = (instituteFromHost() || fromUrl || stored || "").toUpperCase() || null;
  if (fromUrl && !instituteFromHost()) { try { localStorage.setItem(INSTITUTE_KEY, INSTITUTE); } catch { /* ignore */ } }
}

export function makeApi(token) {
  function headers() {
    const h = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    if (INSTITUTE) h["X-Institute"] = INSTITUTE;
    return h;
  }
  function headersFormData() {
    const h = {};
    if (token) h["Authorization"] = `Bearer ${token}`;
    if (INSTITUTE) h["X-Institute"] = INSTITUTE;
    return h;
  }
  async function req(method, path, body) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data; // e.g. { twoFactorRequired: true } from admin login
        throw err;
      }
      return data;
    } catch (err) {
      if (err.name === "TypeError") throw new Error("Cannot reach server. Is it running?");
      throw err;
    }
  }
  async function reqFormData(method, path, formData) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: headersFormData(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data; // e.g. { twoFactorRequired: true } from admin login
        throw err;
      }
      return data;
    } catch (err) {
      if (err.name === "TypeError") throw new Error("Cannot reach server. Is it running?");
      throw err;
    }
  }
  return {
    // Auth (no token needed)
    adminLogin:   (email, password, otp) => req("POST", "/api/auth/admin-login", { email, password, ...(otp ? { otp } : {}) }),
    studentLogin: (rollNo, password)=> req("POST", "/api/auth/student-login", { rollNo, password }),
    teacherLogin: (email, password) => req("POST", "/api/auth/teacher-login", { email, password }),
    parentLogin:  (email, password) => req("POST", "/api/auth/parent-login",  { email, password }),
    changePassword: (currentPassword, newPassword) => req("POST", "/api/auth/change-password", { currentPassword, newPassword }),

    // ── ERP layer ── the ~30 ERP collections share one REST shape (see
    // backend/src/utils/crudRouter.js), so rather than five named methods
    // per collection they're reached through these two generic helpers:
    //   api.call("POST", "/api/hr/payroll/run", { month })
    //   api.resource("/api/library/books").list("q=algo")
    call: req,
    resource: (base) => ({
      list:   (qs)       => req("GET",    `${base}${qs ? `?${qs}` : ""}`),
      get:    (id)       => req("GET",    `${base}/${id}`),
      create: (body)     => req("POST",   base, body),
      update: (id, body) => req("PATCH",  `${base}/${id}`, body),
      remove: (id)       => req("DELETE", `${base}/${id}`),
    }),
    // Students
    getStudents:   ()         => req("GET",    "/api/students"),
    addStudent:    (body)     => req("POST",   "/api/students", body),
    editStudent:   (id, body) => req("PATCH",  `/api/students/${id}`, body),
    deleteStudent: (id)       => req("DELETE", `/api/students/${id}`),
    uploadPhoto:   (id, file) => {
      const fd = new FormData();
      fd.append("photo", file);
      return reqFormData("PATCH", `/api/students/${id}/photo`, fd);
    },
    deletePhoto:   (id)       => req("DELETE", `/api/students/${id}/photo`),
    // Attendance (legacy flat)
    getAttendance: (date)     => req("GET",  `/api/attendance?date=${date}`),
    getHistory:    (sid, days)=> req("GET",  `/api/attendance/history/${sid}?days=${days||30}`),
    markAttendance:(body)     => req("POST", "/api/attendance", body),
    // Leaves
    getLeaves:  ()            => req("GET",    "/api/leaves"),
    applyLeave: (body)        => req("POST",   "/api/leaves", body),
    reviewLeave:(id, status)  => req("PATCH",  `/api/leaves/${id}`, { status }),
    deleteLeave:(id)          => req("DELETE", `/api/leaves/${id}`),
    // Exams (legacy)
    getExams: ()              => req("GET",  "/api/exams"),
    addExam:  (body)          => req("POST", "/api/exams", body),
    // Grades (legacy results)
    getGrades: (sid)          => req("GET",  `/api/grades/${sid}`),
    addGrade:  (body)         => req("POST", "/api/grades", body),
    // Announcements (institute-wide, via notifications type="announcement")
    getAnnouncements: ()      => req("GET",  "/api/notifications?type=announcement"),
    addAnnouncement:  (body)  => req("POST", "/api/notifications", { ...body, type: "announcement", recipientId: null }),
    // Fees
    getFees:    (sid)         => req("GET",   sid ? `/api/fees/${sid}` : "/api/fees"),
    payFee:     (id)          => req("PATCH", `/api/fees/${id}`, { paid: true }),
    addFee:     (body)        => req("POST",  "/api/fees", body),
    // Timetable (legacy)
    getTimetable:  ()         => req("GET",  "/api/timetable"),
    addTimetable:  (body)     => req("POST", "/api/timetable", body),
    // Classes (legacy flat model)
    getClasses:          ()         => req("GET",  "/api/classes"),
    getTomorrowClasses:  ()         => req("GET",  "/api/classes/tomorrow"),
    addClass:            (body)     => req("POST", "/api/classes", body),
    updateClass:         (id, body) => req("PUT",  `/api/classes/${id}`, body),
    setTomorrowClass:    (id, body) => req("PUT",  `/api/classes/${id}/tomorrow`, body),
    deleteClass:         (id)       => req("DELETE", `/api/classes/${id}`),
    // Notifications
    getNotifications:     ()        => req("GET",  "/api/notifications"),
    getUnreadCount:       ()        => req("GET",  "/api/notifications/unread"),
    markAsRead:           (id)      => req("PATCH",  `/api/notifications/${id}/read`),
    sendNotification:     (body)    => req("POST", "/api/notifications", body),
    broadcastNotification:(body)    => req("POST", "/api/notifications", { ...body, recipientId: null }),
    deleteNotification:   (id)      => req("DELETE", `/api/notifications/${id}`),
    // Analytics
    getAnalytics: ()          => req("GET",  "/api/analytics"),
    // Parent messaging (email log, distinct from the Parent entity)
    getParentMessages:  ()    => req("GET",    "/api/parent-messages"),
    sendParentMessage:  (body)=> req("POST",   "/api/parent-messages", body),
    resendParentMsg:    (id)  => req("POST",   `/api/parent-messages/${id}`),
    deleteParentMsg:    (id)  => req("DELETE", `/api/parent-messages/${id}`),
    // 1:1 support chat
    openConversation:    (studentId)          => req("POST",  "/api/chat/conversations", studentId ? { studentId } : undefined),
    getConversations:    ()                   => req("GET",   "/api/chat/conversations"),
    getChatMessages:     (conversationId,opts)=> req("GET",   `/api/chat/conversations/${conversationId}/messages${opts?.before?`?before=${encodeURIComponent(opts.before)}`:""}`),
    sendChatMessage:      (conversationId,message)=> req("POST", "/api/chat/messages", { conversationId, message }),
    markMessageRead:      (id)                => req("PATCH", `/api/chat/messages/${id}/read`),
    markConversationRead: (conversationId)    => req("PATCH", `/api/chat/conversations/${conversationId}/read`),
    // AI assistant
    aiStatus:        ()                  => req("GET",  "/api/ai/status"),
    aiChat:           (message, history) => req("POST", "/api/ai/chat", { message, history }),
    aiConfirmAction:  (actionId)         => req("POST", `/api/ai/actions/${actionId}/confirm`),
    aiCancelAction:   (actionId)         => req("POST", `/api/ai/actions/${actionId}/cancel`),
    // Feedback (previously bypassed makeApi with a raw fetch — fixed here)
    sendFeedback: (body) => req("POST", "/api/feedback", body),

    // ── Academic hierarchy (Admin) ──
    getAcademicSessions:    ()        => req("GET",    "/api/academic-sessions"),
    addAcademicSession:     (body)    => req("POST",   "/api/academic-sessions", body),
    editAcademicSession:    (id,body) => req("PATCH",  `/api/academic-sessions/${id}`, body),
    activateAcademicSession:(id)      => req("PATCH",  `/api/academic-sessions/${id}/activate`),
    archiveAcademicSession: (id)      => req("DELETE", `/api/academic-sessions/${id}`),
    getPrograms:      ()        => req("GET",    "/api/programs"),
    addProgram:       (body)    => req("POST",   "/api/programs", body),
    editProgram:      (id,body) => req("PATCH",  `/api/programs/${id}`, body),
    deactivateProgram:(id)      => req("DELETE", `/api/programs/${id}`),
    getSections:      (qs)      => req("GET",    `/api/sections${qs?`?${qs}`:""}`),
    addSection:       (body)    => req("POST",   "/api/sections", body),
    editSection:      (id,body) => req("PATCH",  `/api/sections/${id}`, body),
    deactivateSection:(id)      => req("DELETE", `/api/sections/${id}`),
    getSubjects:      ()        => req("GET",    "/api/subjects"),
    addSubject:       (body)    => req("POST",   "/api/subjects", body),
    editSubject:      (id,body) => req("PATCH",  `/api/subjects/${id}`, body),
    deactivateSubject:(id)      => req("DELETE", `/api/subjects/${id}`),
    getTeachersList:  ()        => req("GET",    "/api/teachers"),
    addTeacherAccount:(body)    => req("POST",   "/api/teachers", body),
    editTeacherAccount:(id,body)=> req("PATCH",  `/api/teachers/${id}`, body),
    deactivateTeacherAccount:(id)=> req("DELETE",`/api/teachers/${id}`),
    getTeacherAssignments:   (qs) => req("GET",    `/api/teacher-assignments${qs?`?${qs}`:""}`),
    addTeacherAssignment:    (body)=> req("POST",   "/api/teacher-assignments", body),
    deactivateTeacherAssignment:(id)=> req("DELETE", `/api/teacher-assignments/${id}`),
    getEnrollments: (qs)   => req("GET",  `/api/enrollments${qs?`?${qs}`:""}`),
    addEnrollment:  (body) => req("POST", "/api/enrollments", body),
    updateEnrollment:(id,body)=> req("PATCH", `/api/enrollments/${id}`, body),
    addParent:  (body) => req("POST", "/api/parents", body),
    getParents: ()     => req("GET",  "/api/parents"),
    getSubjectAttendanceAdmin: (qs) => req("GET", `/api/subject-attendance${qs?`?${qs}`:""}`),

    // ── Teacher portal (self-service) ──
    getMyTeacherProfile: () => req("GET", "/api/teacher/me"),
    updateMyTeacherProfile: (body) => req("PATCH", "/api/teacher/me", body),
    uploadMyTeacherPhoto: (file) => {
      const fd = new FormData();
      fd.append("photo", file);
      return reqFormData("PATCH", "/api/teacher/me/photo", fd);
    },
    deleteMyTeacherPhoto: () => req("DELETE", "/api/teacher/me/photo"),
    getMyClasses:  ()   => req("GET", "/api/teacher/classes"),
    getMyClass:    (id) => req("GET", `/api/teacher/classes/${id}`),
    getClassStudents:(id) => req("GET", `/api/teacher/classes/${id}/students`),
    getMyTeacherAnalytics: () => req("GET", "/api/teacher/analytics"),
    getClassAttendance:      (id,date) => req("GET",  `/api/teacher/classes/${id}/attendance?date=${date}`),
    markClassAttendance:     (id,body) => req("POST", `/api/teacher/classes/${id}/attendance`, body),
    getClassAttendanceHistory:(id,qs)  => req("GET",  `/api/teacher/classes/${id}/attendance/history${qs?`?${qs}`:""}`),
    getClassCoursework: (id)      => req("GET",   `/api/teacher/classes/${id}/coursework`),
    addCoursework:      (id,body) => req("POST",  `/api/teacher/classes/${id}/coursework`, body),
    editCoursework:     (id,body) => req("PATCH", `/api/teacher/coursework/${id}`, body),
    deleteCoursework:   (id)      => req("DELETE",`/api/teacher/coursework/${id}`),
    getClassQuizzes: (id)      => req("GET",   `/api/teacher/classes/${id}/quizzes`),
    addQuiz:         (id,body) => req("POST",  `/api/teacher/classes/${id}/quizzes`, body),
    editQuiz:        (id,body) => req("PATCH", `/api/teacher/quizzes/${id}`, body),
    deleteQuiz:      (id)      => req("DELETE",`/api/teacher/quizzes/${id}`),
    getClassAnnouncements: (id)      => req("GET",  `/api/teacher/classes/${id}/announcements`),
    addClassAnnouncement:  (id,body) => req("POST", `/api/teacher/classes/${id}/announcements`, body),
    getClassChatGroup: (id)         => req("GET",   `/api/teacher/classes/${id}/chat-group`),
    updateChatGroup:   (groupId,body)=> req("PATCH", `/api/teacher/chat-groups/${groupId}`, body),
    getGroupMessages:  (groupId)     => req("GET",   `/api/teacher/chat-groups/${groupId}/messages`),
    sendGroupMessage:  (groupId,message)=> req("POST", `/api/teacher/chat-groups/${groupId}/messages`, { message }),

    // ── Student academic (self-service) ──
    getMyStudentProfile: () => req("GET", "/api/student/me"),
    getMySubjects:       () => req("GET", "/api/student/subjects"),
    getMySubjectHistory: (teacherAssignmentId) => req("GET", `/api/student/attendance/history?teacherAssignmentId=${teacherAssignmentId}`),
    getMyCoursework: () => req("GET", "/api/student/coursework"),
    getMyQuizzes:    () => req("GET", "/api/student/quizzes"),
    getMyChatGroups: () => req("GET", "/api/student/chat-groups"),
    getStudentGroupMessages:(groupId) => req("GET", `/api/student/chat-groups/${groupId}/messages`),
    sendStudentGroupMessage:(groupId,message) => req("POST", `/api/student/chat-groups/${groupId}/messages`, { message }),

    // ── Real class schedule / timetable ──
    getScheduleAdmin: (qs) => req("GET", `/api/schedule${qs ? `?${qs}` : ""}`),
    addScheduleEntry: (body) => req("POST", "/api/schedule", body),
    updateScheduleEntry: (id, body) => req("PATCH", `/api/schedule/${id}`, body),
    deleteScheduleEntry: (id) => req("DELETE", `/api/schedule/${id}`),
    getMySchedule: () => req("GET", "/api/schedule/mine"),
    getStudentSchedule: () => req("GET", "/api/schedule/student"),
    getRooms: () => req("GET", "/api/rooms"),
    addRoom: (body) => req("POST", "/api/rooms", body),
    updateRoom: (id, body) => req("PATCH", `/api/rooms/${id}`, body),
    deleteRoom: (id) => req("DELETE", `/api/rooms/${id}`),
  };
}
