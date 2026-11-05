import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUserGraduate,
  FaChalkboardTeacher,
  FaFlask,
  FaCalendarAlt,
  FaBullhorn,
  FaUsersCog,
  FaClock,
} from "react-icons/fa";

import http, { errorMessage } from "../api/http";
import TwinStats from "../components/TwinStats";
import { useAuth } from "../context/AuthContext";
import "./AdminDashboard.css";
import "./DashboardShared.css";

function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [statsResponse, noticeResponse] = await Promise.all([
          http.get("/stats"),
          http.get("/notices"),
        ]);
        setStats(statsResponse.data);
        setNotices(noticeResponse.data.slice(0, 4));
      } catch (err) {
        setError(errorMessage(err, "Could not load statistics."));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const cards = stats
    ? [
        { label: "Students", value: stats.students, icon: <FaUserGraduate /> },
        { label: "Faculty", value: stats.faculty, icon: <FaChalkboardTeacher /> },
        { label: "Labs", value: stats.labs, icon: <FaFlask /> },
        { label: "Events", value: stats.events, icon: <FaCalendarAlt /> },
        { label: "Notices", value: stats.notices, icon: <FaBullhorn /> },
      ]
    : [];

  const biggest = Math.max(1, ...cards.map((card) => card.value));

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div>
          <p>Welcome back 👋</p>
          <h1>Admin Dashboard</h1>
          <span>Manage and monitor the CampusTwin platform.</span>
        </div>

        <div className="admin-profile">
          <FaUsersCog />
          <div>
            <strong>{user.name}</strong>
            <small>Administrator</small>
          </div>
        </div>
      </div>

      {loading && <p className="dash-note">Loading statistics...</p>}
      {error && <p className="dash-error">{error}</p>}

      {stats && stats.twin && <TwinStats twin={stats.twin} />}

      {/* Summary Cards */}
      {stats && (
        <div className="admin-stats admin-stats-five">
          {cards.map((card) => (
            <div className="admin-stat-card" key={card.label}>
              {card.icon}
              <div>
                <h3>{card.label}</h3>
                <strong>{card.value}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="admin-content">
        {/* Simple chart */}
        {stats && (
          <div className="admin-section">
            <h2>Records in the Database</h2>

            {cards.map((card) => (
              <div className="admin-chart-row" key={card.label}>
                <span>{card.label}</span>
                <div className="admin-chart-bar">
                  <div style={{ width: `${(card.value / biggest) * 100}%` }} />
                </div>
                <strong>{card.value}</strong>
              </div>
            ))}

            <div className="overview-item">
              <span>Labs available now</span>
              <strong>
                {stats.availableLabs} of {stats.labs}
              </strong>
            </div>
            <div className="overview-item">
              <span>User accounts</span>
              <strong>{stats.users}</strong>
            </div>
          </div>
        )}

        {/* Latest notices */}
        <div className="admin-section">
          <h2>Latest Notices</h2>

          {!loading && notices.length === 0 && (
            <p className="dash-note">No notices have been posted yet.</p>
          )}

          {notices.map((item) => (
            <div className="activity" key={item._id}>
              <FaBullhorn />
              <p>
                {item.title}
                <span className="dash-notice-meta">
                  {item.category} · {item.date}
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Management */}
      <div className="admin-section">
        <h2>Management</h2>

        <div className="admin-actions">
          <button type="button" onClick={() => navigate("/students")}>
            <FaUserGraduate />
            Manage Students
          </button>
          <button type="button" onClick={() => navigate("/admin/faculty")}>
            <FaChalkboardTeacher />
            Manage Faculty
          </button>
          <button type="button" onClick={() => navigate("/admin/labs")}>
            <FaFlask />
            Manage Labs
          </button>
          <button type="button" onClick={() => navigate("/admin/events")}>
            <FaCalendarAlt />
            Manage Events
          </button>
          <button type="button" onClick={() => navigate("/admin/notices")}>
            <FaBullhorn />
            Manage Notices
          </button>
          <button type="button" onClick={() => navigate("/admin/timetable")}>
            <FaClock />
            Manage Timetable
          </button>
          <button type="button" onClick={() => navigate("/admin/users")}>
            <FaUsersCog />
            Manage Users
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
