import mongoose from "mongoose";

// ══════════════════════════════════════════════════════════════
//  CLASS MANAGEMENT MODEL — Daily class scheduling
// ══════════════════════════════════════════════════════════════
const ClassSchema = new mongoose.Schema({
  // Identity
  classCode: { type: String, required: true, unique: true }, // e.g., "CS-101"
  className: { type: String, required: true }, // e.g., "BS Artificial Intelligence"
  semester: { type: Number, required: true }, // 1, 2, 3, etc.
  
  // Faculty
  teacher: { type: String, required: true },
  assistant: { type: String, default: null },
  
  // Schedule
  scheduleDay: { type: String, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], required: true },
  scheduleTime: { type: String, required: true }, // "08:00-09:30"
  room: { type: String, required: true }, // "LH-101"
  
  // Tomorrow's management
  tomorrowTopic: { type: String, default: null }, // What will be taught tomorrow
  tomorrowMaterials: [{ type: String }], // Links or names of materials
  tomorrowAssignment: { type: String, default: null }, // Assignment for next class
  tomorrowDeadline: { type: Date, default: null },
  
  // Students enrolled
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
  
  // Meta
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ClassSchema.index({ semester: 1 });
// classCode already has unique: true, no need for explicit index
ClassSchema.index({ scheduleDay: 1, scheduleTime: 1 });
const ClassModel = mongoose.models.Class || mongoose.model("Class", ClassSchema);
export default ClassModel;