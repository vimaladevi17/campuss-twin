import { LayoutDashboard, Map, Building2, Layers, School, FlaskConical, CalendarDays, SearchCheck, ArrowLeftRight, Store, Accessibility, Bell, Users, Settings, GraduationCap, UserSquare, Wrench, ClipboardList, BookOpen, History, Megaphone, CalendarCheck } from "lucide-react";
import { roleHome } from "../context/AuthContext";

// [path, label, icon, roles that see it]   (server still enforces permissions; this only shapes the menu)
const ALL = ["admin", "faculty", "student"];
export function navFor(role) {
  const items = [
    { group: "Overview", links: [[roleHome(role), "Dashboard", LayoutDashboard, ALL], ["/campus", "Campus Map", Map, ALL], ["/accessibility", "Accessibility", Accessibility, ALL]] },
    { group: "Campus", links: [
      ["/admin/buildings", "Buildings", Building2, ["admin"]], ["/admin/rooms", "Floors & Rooms", Layers, ["admin"]],
      ["/admin/classrooms", "Classrooms", School, ["admin"]], ["/admin/laboratories", "Laboratories", FlaskConical, ["admin"]],
      ["/admin/facilities", "Facilities", Store, ["admin"]], ["/admin/courses", "Courses", BookOpen, ["admin"]], ["/admin/maintenance", "Maintenance", Wrench, ["admin"]], ["/labs", "Lab Availability", FlaskConical, ["faculty", "student"]] ] },
    { group: "Scheduling", links: [
      ["/timetable", "Timetable", CalendarDays, ALL], ["/vacancy", "Vacancy Finder", SearchCheck, ["admin", "faculty"]],
      ["/reservations", "Room Reservations", ClipboardList, ["admin", "faculty"]], ["/replacements", "Smart Lab Replacement", ArrowLeftRight, ["admin"]] ] },
    { group: "Portal", links: [
      ["/students", "Students", GraduationCap, ["admin"]], ["/faculty", "Faculty", UserSquare, ALL],
      ["/events", "Events", CalendarCheck, ALL], ["/notices", "Notices", Megaphone, ALL] ] },
    { group: "System", links: [["/notifications", "Notifications", Bell, ALL], ["/admin/users", "User Management", Users, ["admin"]], ["/admin/audit", "Audit History", History, ["admin"]], ["/settings", "Settings", Settings, ALL]] },
  ];
  return items.map((g) => ({ group: g.group, links: g.links.filter(([, , , roles]) => roles.includes(role)) })).filter((g) => g.links.length);
}
