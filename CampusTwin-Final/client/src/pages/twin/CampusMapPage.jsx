import { useEffect, useMemo, useState } from "react";
import CampusMapView from "../../components/map/CampusMapView";
import { nearbyAccessibility, extrusionOf, CATEGORY_COLOR, colorOfFacility } from "../../components/map/mapStyle";
import http, { errorMessage } from "../../api/http";
import { useAuth } from "../../context/AuthContext";
import { PageHeader, Card, Badge, StatusBadge, State } from "../../components/ui";
import { VERIFICATION_LABEL } from "../../lib/time";

// Campus map: MapLibre GL JS (2D) + deck.gl (3D). Every feature is loaded from the backend API / MongoDB.
export const CHIPS = [
  { key: "academic", label: "Academic", test: (f) => f.category === "academic" && f.layer === "general" },
  { key: "hostel", label: "Hostel", test: (f) => f.category === "hostel" },
  { key: "food", label: "Food", test: (f) => f.category === "food" },
  { key: "library", label: "Library", test: (f) => (f.tags || []).includes("library") },
  { key: "sports", label: "Sports", test: (f) => f.category === "sports" },
  { key: "parking", label: "Parking", test: (f) => (f.tags || []).includes("parking") || f.category === "transport_parking" },
  { key: "transport", label: "Transport", test: (f) => f.category === "transport_parking" || f.accessibilityType === "transportation" },
  { key: "healthcare", label: "Healthcare", test: (f) => f.category === "healthcare" },
  { key: "accessibility", label: "Accessibility", test: (f) => f.layer === "accessibility" },
  { key: "other", label: "Other", test: (f) => ["amenity", "shop", "toilet", "other"].includes(f.category) && f.layer === "general" },
];
const A11Y = [["accessible_toilet", "Accessible toilet"], ["accessible_ramp", "Accessible ramp"], ["day_care", "Day care"], ["lactation_room", "Lactation room"], ["transportation", "Transportation"]];
const COLOR_UNUSED = { academic: "#1d4ed8", hostel: "#0d9488", food: "#d97706", sports: "#9333ea", transport_parking: "#475569", amenity: "#db2777", library: "#1d4ed8", healthcare: "#e11d48", shop: "#a16207", toilet: "#0891b2", accessibility: "#16a34a", other: "#64748b" };
const colorOf = colorOfFacility;
const COLOR = CATEGORY_COLOR;
export const filterFacilities = (all, active, query) => {
  const q = query.trim().toLowerCase();
  return all.filter((f) => (active.size === 0 || [...active].some((k) => CHIPS.find((c) => c.key === k)?.test(f))) && (!q || `${f.name} ${f.description || ""}`.toLowerCase().includes(q)));
};

function BuildingPanel({ b, loggedIn, facilities }) {
  const near = nearbyAccessibility(facilities || [], b.centroid, 100);
  const [ov, setOv] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setOv(null); setErr("");
    if (loggedIn) http.get(`/buildings/${b.id}/overview`).then((r) => setOv(r.data)).catch((e) => setErr(errorMessage(e)));
  }, [b.id, loggedIn]);
  return (
    <>
      <h3 className="text-base font-semibold text-ink">{b.name}</h3>
      <p className="text-sm text-muted">Code {b.code} · {b.category} · {b.floors} floor(s)</p>
      <p className="text-sm">Height: {extrusionOf(b).label}</p>
      {b.isDemo && <Badge tone="demo">DEMO building details</Badge>}
      <p className="text-xs text-muted">{VERIFICATION_LABEL[b.verification] || b.verification}</p>
      <p className="text-sm">Rooms: {b.rooms.total || 0} ({b.rooms.classrooms || 0} classrooms, {b.rooms.laboratories || 0} labs)</p>
      <p className="text-sm" style={{ marginTop: 6 }}><strong>Accessibility nearby (within 100 m)</strong></p>
      {near.length === 0 ? <p className="text-xs text-muted">No accessibility facility is recorded within 100 m. This does not mean the building is inaccessible; the data may be incomplete.</p>
        : near.slice(0, 6).map(({ f, d }) => <div key={f.id} className="text-sm">{(A11Y.find(([k]) => k === f.accessibilityType) || [0, f.name])[1]}: {f.name} <span className="text-muted">({d} m)</span></div>)}
      {!loggedIn && <p className="text-xs text-muted">Log in to see floors, rooms and live availability.</p>}
      {err && <p className="text-xs text-bad">{err}</p>}
      {ov && ov.floors.map((fl) => (
        <div key={fl._id} style={{ marginTop: 8 }}>
          <strong className="text-sm">{fl.name || `Floor ${fl.number}`}</strong>
          {fl.rooms.map((r) => <div key={r._id} className="text-sm flex justify-between gap-2"><span>{r.roomNumber} <span className="text-muted">({r.type}, {r.capacity})</span></span><StatusBadge status={r.liveStatus.status} /></div>)}
          {fl.rooms.length === 0 && <div className="text-xs text-muted">No rooms</div>}
        </div>
      ))}
    </>
  );
}

export default function CampusMapPage({ layer = "general" }) {
  const { user } = useAuth();
  const [facilities, setFacilities] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [paths, setPaths] = useState([]);
  const [boundary, setBoundary] = useState([]);
  const [center, setCenter] = useState([9.5743, 77.6761]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(() => new Set(layer === "accessibility" ? ["accessibility"] : []));
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(null);
  const [mode, setMode] = useState("2d");
  const [layers, setLayers] = useState({ buildings: true, labels: true, facilities: true, paths: true, boundary: true });
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [focus, setFocus] = useState(null);

  useEffect(() => { setActive(new Set(layer === "accessibility" ? ["accessibility"] : [])); setSel(null); }, [layer]);
  useEffect(() => {
    Promise.all([http.get("/map/facilities"), http.get("/map/buildings"), http.get("/map/paths"), http.get("/map/boundary"), http.get("/settings")])
      .then(([f, b, p, bd, s]) => {
        setFacilities(f.data.features.map((x) => ({ ...x.properties, coordinates: x.geometry.coordinates })));
        setBuildings(b.data.features);
        setPaths(p.data.features);
        setBoundary(bd.data.features || []);
        if (s.data.referencePoint) setCenter([s.data.referencePoint.lat, s.data.referencePoint.lng]);
      })
      .catch((e) => setError(errorMessage(e, "Unable to load the campus map data.")))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => filterFacilities(facilities, active, query), [facilities, active, query]);
  const shownBuildings = useMemo(() => buildings.filter((b) => (!query.trim() || b.properties.name.toLowerCase().includes(query.trim().toLowerCase())) && (active.size === 0 || active.has("academic") || (active.has("hostel") && b.properties.category === "hostel"))), [buildings, active, query]);
  const toggle = (k) => { const n = new Set(active); n.has(k) ? n.delete(k) : n.add(k); setActive(n); };
  const accessibilityMode = layer === "accessibility";
  const empty = !loading && !error && facilities.length === 0 && buildings.length === 0;

  const select = ({ kind, id }) => {
    if (kind === "building") { const b = buildings.find((x) => x.id === id); if (b) setSel({ kind, id, props: b.properties }); }
    else { const f = facilities.find((x) => x.id === id); if (f) setSel({ kind, id, props: f }); }
  };
  const pickAndFly = (kind, id, coordinates) => { select({ kind, id }); if (coordinates) setFocus({ coordinates, zoom: 18.5, t: Date.now() }); };
  const flat = (b) => b.properties.centroid || (b.geometry.type === "Point" ? b.geometry.coordinates : null);
  const toggleLayer = (k) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const LAYER_LABELS = [["buildings", "Buildings"], ["labels", "Labels"], ["facilities", "Facilities"], ["paths", "Paths"], ["boundary", "Boundary"]];
  const noHeights = buildings.length > 0 && buildings.every((b) => extrusionOf(b.properties).height === 0);

  return (
    <>
      <PageHeader title={accessibilityMode ? "Accessibility Map" : "Campus Map"} subtitle={accessibilityMode ? "Accessible toilets, ramps, day care, lactation rooms and transportation." : "Search the campus, filter by category and switch between 2D and 3D. Data comes from the campus database."} />
      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input type="search" aria-label="Search the map" placeholder="Search buildings and facilities…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 240 }} />
          {CHIPS.map((c) => (
            <button key={c.key} type="button" aria-pressed={active.has(c.key)} onClick={() => toggle(c.key)}
              className={`text-sm rounded-full px-3 py-1 border ${active.has(c.key) ? "bg-brand text-white border-brand" : "bg-surface2 text-ink border-line"}`}>{c.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <div role="group" aria-label="Map mode" style={{ display: "inline-flex", border: "1px solid var(--ct-line, #cbd5e1)", borderRadius: 8, overflow: "hidden" }}>
            {["2d", "3d"].map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`text-sm px-3 py-1 ${mode === m ? "bg-brand text-white" : "bg-surface2 text-ink"}`} style={{ border: 0 }}>{m.toUpperCase()}</button>)}
          </div>
          {LAYER_LABELS.map(([k, l]) => (
            <label key={k} className="text-sm" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} />{l}</label>
          ))}
          <label className="text-sm" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={accessibleOnly} onChange={() => setAccessibleOnly((v) => !v)} />Step-free paths only</label>
        </div>
      </Card>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14, alignItems: "flex-start" }}>
        <div style={{ flex: "2 1 480px", minWidth: 0 }}>
          <State loading={loading} error={error} empty={empty} emptyText="No campus data has been loaded yet. An administrator can import the KARE facilities workbook (npm run import:facilities) and the GIS data (npm run import:gis).">
            <div style={{ height: "68vh", minHeight: 380 }}>
              <CampusMapView buildings={shownBuildings} facilities={shown} paths={paths} boundary={boundary} selected={sel} onSelect={select} mode={mode} layers={layers} center={center} focus={focus} accessiblePathsOnly={accessibleOnly} />
            </div>
            <p className="text-xs text-muted" style={{ marginTop: 6 }}>
              {buildings.filter((b) => b.properties.hasFootprint).length} building outline(s), {paths.length} path segment(s){boundary.length ? "" : ", no campus boundary loaded"}.
              {mode === "3d" && (noHeights ? " No building has height data, so nothing is extruded." : " Taller blocks use stored heights; estimated heights are derived from floor counts and are not measurements.")}
            </p>
          </State>
        </div>
        <div style={{ flex: "1 1 280px", display: "grid", gap: 14, minWidth: 0 }}>
          <Card title={sel ? (sel.kind === "building" ? "Building" : "Facility") : `${shown.length} facilit${shown.length === 1 ? "y" : "ies"}, ${shownBuildings.length} building(s) shown`}>
            {!sel && <p className="text-sm text-muted">Select a building or marker for details, or pick from the results below.</p>}
            {sel?.kind === "building" && <BuildingPanel b={sel.props} loggedIn={Boolean(user)} facilities={facilities} />}
            {sel?.kind === "facility" && (
              <>
                <h3 className="text-base font-semibold text-ink">{sel.props.name}</h3>
                <p className="text-sm text-muted">{sel.props.layer === "accessibility" ? (A11Y.find(([k]) => k === sel.props.accessibilityType)?.[1] || "Accessibility") : sel.props.category.replace(/_/g, " ")} · {sel.props.status.replace(/_/g, " ")}</p>
                {sel.props.description && <p className="text-sm">{sel.props.description}</p>}
                <p className="text-xs text-muted">{VERIFICATION_LABEL[sel.props.verification] || sel.props.verification}. Position approximate (±~10 m).</p>
              </>
            )}
            {sel && <button type="button" className="text-sm" style={{ background: "none", border: 0, color: "var(--ct-brand)", padding: 0, marginTop: 6 }} onClick={() => setSel(null)}>Clear selection</button>}
          </Card>
          {!sel && (shown.length > 0 || shownBuildings.length > 0) && (
            <Card title="Results"><div style={{ maxHeight: 260, overflowY: "auto", display: "grid", gap: 2 }}>
              {shownBuildings.slice(0, 40).map((b) => <button key={b.id} type="button" className="text-left text-sm py-1 bg-transparent border-0 text-ink" onClick={() => pickAndFly("building", b.id, flat(b))}><span style={{ color: COLOR[b.properties.category] || COLOR.other }}>▮</span> {b.properties.name} <span className="text-muted">({b.properties.code})</span></button>)}
              {shown.slice(0, 80).map((f) => <button key={f.id} type="button" className="text-left text-sm py-1 bg-transparent border-0 text-ink" onClick={() => pickAndFly("facility", f.id, f.coordinates)}><span style={{ color: colorOf(f) }}>●</span> {f.name}</button>)}
            </div></Card>
          )}
          <Card title="Legend">
            <p className="text-xs text-muted" style={{ margin: "0 0 6px" }}>Room status colours (building panel)</p>
            <div className="text-sm" style={{ display: "grid", gap: 3 }}>
              {[["#16a34a", "Available"], ["#dc2626", "Unavailable"], ["#ea580c", "Occupied"], ["#7c3aed", "Under maintenance"], ["#2563eb", "Selected / recommended"]].map(([c, l]) => <span key={l}><span style={{ color: c }}>●</span> {l}</span>)}
            </div>
            <p className="text-xs text-muted" style={{ margin: "10px 0 4px" }}>Facility and building colours by category:</p>
            <div className="text-xs" style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
              {Object.entries({ academic: "Academic", hostel: "Hostel", food: "Food", sports: "Sports", transport_parking: "Transit/parking", amenity: "Amenity", healthcare: "Healthcare", accessibility: "Accessibility" }).map(([k, l]) => <span key={k}><span style={{ color: COLOR[k] }}>●</span> {l}</span>)}
            </div>
            <p className="text-xs text-muted" style={{ margin: "10px 0 4px" }}>Paths</p>
            <div className="text-xs" style={{ display: "grid", gap: 2 }}>
              <span><span style={{ color: "#16a34a" }}>━</span> Step-free</span><span><span style={{ color: "#94a3b8" }}>━</span> Not confirmed step-free</span><span><span style={{ color: "#b45309" }}>━</span> Stairs</span><span>┅ Campus boundary (only if loaded)</span>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
