import "./About.css";

function About() {
  return (
    <div className="about-page">
      <div className="about-header">
        <p>CampusTwin Digital Campus</p>

        <h1>About CampusTwin</h1>

        <span>
          A smart digital platform designed to provide a connected
          and interactive view of the university campus.
        </span>
      </div>

      <div className="about-content">
        <div className="about-card">
          <h2>What is CampusTwin?</h2>

          <p>
            CampusTwin is a Smart Digital Twin Platform developed
            to represent and organize important university campus
            information in one interactive application. It brings
            together campus facilities, faculty information,
            laboratory availability, events and other campus
            resources.
          </p>
        </div>

        <div className="about-card">
          <h2>Platform Features</h2>

          <div className="about-features">
            <div className="about-feature">
              <span>🗺️</span>
              Interactive Campus Map
            </div>

            <div className="about-feature">
              <span>👨‍🏫</span>
              Faculty Directory
            </div>

            <div className="about-feature">
              <span>🧪</span>
              Laboratory Availability
            </div>

            <div className="about-feature">
              <span>📅</span>
              University Events
            </div>

            <div className="about-feature">
              <span>📊</span>
              Student and Faculty Dashboards
            </div>
          </div>
        </div>
      </div>

      <div className="about-mission">
        <h2>Our Vision</h2>

        <p>
          CampusTwin aims to provide a centralized digital
          environment that makes campus information easier to
          discover and access. The platform can serve students,
          faculty and administrators by connecting different
          campus resources through a single digital interface.
        </p>
      </div>
    </div>
  );
}

export default About;