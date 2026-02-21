import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema({
  name: String,
  email: String,
  rollNo: String,
  password: String,
});

export default mongoose.model("Student", StudentSchema);
