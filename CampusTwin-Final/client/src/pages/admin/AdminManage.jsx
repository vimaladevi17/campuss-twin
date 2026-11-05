import { useParams, Link, Navigate } from "react-router-dom";
import ManageResource from "./ManageResource";
import { resources } from "./resources";

function AdminManage() {
  const { resource } = useParams();
  const config = resources[resource];
  if (resource === "timetable") return <Navigate to="/timetable" replace />;

  if (!config) {
    return (
      <div className="access-denied">
        <h1>Page not found</h1>
        <p>There is no management page called "{resource}".</p>
        <Link to="/admin-dashboard">Back to admin dashboard</Link>
      </div>
    );
  }

  return <ManageResource key={resource} config={config} />;
}

export default AdminManage;
