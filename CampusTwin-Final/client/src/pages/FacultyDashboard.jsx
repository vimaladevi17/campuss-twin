import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaChalkboardTeacher,
  FaUsers,
  FaBook,
  FaCalendarAlt,
  FaClipboardList,
  FaBullhorn,
  FaFlask,
  FaMapMarkedAlt,
} from "react-icons/fa";

import http, { errorMessage } from "../api/http";
import { useAuth } from "../context/AuthContext";
import "./FacultyDashboard.css";
import "./DashboardShared.css";

const todayDate = () => new Date().toISOString().slice(0, 10);
const todayName = () => new Date().toLocaleDateString("en-US", { weekday: "long" });

function FacultyDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [students, setStudents] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [events, setEvents] = useState([]);
  const [notices, setNotices] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);

  // Attendance form
  const [studentId, setStudentId] = useState("");
  const [subject, setSubject] = useState("");
  const [marking, setMarking] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [attendanceError, setAttendanceError] = useState("");

  useEffect(() => {
    const load = async () => {
      const requests = {
        profile: http.get("/faculty/me"),
        students: http.get("/students"),
        timetable: http.get("/timetable?mine=true"),
        events: http.get("/events"),
        notices: http.get("/notices"),
      };

      const keys = Object.keys(requests);
      const results = await Promise.allSettled(Object.values(requests));
      const nextErrors = {};

      results.forEach((result, index) => {
        const key = keys[index];

        if (result.status === "rejected") {
          const message = errorMessage(result.reason, "Could not load this section.");
          if (key === "profile") {
            setProfileError(message);
          } else {
            nextErrors[key] = message;
          }
          return;
        }

        const data = result.value.data;
        if (key === "profile") setProfile(data);
        if (key === "students") setStudents(data);
        if (key === "timetable") setTimetable(data);
        if (key === "events") setEvents(data.filter((item) => item.date >= todayDate()));
        if (key === "notices") setNotices(data.slice(0, 4));
      });

      setErrors(nextErrors);
      setLoading(false);
    };

    load();
  }, []);

  const markAttendance = async (present) => {
    setAttendanceMessage("");
    setAttendanceError("");

    if (!studentId || !subject.trim()) {
      setAttendanceError("Choose a student and enter a subject first.");
      return;
    }

    setMarking(true);
    try {
      const response = await http.post("/attendance/mark", {
        student: studentId,
        subject: subject.trim(),
        present,
      });
      const record = response.data;
      const name = students.find((item) => item._id === studentId)?.name || "Student";
      setAttendanceMessage(
        `${name} marked ${present ? "present" : "absent"} for ${record.subject}. Now ${record.attended}/${record.totalClasses} classes (${record.percentage}%).`
      );
    } catch (err) {
      setAttendanceError(errorMessage(err, "Could not save attendance."));
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <div className="faculty-dashboard">
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  const todaysClasses = timetable.filter((row) => row.day === todayName());
  const subjects = [...new Set(timetable.map((row) => row.subject))];

  return (
    <div className="faculty-dashboard">
      {/* Header */}
      <div className="faculty-header">
        <div>
          <p>Welcome back 👋</p>
          <h1>Faculty Dashboard</h1>
          <span>Manage your teaching activities and campus information.</span>
        </div>

        <div className="faculty-profile">
          <FaChalkboardTeacher />
          <div>
            <strong>{profile ? profile.name : user.name}</strong>
            <small>{profile ? profile.department : user.email}</small>
          </div>
        </div>
      </div>

      {profileError && (
        <div className="faculty-section">
          <p className="dash-error">{profileError}</p>
          <p className="dash-note">
            The rest of the dashboard still works. Ask the administrator to add a
            faculty record with the email {user.email}.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="faculty-cards">
        <div className="faculty-card">
          <FaUsers />
          <div>
            <h3>Students</h3>
            <strong>{students.length}</strong>
          </div>
        </div>

        <div className="faculty-card">
          <FaBook />
          <div>
            <h3>Subjects</h3>
            <strong>{subjects.length}</strong>
          </div>
        </div>

        <div className="faculty-card">
          <FaCalendarAlt />
          <div>
            <h3>Classes Today</h3>
            <strong>{todaysClasses.length}</strong>
          </div>
        </div>

        <div className="faculty-card">
          <FaClipboardList />
          <div>
            <h3>Upcoming Events</h3>
            <strong>{events.length}</strong>
          </div>
        </div>
      </div>

      {/* Main Sections */}
      <div className="faculty-grid">
        <div className="faculty-section">
          <h2>Today's Classes ({todayName()})</h2>

          {errors.timetable && <p className="dash-error">{errors.timetable}</p>}
          {!errors.timetable && todaysClasses.length === 0 && (
            <p className="dash-note">No classes scheduled for you today.</p>
          )}

          {todaysClasses.map((row) => (
            <div className="faculty-class" key={row._id}>
              <span>{row.time}</span>
              <div>
                <strong>{row.subject}</strong>
                <p>
                  {row.className ? `${row.className} | ` : ""}
                  {row.room}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="faculty-section">
          <h2>Profile</h2>

          {profile ? (
            <>
              <div className="faculty-class">
                <span>Designation</span>
                <p>{profile.designation}</p>
              </div>
              <div className="faculty-class">
                <span>Email</span>
                <p>{profile.email}</p>
              </div>
              {profile.cabin && (
                <div className="faculty-class">
                  <span>Cabin</span>
                  <p>{profile.cabin}</p>
                </div>
              )}
              {profile.specialization && (
                <div className="faculty-class">
                  <span>Specialization</span>
                  <p>{profile.specialization}</p>
                </div>
              )}
            </>
          ) : (
            <div className="faculty-class">
              <span>Email</span>
              <p>{user.email}</p>
            </div>
          )}
        </div>
      </div>

      {/* Weekly timetable */}
      <div className="faculty-section">
        <h2>
          <FaCalendarAlt /> My Timetable
        </h2>

        {!errors.timetable && timetable.length === 0 && (
          <p className="dash-note">
            No classes are assigned to you yet. Timetable entries match your name
            ({user.name}).
          </p>
        )}

        {timetable.length > 0 && (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Room</th>
                </tr>
              </thead>
              <tbody>
                {timetable.map((row) => (
                  <tr key={row._id}>
                    <td>{row.day}</td>
                    <td>{row.time}</td>
                    <td>{row.subject}</td>
                    <td>{row.className}</td>
                    <td>{row.room}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attendance */}
      <div className="faculty-section">
        <h2>
          <FaClipboardList /> Mark Attendance
        </h2>

        {errors.students && <p className="dash-error">{errors.students}</p>}

        <div className="attendance-form">
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select student</option>
            {students.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name} ({item.registerNumber})
              </option>
            ))}
          </select>

          <input
            type="text"
            list="subject-list"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <datalist id="subject-list">
            {subjects.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <button type="button" className="present" disabled={marking} onClick={() => markAttendance(true)}>
            Present
          </button>
          <button type="button" className="absent" disabled={marking} onClick={() => markAttendance(false)}>
            Absent
          </button>
        </div>

        {attendanceMessage && <p className="attendance-ok">{attendanceMessage}</p>}
        {attendanceError && <p className="dash-error">{attendanceError}</p>}
        <p className="dash-note">Each click adds one class for the subject.</p>
      </div>

      {/* Quick Actions */}
      <div className="faculty-section">
        <h2>Quick Access</h2>

        <div className="faculty-actions">
          <button type="button" onClick={() => navigate("/events")}>
            <FaCalendarAlt />
            Events
          </button>
          <button type="button" onClick={() => navigate("/notices")}>
            <FaBullhorn />
            Notices
          </button>
          <button type="button" onClick={() => navigate("/labs")}>
            <FaFlask />
            Labs
          </button>
          <button type="button" onClick={() => navigate("/campus")}>
            <FaMapMarkedAlt />
            Campus Map
          </button>
          <button type="button" onClick={() => navigate("/faculty")}>
            <FaChalkboardTeacher />
            Faculty
          </button>
        </div>
      </div>

      {/* Upcoming events */}
      <div className="faculty-section">
        <h2>
          <FaCalendarAlt /> Upcoming Events
        </h2>

        {errors.events && <p className="dash-error">{errors.events}</p>}
        {!errors.events && events.length === 0 && (
          <p className="dash-note">No upcoming events available.</p>
        )}

        {events.slice(0, 4).map((event) => (
          <div className="faculty-class" key={event._id}>
            <span>{event.date}</span>
            <div>
              <strong>{event.title}</strong>
              <p>
                {event.time} · {event.location}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Notices */}
      <div className="faculty-section">
        <h2>
          <FaBullhorn /> Notices
        </h2>

        {errors.notices && <p className="dash-error">{errors.notices}</p>}
        {!errors.notices && notices.length === 0 && (
          <p className="dash-note">No notices at the moment.</p>
        )}

        {notices.map((item) => (
          <div className="faculty-notice" key={item._id}>
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

export default FacultyDashboard;
