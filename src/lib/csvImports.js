// CSV import definitions for the pages that aren't built on ResourcePage
// (academic setup, teachers, rooms, fees, staff attendance). Each returns the
// props for <CsvImportButton>: columns, sample rows and how to save one row.
// Linked records are written by name or code — the class "Class 1", subject
// "MATH-1", teacher email, room "Room 12" — and resolved to ids on upload.
import { lookupFrom } from "../components/CsvImport.jsx";
import { sessionSuggestions } from "./suggestions.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PASSWORD_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
const newPassword = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
const norm = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Loads a list once per import and reuses it for every row.
function cached(load) {
  let p = null;
  return () => (p ||= load());
}
async function activeSessionId(api) {
  const list = await api.getAcademicSessions();
  const s = list.find(x => x.status === "active") || list[0];
  if (!s) throw new Error("Create an academic session first (Academic → Sessions).");
  return s._id;
}
// A section is named per class ("A", "Blue"…), so it's found within the row's class.
function sectionResolver(api) {
  const all = cached(() => api.getSections());
  return async (programId, name) => {
    const hit = (await all()).filter(s => (s.program?._id || s.program) === programId && [s.name, s.code].some(v => norm(v) === norm(name)));
    if (!hit.length) throw new Error(`Section “${name}” doesn't exist in that class — add it first`);
    return hit[0];
  };
}

// The active session, or — on a brand-new institute — this year's session
// created and activated, so classes can be added in one click.
export async function ensureSession(api, level = "school") {
  const list = await api.getAcademicSessions();
  const s = list.find(x => x.status === "active") || list[0];
  if (s) return s._id;
  const created = await api.addAcademicSession(sessionSuggestions()[level][0].items[0].data);
  await api.activateAcademicSession(created._id).catch(() => {});
  return created._id;
}

export const sessionsImport = api => ({
  title: "Import academic sessions", filename: "academic-sessions",
  columns: [
    { key: "name", label: "Session Name", required: true, sample: "2026-27" },
    { key: "startDate", label: "Start Date", type: "date", required: true, sample: "2026-04-01" },
    { key: "endDate", label: "End Date", type: "date", required: true, sample: "2027-03-31" },
  ],
  samples: [{ name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31" }, { name: "2027-28", startDate: "2027-04-01", endDate: "2028-03-31" }],
  submit: row => api.addAcademicSession(row),
});

export const programsImport = api => ({
  title: "Import classes / programs", filename: "classes",
  note: "One row per class or degree program. Leave Session empty to use the active session. Add sections afterwards with “Import sections”.",
  columns: [
    { key: "name", label: "Class / Program Name", required: true, aliases: ["name", "class", "program"] },
    { key: "code", label: "Code", required: true, hint: "Short unique code — e.g. C1, KG, BS-AI. Other sheets can refer to the class by this code" },
    { key: "academicSession", label: "Session", lookup: lookupFrom(() => api.getAcademicSessions()) },
    { key: "description", label: "Description" },
    { key: "requiredCredits", label: "Credit Hours to Graduate", type: "number", hint: "Universities only — leave empty for schools" },
  ],
  samples: [
    { name: "Class 1", code: "C1", academicSession: "2026-27", description: "Primary — Class 1" },
    { name: "Class 2", code: "C2", academicSession: "2026-27" },
    { name: "BS Artificial Intelligence", code: "BS-AI", academicSession: "2026-27", description: "4-year undergraduate program", requiredCredits: 133 },
  ],
  submit: async row => api.addProgram({ ...row, academicSession: row.academicSession || await activeSessionId(api) }),
});

export const sectionsImport = api => {
  const programs = cached(() => api.getPrograms());
  return {
    title: "Import sections", filename: "sections",
    note: "One row per section. The class must already exist — import classes first.",
    columns: [
      { key: "program", label: "Class / Program", required: true, lookup: lookupFrom(() => programs()), aliases: ["class"] },
      { key: "name", label: "Section Name", required: true, aliases: ["section"] },
      { key: "code", label: "Section Code", hint: "Optional — defaults to the section name" },
      { key: "capacity", label: "Capacity", type: "number" },
    ],
    samples: [
      { program: "C1", name: "A", capacity: 35 }, { program: "C1", name: "B", capacity: 35 },
      { program: "BS-AI", name: "Morning", code: "AI-M", capacity: 50 },
    ],
    submit: async row => {
      const p = (await programs()).find(x => x._id === row.program);
      const academicSession = p?.academicSession?._id || p?.academicSession || await activeSessionId(api);
      return api.addSection({ ...row, code: row.code || row.name, academicSession });
    },
  };
};

export const subjectsImport = api => ({
  title: "Import subjects", filename: "subjects",
  columns: [
    { key: "name", label: "Subject Name", required: true },
    { key: "code", label: "Code", required: true, hint: "Unique — e.g. ENG-1, MATH-5, CS-201" },
    { key: "creditHours", label: "Credit Hours", type: "number" },
    { key: "description", label: "Description" },
  ],
  samples: [
    { name: "English", code: "ENG-1", description: "Class 1 English" },
    { name: "Mathematics", code: "MATH-1" },
    { name: "Data Structures", code: "CS-201", creditHours: 3, description: "BS AI — semester 3" },
  ],
  submit: row => api.addSubject(row),
});

export const teachersImport = api => ({
  title: "Import teachers", filename: "teachers",
  note: "Each row creates a teacher login. Leave Password empty and one is generated — download the logins file at the end.",
  columns: [
    { key: "name", label: "Full Name", required: true, aliases: ["name"] },
    { key: "email", label: "Email", type: "email", required: true, hint: "Their sign-in — must be unique" },
    { key: "phone", label: "Phone" },
    { key: "password", label: "Password", hint: "Optional, 6+ characters — generated when empty" },
  ],
  samples: [
    { name: "Sadia Rehman", email: "sadia.rehman@example.com", phone: "0300-1234567", password: "" },
    { name: "Bilal Ahmed", email: "bilal.ahmed@example.com", phone: "0321-7654321", password: "" },
  ],
  submit: async row => {
    if (row.password && row.password.length < 6) throw new Error("Password must be 6+ characters");
    const password = row.password || newPassword();
    await api.addTeacherAccount({ ...row, password });
    return { login: { Name: row.name, "Email (login)": row.email, Password: password } };
  },
});

export const assignmentsImport = api => {
  const section = sectionResolver(api);
  return {
    title: "Import teacher assignments", filename: "teacher-assignments",
    note: "Who teaches which subject to which class & section. Teachers, classes, sections and subjects must already exist. Session defaults to the active one.",
    columns: [
      { key: "teacher", label: "Teacher Email", required: true, lookup: lookupFrom(() => api.getTeachersList(), t => t.email), aliases: ["teacher"] },
      { key: "program", label: "Class / Program", required: true, lookup: lookupFrom(() => api.getPrograms()), aliases: ["class"] },
      { key: "section", label: "Section", required: true },
      { key: "subject", label: "Subject", required: true, lookup: lookupFrom(() => api.getSubjects()), hint: "Subject code or name" },
      { key: "academicSession", label: "Session", lookup: lookupFrom(() => api.getAcademicSessions()) },
    ],
    samples: [
      { teacher: "sadia.rehman@example.com", program: "C1", section: "A", subject: "ENG-1", academicSession: "2026-27" },
      { teacher: "bilal.ahmed@example.com", program: "C1", section: "A", subject: "MATH-1", academicSession: "2026-27" },
    ],
    submit: async row => {
      const sec = await section(row.program, row.section);
      return api.addTeacherAssignment({ ...row, section: sec._id, academicSession: row.academicSession || sec.academicSession?._id || sec.academicSession || await activeSessionId(api) });
    },
  };
};

export const scheduleImport = api => {
  const section = sectionResolver(api);
  const assignments = cached(() => api.getTeacherAssignments());
  const teachers = cached(() => api.getTeachersList());
  return {
    title: "Import class timetable", filename: "class-timetable",
    note: "One row per weekly period. Clashes (same teacher, room or section at the same time) are rejected and listed at the end. Leave Teacher empty to use whoever is assigned to that subject, or mark it TBA.",
    columns: [
      { key: "program", label: "Class / Program", required: true, lookup: lookupFrom(() => api.getPrograms()), aliases: ["class"] },
      { key: "section", label: "Section", required: true },
      { key: "subject", label: "Subject", required: true, lookup: lookupFrom(() => api.getSubjects()), hint: "Subject code or name" },
      { key: "day", label: "Day", required: true, options: DAYS },
      { key: "startTime", label: "Start", type: "time", required: true, aliases: ["start time", "from"] },
      { key: "endTime", label: "End", type: "time", required: true, aliases: ["end time", "to"] },
      { key: "room", label: "Room", required: true, lookup: lookupFrom(() => api.getRooms()) },
      { key: "type", label: "Type", options: ["Lecture", "Lab"], hint: "Lecture (default) or Lab" },
      { key: "teacher", label: "Teacher Email", hint: "Optional — must be assigned to this class & subject" },
    ],
    samples: [
      { program: "C1", section: "A", subject: "ENG-1", day: "Monday", startTime: "08:00", endTime: "08:40", room: "Room 1", type: "Lecture", teacher: "" },
      { program: "C1", section: "A", subject: "MATH-1", day: "Monday", startTime: "08:40", endTime: "09:20", room: "Room 1", type: "Lecture", teacher: "bilal.ahmed@example.com" },
    ],
    submit: async row => {
      if (row.endTime <= row.startTime) throw new Error("End must be after Start");
      const sec = await section(row.program, row.section);
      let tas = (await assignments()).filter(a => a.status !== "inactive" && (a.section?._id || a.section) === sec._id && (a.subject?._id || a.subject) === row.subject);
      if (row.teacher) {
        const t = (await teachers()).find(x => norm(x.email) === norm(row.teacher) || norm(x.name) === norm(row.teacher));
        if (!t) throw new Error(`Teacher “${row.teacher}” not found`);
        tas = tas.filter(a => (a.teacher?._id || a.teacher) === t._id);
        if (!tas.length) throw new Error(`${t.name} isn't assigned to this class & subject — add a teacher assignment first`);
      }
      return api.addScheduleEntry({
        academicSession: sec.academicSession?._id || sec.academicSession, program: row.program, section: sec._id, subject: row.subject,
        teacherAssignment: tas[0]?._id || null, room: row.room, day: row.day, startTime: row.startTime, endTime: row.endTime, type: row.type || "Lecture",
      });
    },
  };
};

export const roomsImport = api => ({
  title: "Import rooms", filename: "rooms",
  columns: [
    { key: "name", label: "Room Name", required: true, hint: "Unique — e.g. Room 12, Computer Lab 1" },
    { key: "type", label: "Type", options: ["classroom", "lab", "auditorium", "office", "other"] },
    { key: "capacity", label: "Capacity", type: "number" },
    { key: "building", label: "Building" },
    { key: "status", label: "Status", options: ["active", "inactive"] },
    { key: "multimedia", label: "Multimedia", type: "boolean" },
    { key: "ac", label: "AC", type: "boolean" },
    { key: "whiteboard", label: "Whiteboard", type: "boolean" },
    { key: "internet", label: "Internet", type: "boolean" },
    { key: "fans", label: "Fans", type: "number" },
    { key: "lights", label: "Lights", type: "number" },
    { key: "computers", label: "Computers", type: "number" },
    { key: "notes", label: "Notes" },
  ],
  samples: [
    { name: "Room 1", type: "classroom", capacity: 35, building: "Main Block", status: "active", multimedia: "no", ac: "no", whiteboard: "yes", internet: "no", fans: 4, lights: 6, computers: 0 },
    { name: "Computer Lab 1", type: "lab", capacity: 30, building: "Science Block", status: "active", multimedia: "yes", ac: "yes", whiteboard: "yes", internet: "yes", fans: 0, lights: 10, computers: 30, notes: "Projector + 30 PCs" },
  ],
  submit: ({ multimedia, ac, whiteboard, internet, fans, lights, computers, ...room }) => api.addRoom({
    type: "classroom", status: "active", ...room, capacity: room.capacity ?? null,
    facilities: { multimedia: !!multimedia, ac: !!ac, whiteboard: !!whiteboard, internet: !!internet, fans: fans || 0, lights: lights || 0, computers: computers || 0 },
  }),
});

export const feesImport = (api, categories) => ({
  title: "Import fees", filename: "fees",
  note: "Bills one fee line per row to the student with that roll number. To bill everyone the same amount, use “Add Fee → All Students” instead.",
  columns: [
    { key: "studentId", label: "Roll No", required: true, lookup: lookupFrom(() => api.getStudents(), s => `${s.name} · #${s.rollNo}`), aliases: ["student", "rollNumber"], hint: "Student's roll number" },
    { key: "title", label: "Fee Title", required: true, aliases: ["title", "fee"] },
    { key: "amount", label: "Amount", type: "number", required: true },
    { key: "due", label: "Due Date", type: "date", required: true, aliases: ["due"] },
    { key: "category", label: "Category", options: categories },
  ],
  samples: [
    { studentId: "C1-001", title: "Tuition — November 2026", amount: 4500, due: "2026-11-10", category: categories[0] },
    { studentId: "C1-002", title: "Tuition — November 2026", amount: 4500, due: "2026-11-10", category: categories[0] },
  ],
  submit: row => {
    if (row.amount <= 0) throw new Error("Amount must be more than 0");
    return api.addFee({ ...row, category: row.category || categories[0] });
  },
});

export const staffAttendanceImport = api => ({
  title: "Import staff attendance", filename: "staff-attendance",
  note: "One row per person per day — e.g. from a biometric machine export. Re-importing a day overwrites that day's status.",
  columns: [
    { key: "staff", label: "Employee ID", required: true, lookup: lookupFrom(() => api.call("GET", "/api/hr/staff"), s => s.employeeId), aliases: ["staff", "employee", "name"], hint: "Employee ID (or full name)" },
    { key: "date", label: "Date", type: "date", required: true },
    { key: "status", label: "Status", required: true, options: [{ value: "present", label: "Present" }, { value: "absent", label: "Absent" }, { value: "half_day", label: "Half Day" }, { value: "leave", label: "Leave" }, { value: "holiday", label: "Holiday" }] },
  ],
  get samples() {
    const day = new Date().toISOString().slice(0, 10); // attendance can't be in the future
    return [{ staff: "EMP-0001", date: day, status: "present" }, { staff: "EMP-0002", date: day, status: "half_day" }];
  },
  submit: row => api.call("POST", "/api/hr/attendance", { date: row.date, records: [{ staff: row.staff, status: row.status }] }),
});
