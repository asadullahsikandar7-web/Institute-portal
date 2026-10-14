import mongoose from "mongoose";

// A reusable physical space referenced by ObjectId from TimetableEntry —
// deliberately NOT free-text room names scattered across schedule rows, so
// "is this room double-booked" can be answered with one query instead of a
// string-equality guess across every entry. `building`/`capacity` are left
// unset unless actually known — see the comment on TimetableEntry.js for why
// this project never infers those from a room code.
// Facility booleans/counts are all opt-in (false/0 by default) — a newly
// added room simply has none recorded yet, never a guessed loadout.
const facilitiesSchema = new mongoose.Schema(
  {
    multimedia: { type: Boolean, default: false }, // projector/screen
    ac: { type: Boolean, default: false },
    fans: { type: Number, default: 0, min: 0 },
    lights: { type: Number, default: 0, min: 0 },
    computers: { type: Number, default: 0, min: 0 },
    whiteboard: { type: Boolean, default: false },
    internet: { type: Boolean, default: false },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // e.g. "A2H2", "Computer Lab 4 BSAI"
    type: { type: String, enum: ["classroom", "lab", "auditorium", "office", "other"], default: "classroom" },
    capacity: { type: Number, default: null },
    building: { type: String, default: null },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    facilities: { type: facilitiesSchema, default: () => ({}) },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

const Room = mongoose.models.Room || mongoose.model("Room", roomSchema);
export default Room;
