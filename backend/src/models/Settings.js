import mongoose from "mongoose";

// Institute-wide configuration — a single document (key: "main"). Every
// policy number the ERP modules use (grading scale, attendance threshold,
// late-fee rule, library limits) is read from here instead of being
// hard-coded, so one deployment can serve a school, a college or a
// university by changing settings rather than code.
export const DEFAULT_GRADING_SCHEME = [
  { grade: "A", min: 85, points: 4.0 },
  { grade: "A-", min: 80, points: 3.7 },
  { grade: "B+", min: 75, points: 3.3 },
  { grade: "B", min: 70, points: 3.0 },
  { grade: "B-", min: 65, points: 2.7 },
  { grade: "C+", min: 61, points: 2.3 },
  { grade: "C", min: 58, points: 2.0 },
  { grade: "C-", min: 55, points: 1.7 },
  { grade: "D", min: 50, points: 1.0 },
  { grade: "F", min: 0, points: 0 },
];

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "main", unique: true },
    instituteName: { type: String, default: "ACADEXA Institute" },
    instituteType: { type: String, enum: ["school", "college", "university"], default: "university" },
    tagline: { type: String, default: "" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    website: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    principalName: { type: String, default: "" },
    registrarName: { type: String, default: "" },
    currency: { type: String, default: "₨" },
    minAttendancePercent: { type: Number, default: 75, min: 0, max: 100 },
    passingPercent: { type: Number, default: 50, min: 0, max: 100 },
    gradingScheme: {
      type: [{ _id: false, grade: String, min: Number, points: Number }],
      default: () => DEFAULT_GRADING_SCHEME,
    },
    lateFeeType: { type: String, enum: ["none", "flat", "percent"], default: "none" },
    lateFeeValue: { type: Number, default: 0, min: 0 },
    libraryFinePerDay: { type: Number, default: 10, min: 0 },
    libraryMaxBooks: { type: Number, default: 3, min: 1 },
    libraryLoanDays: { type: Number, default: 14, min: 1 },
    admissionsOpen: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Settings = mongoose.models.Settings || mongoose.model("Settings", settingsSchema);

export async function getSettings() {
  return Settings.findOneAndUpdate({ key: "main" }, {}, { new: true, upsert: true, setDefaultsOnInsert: true });
}

// Percentage → { grade, points } against the configured scale.
export function gradeFor(pct, scheme = DEFAULT_GRADING_SCHEME) {
  const sorted = [...scheme].sort((a, b) => b.min - a.min);
  const hit = sorted.find(g => pct >= g.min) || sorted[sorted.length - 1];
  return { grade: hit?.grade || "F", points: hit?.points || 0 };
}

// Atomic named sequences — receipt numbers, employee ids, certificate
// serials, application numbers. $inc on one document is safe under
// concurrent requests, unlike countDocuments()+1.
const counterSchema = new mongoose.Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } });
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

export async function nextSeq(key) {
  const c = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return c.seq;
}
export async function nextCode(prefix, key = prefix, width = 5) {
  return `${prefix}-${String(await nextSeq(key)).padStart(width, "0")}`;
}

export default Settings;
