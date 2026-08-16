import mongoose from "mongoose";

// The scoped, audit-trail record of a teacher's announcement to one
// class/section/subject — "who posted what, to which class, when". Actual
// student-facing delivery deliberately reuses the EXISTING Notification
// model/pipeline (notificationModel.js + the student Notifications/
// Announcements UI already in asad.jsx) by fan-out: on create, one
// Notification doc per actively-enrolled student in the target section is
// written alongside this record. That means students see teacher
// announcements through the app's existing, working notification feed with
// zero frontend changes required on the student side — this collection
// exists only so a teacher/admin can list "what did I announce to this
// class", which flat per-student Notification docs can't answer.
const academicAnnouncementSchema = new mongoose.Schema(
  {
    teacherAssignment: { type: mongoose.Schema.Types.ObjectId, ref: "TeacherAssignment", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    recipientCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

academicAnnouncementSchema.index({ teacherAssignment: 1, createdAt: -1 });

const AcademicAnnouncement = mongoose.models.AcademicAnnouncement || mongoose.model("AcademicAnnouncement", academicAnnouncementSchema);
export default AcademicAnnouncement;
