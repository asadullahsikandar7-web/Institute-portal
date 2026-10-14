// Overlap-based conflict checks for TimetableEntry — shared by the seed
// script (pre-insert validation report) and the schedule route (checked on
// every create/update, not just at seed time). Times are "HH:mm" 24-hour
// strings, which sort/compare correctly as plain strings since every value
// is the same fixed-width shape — no need to parse them into minutes.
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

const sameDay = (a, b) => a.day === b.day;
const sameId = (a, b) => a && b && String(a) === String(b);

// Checks one candidate slot against a list of existing entries (already
// filtered to the same academicSession — callers are expected to scope the
// query, this function doesn't re-check session). `excludeId` lets an
// update-in-place compare against every entry except itself.
export function findConflictsForCandidate(candidate, existingEntries, excludeId = null) {
  const conflicts = { teacher: [], room: [], section: [] };
  for (const e of existingEntries) {
    if (excludeId && sameId(e._id, excludeId)) continue;
    if (!sameDay(candidate, e)) continue;
    if (!overlaps(candidate.startTime, candidate.endTime, e.startTime, e.endTime)) continue;

    if (candidate.teacher && sameId(candidate.teacher, e.teacher)) conflicts.teacher.push(e);
    if (sameId(candidate.room, e.room)) conflicts.room.push(e);
    if (sameId(candidate.section, e.section) && !sameId(candidate.subject, e.subject)) conflicts.section.push(e);
  }
  return conflicts;
}

// Batch form for validating an entire proposed timetable against itself
// (used by the seed script before insert) — returns every pairwise
// conflict found, each reported once.
export function findAllConflicts(entries) {
  const found = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      if (!sameDay(a, b)) continue;
      if (!overlaps(a.startTime, a.endTime, b.startTime, b.endTime)) continue;

      if (a.teacher && sameId(a.teacher, b.teacher)) found.push({ type: "teacher", a, b });
      if (sameId(a.room, b.room)) found.push({ type: "room", a, b });
      if (sameId(a.section, b.section) && !sameId(a.subject, b.subject)) found.push({ type: "section", a, b });
    }
  }
  return found;
}

export function hasAnyConflict(conflicts) {
  return conflicts.teacher.length > 0 || conflicts.room.length > 0 || conflicts.section.length > 0;
}
