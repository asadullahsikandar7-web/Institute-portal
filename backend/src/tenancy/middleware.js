import mongoose from "mongoose";
import { Tenant } from "../models/Tenant.js";
import { peekUser } from "../middleware/auth.js";
import { getContext, runAsTenant, runUnscoped } from "./context.js";

// ── Which institute is this request for? ────────────────────────────────
//   signed in      → the institute in the token (cannot be overridden)
//   not signed in  → X-Institute header (institute code), else the
//                    subdomain (riverside.<PLATFORM_DOMAIN>), else the
//                    default institute (DEFAULT_INSTITUTE_CODE, or the only
//                    one when there is just one)
//
// "Single-institute mode": until the first institute record exists (i.e.
// before scripts/migrateToMultiTenant.mjs has been run on an existing
// database) everything runs unscoped, exactly as before multi-tenancy.

let ready = Promise.resolve();
export const setTenancyReady = (p) => { ready = p; };

const TTL = 30000;
const cache = { count: null, countAt: 0, byKey: new Map() };
export function invalidateTenantCache() { cache.count = null; cache.byKey.clear(); }

export async function isMultiTenant() {
  if (cache.count === null || Date.now() - cache.countAt > TTL) {
    cache.count = await Tenant.countDocuments();
    cache.countAt = Date.now();
  }
  return cache.count > 0;
}

export async function findTenant({ id, code }) {
  const key = id ? `id:${id}` : `code:${String(code).toUpperCase()}`;
  const hit = cache.byKey.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.doc;
  let doc = null;
  if (id && mongoose.Types.ObjectId.isValid(id)) doc = await Tenant.findById(id);
  else if (code) doc = await Tenant.findOne({ code: String(code).trim().toUpperCase() });
  cache.byKey.set(key, { doc, at: Date.now() });
  return doc;
}

export async function defaultTenant() {
  if (process.env.DEFAULT_INSTITUTE_CODE) return findTenant({ code: process.env.DEFAULT_INSTITUTE_CODE });
  if (!(await isMultiTenant())) return null;
  if (cache.count === 1) {
    const hit = cache.byKey.get("only");
    if (hit && Date.now() - hit.at < TTL) return hit.doc;
    const doc = await Tenant.findOne();
    cache.byKey.set("only", { doc, at: Date.now() });
    return doc;
  }
  return null;
}

export function codeFromHost(host) {
  const domain = (process.env.PLATFORM_DOMAIN || "").toLowerCase().replace(/^\./, "");
  const h = String(host || "").toLowerCase().split(":")[0];
  if (!domain || !h.endsWith("." + domain)) return null;
  const sub = h.slice(0, -(domain.length + 1));
  return sub && !sub.includes(".") && !["www", "app", "api"].includes(sub) ? sub : null;
}

// Paths that are about the platform itself, not one institute.
const PLATFORM_PATHS = ["/api/platform", "/api/automations/cron"];

export function tenantContext(req, res, next) {
  (async () => {
    await ready;
    if (!req.path.startsWith("/api/")) return next();
    if (!(await isMultiTenant())) return runUnscoped(next);

    const user = peekUser(req);
    if (PLATFORM_PATHS.some(p => req.path === p || req.path.startsWith(p + "/"))) return runUnscoped(next);
    if (user?.role === "owner") return res.status(403).json({ error: "The platform owner account manages institutes from the platform console." });

    const code = req.get("x-institute") || codeFromHost(req.get("x-forwarded-host") || req.get("host"));
    let tenant;
    if (user) {
      tenant = user.tenant ? await findTenant({ id: user.tenant }) : await defaultTenant();
      if (!tenant) return res.status(401).json({ error: "Your session is no longer valid. Please sign in again." });
      if (code && String(code).toUpperCase() !== tenant.code) return res.status(403).json({ error: "You are signed in to a different institute. Sign out first.", instituteMismatch: true });
    } else {
      tenant = code ? await findTenant({ code }) : await defaultTenant();
      if (!tenant) {
        return code
          ? res.status(404).json({ error: "No institute uses that code. Check it and try again.", instituteRequired: true })
          : res.status(400).json({ error: "Enter your institute code to continue.", instituteRequired: true });
      }
    }
    if (tenant.status !== "active") return res.status(403).json({ error: "This institute's account is suspended. Please contact the platform administrator.", suspended: true });
    req.tenant = tenant;
    runAsTenant(tenant, next);
  })().catch(next);
}

// Re-enter the request's institute after middleware that resumes from a
// stream callback (multer file uploads), where async context is lost.
export function reenterTenant(req, res, next) {
  if (getContext()) return next();
  return req.tenant ? runAsTenant(req.tenant, next) : runUnscoped(next);
}

// JWT claims + login response block for the current institute.
export function tenantClaims() {
  const ctx = getContext();
  return ctx?.tenant ? { tenant: String(ctx.tenant), institute: ctx.code } : {};
}
export function instituteInfo() {
  const t = getContext()?.doc;
  return t ? { code: t.code, name: t.name, type: t.type, plan: t.plan, modules: t.modules } : null;
}

// Runs fn once per active institute (scheduled jobs), or once unscoped in
// single-institute mode.
export async function forEachTenant(fn) {
  await ready;
  if (!(await isMultiTenant())) return [await runUnscoped(async () => await fn(null))];
  const out = [];
  for (const t of await Tenant.find({ status: "active" })) {
    try { out.push(await runAsTenant(t, async () => await fn(t))); }
    catch (e) { out.push({ tenant: t.code, error: e.message }); }
  }
  return out;
}
