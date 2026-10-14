import mongoose from "mongoose";

// All ERP-layer collections (admissions, finance, results, LMS, HR,
// library, campus services, engagement) in one module. Each is small and
// they reference each other heavily, so they're kept together rather than
// spread over ~30 near-empty files; the older academic models keep their
// one-file-per-model layout untouched.

const { Schema } = mongoose;
const ref = (name, required = false) => ({ type: Schema.Types.ObjectId, ref: name, required: required || undefined, default: required ? undefined : null });
const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);
const ts = { timestamps: true };

// ═══════════════════════════════ ADMISSIONS ═══════════════════════════════
// One row per applicant, moved through a pipeline. "enrolled" is terminal
// and only ever set by the convert endpoint, which creates the Student.
export const ADMISSION_STAGES = ["applied", "under_review", "test_scheduled", "interview", "offered", "accepted", "enrolled", "rejected", "withdrawn"];
const admissionSchema = new Schema({
  applicationNo: { type: String, unique: true, required: true },
  name: { type: String, required: [true, "Applicant name is required"], trim: true },
  email: { type: String, lowercase: true, trim: true, default: "" },
  phone: { type: String, default: "" },
  dob: { type: Date, default: null },
  gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
  address: { type: String, default: "" },
  city: { type: String, default: "" },
  guardianName: { type: String, default: "" },
  guardianPhone: { type: String, default: "" },
  guardianEmail: { type: String, lowercase: true, trim: true, default: "" },
  program: ref("Program"),
  academicSession: ref("AcademicSession"),
  previousInstitute: { type: String, default: "" },
  previousPercentage: { type: Number, default: null, min: 0, max: 100 },
  testScore: { type: Number, default: null, min: 0, max: 100 },
  interviewScore: { type: Number, default: null, min: 0, max: 100 },
  // Weighted composite used for the merit list — recomputed on every save.
  meritScore: { type: Number, default: null },
  stage: { type: String, enum: ADMISSION_STAGES, default: "applied" },
  source: { type: String, enum: ["online", "walk_in", "referral", "agent", "other"], default: "walk_in" },
  notes: { type: String, default: "" },
  history: [{ _id: false, stage: String, at: { type: Date, default: Date.now }, by: String, note: String }],
  student: ref("Student"),
}, ts);
admissionSchema.pre("save", function (next) {
  const parts = [[this.previousPercentage, 0.5], [this.testScore, 0.35], [this.interviewScore, 0.15]].filter(([v]) => v != null);
  const weight = parts.reduce((s, [, w]) => s + w, 0);
  this.meritScore = weight ? Math.round((parts.reduce((s, [v, w]) => s + v * w, 0) / weight) * 100) / 100 : null;
  next();
});
admissionSchema.index({ stage: 1, createdAt: -1 });
export const Admission = model("Admission", admissionSchema);

// ═══════════════════════════════ FINANCE ══════════════════════════════════
// A reusable bill template ("BSCS Semester Fee"). Generating it stamps one
// Fee row per item per targeted student — Fee stays the single ledger.
export const FeeStructure = model("FeeStructure", new Schema({
  name: { type: String, required: [true, "Structure name is required"], trim: true },
  program: ref("Program"),
  items: {
    type: [{ _id: false, title: { type: String, required: true }, category: { type: String, enum: ["tuition", "lab", "library", "exam", "other"], default: "tuition" }, amount: { type: Number, required: true, min: 0 } }],
    validate: [v => v.length > 0, "Add at least one fee item"],
  },
  frequency: { type: String, enum: ["one_time", "monthly", "quarterly", "semester", "annual"], default: "semester" },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
}, ts));

export const Scholarship = model("Scholarship", new Schema({
  student: ref("Student", true),
  title: { type: String, required: [true, "Scholarship title is required"] },
  kind: { type: String, enum: ["merit", "need", "sports", "sibling", "staff_child", "other"], default: "merit" },
  type: { type: String, enum: ["percent", "fixed"], default: "percent" },
  value: { type: Number, required: true, min: 0 },
  // Which fee categories it reduces — a merit scholarship normally covers
  // tuition only, not the library fine.
  appliesTo: { type: [String], default: ["tuition"] },
  validUntil: { type: Date, default: null },
  status: { type: String, enum: ["active", "expired", "revoked"], default: "active" },
  notes: { type: String, default: "" },
}, ts));

export const Expense = model("Expense", new Schema({
  title: { type: String, required: [true, "Expense title is required"] },
  category: { type: String, enum: ["salaries", "utilities", "maintenance", "supplies", "transport", "events", "it", "rent", "marketing", "other"], default: "other" },
  amount: { type: Number, required: true, min: [0, "Amount cannot be negative"] },
  date: { type: Date, default: Date.now },
  paidTo: { type: String, default: "" },
  method: { type: String, enum: ["cash", "bank", "card", "online", "cheque"], default: "bank" },
  reference: { type: String, default: "" },
  notes: { type: String, default: "" },
  recordedBy: { type: String, default: "" },
}, ts));

// ═══════════════════════════════ RESULTS / GPA ════════════════════════════
// How one class is assessed. Weights are relative (normalised on compute),
// so 20/30/50 and 2/3/5 mean the same thing.
export const GradebookConfig = model("GradebookConfig", new Schema({
  teacherAssignment: { type: Schema.Types.ObjectId, ref: "TeacherAssignment", required: true, unique: true },
  components: [{ _id: false, name: { type: String, required: true }, max: { type: Number, required: true, min: 1 }, weight: { type: Number, required: true, min: 0 } }],
}, ts));

// One student's result in one class. Scope ids are denormalised off the
// TeacherAssignment at write time so transcripts survive that assignment
// later being deactivated. Students/parents only ever see published rows.
const courseResultSchema = new Schema({
  student: ref("Student", true),
  teacherAssignment: ref("TeacherAssignment", true),
  academicSession: ref("AcademicSession", true),
  program: ref("Program", true),
  section: ref("Section", true),
  subject: ref("Subject", true),
  creditHours: { type: Number, default: 3, min: 0 },
  marks: { type: Map, of: Number, default: {} }, // component name → obtained
  percentage: { type: Number, default: 0 },
  grade: { type: String, default: "" },
  gradePoint: { type: Number, default: 0 },
  remarks: { type: String, default: "" },
  published: { type: Boolean, default: false },
  publishedAt: { type: Date, default: null },
}, ts);
courseResultSchema.index({ student: 1, teacherAssignment: 1 }, { unique: true });
courseResultSchema.index({ section: 1, academicSession: 1 });
export const CourseResult = model("CourseResult", courseResultSchema);

// ═══════════════════════════════ LMS ══════════════════════════════════════
const submissionSchema = new Schema({
  assignment: ref("Assignment", true),
  student: ref("Student", true),
  text: { type: String, default: "" },
  link: { type: String, default: "" },
  submittedAt: { type: Date, default: Date.now },
  late: { type: Boolean, default: false },
  marks: { type: Number, default: null, min: 0 },
  feedback: { type: String, default: "" },
  gradedAt: { type: Date, default: null },
}, ts);
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
export const Submission = model("Submission", submissionSchema);

const quizAttemptSchema = new Schema({
  quiz: ref("Quiz", true),
  student: ref("Student", true),
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: null },
  answers: { type: [Number], default: [] }, // chosen option index per question, -1 = skipped
  score: { type: Number, default: 0 },
  maxScore: { type: Number, default: 0 },
}, ts);
quizAttemptSchema.index({ quiz: 1, student: 1 }, { unique: true });
export const QuizAttempt = model("QuizAttempt", quizAttemptSchema);

// ═══════════════════════════════ HR & PAYROLL ═════════════════════════════
export const Department = model("Department", new Schema({
  name: { type: String, required: [true, "Department name is required"], trim: true },
  code: { type: String, required: [true, "Department code is required"], unique: true, trim: true, uppercase: true },
  kind: { type: String, enum: ["academic", "administrative", "support"], default: "academic" },
  head: { type: String, default: "" },
  description: { type: String, default: "" },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
}, ts));

const lineItems = [{ _id: false, label: { type: String, required: true }, amount: { type: Number, required: true, min: 0 } }];
export const Staff = model("Staff", new Schema({
  employeeId: { type: String, unique: true, required: true },
  name: { type: String, required: [true, "Staff name is required"], trim: true },
  email: { type: String, lowercase: true, trim: true, default: "" },
  phone: { type: String, default: "" },
  designation: { type: String, default: "" },
  department: ref("Department"),
  category: { type: String, enum: ["teaching", "administrative", "support", "management"], default: "teaching" },
  employmentType: { type: String, enum: ["permanent", "contract", "visiting", "part_time"], default: "permanent" },
  // Links a payroll record to a portal login so a teacher can see their
  // own payslips. Optional — non-teaching staff have no portal account.
  teacher: ref("Teacher"),
  joinDate: { type: Date, default: Date.now },
  qualification: { type: String, default: "" },
  basicSalary: { type: Number, default: 0, min: 0 },
  allowances: { type: lineItems, default: [] },
  deductions: { type: lineItems, default: [] },
  bankName: { type: String, default: "" },
  bankAccount: { type: String, default: "" },
  status: { type: String, enum: ["active", "on_leave", "resigned", "terminated"], default: "active" },
}, ts));

const staffAttendanceSchema = new Schema({
  staff: ref("Staff", true),
  date: { type: String, required: true }, // "YYYY-MM-DD", same convention as SubjectAttendance
  status: { type: String, enum: ["present", "absent", "half_day", "leave", "holiday"], required: true },
  note: { type: String, default: "" },
}, ts);
staffAttendanceSchema.index({ staff: 1, date: 1 }, { unique: true });
export const StaffAttendance = model("StaffAttendance", staffAttendanceSchema);

// A frozen snapshot — later edits to Staff salary never rewrite history.
const payslipSchema = new Schema({
  staff: ref("Staff", true),
  month: { type: String, required: true, match: [/^\d{4}-\d{2}$/, "Month must be YYYY-MM"] },
  basic: { type: Number, default: 0 },
  allowances: { type: lineItems, default: [] },
  deductions: { type: lineItems, default: [] },
  workingDays: { type: Number, default: 30 },
  absentDays: { type: Number, default: 0 },
  absenceDeduction: { type: Number, default: 0 },
  gross: { type: Number, default: 0 },
  net: { type: Number, default: 0 },
  status: { type: String, enum: ["generated", "paid"], default: "generated" },
  paidOn: { type: Date, default: null },
  method: { type: String, default: "" },
}, ts);
payslipSchema.index({ staff: 1, month: 1 }, { unique: true });
export const Payslip = model("Payslip", payslipSchema);

export const StaffLeave = model("StaffLeave", new Schema({
  staff: ref("Staff", true),
  type: { type: String, enum: ["casual", "sick", "annual", "maternity", "unpaid", "other"], default: "casual" },
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  reason: { type: String, default: "" },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  reviewedBy: { type: String, default: "" },
}, ts));

// ═══════════════════════════════ LIBRARY ══════════════════════════════════
export const Book = model("Book", new Schema({
  title: { type: String, required: [true, "Book title is required"], trim: true },
  author: { type: String, default: "" },
  isbn: { type: String, default: "" },
  category: { type: String, default: "General" },
  publisher: { type: String, default: "" },
  year: { type: Number, default: null },
  shelf: { type: String, default: "" },
  copies: { type: Number, default: 1, min: [0, "Copies cannot be negative"] },
  // Maintained by the issue/return endpoints with atomic $inc — never
  // edited directly from the catalogue form.
  available: { type: Number, default: 1, min: 0 },
  status: { type: String, enum: ["active", "withdrawn"], default: "active" },
}, ts));

const bookIssueSchema = new Schema({
  book: ref("Book", true),
  student: ref("Student", true),
  issuedOn: { type: Date, default: Date.now },
  dueOn: { type: Date, required: true },
  returnedOn: { type: Date, default: null },
  fine: { type: Number, default: 0 },
  finePaid: { type: Boolean, default: false },
  status: { type: String, enum: ["issued", "returned", "lost"], default: "issued" },
  issuedBy: { type: String, default: "" },
}, ts);
bookIssueSchema.index({ student: 1, status: 1 });
export const BookIssue = model("BookIssue", bookIssueSchema);

// ═══════════════════════════════ CAMPUS SERVICES ══════════════════════════
export const TransportRoute = model("TransportRoute", new Schema({
  name: { type: String, required: [true, "Route name is required"], trim: true },
  vehicleNo: { type: String, default: "" },
  driverName: { type: String, default: "" },
  driverPhone: { type: String, default: "" },
  capacity: { type: Number, default: 40, min: 1 },
  monthlyFare: { type: Number, default: 0, min: 0 },
  stops: { type: String, default: "" }, // comma-separated, in pickup order
  status: { type: String, enum: ["active", "inactive"], default: "active" },
}, ts));

const transportAssignmentSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true, unique: true },
  route: ref("TransportRoute", true),
  stop: { type: String, default: "" },
  since: { type: Date, default: Date.now },
}, ts);
export const TransportAssignment = model("TransportAssignment", transportAssignmentSchema);

export const Hostel = model("Hostel", new Schema({
  name: { type: String, required: [true, "Hostel name is required"], trim: true },
  type: { type: String, enum: ["boys", "girls", "staff", "mixed"], default: "boys" },
  warden: { type: String, default: "" },
  wardenPhone: { type: String, default: "" },
  address: { type: String, default: "" },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
}, ts));

const hostelRoomSchema = new Schema({
  hostel: ref("Hostel", true),
  number: { type: String, required: [true, "Room number is required"], trim: true },
  floor: { type: String, default: "" },
  capacity: { type: Number, default: 2, min: 1 },
  monthlyRent: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["available", "maintenance", "closed"], default: "available" },
}, ts);
hostelRoomSchema.index({ hostel: 1, number: 1 }, { unique: true });
export const HostelRoom = model("HostelRoom", hostelRoomSchema);

const hostelAllocationSchema = new Schema({
  student: ref("Student", true),
  room: ref("HostelRoom", true),
  from: { type: Date, default: Date.now },
  to: { type: Date, default: null },
  status: { type: String, enum: ["active", "vacated"], default: "active" },
}, ts);
hostelAllocationSchema.index({ room: 1, status: 1 });
export const HostelAllocation = model("HostelAllocation", hostelAllocationSchema);

export const Asset = model("Asset", new Schema({
  name: { type: String, required: [true, "Asset name is required"], trim: true },
  tag: { type: String, default: "" },
  category: { type: String, enum: ["furniture", "it_equipment", "lab_equipment", "vehicle", "sports", "stationery", "other"], default: "other" },
  location: { type: String, default: "" },
  quantity: { type: Number, default: 1, min: 0 },
  unitCost: { type: Number, default: 0, min: 0 },
  purchaseDate: { type: Date, default: null },
  condition: { type: String, enum: ["new", "good", "fair", "needs_repair", "disposed"], default: "good" },
  assignedTo: { type: String, default: "" },
  notes: { type: String, default: "" },
}, ts));

export const Visitor = model("Visitor", new Schema({
  name: { type: String, required: [true, "Visitor name is required"], trim: true },
  phone: { type: String, default: "" },
  nationalId: { type: String, default: "" },
  purpose: { type: String, default: "" },
  toMeet: { type: String, default: "" },
  checkIn: { type: Date, default: Date.now },
  checkOut: { type: Date, default: null },
  badgeNo: { type: String, default: "" },
}, ts));

// ═══════════════════════════════ ENGAGEMENT ═══════════════════════════════
const calendarEventSchema = new Schema({
  title: { type: String, required: [true, "Event title is required"], trim: true },
  type: { type: String, enum: ["holiday", "exam", "event", "meeting", "deadline", "term"], default: "event" },
  start: { type: Date, required: [true, "Start date is required"] },
  end: { type: Date, default: null },
  audience: { type: String, enum: ["all", "students", "teachers", "parents", "staff"], default: "all" },
  location: { type: String, default: "" },
  description: { type: String, default: "" },
}, ts);
calendarEventSchema.index({ start: 1 });
export const CalendarEvent = model("CalendarEvent", calendarEventSchema);

// Helpdesk ticket. raisedBy is polymorphic across the four portals, so the
// display name is snapshotted rather than populated.
const ticketSchema = new Schema({
  ticketNo: { type: String, unique: true, required: true },
  raisedById: { type: String, required: true },
  raisedByRole: { type: String, enum: ["student", "teacher", "parent", "admin"], required: true },
  raisedByName: { type: String, default: "" },
  category: { type: String, enum: ["academic", "fee", "it", "facility", "hostel", "transport", "library", "harassment", "other"], default: "other" },
  subject: { type: String, required: [true, "Subject is required"], trim: true, maxlength: 200 },
  description: { type: String, required: [true, "Description is required"], maxlength: 5000 },
  priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
  status: { type: String, enum: ["open", "in_progress", "resolved", "closed"], default: "open" },
  assignedTo: { type: String, default: "" },
  replies: [{ byRole: String, byName: String, message: { type: String, maxlength: 5000 }, at: { type: Date, default: Date.now } }],
  resolvedAt: { type: Date, default: null },
}, ts);
ticketSchema.index({ raisedById: 1, createdAt: -1 });
export const Ticket = model("Ticket", ticketSchema);

// Per-student log: discipline, health, achievements, counselling notes.
export const StudentRecord = model("StudentRecord", new Schema({
  student: ref("Student", true),
  kind: { type: String, enum: ["discipline", "health", "achievement", "counselling", "document", "note"], default: "note" },
  title: { type: String, required: [true, "Title is required"] },
  details: { type: String, default: "" },
  date: { type: Date, default: Date.now },
  severity: { type: String, enum: ["info", "minor", "major", "critical"], default: "info" },
  actionTaken: { type: String, default: "" },
  recordedBy: { type: String, default: "" },
}, ts));

// Issued-document register. The serial is what makes a printed certificate
// verifiable: GET /api/engage/certificates/verify/:serial is public.
export const Certificate = model("Certificate", new Schema({
  serialNo: { type: String, unique: true, required: true },
  student: ref("Student", true),
  type: { type: String, enum: ["bonafide", "character", "transfer", "completion", "id_card", "fee_clearance"], required: true },
  purpose: { type: String, default: "" },
  issuedOn: { type: Date, default: Date.now },
  issuedBy: { type: String, default: "" },
  status: { type: String, enum: ["valid", "revoked"], default: "valid" },
}, ts));

export const Alumni = model("Alumni", new Schema({
  name: { type: String, required: [true, "Name is required"], trim: true },
  student: ref("Student"),
  rollNo: { type: String, default: "" },
  program: { type: String, default: "" },
  graduationYear: { type: Number, default: null },
  email: { type: String, lowercase: true, trim: true, default: "" },
  phone: { type: String, default: "" },
  currentOrganization: { type: String, default: "" },
  currentPosition: { type: String, default: "" },
  city: { type: String, default: "" },
  cgpa: { type: Number, default: null },
  notes: { type: String, default: "" },
}, ts));
