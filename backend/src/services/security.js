import crypto from "crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// ── TOTP (RFC 6238) ─────────────────────────────────────────────────────
// The standard authenticator-app algorithm (Google Authenticator, Microsoft
// Authenticator, Authy, 1Password…): HMAC-SHA1 over the 30-second window
// number, 6 digits. Implemented here directly rather than pulling in a
// dependency — it is a dozen lines and fully specified.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buf) {
  let bits = "", out = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}
export function base32Decode(str) {
  const bits = str.replace(/=+$/, "").toUpperCase().split("").map(c => { const v = B32.indexOf(c); if (v < 0) throw new Error("bad base32"); return v.toString(2).padStart(5, "0"); }).join("");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export function totpAt(secret, window) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(window));
  const h = crypto.createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1000000)).padStart(6, "0");
}
export const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

// Accepts the current window and one either side (clock drift). Returns the
// matched window so the caller can refuse a code that was already used.
export function verifyTotp(secret, code, now = Date.now()) {
  const c = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(c) || !secret) return null;
  const w = Math.floor(now / 30000);
  for (const d of [0, -1, 1]) {
    const expected = totpAt(secret, w + d);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return w + d;
  }
  return null;
}

// Second factor for admin sign-in, shared by both admin login routes.
// Returns null when the login may proceed, or { status, body } to send.
export async function checkAdminSecondFactor(Admin, admin, otp) {
  const withSecret = await Admin.findById(admin._id).select("+totpSecret totpEnabled totpLastWindow");
  if (!withSecret?.totpEnabled) return null;
  if (!otp) return { status: 401, body: { error: "Enter the 6-digit code from your authenticator app.", twoFactorRequired: true } };
  const window = verifyTotp(withSecret.totpSecret, otp);
  if (window === null || (withSecret.totpLastWindow != null && window <= withSecret.totpLastWindow)) {
    return { status: 401, body: { error: "That code is wrong or has already been used.", twoFactorRequired: true } };
  }
  await Admin.updateOne({ _id: admin._id }, { totpLastWindow: window });
  return null;
}

// ── Password reset ──────────────────────────────────────────────────────
// Single-use, 30-minute links. Only a SHA-256 of the token is stored, so a
// database leak doesn't hand out working reset links.
const resetSchema = new mongoose.Schema({
  role: { type: String, enum: ["admin", "teacher", "student", "parent"], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
}, { timestamps: true });
resetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 3600 });
export const PasswordReset = mongoose.models.PasswordReset || mongoose.model("PasswordReset", resetSchema);

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

export async function createResetToken(role, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await PasswordReset.updateMany({ role, userId, usedAt: null }, { usedAt: new Date() }); // older links stop working
  await PasswordReset.create({ role, userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60000) });
  return token;
}

export async function consumeResetToken(token, newPassword, models) {
  const doc = await PasswordReset.findOne({ tokenHash: sha256(String(token || "")), usedAt: null, expiresAt: { $gt: new Date() } });
  if (!doc) return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
  if (String(newPassword || "").length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  const Model = models[doc.role];
  // updateOne with a pre-hashed value: bypasses the Admin pre-save hook,
  // which would otherwise hash it a second time.
  await Model.updateOne({ _id: doc.userId }, { password: await bcrypt.hash(String(newPassword), 10) });
  doc.usedAt = new Date();
  await doc.save();
  return { ok: true, role: doc.role };
}
