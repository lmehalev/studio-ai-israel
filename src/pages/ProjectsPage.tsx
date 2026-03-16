import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Search, Grid3X3, List, Loader2, Building2, Tag, FolderOpen, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { projectService, getProjectSubActivity, type ProjectRow } from '@/services/projectService';
import { brandService, type Brand } from '@/services/creativeService';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    projectService.getAll()
      .then(setProjects)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
    setBrands(brandService.getAll());
  }, []);

  const filtered = projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (brandFilter && p.brand_id !== brandFilter) return false;
    if (typeFilter && p.video_type !== typeFilter) return false;
    if (categoryFilter && getProjectSubActivity(p) !== categoryFilter) return false;
    return true;
  });

  const videoTypes = [...new Set(projects.map(p => p.video_type))];
  const categories = [...new Set(projects.map(p => getProjectSubActivity(p)).filter(Boolean))] as string[];
  const formatDate = (d: string) => new Date(d).toLocaleDateString('he-IL');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-rubik font-bold">פרויקטים</h1>
            <p className="text-muted-foreground text-sm mt-1">{projects.length} פרויקטים במערכת</p>
          </div>
          <Link to="/creative-studio" className="gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4" /> הוסף חברה
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
          {brands.length > 0 && (
            <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
              <option value="">כל החברות</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {videoTypes.length > 1 && (
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
              <option value="">כל הסוגים</option>
              {videoTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {categories.length > 0 && (
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
              <option value="">כל הקטגוריות</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView('grid')} className={cn('p-2', view === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-card')}><Grid3X3 className="w-4 h-4" /></button>
            <button onClick={() => setView('list')} className={cn('p-2', view === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card')}><List className="w-4 h-4" /></button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-2">טוען פרויקטים...</p>
          </div>
        ) : view === 'list' ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-border bg-muted/30">
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">שם</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">חברה</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">תת-פעילות</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">סוג</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">סטטוס</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">תאריך</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">תוצאות</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">פעולות</th>
              </tr></thead>
              <tbody>
                {filtered.map(p => {
                  const brand = brands.find(b => b.id === p.brand_id);
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/projects/${p.id}`)} className="text-sm font-medium hover:text-primary text-right">{p.name}</button>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {brand ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                            <Building2 className="w-3 h-3" /> {brand.name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {getProjectSubActivity(p) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground text-xs">
                            <Tag className="w-3 h-3" /> {getProjectSubActivity(p)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p.video_type}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(p.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p.output_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => navigate(`/projects/${p.id}`)} className="px-2 py-1 border border-border rounded-md text-xs hover:bg-muted inline-flex items-center gap-1">
                            <FolderOpen className="w-3 h-3" /> פתח
                          </button>
                          <button onClick={() => navigate(`/creative-studio?projectId=${p.id}`)} className="px-2 py-1 border border-border rounded-md text-xs hover:bg-muted inline-flex items-center gap-1">
                            <Wand2 className="w-3 h-3" /> סטודיו
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => {
              const brand = brands.find(b => b.id === p.brand_id);
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">{p.name}</h3>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {brand && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                        <Building2 className="w-3 h-3" /> {brand.name}
                      </span>
                    )}
                    {getProjectSubActivity(p) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground text-xs">
                        <Tag className="w-3 h-3" /> {getProjectSubActivity(p)}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{p.video_type} • {p.aspect_ratio}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>{formatDate(p.created_at)}</span>
                    <span>{p.output_count} תוצאות • גרסה {p.current_version}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-lg text-muted-foreground mb-2">לא נמצאו פרויקטים</p>
            <p className="text-sm text-muted-foreground mb-4">הוסיפו את החברה הראשונה שלכם כדי להתחיל ליצור תוכן</p>
            <Link to="/creative-studio" className="gradient-gold text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
              <Building2 className="w-4 h-4" /> הוסף חברה
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
