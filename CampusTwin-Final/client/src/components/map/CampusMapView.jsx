import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer, ScatterplotLayer, PathLayer, TextLayer } from "@deck.gl/layers";
import { BASE_STYLE, colorOfFacility, colorOfBuilding, hex2rgb, extrusionOf } from "./mapStyle";

const fc = (features) => ({ type: "FeatureCollection", features });

// 2D = native MapLibre layers. 3D = the same data drawn by deck.gl (extruded buildings) on top of MapLibre.
// All data arrives as props from the backend API; nothing about the campus is hard-coded here.
export default function CampusMapView({ buildings, facilities, paths, boundary, selected, onSelect, mode, layers, center, focus, accessiblePathsOnly }) {
  const box = useRef(null), map = useRef(null), overlay = useRef(null), ready = useRef(false);
  const latest = useRef({});
  latest.current = { buildings, facilities, paths, boundary, selected, onSelect, mode, layers, accessiblePathsOnly };

  const pathFeatures = () => (latest.current.accessiblePathsOnly ? latest.current.paths.filter((p) => p.properties.accessible) : latest.current.paths);
  const buildingFeatures = () => latest.current.buildings.map((b) => ({ ...b, properties: { ...b.properties, _sel: b.id === latest.current.selected?.id ? 1 : 0, _name: b.properties.name } }));
  const facilityFeatures = () => latest.current.facilities.map((f) => ({ type: "Feature", id: f.id, geometry: { type: "Point", coordinates: f.coordinates },
    properties: { id: f.id, _color: colorOfFacility(f), _sel: f.id === latest.current.selected?.id ? 1 : 0, name: f.name } }));
  const pointFeatures = () => latest.current.buildings.filter((b) => !b.properties.hasFootprint && b.properties.centroid)
    .map((b) => ({ type: "Feature", id: b.id, geometry: { type: "Point", coordinates: b.properties.centroid }, properties: { id: b.id, _name: b.properties.name } }));

  // --- create the map once ---
  useEffect(() => {
    const m = new maplibregl.Map({ container: box.current, style: BASE_STYLE, center: [center[1], center[0]], zoom: 16, maxPitch: 75 });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    m.addControl(new maplibregl.FullscreenControl(), "top-right");
    overlay.current = new MapboxOverlay({ interleaved: false, layers: [] });
    m.addControl(overlay.current);
    m.on("load", () => {
      m.addSource("boundary", { type: "geojson", data: fc([]) });
      m.addSource("buildings", { type: "geojson", data: fc([]) });
      m.addSource("bpoints", { type: "geojson", data: fc([]) });
      m.addSource("paths", { type: "geojson", data: fc([]) });
      m.addSource("facilities", { type: "geojson", data: fc([]) });
      m.addLayer({ id: "boundary-line", type: "line", source: "boundary", paint: { "line-color": "#0f172a", "line-width": 2, "line-dasharray": [3, 2] } });
      m.addLayer({ id: "buildings-fill", type: "fill", source: "buildings", paint: {
        "fill-color": ["case", ["==", ["get", "_sel"], 1], "#2563eb", ["match", ["get", "category"], "academic", "#1d4ed8", "hostel", "#0d9488", "food", "#d97706", "sports", "#9333ea", "healthcare", "#e11d48", "#64748b"]],
        "fill-opacity": 0.55 } });
      m.addLayer({ id: "buildings-outline", type: "line", source: "buildings", paint: { "line-color": ["case", ["==", ["get", "_sel"], 1], "#1e3a8a", "#334155"], "line-width": ["case", ["==", ["get", "_sel"], 1], 3, 1.2] } });
      m.addLayer({ id: "paths-line", type: "line", source: "paths", layout: { "line-cap": "round" }, paint: {
        "line-color": ["case", ["==", ["get", "pathType"], "stairs"], "#b45309", ["get", "accessible"], "#16a34a", "#94a3b8"], "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1, 19, 4],
        "line-dasharray": [2, 1] } });
      m.addLayer({ id: "building-points", type: "circle", source: "bpoints", paint: { "circle-radius": 8, "circle-color": "#1e293b", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
      m.addLayer({ id: "facilities-circle", type: "circle", source: "facilities", paint: {
        "circle-radius": ["case", ["==", ["get", "_sel"], 1], 10, 6], "circle-color": ["case", ["==", ["get", "_sel"], 1], "#2563eb", ["get", "_color"]], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
      m.addLayer({ id: "building-labels", type: "symbol", source: "buildings", minzoom: 16.5, layout: { "text-field": ["get", "_name"], "text-font": ["Open Sans Regular"], "text-size": 11, "text-allow-overlap": false },
        paint: { "text-color": "#0f172a", "text-halo-color": "#ffffff", "text-halo-width": 1.4 } });
      const pick = (kind, e) => { const f = e.features && e.features[0]; if (f) latest.current.onSelect({ kind, id: String(f.properties.id || f.id) }); };
      m.on("click", "facilities-circle", (e) => pick("facility", e));
      m.on("click", "buildings-fill", (e) => { if (!m.queryRenderedFeatures(e.point, { layers: ["facilities-circle"] }).length) pick("building", e); });
      m.on("click", "building-points", (e) => pick("building", e));
      for (const id of ["facilities-circle", "buildings-fill", "building-points"]) {
        m.on("mouseenter", id, () => { m.getCanvas().style.cursor = "pointer"; });
        m.on("mouseleave", id, () => { m.getCanvas().style.cursor = ""; });
      }
      ready.current = true;
      sync();
    });
    return () => { ready.current = false; m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync() {
    const m = map.current; if (!m || !ready.current) return;
    const { layers: L, mode: md, boundary: bd } = latest.current;
    const is3d = md === "3d";
    m.getSource("boundary").setData(fc(bd || []));
    m.getSource("buildings").setData(fc(buildingFeatures().filter((b) => b.properties.hasFootprint)));
    m.getSource("bpoints").setData(fc(pointFeatures()));
    m.getSource("paths").setData(fc(pathFeatures()));
    m.getSource("facilities").setData(fc(facilityFeatures()));
    const vis = (id, on) => m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    // In 3D, deck.gl draws buildings, labels, paths and facilities so the draw order stays correct.
    vis("boundary-line", L.boundary);
    vis("buildings-fill", L.buildings && !is3d); vis("buildings-outline", L.buildings && !is3d);
    vis("building-labels", L.labels && L.buildings && !is3d);
    vis("building-points", L.buildings && !is3d);
    vis("paths-line", L.paths && !is3d);
    vis("facilities-circle", L.facilities && !is3d);
    syncDeck();
  }

  function syncDeck() {
    const { layers: L, mode: md, selected: sel, onSelect: pick } = latest.current;
    if (!overlay.current) return;
    if (md !== "3d") { overlay.current.setProps({ layers: [] }); return; }
    const selId = sel?.id;
    const out = [];
    if (L.paths) out.push(new PathLayer({ id: "d-paths", data: pathFeatures(), getPath: (d) => d.geometry.coordinates, widthUnits: "meters", getWidth: 1.6, widthMinPixels: 1.5,
      getColor: (d) => (d.properties.pathType === "stairs" ? [180, 83, 9] : d.properties.accessible ? [22, 163, 74] : [148, 163, 184]), pickable: false }));
    if (L.buildings) {
      out.push(new GeoJsonLayer({ id: "d-buildings", data: fc(latest.current.buildings.filter((b) => b.properties.hasFootprint)), extruded: true, wireframe: false, pickable: true, autoHighlight: true,
        highlightColor: [37, 99, 235, 200],
        getElevation: (f) => extrusionOf(f.properties).height,
        getFillColor: (f) => (f.id === selId ? [37, 99, 235, 235] : [...hex2rgb(colorOfBuilding(f.properties)), extrusionOf(f.properties).height ? (f.properties.heightSource === "estimated_from_floors" ? 190 : 230) : 140]),
        getLineColor: [30, 41, 59, 255], lineWidthMinPixels: 1, material: { ambient: 0.55, diffuse: 0.6, shininess: 24 },
        updateTriggers: { getFillColor: [selId] }, onClick: (info) => info.object && pick({ kind: "building", id: String(info.object.id) }) }));
      if (L.labels) out.push(new TextLayer({ id: "d-labels", data: latest.current.buildings.filter((b) => b.properties.centroid), getPosition: (b) => [...b.properties.centroid, extrusionOf(b.properties).height + 2],
        getText: (b) => b.properties.name, getSize: 12, sizeUnits: "pixels", getColor: [15, 23, 42, 255], outlineWidth: 3, outlineColor: [255, 255, 255, 255], fontSettings: { sdf: true }, billboard: true, pickable: false, maxWidth: 200, wordBreak: "break-word" }));
    }
    if (L.facilities) out.push(new ScatterplotLayer({ id: "d-facilities", data: latest.current.facilities, getPosition: (f) => f.coordinates, getFillColor: (f) => (f.id === selId ? [37, 99, 235] : hex2rgb(colorOfFacility(f))),
      getRadius: (f) => (f.id === selId ? 9 : 6), radiusUnits: "meters", radiusMinPixels: 5, radiusMaxPixels: 14, stroked: true, getLineColor: [255, 255, 255], lineWidthMinPixels: 1.5, pickable: true,
      updateTriggers: { getFillColor: [selId], getRadius: [selId] }, onClick: (info) => info.object && pick({ kind: "facility", id: info.object.id }) }));
    overlay.current.setProps({ layers: out });
  }

  // keep sources, layers and pitch in step with props
  useEffect(() => { sync(); }, [buildings, facilities, paths, boundary, selected, mode, layers, accessiblePathsOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = map.current; if (!m) return;
    m.easeTo({ pitch: mode === "3d" ? 60 : 0, bearing: mode === "3d" ? m.getBearing() : 0, duration: 700 });
  }, [mode]);
  useEffect(() => { if (map.current && focus) map.current.flyTo({ center: focus.coordinates, zoom: focus.zoom || 18, speed: 1.4 }); }, [focus]);

  return <div ref={box} data-testid="campus-map" style={{ width: "100%", height: "100%", borderRadius: 12 }} role="application" aria-label="Interactive campus map" />;
}
