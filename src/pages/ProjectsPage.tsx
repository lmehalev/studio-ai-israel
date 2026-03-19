import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  Search, Grid3X3, List, Loader2, Building2, Tag, FolderOpen, Wand2,
  Image as ImageIcon, MoreHorizontal, Pencil, Copy, Trash2, Check, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { projectService, getProjectSubActivity, type ProjectRow, type ProjectOutputRow } from '@/services/projectService';
import { brandService, type Brand } from '@/services/creativeService';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ThumbnailImg = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const [broken, setBroken] = useState(false);
  const handleError = useCallback(() => setBroken(true), []);
  if (broken) return <ImageIcon className="w-5 h-5 text-muted-foreground" />;
  return <img src={src} alt={alt} className={className} onError={handleError} loading="lazy" />;
};

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
  const [outputsByProject, setOutputsByProject] = useState<Record<string, ProjectOutputRow[]>>({});
  const navigate = useNavigate();

  // Inline edit state
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      const projs = await projectService.getAll();
      setProjects(projs);
      const outputMap: Record<string, ProjectOutputRow[]> = {};
      await Promise.all(projs.map(async (p) => {
        try {
          const outs = await projectService.getOutputs(p.id);
          outputMap[p.id] = outs;
        } catch { /* ignore */ }
      }));
      setOutputsByProject(outputMap);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    setBrands(brandService.getAll());
  }, [loadProjects]);

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

  const getProjectThumbnail = (projectId: string) => {
    const outs = outputsByProject[projectId] || [];
    for (const o of outs) {
      if (o.thumbnail_url) return o.thumbnail_url;
      if (o.video_url) return o.video_url;
    }
    return null;
  };

  // ── Actions ──
  const handleInlineRename = async (p: ProjectRow) => {
    const newName = editingNameValue.trim();
    if (!newName || newName === p.name) { setEditingNameId(null); return; }
    try {
      const updated = await projectService.update(p.id, { name: newName });
      setProjects(prev => prev.map(x => x.id === p.id ? updated : x));
      toast.success('השם עודכן');
    } catch (e: any) { toast.error(e.message); }
    setEditingNameId(null);
  };

  const handleUpdateStatus = async (p: ProjectRow, status: string) => {
    try {
      const updated = await projectService.update(p.id, { status });
      setProjects(prev => prev.map(x => x.id === p.id ? updated : x));
      toast.success('הסטטוס עודכן');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleUpdateBrand = async (p: ProjectRow, brandId: string) => {
    try {
      const updated = await projectService.update(p.id, { brand_id: brandId || null });
      setProjects(prev => prev.map(x => x.id === p.id ? updated : x));
      toast.success('החברה עודכנה');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDuplicate = async (p: ProjectRow) => {
    try {
      const dup = await projectService.duplicate(p.id);
      setProjects(prev => [dup, ...prev]);
      toast.success(`הפרויקט שוכפל: "${dup.name}"`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await projectService.delete(deleteTarget.id, (step) => setDeleteProgress(step));
      setProjects(prev => prev.filter(x => x.id !== deleteTarget.id));
      toast.success('הפרויקט נמחק');
    } catch (e: any) { toast.error(e.message); }
    finally { setDeleting(false); setDeleteTarget(null); setDeleteProgress(''); }
  };

  const handleEditDetails = async (p: ProjectRow) => {
    const newName = window.prompt('שם פרויקט', p.name)?.trim();
    if (!newName) return;
    const currentCat = getProjectSubActivity(p) || '';
    const newCat = window.prompt('תת-פעילות / קטגוריה', currentCat)?.trim() ?? currentCat;
    try {
      const updated = await projectService.update(p.id, {
        name: newName,
        content: { ...(p.content || {}), category: newCat || null, sub_activity: newCat || null },
      });
      setProjects(prev => prev.map(x => x.id === p.id ? updated : x));
      toast.success('פרטי הפרויקט עודכנו');
    } catch (e: any) { toast.error(e.message); }
  };

  // ── Row menu ──
  const RowMenu = ({ p }: { p: ProjectRow }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1.5 rounded-lg hover:bg-muted"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => navigate(`/projects/${p.id}`)}><FolderOpen className="w-3.5 h-3.5 mr-2" /> פתח</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setEditingNameId(p.id); setEditingNameValue(p.name); }}><Pencil className="w-3.5 h-3.5 mr-2" /> שנה שם</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleEditDetails(p)}><Tag className="w-3.5 h-3.5 mr-2" /> ערוך פרטים</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDuplicate(p)}><Copy className="w-3.5 h-3.5 mr-2" /> שכפל</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setDeleteTarget(p)} className="text-destructive focus:text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" /> מחק</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const statusOptions = ['טיוטה', 'בעיבוד', 'הושלם', 'ממתין'];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-rubik font-bold">פרויקטים</h1>
            <p className="text-muted-foreground text-sm mt-1">{projects.length} פרויקטים במערכת</p>
          </div>
          <Link to="/creative-studio" className="gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 w-full sm:w-auto justify-center">
            <Building2 className="w-4 h-4" /> הוסף חברה
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש פרויקט..."
              className="w-full bg-card border border-border rounded-lg pr-10 pl-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm flex-1 md:flex-none">
              <option value="">כל הסטטוסים</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {brands.length > 0 && (
              <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
                className="bg-card border border-border rounded-lg px-3 py-2 text-sm flex-1 md:flex-none">
                <option value="">כל החברות</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            {videoTypes.length > 1 && (
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="bg-card border border-border rounded-lg px-3 py-2 text-sm flex-1 md:flex-none">
                <option value="">כל הסוגים</option>
                {videoTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {categories.length > 0 && (
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="bg-card border border-border rounded-lg px-3 py-2 text-sm flex-1 md:flex-none">
                <option value="">כל הקטגוריות</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button onClick={() => setView('grid')} className={cn('p-2', view === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-card')}><Grid3X3 className="w-4 h-4" /></button>
              <button onClick={() => setView('list')} className={cn('p-2', view === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card')}><List className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-2">טוען פרויקטים...</p>
          </div>
        ) : view === 'list' ? (
          <>
            {/* Desktop table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden hidden md:block">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-muted/30">
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground w-12"></th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">שם</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">חברה</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">תת-פעילות</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">סטטוס</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">תאריך</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">תוצרים</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground w-12"></th>
                </tr></thead>
                <tbody>
                  {filtered.map(p => {
                    const brand = brands.find(b => b.id === p.brand_id);
                    const thumb = getProjectThumbnail(p.id);
                    const outputCount = outputsByProject[p.id]?.length || p.output_count;
                    const isEditingName = editingNameId === p.id;
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => !isEditingName && navigate(`/projects/${p.id}`)}>
                        <td className="px-3 py-2">
                          <div className="w-10 h-10 rounded-lg bg-muted/30 border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
                            {thumb ? <ThumbnailImg src={thumb} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={e => { if (isEditingName) e.stopPropagation(); }}>
                          {isEditingName ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus value={editingNameValue}
                                onChange={e => setEditingNameValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleInlineRename(p); if (e.key === 'Escape') setEditingNameId(null); }}
                                className="bg-background border border-primary rounded px-2 py-1 text-sm w-40 focus:outline-none"
                              />
                              <button onClick={() => handleInlineRename(p)} className="p-1 text-primary hover:bg-primary/10 rounded"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setEditingNameId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : (
                            <p className="text-sm font-medium hover:text-primary text-right">{p.name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <select value={p.brand_id || ''} onChange={e => handleUpdateBrand(p, e.target.value)}
                            className="bg-transparent border-none text-xs p-0 focus:outline-none cursor-pointer text-muted-foreground hover:text-foreground">
                            <option value="">—</option>
                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {getProjectSubActivity(p) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground text-xs">
                              <Tag className="w-3 h-3" /> {getProjectSubActivity(p)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <select value={p.status} onChange={e => handleUpdateStatus(p, e.target.value)}
                            className="bg-transparent border-none text-xs p-0 focus:outline-none cursor-pointer">
                            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(p.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-sm font-medium", outputCount > 0 ? "text-primary" : "text-muted-foreground")}>{outputCount}</span>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <RowMenu p={p} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile card list */}
            <div className="space-y-2 md:hidden">
              {filtered.map(p => {
                const brand = brands.find(b => b.id === p.brand_id);
                const thumb = getProjectThumbnail(p.id);
                const outputCount = outputsByProject[p.id]?.length || p.output_count;
                return (
                  <div key={p.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 cursor-pointer"
                    onClick={() => navigate(`/projects/${p.id}`)}>
                    <div className="w-12 h-12 rounded-lg bg-muted/30 border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
                      {thumb ? <ThumbnailImg src={thumb} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <StatusBadge status={p.status} />
                        {brand && <span className="text-[10px] text-primary">{brand.name}</span>}
                        <span className="text-[10px] text-muted-foreground">{formatDate(p.created_at)}</span>
                      </div>
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      <RowMenu p={p} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => {
              const brand = brands.find(b => b.id === p.brand_id);
              const thumb = getProjectThumbnail(p.id);
              const outputCount = outputsByProject[p.id]?.length || p.output_count;
              return (
                <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors relative">
                  <Link to={`/projects/${p.id}`}>
                    <div className="aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
                      {thumb ? <ThumbnailImg src={thumb} alt={p.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-10 h-10 text-muted-foreground/40" />}
                    </div>
                  </Link>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Link to={`/projects/${p.id}`} className="font-medium text-sm truncate hover:text-primary">{p.name}</Link>
                      <RowMenu p={p} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <StatusBadge status={p.status} />
                      {brand && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                          <Building2 className="w-3 h-3" /> {brand.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <span>{formatDate(p.created_at)}</span>
                      <span className={cn(outputCount > 0 && "text-primary font-medium")}>{outputCount} תוצרים</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-lg text-muted-foreground mb-2">לא נמצאו פרויקטים</p>
            <Link to="/creative-studio" className="gradient-gold text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
              <Building2 className="w-4 h-4" /> הוסף חברה
            </Link>
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת פרויקט</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  האם למחוק את הפרויקט <strong>"{deleteTarget.name}"</strong>?
                  <br />כל התוצרים, הגרסאות והקבצים ימחקו לצמיתות.
                </>
              )}
              {deleteProgress && <span className="block mt-2 text-xs text-muted-foreground">{deleteProgress}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              {deleting ? 'מוחק...' : 'מחק'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
