// ═══════════════════════════════════════════════════════════════
//  PRODUCTION-READY SERVER.JS
// ═══════════════════════════════════════════════════════════════
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// ═══════════════════════════════════════════════════════════════
//  ENVIRONMENT VALIDATION (FAIL FAST)
// ═══════════════════════════════════════════════════════════════

const requiredEnvVars = ["MONGO_URI", "JWT_SECRET"];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error("❌ MISSING REQUIRED ENVIRONMENT VARIABLES:");
  missingVars.forEach(v => console.error(`   - ${v}`));
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
//  IMPORT ROUTES
// ═══════════════════════════════════════════════════════════════
import authRoutes from "./src/routes/auth.js";
import adminRoutes from "./src/routes/adminRoute.js";
import studentRoutes from "./src/routes/studentRoute.js";
import attendanceRoutes from "./src/routes/attendanceRoute.js";
import leaveRoutes from "./src/routes/leaveroutes.js";
import notificationRoutes from "./src/routes/notificationRoute.js";
import examRoutes from "./src/routes/ExamRoute.js";
import gradeRoutes from "./src/routes/GradeRoute.js";
import feeRoutes from "./src/routes/FeeRoute.js";
import timetableRoutes from "./src/routes/timetableRoute.js";
import classRoutes from "./src/routes/classRoute.js";
import analyticsRoutes from "./src/routes/AnalyticsRoute.js";
import parentMessageRoutes from "./src/routes/parentMessageRoute.js";

// ═══════════════════════════════════════════════════════════════
//  EXPRESS APP SETUP
// ═══════════════════════════════════════════════════════════════

const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://institute-portal-psi.vercel.app",
  "https://attendance-app-asad.vercel.app",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ═══════════════════════════════════════════════════════════════
//  DATABASE CONNECTION (WITH PROPER ERROR HANDLING)
// ═══════════════════════════════════════════════════════════════

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
    process.exit(1);
  }
};

connectDB();

// Handle MongoDB connection events
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB error:", err.message);
});

// ═══════════════════════════════════════════════════════════════
//  HEALTH CHECK ROUTES
// ═══════════════════════════════════════════════════════════════

app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "EduTrack API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? "healthy" : "unhealthy",
    database: dbConnected ? "connected" : "disconnected",
    uptime: process.uptime()
  });
});

app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());

// ═══════════════════════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════════════════════

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
app.use("/api/timetable", timetableRoutes);
app.use("/api/analytics", analyticsRoutes);

// ═══════════════════════════════════════════════════════════════
//  ERROR HANDLING MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: "Route not found",
    path: req.path 
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
});

// ═══════════════════════════════════════════════════════════════
//  SERVER STARTUP (LOCAL DEVELOPMENT ONLY)
// ═══════════════════════════════════════════════════════════════

// Only start server in local environment, not in Vercel serverless
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🗄️ Database: ${mongoose.connection.readyState === 1 ? "✅ Connected" : "❌ Connecting"}`);
  });

  // Local error handlers
  process.on("unhandledRejection", (err) => {
    console.error("❌ Unhandled Rejection:", err);
    process.exit(1);
  });

  process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
    process.exit(1);
  });

  process.on("SIGTERM", () => {
    console.log("⏹️ SIGTERM received, shutting down gracefully");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
} else {
  // Vercel serverless: just log that we're ready
  console.log(`🚀 Vercel serverless running`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT FOR VERCEL SERVERLESS
// ═══════════════════════════════════════════════════════════════
export default app;