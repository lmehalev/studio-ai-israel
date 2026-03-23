import { useState, useRef } from 'react';
import { Wand2, Upload, X, Loader2, Download, ImageIcon, Save, ArrowLeftRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CostApprovalDialog, type CostEstimate } from '@/components/studio/CostApprovalDialog';
import { imageService, storageService } from '@/services/creativeService';
import { projectService, type ProjectOutputRow } from '@/services/projectService';
import { toast } from 'sonner';

interface AiImageEditDialogProps {
  open: boolean;
  onClose: () => void;
  output: ProjectOutputRow;
  projectId: string;
  projectName?: string;
  onNewVersion: (newOutput: ProjectOutputRow) => void;
}

const ASPECT_OPTIONS = [
  { value: 'auto', label: 'אוטומטי (שמור מקור)' },
  { value: '9:16', label: 'דיוקן (9:16)' },
  { value: '1:1', label: 'ריבוע (1:1)' },
  { value: '16:9', label: 'לרוחב (16:9)' },
];

export function AiImageEditDialog({ open, onClose, output, projectId, projectName, onNewVersion }: AiImageEditDialogProps) {
  const [editPrompt, setEditPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('auto');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [savedOutput, setSavedOutput] = useState<ProjectOutputRow | null>(null);
  const pendingAction = useRef<'preview' | 'save'>('preview');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const originalUrl = output.thumbnail_url || output.video_url || '';

  const resetState = () => {
    setEditPrompt('');
    setAspectRatio('auto');
    setReferenceImages([]);
    setPreviewUrl(null);
    setGenerating(false);
    setSaving(false);
    setSavedOutput(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const costEstimates: CostEstimate[] = [{
    provider: 'Gemini / Krea',
    action: 'עריכת תמונה עם AI',
    estimatedCost: '~1 קרדיט',
    details: ['עריכה לפי הוראות טקסט', referenceImages.length > 0 ? `${referenceImages.length} תמונות רפרנס` : ''].filter(Boolean),
  }];

  const requestAction = (action: 'preview' | 'save') => {
    if (!editPrompt.trim()) {
      toast.error('כתוב מה לשנות בתמונה');
      return;
    }
    pendingAction.current = action;
    setCostOpen(true);
  };

  const executeEdit = async (): Promise<string> => {
    const sourceUrl = previewUrl || originalUrl;
    const arParam = aspectRatio === 'auto' ? undefined : aspectRatio;
    const result = await imageService.edit(
      editPrompt,
      sourceUrl,
      referenceImages.length > 0 ? referenceImages : undefined,
      arParam,
    );
    if (!result.imageUrl) throw new Error('לא התקבלה תמונה מהספק');
    return result.imageUrl;
  };

  /** Upload base64/blob to storage, return public URL */
  const uploadToStorage = async (imageUrl: string): Promise<string> => {
    if (imageUrl.startsWith('data:')) {
      const blob = await fetch(imageUrl).then(r => r.blob());
      const file = new File([blob], `ai-edit-${Date.now()}.png`, { type: 'image/png' });
      return await storageService.upload(file);
    }
    return imageUrl;
  };

  const handleApprove = async () => {
    setCostOpen(false);
    const action = pendingAction.current;

    if (action === 'preview') {
      setGenerating(true);
      try {
        const newUrl = await executeEdit();
        setPreviewUrl(newUrl);
        toast.success('תצוגה מקדימה מוכנה — בדוק את התוצאה');
      } catch (e: any) {
        const msg = e.message || 'שגיאה בעריכת התמונה';
        toast.error(`שגיאה: ${msg}`, { duration: 8000 });
        console.error('[AiImageEdit] preview error:', e);
      } finally {
        setGenerating(false);
      }
    } else {
      // Save as new version
      setSaving(true);
      try {
        let imageUrl = previewUrl;
        if (!imageUrl) {
          imageUrl = await executeEdit();
          setPreviewUrl(imageUrl);
        }

        // Upload to storage
        const storedUrl = await uploadToStorage(imageUrl);

        // Save as new output under the SAME project
        const newOutput = await projectService.addOutput(projectId, {
          name: `${output.name} (עריכה)`,
          thumbnail_url: storedUrl,
          status: 'הושלם',
          prompt: editPrompt,
          description: `עריכת AI מתוצר: ${output.name}`,
          aspect_ratio: aspectRatio === 'auto' ? (output.aspect_ratio || null) : aspectRatio,
          provider: 'Gemini AI Edit',
        });

        setSavedOutput(newOutput);
        onNewVersion(newOutput);
        toast.success(`✅ גרסה חדשה נשמרה בפרויקט — ${newOutput.id.slice(0, 8)}`, { duration: 6000 });
      } catch (e: any) {
        const msg = e.message || 'שגיאה בשמירת הגרסה';
        toast.error(`שגיאה בשמירה: ${msg}`, { duration: 8000 });
        console.error('[AiImageEdit] save error:', e);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files).slice(0, 5 - referenceImages.length)) {
      try {
        const url = await storageService.upload(file);
        setReferenceImages(prev => [...prev, url]);
      } catch (err: any) {
        toast.error(`שגיאה בהעלאת ${file.name}`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadPreview = async () => {
    if (!previewUrl) return;
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${output.name}-edited.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(previewUrl, '_blank');
    }
  };

  const showBeforeAfter = !!previewUrl && !!originalUrl;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              ערוך עם AI
            </DialogTitle>
            <DialogDescription>ערוך את התמונה באמצעות הוראות טקסט. המקור לא ישתנה — תיווצר גרסה חדשה באותו פרויקט.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Before / After preview */}
            {showBeforeAfter ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <ArrowLeftRight className="w-4 h-4" />
                  לפני / אחרי
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border overflow-hidden bg-muted/30">
                    <div className="text-xs text-center py-1 bg-muted/50 text-muted-foreground font-medium">מקור</div>
                    <div className="flex items-center justify-center" style={{ maxHeight: 260 }}>
                      <img src={originalUrl} alt="מקור" className="max-w-full max-h-[240px] object-contain" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/30 overflow-hidden bg-muted/30">
                    <div className="text-xs text-center py-1 bg-primary/10 text-primary font-medium">תוצאה חדשה</div>
                    <div className="flex items-center justify-center" style={{ maxHeight: 260 }}>
                      <img src={previewUrl} alt="תוצאה" className="max-w-full max-h-[240px] object-contain" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">תצוגה מקדימה</span>
                  <button onClick={() => setPreviewUrl(null)} className="hover:text-foreground underline">חזור למקור</button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden bg-muted/30 flex items-center justify-center" style={{ maxHeight: 320 }}>
                {originalUrl ? (
                  <img src={originalUrl} alt={output.name} className="max-w-full max-h-[320px] object-contain" />
                ) : (
                  <div className="py-16 text-muted-foreground flex flex-col items-center gap-2">
                    <ImageIcon className="w-10 h-10" />
                    <span>אין תמונה</span>
                  </div>
                )}
              </div>
            )}

            {/* Saved confirmation */}
            {savedOutput && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 flex items-center gap-3">
                <img src={savedOutput.thumbnail_url || ''} alt="saved" className="w-14 h-14 rounded object-cover border border-border" />
                <div className="flex-1 text-sm">
                  <div className="font-medium text-green-400">✅ נשמר בפרויקט{projectName ? `: ${projectName}` : ''}</div>
                  <div className="text-muted-foreground text-xs mt-0.5">מזהה: {savedOutput.id.slice(0, 8)} · {savedOutput.name}</div>
                </div>
              </div>
            )}

            {/* Edit prompt */}
            <div className="space-y-1.5">
              <Label>מה לשנות בתמונה?</Label>
              <Textarea
                dir="rtl"
                placeholder="למשל: הוסף לוגו קטן בפינה הימנית העליונה, שנה רקע לכחול כהה..."
                value={editPrompt}
                onChange={e => setEditPrompt(e.target.value)}
                rows={3}
              />
            </div>

            {/* Aspect ratio */}
            <div className="space-y-1.5">
              <Label>יחס תמונה</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASPECT_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reference images */}
            <div className="space-y-1.5">
              <Label>תמונות רפרנס (אופציונלי, עד 5)</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {referenceImages.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                    <img src={url} className="w-full h-full object-cover" />
                    <button onClick={() => setReferenceImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {referenceImages.length < 5 && (
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 border border-dashed border-border rounded-lg flex items-center justify-center hover:bg-muted">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleRefUpload} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={() => requestAction('preview')} disabled={generating || saving || !editPrompt.trim()} className="flex-1">
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Wand2 className="w-4 h-4 mr-1" />}
                {generating ? 'מעבד...' : 'עדכן תצוגה מקדימה'}
              </Button>
              <Button onClick={() => requestAction('save')} disabled={generating || saving || !editPrompt.trim()} variant="secondary" className="flex-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                {saving ? 'שומר...' : 'שמור כגרסה חדשה'}
              </Button>
            </div>

            {previewUrl && (
              <Button variant="outline" size="sm" onClick={handleDownloadPreview} className="w-full">
                <Download className="w-4 h-4 mr-1" /> הורד תצוגה מקדימה
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CostApprovalDialog
        open={costOpen}
        onOpenChange={setCostOpen}
        estimates={costEstimates}
        onApprove={handleApprove}
        title="אישור עריכת תמונה עם AI"
      />
    </>
  );
}
