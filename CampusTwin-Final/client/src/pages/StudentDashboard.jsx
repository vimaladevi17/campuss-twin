import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaUserGraduate,
  FaCalendarAlt,
  FaBook,
  FaClipboardCheck,
  FaMapMarkedAlt,
  FaFlask,
  FaChalkboardTeacher,
  FaBullhorn,
  FaClock,
  FaGraduationCap,
} from "react-icons/fa";

import http, { errorMessage } from "../api/http";
import { useAuth } from "../context/AuthContext";
import "./StudentDashboard.css";
import "./DashboardShared.css";

const today = () => new Date().toISOString().slice(0, 10);

function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [student, setStudent] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [events, setEvents] = useState([]);
  const [notices, setNotices] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const requests = {
        student: http.get("/students/me"),
        attendance: http.get("/attendance/me"),
        events: http.get("/events"),
        notices: http.get("/notices"),
        timetable: http.get("/timetable"),
      };

      const keys = Object.keys(requests);
      const results = await Promise.allSettled(Object.values(requests));
      const nextErrors = {};

      results.forEach((result, index) => {
        const key = keys[index];

        if (result.status === "rejected") {
          const message = errorMessage(result.reason, "Could not load this section.");
          if (key === "student") {
            setProfileError(message);
          } else {
            nextErrors[key] = message;
          }
          return;
        }

        const data = result.value.data;
        if (key === "student") setStudent(data);
        if (key === "attendance") setAttendance(data);
        if (key === "events") setEvents(data.filter((item) => item.date >= today()));
        if (key === "notices") setNotices(data.slice(0, 4));
        if (key === "timetable") setTimetable(data);
      });

      setErrors(nextErrors);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  const overall =
    attendance.length > 0
      ? Math.round(
          (attendance.reduce((sum, row) => sum + row.attended, 0) /
            Math.max(1, attendance.reduce((sum, row) => sum + row.totalClasses, 0))) *
            100
        )
      : student
      ? Number(student.attendance)
      : 0;

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <p>Welcome back 👋</p>
          <h1>Student Dashboard</h1>
          <span>Manage your academic activities and campus information.</span>
        </div>

        <div className="student-profile">
          <FaUserGraduate />
          <div>
            <strong>{student ? student.name : user.name}</strong>
            <small>{student ? student.department : user.email}</small>
          </div>
        </div>
      </div>

      {profileError && (
        <div className="dashboard-section">
          <p className="dash-error">{profileError}</p>
          <p className="dash-note">
            The rest of the dashboard still works. Ask the administrator to add a
            student record with the email {user.email}.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="dashboard-cards">
        <div className="dashboard-card">
          <FaClipboardCheck />
          <div>
            <h3>Attendance</h3>
            <strong>{overall}%</strong>
          </div>
        </div>

        <div className="dashboard-card">
          <FaGraduationCap />
          <div>
            <h3>Year</h3>
            <strong>{student ? student.year : "-"}</strong>
          </div>
        </div>

        <div className="dashboard-card">
          <FaBook />
          <div>
            <h3>Section</h3>
            <strong>{student ? student.section : "-"}</strong>
          </div>
        </div>

        <div className="dashboard-card">
          <FaCalendarAlt />
          <div>
            <h3>Upcoming Events</h3>
            <strong>{events.length}</strong>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Student Profile */}
        <div className="dashboard-section">
          <h2>Student Profile</h2>

          <div className="class-item">
            <span>Name</span>
            <p>{student ? student.name : user.name}</p>
          </div>

          <div className="class-item">
            <span>Email</span>
            <p>{user.email}</p>
          </div>

          {student && (
            <>
              <div className="class-item">
                <span>Register No.</span>
                <p>{student.registerNumber}</p>
              </div>
              <div className="class-item">
                <span>Department</span>
                <p>{student.department}</p>
              </div>
              <div className="class-item">
                <span>Year / Section</span>
                <p>
                  {student.year} / {student.section}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Attendance */}
        <div className="dashboard-section">
          <h2>Attendance by Subject</h2>

          {errors.attendance && <p className="dash-error">{errors.attendance}</p>}
          {!errors.attendance && attendance.length === 0 && (
            <p className="dash-note">No subject-wise attendance has been recorded yet.</p>
          )}

          {attendance.length > 0 && (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Total</th>
                    <th>Attended</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((row) => (
                    <tr key={row._id}>
                      <td>{row.subject}</td>
                      <td>{row.totalClasses}</td>
                      <td>{row.attended}</td>
                      <td>
                        <span className={`dash-pill ${row.percentage >= 75 ? "good" : "low"}`}>
                          {row.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Timetable */}
      <div className="dashboard-section">
        <h2>
          <FaClock /> Timetable
        </h2>

        {errors.timetable && <p className="dash-error">{errors.timetable}</p>}
        {!errors.timetable && timetable.length === 0 && (
          <p className="dash-note">The timetable has not been published yet.</p>
        )}

        {timetable.length > 0 && (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Subject</th>
                  <th>Faculty</th>
                  <th>Room</th>
                </tr>
              </thead>
              <tbody>
                {timetable.map((row) => (
                  <tr key={row._id}>
                    <td>{row.day}</td>
                    <td>{row.time}</td>
                    <td>{row.subject}</td>
                    <td>{row.faculty}</td>
                    <td>{row.room}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upcoming Events */}
      <div className="dashboard-section">
        <h2>
          <FaCalendarAlt /> Upcoming Events
        </h2>

        {errors.events && <p className="dash-error">{errors.events}</p>}
        {!errors.events && events.length === 0 && (
          <p className="dash-note">No upcoming events available.</p>
        )}

        {events.slice(0, 4).map((event) => (
          <div className="class-item" key={event._id}>
            <span>{event.category}</span>
            <div>
              <strong>{event.title}</strong>
              <p>
                <FaClock /> {event.date} — {event.time}
              </p>
              <p>{event.location}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="dashboard-section">
        <h2>Quick Access</h2>

        <div className="action-grid">
          <button type="button" onClick={() => navigate("/campus")}>
            <FaMapMarkedAlt />
            Campus Map
          </button>

          <button type="button" onClick={() => navigate("/events")}>
            <FaCalendarAlt />
            Events
          </button>

          <button type="button" onClick={() => navigate("/labs")}>
            <FaFlask />
            Labs
          </button>

          <button type="button" onClick={() => navigate("/faculty")}>
            <FaChalkboardTeacher />
            Faculty
          </button>
        </div>
      </div>

      {/* Notices */}
      <div className="dashboard-section">
        <h2>
          <FaBullhorn /> Notices
        </h2>

        {errors.notices && <p className="dash-error">{errors.notices}</p>}
        {!errors.notices && notices.length === 0 && (
          <p className="dash-note">No notices at the moment.</p>
        )}

        {notices.map((item) => (
          <div className="notice" key={item._id}>
            <FaBullhorn />
            <p>
              {item.title}
              <span className="dash-notice-meta">
                {item.category} · {item.date}
              </span>
            </p>
          </div>
        ))}

        <Link className="dash-link" to="/notices">
          View all notices
        </Link>
      </div>
    </div>
  );
}

export default StudentDashboard;
