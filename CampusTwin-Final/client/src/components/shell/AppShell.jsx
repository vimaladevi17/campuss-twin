import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useCallback } from "react";
import { useSocketEvents } from "../../lib/socket";
import { Menu, Moon, Sun, Bell, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { navFor } from "../../lib/nav";
import http from "../../api/http";
import logo from "../../assets/images/logo.png";
import "./shell.css";

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("campustwin_theme", next ? "dark" : "light"); } catch (e) { /* storage unavailable */ }
    setDark(next);
  };
  return [dark, toggle];
}

function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dark, toggleTheme] = useTheme();
  const [unread, setUnread] = useState(0);

  // Live updates arrive over Socket.IO. REST polling stays as a fallback (every 60 s while the socket is down).
  const loadUnread = useCallback(() => http.get("/notifications?unread=true").then((r) => setUnread(r.data.unread || 0)).catch(() => {}), []);
  const connected = useSocketEvents({
    "notification:new": () => { setUnread((n) => n + 1); window.dispatchEvent(new Event("campustwin:notifications")); },
    "notification:read": () => { loadUnread(); window.dispatchEvent(new Event("campustwin:notifications")); },
    "notification:sync": (m) => { setUnread(m.unread || 0); window.dispatchEvent(new Event("campustwin:notifications")); },
  });
  useEffect(() => {
    loadUnread();
    if (connected) return undefined;
    const t = setInterval(loadUnread, 60000);
    return () => clearInterval(t);
  }, [connected, loadUnread]);

  const groups = navFor(user.role);
  return (
    <div className="ct-app min-h-screen">
      <aside className={`ct-sidebar ${open ? "open" : ""}`} aria-label="Main navigation">
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-line">
          <img src={logo} alt="" className="h-8 w-8 rounded object-contain" />
          <div className="leading-tight">
            <div className="font-semibold text-ink">CampusTwin</div>
            <div className="text-[11px] text-muted">KARE · Krishnankoil</div>
          </div>
        </div>
        <nav className="p-3 overflow-y-auto flex-1">
          {groups.map((g) => (
            <div key={g.group} className="mb-3">
              <div className="px-2 mb-1 text-[11px] uppercase tracking-wide text-muted">{g.group}</div>
              {g.links.map(([path, label, Icon]) => (
                <NavLink key={path} to={path} onClick={() => setOpen(false)} className={({ isActive }) => `ct-link ${isActive ? "active" : ""}`}>
                  <Icon size={17} aria-hidden="true" /> <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      {open && <div className="ct-scrim" onClick={() => setOpen(false)} />}

      <div className="ct-main">
        <header className="ct-topbar">
          <button type="button" className="ct-burger" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <div className="flex-1" />
          <button type="button" className="ct-icon" onClick={toggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button type="button" className="ct-icon relative" onClick={() => navigate("/notifications")} aria-label={`Notifications (${unread} unread)`}>
            <Bell size={18} />{unread > 0 && <span className="ct-dot">{unread > 9 ? "9+" : unread}</span>}
          </button>
          <div className="text-right leading-tight hidden sm:block">
            <div className="text-sm font-medium text-ink">{user.name}</div>
            <div className="text-[11px] text-muted capitalize">{user.role}</div>
          </div>
          <button type="button" className="ct-icon" onClick={() => { logout(); navigate("/login"); }} aria-label="Log out"><LogOut size={18} /></button>
        </header>
        <main className="ct-content"><Outlet /></main>
      </div>
    </div>
  );
}
export default AppShell;
