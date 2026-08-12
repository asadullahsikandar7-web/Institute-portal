import express from "express";
import { sendMail } from "../utils/mailer.js";
import { feedbackTemplate } from "../utils/emailTemplates.js";

const router = express.Router();
const FEEDBACK_RECEIVER_EMAIL = process.env.FEEDBACK_RECEIVER_EMAIL || process.env.ADMIN_EMAIL || process.env.SMTP_USER;

router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: "Name, email, and message are required." });
    }

    await sendMail({
      to: FEEDBACK_RECEIVER_EMAIL,
      replyTo: email,
      subject: `ACADEXA by ASAD — Feedback from ${name}`,
      text: `Feedback from ${name} <${email}>:\n\n${message}`,
      html: feedbackTemplate({ name, email, message }),
    });

    res.json({ message: "Feedback sent successfully." });
  } catch (err) {
    console.error("Feedback send error:", err);
    res.status(500).json({ error: err.message || "Failed to send feedback." });
  }
});

export default router;
