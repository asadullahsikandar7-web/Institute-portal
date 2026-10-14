import express from "express";
import { auth } from "../middleware/auth.js";
import { h, httpError, crudRouter } from "../utils/crudRouter.js";
import { TransportRoute, TransportAssignment, Hostel, HostelRoom, HostelAllocation, Asset, Visitor } from "../models/Erp.js";

// Campus services: transport, hostel, asset inventory and the visitor log.
const router = express.Router();

// Student portal: my bus route and my hostel room.
router.get("/mine", auth("student"), h(async (req, res) => {
  const [transport, hostel] = await Promise.all([
    TransportAssignment.findOne({ student: req.user.id }).populate("route", "name vehicleNo driverName driverPhone stops monthlyFare"),
    HostelAllocation.findOne({ student: req.user.id, status: "active" }).populate({ path: "room", populate: { path: "hostel", select: "name warden wardenPhone" } }),
  ]);
  res.json({ transport, hostel });
}));

router.use(auth("admin"));

// ═══════════════════════════ TRANSPORT ═════════════════════════════════════
router.get("/transport/summary", h(async (req, res) => {
  const [routes, riders] = await Promise.all([
    TransportRoute.find({ status: "active" }),
    TransportAssignment.aggregate([{ $group: { _id: "$route", n: { $sum: 1 } } }]),
  ]);
  const byRoute = new Map(riders.map(r => [String(r._id), r.n]));
  res.json({
    routes: routes.length,
    riders: riders.reduce((s, r) => s + r.n, 0),
    seats: routes.reduce((s, r) => s + r.capacity, 0),
    occupancy: routes.map(r => ({ _id: r._id, name: r.name, capacity: r.capacity, riders: byRoute.get(String(r._id)) || 0 })),
  });
}));

async function assertSeat(routeId, excludeId) {
  const route = await TransportRoute.findById(routeId);
  if (!route) throw httpError(404, "Route not found");
  if (route.status !== "active") throw httpError(400, "That route is inactive.");
  const riders = await TransportAssignment.countDocuments({ route: routeId, _id: { $ne: excludeId } });
  if (riders >= route.capacity) throw httpError(409, `${route.name} is full (${riders}/${route.capacity} seats).`);
}

router.use("/transport/routes", crudRouter(TransportRoute, {
  filters: ["status"], search: ["name", "vehicleNo", "driverName", "stops"], sort: { name: 1 },
  beforeDelete: async (doc) => { if (await TransportAssignment.exists({ route: doc._id })) throw httpError(409, "Students are assigned to this route. Reassign them first, or mark the route inactive."); },
}));
router.use("/transport/assignments", crudRouter(TransportAssignment, {
  fields: ["student", "route", "stop"],
  populate: [{ path: "student", select: "name rollNo" }, { path: "route", select: "name vehicleNo monthlyFare" }],
  filters: ["route", "student"],
  beforeCreate: async (d) => { await assertSeat(d.route); },
  beforeUpdate: async (d, req, doc) => { if (d.route && String(d.route) !== String(doc.route)) await assertSeat(d.route, doc._id); },
}));

// ═══════════════════════════ HOSTEL ════════════════════════════════════════
router.get("/hostel/summary", h(async (req, res) => {
  const [hostels, rooms, active] = await Promise.all([
    Hostel.countDocuments({ status: "active" }),
    HostelRoom.find().select("capacity status"),
    HostelAllocation.aggregate([{ $match: { status: "active" } }, { $group: { _id: "$room", n: { $sum: 1 } } }]),
  ]);
  const beds = rooms.filter(r => r.status === "available").reduce((s, r) => s + r.capacity, 0);
  const residents = active.reduce((s, a) => s + a.n, 0);
  res.json({ hostels, rooms: rooms.length, beds, residents, vacant: Math.max(0, beds - residents), occupancy: Object.fromEntries(active.map(a => [String(a._id), a.n])) });
}));

router.post("/hostel/allocations", h(async (req, res) => {
  const { student, room: roomId } = req.body;
  if (!student || !roomId) throw httpError(400, "Choose a student and a room.");
  const room = await HostelRoom.findById(roomId);
  if (!room) throw httpError(404, "Room not found");
  if (room.status !== "available") throw httpError(400, `Room ${room.number} is marked ${room.status}.`);
  if (await HostelAllocation.exists({ student, status: "active" })) throw httpError(409, "This student already has a hostel room. Vacate it first.");
  const occupied = await HostelAllocation.countDocuments({ room: room._id, status: "active" });
  if (occupied >= room.capacity) throw httpError(409, `Room ${room.number} is full (${occupied}/${room.capacity}).`);
  const allocation = await HostelAllocation.create({ student, room: room._id });
  res.status(201).json(await allocation.populate(ALLOC_POPULATE));
}));

router.patch("/hostel/allocations/:id/vacate", h(async (req, res) => {
  const a = await HostelAllocation.findById(req.params.id);
  if (!a) throw httpError(404, "Allocation not found");
  if (a.status !== "active") throw httpError(400, "This allocation has already ended.");
  a.status = "vacated";
  a.to = new Date();
  await a.save();
  res.json(await a.populate(ALLOC_POPULATE));
}));

const ALLOC_POPULATE = [{ path: "student", select: "name rollNo" }, { path: "room", select: "number floor monthlyRent hostel", populate: { path: "hostel", select: "name" } }];

router.use("/hostel/hostels", crudRouter(Hostel, { filters: ["status", "type"], search: ["name", "warden"], sort: { name: 1 }, softDelete: { field: "status", value: "inactive" } }));
router.use("/hostel/rooms", crudRouter(HostelRoom, {
  populate: [{ path: "hostel", select: "name type" }], filters: ["hostel", "status"], search: ["number"], sort: { number: 1 },
  beforeDelete: async (doc) => { if (await HostelAllocation.exists({ room: doc._id, status: "active" })) throw httpError(409, "This room still has residents."); },
}));
// Read/list only through the generic router — creating and ending an
// allocation go through the capacity-checked endpoints above.
router.use("/hostel/allocations", crudRouter(HostelAllocation, { populate: ALLOC_POPULATE, filters: ["status", "room", "student"], readOnly: true }));

// ═══════════════════════════ ASSETS & VISITORS ═════════════════════════════
router.get("/assets/summary", h(async (req, res) => {
  const assets = await Asset.find().select("quantity unitCost condition category");
  const live = assets.filter(a => a.condition !== "disposed");
  res.json({
    items: live.length,
    units: live.reduce((s, a) => s + a.quantity, 0),
    value: live.reduce((s, a) => s + a.quantity * a.unitCost, 0),
    needsRepair: assets.filter(a => a.condition === "needs_repair").length,
  });
}));
router.use("/assets", crudRouter(Asset, { filters: ["category", "condition"], search: ["name", "tag", "location", "assignedTo"], sort: { name: 1 } }));

router.patch("/visitors/:id/checkout", h(async (req, res) => {
  const v = await Visitor.findById(req.params.id);
  if (!v) throw httpError(404, "Visitor not found");
  if (v.checkOut) throw httpError(400, "This visitor has already checked out.");
  v.checkOut = new Date();
  await v.save();
  res.json(v);
}));
router.use("/visitors", crudRouter(Visitor, { fields: ["name", "phone", "nationalId", "purpose", "toMeet", "badgeNo"], search: ["name", "phone", "toMeet", "purpose"], sort: { checkIn: -1 } }));

export default router;
