import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import authRoutes from "./src/routes/auth.js";
import studentRoutes from "./src/routes/studentroute.js";
import attendanceRoutes from "./src/routes/attendanceRoute.js";
import leaveRoutes from "./src/routes/leaveroutes.js";
import notificationRoutes from "./src/routes/notificationRoute.js";
import classRoutes from "./src/routes/classRoute.js";
import parentMessageRoutes from "./src/routes/parentMessageRoute.js";

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/attendance");

const PORT = process.env.PORT || 5001;

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/parent-messages", parentMessageRoutes);

// Start server with error handling for port conflicts
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use`);
    console.error("Possible solutions:");
    console.error(`  1. Kill the existing process: taskkill /PID <PID> /F`);
    console.error(`  2. Use a different port: PORT=5002 npm run dev`);
    process.exit(1);
  } else {
    throw err;
  }
});