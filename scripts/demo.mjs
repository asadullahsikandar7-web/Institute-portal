// ══════════════════════════════════════════════════════════════════
//  ACADEXA — one-command local demo:   npm run demo
//
//  Starts a private MongoDB in ./.demo/db, fills it with the demo
//  dataset, then runs the API and the web app against it and prints the
//  test logins. Nothing here reads or writes the database in
//  backend/.env — every child process gets an explicit local MONGO_URI
//  (and a dead SMTP host, so no email can leave this machine).
//
//    npm run demo            start (re-seeds a fresh demo each time)
//    npm run demo -- --keep  start without re-seeding (keep your changes)
//  Stop with Ctrl+C.
// ══════════════════════════════════════════════════════════════════
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const KEEP = process.argv.includes("--keep");
const MONGO_PORT = 27117;
const MONGO_URI = `mongodb://127.0.0.1:${MONGO_PORT}/acadexa_demo`;
const children = [];
const stop = (code = 0) => { children.forEach(c => { try { c.kill(); } catch { /* already gone */ } }); process.exit(code); };
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

const listening = (port) => new Promise(r => { const s = net.connect(port, "127.0.0.1"); s.once("connect", () => { s.destroy(); r(true); }); s.once("error", () => r(false)); });
const freePort = async (preferred) => {
  if (!(await listening(preferred))) return preferred;
  return new Promise(r => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
};
const waitFor = async (port, label, seconds = 40) => {
  for (let i = 0; i < seconds * 2; i++) { if (await listening(port)) return; await new Promise(r => setTimeout(r, 500)); }
  console.error(`✖ ${label} did not start on port ${port}.`); stop(1);
};
// Explicit values win over backend/.env (dotenv never overrides).
const env = (extra = {}) => ({ ...process.env, MONGO_URI, NODE_ENV: "development", SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", VERCEL: "", ACADEXA_HTTP: "1",
  // Two institutes are seeded; DEMO is the default so its users need no code.
  DEFAULT_INSTITUTE_CODE: "DEMO", ...extra });

console.log("\n  ACADEXA demo\n");

// 1 ── MongoDB ───────────────────────────────────────────────────────────────
if (await listening(MONGO_PORT)) {
  console.log(`  • MongoDB already running on ${MONGO_PORT}`);
} else {
  if (spawnSync("mongod", ["--version"]).error) {
    console.error("  ✖ `mongod` was not found. Install MongoDB Community (macOS: brew install mongodb-community) and run this again.");
    process.exit(1);
  }
  const dbpath = path.join(root, ".demo", "db");
  fs.mkdirSync(dbpath, { recursive: true });
  children.push(spawn("mongod", ["--dbpath", dbpath, "--port", String(MONGO_PORT), "--bind_ip", "127.0.0.1", "--quiet"], { stdio: "ignore" }));
  await waitFor(MONGO_PORT, "MongoDB");
  console.log(`  • MongoDB started (data in .demo/db)`);
}

// 2 ── Demo data ─────────────────────────────────────────────────────────────
let logins = "";
if (!KEEP) {
  // Start from an empty demo database (the private one in .demo, never the
  // database in backend/.env) so it is always seeded as a fresh
  // multi-institute platform, whatever an older demo left behind.
  const wipe = spawnSync(process.execPath, ["--input-type=module", "-e", `import m from "mongoose"; await m.connect(${JSON.stringify(MONGO_URI)}); await m.connection.dropDatabase(); await m.disconnect();`], { cwd: backend, encoding: "utf8" });
  if (wipe.status !== 0) { console.error(wipe.stderr); stop(1); }
  console.log("  • Seeding the demo dataset…");
  const seed = spawnSync(process.execPath, ["scripts/seedDemo.js"], { cwd: backend, env: env(), encoding: "utf8" });
  if (seed.status !== 0) { console.error(seed.stdout + seed.stderr); stop(1); }
  logins = seed.stdout.slice(seed.stdout.indexOf("── Demo login credentials"));
}

// 3 ── API + web app ─────────────────────────────────────────────────────────
const apiPort = await freePort(5099);
const webPort = await freePort(5199);
// Server output goes to .demo/api.log — it includes an expected "SMTP
// verification failed" line, since email is deliberately disabled here.
fs.mkdirSync(path.join(root, ".demo"), { recursive: true });
const apiLog = fs.openSync(path.join(root, ".demo", "api.log"), "w");
children.push(spawn(process.execPath, ["server.js"], { cwd: backend, env: env({ PORT: String(apiPort) }), stdio: ["ignore", apiLog, apiLog] }));
await waitFor(apiPort, "The API");
children.push(spawn(path.join(root, "node_modules", ".bin", "vite"), ["--port", String(webPort), "--strictPort"], { cwd: root, env: env({ VITE_API_PORT: String(apiPort) }), stdio: ["ignore", "ignore", "inherit"] }));
await waitFor(webPort, "The web app");

console.log(`  • API on :${apiPort}, web app on :${webPort}  (API log: .demo/api.log)\n`);
console.log(`  ▶ Open  http://localhost:${webPort}`);
console.log("\n" + (logins || "  (kept existing demo data — logins are unchanged; see README.md)\n"));
console.log(`  Platform owner console:  http://localhost:${webPort}/platform`);
console.log("  Second institute: on the login page choose “Change” and enter code RIVERSIDE");
console.log("  Other things to try:  /apply (public admission form)   /verify (certificate check)   Ctrl+K anywhere");
console.log("  Press Ctrl+C to stop.\n");
