import Attendance from "../models/attendanceModel.js";

// ➕ Mark attendance
export const markAttendance = async (req, res) => {
  try {
    const { studentId, date, status } = req.body;

    if (!studentId || !date || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const record = await Attendance.findOneAndUpdate(
      { studentId, date },
      { status },
      { upsert: true, new: true }
    );

    res.json({ message: "Attendance marked", record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 📅 Get attendance by date
export const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const records = await Attendance.find({ date });

    const attendanceMap = {};
    records.forEach((record) => {
      attendanceMap[record.studentId.toString()] = record.status;
    });

    res.json(attendanceMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
