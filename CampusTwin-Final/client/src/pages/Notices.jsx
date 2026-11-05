import React, { useEffect, useState } from "react";
import http, { errorMessage } from "../api/http";
import "./Notices.css";

const categories = ["All", "General", "Academic", "Exam", "Event", "Placement", "Urgent"];

function Notices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    http
      .get("/notices")
      .then((response) => setNotices(response.data))
      .catch((err) => setError(errorMessage(err, "Unable to load notices.")))
      .finally(() => setLoading(false));
  }, []);

  const visible = notices.filter(
    (item) => category === "All" || item.category === category
  );

  return (
    <div className="notices-page">
      <div className="notices-header">
        <p>CampusTwin Notice Board</p>
        <h1>Notices and Announcements</h1>
      </div>

      <div className="notices-filters">
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            className={name === category ? "active" : ""}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {loading && <p className="notices-message">Loading notices...</p>}
      {error && <p className="notices-message notices-error">{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p className="notices-message">No notices to show.</p>
      )}

      <div className="notices-list">
        {visible.map((item) => (
          <div className={`notice-card priority-${item.priority.toLowerCase()}`} key={item._id}>
            <div className="notice-meta">
              <span className="notice-category">{item.category}</span>
              <span>{item.date}</span>
              {item.priority === "High" && <span className="notice-high">High priority</span>}
            </div>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <small>Posted by {item.createdBy}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Notices;
