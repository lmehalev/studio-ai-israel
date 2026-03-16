import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Edit, Copy, RefreshCw, Archive, Video, FileText, Layers, PlayCircle, Clock, GitBranch, Loader2, Download, Trash2, Maximize2, Wand2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { projectService, getProjectCategory, type ProjectRow, type ProjectOutputRow, type TimelineRow, type VersionRow } from '@/services/projectService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const tabs = [
  { id: 'overview', label: 'סקירה', icon: FileText },
  { id: 'script', label: 'סקריפט', icon: FileText },
  { id: 'scenes', label: 'סצנות', icon: Layers },
  { id: 'outputs', label: 'תוצאות', icon: PlayCircle },
  { id: 'timeline', label: 'ציר זמן', icon: Clock },
  { id: 'versions', label: 'גרסאות', icon: GitBranch },
];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [outputs, setOutputs] = useState<ProjectOutputRow[]>([]);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!id) return;
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
    }).catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('he-IL');
  const formatDateTime = (d: string) => new Date(d).toLocaleString('he-IL');

  if (loading) return <AppLayout><div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div></AppLayout>;
  if (!project) return <AppLayout><div className="text-center py-20"><p className="text-muted-foreground">הפרויקט לא נמצא</p></div></AppLayout>;

  const content = (project.content || {}) as Record<string, any>;
  const scenes = (project.scenes || []) as any[];
  const tags = project.tags || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-rubik font-bold flex items-center gap-3">{project.name} <StatusBadge status={project.status} /></h1>
            <p className="text-muted-foreground text-sm mt-1">
              {project.avatar_name || '—'} • {project.video_type} • {project.aspect_ratio} • גרסה {project.current_version}
              {getProjectCategory(project) && <span className="text-primary"> • {getProjectCategory(project)}</span>}
            </p>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(t => <span key={t} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">{t}</span>)}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-xs hover:bg-muted"><Edit className="w-3.5 h-3.5" /> עריכה</button>
            <button className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-xs hover:bg-muted"><Copy className="w-3.5 h-3.5" /> שכפול</button>
            <button onClick={() => toast.info('המערכת מכינה את הבקשה...')} className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-xs hover:bg-muted"><RefreshCw className="w-3.5 h-3.5" /> יצירה מחדש</button>
            <button className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-xs hover:bg-muted"><Archive className="w-3.5 h-3.5" /> ארכוב</button>
          </div>
        </div>

        {/* Video Preview */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="aspect-video bg-muted flex items-center justify-center max-h-64">
            <div className="text-center">
              <Video className="w-16 h-16 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">תצוגה מקדימה של הסרטון</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap',
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm">פרטי פרויקט</h3>
              {[['סוג סרטון', project.video_type], ['אווטאר', project.avatar_name || '—'], ['ספק', project.provider || '—'], ['יחס מסך', project.aspect_ratio], ['תאריך יצירה', formatDate(project.created_at)]].map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm"><span className="text-muted-foreground">{l}</span><span>{v}</span></div>
              ))}
            </div>
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm">תוכן</h3>
              <p className="text-sm text-muted-foreground">{content.whatToSay || '—'}</p>
              {content.cta && <p className="text-sm"><span className="text-muted-foreground">CTA:</span> {content.cta}</p>}
              {content.targetAudience && <p className="text-sm"><span className="text-muted-foreground">קהל יעד:</span> {content.targetAudience}</p>}
            </div>
            {project.enhanced_prompt && (
              <div className="md:col-span-2 bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-2">פרומפט משופר</h3>
                <p className="text-sm text-muted-foreground">{project.enhanced_prompt}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'script' && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold mb-3">סקריפט</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{project.script || 'אין סקריפט עדיין'}</p>
          </div>
        )}

        {activeTab === 'scenes' && (
          <div className="space-y-3">
            {scenes.length > 0 ? scenes.map((s: any, i: number) => (
              <div key={s.id || i} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">סצנה {i + 1}</span>
                  <span className="font-medium text-sm">{s.title}</span>
                  <span className="text-xs text-muted-foreground mr-auto">{s.duration} שניות • {s.shotType}</span>
                </div>
                {s.spokenText && <p className="text-sm mb-1"><span className="text-muted-foreground">טקסט:</span> {s.spokenText}</p>}
                {s.visualDescription && <p className="text-sm"><span className="text-muted-foreground">ויזואל:</span> {s.visualDescription}</p>}
              </div>
            )) : <p className="text-center py-10 text-muted-foreground">אין סצנות בפרויקט זה</p>}
          </div>
        )}

        {activeTab === 'outputs' && (
          <div className="space-y-3">
            {outputs.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {outputs.map(o => {
                  const mediaUrl = o.thumbnail_url || o.video_url;
                  const isVideo = !!o.video_url && !o.thumbnail_url;
                  return (
                    <div key={o.id} className="bg-card border border-border rounded-xl overflow-hidden group relative">
                      <div className="aspect-square bg-muted/30 flex items-center justify-center">
                        {mediaUrl ? (
                          isVideo ? (
                            <video src={mediaUrl} className="w-full h-full object-cover" />
                          ) : (
                            <img src={mediaUrl} alt={o.name} className="w-full h-full object-cover" />
                          )
                        ) : (
                          <Video className="w-10 h-10 text-muted-foreground" />
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-sm truncate">{o.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(o.created_at)}</p>
                        {o.prompt && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.prompt}</p>}
                      </div>
                      <div className="absolute top-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {mediaUrl && (
                          <>
                            <button onClick={() => window.open(mediaUrl, '_blank')}
                              className="w-7 h-7 bg-accent text-accent-foreground rounded-full flex items-center justify-center" title="צפה">
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={async () => {
                              try {
                                const res = await fetch(mediaUrl);
                                const blob = await res.blob();
                                const blobUrl = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = blobUrl;
                                link.download = `${o.name}.${isVideo ? 'mp4' : 'png'}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(blobUrl);
                                toast.success('ההורדה החלה');
                              } catch { window.open(mediaUrl, '_blank'); }
                            }}
                              className="w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center" title="הורד">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-center py-10 text-muted-foreground">אין תוצאות עדיין</p>}
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

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-rubik font-semibold mb-3">פעולות מהירות</h3>
          <div className="flex flex-wrap gap-2">
            {['שנה רק Hook', 'שנה רק CTA', 'צור 3 גרסאות', 'צור וריאציה', 'החלף סגנון', 'צור מחדש עם ספק אחר'].map(action => (
              <button key={action} onClick={() => toast.info(`${action} - פעולה תתבצע בעתיד`)}
                className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted hover:border-primary/30 transition-colors">
                {action}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
