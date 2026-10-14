// ══════════════════════════════════════════════════════════════════
//  Turn an existing single-institute database into institute #1 of the
//  multi-institute platform.
//
//    node scripts/migrateToMultiTenant.mjs --code MAIN --name "My College"            dry run
//    node scripts/migrateToMultiTenant.mjs --code MAIN --name "My College" --apply    do it
//
//  Options: --type school|college|university (default: from Settings)
//
//  What --apply does, in order:
//    1. creates the institute record (or reuses it if the code exists);
//    2. stamps every existing record that has no institute with it;
//    3. replaces globally-unique indexes (roll no, email, codes…) with
//       per-institute ones, so other institutes can reuse the same values.
//  Until step 1 happens the server runs in single-institute mode, exactly
//  as before. TAKE A DATABASE BACKUP FIRST (Atlas: Backup → Take Snapshot).
//  Step 2 can be undone with `$unset: { tenant: "" }` on every collection.
// ══════════════════════════════════════════════════════════════════
import "../src/tenancy/register.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes("--apply");
const CODE = (arg("--code") || "").toUpperCase();
const NAME = arg("--name");

if (!CODE || !NAME) {
  console.error('Usage: node scripts/migrateToMultiTenant.mjs --code MAIN --name "Institute name" [--type college] [--apply]');
  process.exit(1);
}

// Load every model so their (per-institute) index definitions are known.
const srcDir = path.join(__dirname, "..", "src");
for (const f of fs.readdirSync(path.join(srcDir, "models"))) if (f.endsWith(".js")) await import(path.join(srcDir, "models", f));
for (const f of ["services/permissions.js", "services/automations.js", "services/security.js"]) await import(path.join(srcDir, f));
const { Tenant, PlatformOwner } = await import(path.join(srcDir, "models", "Tenant.js"));
const { runUnscoped } = await import(path.join(srcDir, "tenancy", "context.js"));
const { PLATFORM_MODELS } = await import(path.join(srcDir, "tenancy", "plugin.js"));

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
console.log(`\nDatabase: ${db.databaseName}   ${APPLY ? "— APPLYING CHANGES" : "— dry run, nothing will change"}\n`);

await runUnscoped(async () => {
  const existing = await Tenant.findOne({ code: CODE });
  const others = await Tenant.countDocuments({ code: { $ne: CODE } });
  if (!existing && others) console.log(`⚠  ${others} other institute(s) already exist. Untagged records will be assigned to ${CODE}.`);

  // 1 ── untagged records per collection
  const skip = new Set(["tenants", "platformowners"]);
  const plan = [];
  for (const { name } of await db.listCollections().toArray()) {
    if (skip.has(name) || name.startsWith("system.")) continue;
    const n = await db.collection(name).countDocuments({ tenant: { $exists: false } });
    if (n) plan.push([name, n]);
  }
  console.log("Records to assign to the institute:");
  plan.forEach(([n, c]) => console.log(`  ${n.padEnd(26)} ${c}`));
  if (!plan.length) console.log("  (none — everything already belongs to an institute)");

  // 2 ── index changes
  console.log("\nIndex changes (global unique → unique per institute):");
  const indexPlan = [];
  for (const name of mongoose.modelNames()) {
    const Model = mongoose.model(name);
    if (PLATFORM_MODELS.has(name)) continue;
    const exists = (await db.listCollections({ name: Model.collection.collectionName }).toArray()).length > 0;
    if (!exists) continue;
    const diff = await Model.diffIndexes();
    if (diff.toDrop.length || diff.toCreate.length) {
      indexPlan.push(Model);
      console.log(`  ${name.padEnd(22)} drop: ${diff.toDrop.join(", ") || "—"}   create: ${diff.toCreate.map(i => Object.keys(i.key || i).join("+")).join(", ") || "—"}`);
    }
  }
  if (!indexPlan.length) console.log("  (none)");

  if (!APPLY) {
    console.log(`\nInstitute to ${existing ? "reuse" : "create"}: ${NAME} (code ${CODE})`);
    console.log("\nDry run complete. Take a backup, then re-run with --apply.\n");
    return;
  }

  const settings = await db.collection("settings").findOne({ key: "main", tenant: { $exists: false } });
  const tenant = existing || await Tenant.create({ code: CODE, name: NAME, type: arg("--type") || settings?.instituteType || "school" });
  let tagged = 0;
  for (const [name] of plan) tagged += (await db.collection(name).updateMany({ tenant: { $exists: false } }, { $set: { tenant: tenant._id } })).modifiedCount;
  console.log(`\n✅ ${tagged} record(s) assigned to ${tenant.name} (${tenant.code}).`);
  // One collection's index trouble must not stop the others (in particular
  // the old unique roll-no/email indexes must still be replaced).
  let synced = 0;
  for (const Model of indexPlan) {
    try { await Model.syncIndexes(); synced += 1; }
    catch (e) {
      // Same key, different options (e.g. a plain index where a TTL one is
      // now defined): drop the old one by name and try again.
      const m = /existing index: .*?name: "([^"]+)"/.exec(e.message || "");
      if (m) {
        try { await Model.collection.dropIndex(m[1]); await Model.syncIndexes(); synced += 1; continue; } catch (e2) { e = e2; }
      }
      console.log(`⚠  ${Model.modelName}: indexes not updated — ${e.message.split("\n")[0]}`);
    }
  }
  console.log(`✅ Indexes updated on ${synced} of ${indexPlan.length} collection(s).`);
  if (!(await PlatformOwner.exists({}))) console.log("\nNext: create your platform owner login —  node scripts/createPlatformOwner.mjs you@example.com 'a-strong-password'");
  console.log(`\nDone. Users of this institute keep signing in as before if DEFAULT_INSTITUTE_CODE=${tenant.code} is set in .env (or while it is the only institute).\n`);
});
await mongoose.disconnect();
