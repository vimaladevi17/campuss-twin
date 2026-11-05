import React, { useEffect, useState } from "react";
import http, { errorMessage } from "../api/http";
import "./Faculty.css";

function Faculty() {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");

  useEffect(() => {
    http
      .get("/faculty")
      .then((response) => setFaculty(response.data))
      .catch((err) => setError(errorMessage(err, "Unable to load faculty.")))
      .finally(() => setLoading(false));
  }, []);

  const departments = ["All", ...new Set(faculty.map((item) => item.department))];

  const filtered = faculty.filter((item) => {
    const text = `${item.name} ${item.specialization || ""}`.toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    const matchesDepartment = department === "All" || item.department === department;
    return matchesSearch && matchesDepartment;
  });

  return (
    <div className="faculty-page">
      <h1>Faculty Directory</h1>

      <div className="faculty-filters">
        <input
          type="text"
          placeholder="Search by name or specialization..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={department} onChange={(e) => setDepartment(e.target.value)}>
          {departments.map((name) => (
            <option key={name} value={name}>
              {name === "All" ? "All departments" : name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="faculty-message">Loading faculty...</p>}
      {error && <p className="faculty-message faculty-error">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="faculty-message">No faculty members found.</p>
      )}

      <div className="faculty-grid">
        {filtered.map((item) => (
          <div className="faculty-card" key={item._id}>
            {item.image && (
              <img className="faculty-photo" src={item.image} alt={item.name} />
            )}

            <h2>{item.name}</h2>

            <p><strong>Department:</strong> {item.department}</p>
            <p><strong>Designation:</strong> {item.designation}</p>
            {item.specialization && (
              <p><strong>Specialization:</strong> {item.specialization}</p>
            )}
            {item.cabin && <p><strong>Cabin:</strong> {item.cabin}</p>}
            <p><strong>Email:</strong> {item.email}</p>
            {item.phone && <p><strong>Phone:</strong> {item.phone}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Faculty;
