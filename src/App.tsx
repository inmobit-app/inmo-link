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
import Compare from "@/pages/client/Compare";
import Inquiries from "@/pages/client/Inquiries";
import BrokerDashboard from "@/pages/broker/Dashboard";
import PropertyList from "@/pages/broker/PropertyList";
import Pipeline from "@/pages/broker/Pipeline";
import LeadDetail from "@/pages/broker/LeadDetail";
import Agenda from "@/pages/broker/Agenda";
import MandateList from "@/pages/broker/MandateList";
import MandateCreate from "@/pages/broker/MandateCreate";
import OwnerPortal from "@/pages/owner/Portal";
import OwnerMandateList from "@/pages/owner/MandateList";
import MandateSign from "@/pages/owner/MandateSign";
import AdminDashboard from "@/pages/admin/Dashboard";
import PropertyDetail from "@/pages/property/PropertyDetail";
import PropertyWizard from "@/components/property/PropertyWizard";
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

            {/* Public property detail */}
            <Route path="/propiedad/:id" element={<PropertyDetail />} />

            {/* Role redirect */}
            <Route path="/" element={<RoleRedirect />} />

            {/* Client */}
            <Route path="/buscar" element={<Search />} />
            <Route path="/comparar" element={<Compare />} />
            <Route path="/mis-consultas" element={<ProtectedRoute allowedRoles={["CLIENT"]}><Inquiries /></ProtectedRoute>} />

            {/* Broker */}
            <Route path="/corredor/dashboard" element={<ProtectedRoute allowedRoles={["BROKER"]}><BrokerDashboard /></ProtectedRoute>} />
            <Route path="/corredor/propiedades" element={<ProtectedRoute allowedRoles={["BROKER"]}><PropertyList /></ProtectedRoute>} />
            <Route path="/corredor/propiedades/nueva" element={<ProtectedRoute allowedRoles={["BROKER"]}><PropertyWizard /></ProtectedRoute>} />
            <Route path="/corredor/propiedades/:id/editar" element={<ProtectedRoute allowedRoles={["BROKER"]}><PropertyWizard /></ProtectedRoute>} />
            <Route path="/corredor/mandatos" element={<ProtectedRoute allowedRoles={["BROKER"]}><MandateList /></ProtectedRoute>} />
            <Route path="/corredor/mandatos/nuevo" element={<ProtectedRoute allowedRoles={["BROKER"]}><MandateCreate /></ProtectedRoute>} />
            <Route path="/corredor/pipeline" element={<ProtectedRoute allowedRoles={["BROKER"]}><Pipeline /></ProtectedRoute>} />
            <Route path="/corredor/leads/:id" element={<ProtectedRoute allowedRoles={["BROKER"]}><LeadDetail /></ProtectedRoute>} />
            <Route path="/corredor/agenda" element={<ProtectedRoute allowedRoles={["BROKER"]}><Agenda /></ProtectedRoute>} />

            {/* Owner */}
            <Route path="/dueno/portal" element={<ProtectedRoute allowedRoles={["OWNER"]}><OwnerPortal /></ProtectedRoute>} />
            <Route path="/dueno/propiedades/nueva" element={<ProtectedRoute allowedRoles={["OWNER"]}><PropertyWizard /></ProtectedRoute>} />
            <Route path="/dueno/mandatos" element={<ProtectedRoute allowedRoles={["OWNER"]}><OwnerMandateList /></ProtectedRoute>} />
            <Route path="/dueno/mandatos/:id/firmar" element={<ProtectedRoute allowedRoles={["OWNER"]}><MandateSign /></ProtectedRoute>} />

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
