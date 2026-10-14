import express from "express";
import { authAny } from "../middleware/auth.js";

// Shared plumbing for the ERP modules (finance, HR, library, campus, …).
// The older academic routes each hand-roll their own try/catch + CRUD; the
// ERP layer adds ~30 more collections, so the repeated parts live here once.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const httpError = (status, message) => new HttpError(status, message);

// Wraps an async handler so a thrown error becomes the same
// `{ error: message }` JSON shape every existing route responds with.
export const h = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err?.name === "ValidationError") {
      return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join(", ") });
    }
    if (err?.name === "CastError") return res.status(400).json({ error: `Invalid ${err.path}` });
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {}).join(", ") || "value";
      return res.status(409).json({ error: `Duplicate ${field} — a record with that value already exists.` });
    }
    console.error("❌", req.method, req.originalUrl, err);
    res.status(500).json({ error: err.message || "Server error" });
  }
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Query-string values are attacker-controlled and Express parses
// `?status[$ne]=x` into an object — only ever accept plain scalars.
export const scalar = (v) => (v === undefined || v === null || typeof v === "object" ? undefined : String(v));

export function pick(body = {}, fields) {
  const out = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f] === "" ? null : body[f];
  return out;
}

// crudRouter(Model, opts) → Router with GET / · GET /:id · POST / · PATCH /:id · DELETE /:id
//   read / write  role lists (default admin-only)
//   fields        writable field whitelist (defaults to every schema path)
//   filters       query params allowed as exact-match filters
//   search        fields matched by ?q=
//   scope(req)    extra mongo filter merged into every read/write lookup
//   readOnly      register only the two GET routes
//   softDelete    { field, value } — DELETE sets this instead of removing
//   beforeCreate / beforeUpdate / beforeDelete / afterCreate hooks
export function crudRouter(Model, opts = {}) {
  const {
    read = ["admin"],
    write = ["admin"],
    populate = [],
    search = [],
    filters = [],
    sort = { createdAt: -1 },
    softDelete = null,
    readOnly = false,
    scope = null,
    limit = 1000,
    beforeCreate,
    beforeUpdate,
    beforeDelete,
    afterCreate,
  } = opts;
  const fields = opts.fields || Object.keys(Model.schema.paths).filter(p => !["_id", "__v", "createdAt", "updatedAt"].includes(p) && !p.includes("."));
  const router = express.Router();
  const scoped = async (req) => (scope ? (await scope(req)) || {} : {});

  router.get("/", authAny(...read), h(async (req, res) => {
    const filter = await scoped(req);
    for (const f of filters) {
      const v = scalar(req.query[f]);
      if (v !== undefined && v !== "") filter[f] = v;
    }
    const q = scalar(req.query.q);
    if (q && search.length) {
      const rx = new RegExp(escapeRegex(q.trim()), "i");
      filter.$or = search.map(f => ({ [f]: rx }));
    }
    const lim = Math.min(Number(scalar(req.query.limit)) || limit, limit);
    const page = Math.max(Number(scalar(req.query.page)) || 1, 1);
    const docs = await Model.find(filter).populate(populate).sort(sort).skip((page - 1) * lim).limit(lim);
    res.json(docs);
  }));

  router.get("/:id", authAny(...read), h(async (req, res) => {
    const doc = await Model.findOne({ _id: req.params.id, ...(await scoped(req)) }).populate(populate);
    if (!doc) throw httpError(404, "Not found");
    res.json(doc);
  }));

  if (readOnly) return router;

  router.post("/", authAny(...write), h(async (req, res) => {
    let data = pick(req.body, fields);
    if (beforeCreate) data = (await beforeCreate(data, req)) || data;
    const doc = await Model.create(data);
    if (afterCreate) await afterCreate(doc, req);
    res.status(201).json(await doc.populate(populate));
  }));

  router.patch("/:id", authAny(...write), h(async (req, res) => {
    const doc = await Model.findOne({ _id: req.params.id, ...(await scoped(req)) });
    if (!doc) throw httpError(404, "Not found");
    let data = pick(req.body, fields);
    if (beforeUpdate) data = (await beforeUpdate(data, req, doc)) || data;
    doc.set(data);
    await doc.save();
    res.json(await doc.populate(populate));
  }));

  router.delete("/:id", authAny(...write), h(async (req, res) => {
    const doc = await Model.findOne({ _id: req.params.id, ...(await scoped(req)) });
    if (!doc) throw httpError(404, "Not found");
    if (beforeDelete) await beforeDelete(doc, req);
    if (softDelete) {
      doc.set(softDelete.field, softDelete.value);
      await doc.save();
      return res.json({ message: "Archived", doc });
    }
    await doc.deleteOne();
    res.json({ message: "Deleted" });
  }));

  return router;
}
