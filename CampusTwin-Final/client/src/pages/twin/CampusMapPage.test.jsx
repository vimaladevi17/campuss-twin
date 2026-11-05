import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import http from "../../api/http";
import { AuthProvider } from "../../context/AuthContext";
import { ToastProvider } from "../../context/ToastContext";
import { extrusionOf, nearbyAccessibility, haversineM } from "../../components/map/mapStyle";

// WebGL does not exist in jsdom, so the renderer is replaced by a probe that exposes the props the page passes in.
vi.mock("../../components/map/CampusMapView", () => ({
  default: (p) => (
    <div data-testid="map-probe" data-mode={p.mode} data-buildings={p.buildings.length} data-facilities={p.facilities.length} data-paths={p.paths.length}
      data-layers={Object.entries(p.layers).filter(([, v]) => v).map(([k]) => k).join(",")} data-selected={p.selected?.id || ""} data-accessible-only={String(p.accessiblePathsOnly)}>
      <button onClick={() => p.onSelect({ kind: "building", id: "b1" })}>pick-b1</button>
      <button onClick={() => p.onSelect({ kind: "facility", id: "f2" })}>pick-f2</button>
    </div>
  ),
}));
import CampusMapPage from "./CampusMapPage";

const ok = (data) => Promise.resolve({ data });
const poly = { type: "Polygon", coordinates: [[[77.676, 9.574], [77.677, 9.574], [77.677, 9.575], [77.676, 9.574]]] };
const building = (id, name, extra = {}) => ({ type: "Feature", id, geometry: poly, properties: { id, code: name.slice(0, 3).toUpperCase(), name, category: "academic", floors: 6, heightM: 21, heightSource: "estimated_from_floors", hasFootprint: true, verification: "extracted_osm", isDemo: false, centroid: [77.6765, 9.5744], rooms: { total: 0 }, ...extra } });
const fac = (id, name, extra = {}) => ({ type: "Feature", id, geometry: { type: "Point", coordinates: [77.6766, 9.5745] }, properties: { id, name, category: "food", tags: [], layer: "general", accessibilityType: "", status: "operational", verification: "extracted_osm", ...extra } });
const data = {
  "/map/buildings": { features: [building("b1", "Block Eight"), building("b2", "Block Nine", { heightM: undefined, heightSource: "unknown" })] },
  "/map/facilities": { features: [fac("f1", "Main Canteen"), fac("f2", "Ramp near Block Eight", { layer: "accessibility", accessibilityType: "accessible_ramp", category: "accessibility" })] },
  "/map/paths": { features: [{ type: "Feature", id: "p1", geometry: { type: "LineString", coordinates: [[77.676, 9.574], [77.677, 9.575]] }, properties: { id: "p1", pathType: "footpath", accessible: true } }] },
  "/map/boundary": { features: [], note: "No campus boundary has been loaded yet." },
  "/settings": { referencePoint: { lat: 9.5743, lng: 77.6761 } },
};
const renderPage = () => render(<AuthProvider><ToastProvider><MemoryRouter><CampusMapPage /></MemoryRouter></ToastProvider></AuthProvider>);
const probe = async () => screen.findByTestId("map-probe");

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.spyOn(http, "get").mockImplementation((url) => ok(data[url] || {})); });

describe("map helpers", () => {
  it("only extrudes buildings that have stored height data", () => {
    expect(extrusionOf({ heightSource: "unknown" }).height).toBe(0);
    expect(extrusionOf({ heightSource: "osm", heightM: 12 })).toEqual({ height: 12, label: "12 m (from OpenStreetMap)" });
    expect(extrusionOf({ heightSource: "estimated_from_floors", heightM: 21 }).label).toMatch(/estimated.*not measured/);
    expect(extrusionOf({ heightSource: "osm" }).height).toBe(0);
  });
  it("finds accessibility facilities within the radius, nearest first", () => {
    const p = [77.6761, 9.5743];
    const list = [{ id: "a", layer: "accessibility", coordinates: [77.6762, 9.5743] }, { id: "b", layer: "accessibility", coordinates: [77.6761, 9.57435] }, { id: "far", layer: "accessibility", coordinates: [77.69, 9.58] }, { id: "x", layer: "general", coordinates: p }];
    const r = nearbyAccessibility(list, p, 100);
    expect(r.map((x) => x.f.id)).toEqual(["b", "a"]);
    expect(haversineM(p, p)).toBe(0);
  });
});

describe("Campus map page", () => {
  it("loads every layer from the backend API", async () => {
    renderPage();
    const el = await probe();
    expect(el.dataset.buildings).toBe("2"); expect(el.dataset.facilities).toBe("2"); expect(el.dataset.paths).toBe("1");
    for (const u of ["/map/buildings", "/map/facilities", "/map/paths", "/map/boundary"]) expect(http.get).toHaveBeenCalledWith(u);
    expect(screen.getByText(/no campus boundary loaded/)).toBeInTheDocument();
  });
  it("switches between 2D and 3D", async () => {
    renderPage();
    expect((await probe()).dataset.mode).toBe("2d");
    fireEvent.click(screen.getByRole("button", { name: "3D" }));
    expect((await probe()).dataset.mode).toBe("3d");
    expect(screen.getByText(/estimated heights are derived from floor counts/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2D" }));
    expect((await probe()).dataset.mode).toBe("2d");
  });
  it("layer checkboxes and the step-free toggle reach the map", async () => {
    renderPage(); await probe();
    fireEvent.click(screen.getByLabelText("Paths"));
    expect((await probe()).dataset.layers).not.toMatch(/paths/);
    fireEvent.click(screen.getByLabelText("Step-free paths only"));
    expect((await probe()).dataset.accessibleOnly).toBe("true");
  });
  it("search narrows buildings and facilities", async () => {
    renderPage(); await probe();
    fireEvent.change(screen.getByLabelText("Search the map"), { target: { value: "canteen" } });
    await waitFor(async () => { const e = await probe(); expect(e.dataset.facilities).toBe("1"); expect(e.dataset.buildings).toBe("0"); });
    fireEvent.change(screen.getByLabelText("Search the map"), { target: { value: "nine" } });
    await waitFor(async () => expect((await probe()).dataset.buildings).toBe("1"));
  });
  it("selecting a building shows its height label, never presenting an estimate as measured", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("pick-b1"));
    expect(await screen.findByText(/21 m \(estimated from floor count, not measured\)/)).toBeInTheDocument();
    expect(screen.getByText(/Accessibility nearby/)).toBeInTheDocument();
    expect(screen.getByText(/Ramp near Block Eight/)).toBeInTheDocument();
  });
  it("a building without height data says so", async () => {
    renderPage(); await probe();
    fireEvent.click(screen.getByText("Block Nine"));
    expect(await screen.findByText(/no height data \(not extruded\)/)).toBeInTheDocument();
  });
  it("selecting a facility shows the facility panel", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("pick-f2"));
    expect(await screen.findByRole("heading", { name: "Ramp near Block Eight" })).toBeInTheDocument();
    expect(screen.getByText(/Accessible ramp/)).toBeInTheDocument();
  });
  it("shows a clear empty state when the database holds no map data", async () => {
    http.get.mockImplementation(() => ok({ features: [] }));
    renderPage();
    expect(await screen.findByText(/No campus data has been loaded yet/)).toBeInTheDocument();
  });
  it("shows an error message when the API is unreachable", async () => {
    http.get.mockImplementation(() => Promise.reject({}));
    renderPage();
    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
  });
});
