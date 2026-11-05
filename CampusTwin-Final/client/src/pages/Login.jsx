import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import http, { errorMessage } from "../api/http";
import { useAuth, roleHome } from "../context/AuthContext";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState("login"); // "login" or "register"
  const [role, setRole] = useState("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "register") {
        const response = await http.post("/auth/register", { name, email, password });
        login(response.data.token, response.data.user);
        navigate(roleHome(response.data.user.role));
        return;
      }

      const response = await http.post("/auth/login", { email, password });
      const { token, user } = response.data;

      if (user.role !== role) {
        setError(`This is a ${user.role} account. Choose "${user.role}" in the list and try again.`);
        return;
      }

      setSuccess("Login successful");
      login(token, user);
      navigate(roleHome(user.role));
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError("Invalid email or password");
      } else {
        setError(errorMessage(err, "Login failed. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
    setSuccess("");
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>CampusTwin</h1>

        <p>{mode === "login" ? "Welcome Back" : "Create a student account"}</p>

        {mode === "login" && (
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
            <option value="admin">Admin</option>
          </select>
        )}

        {mode === "register" && (
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        <button type="submit" disabled={loading}>
          {loading
            ? "Please wait..."
            : mode === "login"
            ? `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`
            : "Register"}
        </button>

        <button type="button" className="login-switch" onClick={switchMode}>
          {mode === "login"
            ? "New student? Create an account"
            : "Already have an account? Login"}
        </button>
      </form>
    </div>
  );
}

export default Login;
