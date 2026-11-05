import { useCallback, useEffect, useState } from "react";
import http, { errorMessage } from "../../api/http";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { PageHeader, Card, Field, Btn, State, Badge, Modal, Confirm } from "../../components/ui";
import { todayIst, minutesToHHMM, csvToArray, arrayToCsv } from "../../lib/time";
import { EQUIPMENT_TYPES } from "./RoomEquipmentModal";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const blank = () => ({ day: "Monday", subject: "", course: "", section: "", semester: "", studentCount: "", classType: "lecture", building: "", roomRef: "", facultyRef: "",
  startTime: "09:00", endTime: "10:00", dateFrom: "", dateTo: "", requiredEquipment: [], specialRequirements: "" });

export function entryToForm(e) {
  return { ...blank(), ...e, building: e.building?._id || e.building || e.roomRef?.building || "", roomRef: e.roomRef?._id || e.roomRef || "", facultyRef: e.facultyRef?._id || e.facultyRef || "",
    startTime: e.startMinutes != null ? minutesToHHMM(e.startMinutes) : "09:00", endTime: e.endMinutes != null ? minutesToHHMM(e.endMinutes) : "10:00",
    studentCount: e.studentCount ?? "", dateFrom: e.dateFrom || "", dateTo: e.dateTo || "", requiredEquipment: e.requiredEquipment || [], specialRequirements: arrayToCsv(e.specialRequirements) };
}
export function formToPayload(f) {
  const p = { day: f.day, subject: f.subject.trim(), course: f.course.trim(), section: f.section.trim(), semester: f.semester.trim(), classType: f.classType,
    studentCount: f.studentCount === "" ? 0 : Number(f.studentCount), startTime: f.startTime, endTime: f.endTime,
    requiredEquipment: f.requiredEquipment.filter((r) => r.type).map((r) => ({ type: r.type, minQuantity: Math.max(1, Number(r.minQuantity) || 1) })),
    specialRequirements: csvToArray(f.specialRequirements), dateFrom: f.dateFrom || undefined, dateTo: f.dateTo || undefined };
  if (f.roomRef) p.roomRef = f.roomRef;
  if (f.facultyRef) p.facultyRef = f.facultyRef;
  return p;
}

function EntryForm({ initial, onSaved, onClose }) {
  const { toast } = useToast();
  const [f, setF] = useState(initial);
  const [buildings, setBuildings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [problem, setProblem] = useState(null);   // { message, conflicts, warnings }
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial._id);

  useEffect(() => { Promise.all([http.get("/buildings"), http.get("/faculty")]).then(([b, fa]) => { setBuildings(b.data); setFaculty(fa.data); }).catch(() => {}); }, []);
  useEffect(() => {
    if (!f.building) { setRooms([]); return; }
    http.get("/rooms", { params: { building: f.building } }).then((r) => setRooms(r.data)).catch(() => setRooms([]));
  }, [f.building]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const check = (e) => (e.response?.data ? { message: e.response.data.message, conflicts: e.response.data.conflicts || [], warnings: e.response.data.warnings || [] } : { message: errorMessage(e), conflicts: [], warnings: [] });
  const localError = () => (!f.subject.trim() ? "Subject is required." : !f.facultyRef ? "Select a faculty member." : !f.roomRef ? "Select a room." : f.endTime <= f.startTime ? "End time must be after start time." : f.dateFrom && f.dateTo && f.dateFrom > f.dateTo ? "Date range ends before it starts." : "");

  const validate = async () => {
    const le = localError(); if (le) { setProblem({ message: le, conflicts: [], warnings: [] }); return; }
    setBusy(true);
    try { const r = await http.post("/timetable/validate", { ...formToPayload(f), ...(editing ? { _id: initial._id } : {}) }); setProblem(r.data.valid ? { message: "", ok: true, conflicts: [], warnings: r.data.warnings } : { message: r.data.conflicts[0].message, conflicts: r.data.conflicts, warnings: r.data.warnings }); }
    catch (e) { setProblem(check(e)); } finally { setBusy(false); }
  };
  const save = async () => {
    const le = localError(); if (le) { setProblem({ message: le, conflicts: [], warnings: [] }); return; }
    setBusy(true);
    try {
      if (editing) await http.put(`/timetable/${initial._id}`, formToPayload(f)); else await http.post("/timetable", formToPayload(f));
      toast(editing ? "Timetable entry updated" : "Timetable entry added"); onSaved();
    } catch (e) { setProblem(check(e)); } finally { setBusy(false); }
  };
  const eq = f.requiredEquipment;
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 };

  return (
    <Modal wide title={editing ? "Edit timetable entry" : "Add timetable entry"} onClose={onClose}>
      <div style={grid}>
        <Field label="Subject *"><input value={f.subject} onChange={set("subject")} /></Field>
        <Field label="Course"><input value={f.course} onChange={set("course")} placeholder="e.g. CSE" /></Field>
        <Field label="Semester / year"><input value={f.semester} onChange={set("semester")} /></Field>
        <Field label="Section"><input value={f.section} onChange={set("section")} /></Field>
        <Field label="Student count"><input type="number" min="0" value={f.studentCount} onChange={set("studentCount")} /></Field>
        <Field label="Class type"><select value={f.classType} onChange={set("classType")}>{["lecture", "lab", "tutorial", "seminar", "exam", "other"].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Faculty *"><select value={f.facultyRef} onChange={set("facultyRef")}><option value="">Select…</option>{faculty.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</select></Field>
        <Field label="Building *"><select value={f.building} onChange={(e) => setF({ ...f, building: e.target.value, roomRef: "" })}><option value="">Select…</option>{buildings.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></Field>
        <Field label="Classroom / laboratory *"><select value={f.roomRef} onChange={set("roomRef")}><option value="">{f.building ? "Select…" : "Choose a building first"}</option>{rooms.map((r) => <option key={r._id} value={r._id}>{r.roomNumber} ({r.type}, {r.capacity} seats)</option>)}</select></Field>
        <Field label="Day *"><select value={f.day} onChange={set("day")}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Start *"><input type="time" value={f.startTime} onChange={set("startTime")} /></Field>
        <Field label="End *"><input type="time" value={f.endTime} onChange={set("endTime")} /></Field>
        <Field label="From date" hint="Blank = every week"><input type="date" value={f.dateFrom} onChange={set("dateFrom")} /></Field>
        <Field label="To date"><input type="date" value={f.dateTo} onChange={set("dateTo")} /></Field>
        <Field label="Special requirements" hint="comma separated, e.g. air_conditioned"><input value={f.specialRequirements} onChange={set("specialRequirements")} /></Field>
      </div>

      <h3 className="text-sm font-semibold text-ink" style={{ margin: "14px 0 6px" }}>Required equipment (used when a lab must be replaced)</h3>
      {eq.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <select aria-label="Equipment type" value={r.type} onChange={(e) => setF({ ...f, requiredEquipment: eq.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })}>{EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select>
          <input aria-label="Minimum working units" type="number" min="1" style={{ width: 100 }} value={r.minQuantity} onChange={(e) => setF({ ...f, requiredEquipment: eq.map((x, j) => (j === i ? { ...x, minQuantity: e.target.value } : x)) })} />
          <Btn kind="ghost" onClick={() => setF({ ...f, requiredEquipment: eq.filter((_, j) => j !== i) })}>Remove</Btn>
        </div>
      ))}
      <Btn kind="ghost" onClick={() => setF({ ...f, requiredEquipment: [...eq, { type: "desktop_computer", minQuantity: Number(f.studentCount) || 1 }] })}>+ Add equipment requirement</Btn>

      {problem && (problem.message || problem.ok || problem.warnings.length > 0) && (
        <div role="alert" style={{ marginTop: 14 }} className={`text-sm rounded-lg p-3 border ${problem.ok ? "border-ok" : "border-bad"}`}>
          {problem.ok ? <strong className="text-ok">No conflicts found.</strong> : <strong className="text-bad">{problem.message}</strong>}
          {problem.conflicts.length > 1 && <ul style={{ margin: "6px 0 0 18px" }}>{problem.conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>}
          {problem.warnings.map((w, i) => <p key={i} className="text-busy" style={{ margin: "6px 0 0" }}>⚠ {w.message}{w.dates ? `: ${w.dates.join(", ")}` : ""}</p>)}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <Btn kind="ghost" disabled={busy} onClick={validate}>Check conflicts</Btn>
        <Btn disabled={busy} onClick={save}>{busy ? "Working…" : editing ? "Save changes" : "Add entry"}</Btn>
      </div>
    </Modal>
  );
}

function EntryCard({ e, admin, onEdit, onDelete }) {
  const room = e.effective?.room;
  return (
    <div className="border border-line rounded-lg p-3 bg-surface2 text-sm">
      <div className="flex justify-between gap-2"><strong className="text-ink">{e.subject}</strong><span className="text-muted whitespace-nowrap">{e.time}</span></div>
      <div className="text-muted">{e.faculty}{e.section ? ` · ${e.course} ${e.section}` : e.className ? ` · ${e.className}` : ""}</div>
      <div className="mt-1 flex flex-wrap gap-1.5 items-center">
        <Badge tone={e.effective?.changed ? "selected" : "neutral"}>{room ? `${room.roomNumber}` : e.room}</Badge>
        {e.effective?.changed && <Badge tone="selected">Moved for this date</Badge>}
        {e.isDemo && <Badge tone="demo">DEMO</Badge>}
        {e.needsReview && <Badge tone="warn">Room not linked</Badge>}
        {e.studentCount > 0 && <span className="text-xs text-muted">{e.studentCount} students</span>}
      </div>
      {admin && <div className="mt-2 flex gap-2"><Btn kind="ghost" onClick={() => onEdit(e)}>Edit</Btn><Btn kind="danger" onClick={() => onDelete(e)}>Delete</Btn></div>}
    </div>
  );
}

export default function TimetablePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const admin = user.role === "admin";
  const [view, setView] = useState("day");
  const [date, setDate] = useState(todayIst());
  const [mine, setMine] = useState(user.role === "faculty");
  const [facultyQ, setFacultyQ] = useState("");
  const [building, setBuilding] = useState("");
  const [buildings, setBuildings] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => { http.get("/buildings").then((r) => setBuildings(r.data)).catch(() => {}); }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (view === "day") params.date = date;
      if (mine) params.mine = "true";
      if (facultyQ.trim()) params.faculty = facultyQ.trim();
      if (building) params.building = building;
      setItems((await http.get("/timetable", { params })).data); setError("");
    } catch (e) { setError(errorMessage(e, "Unable to load the timetable.")); } finally { setLoading(false); }
  }, [view, date, mine, facultyQ, building]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const del = async () => {
    const e = toDelete; setToDelete(null);
    try { await http.delete(`/timetable/${e._id}`); toast("Timetable entry deleted"); load(); } catch (err) { toast(errorMessage(err, "Could not delete."), "error"); }
  };
  const demoCount = items.filter((i) => i.isDemo).length;

  return (
    <>
      <PageHeader title="Timetable" subtitle={view === "day" ? "Showing the effective schedule for the chosen date, including approved room changes." : "Weekly schedule."}
        actions={admin && <Btn onClick={() => setEditing(blank())}>+ Add entry</Btn>} />
      <Card>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <Field label="View"><select value={view} onChange={(e) => setView(e.target.value)}><option value="day">Daily</option><option value="week">Weekly</option></select></Field>
          {view === "day" && <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
          <Field label="Building"><select value={building} onChange={(e) => setBuilding(e.target.value)}><option value="">All</option>{buildings.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></Field>
          <Field label="Faculty"><input placeholder="Search name" value={facultyQ} onChange={(e) => setFacultyQ(e.target.value)} /></Field>
          {user.role !== "student" && <label className="text-sm flex items-center gap-2" style={{ paddingBottom: 8 }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only my classes</label>}
        </div>
      </Card>
      {demoCount > 0 && <p className="text-sm text-maint" style={{ margin: "12px 0 0" }}>⚠ {demoCount} entr{demoCount === 1 ? "y is" : "ies are"} DEMO sample data, not an official KARE schedule.</p>}

      <div style={{ marginTop: 16 }}>
        <State loading={loading} error={error} empty={items.length === 0} emptyText={view === "day" ? `No classes on ${date}.` : "No timetable entries yet."}>
          {view === "day" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
              {items.map((e) => <EntryCard key={e._id} e={e} admin={admin} onEdit={(x) => setEditing(entryToForm(x))} onDelete={setToDelete} />)}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              {DAYS.map((d) => (
                <Card key={d} title={d}>
                  <div style={{ display: "grid", gap: 8 }}>
                    {items.filter((e) => e.day === d).map((e) => <EntryCard key={e._id} e={e} admin={admin} onEdit={(x) => setEditing(entryToForm(x))} onDelete={setToDelete} />)}
                    {!items.some((e) => e.day === d) && <p className="text-xs text-muted">No classes</p>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </State>
      </div>

      {editing && <EntryForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {toDelete && <Confirm danger confirmLabel="Delete" message={`Delete "${toDelete.subject}" (${toDelete.day} ${toDelete.time})? Any approved room changes for it are cancelled.`} onConfirm={del} onCancel={() => setToDelete(null)} />}
    </>
  );
}
