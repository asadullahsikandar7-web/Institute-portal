import bcrypt from "bcryptjs";
import Admin from "../models/adminModel.js";
import Student from "../models/studentModel.js";
import ClassModel from "../models/classModel.js";
import Attendance from "../models/attendanceModel.js";
import Exam from "../models/ExamModel.js";
import Grade from "../models/GradeModel.js";
import Fee from "../models/FeeModel.js";
import Notification from "../models/notificationModel.js";
import ParentMessage from "../models/ParentMessagemodel.js";
import Leave from "../models/leavemodel.js";

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

async function seedClassesIfEmpty() {
  const count = await ClassModel.countDocuments();
  if (count > 0) return { seeded: false, classes: 0 };

  const students = await Student.find().limit(6);
  const classDocs = [
    {
      classCode: "CS101",
      className: "Computer Science 101",
      semester: 1,
      teacher: "Dr. A. Khan",
      scheduleDay: "Monday",
      scheduleTime: "09:00-10:30",
      room: "LH-101",
      students: students.map(s => s._id)
    }
  ];

  const res = await ClassModel.insertMany(classDocs);
  return { seeded: true, classes: res.length };
}

async function seedAttendanceIfEmpty() {
  const count = await Attendance.countDocuments();
  if (count > 0) return { seeded: false, attendance: 0 };

  const students = await Student.find().limit(6);
  const today = new Date().toISOString().split('T')[0];
  const docs = students.map(s => ({ studentId: s._id, date: today, status: Math.random()>0.1? 'present' : 'absent' }));
  const res = await Attendance.insertMany(docs);
  return { seeded: true, attendance: res.length };
}

async function seedExamsIfEmpty() {
  const count = await Exam.countDocuments();
  if (count > 0) return { seeded: false, exams: 0 };

  const res = await Exam.insertMany([
    { name: "Midterm 1", subject: "Computer Science", date: new Date(Date.now()+7*86400000), maxMarks: 100, venue: "LH-101" }
  ]);
  return { seeded: true, exams: res.length };
}

async function seedGradesIfEmpty() {
  const count = await Grade.countDocuments();
  if (count > 0) return { seeded: false, grades: 0 };

  const students = await Student.find().limit(6);
  const docs = students.map(s => ({ studentId: s._id, subject: "Computer Science", examName: "Midterm 1", marks: Math.floor(60 + Math.random()*40) }));
  const res = await Grade.insertMany(docs);
  return { seeded: true, grades: res.length };
}

async function seedFeesIfEmpty() {
  const count = await Fee.countDocuments();
  if (count > 0) return { seeded: false, fees: 0 };

  const students = await Student.find().limit(6);
  const due = new Date(); due.setDate(due.getDate()+14);
  const docs = students.map(s => ({ studentId: s._id, title: "Tuition Fee", amount: 20000, category: "tuition", dueDate: due }));
  const res = await Fee.insertMany(docs);
  return { seeded: true, fees: res.length };
}

async function seedNotificationsIfEmpty() {
  const count = await Notification.countDocuments();
  if (count > 0) return { seeded: false, notifications: 0 };

  const res = await Notification.insertMany([
    { title: "Welcome to EduTrack", message: "System initialized with demo data", type: "announcement", recipientId: null }
  ]);
  return { seeded: true, notifications: res.length };
}

async function seedParentMessagesIfEmpty() {
  const count = await ParentMessage.countDocuments();
  if (count > 0) return { seeded: false, parentMessages: 0 };

  const students = await Student.find().limit(3);
  const docs = students.map(s => ({ studentId: s._id, studentName: s.name, rollNo: s.rollNo, parentEmail: s.parentEmail || `${s.name.split(' ')[0].toLowerCase()}@parent.example`, title: "Welcome", message: "Welcome to the semester" }));
  const res = await ParentMessage.insertMany(docs);
  return { seeded: true, parentMessages: res.length };
}

async function seedLeavesIfEmpty() {
  const count = await Leave.countDocuments();
  if (count > 0) return { seeded: false, leaves: 0 };

  const students = await Student.find().limit(2);
  const docs = students.map(s => ({ studentId: s._id, type: "Medical", from: new Date(), to: new Date(Date.now()+2*86400000), reason: "Medical leave" }));
  const res = await Leave.insertMany(docs);
  return { seeded: true, leaves: res.length };
}

export default async function seedIfEmpty() {
  try {
    const adminResult = await seedAdminsIfEmpty();
    const studentResult = await seedStudentsIfEmpty();
    const classesResult = await seedClassesIfEmpty();
    const attendanceResult = await seedAttendanceIfEmpty();
    const examsResult = await seedExamsIfEmpty();
    const gradesResult = await seedGradesIfEmpty();
    const feesResult = await seedFeesIfEmpty();
    const notificationsResult = await seedNotificationsIfEmpty();
    const parentMsgResult = await seedParentMessagesIfEmpty();
    const leavesResult = await seedLeavesIfEmpty();

    const summary = {
      admin: adminResult,
      student: studentResult,
      classes: classesResult,
      attendance: attendanceResult,
      exams: examsResult,
      grades: gradesResult,
      fees: feesResult,
      notifications: notificationsResult,
      parentMessages: parentMsgResult,
      leaves: leavesResult
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
