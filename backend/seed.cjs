// ═══════════════════════════════════════════
//  seed.js  —  Populate DB with initial data
//  Run ONCE:  node seed.js
// ═══════════════════════════════════════════
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/attendance_db";

const studentSchema = new mongoose.Schema({
  name: String, email: String, rollNo: String, password: String, createdAt: { type: Date, default: Date.now }
});
const Student = mongoose.model("Student", studentSchema);

// ── Put YOUR real students here ──────────────────────
const STUDENTS = [
  { name: "zunaira",   email: "zunaira@uni.edu",   rollNo: "CS-201", password: "1234" },
  { name: "Amna",     email: "amna@uni.edu",    rollNo: "CS-202", password: "1234" },
  { name: "sadia ",   email: "sadia@uni.edu",   rollNo: "CS-203", password: "1234" },
  { name: "maryam shafique",   email: "maryam@uni.edu",    rollNo: "CS-204", password: "1234" },
  { name: "fizza shakeel",   email: "fizza@uni.edu",     rollNo: "CS-205", password: "1234" },
  { name: "anzala",     email: "anzala@uni.edu",    rollNo: "CS-206", password: "1234" },
  // Add more students here:
  // { name: "Your Student", email: "student@uni.edu", rollNo: "CS-107", password: "1234" },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("✅  Connected to MongoDB");

  // Clear existing students (remove this line if you want to ADD without clearing)


  for (const s of STUDENTS) {
    const hashed = await bcrypt.hash(s.password, 10);
    await Student.create({ ...s, password: hashed });
    console.log(`➕  Added: ${s.name} (${s.rollNo})`);
  }

  console.log(`\n✅  Seeded ${STUDENTS.length} students successfully!`);
  console.log("   Admin password: admin123 (set in .env)");
  await mongoose.disconnect();
}

seed().catch(err => { console.error("❌  Seed failed:", err.message); process.exit(1); });