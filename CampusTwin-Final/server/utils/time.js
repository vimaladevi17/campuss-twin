// All campus times are Asia/Kolkata (UTC+05:30, no daylight saving).
// Times of day are stored as minutes after midnight; dates as "YYYY-MM-DD".
const IST_OFFSET_MIN = 330;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function isDateStr(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

// "9:30", "09:30", "9:30 AM", "2:15 pm" -> minutes after midnight, or null
function parseHHMM(input) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\s*$/.exec(String(input ?? ""));
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3] && m[3].toLowerCase();
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
  } else if (h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

function formatHHMM(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// "10:00-11:00" / "10:00 – 11:00" / "9:00 AM - 10:00 AM" -> { start, end } or null
function parseTimeRange(text) {
  const parts = String(text ?? "").split(/\s*[-–—]\s*|\s+to\s+/i);
  if (parts.length !== 2) return null;
  const start = parseHHMM(parts[0]);
  let end = parseHHMM(parts[1]);
  if (start === null || end === null) return null;
  return end > start ? { start, end } : null;
}

const pad = (n) => String(n).padStart(2, "0");

function midnightMs(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - IST_OFFSET_MIN * 60000;
}

function slotToInterval(dateStr, startMin, endMin) {
  const base = midnightMs(dateStr);
  return { start: base + startMin * 60000, end: base + endMin * 60000 };
}

// absolute time -> { date, minutes, day } in campus time
function toCampusParts(value) {
  const ms = value instanceof Date ? value.getTime() : Number(value);
  const shifted = new Date(ms + IST_OFFSET_MIN * 60000);
  const date = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  return {
    date,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    day: DAY_NAMES[shifted.getUTCDay()],
  };
}

function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

// inclusive list of dates (capped so a typo cannot loop for years)
function eachDate(from, to, max = 400) {
  const out = [];
  for (let d = from; d <= to && out.length < max; d = addDays(d, 1)) out.push(d);
  return out;
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

// date ranges with optional (open) ends
function rangesIntersect(f1, t1, f2, t2) {
  const aFrom = f1 || "0000-01-01", aTo = t1 || "9999-12-31";
  const bFrom = f2 || "0000-01-01", bTo = t2 || "9999-12-31";
  return aFrom <= bTo && bFrom <= aTo;
}

module.exports = {
  IST_OFFSET_MIN, DAY_NAMES, isDateStr, parseHHMM, formatHHMM, parseTimeRange,
  midnightMs, slotToInterval, toCampusParts, weekdayOf, addDays, eachDate,
  overlaps, rangesIntersect,
};
