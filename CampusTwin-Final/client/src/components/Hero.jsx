import React, { useEffect, useState } from "react";
import "./Hero.css";

import slide1 from "../assets/slider/slide1.jpg";
import slide2 from "../assets/slider/slide2.jpg";
import slide3 from "../assets/slider/slide3.jpg";
import slide4 from "../assets/slider/slide4.jpg";

const slides = [slide1, slide2, slide3, slide4];

function Hero() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setCurrent((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <section
      className="hero"
      style={{ backgroundImage: `url(${slides[current]})` }}
    >
      <div className="overlay">

        <h1>Welcome to CampusTwin</h1>

        <h2>Kalasalingam Academy of Research and Education</h2>

        <p>
          Smart Digital Twin Platform for Intelligent Campus Management
        </p>

        <div className="hero-buttons">
          <button>Explore Campus</button>
          <button className="secondary-btn">Student Portal</button>
        </div>

        <button className="arrow left" onClick={prevSlide}>
          &#10094;
        </button>

        <button className="arrow right" onClick={nextSlide}>
          &#10095;
        </button>

        <div className="dots">
          {slides.map((_, index) => (
            <span
              key={index}
              className={current === index ? "dot active" : "dot"}
              onClick={() => setCurrent(index)}
            ></span>
          ))}
        </div>

      </div>
    </section>
  );
}

export default Hero;