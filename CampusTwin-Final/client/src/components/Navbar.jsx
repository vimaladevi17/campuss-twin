import React from "react";
import logo from "../assets/images/logo.png";
import "./Navbar.css";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, roleHome } from "../context/AuthContext";

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  let links;

  if (!user) {
    links = [
      ["/", "Home"],
      ["/campus", "Campus"],
      ["/faculty", "Faculty"],
      ["/labs", "Labs"],
      ["/events", "Events"],
      ["/about", "About"],
      ["/contact", "Contact"],
    ];
  } else if (user.role === "admin") {
    links = [
      [roleHome("admin"), "Dashboard"],
      ["/students", "Students"],
      ["/admin/faculty", "Faculty"],
      ["/admin/labs", "Labs"],
      ["/admin/events", "Events"],
      ["/admin/notices", "Notices"],
    ];
  } else {
    links = [
      [roleHome(user.role), "Dashboard"],
      ["/campus", "Campus"],
      ["/labs", "Labs"],
      ["/events", "Events"],
      ["/notices", "Notices"],
      ["/profile", "Profile"],
    ];
  }

  return (
    <nav className="navbar">
      <Link to="/" className="logo-section">
        <img src={logo} alt="KARE Logo" className="logo" />
        <h2>CampusTwin</h2>
      </Link>

      <ul className="nav-links">
        {links.map(([path, label]) => (
          <li key={label}>
            <Link to={path}>{label}</Link>
          </li>
        ))}

        {user ? (
          <li>
            <button type="button" className="nav-logout" onClick={handleLogout}>
              Logout
            </button>
          </li>
        ) : (
          <li>
            <Link to="/login">Login</Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

export default Navbar;
