import mongoose from "mongoose";

// One scheduled class slot — Program/Section/Subject/AcademicSession are
// stored directly (not only reached via teacherAssignment) because a slot
// can legitimately exist before a teacher is assigned to it ("TBA" in the
// source timetable). `teacherAssignment` is nullable for exactly that case:
// TeacherAssignment.teacher is required, so a TBA slot has no assignment to
// point at yet rather than pointing at a fake placeholder "TBA" teacher
// account. `teacher` is denormalized from teacherAssignment.teacher (kept in
// sync by the route, never set independently) purely so "my classes today"
// can filter directly without a populate+match — same pattern as
// SubjectAttendance's denormalized fields.
//
// startTime/endTime are "HH:mm" 24-hour strings, not a single free-text
// range — the source timetable has real, non-uniform period lengths (e.g.
// 1:30–2:30 alongside the usual 1:30–3:00), and a sortable, comparable
// format is required for the overlap-based conflict checks in
// services/timetableConflicts.js.
const timetableEntrySchema = new mongoose.Schema(
  {
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession", required: true },
    program: { type: mongoose.Schema.Types.ObjectId, ref: "Program", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    teacherAssignment: { type: mongoose.Schema.Types.ObjectId, ref: "TeacherAssignment", default: null },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null }, // null = TBA
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    day: { type: String, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], required: true },
    startTime: { type: String, required: true }, // "HH:mm"
    endTime: { type: String, required: true },   // "HH:mm"
    type: { type: String, enum: ["Lecture", "Lab"], required: true },
  },
  { timestamps: true }
);

// The idempotency key the seed script upserts against, and simultaneously
// the hard "section conflict" guarantee — a section can never have two rows
// for the same subject+room at the same day+startTime.
timetableEntrySchema.index(
  { academicSession: 1, program: 1, section: 1, day: 1, startTime: 1, subject: 1, room: 1 },
  { unique: true }
);
timetableEntrySchema.index({ teacher: 1, day: 1 });
timetableEntrySchema.index({ room: 1, day: 1 });

const TimetableEntry = mongoose.models.TimetableEntry || mongoose.model("TimetableEntry", timetableEntrySchema);
export default TimetableEntry;
