import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowRight, Loader2, Download, Copy, RefreshCw, Plus,
  Play, Pause, Mic, MicOff, Upload, Eye, Save, Edit3,
  Subtitles, Check, X, Wand2, UserCircle, ChevronLeft,
  ImageIcon, Video, FileText, Sparkles, Link2, Volume2, ChevronDown, Scissors
} from 'lucide-react';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSpeechToText } from '@/hooks/use-speech-to-text';
import {
  imageService, voiceService, didService, avatarGenService,
  promptEnhanceService, subtitleService, runwayService,
  avatarDbService, storageService, composeService, soundEffectService,
  type SubtitleSegment, type Brand, brandService,
} from '@/services/creativeService';
import { projectService } from '@/services/projectService';
import { supabase } from '@/integrations/supabase/client';
import { FileUploadZone } from '@/components/FileUploadZone';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { UrlImportInput } from '@/components/UrlImportInput';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { VideoWizardFlow, type VideoWizardSession } from '@/components/studio/VideoWizardFlow';
import { SubtitleEditor } from '@/components/studio/SubtitleEditor';

export type StudioAction = 'image' | 'video_ai' | 'subtitles' | 'import_edit' | 'highlight';

const actionOptions: { id: StudioAction; label: string; icon: typeof ImageIcon; desc: string }[] = [
  { id: 'image', label: 'צור תמונה', icon: ImageIcon, desc: 'יצירת תמונה שיווקית מתיאור טקסט' },
  { id: 'video_ai', label: 'וידאו AI', icon: Video, desc: 'צור סרטון מתמונה או טקסט' },
  { id: 'subtitles', label: 'כתוביות לסרטון', icon: Subtitles, desc: 'תמלול אוטומטי + עריכת כתוביות' },
  { id: 'import_edit', label: 'ייבוא ועריכה', icon: Link2, desc: 'קישור לתמונה, סרטון או YouTube — חלץ וערוך' },
  { id: 'highlight', label: 'סרטון קצר מתוכן ארוך', icon: Scissors, desc: 'העלה סרטונים ותמונות — קבל סרטון ויראלי 30-60 שניות' },
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
  initialCategory?: string;
}

export function StudioWizardDialog({ open, onOpenChange, activeBrand, activeBrandId, buildPrompt, initialCategory = '' }: StudioWizardDialogProps) {
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

  // Highlight (long → short/long edited video)
  const [highlightFiles, setHighlightFiles] = useState<string[]>([]);
  const [highlightProgress, setHighlightProgress] = useState(0);
  const [highlightStage, setHighlightStage] = useState('');
  const [highlightOutputType, setHighlightOutputType] = useState<string>('viral_short');
  interface SavedAvatar { id: string; name: string; image_url: string; style: string; }
  interface SavedVoice { id: string; name: string; audio_url: string; type: string; }
  const [availableAvatars, setAvailableAvatars] = useState<SavedAvatar[]>([]);
  const [availableVoices, setAvailableVoices] = useState<SavedVoice[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [showAvatarVoicePanel, setShowAvatarVoicePanel] = useState(false);
  const [savingOutput, setSavingOutput] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('');

  const brandDepartments = activeBrand?.departments || [];
  const effectiveCategory = customCategory.trim() || selectedCategory;

  // Inline brand selector state (for result view when no brand pre-selected)
  const [inlineBrandId, setInlineBrandId] = useState<string | null>(null);
  const [inlineNewBrandName, setInlineNewBrandName] = useState('');
  const brands = brandService.getAll();

  const handleSaveToProject = async () => {
    const brandId = activeBrandId || inlineBrandId;
    const brandObj = activeBrand || brands.find(b => b.id === inlineBrandId);
    if (!brandId || !brandObj) {
      toast.error('יש לבחור חברה / מותג לפני השמירה');
      return;
    }
    if (brandDepartments.length > 0 && !effectiveCategory) {
      toast.error('יש לבחור או להזין תת-פעילות לפני השמירה');
      return;
    }
    const url = result?.imageUrl || result?.videoUrl;
    if (!url) return;

    setSavingOutput(true);
    try {
      // Upload base64 data URLs to storage first
      let finalUrl = url;
      if (url.startsWith('data:')) {
        toast.info('מעלה קובץ לאחסון...');
        const blob = await fetch(url).then(r => r.blob());
        const ext = url.includes('png') ? 'png' : 'jpg';
        const file = new File([blob], `output-${Date.now()}.${ext}`, { type: blob.type });
        finalUrl = await storageService.upload(file);
      }

      const cat = effectiveCategory || undefined;
      const project = await projectService.findOrCreateByBrand(brandId, brandObj.name, cat);
      const isVideo = !!result?.videoUrl;
      await projectService.addOutput(project.id, {
        name: `${selectedAction === 'image' ? 'תמונה' : selectedAction === 'video_ai' ? 'סרטון' : 'תוצר'} — ${brandObj.name}${cat ? ` — ${cat}` : ''}`,
        description: prompt || undefined,
        video_url: isVideo ? finalUrl : null,
        thumbnail_url: !isVideo ? finalUrl : null,
        prompt: prompt || null,
      });
      toast.success(`נשמר בפרויקט "${brandObj.name}${cat ? ` — ${cat}` : ''}"!`);
      clearSession();
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בשמירה');
    } finally {
      setSavingOutput(false);
    }
  };

  // Load avatars & voices when dialog opens
  useEffect(() => {
    if (open) {
      avatarDbService.list().then(list => setAvailableAvatars(list)).catch(() => {});
      supabase.functions.invoke('voice-manager', { body: { action: 'list' } })
        .then(({ data }) => {
          if (data?.voices) setAvailableVoices(data.voices);
        })
        .catch(() => {});
    }
  }, [open]);

  // Sync selected category from current project context
  useEffect(() => {
    if (!open) return;
    setSelectedCategory(initialCategory || '');
    setCustomCategory('');
  }, [open, initialCategory]);

  // Session persistence key
  const SESSION_KEY = 'studio_wizard_session';

  // Video wizard sub-session (stored separately due to size)
  const VIDEO_SESSION_KEY = 'studio_video_wizard_session';
  const [videoWizardSession, setVideoWizardSession] = useState<VideoWizardSession | null>(null);

  // Save session to localStorage on meaningful state changes
  useEffect(() => {
    if (!open) return;
    if (step === 0 && !selectedAction) return; // Don't save initial state
    const session = {
      selectedAction, step, prompt, result, imageRefPhotos, editHistory, editPrompt,
      importUrl, importType, selectedAvatarId, selectedVoiceId,
      selectedCategory, customCategory, highlightFiles, highlightOutputType,
      timestamp: Date.now(),
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {
      // localStorage might be full — try removing large data URLs
      try {
        const lite = { ...session, result: null, imageRefPhotos: [], editHistory: [] };
        localStorage.setItem(SESSION_KEY, JSON.stringify(lite));
      } catch {}
    }
  }, [open, selectedAction, step, prompt, result, imageRefPhotos, editHistory, editPrompt, importUrl, importType, selectedAvatarId, selectedVoiceId, selectedCategory, customCategory, highlightFiles, highlightOutputType]);

  // Restore session when dialog opens
  const [sessionRestoreOffered, setSessionRestoreOffered] = useState(false);
  const [hasPendingSession, setHasPendingSession] = useState(false);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      // Only offer restore if session is less than 24h old and has content
      if (Date.now() - session.timestamp > 86400000) { localStorage.removeItem(SESSION_KEY); return; }
      if (session.selectedAction || session.prompt || session.result) {
        setHasPendingSession(true);
      }
    } catch { localStorage.removeItem(SESSION_KEY); }
  }, [open]);

  const restoreSession = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.selectedAction) setSelectedAction(s.selectedAction);
      if (s.step) setStep(s.step);
      if (s.prompt) setPrompt(s.prompt);
      if (s.result) setResult(s.result);
      if (s.imageRefPhotos) setImageRefPhotos(s.imageRefPhotos);
      if (s.editHistory) setEditHistory(s.editHistory);
      if (s.editPrompt) setEditPrompt(s.editPrompt);
      if (s.importUrl) setImportUrl(s.importUrl);
      if (s.importType) setImportType(s.importType);
      if (s.selectedAvatarId) setSelectedAvatarId(s.selectedAvatarId);
      if (s.selectedVoiceId) setSelectedVoiceId(s.selectedVoiceId);
      if (s.selectedCategory) setSelectedCategory(s.selectedCategory);
      if (s.customCategory) setCustomCategory(s.customCategory);
      if (s.highlightFiles) setHighlightFiles(s.highlightFiles);
      if (s.highlightOutputType) setHighlightOutputType(s.highlightOutputType);
      // Restore video wizard sub-session
      if (s.selectedAction === 'video_ai') {
        try {
          const videoRaw = localStorage.getItem(VIDEO_SESSION_KEY);
          if (videoRaw) setVideoWizardSession(JSON.parse(videoRaw));
        } catch {}
      }
      toast.success('הסשן שוחזר בהצלחה!');
    } catch {}
    setHasPendingSession(false);
    setSessionRestoreOffered(true);
  };

  const dismissSession = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(VIDEO_SESSION_KEY);
    setVideoWizardSession(null);
    setHasPendingSession(false);
    setSessionRestoreOffered(true);
  };

  const clearSession = () => {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    try { localStorage.removeItem(VIDEO_SESSION_KEY); } catch {}
    setVideoWizardSession(null);
  };

  // Reset when dialog closes — but don't clear session (only clear on explicit "start fresh")
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
        setSelectedCategory('');
        setCustomCategory('');
        setSessionRestoreOffered(false);
        setHasPendingSession(false);
        setHighlightFiles([]);
        setHighlightProgress(0);
        setHighlightStage('');
        setHighlightOutputType('viral_short');
        setVideoWizardSession(null);
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
        { title: 'יצירת סרטון מקצועי', desc: 'תאר, בחר אווטארים וקולות, אשר תסריט ותייצר' },
      ],
      subtitles: [
        { title: 'כתוביות וסטודיו', desc: 'תמלול, עיצוב, מוזיקה והרכבה' },
      ],
      import_edit: [
        { title: 'הדבק קישור', desc: 'שים קישור לתמונה או סרטון' },
        { title: 'מה לשנות?', desc: 'תאר את השינויים שתרצה' },
        { title: 'התוצאה', desc: 'התוצאה הערוכה' },
      ],
      highlight: [
        { title: 'העלה תוכן', desc: 'העלה סרטונים ותמונות מהתוכן שלך' },
        { title: 'הגדר את הפלט', desc: 'בחר סוג סרטון ותאר מה אתה רוצה' },
        { title: 'מעבד...', desc: 'חותך, מרכיב ומעצב את התוצר' },
        { title: 'התוצאה', desc: 'התוצר שלך מוכן' },
      ],
    };

    const steps = stepsMap[selectedAction];
    const idx = step - 1;
    return steps[idx] || { title: '', desc: '' };
  };

  const getTotalSteps = () => {
    if (!selectedAction) return 1;
    const counts: Record<StudioAction, number> = {
      image: 2, video_ai: 1, subtitles: 1, import_edit: 3, highlight: 4,
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

  const renderCategorySelector = () => (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-muted-foreground">תת-פעילות / קטגוריה לפרויקט</label>
      {brandDepartments.length > 0 && (
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          dir="rtl"
        >
          <option value="">בחר תת-פעילות...</option>
          {brandDepartments.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      )}
      <input
        value={customCategory}
        onChange={e => setCustomCategory(e.target.value)}
        placeholder="או כתוב תת-פעילות חדשה (למשל: הערכת שווי)"
        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        dir="rtl"
      />
    </div>
  );

  // Helper: delete a single history item
  const handleDeleteHistoryItem = (index: number) => {
    setEditHistory(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // If current result was deleted, switch to last remaining or clear
      if (prev[index]?.imageUrl === result?.imageUrl) {
        if (updated.length > 0) setResult({ imageUrl: updated[updated.length - 1].imageUrl });
        else { setResult(null); setStep(step > 1 ? step - 1 : 0); }
      }
      return updated;
    });
    toast.success('הפריט נמחק מההיסטוריה');
  };


  // Helper: render inline brand selector for result view (when no brand selected)

  const effectiveBrandId = activeBrandId || inlineBrandId;
  const effectiveBrandObj = activeBrand || brands.find(b => b.id === inlineBrandId);

  const renderInlineBrandSelector = () => {
    if (activeBrand) return renderCategorySelector();
    return (
      <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
        <label className="block text-xs font-medium text-muted-foreground">שם חברה / מותג (לשמירה)</label>
        <select
          value={inlineBrandId || ''}
          onChange={e => setInlineBrandId(e.target.value || null)}
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          dir="rtl"
        >
          <option value="">בחר חברה...</option>
          {brands.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            value={inlineNewBrandName}
            onChange={e => setInlineNewBrandName(e.target.value)}
            placeholder="או הוסף חברה חדשה..."
            className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            dir="rtl"
          />
          {inlineNewBrandName.trim() && (
            <button onClick={() => {
              const brand: Brand = {
                id: crypto.randomUUID(), name: inlineNewBrandName.trim(),
                tone: '', targetAudience: '', industry: '', colors: [], departments: [],
              };
              brandService.add(brand);
              setInlineBrandId(brand.id);
              setInlineNewBrandName('');
              toast.success(`"${brand.name}" נוצר`);
            }} className="px-3 py-2 gradient-gold text-primary-foreground rounded-lg text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };


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
      {renderInlineBrandSelector()}
      <div className="flex gap-2">
        <button onClick={handleDownload} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> הורד
        </button>
        <button onClick={handleSaveToProject} disabled={savingOutput}
          className="flex-1 px-4 py-2.5 gradient-gold text-primary-foreground rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          {savingOutput ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {savingOutput ? 'שומר...' : 'שמור'}
        </button>
      </div>
      <button onClick={() => { clearSession(); setResult(null); setSelectedAction(null); setStep(0); setPrompt(''); setEditHistory([]); setEditPrompt(''); setImageRefPhotos([]); setSelectedCategory(initialCategory || ''); setCustomCategory(''); }}
        className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-2">
        <RefreshCw className="w-3.5 h-3.5" /> התחל מחדש
      </button>
    </div>
  );

  // ============ IMAGE RESULT WITH ITERATIVE EDITING ============
  const renderImageResultWithEdit = () => (
    <div className="space-y-4">
      {editHistory.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {editHistory.map((h, i) => (
            <div key={i} className="relative group flex-shrink-0">
              <button onClick={() => setResult({ imageUrl: h.imageUrl })}
                className={cn('w-16 h-16 rounded-lg overflow-hidden border-2 transition-all',
                  result?.imageUrl === h.imageUrl ? 'border-primary shadow-gold' : 'border-border/50 opacity-60 hover:opacity-100')}>
                <img src={h.imageUrl} alt={`גרסה ${i + 1}`} className="w-full h-full object-cover" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteHistoryItem(i); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="מחק"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {result?.imageUrl && (
        <div className="rounded-lg overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
          <img src={result.imageUrl} alt="תוצאה" className="max-w-full max-h-[250px] object-contain" />
        </div>
      )}
      {renderInlineBrandSelector()}
      <div className="flex gap-2">
        <button onClick={handleDownload} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> הורד
        </button>
        <button onClick={handleSaveToProject} disabled={savingOutput}
          className="flex-1 px-3 py-2 gradient-gold text-primary-foreground rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          {savingOutput ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {savingOutput ? 'שומר...' : 'שמור'}
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
      <button onClick={() => { clearSession(); setResult(null); setSelectedAction(null); setStep(0); setPrompt(''); setEditHistory([]); setEditPrompt(''); setImageRefPhotos([]); }}
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
          {hasPendingSession && !sessionRestoreOffered && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4 text-primary" />
                <span className="text-foreground font-medium">יש לך עבודה שלא נשמרה</span>
              </div>
              <div className="flex gap-1.5">
                <button onClick={restoreSession} className="px-3 py-1.5 gradient-gold text-primary-foreground rounded-lg text-xs font-semibold">שחזר</button>
                <button onClick={dismissSession} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted">התעלם</button>
              </div>
            </div>
          )}
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
      return (
        <VideoWizardFlow
          avatars={availableAvatars}
          voices={availableVoices}
          activeBrand={activeBrand}
          activeBrandId={activeBrandId}
          buildPrompt={buildPrompt}
          initialCategory={initialCategory}
          brandDepartments={brandDepartments}
          onBack={() => { setSelectedAction(null); setStep(0); setVideoWizardSession(null); }}
          onClose={() => onOpenChange(false)}
          restoredSession={videoWizardSession}
          onSessionChange={(session) => {
            setVideoWizardSession(session);
            try { localStorage.setItem(VIDEO_SESSION_KEY, JSON.stringify(session)); } catch {}
          }}
        />
      );
    }

    // ====== SUBTITLES ======
    if (selectedAction === 'subtitles') {
      return (
        <SubtitleEditor
          activeBrand={activeBrand}
          onBack={() => { setSelectedAction(null); setStep(0); }}
        />
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

    // ====== HIGHLIGHT (Long → Short Viral) ======
    if (selectedAction === 'highlight') {
      if (wizardStep === 0) return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">העלה סרטונים ו/או תמונות — המערכת תייצר ממנו סרטון קצר, קולע וויראלי (30-60 שניות)</p>
          <FileUploadZone
            accept="video/*,image/*"
            multiple
            label="העלה סרטונים ותמונות"
            hint="MP4, MOV, JPG, PNG — עד 20 קבצים, ללא הגבלת אורך"
            onUploaded={url => { if (url) setHighlightFiles(prev => [...prev, url]); }}
            onMultipleUploaded={urls => setHighlightFiles(prev => [...prev, ...urls])}
          />
          {highlightFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{highlightFiles.length} קבצים הועלו</p>
              <div className="flex flex-wrap gap-2">
                {highlightFiles.map((url, i) => (
                  <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border">
                    {url.match(/\.(mp4|mov|webm)/i) ? (
                      <video src={url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    )}
                    <button onClick={() => setHighlightFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => {
              if (highlightFiles.length === 0) { toast.error('יש להעלות לפחות קובץ אחד'); return; }
              setStep(step + 1);
            }}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
          >
            המשך <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      );

      if (wizardStep === 1) {
        const outputTypes = [
          { id: 'viral_short', label: 'סרטון ויראלי קצר', desc: '30-60 שניות, Hook + CTA, מוזיקה טרנדית', icon: '🔥' },
          { id: 'highlight_reel', label: 'Highlight Reel', desc: '1-3 דקות, הרגעים הכי טובים מהתוכן', icon: '⭐' },
          { id: 'podcast_edit', label: 'עריכת פודקאסט', desc: 'ניקוי, חיתוך שקטים, תוצאה מקצועית לשעה+', icon: '🎙️' },
          { id: 'trailer', label: 'טריילר / פרומו', desc: '15-45 שניות, קצב מהיר, מותאם לרשתות', icon: '🎬' },
          { id: 'tutorial_cut', label: 'סרטון הדרכה ערוך', desc: 'חיתוך חכם, כותרות, מבנה ברור', icon: '📚' },
          { id: 'custom', label: 'מותאם אישית', desc: 'תגדיר בדיוק מה אתה צריך', icon: '✨' },
        ];

        return (
          <div className="space-y-4">
            {renderAvatarVoiceSelector()}

            {/* Output type selector */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">בחר סוג פלט</p>
              <div className="grid grid-cols-2 gap-2">
                {outputTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setHighlightOutputType(type.id)}
                    className={cn(
                      'text-right p-3 rounded-lg border transition-all text-xs',
                      highlightOutputType === type.id
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/30 bg-card'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>{type.icon}</span>
                      <span className="font-semibold">{type.label}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{type.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt with voice dictation */}
            {renderPromptInput({ placeholder: highlightOutputType === 'podcast_edit'
              ? 'תאר איך אתה רוצה שהפודקאסט ייראה...\n\nלמשל: "פודקאסט של שעה, תנקה שקטים, תוסיף אינטרו ואאוטרו מקצועיים, כתוביות בעברית"'
              : highlightOutputType === 'custom'
              ? 'תאר בדיוק מה אתה צריך — אורך, סגנון, מבנה, הכל...'
              : 'תאר מה אתה רוצה שייצא מהתוכן שלך...\n\nלמשל: "סרטון אנרגטי עם Hook חזק, מוזיקה טרנדית, ו-CTA בסוף"',
              rows: 4 })}

            {/* Tips per output type */}
            <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">💡 טיפים:</p>
              {highlightOutputType === 'viral_short' && <>
                <p>• אורך: 30-60 שניות, Hook ב-3 השניות הראשונות</p>
                <p>• מוזיקה ויראלית תתווסף אוטומטית מהטרנדים</p>
                <p>• CTA בסוף — מה אתה רוצה שהצופה יעשה?</p>
              </>}
              {highlightOutputType === 'highlight_reel' && <>
                <p>• המערכת תבחר את הרגעים הכי מעניינים</p>
                <p>• ציין אם יש רגעים ספציפיים שחשוב לכלול</p>
                <p>• מעברים חלקים בין קטעים</p>
              </>}
              {highlightOutputType === 'podcast_edit' && <>
                <p>• ניקוי שקטים ארוכים אוטומטי</p>
                <p>• ציין אם צריך אינטרו/אאוטרו</p>
                <p>• כתוביות בעברית יתווספו אוטומטית</p>
                <p>• מתאים לפודקאסטים של 30 דקות עד שעה+</p>
              </>}
              {highlightOutputType === 'trailer' && <>
                <p>• 15-45 שניות בקצב מהיר</p>
                <p>• טקסטים דינמיים על המסך</p>
                <p>• מותאם לרשתות חברתיות</p>
              </>}
              {highlightOutputType === 'tutorial_cut' && <>
                <p>• חיתוך חכם — מסיר חלקים לא רלוונטיים</p>
                <p>• כותרות וחלוקה לפרקים</p>
                <p>• מבנה ברור וקל לעקוב</p>
              </>}
              {highlightOutputType === 'custom' && <>
                <p>• תאר בדיוק את האורך, הסגנון והמבנה</p>
                <p>• המערכת תתאים את העיבוד לפי הבקשה שלך</p>
              </>}
            </div>

            <button
              onClick={async () => {
                if (!prompt.trim()) { toast.error('יש לתאר את הסרטון הרצוי'); return; }
                setStep(step + 1);
                setLoading(true);
                setHighlightProgress(0);
                setHighlightStage('מנתח תוכן...');
                try {
                  setHighlightProgress(10);
                  setHighlightStage('מייצר תסריט...');

                  const trendData = await supabase.from('saved_trends').select('*').limit(5);
                  const trendKnowledge = trendData.data?.map(t => `${t.title}: ${t.tip}`).join('\n') || '';

                  const outputLabel = outputTypes.find(t => t.id === highlightOutputType)?.label || 'סרטון';
                  const { data: scriptData } = await supabase.functions.invoke('generate-script', {
                    body: {
                      prompt: `צור תסריט ל${outputLabel} מתוכן קיים.
סוג פלט: ${highlightOutputType}
הנחיות המשתמש: ${prompt}
${trendKnowledge ? `\nטרנדים חזקים כיום:\n${trendKnowledge}` : ''}
${activeBrand ? `\nמותג: ${activeBrand.name}, תעשייה: ${activeBrand.industry || 'כללי'}` : ''}

${highlightOutputType === 'viral_short' ? 'הפק 3-6 סצנות קצרות (5-10 שניות כל אחת), Hook חזק בפתיחה ו-CTA בסיום.' :
  highlightOutputType === 'podcast_edit' ? 'ארגן את התוכן לפרקים ברורים עם אינטרו ואאוטרו מקצועיים.' :
  highlightOutputType === 'highlight_reel' ? 'בחר 6-12 רגעים מרכזיים מהתוכן, כל אחד 10-15 שניות, עם מעברים חלקים.' :
  highlightOutputType === 'trailer' ? 'הפק 4-8 קטעים קצרצרים (2-5 שניות) בקצב מהיר עם טקסטים דינמיים.' :
  highlightOutputType === 'tutorial_cut' ? 'חלק את התוכן לפרקים עם כותרות ברורות ומבנה לוגי.' :
  'התאם את התסריט בדיוק לפי הנחיות המשתמש.'}`,
                      type: 'cinematic',
                    },
                  });

                setHighlightProgress(30);
                setHighlightStage('מכין קריינות...');

                // Step 2: Generate narration
                const narrationText = scriptData?.script?.scenes?.map((s: any) => s.narration || s.description || '').filter(Boolean).join('. ') || prompt;
                let audioUrl = '';
                try {
                  const selectedVoice = availableVoices.find(v => v.id === selectedVoiceId);
                  if (selectedVoice?.audio_url) {
                    const { data: cloneData } = await supabase.functions.invoke('clone-voice-tts', {
                      body: { audioUrl: selectedVoice.audio_url, scriptText: narrationText.slice(0, 4500) },
                    });
                    audioUrl = cloneData?.audioUrl || '';
                  } else {
                    audioUrl = await voiceService.generateAndUpload(narrationText.slice(0, 4500));
                  }
                } catch { /* continue without narration */ }

                setHighlightProgress(50);
                setHighlightStage('מייצר סרטון...');

                // Step 3: Use the uploaded files as base clips and compose
                const videoFiles = highlightFiles.filter(f => f.match(/\.(mp4|mov|webm)/i));
                const imageFiles = highlightFiles.filter(f => !f.match(/\.(mp4|mov|webm)/i));

                // Use first video or generate from images
                let baseVideoUrl = videoFiles[0] || '';
                if (!baseVideoUrl && imageFiles.length > 0) {
                  // Generate video from first image
                  const { data: rvData } = await supabase.functions.invoke('runway-video', {
                    body: { action: 'image_to_video', promptImage: imageFiles[0], promptText: prompt.slice(0, 500), duration: 10 },
                  });
                  if (rvData?.taskId) {
                    // Poll for result
                    for (let i = 0; i < 60; i++) {
                      await new Promise(r => setTimeout(r, 5000));
                      setHighlightProgress(50 + Math.min(20, i));
                      const { data: status } = await supabase.functions.invoke('runway-video', {
                        body: { action: 'check_status', taskId: rvData.taskId },
                      });
                      if (status?.status === 'SUCCEEDED' && status?.resultUrl) {
                        baseVideoUrl = status.resultUrl;
                        break;
                      }
                      if (status?.status === 'FAILED') break;
                    }
                  }
                }

                setHighlightProgress(75);
                setHighlightStage('מרכיב סרטון סופי עם מוזיקה...');

                // Step 4: Compose final video with Shotstack
                const scenes = videoFiles.length > 1
                  ? videoFiles.map((url, i) => ({ src: url, length: Math.min(10, 60 / videoFiles.length), fit: 'cover' as const }))
                  : baseVideoUrl ? [{ src: baseVideoUrl, length: 10, fit: 'cover' as const }] : [];

                if (scenes.length > 0) {
                  const composeResult = await composeService.render({
                    videoUrl: scenes[0]?.src || baseVideoUrl,
                    scenes,
                    audioUrl: audioUrl || undefined,
                  });

                  if (composeResult?.renderId) {
                    setHighlightProgress(85);
                    setHighlightStage('ממתין לרינדור...');
                    // Poll Shotstack
                    for (let i = 0; i < 60; i++) {
                      await new Promise(r => setTimeout(r, 5000));
                      setHighlightProgress(85 + Math.min(10, i));
                      const statusResult = await composeService.checkStatus(composeResult.renderId);
                      if (statusResult?.status === 'done' && statusResult?.url) {
                        setResult({ videoUrl: statusResult.url });
                        break;
                      }
                      if (statusResult?.status === 'failed') throw new Error('הרינדור נכשל');
                    }
                  }
                }

                // Fallback: use first video if composition failed
                if (!result?.videoUrl && baseVideoUrl) {
                  setResult({ videoUrl: baseVideoUrl });
                }

                setHighlightProgress(100);
                setHighlightStage('');
                setStep(step + 2); // Jump to result
                toast.success(highlightOutputType === 'podcast_edit' ? 'הפודקאסט הערוך מוכן! 🎙️' : 'הסרטון מוכן! 🎬');
              } catch (e: any) {
                toast.error(e.message || 'שגיאה ביצירת הסרטון');
                setStep(step - 1); // Go back to prompt
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
            {loading ? 'מעבד...' : highlightOutputType === 'podcast_edit' ? 'ערוך פודקאסט' : 'צור סרטון'}
          </button>
        </div>
        );
      }

      if (wizardStep === 2 && loading) return (
        <div className="space-y-6 py-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Scissors className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">{highlightStage || 'מעבד...'}</p>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden max-w-xs mx-auto">
              <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${highlightProgress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{highlightProgress}%</p>
          </div>
        </div>
      );

      if ((wizardStep === 3 || wizardStep === 2) && result?.videoUrl) return renderResultView();
    }

    return null;
  };

  const stepInfo = getStepInfo();
  const totalSteps = getTotalSteps();
  const currentStepNum = step + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] md:max-h-[85vh] overflow-y-auto w-[95vw] md:w-full" dir="rtl">
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

          {selectedAction && selectedAction !== 'video_ai' && selectedAction !== 'subtitles' && (
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
