import { Navigate } from "react-router-dom";
import { useSession } from "../context/SessionContext.jsx";
import { Icon } from "./ui/index.js";

export default function ProtectedRoute({ role, children }) {
  const { session, restoring } = useSession();

  if (restoring) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
        <Icon name="clipboard" size={20} />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) return <Navigate to={`/${session.role}/dashboard`} replace />;
  return children;
}
