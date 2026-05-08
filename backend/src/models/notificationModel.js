import mongoose from "mongoose";

// ══════════════════════════════════════════════════════════════
//  NOTIFICATION MODEL — Real-time notifications
// ══════════════════════════════════════════════════════════════
const NotificationSchema = new mongoose.Schema({
  // Target
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" }, // null = all students
  recipientType: { type: String, enum: ["student", "parent", "admin"], default: "student" },
  
  // Content
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ["attendance", "grade", "fee", "notice", "assignment", "exam", "leave", "announcement", "alert"],
    default: "notice" 
  },
  
  // Metadata
  priority: { type: String, enum: ["low", "normal", "high"], default: "normal" },
  icon: { type: String, default: "bell" }, // icon name
  actionUrl: { type: String, default: null }, // where to navigate
  relatedId: { type: mongoose.Schema.Types.ObjectId, default: null }, // reference to related data
  
  // Status
  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  sentAt: { type: Date, default: Date.now },
  
  // Channels
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
  },
  
  sender: { type: String, default: "System" },
  createdAt: { type: Date, default: Date.now },
});

NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ sentAt: -1 });

export default mongoose.model("Notification", NotificationSchema);
