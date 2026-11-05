import { useEffect, useState } from "react";
import http, { errorMessage } from "../../api/http";
import { PageHeader, Card, Field, Btn, State, StatusBadge } from "../../components/ui";
import { todayIst } from "../../lib/time";
import { EQUIPMENT_TYPES } from "./RoomEquipmentModal";

export function buildVacancyQuery(f) {
  const q = { date: f.date, startTime: f.startTime, endTime: f.endTime };
  if (f.building) q.building = f.building;
  if (f.type) q.type = f.type;
  if (Number(f.capacity) > 0) q.capacity = Number(f.capacity);
  if (f.equipType) q.equipment = `${f.equipType}:${Math.max(1, Number(f.equipQty) || 1)}`;
  return q;
}

export default function VacancyPage() {
  const [f, setF] = useState({ date: todayIst(), startTime: "10:00", endTime: "11:00", building: "", type: "", capacity: "", equipType: "", equipQty: 1 });
  const [buildings, setBuildings] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { http.get("/buildings").then((r) => setBuildings(r.data)).catch(() => {}); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const search = async (e) => {
    e.preventDefault();
    setError("");
    if (f.endTime <= f.startTime) { setError("End time must be after start time."); return; }
    setLoading(true);
    try { setResult((await http.get("/availability/vacant", { params: buildVacancyQuery(f) })).data); }
    catch (err) { setError(errorMessage(err, "Could not search for vacant rooms.")); setResult(null); }
    finally { setLoading(false); }
  };

  return (
    <>
      <PageHeader title="Vacancy Finder" subtitle="Rooms that are free for the whole window, calculated from the timetable, reservations, maintenance and approved room changes." />
      <Card>
        <form onSubmit={search} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, alignItems: "end" }}>
          <Field label="Date"><input type="date" required value={f.date} onChange={set("date")} /></Field>
          <Field label="Start"><input type="time" required value={f.startTime} onChange={set("startTime")} /></Field>
          <Field label="End"><input type="time" required value={f.endTime} onChange={set("endTime")} /></Field>
          <Field label="Building"><select value={f.building} onChange={set("building")}><option value="">Any</option>{buildings.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></Field>
          <Field label="Room type"><select value={f.type} onChange={set("type")}><option value="">Any</option><option value="classroom">Classroom</option><option value="laboratory">Laboratory</option><option value="seminar_hall">Seminar hall</option></select></Field>
          <Field label="Min. capacity"><input type="number" min="1" value={f.capacity} onChange={set("capacity")} /></Field>
          <Field label="Equipment"><select value={f.equipType} onChange={set("equipType")}><option value="">None required</option>{EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></Field>
          {f.equipType && <Field label="Min. working units"><input type="number" min="1" value={f.equipQty} onChange={set("equipQty")} /></Field>}
          <Btn type="submit" disabled={loading}>{loading ? "Searching…" : "Find vacant rooms"}</Btn>
        </form>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title={result ? `${result.count} room(s) free ${result.window.start}–${result.window.end} on ${result.date}` : "Results"}>
          <State loading={loading} error={error} empty={!result} emptyText="Choose a date and time window, then search.">
            {result && result.count === 0 ? <p className="text-sm text-muted">No room matches. Try a shorter window, a lower capacity or fewer equipment requirements.</p> : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead><tr><th>Room</th><th>Building</th><th>Floor</th><th>Type</th><th>Capacity</th><th>Equipment</th><th>Free slots that day</th><th>Status</th></tr></thead>
                  <tbody>
                    {result?.rooms.map((r) => (
                      <tr key={r.roomId}>
                        <td><strong>{r.roomNumber}</strong>{r.name && <div className="text-xs text-muted">{r.name}</div>}</td>
                        <td>{r.building?.name}</td>
                        <td>{r.floor ? r.floor.name || `Floor ${r.floor.number}` : "—"}</td>
                        <td>{r.type}</td>
                        <td>{r.capacity}</td>
                        <td>{r.equipment?.length ? r.equipment.map((e) => `${e.quantity}× ${e.name || e.type.replace(/_/g, " ")}`).join(", ") : "—"}</td>
                        <td>{r.freeSlots.map((s) => `${s.start}–${s.end}`).join(", ") || "—"}</td>
                        <td><StatusBadge status="available" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </State>
        </Card>
      </div>
    </>
  );
}
