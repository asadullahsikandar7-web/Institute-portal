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

// Verify on import/startup
verifySMTP();

async function sendMail(options) {
  if (!smtpReady) {
    const err = new Error("SMTP not ready");
    err.code = "SMTP_NOT_READY";
    throw err;
  }
  const mail = { from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_EMAIL}>`, ...options };
  return transporter.sendMail(mail);
}

export { transporter, sendMail, smtpReady, smtpLastError, verifySMTP, MAIL_FROM_NAME, MAIL_FROM_EMAIL };
