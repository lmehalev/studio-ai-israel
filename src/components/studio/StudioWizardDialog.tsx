import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowRight, Loader2, Download, Copy, RefreshCw,
  Play, Pause, Mic, MicOff, Upload, Eye, Save, Edit3,
  Subtitles, Check, X, Wand2, UserCircle, ChevronLeft,
  ImageIcon, Video, FileText, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSpeechToText } from '@/hooks/use-speech-to-text';
import {
  imageService, voiceService, didService, avatarGenService,
  promptEnhanceService, subtitleService, runwayService,
  type SubtitleSegment, type Brand,
} from '@/services/creativeService';
import { supabase } from '@/integrations/supabase/client';
import { FileUploadZone } from '@/components/FileUploadZone';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { UrlImportInput } from '@/components/UrlImportInput';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export type StudioAction = 'image' | 'edit_image' | 'avatar_video' | 'video_ai' | 'dubbing' | 'script' | 'subtitles';

const actionOptions: { id: StudioAction; label: string; icon: typeof ImageIcon; desc: string }[] = [
  { id: 'image', label: 'צור תמונה', icon: ImageIcon, desc: 'יצירת תמונה שיווקית מתיאור טקסט' },
  { id: 'edit_image', label: 'ערוך תמונה', icon: Wand2, desc: 'עריכת תמונה קיימת עם AI' },
  { id: 'avatar_video', label: 'סרטון עם אווטאר', icon: UserCircle, desc: 'צור דמות מדברת מתמונות שלך' },
  { id: 'video_ai', label: 'וידאו AI', icon: Video, desc: 'צור סרטון מתמונה או טקסט' },
  { id: 'dubbing', label: 'דיבוב / קול', icon: Mic, desc: 'המר טקסט לדיבור או הקלט קול' },
  { id: 'script', label: 'כתוב תסריט', icon: FileText, desc: 'תסריט שיווקי מקצועי עם AI' },
  { id: 'subtitles', label: 'כתוביות לסרטון', icon: Subtitles, desc: 'תמלול אוטומטי + עריכת כתוביות' },
];

const hebrewVoices = [
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'דניאל (גברי)' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'רייצ\'ל (נשי)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'בלה (נשי)' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'אנטוני (גברי)' },
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
  // Action selection
  const [selectedAction, setSelectedAction] = useState<StudioAction | null>(null);
  const [step, setStep] = useState(0); // 0 = action select, 1+ = wizard steps

  // Shared state
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imageUrl?: string; audioUrl?: string; videoUrl?: string } | null>(null);
  const [scriptResult, setScriptResult] = useState<string | null>(null);

  // Speech
  const { isListening, isSupported: speechSupported, toggle: toggleSpeech } = useSpeechToText({
    language: 'he-IL',
    onResult: (text) => setPrompt(prev => prev ? `${prev} ${text}` : text),
  });

  // Image edit
  const [editImageUrl, setEditImageUrl] = useState('');
  
  // Image generation - reference images & iterative editing
  const [imageRefPhotos, setImageRefPhotos] = useState<string[]>([]);
  const [editHistory, setEditHistory] = useState<{ imageUrl: string; prompt: string }[]>([]);
  const [editPrompt, setEditPrompt] = useState('');

  // Voice
  const [selectedVoice, setSelectedVoice] = useState(hebrewVoices[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Avatar
  const [avatarRefPhotos, setAvatarRefPhotos] = useState<string[]>([]);
  const [avatarStyle, setAvatarStyle] = useState('professional headshot');
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(null);
  const [avatarImageUrl, setAvatarImageUrl] = useState('');
  const [polling, setPolling] = useState(false);

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
        setScriptResult(null);
        setEditImageUrl('');
        setImageRefPhotos([]);
        setEditHistory([]);
        setEditPrompt('');
        setAvatarRefPhotos([]);
        setGeneratedAvatarUrl(null);
        setAvatarImageUrl('');
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

  // Poll D-ID
  const pollTalkStatus = useCallback(async (talkId: string) => {
    setPolling(true);
    let attempts = 0;
    const poll = async () => {
      try {
        const status = await didService.checkStatus(talkId);
        if (status.status === 'done' && status.resultUrl) {
          setResult({ videoUrl: status.resultUrl! });
          setPolling(false);
          setStep(step + 1);
          toast.success('הסרטון מוכן!');
          return;
        }
        if (status.status === 'error') { setPolling(false); toast.error('שגיאה'); return; }
        attempts++;
        if (attempts < 60) setTimeout(poll, 3000);
        else { setPolling(false); toast.error('תם הזמן'); }
      } catch { setPolling(false); toast.error('שגיאה בבדיקת סטטוס'); }
    };
    poll();
  }, [step]);

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

  // Get current step info
  const getStepInfo = () => {
    if (step === 0) return { title: 'מה תרצה ליצור?', desc: 'בחר את סוג התוכן שתרצה לייצר' };
    if (!selectedAction) return { title: '', desc: '' };

    const stepsMap: Record<StudioAction, { title: string; desc: string }[]> = {
      image: [
        { title: 'תאר את התמונה', desc: 'כתוב מה תרצה לראות בתמונה' },
        { title: 'התוצאה', desc: 'התמונה שנוצרה' },
      ],
      edit_image: [
        { title: 'בחר תמונה', desc: 'העלה או הדבק קישור לתמונה לעריכה' },
        { title: 'מה לשנות?', desc: 'תאר את השינויים שתרצה' },
        { title: 'התוצאה', desc: 'התמונה הערוכה' },
      ],
      avatar_video: [
        { title: 'צור אווטאר', desc: 'העלה תמונות של אדם ליצירת אווטאר' },
        { title: 'בחר קול', desc: 'איזה קול ידבר?' },
        { title: 'מה יגיד?', desc: 'כתוב את הטקסט או הקלט' },
        { title: 'הסרטון מוכן', desc: 'הסרטון שנוצר' },
      ],
      video_ai: [
        { title: 'סוג הסרטון', desc: 'איך תרצה ליצור?' },
        { title: 'תאר את הסרטון', desc: 'מה יקרה בסרטון?' },
        { title: 'הסרטון מוכן', desc: 'הסרטון שנוצר' },
      ],
      dubbing: [
        { title: 'הטקסט', desc: 'כתוב טקסט או הקלט קול' },
        { title: 'בחר קול', desc: 'איזה קול יקריא?' },
        { title: 'התוצאה', desc: 'הדיבוב מוכן' },
      ],
      script: [
        { title: 'תאר את המוצר', desc: 'ספר על המוצר או השירות' },
        { title: 'התסריט', desc: 'התסריט שנוצר' },
      ],
      subtitles: [
        { title: 'העלה סרטון', desc: 'בחר סרטון לתמלול' },
        { title: 'תמלול ועריכה', desc: 'ערוך את הכתוביות' },
        { title: 'שמירה', desc: 'שמור או הורד SRT' },
      ],
    };

    const steps = stepsMap[selectedAction];
    const idx = step - 1; // step 1 = first wizard step
    return steps[idx] || { title: '', desc: '' };
  };

  const getTotalSteps = () => {
    if (!selectedAction) return 1;
    const counts: Record<StudioAction, number> = {
      image: 2, edit_image: 3, avatar_video: 4, video_ai: 3,
      dubbing: 3, script: 2, subtitles: 3,
    };
    return counts[selectedAction] + 1; // +1 for action selection step
  };

  // ============ PROMPT INPUT WITH SPEECH ============
  const PromptInput = ({ placeholder, rows = 4 }: { placeholder: string; rows?: number }) => (
    <div className="relative">
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
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
  const ResultView = () => (
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
  const ImageResultWithEdit = () => (
    <div className="space-y-4">
      {/* Edit history */}
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

      {/* Current image */}
      {result?.imageUrl && (
        <div className="rounded-lg overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
          <img src={result.imageUrl} alt="תוצאה" className="max-w-full max-h-[250px] object-contain" />
        </div>
      )}

      {/* Action buttons */}
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

      {/* Iterative editing */}
      <div className="bg-muted/30 rounded-xl border border-border p-3 space-y-3">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Edit3 className="w-3.5 h-3.5" /> רוצה לשנות משהו? תאר מה לעדכן
        </p>
        <div className="relative">
          <textarea
            value={editPrompt}
            onChange={e => setEditPrompt(e.target.value)}
            placeholder='למשל: "שנה את הרקע לכחול", "הוסף לוגו למעלה", "הפוך את הטקסט לבולט יותר"'
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

    const wizardStep = step - 1; // convert to 0-based for wizard logic

    // ====== IMAGE ======
    if (selectedAction === 'image') {
      if (wizardStep === 0) return (
        <div className="space-y-4">
          <PromptInput placeholder='תאר את התמונה... למשל: "באנר לחברת יבוא עם מוצרים על רקע מקצועי"' />
          
          {/* Reference images */}
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
              <div className="flex gap-2">
                <FileUploadZone accept="image/*" label={`העלה תמונה (${imageRefPhotos.length}/3)`} hint="JPG, PNG — אווטאר, לוגו, מוצר"
                  onUploaded={url => { if (url && imageRefPhotos.length < 3) setImageRefPhotos(prev => [...prev, url]); }} />
              </div>
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
      if (wizardStep === 1 && result?.imageUrl) return <ImageResultWithEdit />;
    }

    // ====== EDIT IMAGE ======
    if (selectedAction === 'edit_image') {
      if (wizardStep === 0) return (
        <div className="space-y-3">
          <FileUploadZone accept="image/*" label="העלה תמונה לעריכה" hint="JPG, PNG, WebP" onUploaded={url => { setEditImageUrl(url); if (url) setStep(step + 1); }} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /> או הדבק קישור <span className="h-px flex-1 bg-border" /></div>
          <UrlImportInput onSubmit={url => { setEditImageUrl(url); if (url) setStep(step + 1); }} placeholder="הדבק קישור לתמונה..." />
        </div>
      );
      if (wizardStep === 1) return (
        <div className="space-y-4">
          {editImageUrl && (
            <div className="rounded-lg overflow-hidden border border-border bg-muted/30 max-h-[180px] flex items-center justify-center">
              <img src={editImageUrl} alt="תמונה מקורית" className="max-h-[180px] object-contain" />
            </div>
          )}
          <PromptInput placeholder='תאר מה לשנות... למשל: "שנה רקע לכחול, הוסף לוגו"' />
          <button
            onClick={async () => {
              if (!prompt.trim()) { toast.error('יש להזין תיאור'); return; }
              setLoading(true);
              try {
                const data = await imageService.edit(buildPrompt(prompt), editImageUrl);
                setResult({ imageUrl: data.imageUrl });
                setStep(step + 1);
                toast.success('התמונה נערכה!');
              } catch (e: any) { toast.error(e.message); }
              finally { setLoading(false); }
            }}
            disabled={loading}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? 'עורך...' : 'ערוך תמונה'}
          </button>
        </div>
      );
      if (wizardStep === 2 && result?.imageUrl) return <ResultView />;
    }

    // ====== AVATAR VIDEO ======
    if (selectedAction === 'avatar_video') {
      if (wizardStep === 0) return (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">העלה תמונות של אותו אדם — המערכת תייצר אווטאר מקצועי</p>
          {avatarRefPhotos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {avatarRefPhotos.map((url, i) => (
                <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border">
                  <img src={url} alt={`ref ${i+1}`} className="w-full h-full object-cover" />
                  <button onClick={() => setAvatarRefPhotos(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <FileUploadZone accept="image/*" label={`העלה תמונה (${avatarRefPhotos.length}/5)`} hint="JPG, PNG — עד 5 תמונות"
            onUploaded={url => { if (url && avatarRefPhotos.length < 5) setAvatarRefPhotos(prev => [...prev, url]); }} />
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">סגנון</label>
            <select value={avatarStyle} onChange={e => setAvatarStyle(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="professional headshot">פורטרט מקצועי</option>
              <option value="cinematic portrait with dramatic lighting">סינמטי דרמטי</option>
              <option value="friendly casual portrait, warm tones">ידידותי וחם</option>
              <option value="corporate business photo, clean background">תאגידי עסקי</option>
            </select>
          </div>
          <button
            onClick={async () => {
              if (avatarRefPhotos.length === 0) { toast.error('יש להעלות לפחות תמונה אחת'); return; }
              setGeneratingAvatar(true);
              try {
                const r = await avatarGenService.generate(avatarRefPhotos, avatarStyle);
                if (r.imageUrl) {
                  setGeneratedAvatarUrl(r.imageUrl);
                  setAvatarImageUrl(r.imageUrl);
                  toast.success('האווטאר נוצר!');
                  setStep(step + 1);
                } else toast.error('לא התקבלה תמונה');
              } catch (e: any) { toast.error(e.message); }
              finally { setGeneratingAvatar(false); }
            }}
            disabled={generatingAvatar || avatarRefPhotos.length === 0}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {generatingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCircle className="w-4 h-4" />}
            {generatingAvatar ? 'מייצר אווטאר...' : 'צור אווטאר'}
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /> או השתמש בתמונה ישירה <span className="h-px flex-1 bg-border" /></div>
          <FileUploadZone accept="image/*" label="העלה תמונת פנים" hint="JPG, PNG"
            onUploaded={url => { setAvatarImageUrl(url); if (url) setStep(step + 1); }} />
        </div>
      );
      if (wizardStep === 1) return (
        <div className="space-y-4">
          {(generatedAvatarUrl || avatarImageUrl) && (
            <div className="rounded-lg overflow-hidden border border-primary/30 bg-muted/30 max-h-[150px] flex items-center justify-center">
              <img src={generatedAvatarUrl || avatarImageUrl} alt="אווטאר" className="max-h-[150px] object-contain" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">בחר קול</label>
            <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              {hebrewVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <button onClick={() => setStep(step + 1)} className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm">
            המשך — כתוב טקסט <ArrowRight className="w-4 h-4 inline mr-1 rotate-180" />
          </button>
        </div>
      );
      if (wizardStep === 2) return (
        <div className="space-y-4">
          <PromptInput placeholder='מה הדמות תגיד? למשל: "שלום, אני מציג לכם את המוצר החדש..."' rows={5} />
          <button
            onClick={async () => {
              if (!prompt.trim()) { toast.error('יש להזין טקסט'); return; }
              setLoading(true);
              try {
                const imgUrl = generatedAvatarUrl || avatarImageUrl;
                const data = await didService.createTalk(imgUrl, prompt, selectedVoice);
                toast.success('הסרטון בהכנה...');
                pollTalkStatus(data.id);
              } catch (e: any) { toast.error(e.message); }
              finally { setLoading(false); }
            }}
            disabled={loading || polling}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {(loading || polling) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {polling ? 'מעבד סרטון...' : loading ? 'שולח...' : 'צור סרטון'}
          </button>
        </div>
      );
      if (wizardStep === 3 && result?.videoUrl) return <ResultView />;
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
          <PromptInput placeholder='תאר את הסרטון... למשל: "מוצר מסתובב על רקע לבן עם תאורה רכה"' />
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
      if (wizardStep === 2 && result?.videoUrl) return <ResultView />;
    }

    // ====== DUBBING ======
    if (selectedAction === 'dubbing') {
      if (wizardStep === 0) return (
        <div className="space-y-4">
          <PromptInput placeholder='הקלד טקסט לדיבוב... למשל: "ברוכים הבאים למרכז הישראלי לחברות"' rows={5} />
          <VoiceRecorder label="🎙️ הקלט את הקול שלך" onSaved={url => toast.success('ההקלטה נשמרה: ' + url)} />
          <FileUploadZone accept="audio/*" label="או העלה קובץ קול" hint="MP3, WAV, M4A"
            onUploaded={url => toast.success('קובץ הקול הועלה: ' + url)} />
          <button onClick={() => setStep(step + 1)} disabled={!prompt.trim()} className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm disabled:opacity-50">
            המשך — בחר קול <ArrowRight className="w-4 h-4 inline mr-1 rotate-180" />
          </button>
        </div>
      );
      if (wizardStep === 1) return (
        <div className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-3 border border-border text-sm" dir="rtl">{prompt}</div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">בחר קול</label>
            <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              {hebrewVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const audioUrl = await voiceService.generate(prompt, selectedVoice);
                setResult({ audioUrl });
                setStep(step + 1);
                toast.success('הקול נוצר!');
              } catch (e: any) { toast.error(e.message); }
              finally { setLoading(false); }
            }}
            disabled={loading}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            {loading ? 'מייצר...' : 'צור דיבוב'}
          </button>
        </div>
      );
      if (wizardStep === 2 && result?.audioUrl) return (
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
            <button onClick={() => {
              if (!audioRef.current) return;
              if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
              setIsPlaying(!isPlaying);
            }} className="w-12 h-12 gradient-gold text-primary-foreground rounded-full flex items-center justify-center shadow-lg">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 mr-[-2px]" />}
            </button>
            <audio ref={audioRef} src={result.audioUrl} onEnded={() => setIsPlaying(false)} controls className="flex-1" />
          </div>
          <button onClick={handleDownload} className="w-full px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> הורד MP3
          </button>
        </div>
      );
    }

    // ====== SCRIPT ======
    if (selectedAction === 'script') {
      if (wizardStep === 0) return (
        <div className="space-y-4">
          <PromptInput placeholder='תאר את המוצר/שירות... למשל: "שירות הערכות שווי לעסקים קטנים ובינוניים"' rows={6} />
          <button
            onClick={async () => {
              if (!prompt.trim()) { toast.error('יש להזין תיאור'); return; }
              setLoading(true);
              try {
                const data = await promptEnhanceService.enhance(buildPrompt(prompt), 'script');
                setScriptResult(data.enhanced || JSON.stringify(data, null, 2));
                setStep(step + 1);
                toast.success('התסריט מוכן!');
              } catch (e: any) { toast.error(e.message); }
              finally { setLoading(false); }
            }}
            disabled={loading}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? 'כותב...' : 'צור תסריט'}
          </button>
        </div>
      );
      if (wizardStep === 1 && scriptResult) return (
        <div className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4 border border-border whitespace-pre-wrap text-sm leading-relaxed max-h-[250px] overflow-y-auto" dir="rtl">
            {scriptResult}
          </div>
          <div className="flex gap-2">
            <button onClick={async () => { await navigator.clipboard.writeText(scriptResult); toast.success('הועתק'); }}
              className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
              <Copy className="w-4 h-4" /> העתק
            </button>
            <button onClick={() => { onOpenChange(false); toast.info('התסריט הועתק ללוח'); navigator.clipboard.writeText(scriptResult); }}
              className="flex-1 px-4 py-2.5 border border-primary/30 bg-primary/5 rounded-lg text-sm text-primary hover:bg-primary/10 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> סיום
            </button>
          </div>
        </div>
      );
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
                  }} className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" dir="rtl" />
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

          {/* Progress indicator */}
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

          {/* Active brand indicator */}
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
