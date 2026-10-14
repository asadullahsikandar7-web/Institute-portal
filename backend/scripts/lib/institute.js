import { Tenant } from "../../src/models/Tenant.js";
import { runAsTenant, runUnscoped } from "../../src/tenancy/context.js";

// Which institute a command-line script works on.
//   --institute CODE        that institute (created if `create` is given)
//   no flag, no institutes  single-institute mode — runs unscoped, as before
//   no flag, institutes     DEFAULT_INSTITUTE_CODE, or the only one
export function instituteArg() {
  const i = process.argv.indexOf("--institute");
  return i > -1 ? process.argv[i + 1] : null;
}

export async function resolveInstitute({ code = instituteArg(), create = null } = {}) {
  const want = code || process.env.DEFAULT_INSTITUTE_CODE || null;
  if (want) {
    let t = await Tenant.findOne({ code: want.toUpperCase() });
    if (!t && create) t = await Tenant.create({ code: want, ...create });
    if (!t) throw new Error(`No institute with code ${want}.`);
    return t;
  }
  const n = await Tenant.countDocuments();
  if (n === 0) return null;
  if (n === 1) return Tenant.findOne();
  throw new Error("This database has several institutes — pass --institute CODE.");
}

export const inInstitute = (tenant, fn) => (tenant ? runAsTenant(tenant, async () => await fn()) : runUnscoped(async () => await fn()));
