import { AppLayout } from '@/components/layout/AppLayout';
import { Settings, ImageIcon, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, Download, Plug, Eye, X } from 'lucide-react';
import { ConnectionsTab } from '@/components/settings/ConnectionsTab';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StoredFile | null>(null);

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

  const handleDownloadFile = async (fileName: string) => {
    const { data } = supabase.storage.from('media').getPublicUrl(`uploads/${fileName}`);
    try {
      const res = await fetch(data.publicUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName.replace(/^\d+-/, '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success('ההורדה החלה');
    } catch {
      window.open(data.publicUrl, '_blank');
      toast.info('הקובץ נפתח בטאב חדש');
    }
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

  const isImageFile = (name: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
  const isVideoFile = (name: string) => /\.(mp4|webm|mov)$/i.test(name);

  const getPublicUrl = (fileName: string) => {
    const { data } = supabase.storage.from('media').getPublicUrl(`uploads/${fileName}`);
    return data.publicUrl;
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    await handleDeleteFile(confirmDelete.name);
    setConfirmDelete(null);
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
            <ConnectionsTab />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto">
                  {files.map(file => (
                    <div key={file.name} className="bg-muted/30 rounded-xl border border-border overflow-hidden group hover:border-primary/30 transition-colors">
                      {/* Thumbnail */}
                      <div className="relative w-full h-32 bg-muted/50 flex items-center justify-center cursor-pointer" onClick={() => setPreviewFile(file)}>
                        {isImageFile(file.name) ? (
                          <img src={getPublicUrl(file.name)} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : isVideoFile(file.name) ? (
                          <video src={getPublicUrl(file.name)} className="w-full h-full object-cover" muted />
                        ) : (
                          <span className="text-3xl">{getFileIcon(file.name)}</span>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <p className="text-xs font-medium truncate" title={file.name.replace(/^\d+-/, '')}>
                          {file.name.replace(/^\d+-/, '')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatSize(file.metadata?.size)}
                          {file.created_at && ` • ${new Date(file.created_at).toLocaleDateString('he-IL')}`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <button onClick={() => handleDownloadFile(file.name)} className="flex-1 px-2 py-1 border border-border rounded-lg text-xs hover:bg-muted flex items-center justify-center gap-1">
                            <Download className="w-3 h-3" /> הורד
                          </button>
                          <button onClick={() => setConfirmDelete(file)} disabled={deletingId === file.name} className="flex-1 px-2 py-1 border border-destructive/30 rounded-lg text-xs text-destructive hover:bg-destructive/10 flex items-center justify-center gap-1 disabled:opacity-50">
                            {deletingId === file.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} מחק
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-3">
                💡 הורד את הקבצים לדרייב שלך ואז מחק כדי לפנות מקום
              </p>
            </div>

            {/* Preview Dialog */}
            <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-right">{previewFile?.name.replace(/^\d+-/, '')}</DialogTitle>
                </DialogHeader>
                <div className="flex items-center justify-center min-h-[300px] bg-muted/30 rounded-lg overflow-hidden">
                  {previewFile && isImageFile(previewFile.name) ? (
                    <img src={getPublicUrl(previewFile.name)} alt={previewFile.name} className="max-w-full max-h-[500px] object-contain" />
                  ) : previewFile && isVideoFile(previewFile.name) ? (
                    <video src={getPublicUrl(previewFile.name)} controls className="max-w-full max-h-[500px]" />
                  ) : (
                    <span className="text-5xl">{previewFile ? getFileIcon(previewFile.name) : ''}</span>
                  )}
                </div>
                <DialogFooter className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => previewFile && handleDownloadFile(previewFile.name)}>
                    <Download className="w-4 h-4 ml-1" /> הורד
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => { if (previewFile) { setConfirmDelete(previewFile); setPreviewFile(null); } }}>
                    <Trash2 className="w-4 h-4 ml-1" /> מחק
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-right">מחיקת קובץ</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {confirmDelete && isImageFile(confirmDelete.name) && (
                    <img src={getPublicUrl(confirmDelete.name)} alt="" className="w-full max-h-48 object-contain rounded-lg bg-muted/30" />
                  )}
                  <p className="text-sm text-center">
                    האם אתה בטוח שברצונך למחוק את <span className="font-semibold">{confirmDelete?.name.replace(/^\d+-/, '')}</span>?
                  </p>
                  <p className="text-xs text-muted-foreground text-center">פעולה זו אינה ניתנת לביטול</p>
                </div>
                <DialogFooter className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>ביטול</Button>
                  <Button variant="destructive" size="sm" onClick={handleConfirmDelete} disabled={!!deletingId}>
                    {deletingId ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Trash2 className="w-4 h-4 ml-1" />} מחק לצמיתות
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
