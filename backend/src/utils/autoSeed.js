import bcrypt from "bcryptjs";
import Admin from "../models/adminModel.js";
import Student from "../models/studentModel.js";

const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
const DEFAULT_STUDENT_PASSWORD = process.env.DEFAULT_STUDENT_PASSWORD || "1234";

async function seedAdminsIfEmpty() {
  const count = await Admin.countDocuments();
  if (count > 0) return { seeded: false, admins: 0 };

  const hashed = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  const admins = [
    { email: "admin1@uni.edu", password: hashed, isSuperAdmin: true },
    { email: "admin2@uni.edu", password: hashed, isSuperAdmin: false }
  ];

  await Admin.deleteMany();
  const res = await Admin.insertMany(admins);
  return { seeded: true, admins: res.length };
}

async function seedStudentsIfEmpty() {
  const count = await Student.countDocuments();
  if (count > 0) return { seeded: false, students: 0 };

  const plainStudents = [
    { name: "zunaira", email: "zunaira@uni.edu", rollNo: "CS-201" },
    { name: "Amna", email: "amna@uni.edu", rollNo: "CS-202" },
    { name: "sadia", email: "sadia@uni.edu", rollNo: "CS-203" },
    { name: "maryam shafique", email: "maryam@uni.edu", rollNo: "CS-204" },
    { name: "fizza shakeel", email: "fizza@uni.edu", rollNo: "CS-205" },
    { name: "anzala", email: "anzala@uni.edu", rollNo: "CS-206" }
  ];

  const hashed = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);
  const students = plainStudents.map(s => ({ ...s, password: hashed }));

  await Student.deleteMany();
  const res = await Student.insertMany(students);
  return { seeded: true, students: res.length };
}

export default async function seedIfEmpty() {
  try {
    const adminResult = await seedAdminsIfEmpty();
    const studentResult = await seedStudentsIfEmpty();

    const summary = {
      admin: adminResult,
      student: studentResult
    };

    console.log("✅ Auto-seed summary:", summary);
    if (adminResult.seeded) console.log(`   - Admin password: ${DEFAULT_ADMIN_PASSWORD}`);
    if (studentResult.seeded) console.log(`   - Student password for all seeded students: ${DEFAULT_STUDENT_PASSWORD}`);

    return summary;
  } catch (err) {
    console.error("❌ Auto-seed failed:", err && err.message);
    throw err;
  }
}
