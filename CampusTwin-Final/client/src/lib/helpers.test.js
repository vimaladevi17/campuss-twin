import { describe, it, expect } from "vitest";
import { istToIso, todayIst, fmtIst, csvToArray, arrayToCsv, getPath, minutesToHHMM } from "./time";
import { navFor } from "./nav";
import { emptyForm, formFromItem, payloadFromForm } from "../pages/admin/ManageResource";
import { resources } from "../pages/admin/resources";
import { buildVacancyQuery } from "../pages/twin/VacancyPage";
import { formToPayload, entryToForm } from "../pages/twin/TimetablePage";
vi.mock("../components/map/CampusMapView", () => ({ default: () => null }));
import { filterFacilities, CHIPS } from "../pages/twin/CampusMapPage";
import { mapPoints, buildSelections } from "../pages/twin/ReplacementPage";

describe("campus time helpers", () => {
  it("treats typed date-times as Asia/Kolkata", () => expect(istToIso("2026-11-02T10:00")).toBe("2026-11-02T10:00:00+05:30"));
  it("rejects malformed input", () => expect(istToIso("tomorrow")).toBe(""));
  it("computes the campus date across the UTC boundary", () => {
    expect(todayIst(new Date("2026-11-02T20:00:00Z"))).toBe("2026-11-03");   // 01:30 IST next day
    expect(todayIst(new Date("2026-11-02T10:00:00Z"))).toBe("2026-11-02");
  });
  it("formats in campus time", () => expect(fmtIst("2026-11-02T04:30:00Z")).toBe("02 Nov 2026, 10:00"));
  it("csv and path helpers", () => {
    expect(csvToArray(" a, b ,,c")).toEqual(["a", "b", "c"]);
    expect(arrayToCsv(["x", "y"])).toBe("x, y");
    expect(getPath({ a: { b: 3 } }, "a.b")).toBe(3);
    expect(getPath({}, "a.b")).toBeUndefined();
    expect(minutesToHHMM(605)).toBe("10:05");
  });
});

describe("navigation per role", () => {
  const labels = (role) => navFor(role).flatMap((g) => g.links.map((l) => l[1]));
  it("admin sees every management module", () => {
    expect(labels("admin")).toEqual(expect.arrayContaining(["Dashboard", "Campus Map", "Buildings", "Floors & Rooms", "Classrooms", "Laboratories", "Timetable", "Vacancy Finder", "Smart Lab Replacement", "Facilities", "Accessibility", "Notifications", "User Management", "Settings", "Students"]));
  });
  it("student cannot see admin tools", () => {
    const l = labels("student");
    ["Buildings", "Smart Lab Replacement", "User Management", "Vacancy Finder", "Students"].forEach((x) => expect(l).not.toContain(x));
    expect(l).toEqual(expect.arrayContaining(["Campus Map", "Timetable", "Notifications"]));
  });
  it("faculty gets vacancy finder but not replacement", () => { expect(labels("faculty")).toContain("Vacancy Finder"); expect(labels("faculty")).not.toContain("Smart Lab Replacement"); });
});

describe("admin form conversion", () => {
  const b = resources.buildings;
  it("builds a GeoJSON point as [lng, lat]", () => {
    const f = { ...emptyForm(b), code: "B8", name: "8th", location__lat: "9.575", location__lng: "77.6756" };
    const { payload } = payloadFromForm(b, f, false);
    expect(payload.location).toEqual({ type: "Point", coordinates: [77.6756, 9.575] });
  });
  it("rejects out-of-range or half-filled coordinates", () => {
    expect(payloadFromForm(b, { ...emptyForm(b), code: "x", name: "y", location__lat: "99", location__lng: "77" }, false).error).toMatch(/latitude/);
    expect(payloadFromForm(b, { ...emptyForm(b), code: "x", name: "y", location__lat: "9.5", location__lng: "" }, false).error).toMatch(/latitude/);
  });
  it("omits empty optional numbers, converts csv, enforces required", () => {
    const { payload } = payloadFromForm(b, { ...emptyForm(b), code: "B8", name: "8th", facilities: "a, b", heightM: "" }, false);
    expect(payload.heightM).toBeUndefined(); expect(payload.facilities).toEqual(["a", "b"]);
    expect(payloadFromForm(b, { ...emptyForm(b), name: "x" }, false).error).toMatch(/Building code/);
  });
  it("laboratories are always created as type laboratory", () => {
    const r = resources.laboratories;
    const { payload } = payloadFromForm(r, { ...emptyForm(r), roomNumber: "CL-1", building: "b1", capacity: "60", specialFacilities: "air_conditioned" }, false);
    expect(payload).toMatchObject({ type: "laboratory", capacity: 60, building: "b1", specialFacilities: ["air_conditioned"] });
  });
  it("number minimum is enforced", () => {
    const r = resources.laboratories;
    expect(payloadFromForm(r, { ...emptyForm(r), roomNumber: "x", building: "b", capacity: "0" }, false).error).toMatch(/at least 1/);
  });
  it("edit loads populated references and coordinates back into the form", () => {
    const f = formFromItem(b, { code: "B8", name: "8th", location: { type: "Point", coordinates: [77.6756, 9.575] }, facilities: ["x"] });
    expect(f.location__lat).toBe("9.575"); expect(f.location__lng).toBe("77.6756"); expect(f.facilities).toBe("x");
    const g = formFromItem(resources.rooms, { roomNumber: "1", building: { _id: "b1", name: "B" }, floor: { _id: "f1" }, capacity: 5, type: "classroom" });
    expect(g.building).toBe("b1"); expect(g.floor).toBe("f1");
  });
  it("password stays blank on edit", () => expect(payloadFromForm(resources.users, { name: "n", email: "e", role: "student", password: "" }, true).payload.password).toBeUndefined());
});

describe("page helpers", () => {
  it("vacancy query only includes chosen filters", () => {
    expect(buildVacancyQuery({ date: "2026-11-02", startTime: "10:00", endTime: "11:00", building: "", type: "", capacity: "", equipType: "", equipQty: 1 })).toEqual({ date: "2026-11-02", startTime: "10:00", endTime: "11:00" });
    expect(buildVacancyQuery({ date: "d", startTime: "a", endTime: "b", building: "b1", type: "laboratory", capacity: "40", equipType: "desktop_computer", equipQty: 30 })).toMatchObject({ building: "b1", type: "laboratory", capacity: 40, equipment: "desktop_computer:30" });
  });
  it("timetable form round-trips", () => {
    const e = { _id: "1", day: "Monday", subject: "Net", startMinutes: 600, endMinutes: 660, roomRef: { _id: "r1", building: "b1" }, facultyRef: { _id: "f1" }, studentCount: 50, requiredEquipment: [{ type: "desktop_computer", minQuantity: 50 }], specialRequirements: ["air_conditioned"] };
    const form = entryToForm(e);
    expect(form).toMatchObject({ startTime: "10:00", endTime: "11:00", roomRef: "r1", facultyRef: "f1", building: "b1" });
    expect(formToPayload(form)).toMatchObject({ startTime: "10:00", endTime: "11:00", roomRef: "r1", facultyRef: "f1", studentCount: 50, specialRequirements: ["air_conditioned"] });
  });
  const F = (o) => ({ id: o.name, tags: [], layer: "general", ...o });
  const all = [F({ name: "Central Library", category: "academic", tags: ["library"] }), F({ name: "Boys Hostel", category: "hostel" }), F({ name: "Ramp A", category: "other", layer: "accessibility", accessibilityType: "accessible_ramp" }), F({ name: "Main Parking", category: "transport_parking", tags: ["parking"] })];
  it("map filters by category, tag, layer and search text", () => {
    expect(filterFacilities(all, new Set(), "").length).toBe(4);
    expect(filterFacilities(all, new Set(["library"]), "").map((f) => f.name)).toEqual(["Central Library"]);
    expect(filterFacilities(all, new Set(["accessibility"]), "").map((f) => f.name)).toEqual(["Ramp A"]);
    expect(filterFacilities(all, new Set(["parking", "hostel"]), "").length).toBe(2);
    expect(filterFacilities(all, new Set(), "hostel").length).toBe(1);
    expect(CHIPS.map((c) => c.key)).toEqual(expect.arrayContaining(["academic", "hostel", "food", "library", "sports", "parking", "transport", "healthcare", "accessibility", "other"]));
  });
  it("replacement map uses the spec colours", () => {
    const occ = { summary: { originalRoom: { roomNumber: "CL-1", building: { name: "8th", coordinates: [77.67, 9.57] } } },
      candidates: [{ roomId: "a", roomNumber: "CL-4", building: { name: "11th", coordinates: [77.68, 9.58] } }, { roomId: "b", roomNumber: "CL-5", building: { name: "5th", coordinates: [77.69, 9.56] } }] };
    expect(mapPoints(occ, "a").map((p) => p.color)).toEqual(["#dc2626", "#16a34a", "#2563eb"]);
  });
  it("approval only sends choices for pending occurrences", () => {
    const req = { occurrences: [{ _id: "o1", decision: "pending" }, { _id: "o2", decision: "approved" }, { _id: "o3", decision: "pending" }] };
    expect(buildSelections(req, { o1: "r1", o2: "r2" })).toEqual([{ occurrenceId: "o1", roomId: "r1" }]);
  });
});
