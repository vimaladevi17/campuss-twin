import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import http, { errorMessage } from "../../api/http";
import { useToast } from "../../context/ToastContext";
import { Confirm } from "../../components/ui";
import { arrayToCsv, csvToArray, getPath } from "../../lib/time";
import RoomEquipmentModal from "../twin/RoomEquipmentModal";
import "./Manage.css";

const optValue = (o) => (typeof o === "object" ? o.value : o);
const optLabel = (o) => (typeof o === "object" ? o.label : o === "" ? "—" : o);

// ---- form <-> API conversion (exported for tests) ----
export function emptyForm(config) {
  const form = {};
  config.fields.forEach((f) => {
    if (f.type === "geopoint") { form[`${f.name}__lat`] = ""; form[`${f.name}__lng`] = ""; }
    else form[f.name] = f.defaultValue ?? "";
  });
  return form;
}
export function formFromItem(config, item) {
  const form = {};
  config.fields.forEach((f) => {
    const v = item[f.name];
    if (f.type === "password") form[f.name] = "";
    else if (f.type === "csv") form[f.name] = arrayToCsv(v);
    else if (f.type === "geopoint") {
      form[`${f.name}__lat`] = v?.coordinates ? String(v.coordinates[1]) : "";
      form[`${f.name}__lng`] = v?.coordinates ? String(v.coordinates[0]) : "";
    } else if (f.optionsFrom) form[f.name] = v && typeof v === "object" ? v._id : v ?? "";
    else form[f.name] = v ?? "";
  });
  return form;
}
// returns { payload } or { error }
export function payloadFromForm(config, form, editing) {
  const payload = { ...(config.fixed || {}) };
  for (const f of config.fields) {
    const required = f.required || (f.requiredOnCreate && !editing);
    if (f.type === "geopoint") {
      const lat = form[`${f.name}__lat`], lng = form[`${f.name}__lng`];
      if (lat === "" && lng === "") { if (required) return { error: `${f.label} is required` }; continue; }
      const la = Number(lat), ln = Number(lng);
      if (lat === "" || lng === "" || !Number.isFinite(la) || !Number.isFinite(ln) || la < -90 || la > 90 || ln < -180 || ln > 180)
        return { error: `${f.label}: enter a valid latitude (-90 to 90) and longitude (-180 to 180)` };
      payload[f.name] = { type: "Point", coordinates: [ln, la] };
      continue;
    }
    let v = form[f.name];
    if (f.type === "password" && editing && v === "") continue;
    if (f.type === "csv") { payload[f.name] = csvToArray(v); continue; }
    if (f.type === "number") {
      if (v === "" || v === undefined) { if (required) return { error: `${f.label} is required` }; continue; }
      v = Number(v);
      if (!Number.isFinite(v)) return { error: `${f.label} must be a number` };
      const min = f.min ?? 1;   // same default as the input element
      if (v < min) return { error: `${f.label} must be at least ${min}` };
    }
    if ((v === "" || v === undefined) && (f.optionsFrom || f.type === "select") && !required) { if (editing && f.optionsFrom) payload[f.name] = null; continue; }
    if (required && (v === "" || v === undefined || v === null)) return { error: `${f.label} is required` };
    payload[f.name] = v;
  }
  return { payload };
}

function OptionsSelect({ field, form, common }) {
  const [opts, setOpts] = useState([]);
  const dep = field.optionsFrom.dependsOn ? form[field.optionsFrom.dependsOn] : undefined;
  useEffect(() => {
    let alive = true;
    const { endpoint, param } = field.optionsFrom;
    if (field.optionsFrom.dependsOn && !dep) { setOpts([]); return undefined; }
    http.get(endpoint, { params: param ? { [param]: dep } : undefined }).then((r) => alive && setOpts(r.data)).catch(() => alive && setOpts([]));
    return () => { alive = false; };
  }, [field.optionsFrom, dep]);
  const label = field.optionsFrom.label;
  return (
    <select {...common}>
      <option value="">{field.optionsFrom.dependsOn && !dep ? "Select the parent first" : "— select —"}</option>
      {opts.map((o) => <option key={o._id} value={o._id}>{typeof label === "function" ? label(o) : o[label || "name"]}</option>)}
    </select>
  );
}

function ManageResource({ config }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(emptyForm(config));
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const [equipFor, setEquipFor] = useState(null);

  const loadItems = async () => {
    try {
      const response = await http.get(config.endpoint, { params: config.query });
      setItems(response.data);
      setLoadError("");
    } catch (err) {
      setLoadError(errorMessage(err, `Unable to load ${config.title.toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadItems(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    const next = { ...form, [name]: value };
    // changing a parent select clears dependants (e.g. building -> floor)
    config.fields.forEach((f) => { if (f.optionsFrom?.dependsOn === name) next[f.name] = ""; });
    setForm(next);
  };
  const resetForm = () => { setForm(emptyForm(config)); setEditingId(null); setError(""); };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    const { payload, error: problem } = payloadFromForm(config, form, Boolean(editingId));
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      if (editingId) { await http.put(`${config.endpoint}/${editingId}`, payload); toast(`${config.title} updated successfully`); }
      else { await http.post(config.endpoint, payload); toast(`${config.title} added successfully`); }
      resetForm();
      await loadItems();
    } catch (err) {
      setError(errorMessage(err, "Could not save. Please check the form."));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setForm(formFromItem(config, item));
    setEditingId(item._id);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = async () => {
    const item = toDelete;
    setToDelete(null);
    try {
      await http.delete(`${config.endpoint}/${item._id}`);
      toast(`${config.title} deleted successfully`);
      setItems((prev) => prev.filter((row) => row._id !== item._id));
      if (editingId === item._id) resetForm();
    } catch (err) {
      toast(errorMessage(err, "Could not delete."), "error");   // e.g. 409: "building still has rooms"
    }
  };

  const cellText = (item, column) => (column.render ? column.render(item) : getPath(item, column.key));
  const shown = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => config.columns.map((c) => String(cellText(item, c) ?? "")).join(" ").toLowerCase().includes(q));
  }, [items, search, config]);

  return (
    <div className="manage-page">
      {config.tabs && (
        <div className="manage-tabs">
          {config.tabs.map(([path, label]) => (
            <Link key={path} to={path} className={label === config.title ? "active" : ""}>{label}</Link>
          ))}
        </div>
      )}

      <h1>Manage {config.title}</h1>
      {config.intro && <p className="manage-note">{config.intro}</p>}
      {error && <div className="manage-alert manage-error" role="alert">{error}</div>}

      <form className="manage-form" onSubmit={handleSubmit} noValidate>
        <h2>{editingId ? `Edit ${config.singular}` : `Add ${config.singular}`}</h2>
        <div className="manage-fields">
          {config.fields.map((field) => {
            const isRequired = field.required || (field.requiredOnCreate && !editingId);
            const id = `field-${field.name}`;
            const common = { id, name: field.name, value: form[field.name] ?? "", onChange: handleChange };
            return (
              <div className={`manage-field ${field.type === "textarea" ? "wide" : ""}`} key={field.name}>
                <label htmlFor={id}>{field.label}{isRequired ? " *" : ""}</label>

                {field.optionsFrom && <OptionsSelect field={field} form={form} common={common} />}
                {!field.optionsFrom && field.type === "select" && (
                  <select {...common}>{field.options.map((o) => <option key={optValue(o)} value={optValue(o)}>{optLabel(o)}</option>)}</select>
                )}
                {field.type === "textarea" && <textarea rows="3" {...common} />}
                {field.type === "geopoint" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input id={`${id}-lat`} aria-label={`${field.label} latitude`} placeholder="Latitude" inputMode="decimal" value={form[`${field.name}__lat`]} onChange={(e) => setForm({ ...form, [`${field.name}__lat`]: e.target.value })} />
                    <input id={`${id}-lng`} aria-label={`${field.label} longitude`} placeholder="Longitude" inputMode="decimal" value={form[`${field.name}__lng`]} onChange={(e) => setForm({ ...form, [`${field.name}__lng`]: e.target.value })} />
                  </div>
                )}
                {!field.optionsFrom && !["select", "textarea", "geopoint"].includes(field.type) && (
                  <input
                    type={field.type === "csv" ? "text" : field.type}
                    min={field.type === "number" ? field.min ?? 1 : undefined}
                    step={field.step}
                    placeholder={field.type === "csv" ? "comma, separated" : undefined}
                    list={field.suggestions ? `list-${field.name}` : undefined}
                    autoComplete={field.type === "password" ? "new-password" : "off"}
                    {...common}
                  />
                )}
                {field.suggestions && <datalist id={`list-${field.name}`}>{field.suggestions.map((o) => <option key={o} value={o} />)}</datalist>}
                {field.hint && (editingId || !field.hintOnEdit) && <small>{field.hint}</small>}
              </div>
            );
          })}
        </div>
        <div className="manage-buttons">
          <button type="submit" className="manage-primary" disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Add"}</button>
          {editingId && <button type="button" className="manage-secondary" onClick={resetForm}>Cancel edit</button>}
        </div>
      </form>

      <div className="manage-list">
        <div className="manage-list-head">
          <h2>All {config.title.toLowerCase()} ({items.length})</h2>
          <input type="text" placeholder="Search..." aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading && <p className="manage-note">Loading...</p>}
        {loadError && <p className="manage-note manage-error-text">{loadError}</p>}
        {!loading && !loadError && shown.length === 0 && <p className="manage-note">Nothing to show yet.</p>}
        {shown.length > 0 && (
          <div className="manage-table-wrap">
            <table className="manage-table">
              <thead><tr>{config.columns.map((c) => <th key={c.key}>{c.label}</th>)}<th>Actions</th></tr></thead>
              <tbody>
                {shown.map((item) => (
                  <tr key={item._id}>
                    {config.columns.map((c) => (
                      <td key={c.key}>
                        {c.badge ? <span className={`badge badge-${String(getPath(item, c.key)).toLowerCase()}`}>{getPath(item, c.key)}</span> : cellText(item, c)}
                      </td>
                    ))}
                    <td className="manage-actions">
                      {config.equipment && <button type="button" onClick={() => setEquipFor(item)}>Equipment</button>}
                      <button type="button" onClick={() => handleEdit(item)}>Edit</button>
                      <button type="button" className="danger" onClick={() => setToDelete(item)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toDelete && <Confirm danger confirmLabel="Delete" message={`Delete this ${config.singular}? This cannot be undone.`} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />}
      {equipFor && <RoomEquipmentModal room={equipFor} onClose={() => setEquipFor(null)} onChanged={loadItems} />}
    </div>
  );
}
export default ManageResource;
