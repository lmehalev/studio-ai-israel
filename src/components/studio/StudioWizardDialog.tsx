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
import { projectService } from '@/services/projectService';
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
  activeBrandId: string | null;
  buildPrompt: (base: string) => string;
}

export function StudioWizardDialog({ open, onOpenChange, activeBrand, activeBrandId, buildPrompt }: StudioWizardDialogProps) {
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

  const MAX_REF_IMAGES = 7;

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

  // Avatar & Voice selection
  interface SavedAvatar { id: string; name: string; image_url: string; style: string; }
  interface SavedVoice { id: string; name: string; audioUrl: string; type: string; }
  const [availableAvatars, setAvailableAvatars] = useState<SavedAvatar[]>([]);
  const [availableVoices, setAvailableVoices] = useState<SavedVoice[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [showAvatarVoicePanel, setShowAvatarVoicePanel] = useState(false);

  // Load avatars & voices when dialog opens
  useEffect(() => {
    if (open) {
      avatarDbService.list().then(list => setAvailableAvatars(list)).catch(() => {});
      try {
        const voices = JSON.parse(localStorage.getItem('studio-voices') || '[]');
        setAvailableVoices(voices);
      } catch { setAvailableVoices([]); }
    }
  }, [open]);

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
        setSelectedAvatarId(null);
        setSelectedVoiceId(null);
        setShowAvatarVoicePanel(false);
      }, 300);
    }
  }, [open]);

  const selectedAvatar = availableAvatars.find(a => a.id === selectedAvatarId);
  const selectedVoice = availableVoices.find(v => v.id === selectedVoiceId);

  // ============ AVATAR & VOICE SELECTOR ============
  const renderAvatarVoiceSelector = () => {
    if (availableAvatars.length === 0 && availableVoices.length === 0) return null;
    return (
      <div className="border border-border rounded-xl overflow-hidden mb-4">
        <button
          onClick={() => setShowAvatarVoicePanel(!showAvatarVoicePanel)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <ChevronDown className={cn('w-4 h-4 transition-transform', showAvatarVoicePanel && 'rotate-180')} />
            <span>אווטאר וקול</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedAvatar && (
              <span className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                <img src={selectedAvatar.image_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                {selectedAvatar.name}
              </span>
            )}
            {selectedVoice && (
              <span className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                <Volume2 className="w-3 h-3" />
                {selectedVoice.name}
              </span>
            )}
          </div>
        </button>
        {showAvatarVoicePanel && (
          <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
            {availableAvatars.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5" /> בחר אווטאר
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSelectedAvatarId(null)}
                    className={cn('flex-shrink-0 w-14 h-14 rounded-lg border-2 flex items-center justify-center transition-all text-xs text-muted-foreground',
                      !selectedAvatarId ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30')}
                  >
                    ללא
                  </button>
                  {availableAvatars.map(avatar => (
                    <button
                      key={avatar.id}
                      onClick={() => setSelectedAvatarId(avatar.id === selectedAvatarId ? null : avatar.id)}
                      className={cn('flex-shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden transition-all',
                        selectedAvatarId === avatar.id ? 'border-primary shadow-gold' : 'border-border hover:border-primary/30')}
                      title={avatar.name}
                    >
                      <img src={avatar.image_url} alt={avatar.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                {selectedAvatar && <p className="text-xs text-primary mt-1">{selectedAvatar.name}</p>}
              </div>
            )}
            {availableVoices.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" /> בחר קול
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedVoiceId(null)}
                    className={cn('px-3 py-1.5 rounded-lg border text-xs transition-all',
                      !selectedVoiceId ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30 text-muted-foreground')}
                  >
                    ברירת מחדל
                  </button>
                  {availableVoices.map(voice => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoiceId(voice.id === selectedVoiceId ? null : voice.id)}
                      className={cn('px-3 py-1.5 rounded-lg border text-xs transition-all flex items-center gap-1.5',
                        selectedVoiceId === voice.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30 text-muted-foreground')}
                    >
                      <Volume2 className="w-3 h-3" />
                      {voice.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

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

    // Show avatar/voice selector on the first step of each action
    const avatarVoiceBar = wizardStep === 0 ? renderAvatarVoiceSelector() : null;

    // ====== IMAGE ======
    if (selectedAction === 'image') {
      if (wizardStep === 0) {
        // Build all reference images including avatar
        const allRefs = [
          ...(selectedAvatar ? [selectedAvatar.image_url] : []),
          ...imageRefPhotos,
        ];

        return (
          <div className="space-y-4">
            {avatarVoiceBar}
            {renderPromptInput({ placeholder: 'תאר את התמונה... למשל: "באנר לחברת יבוא עם מוצרים על רקע מקצועי"' })}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> תמונות רפרנס ({allRefs.length}/{MAX_REF_IMAGES})
              </p>
              {selectedAvatar && (
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                  <img src={selectedAvatar.image_url} alt="" className="w-8 h-8 rounded-full object-cover border border-primary/30" />
                  <span>אווטאר "{selectedAvatar.name}" ישמש כרפרנס בתמונה</span>
                </div>
              )}
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
              {allRefs.length < MAX_REF_IMAGES && (
                <FileUploadZone accept="image/*" multiple label={`העלה תמונות (${imageRefPhotos.length} נוספו)`} hint={`JPG, PNG — נשארו ${MAX_REF_IMAGES - allRefs.length} מקומות`}
                  onUploaded={url => { if (url && allRefs.length < MAX_REF_IMAGES) setImageRefPhotos(prev => [...prev, url]); }}
                  onMultipleUploaded={urls => { setImageRefPhotos(prev => [...prev, ...urls].slice(0, MAX_REF_IMAGES - (selectedAvatar ? 1 : 0))); }}
                />
              )}
            </div>
            <button
              onClick={async () => {
                if (!prompt.trim()) { toast.error('יש להזין תיאור'); return; }
                setLoading(true);
                try {
                  const refs = allRefs.length > 0 ? allRefs : undefined;
                  const avatarContext = selectedAvatar ? `\n\nIMPORTANT: Use the provided avatar/person reference image(s) — the person in the output MUST look exactly like the reference photos.` : '';
                  const data = await imageService.generate(buildPrompt(prompt) + avatarContext, refs);
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
      }
      if (wizardStep === 1 && result?.imageUrl) return renderImageResultWithEdit();
    }

    // ====== VIDEO AI ======
    if (selectedAction === 'video_ai') {
      if (wizardStep === 0) return (
        <div className="space-y-4">
          {avatarVoiceBar}
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
          {selectedAvatar && !runwayImageUrl && runwayMode === 'image_to_video' && (
            <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <img src={selectedAvatar.image_url} alt="" className="w-8 h-8 rounded-full object-cover border border-primary/30" />
              <div>
                <span>אווטאר "{selectedAvatar.name}" זמין כתמונת מקור</span>
                <button onClick={() => setRunwayImageUrl(selectedAvatar.image_url)} className="block text-primary font-semibold underline mt-0.5">השתמש באווטאר</button>
              </div>
            </div>
          )}
          {runwayMode === 'image_to_video' && (
            <div className="space-y-3">
              {runwayImageUrl && (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-primary/40">
                  <img src={runwayImageUrl} alt="מקור" className="w-full h-full object-cover" />
                  <button onClick={() => setRunwayImageUrl('')} className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {!runwayImageUrl && (
                <>
                  <FileUploadZone accept="image/*" label="העלה תמונה" hint="JPG, PNG, WebP" onUploaded={url => setRunwayImageUrl(url)} />
                  <UrlImportInput onSubmit={url => setRunwayImageUrl(url)} placeholder="הדבק קישור לתמונה..." />
                </>
              )}
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
          {avatarVoiceBar}
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
      // Collect all images: imported + avatar + extra uploads
      const importImages = importUrl ? [importUrl] : [];
      
      if (wizardStep === 0) return (
        <div className="space-y-4">
          {avatarVoiceBar}
          <p className="text-xs text-muted-foreground">הדבק קישור לתמונה, סרטון, או סרטון YouTube (נחלץ את התמונה הממוזערת)</p>
          <UrlImportInput onSubmit={url => {
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
            const blocked = /^https?:\/\/(www\.)?(facebook\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com)/i;
            if (blocked.test(url)) {
              toast.error('יש להדביק קישור ישיר לתמונה או סרטון — לא קישור לאתר');
              return;
            }
            setImportUrl(url);
            const lower = url.toLowerCase();
            if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/)) setImportType('image');
            else if (lower.match(/\.(mp4|mov|webm|avi)(\?|$)/)) setImportType('video');
            else setImportType('image');
            setStep(step + 1);
          }} placeholder="הדבק קישור לתמונה, סרטון, או YouTube..." />
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /> או העלה קבצים <span className="h-px flex-1 bg-border" /></div>
          <FileUploadZone accept="image/*,video/*" multiple label="העלה תמונות או סרטון" hint={`JPG, PNG, MP4 — עד ${MAX_REF_IMAGES} קבצים`}
            onUploaded={url => {
              if (url) { setImportUrl(url); setImportType('image'); setStep(step + 1); }
            }}
            onMultipleUploaded={urls => {
              if (urls.length > 0) {
                setImportUrl(urls[0]);
                setImportType('image');
                // Store extra images in imageRefPhotos for use in the edit step
                if (urls.length > 1) setImageRefPhotos(prev => [...prev, ...urls.slice(1)].slice(0, MAX_REF_IMAGES));
                setStep(step + 1);
              }
            }}
          />
          {selectedAvatar && (
            <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <img src={selectedAvatar.image_url} alt="" className="w-8 h-8 rounded-full object-cover border border-primary/30" />
              <span>אווטאר "{selectedAvatar.name}" יצורף אוטומטית כרפרנס</span>
            </div>
          )}
        </div>
      );
      if (wizardStep === 1) {
        const allEditRefs = [
          ...importImages,
          ...(selectedAvatar ? [selectedAvatar.image_url] : []),
          ...imageRefPhotos,
        ];

        return (
          <div className="space-y-4">
            {/* Show all reference images */}
            <div className="flex flex-wrap gap-2">
              {allEditRefs.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                  <img src={url} alt={`ref ${i+1}`} className="w-full h-full object-cover" />
                  {i === 0 && <div className="absolute bottom-0 inset-x-0 text-[8px] text-center bg-background/80 text-foreground py-0.5">ראשי</div>}
                </div>
              ))}
              {allEditRefs.length < MAX_REF_IMAGES && (
                <FileUploadZone accept="image/*" multiple label="+" hint=""
                  onUploaded={url => { if (url) setImageRefPhotos(prev => [...prev, url]); }}
                  onMultipleUploaded={urls => setImageRefPhotos(prev => [...prev, ...urls].slice(0, MAX_REF_IMAGES))}
                />
              )}
            </div>
            {renderPromptInput({ placeholder: 'תאר מה תרצה לשנות... למשל: "שנה את הצבעים למותג שלי", "הוסף כיתוב בעברית"' })}
            <button
              onClick={async () => {
                if (!prompt.trim()) { toast.error('יש להזין תיאור'); return; }
                setLoading(true);
                try {
                  const avatarContext = selectedAvatar ? `\n\nIMPORTANT: The avatar/person reference is included — preserve their exact likeness in the output.` : '';
                  const extraRefs = allEditRefs.length > 1 ? `\n\nAdditional reference images are provided (${allEditRefs.length} total). Use ALL of them as context.` : '';
                  const data = await imageService.edit(buildPrompt(prompt) + avatarContext + extraRefs, importUrl);
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
      }
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
