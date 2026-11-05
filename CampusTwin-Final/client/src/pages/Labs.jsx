import React, { useEffect, useState } from "react";
import http, { errorMessage } from "../api/http";
import "./Labs.css";

function Labs() {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Live status is calculated from timetable/maintenance. If no laboratory rooms exist yet
    // (database not migrated), fall back to the original lab list.
    http
      .get("/public/labs")
      .then((response) => (response.data.length ? response.data : http.get("/labs").then((legacy) => legacy.data)))
      .catch(() => http.get("/labs").then((legacy) => legacy.data))
      .then((data) => setLabs(data))
      .catch((err) => setError(errorMessage(err, "Unable to load labs.")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="labs-page">
      <h1>Lab Availability</h1>

      {loading && <p className="labs-message">Loading labs...</p>}
      {error && <p className="labs-message labs-error">{error}</p>}
      {!loading && !error && labs.length === 0 && (
        <p className="labs-message">No labs have been added yet.</p>
      )}

      <div className="labs-grid">
        {labs.map((lab) => (
          <div className="lab-card" key={lab._id}>
            <h2>{lab.name}</h2>

            <p><strong>Location:</strong> {lab.building ? lab.building.name : lab.location}</p>
            {lab.department && <p><strong>Department:</strong> {lab.department}</p>}
            {lab.isDemo && <p><em>DEMO sample data</em></p>}
            <p><strong>Capacity:</strong> {lab.capacity}</p>
            {lab.description && <p>{lab.description}</p>}

            <p className={String(lab.status).toLowerCase()}>
              {{ available: "Available", occupied: "Occupied", maintenance: "Maintenance", unavailable: "Unavailable" }[lab.status] || lab.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Labs;
