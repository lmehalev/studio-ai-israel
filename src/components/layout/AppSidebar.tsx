import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Sparkles, FolderOpen, Settings,
  ChevronRight, ChevronLeft, Video, HelpCircle
} from 'lucide-react';
import { useState } from 'react';
import { OpenGuideTourButton } from '@/components/GuidedTour';

const menuItems = [
  { title: 'דשבורד', icon: LayoutDashboard, path: '/' },
  { title: 'סטודיו קריאייטיב', icon: Sparkles, path: '/creative-studio' },
  { title: 'פרויקטים', icon: FolderOpen, path: '/projects' },
  { title: 'הגדרות', icon: Settings, path: '/settings' },
];

export function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'fixed top-0 right-0 h-screen bg-sidebar border-l border-sidebar-border flex flex-col z-50 transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center">
              <Video className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-rubik font-bold text-lg text-foreground">סטודיו AI</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-gold'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-primary')} />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-sidebar-border space-y-2">
          <OpenGuideTourButton />
          <div className="rounded-lg bg-sidebar-accent p-3">
            <p className="text-xs text-muted-foreground">גרסה 1.0.0</p>
          </div>
        </div>
      )}
    </aside>
  );
}
