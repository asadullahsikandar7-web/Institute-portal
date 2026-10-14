import express from "express";
import { auth } from "../middleware/auth.js";
import Room from "../models/Room.js";
import TimetableEntry from "../models/TimetableEntry.js";

const router = express.Router();
router.use(auth());

const FACILITY_BOOL_KEYS = ["multimedia", "ac", "whiteboard", "internet"];
const FACILITY_COUNT_KEYS = ["fans", "lights", "computers"];

function sanitizeFacilities(input = {}) {
  const out = {};
  for (const k of FACILITY_BOOL_KEYS) if (input[k] !== undefined) out[k] = !!input[k];
  for (const k of FACILITY_COUNT_KEYS) if (input[k] !== undefined) out[k] = Math.max(0, Number(input[k]) || 0);
  return out;
}

router.get("/", async (req, res) => {
  try {
    const rooms = await Room.find().sort({ name: 1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert by name — the same room (e.g. "A2H2") gets reused across schedule
// entries rather than a fresh duplicate row per reference.
router.post("/", auth("admin"), async (req, res) => {
  try {
    const { name, type, capacity, building, facilities, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    const room = await Room.findOneAndUpdate(
      { name: name.trim() },
      {
        $setOnInsert: { name: name.trim() },
        $set: {
          ...(type && { type }),
          ...(capacity != null && capacity !== "" && { capacity }),
          ...(building && { building }),
          ...(notes !== undefined && { notes }),
          ...(facilities && { facilities: sanitizeFacilities(facilities) }),
        },
      },
      { new: true, upsert: true }
    );
    res.status(201).json(room);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "A room with that name already exists." });
    res.status(500).json({ error: err.message });
  }
});

// Edit an existing room — type/capacity/building/status/notes and the
// facilities checklist (multimedia, AC, fans, lights, computers, etc).
router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const { name, type, capacity, building, status, notes, facilities } = req.body;
    if (name !== undefined && name.trim()) room.name = name.trim();
    if (type !== undefined) room.type = type;
    if (capacity !== undefined) room.capacity = capacity === "" ? null : capacity;
    if (building !== undefined) room.building = building || null;
    if (status !== undefined) room.status = status;
    if (notes !== undefined) room.notes = notes;
    if (facilities !== undefined) room.facilities = { ...room.facilities.toObject(), ...sanitizeFacilities(facilities) };

    await room.save();
    res.json(room);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "A room with that name already exists." });
    res.status(500).json({ error: err.message });
  }
});

// Hard delete is only allowed once the room has no schedule entries
// referencing it — otherwise those entries would be left pointing at a
// room that no longer exists. Admins should mark a retired room "inactive"
// instead, which is preserved everywhere it's already referenced.
router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const inUse = await TimetableEntry.countDocuments({ room: req.params.id });
    if (inUse > 0) {
      return res.status(409).json({ error: `This room is used by ${inUse} schedule ${inUse === 1 ? "entry" : "entries"}. Mark it inactive instead, or remove those schedule entries first.` });
    }
    const deleted = await Room.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Room not found" });
    res.json({ message: "Room deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
