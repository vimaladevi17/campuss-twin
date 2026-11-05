import { useState } from "react";
import http, { errorMessage } from "../../api/http";
import { useToast } from "../../context/ToastContext";
import { Modal, Btn, Field } from "../../components/ui";

export const EQUIPMENT_TYPES = ["desktop_computer", "workstation", "networking", "electronics", "scientific_instrument", "projector", "specialized", "other"];
const label = (t) => t.replace(/_/g, " ");

// Equipment is edited one item at a time. Matching during lab replacement counts WORKING units only.
export default function RoomEquipmentModal({ room: initial, onClose, onChanged }) {
  const { toast } = useToast();
  const [room, setRoom] = useState(initial);
  const [draft, setDraft] = useState({ type: "desktop_computer", name: "", quantity: 1, workingQuantity: 1 });
  const [busy, setBusy] = useState(false);

  const run = async (fn, ok) => {
    setBusy(true);
    try { const r = await fn(); setRoom(r.data); toast(ok); onChanged && onChanged(); }
    catch (e) { toast(errorMessage(e, "Could not save equipment."), "error"); }
    finally { setBusy(false); }
  };
  const [edits, setEdits] = useState({});
  const val = (item, k) => edits[item._id]?.[k] ?? item[k];
  const setEdit = (item, k, v) => setEdits({ ...edits, [item._id]: { ...edits[item._id], [k]: v } });

  return (
    <Modal wide title={`Equipment: ${room.roomNumber}${room.name ? ` (${room.name})` : ""}`} onClose={onClose}>
      {(room.equipment || []).length === 0 && <p className="text-sm text-muted">No equipment recorded yet.</p>}
      {(room.equipment || []).length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Type</th><th>Name</th><th>Quantity</th><th>Working</th><th /></tr></thead>
            <tbody>
              {room.equipment.map((item) => (
                <tr key={item._id}>
                  <td>{label(item.type)}</td>
                  <td><input aria-label="Name" value={val(item, "name") || ""} onChange={(e) => setEdit(item, "name", e.target.value)} /></td>
                  <td><input aria-label="Quantity" type="number" min="0" style={{ width: 80 }} value={val(item, "quantity")} onChange={(e) => setEdit(item, "quantity", e.target.value)} /></td>
                  <td><input aria-label="Working quantity" type="number" min="0" style={{ width: 80 }} value={val(item, "workingQuantity")} onChange={(e) => setEdit(item, "workingQuantity", e.target.value)} /></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Btn kind="ghost" disabled={busy || !edits[item._id]} onClick={() => run(() => http.put(`/rooms/${room._id}/equipment/${item._id}`, Object.fromEntries(Object.entries(edits[item._id]).map(([k, v]) => [k, k === "name" ? v : Number(v)]))).then((r) => { setEdits({ ...edits, [item._id]: undefined }); return r; }), "Equipment updated")}>Save</Btn>{" "}
                    <Btn kind="danger" disabled={busy} onClick={() => run(() => http.delete(`/rooms/${room._id}/equipment/${item._id}`), "Equipment removed")}>Remove</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3 className="text-sm font-semibold text-ink" style={{ margin: "16px 0 8px" }}>Add equipment</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <Field label="Type"><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>{EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></Field>
        <Field label="Name"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
        <Field label="Quantity"><input type="number" min="0" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value, workingQuantity: e.target.value })} /></Field>
        <Field label="Working"><input type="number" min="0" value={draft.workingQuantity} onChange={(e) => setDraft({ ...draft, workingQuantity: e.target.value })} /></Field>
      </div>
      <div style={{ marginTop: 12 }}>
        <Btn disabled={busy} onClick={() => run(() => http.post(`/rooms/${room._id}/equipment`, { ...draft, quantity: Number(draft.quantity), workingQuantity: Number(draft.workingQuantity) }), "Equipment added")}>Add</Btn>
      </div>
    </Modal>
  );
}
