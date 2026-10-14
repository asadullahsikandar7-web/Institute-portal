import mongoose from "mongoose";

// Collections behind the "smart" layer: early-warning interventions, exam
// sessions with generated datesheets and seating, live attendance check-in
// sessions, fee payment claims and anonymous teacher-evaluation surveys.

const { Schema } = mongoose;
const ref = (name, required = false) => ({ type: Schema.Types.ObjectId, ref: name, required: required || undefined, default: required ? undefined : null });
const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);
const ts = { timestamps: true };

// ═══════════════════════════ STUDENT SUCCESS ═══════════════════════════════
// What was done about an at-risk student. The risk score itself is never
// stored — it is recomputed from live data (services/risk.js) so it can't
// go stale; this is the human follow-up trail beside it.
const interventionSchema = new Schema({
  student: ref("Student", true),
  type: { type: String, enum: ["counselling", "parent_contact", "warning_letter", "academic_support", "fee_plan", "other"], default: "counselling" },
  notes: { type: String, required: [true, "Notes are required"], maxlength: 3000 },
  followUpOn: { type: Date, default: null },
  status: { type: String, enum: ["open", "done"], default: "open" },
  byRole: { type: String, default: "admin" },
  byId: { type: String, default: "" },
  byName: { type: String, default: "" },
}, ts);
interventionSchema.index({ student: 1, createdAt: -1 });
export const Intervention = model("Intervention", interventionSchema);

// ═══════════════════════════ EXAMINATIONS ══════════════════════════════════
export const ExamSession = model("ExamSession", new Schema({
  name: { type: String, required: [true, "Exam name is required"], trim: true }, // "Midterm — Fall 2026"
  kind: { type: String, enum: ["midterm", "final", "sessional", "supplementary", "entry_test"], default: "midterm" },
  academicSession: ref("AcademicSession", true),
  startDate: { type: Date, required: [true, "Start date is required"] },
  endDate: { type: Date, required: [true, "End date is required"] },
  // Daily paper slots, "HH:mm" like TimetableEntry.
  slots: { type: [{ _id: false, start: String, end: String }], default: () => [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "17:00" }] },
  // Admit-card rules. Evaluated live when a student opens their admit card.
  requireAttendance: { type: Boolean, default: true },
  requireFeeClearance: { type: Boolean, default: true },
  instructions: { type: String, default: "" },
  status: { type: String, enum: ["draft", "published", "completed"], default: "draft" },
}, ts));

const examPaperSchema = new Schema({
  examSession: ref("ExamSession", true),
  teacherAssignment: ref("TeacherAssignment", true),
  subject: ref("Subject", true),
  section: ref("Section", true),
  program: ref("Program", true),
  date: { type: String, required: true }, // "YYYY-MM-DD"
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  room: ref("Room"),
  invigilator: ref("Teacher"),
  seats: [{ _id: false, student: { type: Schema.Types.ObjectId, ref: "Student" }, seatNo: Number }],
}, ts);
examPaperSchema.index({ examSession: 1, teacherAssignment: 1 }, { unique: true });
examPaperSchema.index({ examSession: 1, date: 1, startTime: 1 });
export const ExamPaper = model("ExamPaper", examPaperSchema);

// ═══════════════════════════ LIVE ATTENDANCE ═══════════════════════════════
// A short window during which students in the room mark themselves present
// with a rotating 6-digit code shown on the teacher's screen. The code is
// derived from `secret` + the current 30-second window, so a code texted to
// an absent friend is dead within a minute.
const attendanceSessionSchema = new Schema({
  teacherAssignment: ref("TeacherAssignment", true),
  teacher: ref("Teacher", true),
  date: { type: String, required: true },
  secret: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  closedAt: { type: Date, default: null },
  checkedIn: [{ type: Schema.Types.ObjectId, ref: "Student" }],
}, ts);
attendanceSessionSchema.index({ teacherAssignment: 1, expiresAt: -1 });
export const AttendanceSession = model("AttendanceSession", attendanceSessionSchema);

// ═══════════════════════════ PAYMENT CLAIMS ════════════════════════════════
// "I paid at the bank" — submitted by a student or parent with the deposit
// reference; nothing is credited until the accounts office verifies it.
const paymentClaimSchema = new Schema({
  fee: ref("Fee", true),
  student: ref("Student", true),
  amount: { type: Number, required: true, min: [1, "Amount must be greater than 0"] },
  method: { type: String, enum: ["bank", "online", "card", "cheque", "cash"], default: "bank" },
  reference: { type: String, required: [true, "A transaction / deposit reference is required"], trim: true, maxlength: 120 },
  paidOn: { type: Date, default: Date.now },
  note: { type: String, default: "", maxlength: 500 },
  submittedByRole: { type: String, enum: ["student", "parent"], required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  reviewedBy: { type: String, default: "" },
  reviewNote: { type: String, default: "" },
  receiptNo: { type: String, default: "" },
}, ts);
paymentClaimSchema.index({ status: 1, createdAt: -1 });
export const PaymentClaim = model("PaymentClaim", paymentClaimSchema);

// ═══════════════════════════ TEACHER EVALUATION ════════════════════════════
export const Survey = model("Survey", new Schema({
  title: { type: String, required: [true, "Survey title is required"], trim: true },
  academicSession: ref("AcademicSession", true),
  questions: {
    type: [String],
    default: () => [
      "The teacher explains concepts clearly.",
      "The teacher is well prepared for class.",
      "The teacher is punctual and uses class time well.",
      "Assessments are fair and returned with useful feedback.",
      "The teacher is approachable and encourages questions.",
    ],
    validate: [v => v.length >= 1 && v.length <= 15, "A survey needs between 1 and 15 questions"],
  },
  status: { type: String, enum: ["draft", "open", "closed"], default: "draft" },
  closesOn: { type: Date, default: null },
}, ts));

// Deliberately holds NO student reference. `responderKey` is a keyed hash
// of (student, survey, class): enough to stop a second response, useless
// for finding out who wrote one.
const surveyResponseSchema = new Schema({
  survey: ref("Survey", true),
  teacherAssignment: ref("TeacherAssignment", true),
  teacher: ref("Teacher", true),
  responderKey: { type: String, required: true },
  ratings: { type: [Number], required: true },
  comment: { type: String, default: "", maxlength: 1000 },
}, { timestamps: { createdAt: false, updatedAt: false } });
surveyResponseSchema.index({ survey: 1, responderKey: 1 }, { unique: true });
surveyResponseSchema.index({ survey: 1, teacher: 1 });
export const SurveyResponse = model("SurveyResponse", surveyResponseSchema);

// ═══════════════════════════ SUBSTITUTIONS ═════════════════════════════════
// Cover for one timetable period on one date while its teacher is away.
const substitutionSchema = new Schema({
  date: { type: String, required: true }, // "YYYY-MM-DD"
  entry: ref("TimetableEntry", true),
  absentTeacher: ref("Teacher", true),
  substitute: ref("Teacher", true),
  reason: { type: String, default: "" },
  note: { type: String, default: "" },
  arrangedBy: { type: String, default: "" },
}, ts);
substitutionSchema.index({ date: 1, entry: 1 }, { unique: true });
substitutionSchema.index({ substitute: 1, date: 1 });
export const Substitution = model("Substitution", substitutionSchema);

// ═══════════════════════════ PARENT–TEACHER MEETINGS ═══════════════════════
// A teacher publishes short slots; a parent books one for a child that
// teacher actually teaches.
const meetingSlotSchema = new Schema({
  teacher: ref("Teacher", true),
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  mode: { type: String, enum: ["in_person", "online", "phone"], default: "in_person" },
  location: { type: String, default: "" },
  parent: ref("Parent"),
  student: ref("Student"),
  agenda: { type: String, default: "", maxlength: 500 },
  status: { type: String, enum: ["open", "booked", "cancelled", "done"], default: "open" },
  outcome: { type: String, default: "", maxlength: 2000 },
}, ts);
meetingSlotSchema.index({ teacher: 1, start: 1 }, { unique: true });
export const MeetingSlot = model("MeetingSlot", meetingSlotSchema);
