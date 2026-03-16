import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowRight, Loader2, Download, Copy, RefreshCw,
  Play, Pause, Mic, MicOff, Upload, Eye, Save, Edit3,
  Subtitles, Check, X, Wand2, UserCircle, ChevronLeft,
  ImageIcon, Video, FileText, Sparkles, Link2, Volume2, ChevronDown
} from 'lucide-react';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSpeechToText } from '@/hooks/use-speech-to-text';
import {
  imageService, voiceService, didService, avatarGenService,
  promptEnhanceService, subtitleService, runwayService,
  avatarDbService,
  type SubtitleSegment, type Brand,
} from '@/services/creativeService';
import { supabase } from '@/integrations/supabase/client';
import { FileUploadZone } from '@/components/FileUploadZone';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { UrlImportInput } from '@/components/UrlImportInput';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export type StudioAction = 'image' | 'video_ai' | 'subtitles' | 'import_edit';

const actionOptions: { id: StudioAction; label: string; icon: typeof ImageIcon; desc: string }[] = [
  { id: 'image', label: 'צור תמונה', icon: ImageIcon, desc: 'יצירת תמונה שיווקית מתיאור טקסט' },
  { id: 'video_ai', label: 'וידאו AI', icon: Video, desc: 'צור סרטון מתמונה או טקסט' },
  { id: 'subtitles', label: 'כתוביות לסרטון', icon: Subtitles, desc: 'תמלול אוטומטי + עריכת כתוביות' },
  { id: 'import_edit', label: 'ייבוא ועריכה', icon: Link2, desc: 'קישור לתמונה, סרטון או YouTube — חלץ וערוך' },
];

const subtitleFontOptions = [
  { value: 'font-heebo', label: 'Heebo (ברירת מחדל)' },
  { value: 'font-rubik', label: 'Rubik' },
  { value: 'font-sans', label: 'Sans' },
  { value: 'font-serif', label: 'Serif' },
  { value: 'font-mono', label: 'Mono' },
] as const;

interface StudioWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeBrand: Brand | undefined;
  buildPrompt: (base: string) => string;
}

export function StudioWizardDialog({ open, onOpenChange, activeBrand, buildPrompt }: StudioWizardDialogProps) {
  const [selectedAction, setSelectedAction] = useState<StudioAction | null>(null);
  const [step, setStep] = useState(0);

  // Shared state
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imageUrl?: string; audioUrl?: string; videoUrl?: string } | null>(null);

  // Speech
  const { isListening, isSupported: speechSupported, toggle: toggleSpeech } = useSpeechToText({
    language: 'he-IL',
    onResult: (text) => setPrompt(prev => prev ? `${prev} ${text}` : text),
  });

  // Image generation - reference images & iterative editing
  const [imageRefPhotos, setImageRefPhotos] = useState<string[]>([]);
  const [editHistory, setEditHistory] = useState<{ imageUrl: string; prompt: string }[]>([]);
  const [editPrompt, setEditPrompt] = useState('');

  // Import/Edit
  const [importUrl, setImportUrl] = useState('');
  const [importType, setImportType] = useState<'image' | 'video' | null>(null);

  // Video AI
  const [runwayMode, setRunwayMode] = useState<'image_to_video' | 'text_to_video'>('image_to_video');
  const [runwayImageUrl, setRunwayImageUrl] = useState('');
  const [runwayPolling, setRunwayPolling] = useState(false);
  const [runwayProgress, setRunwayProgress] = useState(0);

  // Subtitles
  const [subtitleSegments, setSubtitleSegments] = useState<SubtitleSegment[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [savingSrt, setSavingSrt] = useState(false);
  const [savedSrtUrl, setSavedSrtUrl] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [subtitleOffset, setSubtitleOffset] = useState(0.3);
  const [subtitleFontClass, setSubtitleFontClass] = useState<string>('font-heebo');

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setSelectedAction(null);
        setStep(0);
        setPrompt('');
        setResult(null);
        setImageRefPhotos([]);
        setEditHistory([]);
        setEditPrompt('');
        setImportUrl('');
        setImportType(null);
        setRunwayImageUrl('');
        setVideoFile(null);
        setVideoPreviewUrl(null);
        setSubtitleSegments([]);
        setSavedSrtUrl(null);
      }, 300);
    }
  }, [open]);

  const getAdjustedSegments = useCallback(() => {
    return subtitleSegments
      .map((seg) => ({
        ...seg,
        start: Math.max(0, Number((seg.start + subtitleOffset).toFixed(2))),
        end: Math.max(Math.max(0, Number((seg.start + subtitleOffset).toFixed(2))) + 0.1, Number((seg.end + subtitleOffset).toFixed(2))),
      }))
      .sort((a, b) => a.start - b.start);
  }, [subtitleSegments, subtitleOffset]);

  const handleDownload = async () => {
    const url = result?.imageUrl || result?.audioUrl || result?.videoUrl;
    if (!url) return;
    const ext = result?.videoUrl ? 'mp4' : result?.audioUrl ? 'mp3' : 'png';
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${activeBrand?.name || 'studio'}-${Date.now()}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success('ההורדה החלה');
    } catch { window.open(url, '_blank'); }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else if (step === 1) { setSelectedAction(null); setStep(0); }
    else onOpenChange(false);
  };

  const getStepInfo = () => {
    if (step === 0) return { title: 'מה תרצה ליצור?', desc: 'בחר את סוג התוכן שתרצה לייצר' };
    if (!selectedAction) return { title: '', desc: '' };

    const stepsMap: Record<StudioAction, { title: string; desc: string }[]> = {
      image: [
        { title: 'תאר את התמונה', desc: 'כתוב מה תרצה לראות בתמונה' },
        { title: 'התוצאה', desc: 'התמונה שנוצרה' },
      ],
      video_ai: [
        { title: 'סוג הסרטון', desc: 'איך תרצה ליצור?' },
        { title: 'תאר את הסרטון', desc: 'מה יקרה בסרטון?' },
        { title: 'הסרטון מוכן', desc: 'הסרטון שנוצר' },
      ],
      subtitles: [
        { title: 'העלה סרטון', desc: 'בחר סרטון לתמלול' },
        { title: 'תמלול ועריכה', desc: 'ערוך את הכתוביות' },
        { title: 'שמירה', desc: 'שמור או הורד SRT' },
      ],
      import_edit: [
        { title: 'הדבק קישור', desc: 'שים קישור לתמונה או סרטון' },
        { title: 'מה לשנות?', desc: 'תאר את השינויים שתרצה' },
        { title: 'התוצאה', desc: 'התוצאה הערוכה' },
      ],
    };

    const steps = stepsMap[selectedAction];
    const idx = step - 1;
    return steps[idx] || { title: '', desc: '' };
  };

  const getTotalSteps = () => {
    if (!selectedAction) return 1;
    const counts: Record<StudioAction, number> = {
      image: 2, video_ai: 3, subtitles: 3, import_edit: 3,
    };
    return counts[selectedAction] + 1;
  };

  // ============ PROMPT INPUT WITH SPEECH ============
  const renderPromptInput = ({ placeholder, rows = 4 }: { placeholder: string; rows?: number }) => (
    <div className="relative">
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => e.stopPropagation()}
        placeholder={placeholder}
        rows={rows}
        dir="rtl"
        className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 pl-12 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      {speechSupported && (
        <button
          type="button"
          onClick={toggleSpeech}
          className={cn(
            'absolute left-3 top-3 p-1.5 rounded-lg transition-all',
            isListening ? 'bg-destructive/10 text-destructive animate-pulse' : 'bg-muted/50 text-muted-foreground hover:text-foreground'
          )}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      )}
      {isListening && (
        <div className="absolute left-3 bottom-3 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-xs text-destructive font-medium">מקליט...</span>
        </div>
      )}
    </div>
  );

  // ============ RESULT VIEW ============
  const renderResultView = () => (
    <div className="space-y-4">
      {result?.imageUrl && (
        <div className="rounded-lg overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
          <img src={result.imageUrl} alt="תוצאה" className="max-w-full max-h-[300px] object-contain" />
        </div>
      )}
      {result?.videoUrl && (
        <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
          <video src={result.videoUrl} controls className="w-full max-h-[300px]" />
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={handleDownload} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> הורד
        </button>
        <button onClick={async () => {
          const url = result?.imageUrl || result?.videoUrl;
          if (url) { await navigator.clipboard.writeText(url); toast.success('הועתק'); }
        }} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
          <Copy className="w-4 h-4" /> העתק קישור
        </button>
      </div>
      <button onClick={() => { setResult(null); setSelectedAction(null); setStep(0); setPrompt(''); setEditHistory([]); setEditPrompt(''); setImageRefPhotos([]); }}
        className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-2">
        <RefreshCw className="w-3.5 h-3.5" /> התחל מחדש
      </button>
    </div>
  );

  // ============ IMAGE RESULT WITH ITERATIVE EDITING ============
  const renderImageResultWithEdit = () => (
    <div className="space-y-4">
      {editHistory.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {editHistory.map((h, i) => (
            <button key={i} onClick={() => setResult({ imageUrl: h.imageUrl })}
              className={cn('flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all',
                result?.imageUrl === h.imageUrl ? 'border-primary shadow-gold' : 'border-border/50 opacity-60 hover:opacity-100')}>
              <img src={h.imageUrl} alt={`גרסה ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {result?.imageUrl && (
        <div className="rounded-lg overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
          <img src={result.imageUrl} alt="תוצאה" className="max-w-full max-h-[250px] object-contain" />
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={handleDownload} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> הורד
        </button>
        <button onClick={async () => {
          if (result?.imageUrl) { await navigator.clipboard.writeText(result.imageUrl); toast.success('הועתק'); }
        }} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
          <Copy className="w-4 h-4" /> העתק
        </button>
      </div>
      <div className="bg-muted/30 rounded-xl border border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Edit3 className="w-3.5 h-3.5" /> רוצה לשנות משהו? תאר מה לעדכן
          </p>
          <VoiceDictationButton onResult={(text) => setEditPrompt(prev => prev ? prev + ' ' + text : text)} />
        </div>
        <div className="relative">
          <textarea
            value={editPrompt}
            onChange={e => setEditPrompt(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder='למשל: "שנה את הרקע לכחול", "הוסף לוגו למעלה"'
            rows={2}
            dir="rtl"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button
          onClick={async () => {
            if (!editPrompt.trim() || !result?.imageUrl) return;
            setLoading(true);
            try {
              const data = await imageService.edit(buildPrompt(editPrompt), result.imageUrl);
              setEditHistory(prev => [...prev, { imageUrl: data.imageUrl, prompt: editPrompt }]);
              setResult({ imageUrl: data.imageUrl });
              setEditPrompt('');
              toast.success('התמונה עודכנה!');
            } catch (e: any) { toast.error(e.message); }
            finally { setLoading(false); }
          }}
          disabled={loading || !editPrompt.trim()}
          className="w-full gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {loading ? 'מעדכן...' : 'עדכן תמונה'}
        </button>
      </div>
      <button onClick={() => { setResult(null); setSelectedAction(null); setStep(0); setPrompt(''); setEditHistory([]); setEditPrompt(''); setImageRefPhotos([]); }}
        className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-2">
        <RefreshCw className="w-3.5 h-3.5" /> התחל מחדש
      </button>
    </div>
  );

  // ============ RENDER STEP CONTENT ============
  const renderContent = () => {
    // Step 0: Action selection
    if (step === 0) {
      return (
        <div className="space-y-2">
          {actionOptions.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                onClick={() => { setSelectedAction(opt.id); setStep(1); }}
                className={cn(
                  'w-full flex items-center gap-3 p-3.5 rounded-xl border text-right transition-all hover:border-primary/50 hover:bg-primary/5',
                  'border-border bg-card'
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground rotate-180 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      );
    }

    const wizardStep = step - 1;

    // ====== IMAGE ======
    if (selectedAction === 'image') {
      if (wizardStep === 0) return (
        <div className="space-y-4">
          {renderPromptInput({ placeholder: 'תאר את התמונה... למשל: "באנר לחברת יבוא עם מוצרים על רקע מקצועי"' })}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> הוסף תמונות רפרנס (אופציונלי)
            </p>
            {imageRefPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {imageRefPhotos.map((url, i) => (
                  <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border">
                    <img src={url} alt={`ref ${i+1}`} className="w-full h-full object-cover" />
                    <button onClick={() => setImageRefPhotos(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {imageRefPhotos.length < 3 && (
              <FileUploadZone accept="image/*" label={`העלה תמונה (${imageRefPhotos.length}/3)`} hint="JPG, PNG — אווטאר, לוגו, מוצר"
                onUploaded={url => { if (url && imageRefPhotos.length < 3) setImageRefPhotos(prev => [...prev, url]); }} />
            )}
          </div>
          <button
            onClick={async () => {
              if (!prompt.trim()) { toast.error('יש להזין תיאור'); return; }
              setLoading(true);
              try {
                const data = await imageService.generate(buildPrompt(prompt), imageRefPhotos.length > 0 ? imageRefPhotos : undefined);
                setResult({ imageUrl: data.imageUrl });
                setEditHistory([{ imageUrl: data.imageUrl, prompt }]);
                setStep(step + 1);
                toast.success('התמונה נוצרה!');
              } catch (e: any) { toast.error(e.message); }
              finally { setLoading(false); }
            }}
            disabled={loading}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? 'מייצר...' : 'צור תמונה'}
          </button>
        </div>
      );
      if (wizardStep === 1 && result?.imageUrl) return renderImageResultWithEdit();
    }

    // ====== VIDEO AI ======
    if (selectedAction === 'video_ai') {
      if (wizardStep === 0) return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setRunwayMode('image_to_video')}
              className={cn('p-4 rounded-xl border text-center transition-all', runwayMode === 'image_to_video' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30')}>
              <span className="text-2xl block mb-1">🖼️</span>
              <span className="text-sm font-medium">תמונה → וידאו</span>
            </button>
            <button onClick={() => setRunwayMode('text_to_video')}
              className={cn('p-4 rounded-xl border text-center transition-all', runwayMode === 'text_to_video' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30')}>
              <span className="text-2xl block mb-1">✍️</span>
              <span className="text-sm font-medium">טקסט → וידאו</span>
            </button>
          </div>
          {runwayMode === 'image_to_video' && (
            <div className="space-y-3">
              <FileUploadZone accept="image/*" label="העלה תמונה" hint="JPG, PNG, WebP" onUploaded={url => setRunwayImageUrl(url)} />
              <UrlImportInput onSubmit={url => setRunwayImageUrl(url)} placeholder="הדבק קישור לתמונה..." />
            </div>
          )}
          <button onClick={() => setStep(step + 1)}
            disabled={runwayMode === 'image_to_video' && !runwayImageUrl}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm disabled:opacity-50">
            המשך <ArrowRight className="w-4 h-4 inline mr-1 rotate-180" />
          </button>
        </div>
      );
      if (wizardStep === 1) return (
        <div className="space-y-4">
          {renderPromptInput({ placeholder: 'תאר את הסרטון... למשל: "מוצר מסתובב על רקע לבן עם תאורה רכה"' })}
          <button
            onClick={async () => {
              if (!prompt.trim()) { toast.error('יש להזין תיאור'); return; }
              setLoading(true);
              try {
                let taskData;
                if (runwayMode === 'image_to_video') {
                  taskData = await runwayService.imageToVideo(runwayImageUrl, buildPrompt(prompt));
                } else {
                  taskData = await runwayService.textToVideo(buildPrompt(prompt));
                }
                toast.success('הסרטון בהכנה...');
                setRunwayPolling(true);
                setRunwayProgress(0);
                let attempts = 0;
                const poll = async () => {
                  try {
                    const status = await runwayService.checkStatus(taskData.taskId);
                    setRunwayProgress(status.progress * 100);
                    if (status.status === 'SUCCEEDED' && status.resultUrl) {
                      setResult({ videoUrl: status.resultUrl });
                      setRunwayPolling(false);
                      setStep(step + 1);
                      toast.success('הסרטון מוכן!');
                      return;
                    }
                    if (status.status === 'FAILED') { setRunwayPolling(false); toast.error(status.failureReason || 'שגיאה'); return; }
                    attempts++;
                    if (attempts < 120) setTimeout(poll, 5000);
                    else { setRunwayPolling(false); toast.error('תם הזמן'); }
                  } catch { setRunwayPolling(false); toast.error('שגיאה'); }
                };
                poll();
              } catch (e: any) { toast.error(e.message); }
              finally { setLoading(false); }
            }}
            disabled={loading || runwayPolling}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {(loading || runwayPolling) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {runwayPolling ? `מייצר... ${Math.round(runwayProgress)}%` : 'צור סרטון'}
          </button>
        </div>
      );
      if (wizardStep === 2 && result?.videoUrl) return renderResultView();
    }

    // ====== SUBTITLES ======
    if (selectedAction === 'subtitles') {
      if (wizardStep === 0) return (
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault(); setIsDragging(false);
              const file = e.dataTransfer.files[0];
              if (file && file.type.startsWith('video/')) { setVideoFile(file); setVideoPreviewUrl(URL.createObjectURL(file)); setStep(step + 1); }
              else toast.error('יש להעלות קובץ וידאו');
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setVideoFile(f); setVideoPreviewUrl(URL.createObjectURL(f)); setStep(step + 1); } }} />
            <Upload className={cn('w-10 h-10 mx-auto mb-3', isDragging ? 'text-primary' : 'text-muted-foreground')} />
            <p className="text-sm font-medium">גרור סרטון לכאן או לחץ לבחירה</p>
            <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM</p>
          </div>
        </div>
      );
      if (wizardStep === 1) return (
        <div className="space-y-4">
          {videoPreviewUrl && (
            <div className="rounded-xl overflow-hidden border border-border relative">
              <video ref={videoPreviewRef} src={videoPreviewUrl} controls className="w-full max-h-[200px]"
                onTimeUpdate={() => {
                  if (!videoPreviewRef.current) return;
                  const t = videoPreviewRef.current.currentTime;
                  const active = getAdjustedSegments().find(s => t >= s.start && t <= s.end);
                  setCurrentSubtitle(active?.text || '');
                }} />
              {showPreview && currentSubtitle && (
                <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none px-4">
                  <div className={cn('bg-background/85 text-foreground border border-border/70 px-4 py-2 rounded-lg text-sm font-medium max-w-[90%] text-center', subtitleFontClass)} dir="rtl">
                    {currentSubtitle}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 flex-wrap">
            <button onClick={async () => {
              if (!videoFile) return;
              setLoading(true);
              try {
                const ab = await videoFile.arrayBuffer();
                const bytes = new Uint8Array(ab);
                const chunkSize = 8192;
                let binary = '';
                for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
                const base64 = btoa(binary);
                const data = await subtitleService.transcribe(base64);
                setSubtitleSegments(data.segments);
                toast.success('התמלול מוכן!');
              } catch (e: any) { toast.error(e.message); }
              finally { setLoading(false); }
            }} disabled={loading}
              className="gradient-gold text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Subtitles className="w-4 h-4" />}
              {loading ? 'מתמלל...' : 'תמלל אוטומטית'}
            </button>
            {subtitleSegments.length > 0 && (
              <>
                <button onClick={() => setShowPreview(!showPreview)}
                  className={cn('px-4 py-2.5 border rounded-lg text-sm flex items-center gap-2', showPreview ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>
                  <Eye className="w-4 h-4" /> {showPreview ? 'הסתר' : 'תצוגה מקדימה'}
                </button>
                <button onClick={() => setStep(step + 1)} className="px-4 py-2.5 border border-primary/30 bg-primary/5 text-primary rounded-lg text-sm flex items-center gap-2 hover:bg-primary/10">
                  שמור / הורד <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
              </>
            )}
          </div>
          {subtitleSegments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card border border-border rounded-xl p-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-muted-foreground">פונט</label>
                <select value={subtitleFontClass} onChange={e => setSubtitleFontClass(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {subtitleFontOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-muted-foreground">השהיית כתוביות</label>
                  <span className="text-xs font-medium text-primary">{subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s</span>
                </div>
                <input type="range" min="-2" max="2" step="0.1" value={subtitleOffset} onChange={e => setSubtitleOffset(Number(e.target.value))} className="w-full accent-primary" />
              </div>
            </div>
          )}
          {subtitleSegments.length > 0 && (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {subtitleSegments.map((seg, i) => (
                <div key={i} className="flex items-start gap-3 bg-muted/30 rounded-lg p-3 border border-border/50">
                  <div className="text-xs text-muted-foreground whitespace-nowrap pt-2 min-w-[80px]">
                    {Math.max(0, seg.start + subtitleOffset).toFixed(1)}s — {Math.max(Math.max(0, seg.start + subtitleOffset) + 0.1, seg.end + subtitleOffset).toFixed(1)}s
                  </div>
                  <input value={seg.text} onChange={e => {
                    setSubtitleSegments(prev => prev.map((s, idx) => idx === i ? { ...s, text: e.target.value } : s));
                    setSavedSrtUrl(null);
                  }} onKeyDown={e => e.stopPropagation()} className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" dir="rtl" />
                </div>
              ))}
            </div>
          )}
        </div>
      );
      if (wizardStep === 2) return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={async () => {
                setSavingSrt(true);
                try {
                  const srt = subtitleService.toSRT(getAdjustedSegments());
                  const encoder = new TextEncoder();
                  const encoded = encoder.encode('\uFEFF' + srt);
                  let binaryStr = '';
                  const chunk = 8192;
                  for (let i = 0; i < encoded.length; i += chunk) binaryStr += String.fromCharCode(...encoded.slice(i, i + chunk));
                  const base64 = btoa(binaryStr);
                  const { data, error } = await supabase.functions.invoke("storage-manager", {
                    body: { action: "upload", fileName: `subtitles-${Date.now()}.srt`, fileType: "text/plain", fileBase64: base64 },
                  });
                  if (error || data?.error) throw new Error(data?.error || error?.message);
                  setSavedSrtUrl(data.publicUrl);
                  toast.success('נשמר!');
                } catch (e: any) { toast.error(e.message); }
                finally { setSavingSrt(false); }
              }}
              disabled={savingSrt}
              className={cn('p-4 rounded-xl border text-center transition-all', savedSrtUrl ? 'border-green-500 bg-green-500/10' : 'border-border hover:bg-muted')}
            >
              {savingSrt ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <Save className="w-5 h-5 mx-auto mb-1" />}
              <span className="text-sm font-medium block">{savedSrtUrl ? 'נשמר ✓' : 'שמור באחסון'}</span>
            </button>
            <button
              onClick={() => {
                const srt = subtitleService.toSRT(getAdjustedSegments());
                const blob = new Blob(['\uFEFF' + srt], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url; link.download = `subtitles-${Date.now()}.srt`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                URL.revokeObjectURL(url);
                toast.success('הורד!');
              }}
              className="p-4 rounded-xl border border-border hover:bg-muted text-center"
            >
              <Download className="w-5 h-5 mx-auto mb-1" />
              <span className="text-sm font-medium block">הורד SRT</span>
            </button>
          </div>
        </div>
      );
    }

    // ====== IMPORT & EDIT ======
    if (selectedAction === 'import_edit') {
      if (wizardStep === 0) return (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">הדבק קישור לתמונה, סרטון, או סרטון YouTube (נחלץ את התמונה הממוזערת)</p>
          <UrlImportInput onSubmit={url => {
            // Extract YouTube thumbnail
            const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
            if (ytMatch) {
              const videoId = ytMatch[1];
              const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
              setImportUrl(thumbnailUrl);
              setImportType('image');
              toast.success('תמונת YouTube חולצה בהצלחה!');
              setStep(step + 1);
              return;
            }
            // Block other social media pages
            const blocked = /^https?:\/\/(www\.)?(facebook\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com)/i;
            if (blocked.test(url)) {
              toast.error('יש להדביק קישור ישיר לתמונה או סרטון — לא קישור לאתר');
              return;
            }
            setImportUrl(url);
            const lower = url.toLowerCase();
            if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/)) {
              setImportType('image');
            } else if (lower.match(/\.(mp4|mov|webm|avi)(\?|$)/)) {
              setImportType('video');
            } else {
              setImportType('image');
            }
            setStep(step + 1);
          }} placeholder="הדבק קישור לתמונה, סרטון, או YouTube..." />
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /> או העלה קובץ <span className="h-px flex-1 bg-border" /></div>
          <FileUploadZone accept="image/*,video/*" label="העלה תמונה או סרטון" hint="JPG, PNG, MP4, WebP"
            onUploaded={url => {
              if (url) {
                setImportUrl(url);
                setImportType('image');
                setStep(step + 1);
              }
            }} />
        </div>
      );
      if (wizardStep === 1) return (
        <div className="space-y-4">
          {importUrl && importType === 'image' && (
            <div className="rounded-lg overflow-hidden border border-border bg-muted/30 max-h-[200px] flex items-center justify-center">
              <img src={importUrl} alt="מקור" className="max-h-[200px] object-contain" />
            </div>
          )}
          {importUrl && importType === 'video' && (
            <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
              <video src={importUrl} controls className="w-full max-h-[200px]" />
            </div>
          )}
          {renderPromptInput({ placeholder: 'תאר מה תרצה לשנות... למשל: "שנה את הצבעים למותג שלי", "הוסף כיתוב בעברית"' })}
          <button
            onClick={async () => {
              if (!prompt.trim()) { toast.error('יש להזין תיאור'); return; }
              setLoading(true);
              try {
                const data = await imageService.edit(buildPrompt(prompt), importUrl);
                setResult({ imageUrl: data.imageUrl });
                setEditHistory([{ imageUrl: data.imageUrl, prompt }]);
                setStep(step + 1);
                toast.success('העריכה הושלמה!');
              } catch (e: any) { toast.error(e.message); }
              finally { setLoading(false); }
            }}
            disabled={loading}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? 'עורך...' : 'ערוך'}
          </button>
        </div>
      );
      if (wizardStep === 2 && result?.imageUrl) return renderImageResultWithEdit();
    }

    return null;
  };

  const stepInfo = getStepInfo();
  const totalSteps = getTotalSteps();
  const currentStepNum = step + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="w-5 h-5 rotate-180" />
              </button>
            )}
            <div className="flex-1">
              <DialogTitle className="font-rubik text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                {stepInfo.title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{stepInfo.desc}</p>
            </div>
          </div>

          {selectedAction && (
            <div className="flex items-center gap-1.5 mt-3">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full flex-1 transition-all',
                    i < currentStepNum ? 'bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>
          )}

          {activeBrand && (
            <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <span className="text-primary">●</span> {activeBrand.name}
              {activeBrand.industry && <span className="text-muted-foreground/70">• {activeBrand.industry}</span>}
            </div>
          )}
        </DialogHeader>

        <div className="mt-2">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
