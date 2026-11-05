import React, { useEffect, useState } from "react";
import http from "../api/http";
import "./Stats.css";

// Live counts from the database (no hardcoded numbers).
function Stats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    http.get("/public/stats").then((r) => setStats(r.data)).catch(() => setStats(null));
  }, []);

  const items = [
    ["Faculty", stats?.faculty],
    ["Students", stats?.students],
    ["Classrooms", stats?.classrooms],
    ["Labs", stats?.labs],
  ];

  return (
    <section className="stats">
      {items.map(([label, value]) => (
        <div className="card" key={label}>
          <h2>{value ?? "—"}</h2>
          <p>{label}</p>
        </div>
      ))}
    </section>
  );
}

export default Stats;
