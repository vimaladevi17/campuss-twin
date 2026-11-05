import React from "react";
import { Link } from "react-router-dom";
import "./QuickAccess.css";

function QuickAccess() {
  const cards = [
    {
      title: "Campus Map",
      icon: "🗺️",
      link: "/campus"
    },
    {
      title: "Faculty",
      icon: "👨‍🏫",
      link: "/faculty"
    },
    {
      title: "Labs",
      icon: "💻",
      link: "/labs"
    },
    {
      title: "Events",
      icon: "📅",
      link: "/events"
    },
    {
      title: "About",
      icon: "🏫",
      link: "/about"
    },
    {
      title: "Login",
      icon: "🔐",
      link: "/login"
    }
  ];

  return (
    <section className="quick-access">

      <h2>Quick Access</h2>

      <div className="quick-grid">

        {cards.map((card, index) => (

          <Link
            key={index}
            to={card.link}
            className="quick-card"
          >

            <h1>{card.icon}</h1>

            <h3>{card.title}</h3>

          </Link>

        ))}

      </div>

    </section>
  );
}

export default QuickAccess;