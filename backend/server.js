// ═══════════════════════════════════════════════════════════════
//  PRODUCTION-READY SERVER.JS
// ═══════════════════════════════════════════════════════════════
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
import { smtpReady, smtpLastError } from "./src/utils/mailer.js";
import http from "http";
import { attachChatSocket } from "./src/socket/chatSocket.js";
// ═══════════════════════════════════════════════════════════════
//  EXPRESS APP SETUP
// ═══════════════════════════════════════════════════════════════

const app = express();

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

    // Allow localhosts with any port (covers some dev setups)
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return callback(null, true);
    } catch (e) {
      // If origin is not a valid URL, deny it below
    }

    // Deny other origins
    return callback(new Error('CORS policy: Origin not allowed'), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
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
connectDB().then(async () => {
  console.log('Initial DB connection succeeded');
  // Run auto-seed if collections are empty
  try {
    const seeder = await import('./src/utils/autoSeed.js');
    await seeder.default();
  } catch (e) {
    console.error('Auto-seed error (non-fatal):', e && e.message);
  }
}).catch((err) => {
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
  const httpServer = http.createServer(app);
  const io = attachChatSocket(httpServer, { allowedOrigins });
  app.set("io", io);

  const server = httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🗄️ Database: ${mongoose.connection.readyState === 1 ? "✅ Connected" : "❌ Connecting"}`);
    console.log(`💬 Socket.IO chat attached`);
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