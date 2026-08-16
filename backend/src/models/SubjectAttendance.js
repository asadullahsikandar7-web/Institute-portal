import mongoose from "mongoose";

// Subject-scoped, teacher-marked attendance — deliberately a SEPARATE
// collection from the legacy Attendance model (attendanceModel.js), which
// stays exactly as-is for whatever already reads it (admin's flat daily
// attendance page). This collection is the one written by
// routes/teacherPortalRoute.js, always through requireOwnAssignment /
// filterStudentsInSection in services/teacherAuth.js — never trust a
// student/section/subject id here without that check having run first.
const subjectAttendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession", required: true },
    program: { type: mongoose.Schema.Types.ObjectId, ref: "Program", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    teacherAssignment: { type: mongoose.Schema.Types.ObjectId, ref: "TeacherAssignment", required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    // String "YYYY-MM-DD", matching the legacy Attendance model's date
    // format (and the frontend's today() helper) rather than a Date, so a
    // day's attendance is never ambiguous across timezones.
    date: { type: String, required: true },
    status: { type: String, enum: ["present", "absent", "leave"], required: true },
  },
  { timestamps: true }
);

// One status per student per subject per day — POST upserts against this.
subjectAttendanceSchema.index(
  { student: 1, academicSession: 1, program: 1, section: 1, subject: 1, date: 1 },
  { unique: true }
);
// Marking/viewing a whole section's attendance for one date is the hot path.
subjectAttendanceSchema.index({ section: 1, subject: 1, date: 1 });

const SubjectAttendance = mongoose.models.SubjectAttendance || mongoose.model("SubjectAttendance", subjectAttendanceSchema);
export default SubjectAttendance;
