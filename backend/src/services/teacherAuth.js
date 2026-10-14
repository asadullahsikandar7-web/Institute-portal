import TeacherAssignment from "../models/TeacherAssignment.js";
import StudentEnrollment from "../models/StudentEnrollment.js";

const ASSIGNMENT_POPULATE = [
  { path: "academicSession", select: "name status" },
  { path: "program", select: "name code" },
  { path: "section", select: "name code" },
  { path: "subject", select: "name code" },
];

// THE authorization source of truth for teacher actions (see the comment on
// TeacherAssignment.js, which points here). A teacher's JWT only proves who
// they are — it says nothing about what they're allowed to touch. Every
// subject-scoped action (attendance, announcements, assignments, quizzes,
// chat groups) must resolve an ACTIVE TeacherAssignment row for the exact
// {academicSession, program, section, subject} tuple the request claims to
// operate on. IDs arriving in the request body/query are never trusted on
// their own — they're only meaningful once matched against a row here.

// Looks up a single active assignment for a teacher against an exact
// academicSession+program+section+subject tuple. Returns the assignment
// document (populated is caller's choice) or null if no such active
// assignment exists — including if the teacherId is right but any one of
// the other four ids doesn't match, which is deliberately indistinguishable
// from "no assignment at all" to the caller: leaking *which* field mismatched
// would help an attacker probe for valid ids that belong to other teachers.
export async function getActiveAssignment(teacherId, { academicSession, program, section, subject }) {
  if (!teacherId || !academicSession || !program || !section || !subject) return null;
  return TeacherAssignment.findOne({
    teacher: teacherId,
    academicSession,
    program,
    section,
    subject,
    status: "active",
  });
}

// Express middleware factory. `extract(req)` must return
// { academicSession, program, section, subject } pulled from wherever the
// route expects them (body for writes, query for reads). On success attaches
// req.teacherAssignment (the matched, active TeacherAssignment doc) so the
// route handler never has to re-derive or re-trust ids itself — it should
// read scoping values off req.teacherAssignment, not off req.body/req.query,
// for anything that follows.
//
// Requires `auth("teacher")` to have already run (req.user.role === "teacher"
// and req.user.id populated) — this middleware does not itself check role,
// only assignment.
export function requireActiveAssignment(extract) {
  return async (req, res, next) => {
    try {
      if (!req.user || req.user.role !== "teacher") {
        return res.status(403).json({ error: "Teacher access required" });
      }
      const scope = extract(req) || {};
      const assignment = await getActiveAssignment(req.user.id, scope);
      if (!assignment) {
        return res.status(403).json({ error: "You are not assigned to this class/section/subject." });
      }
      req.teacherAssignment = assignment;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

// Id-based counterpart to getActiveAssignment, for the teacher-portal routes
// (teacherPortalRoute.js) which are nested under a single :assignmentId
// rather than reconstructing scope from four separate query params on every
// call. Populated with academicSession/program/section/subject so route
// handlers never need a second lookup. Returns null if the assignment
// doesn't exist, isn't active, or — critically — belongs to a different
// teacher; those three cases are deliberately indistinguishable to the
// caller for the same reason as getActiveAssignment above.
export async function loadOwnAssignment(teacherId, assignmentId) {
  if (!teacherId || !assignmentId) return null;
  return TeacherAssignment.findOne({ _id: assignmentId, teacher: teacherId, status: "active" }).populate(ASSIGNMENT_POPULATE);
}

// Express middleware: verifies req.params.assignmentId (or a custom param
// name) is an active assignment owned by the authenticated teacher, and
// attaches the populated doc as req.teacherAssignment. Route handlers should
// read section/subject/etc. off req.teacherAssignment, never off params.
export function requireOwnAssignment(paramName = "assignmentId") {
  return async (req, res, next) => {
    try {
      if (!req.user || req.user.role !== "teacher") {
        return res.status(403).json({ error: "Teacher access required" });
      }
      const assignment = await loadOwnAssignment(req.user.id, req.params[paramName]);
      if (!assignment) {
        return res.status(403).json({ error: "You are not assigned to this class/section/subject." });
      }
      req.teacherAssignment = assignment;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

// Confirms a student is currently assigned to a specific TeacherAssignment
// (i.e. that class is one of "their subjects") — resolved the same way
// studentAcademicRoute.js resolves "my subjects": the assignment must be
// active AND match the student's own active enrollment's exact
// academicSession+program+section. Used anywhere a student is joining
// something scoped to one class by :teacherAssignmentId rather than one
// already covered by requireOwnAssignment's :assignmentId param check
// (that helper is teacher-only) — currently the class-call socket.
export async function isStudentAssignedTo(studentId, teacherAssignmentId) {
  const enrollment = await StudentEnrollment.findOne({ student: studentId, status: "active" });
  if (!enrollment) return false;
  const assignment = await TeacherAssignment.findOne({
    _id: teacherAssignmentId,
    academicSession: enrollment.academicSession,
    program: enrollment.program,
    section: enrollment.section,
    status: "active",
  }).populate(ASSIGNMENT_POPULATE);
  return assignment || null;
}

// Confirms a student is currently (actively) enrolled in the given section —
// required before a teacher can mark attendance, post grades, or message a
// student: an active TeacherAssignment for the section is not by itself
// proof that a particular studentId actually belongs to that section.
export async function isStudentInSection(studentId, sectionId) {
  if (!studentId || !sectionId) return false;
  const enrollment = await StudentEnrollment.findOne({
    student: studentId,
    section: sectionId,
    status: "active",
  });
  return !!enrollment;
}

// Finds the caller's own active TeacherAssignment that actually covers a
// given student — i.e. the student is enrolled in that assignment's section
// (and, when subjectName is given, the assignment's subject matches by
// name). Used anywhere a teacher wants to touch one student's data (grades,
// progress lookups) that isn't already scoped to a specific :assignmentId —
// GradeRoute.js and aiTools.js both rely on this as the sole authority for
// "does this teacher actually teach this student".
export async function findTeacherAssignmentForStudent(teacherId, studentId, subjectName) {
  const assignments = await TeacherAssignment.find({ teacher: teacherId, status: "active" }).populate("subject", "name");
  for (const ta of assignments) {
    if (subjectName && ta.subject?.name !== subjectName) continue;
    if (await isStudentInSection(studentId, ta.section)) return ta;
  }
  return null;
}

// Bulk variant of isStudentInSection — for routes taking a list of student
// ids (e.g. "mark all present"), returns only the ids that are genuinely,
// actively enrolled in the section. Silently drops the rest rather than
// erroring, so a teacher can't smuggle in one out-of-section id alongside
// many legitimate ones and have the whole request fail or (worse) succeed
// for all of them.
export async function filterStudentsInSection(studentIds, sectionId) {
  if (!sectionId || !Array.isArray(studentIds) || studentIds.length === 0) return [];
  const enrollments = await StudentEnrollment.find({
    student: { $in: studentIds },
    section: sectionId,
    status: "active",
  }).select("student");
  const allowed = new Set(enrollments.map(e => e.student.toString()));
  return studentIds.filter(id => allowed.has(id.toString()));
}

// ── ChatGroup membership (see models/ChatGroup.js for why "teacher_all" is
// resolved live here instead of being materialized into a stored array) ──
// Both helpers below require `group.teacherAssignment` to already be a
// populated TeacherAssignment doc (at minimum its `section` field) — callers
// get this for free from loadOwnAssignment/requireOwnAssignment, or must
// .populate("teacherAssignment") themselves when loading a group directly.

function groupSectionId(group) {
  const ta = group.teacherAssignment;
  return ta && ta.section ? (ta.section._id || ta.section) : null;
}

export async function isStudentGroupMember(group, studentId) {
  if (!group || !studentId) return false;
  if (group.mode === "teacher_only") return false;
  if (group.mode === "teacher_selected") {
    return group.members.some(m => m.toString() === studentId.toString());
  }
  // teacher_all
  const sectionId = groupSectionId(group);
  if (!sectionId) return false;
  return isStudentInSection(studentId, sectionId);
}

// Full member list, for displaying a group's roster — teacher_all resolves
// against current StudentEnrollment on every call rather than trusting a
// cached list, so a student who left the section never lingers in it.
export async function resolveGroupMemberIds(group) {
  if (!group) return [];
  if (group.mode === "teacher_only") return [];
  if (group.mode === "teacher_selected") return group.members.map(m => m.toString());
  const sectionId = groupSectionId(group);
  if (!sectionId) return [];
  const enrollments = await StudentEnrollment.find({ section: sectionId, status: "active" }).select("student");
  return enrollments.map(e => e.student.toString());
}
