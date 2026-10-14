// ── Clash-free planners ─────────────────────────────────────────────────
// Two greedy constraint solvers that share one idea: order the work from
// most- to least-constrained, then drop each item into the first slot that
// breaks no hard rule, preferring slots that keep the week (or the exam
// fortnight) evenly spread. They are pure functions over plain objects —
// no database access — so the routes can run them as a preview and only
// write when the admin accepts the result.
//
// Hard rules, timetable: a teacher, a section and a room are each in one
// place at a time; a room must be big enough. Soft: the same subject not
// twice on one day; a section's classes spread across the week.
// Hard rules, exams: a section sits one paper at a time and a room hosts
// one paper at a time. Soft: one paper per section per day.

const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;
const id = (v) => String(v?._id || v || "");
const fits = (room, size) => room.capacity == null || room.capacity >= size;

// assignments: [{ _id, teacher, section, subject, program, sessions, size }]
// existing:    kept TimetableEntry-like rows already occupying the grid
export function planTimetable({ assignments, rooms, existing = [], days, slots }) {
  const grid = existing.map(e => ({ day: e.day, start: e.startTime, end: e.endTime, teacher: id(e.teacher), section: id(e.section), room: id(e.room), subject: id(e.subject) }));
  const placed = [], unplaced = [];
  const busy = (day, slot, key, value) => value && grid.some(g => g.day === day && g[key] === value && overlaps(slot.start, slot.end, g.start, g.end));
  const sectionLoad = (day, section) => grid.filter(g => g.day === day && g.section === section).length;
  const usableRooms = rooms.filter(r => r.status !== "inactive").sort((a, b) => (a.capacity ?? 1e9) - (b.capacity ?? 1e9));

  // Teachers with the most to teach are hardest to fit — place them first.
  const load = new Map();
  assignments.forEach(a => load.set(id(a.teacher), (load.get(id(a.teacher)) || 0) + a.sessions));
  const queue = [...assignments].sort((a, b) => load.get(id(b.teacher)) - load.get(id(a.teacher)) || b.size - a.size);

  for (const a of queue) {
    const teacher = id(a.teacher), section = id(a.section), subject = id(a.subject);
    const wantsLab = /\blab\b/i.test(a.subjectName || "");
    for (let n = 0; n < a.sessions; n++) {
      // Candidate days: ones without this subject first, then the lightest day for the section.
      const dayOrder = [...days].sort((x, y) =>
        (grid.some(g => g.day === x && g.section === section && g.subject === subject) - grid.some(g => g.day === y && g.section === section && g.subject === subject)) ||
        (sectionLoad(x, section) - sectionLoad(y, section)) || (days.indexOf(x) - days.indexOf(y)));
      let done = false, blockers = new Set();
      for (const day of dayOrder) {
        for (const slot of slots) {
          if (busy(day, slot, "teacher", teacher)) { blockers.add("teacher"); continue; }
          if (busy(day, slot, "section", section)) { blockers.add("section"); continue; }
          const free = usableRooms.filter(r => fits(r, a.size) && !busy(day, slot, "room", id(r)));
          if (!free.length) { blockers.add(usableRooms.some(r => fits(r, a.size)) ? "room" : "capacity"); continue; }
          const room = free.find(r => (r.type === "lab") === wantsLab) || free[0];
          grid.push({ day, start: slot.start, end: slot.end, teacher, section, room: id(room), subject });
          placed.push({ assignment: a, day, startTime: slot.start, endTime: slot.end, room, type: room.type === "lab" && wantsLab ? "Lab" : "Lecture" });
          done = true;
          break;
        }
        if (done) break;
      }
      if (!done) unplaced.push({ assignment: a, session: n + 1, reason: explain(blockers) });
    }
  }
  return { placed, unplaced };
}

function explain(blockers) {
  if (blockers.has("capacity")) return "No room is large enough for this section.";
  if (blockers.has("room")) return "Every suitable room is taken in the slots this teacher and section are free.";
  if (blockers.has("teacher") && blockers.has("section")) return "The teacher and the section have no free slot in common.";
  if (blockers.has("teacher")) return "The teacher has no free slot left.";
  if (blockers.has("section")) return "The section's week is already full.";
  return "No slots are available.";
}

// papers: [{ _id (teacherAssignment), section, subject, program, teacher, size }]
// dates:  ["YYYY-MM-DD", …] usable exam days, in order
export function planExams({ papers, rooms, dates, slots, existing = [], invigilators = [] }) {
  const grid = existing.map(e => ({ date: e.date, start: e.startTime, end: e.endTime, section: id(e.section), room: id(e.room), invigilator: id(e.invigilator) }));
  const placed = [], unplaced = [];
  // Ordinary classrooms first (labs and the auditorium only when needed),
  // then the smallest room that fits — big halls stay free for big sections.
  const rank = { classroom: 0, auditorium: 1, lab: 2, other: 3 };
  const usableRooms = rooms.filter(r => r.status !== "inactive" && r.type !== "office")
    .sort((a, b) => (rank[a.type] ?? 3) - (rank[b.type] ?? 3) || (a.capacity ?? 1e9) - (b.capacity ?? 1e9));
  const clash = (date, slot, key, value) => value && grid.some(g => g.date === date && g[key] === value && overlaps(slot.start, slot.end, g.start, g.end));
  const papersOn = (date, section) => grid.filter(g => g.date === date && g.section === section).length;

  // Sections with the most papers have the least room to manoeuvre.
  const count = new Map();
  papers.forEach(p => count.set(id(p.section), (count.get(id(p.section)) || 0) + 1));
  const queue = [...papers].sort((a, b) => count.get(id(b.section)) - count.get(id(a.section)) || b.size - a.size);

  for (const p of queue) {
    const section = id(p.section);
    let best = null;
    // First pass insists on a free day for the section; second pass allows
    // two papers in a day (different slots) rather than leave it unscheduled.
    for (const allowDouble of [false, true]) {
      for (const date of dates) {
        if (!allowDouble && papersOn(date, section) > 0) continue;
        for (const slot of slots) {
          if (clash(date, slot, "section", section)) continue;
          const room = usableRooms.find(r => fits(r, p.size) && !clash(date, slot, "room", id(r)));
          if (!room) continue;
          best = { date, slot, room };
          break;
        }
        if (best) break;
      }
      if (best) break;
    }
    if (!best) {
      unplaced.push({ paper: p, reason: usableRooms.some(r => fits(r, p.size)) ? "No free room and slot left in the exam window — extend the dates or add a slot." : "No room is large enough for this section." });
      continue;
    }
    // The class teacher invigilates unless already on duty in that slot —
    // then whichever other teacher is free and has had the fewest duties.
    const free = (t) => !clash(best.date, best.slot, "invigilator", id(t));
    const duties = (t) => grid.filter(g => g.invigilator === id(t)).length;
    const invigilator = free(p.teacher) ? p.teacher : [...invigilators].filter(free).sort((a, b) => duties(a) - duties(b))[0] || null;
    grid.push({ date: best.date, start: best.slot.start, end: best.slot.end, section, room: id(best.room), invigilator: id(invigilator) });
    placed.push({ paper: p, date: best.date, startTime: best.slot.start, endTime: best.slot.end, room: best.room, invigilator });
  }
  return { placed, unplaced };
}

export function validSlots(slots) {
  const ok = Array.isArray(slots) && slots.length > 0 && slots.every(s => /^\d{2}:\d{2}$/.test(s?.start || "") && /^\d{2}:\d{2}$/.test(s?.end || "") && s.start < s.end);
  if (!ok) return false;
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.every((s, i) => i === 0 || sorted[i - 1].end <= s.start);
}
