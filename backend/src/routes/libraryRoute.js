import express from "express";
import { auth } from "../middleware/auth.js";
import { h, httpError, scalar, crudRouter } from "../utils/crudRouter.js";
import { getSettings } from "../models/Settings.js";
import { Book, BookIssue } from "../models/Erp.js";
import Student from "../models/studentModel.js";

// Library: catalogue, circulation (issue / return / lost) and overdue fines.
const router = express.Router();

const ISSUE_POPULATE = [{ path: "book", select: "title author isbn shelf" }, { path: "student", select: "name rollNo" }];
const DAY = 86400000;
const overdueDays = (dueOn, at = new Date()) => Math.max(0, Math.floor((at - new Date(dueOn)) / DAY));

// Student portal: my loans (with the fine as it stands today) + catalogue search.
router.get("/mine", auth("student"), h(async (req, res) => {
  const [issues, settings] = await Promise.all([
    BookIssue.find({ student: req.user.id }).populate("book", "title author").sort({ issuedOn: -1 }),
    getSettings(),
  ]);
  res.json(issues.map(i => ({ ...i.toObject(), accruedFine: i.status === "issued" ? overdueDays(i.dueOn) * settings.libraryFinePerDay : i.fine })));
}));

router.get("/catalogue", auth("student"), h(async (req, res) => {
  const q = (scalar(req.query.q) || "").trim();
  const filter = { status: "active" };
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: rx }, { author: rx }, { category: rx }];
  }
  res.json(await Book.find(filter).select("title author category shelf available copies").sort({ title: 1 }).limit(100));
}));

router.use(auth("admin"));

router.get("/summary", h(async (req, res) => {
  const now = new Date();
  const [titles, totals, out, overdue, fines] = await Promise.all([
    Book.countDocuments({ status: "active" }),
    Book.aggregate([{ $match: { status: "active" } }, { $group: { _id: null, copies: { $sum: "$copies" }, available: { $sum: "$available" } } }]),
    BookIssue.countDocuments({ status: "issued" }),
    BookIssue.countDocuments({ status: "issued", dueOn: { $lt: now } }),
    BookIssue.aggregate([{ $match: { fine: { $gt: 0 }, finePaid: false } }, { $group: { _id: null, total: { $sum: "$fine" } } }]),
  ]);
  res.json({ titles, copies: totals[0]?.copies || 0, available: totals[0]?.available || 0, out, overdue, unpaidFines: fines[0]?.total || 0 });
}));

router.get("/issues", h(async (req, res) => {
  const filter = {};
  const status = scalar(req.query.status);
  if (status === "overdue") Object.assign(filter, { status: "issued", dueOn: { $lt: new Date() } });
  else if (status) filter.status = status;
  const student = scalar(req.query.student);
  if (student) filter.student = student;
  res.json(await BookIssue.find(filter).populate(ISSUE_POPULATE).sort({ issuedOn: -1 }).limit(500));
}));

router.post("/issues", h(async (req, res) => {
  const { book: bookId, student: studentId } = req.body;
  const settings = await getSettings();
  if (!bookId || !studentId) throw httpError(400, "Choose a book and a student.");
  if (!(await Student.exists({ _id: studentId }))) throw httpError(404, "Student not found");

  const holding = await BookIssue.find({ student: studentId, status: "issued" });
  if (holding.length >= settings.libraryMaxBooks) throw httpError(409, `This student already has ${holding.length} book(s) out — the limit is ${settings.libraryMaxBooks}.`);
  if (holding.some(i => String(i.book) === String(bookId))) throw httpError(409, "This student already has a copy of this book.");
  if (holding.some(i => i.dueOn < new Date())) throw httpError(409, "This student has an overdue book. It must be returned before another is issued.");

  const dueOn = req.body.dueOn ? new Date(req.body.dueOn) : new Date(Date.now() + settings.libraryLoanDays * DAY);
  if (Number.isNaN(dueOn.getTime()) || dueOn <= new Date()) throw httpError(400, "The due date must be in the future.");

  // Conditional decrement: two desks issuing the last copy at the same
  // moment can't both succeed.
  const book = await Book.findOneAndUpdate({ _id: bookId, status: "active", available: { $gt: 0 } }, { $inc: { available: -1 } }, { new: true });
  if (!book) throw httpError(409, "No copies of this book are available right now.");
  const issue = await BookIssue.create({ book: book._id, student: studentId, dueOn, issuedBy: req.user.email || "Admin" });
  res.status(201).json(await issue.populate(ISSUE_POPULATE));
}));

// action: "return" (default) puts the copy back on the shelf; "lost"
// writes the copy off the catalogue instead.
router.patch("/issues/:id/return", h(async (req, res) => {
  const issue = await BookIssue.findById(req.params.id);
  if (!issue) throw httpError(404, "Loan not found");
  if (issue.status !== "issued") throw httpError(400, "This loan is already closed.");
  const settings = await getSettings();
  const lost = req.body.action === "lost";
  issue.returnedOn = new Date();
  issue.status = lost ? "lost" : "returned";
  issue.fine = overdueDays(issue.dueOn) * settings.libraryFinePerDay + (lost ? Math.max(0, Number(req.body.replacementCost) || 0) : 0);
  issue.finePaid = issue.fine === 0;
  await issue.save();
  await Book.updateOne({ _id: issue.book }, lost ? { $inc: { copies: -1 } } : { $inc: { available: 1 } });
  res.json(await issue.populate(ISSUE_POPULATE));
}));

router.patch("/issues/:id/fine-paid", h(async (req, res) => {
  const issue = await BookIssue.findByIdAndUpdate(req.params.id, { finePaid: true }, { new: true }).populate(ISSUE_POPULATE);
  if (!issue) throw httpError(404, "Loan not found");
  res.json(issue);
}));

router.use("/books", crudRouter(Book, {
  fields: ["title", "author", "isbn", "category", "publisher", "year", "shelf", "copies", "status"],
  filters: ["status", "category"], search: ["title", "author", "isbn", "category"], sort: { title: 1 },
  beforeCreate: (d) => ({ ...d, available: Number(d.copies ?? 1) }),
  // Changing the copy count moves `available` by the same delta, and can't
  // drop below the number currently out on loan.
  beforeUpdate: (d, req, doc) => {
    if (d.copies === undefined || d.copies === null) return d;
    const out = doc.copies - doc.available;
    if (Number(d.copies) < out) throw httpError(400, `${out} cop${out === 1 ? "y is" : "ies are"} currently on loan — the total can't go below that.`);
    return { ...d, available: Number(d.copies) - out };
  },
  beforeDelete: async (doc) => {
    if (await BookIssue.exists({ book: doc._id, status: "issued" })) throw httpError(409, "Copies of this book are still on loan.");
  },
}));

export default router;
