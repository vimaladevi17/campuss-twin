import React from "react";
import { FaMapMarkedAlt, FaChalkboardTeacher, FaLaptopCode, FaCalendarAlt, FaBullhorn, FaChartBar } from "react-icons/fa";
import "./Features.css";

function Features() {
  const features = [
    {
      icon: <FaMapMarkedAlt />,
      title: "Campus Map",
      description: "Navigate the university with an interactive campus map."
    },
    {
      icon: <FaChalkboardTeacher />,
      title: "Faculty Directory",
      description: "Search faculty members and find their cabin locations."
    },
    {
      icon: <FaLaptopCode />,
      title: "Lab Availability",
      description: "Check available computer labs in real time."
    },
    {
      icon: <FaCalendarAlt />,
      title: "Events",
      description: "Stay updated with seminars, workshops and campus events."
    },
    {
      icon: <FaBullhorn />,
      title: "Notice Board",
      description: "View the latest announcements from the university."
    },
    {
      icon: <FaChartBar />,
      title: "Dashboard",
      description: "Monitor campus statistics through an analytics dashboard."
    }
  ];

  return (
    <section className="features">
      <h2>Campus Features</h2>

      <div className="feature-grid">
        {features.map((feature, index) => (
          <div className="feature-card" key={index}>
            <div className="icon">{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Features;