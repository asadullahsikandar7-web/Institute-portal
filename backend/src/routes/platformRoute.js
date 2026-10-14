import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { h, httpError, scalar } from "../utils/crudRouter.js";
import { rateLimit } from "../services/permissions.js";
import { Tenant, PlatformOwner, OPTIONAL_MODULES } from "../models/Tenant.js";
import { runAsTenant, runUnscoped } from "../tenancy/context.js";
import { invalidateTenantCache, isMultiTenant, defaultTenant, findTenant } from "../tenancy/middleware.js";
import { getSettings } from "../models/Settings.js";
import Admin from "../models/adminModel.js";

// Platform owner console: create institutes, suspend them, set plan
// limits and modules, see usage. Owner tokens (role "owner") work only
// here — the tenancy middleware turns them away from institute routes.
const router = express.Router();
const SECRET = process.env.JWT_SECRET || "super_secret_key";

const owner = (req, res, next) => {
  try {
    const decoded = jwt.verify(req.headers.authorization?.split(" ")[1] || "", SECRET);
    if (decoded.role !== "owner") throw new Error();
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: "Platform owner sign-in required." }); }
};

// ── Public ────────────────────────────────────────────────────────────────
router.get("/mode", h(async (req, res) => {
  const multi = await isMultiTenant();
  const def = multi ? await defaultTenant() : null;
  res.json({ multiTenant: multi, defaultInstitute: def ? { code: def.code, name: def.name } : null, platformDomain: process.env.PLATFORM_DOMAIN || null });
}));

router.get("/lookup", rateLimit({ max: 60, windowMs: 60000 }), h(async (req, res) => {
  const t = await findTenant({ code: scalar(req.query.code) || "" });
  if (!t) throw httpError(404, "No institute uses that code.");
  res.json({ code: t.code, name: t.name, type: t.type, status: t.status });
}));

router.post("/login", rateLimit({ max: 10, windowMs: 10 * 60000 }), h(async (req, res) => {
  const o = await PlatformOwner.findOne({ email: String(req.body.email || "").trim().toLowerCase() }).select("+password");
  if (!o || !(await bcrypt.compare(String(req.body.password || ""), o.password))) throw httpError(401, "Invalid email or password.");
  res.json({ token: jwt.sign({ id: o._id, role: "owner", email: o.email }, SECRET, { expiresIn: "8h" }), role: "owner", email: o.email, name: o.name });
}));

// ── Owner only ────────────────────────────────────────────────────────────
router.use(owner);

const count = (model, match = {}) => mongoose.model(model).aggregate([{ $match: match }, { $group: { _id: "$tenant", n: { $sum: 1 } } }]);

router.get("/tenants", h(async (req, res) => {
  const [tenants, students, teachers, staff, admins, activity] = await runUnscoped(async () => Promise.all([
    Tenant.find().sort({ createdAt: -1 }),
    count("Student"), count("Teacher"), count("Staff"), count("Admin"),
    mongoose.model("AuditLog").aggregate([{ $group: { _id: "$tenant", last: { $max: "$at" }, actions30d: { $sum: { $cond: [{ $gte: ["$at", new Date(Date.now() - 30 * 86400000)] }, 1, 0] } } } }]),
  ]));
  const by = (rows, key = "n") => new Map(rows.map(r => [String(r._id), r[key] ?? r]));
  const s = by(students), t = by(teachers), st = by(staff), a = by(admins), act = new Map(activity.map(r => [String(r._id), r]));
  res.json({
    multiTenant: tenants.length > 0,
    modules: OPTIONAL_MODULES,
    tenants: tenants.map(x => ({ ...x.toObject(), usage: { students: s.get(String(x._id)) || 0, teachers: t.get(String(x._id)) || 0, staff: st.get(String(x._id)) || 0, admins: a.get(String(x._id)) || 0, lastActivity: act.get(String(x._id))?.last || null, actions30d: act.get(String(x._id))?.actions30d || 0 } })),
  });
}));

const EDITABLE = ["name", "type", "status", "plan", "modules", "limits", "contactName", "contactEmail", "contactPhone", "subscriptionEnds", "notes"];
function clean(body) {
  const out = {};
  for (const k of EDITABLE) if (body[k] !== undefined) out[k] = body[k];
  if (out.modules) out.modules = out.modules.filter(m => OPTIONAL_MODULES.includes(m));
  if (out.limits) out.limits = { maxStudents: Number(out.limits.maxStudents) > 0 ? Number(out.limits.maxStudents) : null, maxTeachers: Number(out.limits.maxTeachers) > 0 ? Number(out.limits.maxTeachers) : null };
  if (out.subscriptionEnds === "") out.subscriptionEnds = null;
  return out;
}

// Creates the institute, its first (super) admin and its settings in one go.
router.post("/tenants", h(async (req, res) => {
  const { code, adminEmail, adminPassword } = req.body;
  if (!code || !req.body.name) throw httpError(400, "Institute name and code are required.");
  if (!adminEmail || String(adminPassword || "").length < 8) throw httpError(400, "Give the first administrator's email and a password of at least 8 characters.");
  if (await Tenant.exists({ code: String(code).trim().toUpperCase() })) throw httpError(409, "That institute code is already taken.");
  // The first institute must come from migrating existing data, or that
  // data would become invisible to everyone the moment isolation switches on.
  if (!(await Tenant.exists({})) && (await runUnscoped(async () => (await Admin.exists({ tenant: { $exists: false } })) || (await mongoose.model("Student").exists({ tenant: { $exists: false } }))))) {
    throw httpError(409, "This database still holds single-institute data. Run backend/scripts/migrateToMultiTenant.mjs first so that data becomes your first institute.");
  }
  const tenant = await Tenant.create({ ...clean(req.body), code });
  try {
    await runAsTenant(tenant, async () => {
      await Admin.create({ email: String(adminEmail).trim().toLowerCase(), password: adminPassword, isSuperAdmin: true, name: req.body.contactName || "Administrator" });
      const s = await getSettings();
      s.instituteName = tenant.name;
      s.instituteType = tenant.type;
      await s.save();
    });
  } catch (e) {
    await Tenant.deleteOne({ _id: tenant._id });
    throw e;
  }
  invalidateTenantCache();
  res.status(201).json(tenant);
}));

router.patch("/tenants/:id", h(async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) throw httpError(404, "Institute not found");
  tenant.set(clean(req.body));
  await tenant.save();
  if (req.body.name || req.body.type) {
    await runAsTenant(tenant, async () => {
      const s = await getSettings();
      if (req.body.name) s.instituteName = tenant.name;
      if (req.body.type) s.instituteType = tenant.type;
      await s.save();
    });
  }
  invalidateTenantCache();
  res.json(tenant);
}));

// Lets the owner recover an institute whose admins are locked out.
router.post("/tenants/:id/admin-password", h(async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) throw httpError(404, "Institute not found");
  if (String(req.body.password || "").length < 8) throw httpError(400, "Password must be at least 8 characters.");
  const email = String(req.body.email || "").trim().toLowerCase();
  const updated = await runAsTenant(tenant, async () => {
    const admin = await Admin.findOne({ email });
    if (!admin) return null;
    admin.password = req.body.password; // hashed by the Admin pre-save hook
    admin.totpEnabled = false; // locked out usually means the phone is gone too
    await admin.save();
    await Admin.updateOne({ _id: admin._id }, { totpSecret: null, totpLastWindow: null });
    return admin.email;
  });
  if (!updated) throw httpError(404, "No admin with that email in this institute.");
  res.json({ reset: updated });
}));

export default router;
