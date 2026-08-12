import express from "express";
import Notification from "../models/notificationModel.js";
import { auth } from "../middleware/auth.js";
import { sendMail } from "../utils/mailer.js";
import { noticeTemplate } from "../utils/emailTemplates.js";
import Student from "../models/studentModel.js";

const router = express.Router();

// Get notifications for current user
router.get("/", auth(), async (req, res) => {
  try {
    const { type } = req.query;
    
    let query = {
      $or: [
        { recipientId: req.user.id },
        { recipientId: null } // Broadcast notifications
      ]
    };

    // Filter by type if provided
    if (type) {
      query.type = type;
    }

    const notifications = await Notification.find(query)
      .sort({ sentAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notifications: " + err.message });
  }
});

// Mark notification as read
router.patch("/:id/read", auth(), async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(notification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update notification: " + err.message });
  }
});

// Create notification (Admin only)
router.post("/", auth("admin"), async (req, res) => {
  try {
    const { title, message, type, priority, recipientId } = req.body;

    // Validate required fields
    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    const notification = new Notification({
      ...req.body,
      sentAt: new Date(),
      sender: req.user.email || "Admin"
    });

    await notification.save();

    // If broadcast (recipientId is null), return count info
    if (recipientId === null || recipientId === undefined) {
      // Email all students, awaited before responding — on Vercel's
      // serverless runtime the function can freeze the instant the response
      // is sent, so fire-and-forget sends here would routinely never complete.
      try {
        const students = await Student.find().select("email name");
        const recipients = students.map(s => s.email).filter(Boolean);
        const html = noticeTemplate({ title, message });
        await Promise.allSettled(recipients.map(r =>
          sendMail({ to: r, subject: title, text: message, html }).catch(e => console.error('Broadcast email failed for', r, e.message || e))
        ));
      } catch (e) { console.error('Broadcast email error', e.message || e); }

      const count = await Notification.countDocuments({
        type: type || "notice",
        sentAt: { $gte: new Date(Date.now() - 1000) }
      });

      res.status(201).json({ ...notification.toObject(), count });
    } else {
      res.status(201).json(notification);
    }
  } catch (err) {
    console.error(err);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message).join(", ");
      res.status(400).json({ error: messages });
    } else {
      res.status(500).json({ error: "Failed to create notification: " + err.message });
    }
  }
});

// Delete notification (Admin only)
router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const result = await Notification.findByIdAndDelete(req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: "Notification not found" });
    }
    
    res.json({ message: "Notification deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete notification: " + err.message });
  }
});
export default router;