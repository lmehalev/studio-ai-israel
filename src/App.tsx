import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardPage from "./pages/DashboardPage";
import AvatarsPage from "./pages/AvatarsPage";
import CreateAvatarPage from "./pages/CreateAvatarPage";
import AvatarDetailPage from "./pages/AvatarDetailPage";
import CreateVideoPage from "./pages/CreateVideoPage";
import PromptGeneratorPage from "./pages/PromptGeneratorPage";
import TemplatesPage from "./pages/TemplatesPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import OutputsPage from "./pages/OutputsPage";
import JobsPage from "./pages/JobsPage";
import ProvidersPage from "./pages/ProvidersPage";
import BrandSettingsPage from "./pages/BrandSettingsPage";
import SystemSettingsPage from "./pages/SystemSettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-center" dir="rtl" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/avatars" element={<AvatarsPage />} />
          <Route path="/avatars/new" element={<CreateAvatarPage />} />
          <Route path="/avatars/:id" element={<AvatarDetailPage />} />
          <Route path="/create-video" element={<CreateVideoPage />} />
          <Route path="/prompt-generator" element={<PromptGeneratorPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/outputs" element={<OutputsPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="/brand-settings" element={<BrandSettingsPage />} />
          <Route path="/system-settings" element={<SystemSettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
