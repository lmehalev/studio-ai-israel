import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockProjects } from '@/data/mockData';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Search, Grid3X3, List, Video, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProjectsPage() {
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = mockProjects.filter(p => {
    if (search && !p.name.includes(search)) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-rubik font-bold">פרויקטים</h1>
            <p className="text-muted-foreground text-sm mt-1">{mockProjects.length} פרויקטים במערכת</p>
          </div>
          <Link to="/create-video" className="gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2">
            <Video className="w-4 h-4" /> סרטון חדש
          </Link>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש פרויקט..."
              className="w-full bg-card border border-border rounded-lg pr-10 pl-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
            <option value="">כל הסטטוסים</option>
            <option value="טיוטה">טיוטה</option><option value="בעיבוד">בעיבוד</option>
            <option value="הושלם">הושלם</option><option value="ממתין">ממתין</option>
          </select>
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView('grid')} className={cn('p-2', view === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-card')}><Grid3X3 className="w-4 h-4" /></button>
            <button onClick={() => setView('list')} className={cn('p-2', view === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card')}><List className="w-4 h-4" /></button>
          </div>
        </div>

        {view === 'list' ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-border bg-muted/30">
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">שם</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">אווטאר</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">סוג</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">סטטוס</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">תאריך</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">תוצאות</th>
              </tr></thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3"><Link to={`/projects/${p.id}`} className="text-sm font-medium hover:text-primary">{p.name}</Link></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.avatarName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.videoType}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.createdAt}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.outputCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <Link key={p.id} to={`/projects/${p.id}`} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">{p.name}</h3>
                  <StatusBadge status={p.status} />
                </div>
                <p className="text-xs text-muted-foreground">{p.avatarName} • {p.videoType} • {p.aspectRatio}</p>
                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span>{p.createdAt}</span>
                  <span>{p.outputCount} תוצאות • גרסה {p.currentVersion}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <p className="text-lg text-muted-foreground">לא נמצאו פרויקטים</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
