// ═══════════════════════════════════════════════════════════════
//  PRODUCTION-READY SERVER.JS
// ═══════════════════════════════════════════════════════════════
// Must stay the first import: installs institute isolation on every model
// before any model module is loaded (see src/tenancy/plugin.js).
import "./src/tenancy/register.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createRequire } from 'module';
const __require = createRequire(import.meta.url);

// Load environment variables
dotenv.config();

// Runtime shim: ensure `bson` exposes on-demand helpers expected by the mongodb driver
try {
  const bsonModule = __require('bson');
  if (bsonModule && typeof bsonModule.parseToElementsToArray !== 'function') {
    const maybeBSON = bsonModule.BSON ?? bsonModule;
    if (maybeBSON && maybeBSON.onDemand && typeof maybeBSON.onDemand.parseToElements === 'function') {
      bsonModule.parseToElementsToArray = function (bytes, offset) {
        const res = maybeBSON.onDemand.parseToElements(bytes, offset);
        return Array.isArray(res) ? res : [...res];
      };
    }
  }
} catch (e) {
  // If require fails (package not present or ESM-only), ignore — mongodb's internal wrapper will handle it.
}

// Load mongoose after the shim so mongodb/bson are resolved to the patched module
let mongoose = null;
try {
  mongoose = __require('mongoose');
  mongoose = mongoose && mongoose.default ? mongoose.default : mongoose;
} catch (e) {
  console.error('Unable to require mongoose at startup:', e && e.message);
}

// Minimal startup diagnostics — avoid requiring mongodb/bson directly because
// some package export maps prevent reading package.json or internal helpers
try {
  console.log(`Startup diagnostics: node=${process.version}, env=${process.env.NODE_ENV || 'development'}`);
  if (mongoose && mongoose.version) console.log(`Startup diagnostics: mongoose@${mongoose.version}`);
} catch (e) {
  console.log('Startup diagnostics: unable to read runtime versions');
}

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
import feedbackRoutes from "./src/routes/feedbackRoute.js";
import chatRoutes from "./src/routes/chatRoute.js";
import aiRoutes from "./src/routes/aiRoute.js";
// Academic hierarchy (Academic Session -> Program -> Section -> Subject ->
// Teacher/TeacherAssignment) — fully additive, does not touch classRoute.js
// or timetableRoute.js above, which remain the pre-existing timetable-slot
// system untouched.
import academicSessionRoutes from "./src/routes/academicSessionRoute.js";
import programRoutes from "./src/routes/programRoute.js";
import sectionRoutes from "./src/routes/sectionRoute.js";
import subjectRoutes from "./src/routes/subjectRoute.js";
import teacherRoutes from "./src/routes/teacherRoute.js";
import teacherAssignmentRoutes from "./src/routes/teacherAssignmentRoute.js";
import enrollmentRoutes from "./src/routes/enrollmentRoute.js";
import parentRoutes from "./src/routes/parentRoute.js";
// Teacher-facing self-service portal (classes/students/attendance/
// coursework/quizzes/announcements/chat-groups) + its student-side chat
// counterpart + admin read-only oversight of subject attendance.
import teacherPortalRoutes from "./src/routes/teacherPortalRoute.js";
import studentAcademicRoutes from "./src/routes/studentAcademicRoute.js";
import subjectAttendanceRoutes from "./src/routes/subjectAttendanceRoute.js";
import assignmentRoutes from "./src/routes/assignmentRoute.js";
import quizRoutes from "./src/routes/quizRoute.js";
import scheduleRoutes from "./src/routes/scheduleRoute.js";
import roomRoutes from "./src/routes/roomRoute.js";
// ERP layer — admissions, finance, results/GPA, LMS, HR & payroll, library,
// campus services, engagement, student lifecycle, parent portal. All
// additive: every route above keeps its existing path and behaviour.
import systemRoutes from "./src/routes/systemRoute.js";
import admissionRoutes from "./src/routes/admissionRoute.js";
import financeRoutes from "./src/routes/financeRoute.js";
import resultRoutes from "./src/routes/resultRoute.js";
import lmsRoutes from "./src/routes/lmsRoute.js";
import hrRoutes from "./src/routes/hrRoute.js";
import libraryRoutes from "./src/routes/libraryRoute.js";
import campusRoutes from "./src/routes/campusRoute.js";
import engageRoutes from "./src/routes/engageRoute.js";
import lifecycleRoutes from "./src/routes/lifecycleRoute.js";
import parentPortalRoutes from "./src/routes/parentPortalRoute.js";
import successRoutes from "./src/routes/successRoute.js";
import examSuiteRoutes from "./src/routes/examSuiteRoute.js";
import smartRoutes from "./src/routes/smartRoute.js";
import automationRoutes from "./src/routes/automationRoute.js";
import opsRoutes from "./src/routes/opsRoute.js";
import { startScheduler } from "./src/services/automations.js";
import { moduleGuard, auditTrail, rateLimit, securityHeaders } from "./src/services/permissions.js";
import platformRoutes from "./src/routes/platformRoute.js";
import { tenantContext, setTenancyReady, invalidateTenantCache, isMultiTenant, defaultTenant } from "./src/tenancy/middleware.js";
import { runAsTenant, runUnscoped } from "./src/tenancy/context.js";
import { Tenant, PlatformOwner } from "./src/models/Tenant.js";
import { smtpReady, smtpLastError } from "./src/utils/mailer.js";
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Same dev cert Vite uses (see vite.config.js and
// scripts/generate-dev-cert.sh) — camera/microphone access needs a secure
// context, which a LAN IP over plain HTTP never qualifies as. Falls back to
// plain HTTP automatically if the cert hasn't been generated.
const devCertDir = path.join(__dirname, "..", "certs");
const devKeyPath = path.join(devCertDir, "dev-key.pem");
const devCertPath = path.join(devCertDir, "dev-cert.pem");
const devHttpsCreds = !process.env.ACADEXA_HTTP && fs.existsSync(devKeyPath) && fs.existsSync(devCertPath)
  ? { key: fs.readFileSync(devKeyPath), cert: fs.readFileSync(devCertPath) }
  : null;
import { attachChatSocket } from "./src/socket/chatSocket.js";
import { attachCallSocket } from "./src/socket/callSocket.js";
import { isLocalDevHost } from "./src/utils/originCheck.js";
import os from "os";

// Best-effort LAN IPv4 lookup, purely for the startup log below (so
// "which URL do I open on my phone" doesn't require digging through
// System Preferences) — never affects what the server actually binds to.
function lanIPv4() {
  const nets = os.networkInterfaces();
  for (const ifaceList of Object.values(nets)) {
    for (const iface of ifaceList || []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}
// ═══════════════════════════════════════════════════════════════
//  EXPRESS APP SETUP
// ═══════════════════════════════════════════════════════════════

const app = express();

// Behind Vercel/any reverse proxy the socket address is the proxy's — trust
// one hop so req.ip (used by the login throttle and the audit trail) is
// the real client address.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders);

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// CORS Configuration
// Allow common local dev ports and configured frontend URL(s). Use a dynamic origin
// callback to be explicit and to support Netlify dev (localhost:8888) and tools with no origin.
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8888",
  "https://institute-portal-psi.vercel.app",
  "https://attendance-app-asad.vercel.app",
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
].filter(Boolean));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Allow exact matches from the allowedOrigins set
    if (allowedOrigins.has(origin)) return callback(null, true);

    // Allow localhost and same-LAN IPs with any port (covers local dev,
    // including testing from another device on the same Wi-Fi)
    try {
      const url = new URL(origin);
      if (isLocalDevHost(url.hostname)) return callback(null, true);
    } catch (e) {
      // If origin is not a valid URL, deny it below
    }

    // Deny other origins
    return callback(new Error('CORS policy: Origin not allowed'), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Institute"],
  exposedHeaders: ["Authorization"]
}));

// Handle preflight for all routes
app.options('*', cors());

// ═══════════════════════════════════════════════════════════════
//  DATABASE CONNECTION (WITH PROPER ERROR HANDLING)
// ═══════════════════════════════════════════════════════════════

// Serverless-friendly mongoose connection with caching to reuse connections across warm invocations
const mongoCache = global.__mongoCache || (global.__mongoCache = { conn: null, promise: null });
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI, MONGODB_URI, or DATABASE_URL is required');
}

const connectDB = async () => {
  if (!mongoose) {
    throw new Error('Mongoose not available');
  }

  if (mongoCache.conn) {
    return mongoCache.conn;
  }

  if (!mongoCache.promise) {
    mongoCache.promise = mongoose.connect(MONGO_URI).then((m) => {
      mongoCache.conn = m;
      return m;
    });
  }

  try {
    const conn = await mongoCache.promise;
    console.log("✅ MongoDB Connected Successfully");
    return conn;
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
    // In serverless environments we should not call process.exit; throw to allow function to return error
    throw err;
  }
};

// Establish connection on cold start (will be reused on warm invocations)
// Institute bootstrap, awaited by the tenancy middleware before it serves
// any API request:
//  • brand-new empty database → create the first institute, so the system
//    is multi-institute from day one;
//  • existing data and no institutes yet → stay in single-institute mode
//    (nothing changes) until scripts/migrateToMultiTenant.mjs is run.
async function bootstrapTenancy() {
  const Admin = (await import("./src/models/adminModel.js")).default;
  const Student = (await import("./src/models/studentModel.js")).default;
  if (!(await Tenant.exists({}))) {
    const hasData = await runUnscoped(async () => (await Admin.exists({})) || (await Student.exists({})));
    if (!hasData) {
      await Tenant.create({ code: process.env.DEFAULT_INSTITUTE_CODE || "MAIN", name: "My Institute" });
      console.log("🏫 Created the first institute (code " + (process.env.DEFAULT_INSTITUTE_CODE || "MAIN") + ")");
    } else {
      console.log("🏫 Single-institute mode — run backend/scripts/migrateToMultiTenant.mjs to enable multiple institutes");
    }
  }
  invalidateTenantCache();
  // Platform owner from the environment, if configured and none exists yet.
  const { PLATFORM_OWNER_EMAIL: email, PLATFORM_OWNER_PASSWORD: password } = process.env;
  if (email && password && !(await PlatformOwner.exists({}))) {
    const bcrypt = (await import("bcryptjs")).default;
    await PlatformOwner.create({ email, password: await bcrypt.hash(password, 10) });
    console.log("👑 Platform owner account created for " + email);
  }
}

const tenancyReady = connectDB().then(async () => {
  console.log('Initial DB connection succeeded');
  try { await bootstrapTenancy(); } catch (e) { console.error('Institute bootstrap error:', e && e.message); }
  // Run auto-seed if collections are empty — for the default institute only.
  try {
    const seeder = await import('./src/utils/autoSeed.js');
    const def = (await isMultiTenant()) ? await defaultTenant() : null;
    if (def) await runAsTenant(def, async () => await seeder.default());
    else if (!(await isMultiTenant())) await runUnscoped(async () => await seeder.default());
  } catch (e) {
    console.error('Auto-seed error (non-fatal):', e && e.message);
  }
});
setTenancyReady(tenancyReady.catch(() => {}));
tenancyReady.catch((err) => {
  // Log — don't exit the process
  console.error('Initial DB connection failed:', err && err.message);
});

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
  const smtpConnected = smtpReady;
  const isHealthy = dbConnected && smtpConnected;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    database: dbConnected ? "connected" : "disconnected",
    smtp: smtpConnected ? "connected" : "disconnected",
    smtpError: smtpLastError || null,
    uptime: process.uptime()
  });
});

app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());

// ═══════════════════════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════════════════════

// Cross-cutting guards, ahead of every /api route:
//   loginThrottle — slows password guessing on all four login endpoints
//   moduleGuard   — admin sub-role → module permissions, parent allow-list
//   auditTrail    — records every state-changing request
const loginThrottle = rateLimit({ max: 15, windowMs: 10 * 60 * 1000, message: "Too many login attempts. Please wait a few minutes and try again." });
app.use(["/api/auth/student-login", "/api/auth/admin-login", "/api/auth/teacher-login", "/api/auth/parent-login", "/api/admin/admin-login", "/api/auth/change-password", "/api/auth/forgot-password", "/api/auth/reset-password"], loginThrottle);
app.use(tenantContext); // which institute — every DB operation below is limited to it
app.use(moduleGuard);
app.use(auditTrail);
app.use("/api/platform", platformRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/parent-messages", parentMessageRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ai", aiRoutes);

// Academic hierarchy (Academic Session -> Program -> Section -> Subject ->
// Teacher/TeacherAssignment) — additive, does not touch /api/classes or
// /api/timetable above, which remain the pre-existing timetable-slot system.
app.use("/api/academic-sessions", academicSessionRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/teacher-assignments", teacherAssignmentRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/teacher", teacherPortalRoutes);
app.use("/api/student", studentAcademicRoutes);
app.use("/api/subject-attendance", subjectAttendanceRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/rooms", roomRoutes);

app.use("/api/system", systemRoutes);
app.use("/api/admissions", admissionRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/lms", lmsRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/campus", campusRoutes);
app.use("/api/engage", engageRoutes);
app.use("/api/lifecycle", lifecycleRoutes);
app.use("/api/parent-portal", parentPortalRoutes);
app.use("/api/success", successRoutes);
app.use("/api/examsuite", examSuiteRoutes);
app.use("/api/smart", smartRoutes);
app.use("/api/automations", automationRoutes);
app.use("/api/ops", opsRoutes);

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
  const PORT = process.env.PORT || 5001;

  // Socket.IO needs a real, persistent http.Server to hold WebSocket
  // connections open — that only exists in this branch (a long-running
  // process), never in the Vercel serverless branch below. This is what
  // makes chat's real-time layer work locally, and in production if this
  // same server.js is deployed to an always-on host (Render/Railway/Fly/
  // a VPS) instead of — or alongside — the Vercel-hosted REST API.
  const httpServer = devHttpsCreds
    ? https.createServer(devHttpsCreds, app)
    : http.createServer(app);
  const io = attachChatSocket(httpServer, { allowedOrigins });
  app.set("io", io);
  attachCallSocket(httpServer, { allowedOrigins });
  // Hourly run of the automation rules an admin has switched on (all are
  // off by default). Serverless hosting uses /api/automations/cron instead.
  startScheduler();

  // Explicit 0.0.0.0 (not just the implicit default) so the intent is
  // unambiguous: reachable from other devices on the same LAN, not just
  // this machine — needed for local multi-device testing.
  const server = httpServer.listen(PORT, "0.0.0.0", () => {
    const scheme = devHttpsCreds ? "https" : "http";
    console.log(`🚀 Server running on port ${PORT} (${scheme})`);
    const lan = lanIPv4();
    if (lan) console.log(`🌐 LAN: ${scheme}://${lan}:${PORT}  (open ${scheme}://${lan}:5173 on another device)`);
    if (!devHttpsCreds) console.log(`   ⚠️  No dev cert found — camera/mic won't work from a LAN IP. Run ./scripts/generate-dev-cert.sh`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🗄️ Database: ${mongoose.connection.readyState === 1 ? "✅ Connected" : "❌ Connecting"}`);
    console.log(`💬 Socket.IO chat attached`);
    console.log(`📹 Socket.IO class-call signaling attached`);
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