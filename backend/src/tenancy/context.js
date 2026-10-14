import { AsyncLocalStorage } from "async_hooks";

// Which institute the current piece of work belongs to. Set once per
// request (tenancy/middleware.js), per socket event, per scheduled job —
// and read by the database plugin (tenancy/plugin.js), which refuses to
// touch institute data without it.
//
//   { tenant: ObjectId, code, doc }  → scoped to one institute
//   { unscoped: true }               → platform-level work (owner console,
//                                       migrations, or single-institute
//                                       "legacy" mode before migration)
//
// Mongoose queries are lazy: they run when awaited, not when built. So the
// function passed to runAsTenant/runUnscoped must await its queries inside
// — `runUnscoped(() => Model.find())` returns an unexecuted query that then
// runs OUTSIDE the context (and is refused). Use `async () => await …`.
const als = new AsyncLocalStorage();

export const getContext = () => als.getStore() || null;
export const runInContext = (ctx, fn) => als.run(ctx, fn);
export const runUnscoped = (fn) => als.run({ unscoped: true }, fn);
export const runAsTenant = (tenantDoc, fn) => als.run({ tenant: tenantDoc._id, code: tenantDoc.code, doc: tenantDoc }, fn);
