import express from "express";
import { auth } from "../middleware/auth.js";
import { h, httpError } from "../utils/crudRouter.js";
import { loadOwnAssignment } from "../services/teacherAuth.js";
import { notifyStudents } from "../services/notify.js";
import { Submission, QuizAttempt } from "../models/Erp.js";
import Assignment from "../models/Assignment.js";
import Quiz from "../models/Quiz.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import TeacherAssignment from "../models/TeacherAssignment.js";

// Learning-management layer on top of the existing coursework/quiz
// records: students hand work in, teachers grade it, quizzes with a
// question bank are taken online and auto-graded.
// Authorisation follows the two rules the rest of the app uses — a teacher
// reaches a resource only through a TeacherAssignment they own
// (loadOwnAssignment), a student only through their own active enrolment.
const router = express.Router();

// Is this TeacherAssignment one of the student's current classes?
async function studentHasClass(studentId, teacherAssignmentId) {
  const enrollment = await StudentEnrollment.findOne({ student: studentId, status: "active" });
  if (!enrollment) return false;
  return !!(await TeacherAssignment.exists({
    _id: teacherAssignmentId, status: "active",
    academicSession: enrollment.academicSession, program: enrollment.program, section: enrollment.section,
  }));
}

// ═══════════════════════════ STUDENT: ASSIGNMENTS ══════════════════════════
const student = express.Router();
student.use(auth("student"));

student.get("/submissions", h(async (req, res) => {
  res.json(await Submission.find({ student: req.user.id }));
}));

// Create or replace the student's own submission. Resubmitting is allowed
// until the teacher has graded it; after that the work is frozen.
student.post("/coursework/:id/submit", h(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment || !(await studentHasClass(req.user.id, assignment.teacherAssignment))) throw httpError(404, "Assignment not found");
  if (assignment.status !== "active") throw httpError(400, "This assignment is closed for submissions.");
  const text = String(req.body.text || "").trim().slice(0, 20000);
  const link = String(req.body.link || "").trim().slice(0, 500);
  if (!text && !link) throw httpError(400, "Write an answer or paste a link to your work.");
  if (link && !/^https?:\/\//i.test(link)) throw httpError(400, "The link must start with http:// or https://");

  const existing = await Submission.findOne({ assignment: assignment._id, student: req.user.id });
  if (existing?.gradedAt) throw httpError(400, "This submission has already been graded and can't be changed.");
  const now = new Date();
  const doc = existing || new Submission({ assignment: assignment._id, student: req.user.id });
  doc.set({ text, link, submittedAt: now, late: now > assignment.dueDate });
  await doc.save();
  res.status(201).json(doc);
}));

// ═══════════════════════════ STUDENT: QUIZZES ══════════════════════════════
const quizWindow = (quiz, now = new Date()) => {
  if (quiz.status !== "active") return "closed";
  if (now < quiz.scheduledAt) return "upcoming";
  if (quiz.closesAt && now > quiz.closesAt) return "closed";
  return "open";
};

student.get("/attempts", h(async (req, res) => {
  res.json(await QuizAttempt.find({ student: req.user.id, submittedAt: { $ne: null } }).select("quiz score maxScore submittedAt"));
}));

// Opens the quiz: returns the questions WITHOUT answers and starts the
// clock. Re-opening returns the same attempt (same start time) — a refresh
// never buys extra time.
student.post("/quizzes/:id/start", h(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz || !(await studentHasClass(req.user.id, quiz.teacherAssignment))) throw httpError(404, "Quiz not found");
  if (!quiz.questions.length) throw httpError(400, "This quiz is not available online.");
  const state = quizWindow(quiz);
  if (state === "upcoming") throw httpError(400, "This quiz hasn't opened yet.");

  let attempt = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user.id });
  if (attempt?.submittedAt) throw httpError(400, "You have already submitted this quiz.");
  if (!attempt) {
    if (state === "closed") throw httpError(400, "This quiz is closed.");
    // Atomic get-or-create: two "start" requests arriving together (a
    // double click, a page that fires its loader twice) must both land on
    // the same attempt and the same start time, not race into a
    // duplicate-key error.
    const key = { quiz: quiz._id, student: req.user.id };
    const create = () => QuizAttempt.findOneAndUpdate(key, { $setOnInsert: { ...key, startedAt: new Date(), maxScore: quiz.questions.reduce((s, q) => s + q.marks, 0) } }, { new: true, upsert: true });
    attempt = await create().catch(e => (e.code === 11000 ? QuizAttempt.findOne(key) : Promise.reject(e)));
  }
  res.json({
    quiz: { _id: quiz._id, title: quiz.title, description: quiz.description, durationMinutes: quiz.durationMinutes },
    questions: quiz.questions.map(q => ({ _id: q._id, text: q.text, options: q.options, marks: q.marks })),
    startedAt: attempt.startedAt,
    endsAt: quiz.durationMinutes ? new Date(attempt.startedAt.getTime() + quiz.durationMinutes * 60000) : null,
  });
}));

// Grades on the server from the stored answer key. A submission that
// arrives after the time limit (plus a short network grace) is still
// recorded — so the attempt can't be retried — but scores zero.
student.post("/quizzes/:id/submit", h(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz || !(await studentHasClass(req.user.id, quiz.teacherAssignment))) throw httpError(404, "Quiz not found");
  const attempt = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user.id });
  if (!attempt) throw httpError(400, "Start the quiz before submitting.");
  if (attempt.submittedAt) throw httpError(400, "You have already submitted this quiz.");

  const now = new Date();
  const GRACE_MS = 30000;
  const overtime = quiz.durationMinutes && now.getTime() > attempt.startedAt.getTime() + quiz.durationMinutes * 60000 + GRACE_MS;
  const given = Array.isArray(req.body.answers) ? req.body.answers : [];
  const answers = quiz.questions.map((q, i) => {
    const a = Number(given[i]);
    return Number.isInteger(a) && a >= 0 && a < q.options.length ? a : -1;
  });
  attempt.answers = answers;
  attempt.maxScore = quiz.questions.reduce((s, q) => s + q.marks, 0);
  attempt.score = overtime ? 0 : quiz.questions.reduce((s, q, i) => s + (answers[i] === q.correctIndex ? q.marks : 0), 0);
  attempt.submittedAt = now;
  await attempt.save();
  res.json({
    score: attempt.score, maxScore: attempt.maxScore, overtime: !!overtime,
    // The key is only revealed once the attempt is locked in.
    review: quiz.questions.map((q, i) => ({ text: q.text, options: q.options, chosen: answers[i], correct: q.correctIndex, marks: q.marks })),
  });
}));

// ═══════════════════════════ TEACHER ═══════════════════════════════════════
const teacher = express.Router();
teacher.use(auth("teacher"));

async function ownCoursework(req) {
  const item = await Assignment.findById(req.params.id);
  if (!item || !(await loadOwnAssignment(req.user.id, item.teacherAssignment))) throw httpError(404, "Not found");
  return item;
}
async function ownQuiz(req) {
  const quiz = await Quiz.findById(req.params.id);
  const ta = quiz && (await loadOwnAssignment(req.user.id, quiz.teacherAssignment));
  if (!ta) throw httpError(404, "Not found");
  return { quiz, ta };
}

// Whole-class view: who handed in, who didn't.
teacher.get("/coursework/:id/submissions", h(async (req, res) => {
  const item = await ownCoursework(req);
  const ta = await TeacherAssignment.findById(item.teacherAssignment);
  const [enrollments, submissions] = await Promise.all([
    StudentEnrollment.find({ section: ta.section, status: "active" }).populate("student", "name rollNo photo"),
    Submission.find({ assignment: item._id }),
  ]);
  const byStudent = new Map(submissions.map(s => [String(s.student), s]));
  res.json({
    assignment: item,
    rows: enrollments.filter(e => e.student).map(e => ({ student: e.student, submission: byStudent.get(String(e.student._id)) || null })),
  });
}));

// Similarity check across one assignment's submissions. Each answer is cut
// into overlapping five-word sequences and every pair is compared (Jaccard
// overlap). Identical links are flagged too. It points a teacher at pairs
// worth reading side by side — it is evidence to look at, not a verdict.
const shingles = (text) => {
  const words = String(text || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff\s]/g, " ").split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + 5 <= words.length; i++) set.add(words.slice(i, i + 5).join(" "));
  return { set, words: words.length };
};
teacher.get("/coursework/:id/similarity", h(async (req, res) => {
  const item = await ownCoursework(req);
  const subs = await Submission.find({ assignment: item._id }).populate("student", "name rollNo");
  const prepared = subs.filter(s => s.student).map(s => ({ s, ...shingles(s.text), link: String(s.link || "").trim().toLowerCase().replace(/\/+$/, "") }));
  const pairs = [];
  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      const a = prepared[i], b = prepared[j];
      let score = 0, why = "";
      if (a.words >= 25 && b.words >= 25) {
        let common = 0;
        for (const x of a.set) if (b.set.has(x)) common += 1;
        score = common / (a.set.size + b.set.size - common || 1);
        why = `${Math.round(score * 100)}% of the wording overlaps`;
      }
      if (a.link && a.link === b.link && !/example\.com/.test(a.link)) { score = Math.max(score, 1); why = "Both submitted the same link"; }
      if (score >= 0.4) pairs.push({ score: Math.round(score * 100), why, a: { student: a.s.student, submittedAt: a.s.submittedAt }, b: { student: b.s.student, submittedAt: b.s.submittedAt } });
    }
  }
  res.json({ compared: prepared.length, tooShort: prepared.filter(p => p.words < 25).length, pairs: pairs.sort((x, y) => y.score - x.score) });
}));

teacher.patch("/submissions/:submissionId/grade", h(async (req, res) => {
  const submission = await Submission.findById(req.params.submissionId);
  if (!submission) throw httpError(404, "Not found");
  const item = await Assignment.findById(submission.assignment);
  if (!item || !(await loadOwnAssignment(req.user.id, item.teacherAssignment))) throw httpError(404, "Not found");
  const marks = Number(req.body.marks);
  if (!Number.isFinite(marks) || marks < 0) throw httpError(400, "Marks must be 0 or more.");
  if (item.totalMarks != null && marks > item.totalMarks) throw httpError(400, `Marks cannot exceed the assignment total (${item.totalMarks}).`);
  submission.set({ marks, feedback: String(req.body.feedback || "").slice(0, 2000), gradedAt: new Date() });
  await submission.save();
  await notifyStudents([submission.student], { title: `Graded: ${item.title}`, message: `You scored ${marks}${item.totalMarks != null ? ` / ${item.totalMarks}` : ""}.${submission.feedback ? " Your teacher left feedback." : ""}`, type: "assignment", actionUrl: "/student/assignments" }, { alsoParents: false });
  res.json(submission);
}));

teacher.get("/quizzes/:id", h(async (req, res) => {
  const { quiz } = await ownQuiz(req);
  res.json(quiz);
}));

// Replaces the question bank. Refused once any student has started — the
// questions someone has already seen (and may have answered) can't move.
teacher.put("/quizzes/:id/questions", h(async (req, res) => {
  const { quiz } = await ownQuiz(req);
  if (await QuizAttempt.exists({ quiz: quiz._id })) throw httpError(409, "Students have already started this quiz — its questions can no longer be changed.");
  const questions = (Array.isArray(req.body.questions) ? req.body.questions : []).map((q, i) => {
    const options = (q.options || []).map(o => String(o).trim()).filter(Boolean);
    const text = String(q.text || "").trim();
    if (!text) throw httpError(400, `Question ${i + 1} has no text.`);
    if (options.length < 2) throw httpError(400, `Question ${i + 1} needs at least two options.`);
    const correctIndex = Number(q.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) throw httpError(400, `Question ${i + 1}: mark which option is correct.`);
    return { text, options, correctIndex, marks: Number(q.marks) > 0 ? Number(q.marks) : 1 };
  });
  quiz.questions = questions;
  if (req.body.closesAt !== undefined) quiz.closesAt = req.body.closesAt ? new Date(req.body.closesAt) : null;
  if (questions.length) quiz.totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  await quiz.save();
  res.json(quiz);
}));

teacher.get("/quizzes/:id/results", h(async (req, res) => {
  const { quiz, ta } = await ownQuiz(req);
  const [enrollments, attempts] = await Promise.all([
    StudentEnrollment.find({ section: ta.section._id, status: "active" }).populate("student", "name rollNo"),
    QuizAttempt.find({ quiz: quiz._id }),
  ]);
  const byStudent = new Map(attempts.map(a => [String(a.student), a]));
  const done = attempts.filter(a => a.submittedAt);
  res.json({
    quiz: { _id: quiz._id, title: quiz.title, totalMarks: quiz.totalMarks, questions: quiz.questions.length },
    average: done.length ? Math.round((done.reduce((s, a) => s + a.score, 0) / done.length) * 10) / 10 : null,
    // Per-question facility: share of submitted attempts that got it right.
    questionStats: quiz.questions.map((q, i) => ({ text: q.text, correctRate: done.length ? Math.round((done.filter(a => a.answers[i] === q.correctIndex).length / done.length) * 100) : null })),
    rows: enrollments.filter(e => e.student).map(e => {
      const a = byStudent.get(String(e.student._id));
      return { student: e.student, status: a?.submittedAt ? "submitted" : a ? "in_progress" : "not_started", score: a?.submittedAt ? a.score : null, maxScore: a?.maxScore ?? null, submittedAt: a?.submittedAt || null };
    }),
  });
}));

router.use("/student", student);
router.use("/teacher", teacher);
export default router;
