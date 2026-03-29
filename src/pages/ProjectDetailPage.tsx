import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Edit, Copy, RefreshCw, Archive, Video, FileText, Layers, PlayCircle,
  Clock, GitBranch, Loader2, Download, Maximize2, Wand2, Image as ImageIcon,
  Calendar, Monitor, Tag, Building2, FolderOpen, Plus, Eye, Pencil,
  MoreHorizontal, Trash2, Check, X, Star, FolderPlus, ArrowRight, Save, Scissors, Type
} from 'lucide-react';
import { toast } from 'sonner';
import { projectService, getProjectCategory, type ProjectRow, type ProjectOutputRow, type TimelineRow, type VersionRow } from '@/services/projectService';
import { brandService, type Brand } from '@/services/creativeService';
import { ImageEditor } from '@/components/editors/ImageEditor';
import { VideoEditor } from '@/components/editors/VideoEditor';
import { AiImageEditDialog } from '@/components/studio/AiImageEditDialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const tabs = [
  { id: 'overview', label: 'סקירה', icon: FileText },
  { id: 'outputs', label: 'תוצרים', icon: PlayCircle },
  { id: 'timeline', label: 'ציר זמן', icon: Clock },
  { id: 'versions', label: 'גרסאות', icon: GitBranch },
];

interface OutputGroup { id: string; name: string; outputIds: string[]; }

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [outputs, setOutputs] = useState<ProjectOutputRow[]>([]);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Project header edit
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  // Project details edit (brand + sub-project)
  const [editBrandId, setEditBrandId] = useState<string>('');
  const [editCategory, setEditCategory] = useState('');
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  // Editor states
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [imageEditorOutput, setImageEditorOutput] = useState<ProjectOutputRow | null>(null);
  const [videoEditorOpen, setVideoEditorOpen] = useState(false);
  const [editingMediaUrl, setEditingMediaUrl] = useState('');

  // Output management
  const [deleteOutputTarget, setDeleteOutputTarget] = useState<ProjectOutputRow | null>(null);
  const [deletingOutput, setDeletingOutput] = useState(false);
  const [selectedOutputs, setSelectedOutputs] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Groups
  const [groups, setGroups] = useState<OutputGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  // Delete project
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  // AI image edit
  const [aiEditTarget, setAiEditTarget] = useState<ProjectOutputRow | null>(null);

  useEffect(() => {
    if (!id) return;
    setBrands(brandService.getAll());
    Promise.all([
      projectService.getById(id),
      projectService.getOutputs(id),
      projectService.getTimeline(id),
      projectService.getVersions(id),
    ]).then(([p, o, t, v]) => {
      setProject(p);
      setOutputs(o);
      setTimeline(t);
      setVersions(v);
      if (p) {
        setNameValue(p.name);
        setEditBrandId(p.brand_id || '');
        setEditCategory(getProjectCategory(p) || '');
        const content = (p.content || {}) as any;
        setGroups(content.outputGroups || []);
      }
    }).catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Track dirty state for details
  useEffect(() => {
    if (!project) return;
    const currentBrand = project.brand_id || '';
    const currentCat = getProjectCategory(project) || '';
    setDetailsDirty(editBrandId !== currentBrand || editCategory !== currentCat);
  }, [editBrandId, editCategory, project]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('he-IL');
  const formatDateTime = (d: string) => new Date(d).toLocaleString('he-IL');

  // ── Project actions ──
  const handleSaveName = async () => {
    if (!project) return;
    const newName = nameValue.trim();
    if (!newName || newName === project.name) { setEditingName(false); return; }
    try {
      const updated = await projectService.update(project.id, { name: newName });
      setProject(updated);
      toast.success('עודכן');
    } catch (e: any) { toast.error(e.message); }
    setEditingName(false);
  };

  const handleSaveDetails = async () => {
    if (!project) return;
    setSavingDetails(true);
    try {
      const updated = await projectService.update(project.id, {
        brand_id: editBrandId || null,
        content: { ...(project.content || {}), category: editCategory || null, sub_activity: editCategory || null },
      });
      setProject(updated);
      toast.success('פרטי הפרויקט עודכנו');
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingDetails(false); }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    setDeletingProject(true);
    try {
      await projectService.delete(project.id);
      toast.success('הפרויקט נמחק');
      navigate('/projects');
    } catch (e: any) { toast.error(e.message); }
    finally { setDeletingProject(false); setDeleteProjectConfirm(false); }
  };

  // ── Output actions ──
  const handleRenameOutput = async (o: ProjectOutputRow) => {
    const newName = window.prompt('שם חדש לתוצר', o.name)?.trim();
    if (!newName) return;
    try {
      const updated = await projectService.updateOutput(o.id, { name: newName });
      setOutputs(prev => prev.map(x => x.id === o.id ? updated : x));
      toast.success('עודכן');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteOutput = async () => {
    if (!deleteOutputTarget) return;
    setDeletingOutput(true);
    try {
      await projectService.deleteOutput(deleteOutputTarget.id, deleteOutputTarget);
      setOutputs(prev => prev.filter(x => x.id !== deleteOutputTarget.id));
      setGroups(prev => prev.map(g => ({ ...g, outputIds: g.outputIds.filter(id => id !== deleteOutputTarget.id) })));
      toast.success('התוצר נמחק');
    } catch (e: any) { toast.error(e.message); }
    finally { setDeletingOutput(false); setDeleteOutputTarget(null); }
  };

  const handleSetPrimary = async (o: ProjectOutputRow) => {
    if (!project) return;
    try {
      await projectService.update(project.id, {
        content: { ...(project.content || {}), primaryOutputId: o.id },
      });
      toast.success('התוצר הוגדר כראשי');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDownloadOutput = async (o: ProjectOutputRow) => {
    const url = o.video_url || o.thumbnail_url;
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const isVideo = !!o.video_url;
      link.download = `${o.name}.${isVideo ? 'mp4' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch { const url2 = o.video_url || o.thumbnail_url; if (url2) window.open(url2, '_blank'); }
  };

  // Save image editor result as new version
  const handleImageEditorSave = async (dataUrl: string) => {
    if (!project || !imageEditorOutput) return;
    setImageEditorOpen(false);
    try {
      // Upload to storage
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `edited-${Date.now()}.png`, { type: 'image/png' });
      const { storageService } = await import('@/services/creativeService');
      const publicUrl = await storageService.upload(file);
      
      const newOutput = await projectService.addOutput(project.id, {
        name: `${imageEditorOutput.name} (עריכה)`,
        description: `עריכה ידנית של "${imageEditorOutput.name}"`,
        status: 'הושלם',
        thumbnail_url: publicUrl,
        aspect_ratio: imageEditorOutput.aspect_ratio,
      });
      setOutputs(prev => [newOutput, ...prev]);
      setActiveTab('outputs');
      toast.success('נשמר כגרסה חדשה בפרויקט');
    } catch (e: any) { toast.error(e.message); }
  };

  // ── Bulk actions ──
  const toggleSelect = (id: string) => {
    setSelectedOutputs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = [...selectedOutputs];
    let deleted = 0;
    for (const oid of ids) {
      const o = outputs.find(x => x.id === oid);
      if (!o) continue;
      try { await projectService.deleteOutput(oid, o); deleted++; } catch { /* continue */ }
    }
    setOutputs(prev => prev.filter(x => !selectedOutputs.has(x.id)));
    setGroups(prev => prev.map(g => ({ ...g, outputIds: g.outputIds.filter(id => !selectedOutputs.has(id)) })));
    setSelectedOutputs(new Set());
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    toast.success(`${deleted} תוצרים נמחקו`);
  };

  // ── Groups ──
  const saveGroups = async (newGroups: OutputGroup[]) => {
    setGroups(newGroups);
    if (!project) return;
    try {
      await projectService.update(project.id, {
        content: { ...(project.content || {}), outputGroups: newGroups },
      });
    } catch { /* non-critical */ }
  };

  const handleCreateGroup = async () => {
    const name = window.prompt('שם קבוצה חדשה')?.trim();
    if (!name) return;
    const newGroup: OutputGroup = { id: `g-${Date.now()}`, name, outputIds: [] };
    await saveGroups([...groups, newGroup]);
    toast.success(`קבוצה "${name}" נוצרה`);
  };

  const handleRenameGroup = async (gId: string) => {
    const g = groups.find(x => x.id === gId);
    if (!g) return;
    const name = window.prompt('שם חדש לקבוצה', g.name)?.trim();
    if (!name) return;
    await saveGroups(groups.map(x => x.id === gId ? { ...x, name } : x));
    toast.success('שם הקבוצה עודכן');
  };

  const handleDeleteGroup = async (gId: string) => {
    await saveGroups(groups.filter(x => x.id !== gId));
    if (activeGroup === gId) setActiveGroup(null);
    toast.success('הקבוצה נמחקה (התוצרים לא נמחקו)');
  };

  const handleMoveToGroup = async (groupId: string) => {
    const ids = [...selectedOutputs];
    if (ids.length === 0) return;
    const newGroups = groups.map(g => {
      const cleaned = g.outputIds.filter(id => !selectedOutputs.has(id));
      if (g.id === groupId) return { ...g, outputIds: [...cleaned, ...ids] };
      return { ...g, outputIds: cleaned };
    });
    await saveGroups(newGroups);
    setSelectedOutputs(new Set());
    setShowMoveMenu(false);
    toast.success(`${ids.length} תוצרים הועברו`);
  };

  const filteredOutputs = activeGroup
    ? outputs.filter(o => groups.find(g => g.id === activeGroup)?.outputIds.includes(o.id))
    : outputs;

  const groupedOutputIds = new Set(groups.flatMap(g => g.outputIds));
  const ungroupedOutputs = outputs.filter(o => !groupedOutputIds.has(o.id));

  // Helper: is this output an image?
  const isImageOutput = (o: ProjectOutputRow) => {
    if (o.video_url && !o.thumbnail_url) return false;
    if (o.thumbnail_url) {
      const ext = o.thumbnail_url.split('?')[0].split('.').pop()?.toLowerCase() || '';
      if (['mp4', 'mov', 'webm'].includes(ext)) return false;
    }
    return true;
  };

  const isVideoOutput = (o: ProjectOutputRow) => {
    if (o.video_url) return true;
    if (o.thumbnail_url) {
      const ext = o.thumbnail_url.split('?')[0].split('.').pop()?.toLowerCase() || '';
      if (['mp4', 'mov', 'webm'].includes(ext)) return true;
    }
    return false;
  };

  if (loading) return <AppLayout><div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div></AppLayout>;
  if (!project) return <AppLayout><div className="text-center py-20"><p className="text-muted-foreground">הפרויקט לא נמצא</p></div></AppLayout>;

  const content = (project.content || {}) as Record<string, any>;
  const brand = brands.find(b => b.id === project.brand_id);
  const latestOutput = outputs[0];
  const latestMedia = latestOutput?.thumbnail_url || latestOutput?.video_url;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2 mb-1">
                <input autoFocus value={nameValue} onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  className="text-2xl font-rubik font-bold bg-background border border-primary rounded px-2 py-1 focus:outline-none" />
                <button onClick={handleSaveName} className="p-1 text-primary hover:bg-primary/10 rounded"><Check className="w-5 h-5" /></button>
                <button onClick={() => { setEditingName(false); setNameValue(project.name); }} className="p-1 text-muted-foreground hover:bg-muted rounded"><X className="w-5 h-5" /></button>
              </div>
            ) : (
              <h1 className="text-2xl font-rubik font-bold flex items-center gap-3 flex-wrap cursor-pointer group" onClick={() => setEditingName(true)}>
                {project.name}
                <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}
            <div className="flex items-center gap-3 flex-wrap mt-2 text-sm text-muted-foreground">
              {brand && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <Building2 className="w-3 h-3" /> {brand.name}
                </span>
              )}
              {getProjectCategory(project) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground text-xs font-medium">
                  <Tag className="w-3 h-3" /> {getProjectCategory(project)}
                </span>
              )}
              <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(project.created_at)}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap flex-shrink-0">
            <Link to={`/creative-studio?projectId=${project.id}`} className="flex items-center gap-1 px-3 py-2 gradient-gold text-primary-foreground rounded-lg text-xs font-semibold"><Wand2 className="w-3.5 h-3.5" /> צור תוכן חדש</Link>
            <button onClick={() => setDeleteProjectConfirm(true)} className="flex items-center gap-1 px-3 py-2 border border-destructive/30 text-destructive rounded-lg text-xs hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /> מחק</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap',
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              <tab.icon className="w-4 h-4" />{tab.label}
              {tab.id === 'outputs' && outputs.length > 0 && (
                <span className="bg-primary/20 text-primary text-xs px-1.5 rounded-full">{outputs.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Details Editor */}
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Edit className="w-4 h-4 text-primary" /> פרטי פרויקט</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">חברה</label>
                  <select value={editBrandId} onChange={e => setEditBrandId(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="">— ללא חברה —</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">תת-פרויקט</label>
                  <input value={editCategory} onChange={e => setEditCategory(e.target.value)}
                    placeholder="לדוגמה: קמפיין קיץ, השקת מוצר..."
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>

                {detailsDirty && (
                  <button onClick={handleSaveDetails} disabled={savingDetails}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 gradient-gold text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50">
                    {savingDetails ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    שמור שינויים
                  </button>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                {[
                  ['תאריך יצירה', formatDate(project.created_at)],
                  ['עדכון אחרון', formatDate(project.updated_at)],
                  ['תוצרים', String(outputs.length)],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{l}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Latest output preview */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {latestMedia ? (
                <>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="font-semibold text-sm">תוצר אחרון</h3>
                    <button onClick={() => setActiveTab('outputs')} className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Eye className="w-3 h-3" /> כל התוצרים ({outputs.length})
                    </button>
                  </div>
                  <div className="aspect-video max-h-72 bg-muted/30 flex items-center justify-center overflow-hidden">
                    {latestOutput && isVideoOutput(latestOutput) ? (
                      <video src={latestOutput.video_url || latestOutput.thumbnail_url || ''} controls className="w-full h-full object-contain" />
                    ) : (
                      <img src={latestMedia} alt={latestOutput?.name} className="w-full h-full object-contain" loading="lazy" />
                    )}
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{latestOutput?.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(latestOutput?.created_at || '')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => latestOutput && handleDownloadOutput(latestOutput)} className="px-3 py-1.5 gradient-gold text-primary-foreground rounded-lg text-xs font-semibold flex items-center gap-1">
                        <Download className="w-3 h-3" /> הורד
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center">
                  <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground mb-3">אין תוצרים עדיין</p>
                  <Link to={`/creative-studio?projectId=${project.id}`} className="inline-flex items-center gap-2 px-4 py-2 gradient-gold text-primary-foreground rounded-lg text-sm font-semibold">
                    <Plus className="w-4 h-4" /> צור תוכן ראשון
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── OUTPUTS TAB ── */}
        {activeTab === 'outputs' && (
          <div className="space-y-3">
            {/* Groups bar + bulk actions */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setActiveGroup(null)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs border', !activeGroup ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>
                  הכל ({outputs.length})
                </button>
                {groups.map(g => (
                  <div key={g.id} className="flex items-center gap-0.5">
                    <button onClick={() => setActiveGroup(g.id)}
                      className={cn('px-3 py-1.5 rounded-l-lg text-xs border', activeGroup === g.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>
                      {g.name} ({g.outputIds.filter(id => outputs.some(o => o.id === id)).length})
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn('px-1.5 py-1.5 rounded-r-lg text-xs border border-r', activeGroup === g.id ? 'border-primary' : 'border-border hover:bg-muted')}>
                          <MoreHorizontal className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => handleRenameGroup(g.id)}><Pencil className="w-3 h-3 mr-2" /> שנה שם</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteGroup(g.id)} className="text-destructive"><Trash2 className="w-3 h-3 mr-2" /> מחק קבוצה</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                {activeGroup === null && ungroupedOutputs.length !== outputs.length && (
                  <button onClick={() => setActiveGroup('ungrouped')}
                    className={cn('px-3 py-1.5 rounded-lg text-xs border', activeGroup === 'ungrouped' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>
                    ללא קבוצה ({ungroupedOutputs.length})
                  </button>
                )}
                <button onClick={handleCreateGroup} className="px-2 py-1.5 rounded-lg text-xs border border-dashed border-border hover:bg-muted flex items-center gap-1">
                  <FolderPlus className="w-3 h-3" /> קבוצה חדשה
                </button>
              </div>

              {selectedOutputs.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
                  <span className="text-xs font-medium">{selectedOutputs.size} נבחרו</span>
                  {groups.length > 0 && (
                    <DropdownMenu open={showMoveMenu} onOpenChange={setShowMoveMenu}>
                      <DropdownMenuTrigger asChild>
                        <button className="px-2 py-1 text-xs border border-border rounded hover:bg-muted flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" /> העבר לקבוצה
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {groups.map(g => (
                          <DropdownMenuItem key={g.id} onClick={() => handleMoveToGroup(g.id)}>{g.name}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <button onClick={() => setBulkDeleteConfirm(true)} className="px-2 py-1 text-xs border border-destructive/30 text-destructive rounded hover:bg-destructive/10 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> מחק
                  </button>
                  <button onClick={() => setSelectedOutputs(new Set())} className="text-xs text-muted-foreground hover:text-foreground mr-auto">בטל בחירה</button>
                </div>
              )}
            </div>

            {/* Outputs grid */}
            {(activeGroup === 'ungrouped' ? ungroupedOutputs : filteredOutputs).length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {(activeGroup === 'ungrouped' ? ungroupedOutputs : filteredOutputs).map(o => {
                  const mediaUrl = o.thumbnail_url || o.video_url;
                  const isVideo = isVideoOutput(o);
                  const isImage = isImageOutput(o);
                  const isSelected = selectedOutputs.has(o.id);
                  const isPrimary = content.primaryOutputId === o.id;
                  return (
                    <div key={o.id} className={cn('bg-card border rounded-xl overflow-hidden group relative', isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border')}>
                      <button onClick={() => toggleSelect(o.id)}
                        className={cn('absolute top-2 right-2 z-10 w-6 h-6 rounded border flex items-center justify-center transition-all',
                          isSelected ? 'bg-primary border-primary text-primary-foreground' : 'bg-background/80 border-border opacity-0 group-hover:opacity-100')}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                      {isPrimary && (
                        <span className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" /> ראשי
                        </span>
                      )}
                      <div className="aspect-square bg-muted/30 flex items-center justify-center cursor-pointer"
                        onClick={() => navigate(`/projects/${project.id}/outputs/${o.id}`)}>
                        {mediaUrl ? (
                          isVideo ? <video src={o.video_url || mediaUrl} className="w-full h-full object-cover" /> : <img src={mediaUrl} alt={o.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : <Video className="w-10 h-10 text-muted-foreground" />}
                      </div>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{o.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(o.created_at)}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 rounded hover:bg-muted flex-shrink-0"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {mediaUrl && <DropdownMenuItem onClick={() => window.open(mediaUrl, '_blank')}><Eye className="w-3.5 h-3.5 mr-2" /> צפה</DropdownMenuItem>}
                              {mediaUrl && <DropdownMenuItem onClick={() => handleDownloadOutput(o)}><Download className="w-3.5 h-3.5 mr-2" /> הורד</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => handleRenameOutput(o)}><Pencil className="w-3.5 h-3.5 mr-2" /> שנה שם</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {/* Image edit actions */}
                              {isImage && mediaUrl && (
                                <>
                                  <DropdownMenuItem onClick={() => setAiEditTarget(o)}>
                                    <Wand2 className="w-3.5 h-3.5 mr-2" /> ✨ ערוך עם AI
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setEditingMediaUrl(mediaUrl);
                                    setImageEditorOutput(o);
                                    setImageEditorOpen(true);
                                  }}>
                                    <Edit className="w-3.5 h-3.5 mr-2" /> 🎨 עורך תמונה
                                  </DropdownMenuItem>
                                </>
                              )}
                              {/* Video edit actions */}
                              {isVideo && (
                                <>
                                  <DropdownMenuItem onClick={() => {
                                    setEditingMediaUrl(o.video_url || mediaUrl || '');
                                    setVideoEditorOpen(true);
                                  }}>
                                    <Scissors className="w-3.5 h-3.5 mr-2" /> ✂️ חיתוך וידאו
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    navigate(`/creative-studio?projectId=${project.id}&editVideoUrl=${encodeURIComponent(o.video_url || '')}&action=subtitles`);
                                  }}>
                                    <Type className="w-3.5 h-3.5 mr-2" /> 📝 כתוביות/לוגו/מוזיקה
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSetPrimary(o)}><Star className="w-3.5 h-3.5 mr-2" /> הגדר כראשי</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteOutputTarget(o)} className="text-destructive focus:text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" /> מחק</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {/* Quick edit buttons under thumbnail */}
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {isImage && mediaUrl && (
                            <>
                              <button onClick={() => setAiEditTarget(o)}
                                className="px-2 py-1 text-[10px] border border-border rounded hover:bg-primary/10 hover:border-primary/30 flex items-center gap-1">
                                <Wand2 className="w-3 h-3" /> AI
                              </button>
                              <button onClick={() => { setEditingMediaUrl(mediaUrl); setImageEditorOutput(o); setImageEditorOpen(true); }}
                                className="px-2 py-1 text-[10px] border border-border rounded hover:bg-primary/10 hover:border-primary/30 flex items-center gap-1">
                                <Edit className="w-3 h-3" /> עורך
                              </button>
                            </>
                          )}
                          {isVideo && (
                            <>
                              <button onClick={() => { setEditingMediaUrl(o.video_url || mediaUrl || ''); setVideoEditorOpen(true); }}
                                className="px-2 py-1 text-[10px] border border-border rounded hover:bg-primary/10 hover:border-primary/30 flex items-center gap-1">
                                <Scissors className="w-3 h-3" /> חיתוך
                              </button>
                              <button onClick={() => navigate(`/creative-studio?projectId=${project.id}&editVideoUrl=${encodeURIComponent(o.video_url || '')}&action=subtitles`)}
                                className="px-2 py-1 text-[10px] border border-border rounded hover:bg-primary/10 hover:border-primary/30 flex items-center gap-1">
                                <Type className="w-3 h-3" /> כתוביות
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-card border border-border rounded-xl">
                <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-3">אין תוצרים {activeGroup ? 'בקבוצה זו' : 'עדיין'}</p>
                <Link to={`/creative-studio?projectId=${project.id}`} className="inline-flex items-center gap-2 px-4 py-2 gradient-gold text-primary-foreground rounded-lg text-sm font-semibold">
                  <Plus className="w-4 h-4" /> צור תוכן חדש
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-0">
            {timeline.length > 0 ? timeline.map((t, i) => (
              <div key={t.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
                  {i < timeline.length - 1 && <div className="w-0.5 h-full bg-border" />}
                </div>
                <div className="pb-6">
                  <p className="text-sm font-medium">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(t.timestamp)}</p>
                  <StatusBadge status={t.status} />
                </div>
              </div>
            )) : <p className="text-center py-10 text-muted-foreground">אין אירועים בציר הזמן</p>}
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="space-y-2">
            {versions.length > 0 ? versions.map(v => (
              <div key={v.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">גרסה {v.version}</p>
                  <p className="text-xs text-muted-foreground">{v.changes} • {formatDate(v.created_at)}</p>
                </div>
                <StatusBadge status={v.status} />
              </div>
            )) : <p className="text-center py-10 text-muted-foreground">אין גרסאות נוספות</p>}
          </div>
        )}
      </div>

      {/* Editors */}
      <ImageEditor open={imageEditorOpen} onClose={() => { setImageEditorOpen(false); setImageEditorOutput(null); }} imageUrl={editingMediaUrl}
        onSave={(dataUrl) => {
          if (dataUrl && imageEditorOutput) {
            handleImageEditorSave(dataUrl);
          } else {
            toast.success('התמונה נשמרה!');
            setImageEditorOpen(false);
          }
        }} />
      <VideoEditor open={videoEditorOpen} onClose={() => setVideoEditorOpen(false)} videoUrl={editingMediaUrl}
        onSave={() => { toast.success('העריכה נשמרה!'); setVideoEditorOpen(false); }} />

      {/* AI Image Edit Dialog */}
      {aiEditTarget && (
        <AiImageEditDialog
          open={!!aiEditTarget}
          onClose={() => setAiEditTarget(null)}
          output={aiEditTarget}
          projectId={project.id}
          projectName={project.name}
          onNewVersion={(newOutput) => {
            setOutputs(prev => [newOutput, ...prev]);
            setActiveTab('outputs');
            toast.success(`✅ גרסה חדשה: ${newOutput.id.slice(0, 8)}`);
          }}
        />
      )}

      {/* Delete output dialog */}
      <AlertDialog open={!!deleteOutputTarget} onOpenChange={(open) => { if (!open && !deletingOutput) setDeleteOutputTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת תוצר</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteOutputTarget && <>האם למחוק את <strong>"{deleteOutputTarget.name}"</strong>? הקובץ ימחק לצמיתות.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingOutput}>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOutput} disabled={deletingOutput}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingOutput ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              {deletingOutput ? 'מוחק...' : 'מחק'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete dialog */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={(open) => { if (!open && !bulkDeleting) setBulkDeleteConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת {selectedOutputs.size} תוצרים</AlertDialogTitle>
            <AlertDialogDescription>כל הקבצים והנתונים ימחקו לצמיתות. האם להמשיך?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              {bulkDeleting ? 'מוחק...' : `מחק ${selectedOutputs.size} תוצרים`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete project dialog */}
      <AlertDialog open={deleteProjectConfirm} onOpenChange={(open) => { if (!open && !deletingProject) setDeleteProjectConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת פרויקט</AlertDialogTitle>
            <AlertDialogDescription>
              האם למחוק את הפרויקט <strong>"{project.name}"</strong>?<br />כל התוצרים, הגרסאות והקבצים ימחקו לצמיתות.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProject}>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} disabled={deletingProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingProject ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              {deletingProject ? 'מוחק...' : 'מחק פרויקט'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
