import nodemailer from "nodemailer";
import env from "dotenv";

env.config();
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "your_email@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "your_app_password";
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "ACADEXA by ASAD";
const MAIL_FROM_EMAIL = process.env.MAIL_FROM_EMAIL || SMTP_USER;

let smtpReady = false;
let smtpLastError = null;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

const verifySMTP = async () => {
  try {
    await transporter.verify();
    smtpReady = true;
    smtpLastError = null;
    console.log("✅ SMTP server verified successfully");
  } catch (err) {
    smtpReady = false;
    smtpLastError = err?.message || "SMTP verification failed";
    console.error("❌ SMTP verification failed:", smtpLastError);
  }
};

// Kick off a background verification purely to populate smtpReady/smtpLastError
// for the /health endpoint. sendMail() below does NOT wait for or gate on this —
// on a serverless cold start (Vercel), the Gmail SMTP handshake here can take
// several seconds, and a request can easily arrive before it resolves. Gating
// sendMail on it caused real, valid credentials to fail with "SMTP not ready"
// on essentially every cold start. Nodemailer authenticates its own connection
// per send anyway, so this check was redundant with — and slower than — just
// trying to send.
verifySMTP();

async function sendMail(options) {
  const mail = { from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_EMAIL}>`, ...options };
  try {
    const info = await transporter.sendMail(mail);
    smtpReady = true;
    smtpLastError = null;
    return info;
  } catch (err) {
    smtpReady = false;
    smtpLastError = err?.message || "Send failed";
    throw err;
  }
}

export { transporter, sendMail, smtpReady, smtpLastError, verifySMTP, MAIL_FROM_NAME, MAIL_FROM_EMAIL };
