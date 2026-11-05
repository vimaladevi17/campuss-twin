import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import http from "../api/http";
import "./News.css";

function News() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    http
      .get("/notices")
      .then((response) => setNews(response.data.slice(0, 3)))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="news">
      <h2>Latest News & Announcements</h2>

      {loading && <p>Loading announcements...</p>}
      {failed && <p>Announcements are not available right now.</p>}
      {!loading && !failed && news.length === 0 && <p>No announcements yet.</p>}

      <div className="news-container">
        {news.map((item) => (
          <div className="news-card" key={item._id}>
            <span>{item.date}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <Link to="/notices">
              <button type="button">Read More</button>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

export default News;
