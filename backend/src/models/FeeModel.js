// models/Fee.js
import mongoose from "mongoose";

const feeSchema = new mongoose.Schema({
  studentId:  { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  title:      { type: String, required: true },
  amount:     { type: Number, required: true },
  category:   { type: String, enum: ["tuition","lab","library","exam","other"], default: "tuition" },
  dueDate:    { type: Date, required: true },
  status:     { type: String, enum: ["paid","unpaid","overdue","partial"], default: "unpaid" },
  paidOn:     { type: Date, default: null },
  // ── Ledger fields (additive) ── a fee is now an invoice line that can be
  // discounted (scholarship/waiver), fined (late fee) and settled across
  // several payments. Net payable = amount - discount + fine. Rows created
  // before these existed read as discount 0 / fine 0 / no payments, and the
  // legacy "mark paid" path keeps working (see FeeRoute.js PATCH).
  discount:   { type: Number, default: 0, min: 0 },
  discountNote: { type: String, default: "" },
  fine:       { type: Number, default: 0, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  payments: [{
    amount:    { type: Number, required: true, min: 0 },
    method:    { type: String, enum: ["cash","bank","card","online","cheque"], default: "cash" },
    reference: { type: String, default: "" },
    receiptNo: { type: String, required: true },
    paidOn:    { type: Date, default: Date.now },
    receivedBy:{ type: String, default: "" },
  }],
  structure:  { type: mongoose.Schema.Types.ObjectId, ref: "FeeStructure", default: null },
  period:     { type: String, default: "" }, // e.g. "Fall 2026" / "2026-10"
}, { timestamps: true });

feeSchema.virtual("netAmount").get(function () {
  return Math.max(0, (this.amount || 0) - (this.discount || 0) + (this.fine || 0));
});
feeSchema.virtual("balance").get(function () {
  if (this.status === "paid") return 0;
  return Math.max(0, this.netAmount - (this.paidAmount || 0));
});
feeSchema.set("toJSON", { virtuals: true });
feeSchema.set("toObject", { virtuals: true });
feeSchema.index({ studentId: 1, dueDate: 1 });

// Auto-mark overdue before every find. Must run as an independent query via
// this.model — chaining .updateMany() directly onto `this` (the in-flight
// find query) mutates its op to "updateMany" and silently breaks the actual
// find (verified: it was returning [] for every Fee.find/findById call).
feeSchema.pre(/^find/, function(next) {
  this.model.updateMany(
    { status: "unpaid", dueDate: { $lt: new Date() } },
    { $set: { status: "overdue" } }
  ).exec().catch(() => {});
  next();
});
const Fee = mongoose.models.Fee || mongoose.model("Fee", feeSchema);
export default Fee;