import mongoose from "mongoose";

// Academic chat group — identity is exactly one TeacherAssignment (session +
// program + section + subject + teacher, per spec §19), so the unique index
// on teacherAssignment IS the "one group per Ahmed Khan / BS AI / Section A /
// Data Structures" rule; no separate composite key needed.
//
// `members` only matters when mode is "teacher_selected" — for
// "teacher_all" membership is deliberately NOT duplicated here; it's
// resolved live from StudentEnrollment (see resolveGroupMemberIds in
// services/teacherAuth.js) so a student added to the section later is
// automatically in the group without a migration step, and one who leaves
// loses access immediately rather than via manual cleanup of this array.
const chatGroupSchema = new mongoose.Schema(
  {
    teacherAssignment: { type: mongoose.Schema.Types.ObjectId, ref: "TeacherAssignment", required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    mode: { type: String, enum: ["teacher_only", "teacher_selected", "teacher_all"], default: "teacher_all" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true }
);

const ChatGroup = mongoose.models.ChatGroup || mongoose.model("ChatGroup", chatGroupSchema);
export default ChatGroup;
