import { nextCode } from "../models/Settings.js";
import { httpError } from "../utils/crudRouter.js";
import { notifyStudents } from "./notify.js";

const round2 = (n) => Math.round(n * 100) / 100;

// The one place money is credited against a fee line — used by the
// cashier's "Collect" action and by approval of a student/parent payment
// claim, so both issue receipts and settle balances identically.
export async function recordPayment(fee, { amount, method = "cash", reference = "", receivedBy = "" }) {
  amount = Number(amount);
  if (fee.status === "paid") throw httpError(400, "This fee is already fully paid.");
  if (!Number.isFinite(amount) || amount <= 0) throw httpError(400, "Enter a payment amount greater than 0.");
  if (amount > fee.balance + 0.001) throw httpError(400, `Payment exceeds the outstanding balance (${fee.balance}).`);

  const receiptNo = await nextCode("RCP", "receipt", 6);
  fee.payments.push({ amount, method, reference, receiptNo, receivedBy });
  fee.paidAmount = round2(fee.paidAmount + amount);
  if (fee.paidAmount >= fee.netAmount - 0.001) {
    fee.status = "paid";
    fee.paidOn = new Date();
  } else {
    fee.status = "partial";
  }
  await fee.save();
  await notifyStudents([fee.studentId?._id || fee.studentId], {
    title: "Payment received",
    message: `${amount.toLocaleString("en-US")} received for “${fee.title}”. Receipt ${receiptNo}.${fee.status === "paid" ? " This fee is now fully paid." : ""}`,
    type: "fee", actionUrl: "/student/fees",
  });
  return receiptNo;
}
