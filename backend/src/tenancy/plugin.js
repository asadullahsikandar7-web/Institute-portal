import mongoose from "mongoose";
import { getContext } from "./context.js";

// ── Data isolation between institutes ───────────────────────────────────
// Every model (except the platform's own Tenant/PlatformOwner) gets a
// `tenant` field, and every database operation is pinned to the institute
// in the current context:
//
//   reads, counts, updates, deletes   → filter gains { tenant }
//   aggregate pipelines               → start with $match { tenant }
//   new documents / insertMany / bulk → stamped with the tenant
//   unique fields (roll no, email…)   → unique per institute, not globally
//
// It fails closed: an operation with no institute context throws instead
// of silently reading everyone's data. Routes never have to remember any
// of this — which is the point.

export const PLATFORM_MODELS = new Set(["Tenant", "PlatformOwner"]);
const QUERY_OPS = ["find", "findOne", "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace", "countDocuments", "distinct", "updateOne", "updateMany", "deleteOne", "deleteMany", "replaceOne"];

export class TenancyError extends Error {
  constructor(message, status = 500) { super(message); this.status = status; this.name = "TenancyError"; }
}

function scope() {
  const ctx = getContext();
  if (ctx?.unscoped) return null;
  if (!ctx?.tenant) throw new TenancyError("No institute context for this database operation.");
  return ctx.tenant;
}

function stripTenantFromUpdate(update) {
  if (!update || typeof update !== "object") return;
  delete update.tenant;
  for (const op of ["$set", "$setOnInsert", "$unset", "$rename"]) if (update[op]) delete update[op].tenant;
}

function makeUniquePerTenant(schema) {
  for (const [path, type] of Object.entries(schema.paths)) {
    const idx = type._index;
    if (idx && typeof idx === "object" && idx.unique) {
      type._index = null;
      const { unique, ...rest } = idx;
      schema.index({ tenant: 1, [path]: 1 }, { ...rest, unique: true });
    }
  }
  schema._indexes = schema._indexes.map(([fields, options]) =>
    options?.unique && !("tenant" in fields) ? [{ tenant: 1, ...fields }, options] : [fields, options]);
}

function tenantPlugin(schema, modelName) {
  schema.add({ tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", index: true } });
  makeUniquePerTenant(schema);

  schema.pre(QUERY_OPS, function () {
    const tenant = scope();
    if (!tenant) return;
    this.where({ tenant });
    stripTenantFromUpdate(this.getUpdate?.());
  });
  schema.pre("estimatedDocumentCount", function () {
    if (scope()) throw new TenancyError("estimatedDocumentCount can't be limited to one institute — use countDocuments.");
  });
  schema.pre("aggregate", function () {
    const tenant = scope();
    if (tenant) this.pipeline().unshift({ $match: { tenant } });
  });
  schema.pre("validate", function () {
    const ctx = getContext();
    if (ctx?.unscoped) return;
    const tenant = scope();
    if (this.isNew) {
      if (!this.tenant) this.tenant = tenant;
      else if (String(this.tenant) !== String(tenant)) throw new TenancyError("A record can't be created for another institute.", 403);
    } else if (this.isModified("tenant")) {
      throw new TenancyError("A record can't be moved to another institute.", 403);
    }
  });
  schema.pre("save", function () {
    if (!getContext()?.unscoped && !this.tenant) throw new TenancyError("Record has no institute.");
  });
  schema.pre("insertMany", function (next, docs) {
    try {
      const tenant = scope();
      if (tenant) for (const d of Array.isArray(docs) ? docs : [docs]) if (d && typeof d === "object") d.tenant = tenant;
      next();
    } catch (e) { next(e); }
  });
  // bulkWrite has no schema middleware, so the static itself is wrapped.
  schema.statics.bulkWrite = function (ops, options) {
    const tenant = scope();
    if (tenant) {
      for (const op of ops) {
        const [kind] = Object.keys(op);
        const body = op[kind];
        if (kind === "insertOne") body.document = { ...body.document, tenant };
        else { body.filter = { ...(body.filter || {}), tenant }; stripTenantFromUpdate(body.update); if (body.replacement) body.replacement.tenant = tenant; }
      }
    }
    return mongoose.Model.bulkWrite.call(this, ops, options);
  };
  limitHooks(schema, modelName);
}

// Plan limits (e.g. maximum students) are checked where records are born.
const LIMITED = { Student: "maxStudents", Teacher: "maxTeachers" };
function limitHooks(schema, modelName) {
  const key = LIMITED[modelName];
  if (!key) return;
  const check = async (Model, adding) => {
    const ctx = getContext();
    const limit = ctx?.doc?.limits?.[key];
    if (!limit || ctx.unscoped) return;
    const count = await Model.countDocuments();
    if (count + adding > limit) throw new TenancyError(`Your plan allows ${limit} ${modelName === "Student" ? "students" : "teachers"}. Contact the platform administrator to raise the limit.`, 403);
  };
  schema.pre("save", async function () { if (this.isNew) await check(this.constructor, 1); });
  schema.pre("insertMany", async function (next, docs) {
    try { await check(this, Array.isArray(docs) ? docs.length : 1); next(); } catch (e) { next(e); }
  });
}

// Installs the plugin by wrapping mongoose.model(), so it reaches every
// model at compile time — including ones added later — without each model
// file having to opt in. Must run before any model module is imported:
// server.js and the scripts import tenancy/register.js first.
let installed = false;
export function installTenancy() {
  if (installed) return;
  installed = true;
  const original = mongoose.model.bind(mongoose);
  mongoose.model = function (name, schema, ...rest) {
    if (schema && !PLATFORM_MODELS.has(name) && !schema.__tenancy) {
      schema.__tenancy = true;
      tenantPlugin(schema, name);
    }
    return original(name, schema, ...rest);
  };
}
