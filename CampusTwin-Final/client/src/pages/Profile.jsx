import React from "react";
import { useAuth } from "../context/AuthContext";
import "./Notices.css";

function Profile() {
  const { user } = useAuth();

  return (
    <div className="notices-page">
      <div className="notices-header">
        <p>My account</p>
        <h1>Profile</h1>
      </div>

      <div className="notices-list">
        <div className="notice-card">
          <h2>{user.name}</h2>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Role:</strong> {user.role}</p>
        </div>
      </div>
    </div>
  );
}

export default Profile;
