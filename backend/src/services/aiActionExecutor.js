// ═══════════════════════════════════════════════════════════════════
//  Executes a CONFIRMED AiAction. Only ever called from
//  POST /api/ai/actions/:id/confirm, after that route has already
//  re-verified the caller owns the action and it's still pending.
//
//  Reuses the exact same models/services the rest of the app already
//  uses for these writes (Leave, ParentMessage, mailer.js) — no parallel
//  write path is introduced. Email sends are awaited before returning,
//  matching the fix applied earlier to every other mail-sending route in
//  this app: Vercel's serverless runtime can freeze the instant a
//  response goes out, so a fire-and-forget send here would routinely
//  never complete in production.
// ═══════════════════════════════════════════════════════════════════
import Leave from "../models/leavemodel.js";
import ParentMessage from "../models/ParentMessagemodel.js";
import Student from "../models/studentModel.js";
import { sendMail } from "../utils/mailer.js";
import { parentMessageTemplate } from "../utils/emailTemplates.js";

async function executeCreateLeaveRequest(params) {
  const leave = await Leave.create({
    studentId: params.studentId,
    type: params.type,
    from: params.from,
    to: params.to,
    reason: params.reason,
    status: "pending",
    appliedAt: new Date(),
  });
  return { message: "Your leave request has been submitted successfully.", leave };
}

async function sendOneParentEmail({ studentId, subject, message }) {
  const student = await Student.findById(studentId).select("name rollNo parentName parentEmail");
  if (!student?.parentEmail) throw new Error("No parent email on file for this student.");

  const msg = await ParentMessage.create({
    studentId,
    studentName: student.name,
    rollNo: student.rollNo,
    parentName: student.parentName,
    parentEmail: student.parentEmail,
    title: subject,
    message,
    type: "announcement",
    author: "ACADEXA AI (admin-confirmed)",
    emailStatus: "pending",
  });

  try {
    const html = parentMessageTemplate(msg);
    await sendMail({ to: student.parentEmail, subject, text: message, html });
    msg.emailStatus = "sent";
  } catch (err) {
    msg.emailStatus = "failed";
    await msg.save().catch(() => {});
    throw err;
  }
  await msg.save();
  return { studentName: student.name, parentEmail: student.parentEmail, status: "sent" };
}

async function executeSendParentEmail(params) {
  const result = await sendOneParentEmail(params);
  return { message: `Email sent to ${result.studentName}'s parent.`, result };
}

async function executeSendParentEmailsBulk(params) {
  const results = [];
  const failures = [];
  for (const item of params.items) {
    try {
      results.push(await sendOneParentEmail(item));
    } catch (err) {
      failures.push({ studentId: item.studentId, studentName: item.studentName, error: err.message });
    }
  }
  return {
    message: `Sent ${results.length} of ${params.items.length} parent emails${failures.length ? `, ${failures.length} failed` : ""}.`,
    sent: results,
    failed: failures,
  };
}

const EXECUTORS = {
  create_leave_request: executeCreateLeaveRequest,
  send_parent_email: executeSendParentEmail,
  send_parent_emails_bulk: executeSendParentEmailsBulk,
};

export async function executeConfirmedAction(action) {
  const executor = EXECUTORS[action.type];
  if (!executor) throw new Error(`No executor registered for action type "${action.type}"`);
  return executor(action.params);
}
