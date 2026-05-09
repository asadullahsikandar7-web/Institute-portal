import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./src/routes/auth.js";
import adminRoutes from "./src/routes/adminRoute.js";
import studentRoutes from "./src/routes/studentroute.js";
import attendanceRoutes from "./src/routes/attendanceRoute.js";
import leaveRoutes from "./src/routes/leaveroutes.js";
import notificationRoutes from "./src/routes/notificationRoute.js";
import classRoutes from "./src/routes/classRoute.js";
import parentMessageRoutes from "./src/routes/parentMessageRoute.js";
import feeRoutes from "./src/routes/FeeRoute.js";
import gradeRoutes from "./src/routes/GradeRoute.js";
import examRoutes from "./src/routes/ExamRoute.js";
import analyticsRoutes from "./src/routes/AnalyticsRoute.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());

// CORS Configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://institute-portal-psi.vercel.app",
      process.env.FRONTEND_URL || "https://institute-portal-psi.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.log("❌ Mongo Error:", err.message);
  });

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/parent-messages", parentMessageRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health Check Route
app.get("/", (req, res) => {
  res.send("✅ Backend Running Successfully");
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

export default app;