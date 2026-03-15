import { AppLayout } from '@/components/layout/AppLayout';
import { Settings, Plug, Shield, Check, Trash2, Download, Loader2, ImageIcon, Mic, UserCircle, Video, FileText, Subtitles, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const connectedServices = [
  { name: 'Gemini AI', desc: 'תמונות + טקסט + תסריטים', icon: Sparkles, status: 'connected', free: true, plan: 'חינם (מובנה)', planNote: '' },
  { name: 'ElevenLabs', desc: 'דיבוב בעברית (4 קולות)', icon: Mic, status: 'connected', free: false, plan: 'חינם (מוגבל)', planNote: '⚠️ חבילת Free מוגבלת ל-10,000 תווים/חודש. ליצירת תוכן רציני נדרשת חבילה בתשלום ($5+/חודש).' },
  { name: 'D-ID', desc: 'אווטאר מדבר', icon: UserCircle, status: 'connected', free: false, plan: 'חינם (Trial)', planNote: '⚠️ חשבון Trial מוגבל ל-5 דקות. ליצירת סרטוני אווטאר נדרשת חבילה בתשלום ($5.9+/חודש).' },
  { name: 'RunwayML', desc: 'וידאו AI (תמונה/טקסט → סרטון)', icon: Video, status: 'connected', free: false, plan: 'חינם (Trial)', planNote: '⚠️ חשבון Trial מוגבל ל-125 קרדיטים. ליצירת וידאו נדרשת חבילה בתשלום ($12+/חודש).' },
  { name: 'Shotstack', desc: 'עריכת וידאו ורינדור אוטומטי', icon: Video, status: 'connected', free: false, plan: 'Sandbox (חינם)', planNote: '✅ Sandbox חינמי מאפשר רינדור עם ווטרמארק. להסרת ווטרמארק נדרשת חבילה בתשלום ($39+/חודש).' },
  { name: 'Cloudinary', desc: 'ניהול מדיה, עיבוד תמונות ווידאו', icon: ImageIcon, status: 'connected', free: false, plan: 'חינם (מוגבל)', planNote: '✅ חבילת Free כוללת 25 קרדיטים/חודש. לשימוש מורחב נדרשת חבילה בתשלום ($89+/חודש).' },
  { name: 'Whisper AI', desc: 'כתוביות אוטומטיות בעברית', icon: Subtitles, status: 'connected', free: true, plan: 'חינם (מובנה)', planNote: '' },
  { name: 'אחסון מדיה', desc: 'העלאה ושמירת קבצים', icon: ImageIcon, status: 'connected', free: true, plan: 'חינם (מובנה)', planNote: '' },
];

interface StoredFile {
  name: string;
  id: string;
  created_at: string;
  metadata: { size?: number; mimetype?: string };
}

export default function SettingsPage() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadFiles = async () => {
    setLoadingFiles(true);
    try {
      const { data, error } = await supabase.functions.invoke('storage-manager', {
        body: { action: 'list' },
      });
      if (error) throw error;
      setFiles((data?.files || []) as StoredFile[]);
    } catch (err: any) {
      console.error('Error loading files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => { loadFiles(); }, []);

  const handleDeleteFile = async (fileName: string) => {
    setDeletingId(fileName);
    try {
      const { data, error } = await supabase.functions.invoke('storage-manager', {
        body: { action: 'delete', fileName },
      });
      if (error) throw error;
      setFiles(prev => prev.filter(f => f.name !== fileName));
      toast.success('הקובץ נמחק');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה במחיקה');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadFile = (fileName: string) => {
    const { data } = supabase.storage.from('media').getPublicUrl(`uploads/${fileName}`);
    const link = document.createElement('a');
    link.href = data.publicUrl;
    link.download = fileName;
    link.target = '_blank';
    link.click();
    toast.success('ההורדה החלה');
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getFileIcon = (name: string) => {
    if (/\.(jpg|jpeg|png|webp|gif)$/i.test(name)) return '🖼️';
    if (/\.(mp4|webm|mov)$/i.test(name)) return '🎬';
    if (/\.(mp3|wav|m4a)$/i.test(name)) return '🎙️';
    return '📄';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-rubik font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" /> הגדרות
          </h1>
          <p className="text-muted-foreground text-sm mt-1">ניהול חיבורים, אחסון והגדרות מערכת</p>
        </div>

        <Tabs defaultValue="connections" dir="rtl">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="connections" className="flex items-center gap-2"><Plug className="w-4 h-4" /> חיבורים</TabsTrigger>
            <TabsTrigger value="storage" className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> אחסון</TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2"><Shield className="w-4 h-4" /> מערכת</TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="mt-4 space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-rubik font-semibold mb-4">שירותים מחוברים</h2>
              <div className="space-y-3">
                {connectedServices.map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.name} className="p-4 bg-muted/30 rounded-lg border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-success/20 text-success flex items-center justify-center">
                            <Check className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium flex items-center gap-2">
                              <Icon className="w-4 h-4 text-primary" />
                              {s.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{s.desc}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            s.free ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
                          )}>
                            {s.plan}
                          </span>
                          <span className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-success font-medium">
                            מחובר
                          </span>
                        </div>
                      </div>
                      {s.planNote && (
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mr-13">
                          {s.planNote}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="storage" className="mt-4 space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-rubik font-semibold">קבצים שהועלו</h2>
                <button
                  onClick={loadFiles}
                  disabled={loadingFiles}
                  className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted flex items-center gap-1"
                >
                  {loadingFiles ? <Loader2 className="w-3 h-3 animate-spin" /> : '🔄'} רענן
                </button>
              </div>

              {loadingFiles && files.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin ml-2" /> טוען קבצים...
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">אין קבצים שהועלו עדיין</p>
                  <p className="text-xs mt-1">קבצים שתעלה בסטודיו הקריאייטיב יופיעו כאן</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {files.map(file => (
                    <div key={file.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border group">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg">{getFileIcon(file.name)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate max-w-[300px]">
                            {file.name.replace(/^\d+-/, '')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatSize(file.metadata?.size)}
                            {file.created_at && ` • ${new Date(file.created_at).toLocaleDateString('he-IL')}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDownloadFile(file.name)}
                          className="px-2.5 py-1.5 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" /> הורד
                        </button>
                        <button
                          onClick={() => handleDeleteFile(file.name)}
                          disabled={deletingId === file.name}
                          className="px-2.5 py-1.5 border border-destructive/30 rounded-lg text-xs text-destructive hover:bg-destructive/10 flex items-center gap-1 disabled:opacity-50"
                        >
                          {deletingId === file.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          מחק
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-3">
                💡 הורד את הקבצים לדרייב שלך ואז מחק כדי לפנות מקום
              </p>
            </div>
          </TabsContent>

          <TabsContent value="system" className="mt-4 space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="font-rubik font-semibold">הגדרות כלליות</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">שפת ברירת מחדל</label>
                  <select className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm">
                    <option>עברית</option>
                    <option>English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">יחס מסך ברירת מחדל</label>
                  <select className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm">
                    <option>9:16 (רילס / סטורי)</option>
                    <option>1:1 (מרובע)</option>
                    <option>16:9 (יוטיוב)</option>
                  </select>
                </div>
              </div>
              <button onClick={() => toast.success('ההגדרות נשמרו')} className="gradient-gold text-primary-foreground px-5 py-2 rounded-lg font-semibold text-sm">
                שמור הגדרות
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
