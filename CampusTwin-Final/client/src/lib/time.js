// Campus time is Asia/Kolkata (UTC+05:30). Browser <input type="datetime-local"> has no zone,
// so values typed in the app are always treated as campus time, whatever the viewer's laptop zone is.
const IST_MIN = 330;

export function istToIso(local) {            // "2026-11-02T10:00" -> "2026-11-02T10:00:00+05:30"
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local || "") ? `${local}:00+05:30` : "";
}
export function todayIst(now = new Date()) {
  const d = new Date(now.getTime() + IST_MIN * 60000);
  return d.toISOString().slice(0, 10);
}
export function fmtIst(value) {              // ISO/Date -> "02 Nov 2026, 10:00"
  if (!value) return "";
  const d = new Date(new Date(value).getTime() + IST_MIN * 60000);
  const p = (n) => String(n).padStart(2, "0");
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${p(d.getUTCDate())} ${mon} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
export const minutesToHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const csvToArray = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
export const arrayToCsv = (a) => (Array.isArray(a) ? a.join(", ") : "");
export const getPath = (obj, path) => String(path).split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

export const STATUS_LABEL = { available: "Available", occupied: "Occupied", maintenance: "Under maintenance", unavailable: "Unavailable" };
export const VERIFICATION_LABEL = {
  verified_college: "Verified from college source", imported_excel: "Imported from Excel", extracted_osm: "Extracted from OpenStreetMap",
  digitized_master_plan: "Digitized from master plan (approximate)", manual: "Manually entered", estimated_unverified: "Estimated / unverified",
};
