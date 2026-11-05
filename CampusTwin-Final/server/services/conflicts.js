// Timetable validation: room / faculty / section double booking, capacity, room status.
const { rangesIntersect, overlaps, eachDate, weekdayOf, slotToInterval } = require("../utils/time");
const id = (v) => (v == null ? "" : String(v._id || v));
const summary = (e) => ({ id: id(e), subject: e.subject, faculty: e.faculty, room: e.room, day: e.day, time: e.time, section: e.section });

// candidate: { _id?, day, startMinutes, endMinutes, dateFrom, dateTo, roomRef, facultyRef, faculty, course, section, studentCount }
// existing: active Timetable entries (plain objects). room: the candidate's Room document.
function checkEntryConflicts(candidate, existing, room, oneOffs = []) {
  const errors = [], warnings = [];
  const sameSlot = (e) =>
    id(e) !== id(candidate) && e.status !== "cancelled" && e.day === candidate.day &&
    e.startMinutes != null && e.endMinutes != null &&
    overlaps({ start: e.startMinutes, end: e.endMinutes }, { start: candidate.startMinutes, end: candidate.endMinutes }) &&
    rangesIntersect(e.dateFrom, e.dateTo, candidate.dateFrom, candidate.dateTo);

  for (const e of existing.filter(sameSlot)) {
    if (candidate.roomRef && id(e.roomRef) === id(candidate.roomRef))
      errors.push({ code: "room_double_booked", message: `Room already booked for "${e.subject}" (${e.time})`, entry: summary(e) });
    const sameFaculty = (candidate.facultyRef && id(e.facultyRef) === id(candidate.facultyRef)) ||
      (!candidate.facultyRef && candidate.faculty && e.faculty && e.faculty.toLowerCase() === candidate.faculty.toLowerCase());
    if (sameFaculty)
      errors.push({ code: "faculty_double_booked", message: `Faculty already teaching "${e.subject}" (${e.time})`, entry: summary(e) });
    if (candidate.section && candidate.course && e.section === candidate.section && e.course === candidate.course)
      errors.push({ code: "section_double_booked", message: `Section already has "${e.subject}" (${e.time})`, entry: summary(e) });
  }
  if (room) {
    if (candidate.studentCount > room.capacity)
      errors.push({ code: "capacity_exceeded", message: `${candidate.studentCount} students exceed room capacity ${room.capacity}` });
    if (room.operationalStatus === "inactive")
      errors.push({ code: "room_inactive", message: "Room is inactive" });
    if (room.maintenanceStatus === "under_maintenance")
      errors.push({ code: "room_under_maintenance", message: "Room is flagged under maintenance" });
  }
  // One-off blockers (maintenance / approved reservations) on dates this weekly slot would run. Warnings only.
  if (candidate.dateFrom && candidate.dateTo && oneOffs.length) {
    const dates = eachDate(candidate.dateFrom, candidate.dateTo, 366).filter((d) => weekdayOf(d) === candidate.day);
    const hits = [];
    for (const d of dates) {
      const iv = slotToInterval(d, candidate.startMinutes, candidate.endMinutes);
      if (oneOffs.some((o) => overlaps(o, iv))) hits.push(d);
    }
    if (hits.length) warnings.push({ code: "blocked_on_dates", message: `Room is under maintenance or reserved on ${hits.length} scheduled date(s)`, dates: hits.slice(0, 10) });
  }
  return { errors, warnings };
}

module.exports = { checkEntryConflicts };
