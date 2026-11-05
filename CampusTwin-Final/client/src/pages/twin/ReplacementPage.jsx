import { useCallback, useEffect, useMemo, useState } from "react";
import http, { errorMessage } from "../../api/http";
import { useToast } from "../../context/ToastContext";
import { PageHeader, Card, Field, Btn, State, Badge, Confirm } from "../../components/ui";
import MiniMap from "../../components/MiniMap";
import { istToIso, fmtIst } from "../../lib/time";

const TYPE_NOTE = { network: "walking route", unavailable: "no connected walking route, distance unavailable", same_building: "same building", unknown: "unknown" };
const STATUS_TONE = { pending: "warn", approved: "available", partially_approved: "selected", rejected: "unavailable", no_affected_classes: "neutral" };

// Map points: original lab red, recommended green, other eligible blue (spec colours)
export function mapPoints(occ, chosenRoomId) {
  const pts = [];
  const o = occ.summary.originalRoom.building;
  if (o?.coordinates) pts.push({ lng: o.coordinates[0], lat: o.coordinates[1], color: "#dc2626", label: `Unavailable: ${occ.summary.originalRoom.roomNumber} (${o.name})`, radius: 13 });
  for (const c of occ.candidates) {
    const co = c.building?.coordinates; if (!co) continue;
    const picked = c.roomId === chosenRoomId;
    pts.push({ lng: co[0], lat: co[1], color: picked ? "#16a34a" : "#2563eb", label: `${picked ? "Recommended" : "Alternative"}: ${c.roomNumber} (${c.building.name})`, radius: picked ? 13 : 9 });
  }
  return pts;
}
export const buildSelections = (req, choices) =>
  req.occurrences.filter((o) => o.decision === "pending" && choices[o._id]).map((o) => ({ occurrenceId: o._id, roomId: choices[o._id] }));

function Occurrence({ occ, choice, onChoose, editable }) {
  const pts = useMemo(() => mapPoints(occ, choice), [occ, choice]);
  const req = occ.requirements || {};
  const equipText = (req.equipment || []).map((e) => `${e.minQuantity}× ${e.type.replace(/_/g, " ")}`).join(", ") || "none specified";
  return (
    <Card title={`${occ.summary.subject}: ${occ.date} ${occ.summary.time}`} right={<Badge tone={occ.decision === "approved" ? "available" : occ.decision === "no_alternative" ? "unavailable" : "warn"}>{occ.decision.replace("_", " ")}</Badge>}>
      <p className="text-sm text-muted" style={{ margin: "0 0 8px" }}>
        {occ.summary.faculty} · {occ.summary.course} {occ.summary.section} · {req.studentCount} students · needs: {equipText} · original: <strong>{occ.summary.originalRoom.roomNumber}</strong>
      </p>
      {occ.candidates.length === 0 ? <p className="text-sm text-bad">{occ.explanation}</p> : (
        <>
          {occ.explanation && <p className="text-sm text-busy">{occ.explanation}</p>}
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr>{editable && <th />}<th>Original lab</th><th>Alternative</th><th>Building</th><th>Floor</th><th>Capacity</th><th>Equipment match</th><th>Walking</th><th>Time</th><th>Score</th><th>Why</th></tr></thead>
              <tbody>
                {occ.candidates.map((c, i) => (
                  <tr key={c.roomId} style={c.roomId === choice ? { background: "var(--ct-brand-soft)" } : undefined}>
                    {editable && <td><input type="radio" name={`occ-${occ._id}`} aria-label={`Choose ${c.roomNumber}`} checked={c.roomId === choice} onChange={() => onChoose(c.roomId)} /></td>}
                    <td>{occ.summary.originalRoom.roomNumber}</td>
                    <td><strong>{c.roomNumber}</strong> {c.roomId === occ.suggestedRoom && <Badge tone="available">Recommended</Badge>}{i > 0 && c.roomId !== occ.suggestedRoom && <span className="text-xs text-muted"> #{i + 1}</span>}</td>
                    <td>{c.building?.name}</td>
                    <td>{c.floor ? c.floor.name || `Floor ${c.floor.number}` : "—"}</td>
                    <td>{c.capacity}</td>
                    <td>All required equipment present</td>
                    <td>{c.walking.meters == null ? "unavailable" : `${c.walking.meters} m`}<div className="text-xs text-muted">{TYPE_NOTE[c.walking.type]}</div></td>
                    <td>{c.walking.minutes == null ? "—" : `${c.walking.minutes} min`}</td>
                    <td><strong>{c.total}</strong><div className="text-xs text-muted" title="availability / equipment / capacity / distance">{c.scores.availability}/{c.scores.equipment}/{c.scores.capacity}/{c.scores.distance}</div></td>
                    <td className="text-xs">{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pts.length > 0 && <div style={{ marginTop: 10 }}><MiniMap points={pts} height={240} />
            <p className="text-xs text-muted" style={{ margin: "4px 0 0" }}><span style={{ color: "#dc2626" }}>●</span> unavailable lab &nbsp;<span style={{ color: "#16a34a" }}>●</span> selected alternative &nbsp;<span style={{ color: "#2563eb" }}>●</span> other alternatives. Positions are building markers; a pedestrian route is drawn only once path data exists.</p></div>}
        </>
      )}
      {occ.rejected.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary className="text-sm text-muted" style={{ cursor: "pointer" }}>{occ.rejected.length} room(s) rejected (hard constraints)</summary>
          <ul className="text-sm" style={{ margin: "6px 0 0 18px" }}>{occ.rejected.map((r) => <li key={r.roomId}><strong>{r.roomNumber}</strong> ({r.building?.name}): {r.reasons.join("; ")}</li>)}</ul>
        </details>
      )}
    </Card>
  );
}

export default function ReplacementPage() {
  const { toast } = useToast();
  const [labs, setLabs] = useState([]);
  const [form, setForm] = useState({ room: "", startAt: "", endAt: "", reason: "", record: true });
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [choices, setChoices] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);

  const loadList = useCallback(async () => {
    try { setList((await http.get("/replacements")).data); setError(""); } catch (e) { setError(errorMessage(e, "Unable to load replacement requests.")); } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadList(); http.get("/rooms", { params: { type: "laboratory" } }).then((r) => setLabs(r.data)).catch(() => {}); }, [loadList]);

  const open = useCallback(async (id) => {
    try {
      const doc = (await http.get(`/replacements/${id}`)).data;
      setSelected(doc);
      setChoices(Object.fromEntries(doc.occurrences.filter((o) => o.decision === "pending" && o.suggestedRoom).map((o) => [o._id, o.suggestedRoom])));
    } catch (e) { toast(errorMessage(e), "error"); }
  }, [toast]);

  const analyze = async (e) => {
    e.preventDefault();
    if (!form.room || !form.startAt || !form.endAt) { toast("Choose a lab and the start and end time.", "error"); return; }
    if (form.endAt <= form.startAt) { toast("End must be after start.", "error"); return; }
    const body = { room: form.room, startAt: istToIso(form.startAt), endAt: istToIso(form.endAt), reason: form.reason.trim() || "Laboratory unavailable" };
    setBusy(true);
    try {
      const doc = form.record ? (await http.post("/maintenance", { ...body, analyze: true })).data.replacement : (await http.post("/replacements/analyze", body)).data;
      await loadList();
      if (doc) { await open(doc._id); toast(doc.status === "no_affected_classes" ? "Saved. No scheduled classes are affected." : `${doc.occurrences.length} affected class(es) analysed.`, "info"); }
      else toast("Maintenance recorded. No analysis was produced.", "info");
    } catch (err) { toast(errorMessage(err, "Analysis failed."), "error"); } finally { setBusy(false); }
  };

  const decide = async (kind) => {
    setConfirm(null); setBusy(true);
    try {
      if (kind === "reject") await http.post(`/replacements/${selected._id}/reject`, { note: "Rejected by administrator" });
      else await http.post(`/replacements/${selected._id}/approve`, { selections: buildSelections(selected, choices) });
      toast(kind === "reject" ? "Recommendation rejected. Timetable unchanged." : "Approved. Timetable and availability updated; faculty notified.");
      await open(selected._id); await loadList();
    } catch (err) {
      const probs = err.response?.data?.problems;
      toast(probs ? `${err.response.data.message} ${probs.map((p) => p.reasons.join(", ")).join(" | ")}` : errorMessage(err, "Could not complete."), "error");
      await open(selected._id);
    } finally { setBusy(false); }
  };
  const selections = selected ? buildSelections(selected, choices) : [];
  const decidable = selected && ["pending", "partially_approved"].includes(selected.status);

  return (
    <>
      <PageHeader title="Smart Lab Replacement" subtitle="When a lab becomes unavailable, find affected classes and rank alternatives. Nothing changes until you approve." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, alignItems: "start" }}>
        <Card title="1. Mark a lab unavailable">
          <form onSubmit={analyze} style={{ display: "grid", gap: 10 }}>
            <Field label="Laboratory *"><select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}><option value="">Select…</option>{labs.map((l) => <option key={l._id} value={l._id}>{l.roomNumber}{l.building?.name ? ` · ${l.building.name}` : ""}</option>)}</select></Field>
            <Field label="From (campus time) *"><input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></Field>
            <Field label="Until (campus time) *"><input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></Field>
            <Field label="Reason"><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. AC repair" /></Field>
            <label className="text-sm flex gap-2 items-start"><input type="checkbox" checked={form.record} onChange={(e) => setForm({ ...form, record: e.target.checked })} /> Also record a maintenance block so the lab shows as unavailable everywhere (untick for a what-if analysis)</label>
            <Btn type="submit" disabled={busy}>{busy ? "Analysing…" : "Find affected classes & alternatives"}</Btn>
          </form>
        </Card>
        <Card title="Requests">
          <State loading={loading} error={error} empty={list.length === 0} emptyText="No replacement requests yet.">
            <div style={{ display: "grid", gap: 6 }}>
              {list.map((r) => (
                <button key={r._id} type="button" onClick={() => open(r._id)} className="text-left border border-line rounded-lg p-2.5 bg-surface2 text-sm" style={selected?._id === r._id ? { outline: "2px solid var(--ct-brand)" } : undefined}>
                  <div className="flex justify-between gap-2"><strong className="text-ink">{r.room?.roomNumber || "Room"}</strong><Badge tone={STATUS_TONE[r.status]}>{r.status.replace(/_/g, " ")}</Badge></div>
                  <div className="text-muted">{fmtIst(r.startAt)} → {fmtIst(r.endAt)} · {r.occurrences.length} class(es)</div>
                </button>
              ))}
            </div>
          </State>
        </Card>
      </div>

      {selected && (
        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <Card title={`${selected.room?.roomNumber || "Lab"} unavailable ${fmtIst(selected.startAt)} → ${fmtIst(selected.endAt)}`} right={<Badge tone={STATUS_TONE[selected.status]}>{selected.status.replace(/_/g, " ")}</Badge>}>
            <p className="text-sm text-muted">{selected.reason}. Weights: availability {Math.round(selected.weights.availability * 100)}%, equipment {Math.round(selected.weights.equipment * 100)}%, capacity {Math.round(selected.weights.capacity * 100)}%, distance {Math.round(selected.weights.distance * 100)}%.</p>
            {selected.status === "no_affected_classes" && <p className="text-sm text-ok">No scheduled class uses this lab in that period, so nothing needs to move.</p>}
            {selected.decidedAt && <p className="text-sm text-muted">Decision: {fmtIst(selected.decidedAt)}{selected.decidedBy?.name ? ` by ${selected.decidedBy.name}` : ""}{selected.decisionNote ? `. ${selected.decisionNote}` : ""}. The original allocation is preserved in the timetable.</p>}
          </Card>
          {selected.occurrences.map((o) => <Occurrence key={o._id} occ={o} editable={decidable && o.decision === "pending"} choice={choices[o._id]} onChoose={(id) => setChoices({ ...choices, [o._id]: id })} />)}
          {decidable && selected.occurrences.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn kind="ok" disabled={busy || selections.length === 0} onClick={() => setConfirm("approve")}>Approve {selections.length} selected replacement(s)</Btn>
              <Btn kind="danger" disabled={busy} onClick={() => setConfirm("reject")}>Reject recommendation</Btn>
            </div>
          )}
        </div>
      )}
      {confirm && <Confirm danger={confirm === "reject"} confirmLabel={confirm === "reject" ? "Reject" : "Approve"} onCancel={() => setConfirm(null)} onConfirm={() => decide(confirm)}
        message={confirm === "reject" ? "Reject this recommendation? The timetable stays unchanged." : `Approve ${selections.length} room change(s)? The affected faculty will be notified. The original allocation is kept in the record.`} />}
    </>
  );
}
