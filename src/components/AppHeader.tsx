import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Shield, User } from "lucide-react";

const ADMIN_NAV = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/usuarios", label: "Usuarios" },
  { to: "/admin/comisiones", label: "Comisiones" },
  { to: "/admin/propiedades", label: "Propiedades" },
];

export default function AppHeader() {
  const { user, isAdmin, userProfile, signOut } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const initials = userProfile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <header className="border-b bg-card px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link to="/" className="font-bold text-lg text-foreground">InmoBit</Link>

        {isAdmin && (
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {ADMIN_NAV.map(({ to, label }) => {
              const active = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <Badge variant="outline" className="gap-1 text-xs">
            <Shield className="h-3 w-3" />
            Administrador
          </Badge>
        )}

        <Link to="/perfil" className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={userProfile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Link>

        <Button variant="ghost" size="icon" onClick={signOut} title="Cerrar sesión">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
