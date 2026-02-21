import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import authRoutes from "./src/routes/auth.js";
import studentRoutes from "./src/routes/studentroute.js";
import attendanceRoutes from "./src/routes/attendanceRoute.js";
import leaveRoutes from "./src/routes/leaveroutes.js";



const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/attendance");

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);

app.listen(5000, () => {
  console.log("Server running on port 5000");
});