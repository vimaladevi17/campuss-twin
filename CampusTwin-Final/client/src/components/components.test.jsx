import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import http from "../api/http";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import ProtectedRoute from "./ProtectedRoute";
import ManageResource from "../pages/admin/ManageResource";
import { resources } from "../pages/admin/resources";
import VacancyPage from "../pages/twin/VacancyPage";
import TimetablePage from "../pages/twin/TimetablePage";
import ReplacementPage from "../pages/twin/ReplacementPage";
import TwinStats from "./TwinStats";
import Stats from "./Stats";

vi.mock("./MiniMap", () => ({ default: ({ points }) => <div data-testid="minimap">{points.length} points</div> }));
vi.mock("../components/MiniMap", () => ({ default: ({ points }) => <div data-testid="minimap">{points.length} points</div> }));

const asUser = (role) => { localStorage.setItem("campustwin_token", "t"); localStorage.setItem("campustwin_user", JSON.stringify({ id: "u1", name: "Tester", email: "t@x.com", role })); };
const wrap = (ui, path = "/") => render(<AuthProvider><ToastProvider><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></ToastProvider></AuthProvider>);
const ok = (data) => Promise.resolve({ data });
const fail = (status, data) => Promise.reject({ response: { status, data } });

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); window.scrollTo = () => {}; });
afterEach(() => localStorage.clear());

describe("ProtectedRoute", () => {
  const page = (role, roles) => { if (role) asUser(role); return wrap(<Routes><Route path="/login" element={<p>login page</p>} /><Route path="/" element={<ProtectedRoute roles={roles}><p>secret</p></ProtectedRoute>} /></Routes>); };
  it("sends anonymous users to login", () => { page(null, ["admin"]); expect(screen.getByText("login page")).toBeInTheDocument(); });
  it("blocks the wrong role", () => { page("student", ["admin"]); expect(screen.getByText("Access Denied")).toBeInTheDocument(); });
  it("lets admin open everything", () => { page("admin", ["faculty"]); expect(screen.getByText("secret")).toBeInTheDocument(); });
});

describe("Admin management screen (laboratories)", () => {
  const room = { _id: "r1", roomNumber: "CL-1", name: "Computing 1", building: { _id: "b1", name: "8th Block" }, floor: { _id: "f1", number: 1 }, type: "laboratory", capacity: 60, operationalStatus: "active", maintenanceStatus: "none", equipment: [] };
  const setup = (extra = {}) => {
    vi.spyOn(http, "get").mockImplementation((url) => (url === "/rooms" ? ok([room]) : url === "/buildings" ? ok([{ _id: "b1", code: "B8", name: "8th Block" }]) : url === "/floors" ? ok([{ _id: "f1", number: 1, name: "Floor 1" }]) : ok([])));
    return extra;
  };
  it("lists database records and filters laboratories only", async () => {
    setup(); wrap(<ManageResource config={resources.laboratories} />);
    expect(await screen.findByText("CL-1")).toBeInTheDocument();
    expect(http.get).toHaveBeenCalledWith("/rooms", { params: { type: "laboratory" } });
  });
  it("creates a laboratory through the API with the right payload", async () => {
    setup(); const post = vi.spyOn(http, "post").mockImplementation(() => ok({}));
    wrap(<ManageResource config={resources.laboratories} />);
    await screen.findByText("CL-1");
    fireEvent.change(screen.getByLabelText(/Room number/), { target: { value: "CL-9" } });
    await waitFor(() => expect(screen.getByRole("option", { name: /B8 - 8th Block/ })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^Building/), { target: { value: "b1" } });
    fireEvent.change(screen.getByLabelText(/Seating/), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe("/rooms");
    expect(post.mock.calls[0][1]).toMatchObject({ roomNumber: "CL-9", building: "b1", capacity: 45, type: "laboratory" });
    expect(await screen.findByText("Laboratories added successfully")).toBeInTheDocument();
  });
  it("does not call the API when validation fails", async () => {
    setup(); const post = vi.spyOn(http, "post");
    wrap(<ManageResource config={resources.laboratories} />);
    await screen.findByText("CL-1");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Room number is required/);
    expect(post).not.toHaveBeenCalled();
  });
  it("shows the server's message when saving fails", async () => {
    setup(); vi.spyOn(http, "post").mockImplementation(() => fail(400, { message: "capacity must be at least 1" }));
    wrap(<ManageResource config={resources.laboratories} />);
    await screen.findByText("CL-1");
    fireEvent.change(screen.getByLabelText(/Room number/), { target: { value: "X" } });
    await waitFor(() => screen.getByRole("option", { name: /B8/ }));
    fireEvent.change(screen.getByLabelText(/^Building/), { target: { value: "b1" } });
    fireEvent.change(screen.getByLabelText(/Seating/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("capacity must be at least 1");
  });
  it("asks for confirmation, then deletes and reports a blocked delete", async () => {
    setup(); const del = vi.spyOn(http, "delete").mockImplementation(() => fail(409, { message: "Cannot delete: room is used by 3 timetable entries and 0 reservation(s)." }));
    wrap(<ManageResource config={resources.laboratories} />);
    await screen.findByText("CL-1");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("/rooms/r1"));
    expect(await screen.findByText(/Cannot delete: room is used by 3/)).toBeInTheDocument();
    expect(screen.getByText("CL-1")).toBeInTheDocument();     // still listed
  });
  it("edit sends PUT with the changed capacity", async () => {
    setup(); const put = vi.spyOn(http, "put").mockImplementation(() => ok({}));
    wrap(<ManageResource config={resources.laboratories} />);
    await screen.findByText("CL-1");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/Seating/), { target: { value: "70" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][0]).toBe("/rooms/r1"); expect(put.mock.calls[0][1]).toMatchObject({ capacity: 70, building: "b1" });
  });
  it("shows an error state when the list cannot load", async () => {
    vi.spyOn(http, "get").mockImplementation(() => fail(500, { message: "boom" }));
    wrap(<ManageResource config={resources.laboratories} />);
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });
});

describe("Vacancy finder", () => {
  it("searches with the chosen window and shows free rooms", async () => {
    asUser("faculty");
    const get = vi.spyOn(http, "get").mockImplementation((url) => (url === "/buildings" ? ok([{ _id: "b1", name: "8th Block" }])
      : ok({ date: "2026-11-02", window: { start: "10:00", end: "11:00" }, count: 1, rooms: [{ roomId: "r1", roomNumber: "CL-2", type: "laboratory", capacity: 60, building: { name: "8th Block" }, floor: { number: 1 }, equipment: [{ type: "desktop_computer", quantity: 60 }], freeSlots: [{ start: "08:00", end: "10:00" }, { start: "11:00", end: "18:00" }] }] })));
    wrap(<VacancyPage />);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-11-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Find vacant rooms" }));
    expect(await screen.findByText("CL-2")).toBeInTheDocument();
    expect(screen.getByText("08:00–10:00, 11:00–18:00")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/availability/vacant", { params: expect.objectContaining({ date: "2026-11-02", startTime: "10:00", endTime: "11:00" }) });
  });
  it("blocks an end time before the start without calling the API", () => {
    asUser("faculty"); const get = vi.spyOn(http, "get").mockImplementation(() => ok([]));
    wrap(<VacancyPage />);
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Find vacant rooms" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/End time must be after start/);
    expect(get).not.toHaveBeenCalledWith("/availability/vacant", expect.anything());
  });
});

describe("Timetable", () => {
  const entry = { _id: "t1", day: "Monday", time: "10:00-12:00", subject: "[DEMO] Networks Lab", faculty: "Faculty One [DEMO]", room: "CL-1", isDemo: true, startMinutes: 600, endMinutes: 720, studentCount: 50, effective: { date: "2026-11-02", changed: true, room: { roomNumber: "CL-4" } } };
  it("shows DEMO labelling and approved room moves", async () => {
    asUser("student");
    vi.spyOn(http, "get").mockImplementation((url) => (url === "/timetable" ? ok([entry]) : ok([])));
    wrap(<TimetablePage />);
    expect(await screen.findByText("[DEMO] Networks Lab")).toBeInTheDocument();
    expect(screen.getByText("Moved for this date")).toBeInTheDocument();
    expect(screen.getByText("CL-4")).toBeInTheDocument();
    expect(screen.getByText(/DEMO sample data, not an official KARE schedule/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Add entry" })).not.toBeInTheDocument();   // students are read-only
  });
  it("admin sees add/edit and a conflict returned by the server is displayed", async () => {
    asUser("admin");
    const linked = { ...entry, building: "b1", roomRef: { _id: "r1", building: "b1" }, facultyRef: { _id: "f1" } };
    vi.spyOn(http, "get").mockImplementation((url) => (url === "/timetable" ? ok([linked]) : url === "/buildings" ? ok([{ _id: "b1", name: "8th" }]) : url === "/faculty" ? ok([{ _id: "f1", name: "Dr A" }]) : url === "/rooms" ? ok([{ _id: "r1", roomNumber: "CL-1", type: "laboratory", capacity: 60 }]) : ok([])));
    vi.spyOn(http, "put").mockImplementation(() => fail(409, { message: "Room already booked for \"DBMS Lab\" (10:00-11:00)", conflicts: [{ code: "room_double_booked", message: "Room already booked for \"DBMS Lab\" (10:00-11:00)" }], warnings: [] }));
    wrap(<TimetablePage />);
    await screen.findByText("[DEMO] Networks Lab");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Room already booked/);
  });
  it("validates required fields before calling the API", async () => {
    asUser("admin"); const post = vi.spyOn(http, "post");
    vi.spyOn(http, "get").mockImplementation((url) => (url === "/timetable" ? ok([]) : ok([])));
    wrap(<TimetablePage />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Add entry" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add entry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Subject is required/);
    expect(post).not.toHaveBeenCalled();
  });
});

describe("Smart lab replacement", () => {
  const occ = (extra = {}) => ({ _id: "o1", date: "2026-11-02", decision: "pending", suggestedRoom: "labB", startMinutes: 600, endMinutes: 720,
    summary: { subject: "Networks Lab", faculty: "Dr A", course: "CSE", section: "A", time: "10:00-12:00", originalRoom: { roomNumber: "CL-1", building: { name: "8th", coordinates: [77.67, 9.57] } } },
    requirements: { studentCount: 50, equipment: [{ type: "desktop_computer", minQuantity: 50 }] },
    candidates: [{ roomId: "labB", roomNumber: "CL-4", capacity: 70, floor: { number: 1 }, building: { name: "11th Block", coordinates: [77.68, 9.58] }, walking: { meters: 210, minutes: 3, type: "network" }, scores: { availability: 100, equipment: 90, capacity: 100, distance: 80 }, total: 96.4, reason: "free for the whole slot" }],
    rejected: [{ roomId: "labC", roomNumber: "CL-3", building: { name: "8th" }, reasons: ["capacity 40 < 50 students", "occupied (OS Lab)"] }], ...extra });
  const request = (status = "pending", o = occ()) => ({ _id: "q1", status, room: { roomNumber: "CL-1" }, startAt: "2026-11-02T04:30:00Z", endAt: "2026-11-02T06:30:00Z", reason: "AC repair", weights: { availability: 0.4, equipment: 0.3, capacity: 0.2, distance: 0.1 }, occurrences: [o] });
  const setup = (req) => vi.spyOn(http, "get").mockImplementation((url) => (url === "/replacements" ? ok([req]) : url === "/replacements/q1" ? ok(req) : url === "/rooms" ? ok([{ _id: "labA", roomNumber: "CL-1", building: { name: "8th" } }]) : ok([])));

  it("shows the comparison table, labels the walking route, and lists rejected rooms with reasons", async () => {
    asUser("admin"); setup(request());
    wrap(<ReplacementPage />);
    fireEvent.click(await screen.findByText(/2 Nov 2026, 10:00/));
    expect(await screen.findByText("Recommended")).toBeInTheDocument();
    expect(screen.getByText("210 m")).toBeInTheDocument();
    expect(screen.getByText("walking route")).toBeInTheDocument();
    expect(screen.getByText("96.4")).toBeInTheDocument();
    expect(screen.getByText(/1 room\(s\) rejected/)).toBeInTheDocument();
    expect(screen.getByText(/capacity 40 < 50 students; occupied \(OS Lab\)/)).toBeInTheDocument();
    expect(screen.getByTestId("minimap")).toHaveTextContent("2 points");
  });
  it("says the route distance is unavailable when no connected walking route exists", async () => {
    const base = occ();
    const o = { ...base, candidates: [{ ...base.candidates[0], walking: { meters: null, minutes: null, type: "unavailable" } }] };
    asUser("admin"); setup(request("pending", o));
    wrap(<ReplacementPage />);
    fireEvent.click(await screen.findByText(/2 Nov 2026, 10:00/));
    expect(await screen.findByText("no connected walking route, distance unavailable")).toBeInTheDocument();
    expect(screen.getByText("unavailable")).toBeInTheDocument();
  });
  it("approval needs confirmation, then posts the chosen room", async () => {
    asUser("admin"); setup(request());
    const post = vi.spyOn(http, "post").mockImplementation(() => ok({}));
    wrap(<ReplacementPage />);
    fireEvent.click(await screen.findByText(/2 Nov 2026, 10:00/));
    fireEvent.click(await screen.findByRole("button", { name: /Approve 1 selected/ }));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/replacements/q1/approve", { selections: [{ occurrenceId: "o1", roomId: "labB" }] }));
  });
  it("explains when there is no alternative and offers no approval", async () => {
    asUser("admin"); setup(request("pending", occ({ candidates: [], suggestedRoom: undefined, decision: "no_alternative", explanation: "No eligible alternative: every other laboratory violates at least one hard constraint (see rejected list)." })));
    wrap(<ReplacementPage />);
    fireEvent.click(await screen.findByText(/2 Nov 2026, 10:00/));
    expect(await screen.findByText(/No eligible alternative/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve 0 selected/ })).toBeDisabled();
  });
  it("shows the server's reason when approval is no longer valid", async () => {
    asUser("admin"); setup(request());
    vi.spyOn(http, "post").mockImplementation(() => fail(409, { message: "Some selections are no longer valid. Nothing was changed.", problems: [{ reasons: ["occupied (DBMS Lab)"] }] }));
    wrap(<ReplacementPage />);
    fireEvent.click(await screen.findByText(/2 Nov 2026, 10:00/));
    fireEvent.click(await screen.findByRole("button", { name: /Approve 1 selected/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }));
    expect(await screen.findByText(/Nothing was changed\. occupied \(DBMS Lab\)/)).toBeInTheDocument();
  });
  it("hides decision buttons once approved", async () => {
    asUser("admin"); setup(request("approved", occ({ decision: "approved", selectedRoom: "labB" })));
    wrap(<ReplacementPage />);
    fireEvent.click(await screen.findByText(/2 Nov 2026, 10:00/));
    await screen.findByText("Networks Lab: 2026-11-02 10:00-12:00");
    expect(screen.queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject recommendation" })).not.toBeInTheDocument();
  });
});

describe("Dashboards and home stats use live data", () => {
  it("home stats come from the API, not constants", async () => {
    vi.spyOn(http, "get").mockImplementation(() => ok({ faculty: 7, students: 31, classrooms: 12, labs: 4 }));
    render(<Stats />);
    expect(await screen.findByText("31")).toBeInTheDocument();
    expect(screen.queryByText("4500+")).not.toBeInTheDocument();
  });
  it("home stats show a dash, not a fake number, when the API is down", async () => {
    vi.spyOn(http, "get").mockImplementation(() => fail(500, {}));
    render(<Stats />);
    await waitFor(() => expect(screen.getAllByText("—").length).toBe(4));
  });
  it("twin dashboard renders database figures and flags unlinked timetable rows", () => {
    const twin = { campus: { totalAreaSqm: 1536957, openSpaceRatioPct: 94.7, referenceNote: "Supplied campus reference statistics" }, buildings: 4, floors: 12, rooms: 20, classrooms: 8, laboratories: 12, facilities: 58,
      facilitiesByCategory: { food: 22 }, roomStatus: { available: 15, occupied: 3, maintenance: 1, unavailable: 1 }, labStatus: { available: 9, occupied: 2, maintenance: 1, unavailable: 0 },
      todaysClasses: 6, pendingReplacements: 2, pendingMaintenance: 1, timetableEntriesNeedingRoomLink: 5, recentActivity: [] };
    render(<MemoryRouter><TwinStats twin={twin} /></MemoryRouter>);
    expect(screen.getByText("1,536,957 m²")).toBeInTheDocument();
    expect(screen.getByText("58")).toBeInTheDocument();
    expect(screen.getByText(/5 timetable row\(s\) are not linked/)).toBeInTheDocument();
  });
});
