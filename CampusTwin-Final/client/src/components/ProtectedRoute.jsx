import { Navigate, Link } from "react-router-dom";
import { useAuth, roleHome } from "../context/AuthContext";

// Usage: <ProtectedRoute roles={["student"]}><Page /></ProtectedRoute>
// Not logged in -> login page. Wrong role -> "Access Denied". Admin can open everything.
function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowed = !roles || user.role === "admin" || roles.includes(user.role);

  if (!allowed) {
    return (
      <div className="access-denied">
        <h1>Access Denied</h1>
        <p>Your account does not have permission to open this page.</p>
        <Link to={roleHome(user.role)}>Go to my dashboard</Link>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;
