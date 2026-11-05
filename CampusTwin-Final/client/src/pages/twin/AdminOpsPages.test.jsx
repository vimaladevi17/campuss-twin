import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import http from "../../api/http";
import { AuthProvider } from "../../context/AuthContext";
import { ToastProvider } from "../../context/ToastContext";
import { MaintenancePage, ReservationsPage, AuditPage } from "./AdminOpsPages";

const ok = (data) => Promise.resolve({ data });
const rooms = [{ _id: "r1", roomNumber: "8001", name: "Computer Lab", building: { name: "Block 8" } }];
const wrap = (ui, role = "admin") => {
  localStorage.setItem("campustwin_token", "t");
  localStorage.setItem("campustwin_user", JSON.stringify({ id: "u1", name: "A", role }));
  return render(<AuthProvider><ToastProvider><MemoryRouter>{ui}</MemoryRouter></ToastProvider></AuthProvider>);
};
let routes;
beforeEach(() => {
  localStorage.clear(); vi.restoreAllMocks();
  routes = {
    "/rooms": rooms,
    "/maintenance": [{ _id: "m1", room: rooms[0], reason: "AC repair", startAt: "2026-11-05T04:00:00Z", endAt: "2026-11-05T09:00:00Z", status: "scheduled" }],
    "/reservations": [{ _id: "v1", room: rooms[0], title: "Seminar", date: "2026-11-06", startMinutes: 600, endMinutes: 660, status: "pending" }],
    "/audit-logs": { items: [{ _id: "a1", createdAt: "2026-11-02T05:00:00Z", actorName: "Admin", action: "update", entity: "room", details: { field: "capacity" } }], total: 1, page: 1, pages: 1 },
  };
  vi.spyOn(http, "get").mockImplementation((u) => ok(routes[u]));
  vi.spyOn(http, "post").mockImplementation(() => ok({}));
  vi.spyOn(http, "put").mockImplementation(() => ok({}));
  vi.spyOn(http, "delete").mockImplementation(() => ok({}));
});

describe("Maintenance page", () => {
  it("lists records and refuses an end time before the start", async () => {
    wrap(<MaintenancePage />);
    expect(await screen.findByText("AC repair")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Room"), { target: { value: "r1" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Paint" } });
    fireEvent.change(screen.getByLabelText("Starts (IST)"), { target: { value: "2026-11-05T10:00" } });
    fireEvent.change(screen.getByLabelText("Ends (IST)"), { target: { value: "2026-11-05T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save record" }));
    expect(await screen.findByText("The end must be after the start.")).toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();
  });
  it("saves a valid record with IST times converted", async () => {
    wrap(<MaintenancePage />); await screen.findByText("AC repair");
    fireEvent.change(screen.getByLabelText("Room"), { target: { value: "r1" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Paint" } });
    fireEvent.change(screen.getByLabelText("Starts (IST)"), { target: { value: "2026-11-05T09:00" } });
    fireEvent.change(screen.getByLabelText("Ends (IST)"), { target: { value: "2026-11-05T12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save record" }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/maintenance", expect.objectContaining({ room: "r1", reason: "Paint", analyze: true })));
    expect(http.post.mock.calls[0][1].startAt).toBe("2026-11-05T09:00:00+05:30");
  });
  it("asks for confirmation before deleting", async () => {
    wrap(<MaintenancePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(http.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);
    await waitFor(() => expect(http.delete).toHaveBeenCalledWith("/maintenance/m1"));
  });
});

describe("Reservations page", () => {
  it("admin can approve a pending request", async () => {
    wrap(<ReservationsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/reservations/v1/approve"));
  });
  it("faculty sees no approve button and cannot submit an invalid time range", async () => {
    wrap(<ReservationsPage />, "faculty");
    await screen.findByText("Seminar");
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Room"), { target: { value: "r1" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Club" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "11:00" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(await screen.findByText("The end time must be after the start time.")).toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();
  });
});

describe("Audit page", () => {
  it("shows entries and passes filters to the API", async () => {
    wrap(<AuditPage />);
    expect(await screen.findByText("capacity", { exact: false })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter by entity"), { target: { value: "room" } });
    await waitFor(() => expect(http.get).toHaveBeenCalledWith("/audit-logs", { params: expect.objectContaining({ entity: "room", page: 1 }) }));
  });
});
