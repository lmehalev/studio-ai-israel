import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import DashboardPage from "./pages/DashboardPage";
import CreativeStudioPage from "./pages/CreativeStudioPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import AvatarsManagePage from "./pages/capabilities/AvatarsPage";
import VoicesManagePage from "./pages/capabilities/VoicesPage";
import ScriptsManagePage from "./pages/capabilities/ScriptsPage";
import TrendsPage from "./pages/TrendsPage";
import LoginPage from "./pages/LoginPage";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/creative-studio" element={<CreativeStudioPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:id" element={<ProjectDetailPage />} />
      <Route path="/capabilities/avatars" element={<AvatarsManagePage />} />
      <Route path="/capabilities/voices" element={<VoicesManagePage />} />
      <Route path="/capabilities/scripts" element={<ScriptsManagePage />} />
      <Route path="/trends" element={<TrendsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-center" dir="rtl" />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
