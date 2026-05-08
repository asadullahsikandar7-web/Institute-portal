import express from "express";
import Notification from "../models/notificationModel.js";
import { auth } from "../routes/middleware/auth.js";

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
