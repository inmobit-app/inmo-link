import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function RoleRedirect() {
  const { session, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  switch (userRole) {
    case "CLIENT":
      return <Navigate to="/buscar" replace />;
    case "BROKER":
      return <Navigate to="/corredor/dashboard" replace />;
    case "OWNER":
      return <Navigate to="/dueno/portal" replace />;
    case "ADMIN":
      return <Navigate to="/admin/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}
