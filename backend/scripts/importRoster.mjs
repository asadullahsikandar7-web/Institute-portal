// ══════════════════════════════════════════════════════════════════
//  Import a whole-school admission sheet (CSV) into one institute.
//
//    node scripts/importRoster.mjs --file imports/city-campus.csv --institute CITY            dry run
//    node scripts/importRoster.mjs --file imports/city-campus.csv --institute CITY --apply    import
//
//  Create the institute in the same step (multi-institute databases):
//    --create "City Campus" [--type school] --admin-email you@x.com --admin-password '…'
//  Other options: --session 2026-27  (default: the sheet's most common academicYear)
//                 --passwords old-logins.csv  reuse the passwords in an earlier logins file
//
//  The same import is available to an institute admin under People →
//  Bulk Import. Writes <file>-logins.csv with each student's roll number
//  and one-time password — hand these out, then delete the file.
// ══════════════════════════════════════════════════════════════════
import "../src/tenancy/register.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes("--apply");
const file = arg("--file");
if (!file) { console.error("Usage: node scripts/importRoster.mjs --file sheet.csv --institute CODE [--create \"Name\" --admin-email … --admin-password …] [--apply]"); process.exit(1); }

function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some(x => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row);
  const head = rows[0].map(h => h.trim().replace(/^﻿/, ""));
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
}

const rows = parseCsv(fs.readFileSync(file, "utf8"));
const { importRoster } = await import("../src/services/rosterImport.js");
const { Tenant } = await import("../src/models/Tenant.js");
const { runAsTenant, runUnscoped } = await import("../src/tenancy/context.js");
const { getSettings } = await import("../src/models/Settings.js");
const Admin = (await import("../src/models/adminModel.js")).default;

await mongoose.connect(process.env.MONGO_URI);
console.log(`\nDatabase ${mongoose.connection.name} · ${rows.length} rows in ${file} · ${APPLY ? "IMPORTING" : "dry run — nothing will be written"}\n`);

try {
  const code = (arg("--institute") || "").toUpperCase();
  const multi = await Tenant.exists({});
  let tenant = code ? await Tenant.findOne({ code }) : null;
  if (!tenant && arg("--create")) {
    if (!multi && (await runUnscoped(async () => (await Admin.exists({})) ))) throw new Error("This database is still single-institute. Run scripts/migrateToMultiTenant.mjs first, or import into the existing institute by leaving out --institute/--create.");
    if (!code) throw new Error("Give the new institute a code with --institute CODE.");
    if (!arg("--admin-email") || String(arg("--admin-password") || "").length < 8) throw new Error("Creating an institute needs --admin-email and an --admin-password of 8+ characters.");
    if (APPLY) {
      tenant = await Tenant.create({ code, name: arg("--create"), type: arg("--type") || "school" });
      await runAsTenant(tenant, async () => {
        await Admin.create({ email: arg("--admin-email").toLowerCase(), password: arg("--admin-password"), isSuperAdmin: true, name: "Administrator" });
        const s = await getSettings(); s.instituteName = tenant.name; s.instituteType = tenant.type; await s.save();
      });
      console.log(`🏫 Created institute ${tenant.name} (${tenant.code}) with admin ${arg("--admin-email")}`);
    } else console.log(`Would create institute ${arg("--create")} (${code}) with admin ${arg("--admin-email")}`);
  } else if (code && !tenant) throw new Error(`No institute with code ${code} (add --create "Name" to create it).`);
  else if (!code && multi) throw new Error("This database has institutes — pass --institute CODE.");

  const passwords = {};
  if (arg("--passwords")) for (const p of parseCsv(fs.readFileSync(arg("--passwords"), "utf8"))) if (p["Roll No (login)"] && p["One-time password"]) passwords[`${p["Roll No (login)"]}|${p.Name}`] = p["One-time password"];
  if (arg("--passwords")) console.log(`Reusing ${Object.keys(passwords).length} passwords from ${arg("--passwords")}`);
  const run = async () => await importRoster(rows, { session: arg("--session"), passwords, dryRun: !APPLY || !tenant && !!arg("--create") });
  const out = tenant ? await runAsTenant(tenant, run) : await runUnscoped(run);
  if (out.error) throw new Error(out.error);

  console.log(`Session: ${out.session}`);
  console.log(`Classes: ${out.classes.map(c => `${c.name} [${c.code}] ${c.sections.map(s => `${s.name}:${s.students}`).join(" ")}`).join("  ·  ")}`);
  console.log(`Students: ${out.students} · families: ${out.families} (${out.familiesWithSiblings} with siblings)`);
  console.log(`Missing in the sheet: ${Object.entries(out.missing).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  const levels = ["error", "skip", "check", "fixed", "warn", "info"];
  for (const lv of levels) {
    const list = out.warnings.filter(w => w.level === lv);
    if (!list.length) continue;
    console.log(`\n${lv.toUpperCase()} (${list.length})`);
    list.forEach(w => console.log(`  ${w.line ? `line ${w.line}: ` : ""}${w.message}`));
  }
  if (!out.dryRun && !out.credentials.length) console.log("\nNothing new to import — every student in the sheet is already in the system.");
  else if (!out.dryRun) {
    // A new file each run: one-time passwords exist nowhere else, so an
    // earlier logins file must never be overwritten.
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    const loginFile = file.replace(/\.csv$/i, "") + `-logins-${stamp}.csv`;
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    fs.writeFileSync(loginFile, ["Name,Father,Class,Section,Roll No (login),One-time password", ...out.credentials.map(c => [c.name, c.fatherName, c.className, c.section, c.rollNo, c.password].map(esc).join(","))].join("\n"));
    console.log(`\n✅ Imported ${out.credentials.length} students, ${out.parentsCreated} family records. Logins written to ${loginFile}`);
  } else console.log("\nDry run complete — re-run with --apply to import.");
} catch (e) {
  console.error("\n❌ " + e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
