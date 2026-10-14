import Notification from "../models/notificationModel.js";
import Student from "../models/studentModel.js";

// In-app notifications raised by system events (fee billed, result
// published, ticket answered…). Always best-effort: a failed notification
// must never fail the action that triggered it, so everything here
// swallows its own errors.

const ICONS = { fee: "dollar", grade: "award", exam: "file", leave: "clipboard", assignment: "file", attendance: "clipboard", ticket: "lifebuoy", library: "library", admission: "upload", alert: "alert" };

function doc(recipientType, recipientId, { title, message, type = "notice", actionUrl = null, priority = "normal" }) {
  return { recipientType, recipientId, title, message, type, actionUrl, priority, icon: ICONS[type] || "bell", sender: "System", sentAt: new Date() };
}

export async function notify(recipientType, recipientId, payload) {
  if (!recipientId) return;
  try { await Notification.create(doc(recipientType, recipientId, payload)); }
  catch (e) { console.error("notify failed:", e.message); }
}

// Notifies each student and, when the student is linked to a parent
// record, that parent too. `payload` may be a function of the student id
// for per-student wording. Parent links point at the parent portal.
export async function notifyStudents(studentIds, payload, { alsoParents = true } = {}) {
  const ids = [...new Set((studentIds || []).map(String))];
  if (!ids.length) return;
  try {
    const make = (id) => (typeof payload === "function" ? payload(id) : payload);
    const docs = ids.map(id => doc("student", id, make(id)));
    if (alsoParents) {
      const linked = await Student.find({ _id: { $in: ids }, parentId: { $ne: null } }).select("name parentId");
      for (const s of linked) {
        const p = make(String(s._id));
        docs.push(doc("parent", s.parentId, { ...p, title: `${s.name}: ${p.title}`, actionUrl: "/parent/dashboard" }));
      }
    }
    await Notification.insertMany(docs, { ordered: false });
  } catch (e) { console.error("notifyStudents failed:", e.message); }
}
