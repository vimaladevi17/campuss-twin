import { useEffect, useState } from "react";
import http, { errorMessage } from "../api/http";
import "./Events.css";

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    http
      .get("/events")
      .then((response) => {
        setEvents(response.data);
      })
      .catch((err) => {
        console.error("Error fetching events:", err);
        setError(errorMessage(err, "Unable to load events."));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="events-page">
      <div className="events-header">
        <p>CampusTwin University Events</p>

        <h1>University Events</h1>

        <span>
          Discover upcoming events, workshops, seminars and activities
          happening across the campus.
        </span>
      </div>

      {loading && (
        <div className="events-message">
          <p>Loading events...</p>
        </div>
      )}

      {error && (
        <div className="events-message events-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="events-message">
          <p>No upcoming events available.</p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="events-grid">
          {events.map((event) => (
            <div className="event-card" key={event._id}>
              <span className="event-category">
                {event.category}
              </span>

              <h2>{event.title}</h2>

              <div className="event-info">
                <p>📅 {event.date}</p>
                <p>⏰ {event.time}</p>
                <p>📍 {event.location}</p>
              </div>

              {event.description && (
                <p className="event-description">
                  {event.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Events;