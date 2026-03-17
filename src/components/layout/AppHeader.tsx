import { Bell, Search, Menu } from 'lucide-react';
import { useState } from 'react';
import { mockNotifications } from '@/data/mockData';
import { useIsMobile } from '@/hooks/use-mobile';
import { sidebarEvents } from './AppSidebar';

export function AppHeader() {
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = mockNotifications.filter(n => !n.read).length;
  const isMobile = useIsMobile();

  return (
    <header className="h-14 md:h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-3 md:px-6 sticky top-0 z-30">
      {/* Right side: hamburger (mobile) + Search */}
      <div className="flex items-center gap-2 flex-1">
        {isMobile && (
          <button
            onClick={() => sidebarEvents.dispatchEvent(new Event('toggle'))}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
        )}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={isMobile ? "חיפוש..." : "חיפוש פרויקטים, אווטארים, תבניות..."}
            className="w-full bg-muted/50 border border-border rounded-lg pr-10 pl-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 md:gap-4">
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                {unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute left-0 top-12 w-72 md:w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-3 border-b border-border">
                <h3 className="font-rubik font-semibold text-sm">התראות</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {mockNotifications.map(n => (
                  <div key={n.id} className={`p-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{n.createdAt}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-8 h-8 md:w-9 md:h-9 rounded-full gradient-gold flex items-center justify-center text-sm font-bold text-primary-foreground">
          מ
        </div>
      </div>
    </header>
  );
}
