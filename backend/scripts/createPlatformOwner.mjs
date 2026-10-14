// Create (or reset the password of) a platform owner login — the account
// that creates and manages institutes at /platform.
//
//   node scripts/createPlatformOwner.mjs you@example.com 'a-strong-password'
import "../src/tenancy/register.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 10) {
  console.error("Usage: node scripts/createPlatformOwner.mjs you@example.com 'password-of-10+-characters'");
  process.exit(1);
}
const { PlatformOwner } = await import("../src/models/Tenant.js");
await mongoose.connect(process.env.MONGO_URI);
const r = await PlatformOwner.updateOne({ email: email.toLowerCase() }, { $set: { password: await bcrypt.hash(password, 10) } }, { upsert: true });
console.log(r.upsertedCount ? `✅ Platform owner ${email} created.` : `✅ Password reset for platform owner ${email}.`);
console.log("Sign in at /platform on the web app.");
await mongoose.disconnect();
