import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ShellLayout, AdaptiveLayout, PublicLayout, Guard, New, Legacy } from "./components/shell/wrappers";

import Home from "./pages/Home";
import Login from "./pages/Login";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Faculty from "./pages/Faculty";
import Labs from "./pages/Labs";
import Events from "./pages/Events";
import Notices from "./pages/Notices";
import Profile from "./pages/Profile";
import Students from "./pages/Students";
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminManage from "./pages/admin/AdminManage";

// New CampusTwin screens (code-split so the website stays light)
const CampusMapPage = lazy(() => import("./pages/twin/CampusMapPage"));
const TimetablePage = lazy(() => import("./pages/twin/TimetablePage"));
const VacancyPage = lazy(() => import("./pages/twin/VacancyPage"));
const ReplacementPage = lazy(() => import("./pages/twin/ReplacementPage"));
const NotificationsPage = lazy(() => import("./pages/twin/NotificationsPage"));
const SettingsPage = lazy(() => import("./pages/twin/SettingsPage"));
const MaintenancePage = lazy(() => import("./pages/twin/AdminOpsPages").then((m) => ({ default: m.MaintenancePage })));
const ReservationsPage = lazy(() => import("./pages/twin/AdminOpsPages").then((m) => ({ default: m.ReservationsPage })));
const AuditPage = lazy(() => import("./pages/twin/AdminOpsPages").then((m) => ({ default: m.AuditPage })));

const wait = (el) => <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>{el}</Suspense>;

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Website pages (always with the website navbar) */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
            </Route>

            {/* Public on the website, sidebar once logged in */}
            <Route element={<AdaptiveLayout />}>
              <Route path="/campus" element={wait(<New><CampusMapPage layer="general" /></New>)} />
              <Route path="/faculty" element={<Legacy><Faculty /></Legacy>} />
              <Route path="/labs" element={<Legacy><Labs /></Legacy>} />
              <Route path="/events" element={<Legacy><Events /></Legacy>} />
              <Route path="/notices" element={<Legacy><Notices /></Legacy>} />
            </Route>

            {/* Logged-in CampusTwin app */}
            <Route element={<ShellLayout />}>
              <Route path="/profile" element={<Legacy><Profile /></Legacy>} />
              <Route path="/student-dashboard" element={<Guard roles={["student"]}><Legacy><StudentDashboard /></Legacy></Guard>} />
              <Route path="/faculty-dashboard" element={<Guard roles={["faculty"]}><Legacy><FacultyDashboard /></Legacy></Guard>} />
              <Route path="/admin-dashboard" element={<Guard roles={["admin"]}><Legacy><AdminDashboard /></Legacy></Guard>} />
              <Route path="/students" element={<Guard roles={["admin"]}><Legacy><Students /></Legacy></Guard>} />
              <Route path="/admin/maintenance" element={<Guard roles={["admin"]}>{wait(<New><MaintenancePage /></New>)}</Guard>} />
              <Route path="/admin/audit" element={<Guard roles={["admin"]}>{wait(<New><AuditPage /></New>)}</Guard>} />
              <Route path="/reservations" element={<Guard roles={["faculty"]}>{wait(<New><ReservationsPage /></New>)}</Guard>} />
              <Route path="/admin/:resource" element={<Guard roles={["admin"]}><Legacy><AdminManage /></Legacy></Guard>} />
              <Route path="/accessibility" element={wait(<New><CampusMapPage layer="accessibility" /></New>)} />
              <Route path="/timetable" element={wait(<New><TimetablePage /></New>)} />
              <Route path="/vacancy" element={<Guard roles={["faculty"]}>{wait(<New><VacancyPage /></New>)}</Guard>} />
              <Route path="/replacements" element={<Guard roles={["admin"]}>{wait(<New><ReplacementPage /></New>)}</Guard>} />
              <Route path="/notifications" element={wait(<New><NotificationsPage /></New>)} />
              <Route path="/settings" element={wait(<New><SettingsPage /></New>)} />
              <Route path="/admin-events" element={<Navigate to="/admin/events" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
export default App;
