import { Link } from "react-router-dom";

const BAR = { available: "#16a34a", occupied: "#ea580c", maintenance: "#7c3aed", unavailable: "#dc2626" };
const Tile = ({ label, value, to }) => (
  <Link to={to} className="bg-white border border-slate-200 rounded-xl p-3 no-underline text-slate-800 block">
    <div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-semibold">{value ?? 0}</div>
  </Link>
);

// Digital-twin figures for the admin dashboard. Everything except the two campus reference
// statistics (area, open space) is calculated from MongoDB.
export default function TwinStats({ twin }) {
  const total = Object.values(twin.roomStatus).reduce((a, b) => a + b, 0);
  const labTotal = Object.values(twin.labStatus).reduce((a, b) => a + b, 0);
  const Bar = ({ counts, sum }) => (
    sum === 0 ? <p className="text-sm text-slate-500">No rooms yet.</p> : (
      <>
        <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "#e2e8f0" }} role="img" aria-label="Room availability chart">
          {Object.entries(counts).map(([k, n]) => n > 0 && <div key={k} title={`${k}: ${n}`} style={{ width: `${(n / sum) * 100}%`, background: BAR[k] }} />)}
        </div>
        <div className="text-xs text-slate-600 mt-1.5" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(counts).map(([k, n]) => <span key={k}><span style={{ color: BAR[k] }}>●</span> {k} {n}</span>)}
        </div>
      </>
    )
  );
  return (
    <div style={{ margin: "0 0 24px" }}>
      <h2 style={{ margin: "0 0 10px" }}>Digital Twin Overview</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
        <Tile label="Buildings" value={twin.buildings} to="/admin/buildings" />
        <Tile label="Floors" value={twin.floors} to="/admin/floors" />
        <Tile label="Classrooms" value={twin.classrooms} to="/admin/classrooms" />
        <Tile label="Laboratories" value={twin.laboratories} to="/admin/laboratories" />
        <Tile label="Facilities" value={twin.facilities} to="/admin/facilities" />
        <Tile label="Today's classes" value={twin.todaysClasses} to="/timetable" />
        <Tile label="Pending replacements" value={twin.pendingReplacements} to="/replacements" />
        <Tile label="Active maintenance" value={twin.pendingMaintenance} to="/replacements" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginTop: 12 }}>
        <div className="bg-white border border-slate-200 rounded-xl p-3"><h3 className="text-sm font-semibold m-0 mb-2">Room availability right now</h3><Bar counts={twin.roomStatus} sum={total} /></div>
        <div className="bg-white border border-slate-200 rounded-xl p-3"><h3 className="text-sm font-semibold m-0 mb-2">Laboratory status</h3><Bar counts={twin.labStatus} sum={labTotal} /></div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm">
          <h3 className="text-sm font-semibold m-0 mb-2">Campus reference</h3>
          <div>Total area: <strong>{twin.campus.totalAreaSqm.toLocaleString()} m²</strong></div>
          <div>Open space: <strong>{twin.campus.openSpaceRatioPct}%</strong></div>
          <div className="text-xs text-slate-500 mt-1">{twin.campus.referenceNote}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm">
          <h3 className="text-sm font-semibold m-0 mb-2">Facilities by category</h3>
          {Object.keys(twin.facilitiesByCategory).length === 0 ? <span className="text-slate-500">None imported yet.</span> :
            Object.entries(twin.facilitiesByCategory).map(([k, n]) => <div key={k} style={{ display: "flex", justifyContent: "space-between" }}><span>{k.replace(/_/g, " ")}</span><strong>{n}</strong></div>)}
        </div>
      </div>
      {twin.timetableEntriesNeedingRoomLink > 0 && <p className="text-sm text-amber-700 mt-2">⚠ {twin.timetableEntriesNeedingRoomLink} timetable row(s) are not linked to a room, so they are ignored by conflict and vacancy checks. Edit them in Timetable to link a room.</p>}
      {twin.recentActivity.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 mt-3 text-sm">
          <h3 className="text-sm font-semibold m-0 mb-2">Recent updates</h3>
          {twin.recentActivity.map((a, i) => <div key={i} className="text-slate-600">{new Date(a.at).toLocaleString()} · {a.actor || "system"} {a.action}d {a.entity}</div>)}
        </div>
      )}
    </div>
  );
}
