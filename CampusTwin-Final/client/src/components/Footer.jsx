import React from "react";
import { Link } from "react-router-dom";
import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">

        <div className="footer-section">
          <h2>CampusTwin</h2>
          <p>
            Smart Digital Twin Platform for
            Kalasalingam University.
          </p>
        </div>

        <div className="footer-section">
          <h3>Quick Links</h3>
          <p><Link to="/" style={{ color: "inherit", textDecoration: "none" }}>Home</Link></p>
          <p><Link to="/campus" style={{ color: "inherit", textDecoration: "none" }}>Campus Map</Link></p>
          <p><Link to="/faculty" style={{ color: "inherit", textDecoration: "none" }}>Faculty</Link></p>
          <p><Link to="/events" style={{ color: "inherit", textDecoration: "none" }}>Events</Link></p>
        </div>

        <div className="footer-section">
          <h3>Contact</h3>
          <p>Kalasalingam University</p>
          <p>Krishnankoil, Tamil Nadu</p>
          <p>Email: info@klu.ac.in</p>
          <p>Phone: +91-4563-289042</p>
        </div>

      </div>

      <hr />

      <p className="copyright">
        © 2026 CampusTwin | Developed using MERN Stack
      </p>
    </footer>
  );
}

export default Footer;