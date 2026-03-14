import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockAvatars } from '@/data/mockData';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plus, Search, Grid3X3, List, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar } from '@/types';

export default function AvatarsPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = mockAvatars.filter(a => {
    if (search && !a.name.includes(search) && !a.description.includes(search)) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-rubik font-bold">ספריית אווטארים</h1>
            <p className="text-muted-foreground text-sm mt-1">{mockAvatars.length} אווטארים במערכת</p>
          </div>
          <Link to="/avatars/new" className="gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            אווטאר חדש
          </Link>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש אווטאר..."
              className="w-full bg-card border border-border rounded-lg pr-10 pl-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">כל הסטטוסים</option>
            <option value="מוכן">מוכן</option>
            <option value="טיוטה">טיוטה</option>
            <option value="בהכנה">בהכנה</option>
          </select>
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView('grid')} className={cn('p-2', view === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setView('list')} className={cn('p-2', view === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grid View */}
        {view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((avatar, i) => (
              <motion.div key={avatar.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={`/avatars/${avatar.id}`} className="block bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-all hover:shadow-gold group">
                  <div className="h-32 gradient-gold flex items-center justify-center">
                    <span className="text-4xl font-bold text-primary-foreground">{avatar.name[0]}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{avatar.name}</h3>
                      <StatusBadge status={avatar.status} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{avatar.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{avatar.role}</span>
                      <span>{avatar.language}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                      <span>{avatar.images.length} תמונות • {avatar.videos.length} סרטונים</span>
                      <span>{avatar.projectCount} פרויקטים</span>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">ציון איכות</span>
                        <span className="font-medium">{avatar.qualityScore}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${avatar.qualityScore}%` }} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {avatar.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(avatar => (
              <Link key={avatar.id} to={`/avatars/${avatar.id}`} className="flex items-center gap-4 bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                <div className="w-12 h-12 rounded-full gradient-gold flex items-center justify-center text-lg font-bold text-primary-foreground flex-shrink-0">
                  {avatar.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{avatar.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{avatar.description}</p>
                </div>
                <span className="text-xs text-muted-foreground">{avatar.role}</span>
                <span className="text-xs text-muted-foreground">{avatar.images.length} תמונות</span>
                <StatusBadge status={avatar.status} />
                <span className="text-xs text-muted-foreground">{avatar.qualityScore}%</span>
              </Link>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <p className="text-lg text-muted-foreground">לא נמצאו אווטארים</p>
            <p className="text-sm text-muted-foreground mt-1">אפשר להתחיל ביצירת אווטאר חדש</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
