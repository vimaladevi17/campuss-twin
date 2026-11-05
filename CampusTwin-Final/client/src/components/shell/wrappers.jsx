import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ProtectedRoute from "../ProtectedRoute";
import Navbar from "../Navbar";
import AppShell from "./AppShell";

// New CampusTwin screens: Tailwind-styled, border-box.
export const New = ({ children }) => <div className="ct-new">{children}</div>;
// Pre-existing screens shown inside the shell (light panel, reduced top padding).
export const Legacy = ({ children }) => <div className="ct-legacy">{children}</div>;

// Logged-in area: sidebar shell. Not logged in -> login.
export function ShellLayout() {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <AppShell />;
}

// Pages that are public on the website but should use the sidebar once someone is logged in.
export function AdaptiveLayout() {
  const { user } = useAuth();
  if (user) return <AppShell />;
  return (<><Navbar /><div className="ct-public"><Outlet /></div></>);
}

// The public marketing pages always show the website navbar.
export function PublicLayout() { return (<><Navbar /><div className="ct-public"><Outlet /></div></>); }

export const Guard = ({ roles, children }) => <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;
