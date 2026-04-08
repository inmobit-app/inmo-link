import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleRedirect from "@/components/RoleRedirect";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Profile from "@/pages/Profile";
import Search from "@/pages/client/Search";
import BrokerDashboard from "@/pages/broker/Dashboard";
import OwnerPortal from "@/pages/owner/Portal";
import AdminDashboard from "@/pages/admin/Dashboard";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Role redirect */}
            <Route path="/" element={<RoleRedirect />} />

            {/* Client */}
            <Route path="/buscar" element={<ProtectedRoute allowedRoles={["CLIENT"]}><Search /></ProtectedRoute>} />

            {/* Broker */}
            <Route path="/corredor/dashboard" element={<ProtectedRoute allowedRoles={["BROKER"]}><BrokerDashboard /></ProtectedRoute>} />

            {/* Owner */}
            <Route path="/dueno/portal" element={<ProtectedRoute allowedRoles={["OWNER"]}><OwnerPortal /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>} />

            {/* Profile */}
            <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
