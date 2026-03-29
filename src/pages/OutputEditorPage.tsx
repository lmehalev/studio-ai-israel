import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowRight, Download, Wand2, Edit, Trash2, Star, Loader2,
  Eye, GitBranch, ImageIcon, Video, Calendar, MoreHorizontal,
  Palette, Check, X
} from 'lucide-react';
import { toast } from 'sonner';
import { projectService, type ProjectRow, type ProjectOutputRow } from '@/services/projectService';
import { storageService } from '@/services/creativeService';
import { ImageEditor } from '@/components/editors/ImageEditor';
import { AiImageEditDialog } from '@/components/studio/AiImageEditDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

const isImageOutput = (o: ProjectOutputRow) => {
  const url = (o.thumbnail_url || o.video_url || '').toLowerCase();
  return /\.(jpg|jpeg|png|webp|gif|svg)/.test(url) || (!!o.thumbnail_url && !o.video_url);
};

const isVideoOutput = (o: ProjectOutputRow) => {
  return !!o.video_url;
};

export default function OutputEditorPage() {
  const { id: projectId, outputId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [allOutputs, setAllOutputs] = useState<ProjectOutputRow[]>([]);
  const [output, setOutput] = useState<ProjectOutputRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'edit' | 'versions'>('preview');

  // Editors
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [aiEditOpen, setAiEditOpen] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('he-IL');
  const formatDateTime = (d: string) => new Date(d).toLocaleString('he-IL');

  const loadData = useCallback(async () => {
    if (!projectId || !outputId) return;
    try {
      const [p, outputs] = await Promise.all([
        projectService.getById(projectId),
        projectService.getOutputs(projectId),
      ]);
      setProject(p);
      setAllOutputs(outputs);
      const current = outputs.find(o => o.id === outputId);
      setOutput(current || null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, outputId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDownload = async (o: ProjectOutputRow) => {
    // For videos, prioritize video_url (not thumbnail_url which could be a still image)
    const isVid = isVideoOutput(o);
    const url = isVid ? (o.video_url || o.thumbnail_url) : (o.thumbnail_url || o.video_url);
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const ext = isVid ? 'mp4' : 'png';
      link.download = `${o.name}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleSetPrimary = async (o: ProjectOutputRow) => {
    if (!project) return;
    try {
      await projectService.update(project.id, {
        content: { ...(project.content || {}), primaryOutputId: o.id },
      });
      setProject(prev => prev ? { ...prev, content: { ...(prev.content || {}), primaryOutputId: o.id } } : prev);
      toast.success('הוגדר כתוצר ראשי');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteVersion = async () => {
    if (!deleteConfirm || !project) return;
    const target = allOutputs.find(o => o.id === deleteConfirm);
    if (!target) return;
    setDeleting(true);
    try {
      await projectService.deleteOutput(target.id, target);
      const newOutputs = allOutputs.filter(o => o.id !== deleteConfirm);
      setAllOutputs(newOutputs);
      if (deleteConfirm === outputId) {
        // Current output deleted — go to first available or back
        if (newOutputs.length > 0) {
          navigate(`/projects/${projectId}/outputs/${newOutputs[0].id}`, { replace: true });
        } else {
          navigate(`/projects/${projectId}`, { replace: true });
        }
      }
      toast.success('הגרסה נמחקה');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleImageEditorSave = async (dataUrl: string) => {
    if (!project || !output) return;
    try {
      const blob = await fetch(dataUrl).then(r => r.blob());
      const file = new File([blob], `edited-${Date.now()}.png`, { type: 'image/png' });
      const storedUrl = await storageService.upload(file);

      const newOutput = await projectService.addOutput(project.id, {
        name: `${output.name} (עריכה ידנית)`,
        thumbnail_url: storedUrl,
        status: 'הושלם',
        description: `עריכה ידנית מתוצר: ${output.name}`,
        aspect_ratio: output.aspect_ratio,
        provider: 'Image Editor',
      });

      setAllOutputs(prev => [newOutput, ...prev]);
      setImageEditorOpen(false);
      toast.success('נשמר כגרסה חדשה בפרויקט');
      navigate(`/projects/${projectId}/outputs/${newOutput.id}`, { replace: true });
    } catch (e: any) {
      toast.error(`שגיאה בשמירה: ${e.message}`);
    }
  };

  const handleNewAiVersion = (newOutput: ProjectOutputRow) => {
    setAllOutputs(prev => [newOutput, ...prev]);
    setAiEditOpen(false);
    navigate(`/projects/${projectId}/outputs/${newOutput.id}`, { replace: true });
  };

  if (loading) return <AppLayout><div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div></AppLayout>;
  if (!project || !output) return <AppLayout><div className="text-center py-20"><p className="text-muted-foreground">התוצר לא נמצא</p><Link to={`/projects/${projectId}`} className="text-primary hover:underline mt-2 inline-block">חזרה לפרויקט</Link></div></AppLayout>;

  const mediaUrl = output.thumbnail_url || output.video_url;
  const isImage = isImageOutput(output);
  const isVideo = isVideoOutput(output) && !isImage;
  const content = (project.content || {}) as Record<string, any>;
  const isPrimary = content.primaryOutputId === output.id;

  // Get versions: all outputs in this project, sorted by date
  const versionsList = [...allOutputs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const tabs = [
    { id: 'preview' as const, label: 'תצוגה', icon: Eye },
    { id: 'edit' as const, label: 'עריכה', icon: Edit },
    { id: 'versions' as const, label: `גרסאות (${versionsList.length})`, icon: GitBranch },
  ];

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/projects" className="hover:text-foreground">פרויקטים</Link>
          <ArrowRight className="w-3 h-3 rotate-180" />
          <Link to={`/projects/${projectId}`} className="hover:text-foreground">{project.name}</Link>
          <ArrowRight className="w-3 h-3 rotate-180" />
          <span className="text-foreground font-medium">{output.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-rubik font-bold flex items-center gap-2">
              {output.name}
              {isPrimary && (
                <span className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5" /> ראשי
                </span>
              )}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(output.created_at)}</span>
              {output.provider && <span>{output.provider}</span>}
              {output.aspect_ratio && <span>{output.aspect_ratio}</span>}
              {output.status && <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">{output.status}</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => handleDownload(output)}>
              <Download className="w-3.5 h-3.5 mr-1" /> הורד
            </Button>
            {!isPrimary && (
              <Button variant="outline" size="sm" onClick={() => handleSetPrimary(output)}>
                <Star className="w-3.5 h-3.5 mr-1" /> הגדר כראשי
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap',
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>

        {/* ── PREVIEW TAB ── */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-center bg-muted/30 min-h-[300px] max-h-[500px]">
                {isVideo && mediaUrl ? (
                  <video src={mediaUrl} controls className="max-w-full max-h-[500px] object-contain" />
                ) : mediaUrl ? (
                  <img src={mediaUrl} alt={output.name} className="max-w-full max-h-[500px] object-contain" />
                ) : (
                  <div className="py-20 text-muted-foreground flex flex-col items-center gap-2">
                    <ImageIcon className="w-12 h-12" />
                    <span>אין תצוגה מקדימה</span>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['שם', output.name],
                ['סטטוס', output.status],
                ['ספק', output.provider || '—'],
                ['יחס', output.aspect_ratio || '—'],
              ].map(([l, v]) => (
                <div key={l} className="bg-card border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className="text-sm font-medium mt-0.5 truncate">{v}</p>
                </div>
              ))}
            </div>

            {output.prompt && (
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">פרומפט</p>
                <p className="text-sm whitespace-pre-wrap">{output.prompt}</p>
              </div>
            )}
            {output.description && (
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">תיאור</p>
                <p className="text-sm">{output.description}</p>
              </div>
            )}
          </div>
        )}

        {/* ── EDIT TAB ── */}
        {activeTab === 'edit' && (
          <div className="space-y-4">
            {isImage && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setAiEditOpen(true)}
                  className="bg-card border border-border rounded-xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                >
                  <Wand2 className="w-8 h-8 mx-auto text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm mb-1">✨ ערוך עם AI</h3>
                  <p className="text-xs text-muted-foreground">שנה אלמנטים, הוסף/הסר פרטים, שנה רקע — באמצעות הוראות טקסט</p>
                </button>

                <button
                  onClick={() => setImageEditorOpen(true)}
                  className="bg-card border border-border rounded-xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                >
                  <Palette className="w-8 h-8 mx-auto text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm mb-1">🎨 עורך תמונה</h3>
                  <p className="text-xs text-muted-foreground">הוסף טקסט, אייקונים, פילטרים, התאמות — עורך בסגנון Canva</p>
                </button>
              </div>
            )}

            {isVideo && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => navigate(`/creative-studio?projectId=${projectId}&editVideoUrl=${encodeURIComponent(output.video_url || mediaUrl || '')}&action=subtitles`)}
                  className="bg-card border border-border rounded-xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                >
                  <Video className="w-8 h-8 mx-auto text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm mb-1">🎬 כתוביות / לוגו / מוזיקה</h3>
                  <p className="text-xs text-muted-foreground">עורך כתוביות, שכבות, סטיקרים ורינדור — הגרסה החדשה תישמר באותו פרויקט</p>
                </button>
                <button
                  onClick={() => {
                    const vUrl = output.video_url || mediaUrl || '';
                    if (vUrl) {
                      // Open video editor for trim
                      setImageEditorOpen(false);
                      navigate(`/creative-studio?projectId=${projectId}&editVideoUrl=${encodeURIComponent(vUrl)}&action=subtitles`);
                    }
                  }}
                  className="bg-card border border-border rounded-xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                >
                  <Edit className="w-8 h-8 mx-auto text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm mb-1">✂️ חיתוך + שכבות</h3>
                  <p className="text-xs text-muted-foreground">חתוך, הוסף אייקונים/סטיקרים/לוגו בתזמון שונה — ורנדר גרסה חדשה</p>
                </button>
              </div>
            )}

            {!isImage && !isVideo && (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">סוג תוצר לא נתמך לעריכה</p>
              </div>
            )}
          </div>
        )}

        {/* ── VERSIONS TAB ── */}
        {activeTab === 'versions' && (
          <div className="space-y-3">
            {versionsList.length > 0 ? versionsList.map(v => {
              const vMedia = v.thumbnail_url || v.video_url;
              const isCurrent = v.id === outputId;
              const vIsPrimary = content.primaryOutputId === v.id;
              return (
                <div key={v.id}
                  className={cn(
                    'bg-card border rounded-xl p-3 flex items-center gap-3 transition-colors',
                    isCurrent ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:border-muted-foreground/30'
                  )}>
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted/30 flex-shrink-0 border border-border">
                    {vMedia ? (
                      <img src={vMedia} alt={v.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground" /></div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{v.name}</p>
                      {isCurrent && <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">נוכחי</span>}
                      {vIsPrimary && <span className="text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full flex items-center gap-0.5"><Star className="w-2 h-2" /> ראשי</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(v.created_at)}</p>
                    {v.provider && <p className="text-xs text-muted-foreground">{v.provider}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!isCurrent && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/projects/${projectId}/outputs/${v.id}`}>
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(v)}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    {!vIsPrimary && (
                      <Button variant="ghost" size="sm" onClick={() => handleSetPrimary(v)}>
                        <Star className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(v.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            }) : (
              <p className="text-center py-10 text-muted-foreground">אין גרסאות</p>
            )}
          </div>
        )}
      </div>

      {/* Image Editor */}
      <ImageEditor
        open={imageEditorOpen}
        onClose={() => setImageEditorOpen(false)}
        imageUrl={mediaUrl || ''}
        onSave={handleImageEditorSave}
      />

      {/* AI Image Edit Dialog */}
      {aiEditOpen && output && (
        <AiImageEditDialog
          open={aiEditOpen}
          onClose={() => setAiEditOpen(false)}
          output={output}
          projectId={project.id}
          projectName={project.name}
          onNewVersion={handleNewAiVersion}
        />
      )}

      {/* Delete version dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open && !deleting) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת גרסה</AlertDialogTitle>
            <AlertDialogDescription>האם למחוק גרסה זו? הקובץ ימחק לצמיתות.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVersion} disabled={deleting}
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
