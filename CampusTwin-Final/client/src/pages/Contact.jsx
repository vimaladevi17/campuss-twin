import "./Contact.css";

function Contact() {
  return (
    <div className="contact-page">
      <div className="contact-header">
        <p>CampusTwin Support</p>

        <h1>Contact Us</h1>

        <span>
          Need help with CampusTwin? Find the university contact
          information and available support options below.
        </span>
      </div>

      <div className="contact-content">
        <div className="contact-card">
          <h2>University Contact</h2>

          <div className="contact-item">
            <div className="contact-icon">🏛️</div>

            <div>
              <h3>University</h3>
              <p>
                Kalasalingam Academy of Research and Education
              </p>
            </div>
          </div>

          <div className="contact-item">
            <div className="contact-icon">📍</div>

            <div>
              <h3>Location</h3>
              <p>Krishnankoil, Tamil Nadu, India</p>
            </div>
          </div>

          <div className="contact-item">
            <div className="contact-icon">📧</div>

            <div>
              <h3>Email</h3>
              <p>For university-related enquiries, contact the
                appropriate university office.</p>
            </div>
          </div>

          <div className="contact-item">
            <div className="contact-icon">🌐</div>

            <div>
              <h3>CampusTwin</h3>
              <p>Smart Digital Campus Platform</p>
            </div>
          </div>
        </div>

        <div className="contact-support">
          <h2>CampusTwin Support</h2>

          <p>
            CampusTwin brings campus information together in one
            digital platform. Use the appropriate section of the
            platform to access campus resources.
          </p>

          <div className="contact-support-list">
            <div className="contact-support-item">
              🗺️ Campus Map — Explore campus locations and roads
            </div>

            <div className="contact-support-item">
              👨‍🏫 Faculty — Search the faculty directory
            </div>

            <div className="contact-support-item">
              🧪 Labs — View laboratory availability
            </div>

            <div className="contact-support-item">
              📅 Events — View university events and activities
            </div>

            <div className="contact-support-item">
              🔐 Login — Access the appropriate user portal
            </div>
          </div>
        </div>
      </div>

      <div className="contact-note">
        <p>
          CampusTwin is designed to provide students, faculty and
          administrators with convenient access to campus
          information through a centralized digital environment.
        </p>
      </div>
    </div>
  );
}

export default Contact;