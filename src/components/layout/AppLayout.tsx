import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppSidebar />
      <div className={`flex flex-col min-h-screen ${isMobile ? 'mr-0' : 'mr-60'}`}>
        <AppHeader />
        <main className="flex-1 p-3 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
