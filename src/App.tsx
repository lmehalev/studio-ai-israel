import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardPage from "./pages/DashboardPage";
import CreativeStudioPage from "./pages/CreativeStudioPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import AvatarsManagePage from "./pages/capabilities/AvatarsPage";
import VoicesManagePage from "./pages/capabilities/VoicesPage";
import ScriptsManagePage from "./pages/capabilities/ScriptsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-center" dir="rtl" />
      
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/creative-studio" element={<CreativeStudioPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/capabilities/avatars" element={<AvatarsManagePage />} />
          <Route path="/capabilities/voices" element={<VoicesManagePage />} />
          <Route path="/capabilities/scripts" element={<ScriptsManagePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
