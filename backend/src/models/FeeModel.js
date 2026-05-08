// models/Fee.js
const mongoose = require("mongoose");

const feeSchema = new mongoose.Schema({
  studentId:  { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  title:      { type: String, required: true },
  amount:     { type: Number, required: true },
  category:   { type: String, enum: ["tuition","lab","library","exam","other"], default: "tuition" },
  dueDate:    { type: Date, required: true },
  status:     { type: String, enum: ["paid","unpaid","overdue"], default: "unpaid" },
  paidOn:     { type: Date, default: null },
}, { timestamps: true });

// Auto-mark overdue before every find
feeSchema.pre(/^find/, function() {
  this.where({ status: "unpaid", dueDate: { $lt: new Date() } })
      .updateMany({}, { $set: { status: "overdue" } }).exec().catch(() => {});
});

module.exports = mongoose.model("Fee", feeSchema);