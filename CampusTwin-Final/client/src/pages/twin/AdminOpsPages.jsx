import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import http, { errorMessage } from "../../api/http";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { PageHeader, Card, Btn, State, Badge, Field, Confirm } from "../../components/ui";
import { fmtIst, istToIso, todayIst, minutesToHHMM } from "../../lib/time";

const roomLabel = (r) => (r ? `${r.roomNumber}${r.name ? ` (${r.name})` : ""}` : "");
function useRooms() {
  const [rooms, setRooms] = useState([]);
  useEffect(() => { http.get("/rooms").then((r) => setRooms(Array.isArray(r.data) ? r.data : r.data.items || [])).catch(() => setRooms([])); }, []);
  return rooms;
}

/* ---------------- Maintenance records (admin) ---------------- */
export function MaintenancePage() {
  const { toast } = useToast();
  const rooms = useRooms();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ room: "", reason: "", start: "", end: "", analyze: true });
  const [confirm, setConfirm] = useState(null);
  const load = useCallback(async () => {
    try { setItems((await http.get("/maintenance", { params: status ? { status } : undefined })).data); setError(""); }
    catch (e) { setError(errorMessage(e, "Unable to load maintenance records.")); } finally { setLoading(false); }
  }, [status]);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    const startAt = istToIso(form.start), endAt = istToIso(form.end);
    if (!form.room || !form.reason.trim() || !startAt || !endAt) { toast("Choose a room, enter a reason and both times.", "error"); return; }
    if (new Date(endAt) <= new Date(startAt)) { toast("The end must be after the start.", "error"); return; }
    try {
      const r = await http.post("/maintenance", { room: form.room, reason: form.reason.trim(), startAt, endAt, analyze: form.analyze });
      toast(r.data.replacement ? "Maintenance saved. A replacement analysis is waiting for review." : "Maintenance saved.");
      setForm({ room: "", reason: "", start: "", end: "", analyze: true }); load();
    } catch (err) { toast(errorMessage(err), "error"); }
  };
  const act = async (fn, ok) => { try { await fn(); toast(ok); load(); } catch (err) { toast(errorMessage(err), "error"); } finally { setConfirm(null); } };

  return (
    <>
      <PageHeader title="Maintenance" subtitle="Rooms under maintenance are removed from vacancy results and replacement candidates." />
      <Card title="Record maintenance">
        <form onSubmit={create} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <Field label="Room"><select value={form.room} onChange={set("room")}><option value="">— select —</option>{rooms.map((r) => <option key={r._id} value={r._id}>{roomLabel(r)}{r.building?.name ? ` · ${r.building.name}` : ""}</option>)}</select></Field>
          <Field label="Reason"><input value={form.reason} onChange={set("reason")} maxLength={200} /></Field>
          <Field label="Starts (IST)"><input type="datetime-local" value={form.start} onChange={set("start")} /></Field>
          <Field label="Ends (IST)"><input type="datetime-local" value={form.end} onChange={set("end")} /></Field>
          <label className="text-sm" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={form.analyze} onChange={set("analyze")} />Find replacement rooms for affected classes</label>
          <div><Btn type="submit">Save record</Btn></div>
        </form>
      </Card>
      <div style={{ height: 14 }} />
      <Card title="Records" right={<select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["scheduled", "completed", "cancelled"].map((s) => <option key={s}>{s}</option>)}</select>}>
        <State loading={loading} error={error} empty={items.length === 0} emptyText="No maintenance records.">
          <div style={{ overflowX: "auto" }}><table className="text-sm" style={{ width: "100%" }}>
            <thead><tr><th align="left">Room / building</th><th align="left">Reason</th><th align="left">From</th><th align="left">To</th><th align="left">Status</th><th /></tr></thead>
            <tbody>{items.map((m) => (
              <tr key={m._id}>
                <td>{m.room ? roomLabel(m.room) : m.building ? `${m.building.name} (whole building)` : ""}</td><td>{m.reason}</td><td>{fmtIst(m.startAt)}</td><td>{fmtIst(m.endAt)}</td>
                <td><Badge tone={m.status === "scheduled" ? "maintenance" : "neutral"}>{m.status}</Badge></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {m.status === "scheduled" && <Btn kind="ghost" onClick={() => act(() => http.put(`/maintenance/${m._id}`, { status: "completed" }), "Marked completed")}>Complete</Btn>}{" "}
                  {m.status === "scheduled" && <Btn kind="ghost" onClick={() => act(() => http.put(`/maintenance/${m._id}`, { status: "cancelled" }), "Cancelled")}>Cancel</Btn>}{" "}
                  <Btn kind="danger" onClick={() => setConfirm(m)}>Delete</Btn>
                </td>
              </tr>))}</tbody>
          </table></div>
        </State>
      </Card>
      <p className="text-sm text-muted" style={{ marginTop: 10 }}>Replacement requests created from maintenance are reviewed under <Link to="/replacements">Smart Lab Replacement</Link>.</p>
      {confirm && <Confirm danger confirmLabel="Delete" message={`Delete the maintenance record for ${roomLabel(confirm.room) || "this building"}? The room becomes available again. The action is written to the audit history.`}
        onCancel={() => setConfirm(null)} onConfirm={() => act(() => http.delete(`/maintenance/${confirm._id}`), "Record deleted")} />}
    </>
  );
}

/* ---------------- Room reservations (faculty request, admin decide) ---------------- */
const TONE = { pending: "occupied", approved: "available", rejected: "unavailable", cancelled: "neutral" };
export function ReservationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const admin = user.role === "admin";
  const rooms = useRooms();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ room: "", title: "", date: todayIst(), startTime: "09:00", endTime: "10:00" });
  const load = useCallback(async () => {
    try { setItems((await http.get("/reservations", { params: status ? { status } : undefined })).data); setError(""); }
    catch (e) { setError(errorMessage(e, "Unable to load reservations.")); } finally { setLoading(false); }
  }, [status]);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!form.room || !form.title.trim()) { toast("Choose a room and enter a title.", "error"); return; }
    if (form.endTime <= form.startTime) { toast("The end time must be after the start time.", "error"); return; }
    try { await http.post("/reservations", { ...form, title: form.title.trim() }); toast(admin ? "Reservation approved." : "Request sent for approval."); setForm({ ...form, title: "" }); load(); }
    catch (err) { toast(errorMessage(err), "error"); }
  };
  const act = async (call, ok) => { try { await call(); toast(ok); load(); } catch (err) { toast(errorMessage(err), "error"); } };
  return (
    <>
      <PageHeader title="Room Reservations" subtitle={admin ? "Review requests and reserve rooms. A reservation blocks the room in the timetable and vacancy finder." : "Request a free room. An administrator approves it."} />
      <Card title="New reservation">
        <form onSubmit={submit} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
          <Field label="Room"><select value={form.room} onChange={set("room")}><option value="">— select —</option>{rooms.map((r) => <option key={r._id} value={r._id}>{roomLabel(r)}</option>)}</select></Field>
          <Field label="Title"><input value={form.title} onChange={set("title")} maxLength={120} /></Field>
          <Field label="Date"><input type="date" value={form.date} onChange={set("date")} /></Field>
          <Field label="From"><input type="time" value={form.startTime} onChange={set("startTime")} /></Field>
          <Field label="To"><input type="time" value={form.endTime} onChange={set("endTime")} /></Field>
          <div style={{ alignSelf: "end" }}><Btn type="submit">{admin ? "Reserve" : "Request"}</Btn></div>
        </form>
      </Card>
      <div style={{ height: 14 }} />
      <Card title="Reservations" right={<select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["pending", "approved", "rejected", "cancelled"].map((s) => <option key={s}>{s}</option>)}</select>}>
        <State loading={loading} error={error} empty={items.length === 0} emptyText="No reservations.">
          <div style={{ overflowX: "auto" }}><table className="text-sm" style={{ width: "100%" }}>
            <thead><tr><th align="left">Date</th><th align="left">Time</th><th align="left">Room</th><th align="left">Title</th><th align="left">Status</th><th /></tr></thead>
            <tbody>{items.map((r) => (
              <tr key={r._id}>
                <td>{r.date}</td><td>{minutesToHHMM(r.startMinutes)}-{minutesToHHMM(r.endMinutes)}</td><td>{roomLabel(r.room)}</td><td>{r.title}</td>
                <td><Badge tone={TONE[r.status]}>{r.status}</Badge></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {admin && r.status === "pending" && <><Btn kind="ok" onClick={() => act(() => http.post(`/reservations/${r._id}/approve`), "Approved")}>Approve</Btn>{" "}<Btn kind="danger" onClick={() => act(() => http.post(`/reservations/${r._id}/reject`), "Rejected")}>Reject</Btn>{" "}</>}
                  {["pending", "approved"].includes(r.status) && <Btn kind="ghost" onClick={() => act(() => http.post(`/reservations/${r._id}/cancel`), "Cancelled")}>Cancel</Btn>}
                </td>
              </tr>))}</tbody>
          </table></div>
        </State>
      </Card>
    </>
  );
}

/* ---------------- Audit history (admin) ---------------- */
export function AuditPage() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    http.get("/audit-logs", { params: { entity: entity || undefined, action: action || undefined, page, limit: 25 } })
      .then((r) => { setData(r.data); setError(""); }).catch((e) => setError(errorMessage(e, "Unable to load the audit history."))).finally(() => setLoading(false));
  }, [entity, action, page]);
  return (
    <>
      <PageHeader title="Audit History" subtitle={`${data.total} recorded administrative action(s).`} />
      <Card right={<span style={{ display: "flex", gap: 8 }}>
        <select aria-label="Filter by entity" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}><option value="">All entities</option>{["building", "floor", "room", "facility", "course", "timetable", "reservation", "maintenance", "replacement", "settings"].map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Filter by action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}><option value="">All actions</option>{["create", "update", "delete", "approve", "reject"].map((s) => <option key={s}>{s}</option>)}</select></span>}>
        <State loading={loading} error={error} empty={data.items.length === 0} emptyText="No audit entries match.">
          <div style={{ overflowX: "auto" }}><table className="text-sm" style={{ width: "100%" }}>
            <thead><tr><th align="left">When (IST)</th><th align="left">Who</th><th align="left">Action</th><th align="left">Entity</th><th align="left">Details</th></tr></thead>
            <tbody>{data.items.map((a) => <tr key={a._id}><td>{fmtIst(a.createdAt)}</td><td>{a.actorName || "system"}</td><td>{a.action}</td><td>{a.entity}</td><td className="text-muted" style={{ maxWidth: 360, overflowWrap: "anywhere" }}>{a.details ? JSON.stringify(a.details).slice(0, 160) : ""}</td></tr>)}</tbody>
          </table></div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", marginTop: 10 }}>
            <Btn kind="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Btn><span className="text-sm text-muted">Page {data.page} of {data.pages || 1}</span>
            <Btn kind="ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Btn>
          </div>
        </State>
      </Card>
    </>
  );
}
