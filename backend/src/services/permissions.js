import mongoose from "mongoose";
import { peekUser } from "../middleware/auth.js";
import { getContext } from "../tenancy/context.js";

// ── Admin sub-roles ─────────────────────────────────────────────────────
// Every route in this app gates on the coarse role in the JWT ("admin",
// "teacher", "student", "parent"). That's too blunt for staff accounts: a
// librarian shouldn't be able to waive fees. Rather than rewrite ~40 route
// files, admin sub-roles are enforced in ONE place — the moduleGuard
// middleware below, mounted ahead of all /api routes — by mapping URL
// prefixes to modules. "admin" (the default, and what every pre-existing
// account has) and super admins are unrestricted.
export const OPTIONAL_PLAN_MODULES = new Set(["admissions", "exams", "finance", "payroll", "hr", "library", "campus", "engage", "lifecycle", "ai"]);

export const ADMIN_ROLE_MODULES = {
  admin: "*",
  registrar: ["admissions", "students", "academics", "exams", "engage", "lifecycle"],
  accountant: ["finance", "payroll"],
  librarian: ["library"],
  hr: ["hr", "payroll"],
  warden: ["campus"],
  frontdesk: ["admissions", "engage", "campus"],
};

// Longest prefix wins. "system" is never granted to a sub-role.
const PATH_MODULES = [
  ["/api/admin", "system"],
  ["/api/automations", "system"],
  ["/api/ops/substitutions", "academics"],
  ["/api/system/audit", "system"],
  ["/api/hr/payroll", "payroll"],
  ["/api/hr", "hr"],
  ["/api/finance", "finance"],
  ["/api/fees", "finance"],
  ["/api/admissions", "admissions"],
  ["/api/results", "exams"],
  ["/api/examsuite", "exams"],
  ["/api/success", "lifecycle"],
  ["/api/smart/timetable", "academics"],
  ["/api/smart/surveys", "exams"],
  ["/api/exams", "exams"],
  ["/api/grades", "exams"],
  ["/api/library", "library"],
  ["/api/campus", "campus"],
  ["/api/engage", "engage"],
  ["/api/lifecycle", "lifecycle"],
  ["/api/students", "students"],
  ["/api/enrollments", "students"],
  ["/api/parents", "students"],
  ["/api/auth/set-student-password", "students"],
  ["/api/academic-sessions", "academics"],
  ["/api/programs", "academics"],
  ["/api/sections", "academics"],
  ["/api/subjects", "academics"],
  ["/api/teachers", "academics"],
  ["/api/teacher-assignments", "academics"],
  ["/api/schedule", "academics"],
  ["/api/rooms", "academics"],
  ["/api/classes", "academics"],
  ["/api/timetable", "academics"],
  ["/api/attendance", "academics"],
  ["/api/subject-attendance", "academics"],
].sort((a, b) => b[0].length - a[0].length);

// Reference data any staff account needs to read to do its own job (the
// librarian picks a student to issue a book to, the accountant filters
// fees by program) — reads allowed, writes still need the module.
const READABLE_BY_ALL_STAFF = new Set(["students", "academics", "engage"]);

export function moduleFor(path) {
  const hit = PATH_MODULES.find(([prefix]) => path === prefix || path.startsWith(prefix + "/"));
  return hit ? hit[1] : null;
}

export function adminCan(user, module) {
  if (!user || user.role !== "admin") return false;
  if (user.isSuperAdmin) return true;
  const allowed = ADMIN_ROLE_MODULES[user.adminRole || "admin"];
  if (allowed === "*") return true;
  return !!allowed && allowed.includes(module);
}

// Parents are a role the older routes were never written with in mind —
// several of them branch `role === "student" ? … : <treat as admin>`. So a
// parent token is confined to an explicit allow-list instead of being
// trusted to fall through those branches safely.
const PARENT_ALLOWED = ["/api/parent-portal", "/api/engage/calendar", "/api/engage/tickets", "/api/system/public", "/api/auth/change-password", "/api/smart/inbox", "/api/smart/claims", "/api/ops/meetings", "/api/system/institute"];

// Modules an institute's plan can switch off (platform owner console).
// Checked for every role, before any role-specific rule.
const PLAN_PATHS = [["/api/ai", "ai"]];
export function planModuleFor(path) {
  const hit = PLAN_PATHS.find(([p]) => path === p || path.startsWith(p + "/"));
  return hit ? hit[1] : moduleFor(path);
}

export function moduleGuard(req, res, next) {
  const path = req.path.replace(/\/+$/, "");
  const institute = getContext()?.doc;
  const planModule = planModuleFor(path);
  if (institute && planModule && OPTIONAL_PLAN_MODULES.has(planModule) && !institute.modules.includes(planModule)) {
    return res.status(403).json({ error: "This feature isn't part of your institute's plan.", notInPlan: planModule });
  }
  const user = peekUser(req);
  if (!user) return next(); // unauthenticated → each route's own auth() answers

  if (user.role === "parent") {
    const ok = PARENT_ALLOWED.some(p => path === p || path.startsWith(p + "/"));
    return ok ? next() : res.status(403).json({ error: "Not available in the parent portal." });
  }
  if (user.role !== "admin") return next();

  const module = moduleFor(path);
  if (!module || adminCan(user, module)) return next();
  if (req.method === "GET" && READABLE_BY_ALL_STAFF.has(module)) return next();
  return res.status(403).json({ error: `Your account role (${user.adminRole}) does not have access to the ${module} module.` });
}

// ── Audit trail ─────────────────────────────────────────────────────────
const auditSchema = new mongoose.Schema(
  {
    actorId: { type: String, default: null },
    actorRole: { type: String, default: "anonymous" },
    actorLabel: { type: String, default: "" },
    method: String,
    path: String,
    module: { type: String, default: "" },
    status: Number,
    ip: String,
    // Field NAMES only — never values. Request bodies carry passwords,
    // marks and bank details; the trail records that they changed, not what to.
    fields: [String],
    at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
auditSchema.index({ at: -1 });
auditSchema.index({ actorId: 1, at: -1 });
export const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditSchema);

// High-volume, low-value writes that would bury the meaningful entries.
const AUDIT_SKIP = ["/api/chat", "/api/ai", "/api/feedback"];

// Records every state-changing API call. The entry is written BEFORE the
// response is released (res.json is wrapped) rather than on the "finish"
// event: on Vercel's serverless runtime the function can be frozen the
// moment the response is sent, so a post-response write is routinely lost
// (same reason the welcome-email sends in studentRoute.js are awaited).
export function auditTrail(req, res, next) {
  if (req.method === "GET" || req.method === "OPTIONS" || !req.path.startsWith("/api/")) return next();
  if (AUDIT_SKIP.some(p => req.path.startsWith(p))) return next();

  const send = res.json.bind(res);
  let written = false;
  res.json = (payload) => {
    if (written || mongoose.connection.readyState !== 1) return send(payload);
    written = true;
    const user = req.user || peekUser(req);
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const isLogin = req.path.includes("login");
    AuditLog.create({
      actorId: user?.id ? String(user.id) : null,
      actorRole: user?.role || "anonymous",
      actorLabel: user?.email || (isLogin ? String(body.email || body.rollNo || "").slice(0, 120) : ""),
      method: req.method,
      path: req.path.slice(0, 300),
      module: moduleFor(req.path) || req.path.split("/")[2] || "",
      status: res.statusCode,
      ip: req.ip,
      fields: Object.keys(body).slice(0, 40),
    })
      .catch(e => console.error("Audit write failed:", e.message))
      .finally(() => send(payload));
    return res;
  };
  next();
}

// ── Brute-force throttle ────────────────────────────────────────────────
// In-memory fixed window per IP+route. On a single long-running server
// this is exact; on serverless each warm instance keeps its own counters,
// so it slows credential stuffing rather than strictly capping it — a
// shared store (Redis/Upstash) is the upgrade path if that matters.
export function rateLimit({ windowMs = 10 * 60 * 1000, max = 15, message = "Too many attempts. Please wait a few minutes and try again." } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}|${req.baseUrl}${req.path}`;
    let entry = hits.get(key);
    if (!entry || entry.reset < now) entry = { count: 0, reset: now + windowMs };
    entry.count += 1;
    hits.set(key, entry);
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

export function securityHeaders(req, res, next) {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
}
