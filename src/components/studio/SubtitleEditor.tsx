import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Loader2, Upload, Eye, Save, Download, ArrowRight, ArrowLeft,
  Subtitles, Check, X, Plus, Trash2, Scissors, Music,
  Smile, Type, Palette, Image, Sparkles, Play, Pause,
  Film, Sticker, Crown, Layers, ChevronLeft, ChevronRight,
  Clock, PlusCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  subtitleService, type SubtitleSegment, type Brand,
  storageService, composeService,
} from '@/services/creativeService';

// ── Font presets (YouTube-style, creative) ──
const fontPresets = [
  {
    id: 'impact',
    label: '💥 Impact',
    font: "'Rubik', sans-serif",
    fontWeight: 900,
    bgColor: 'rgba(0,0,0,0.85)',
    borderRadius: 4,
    shadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
    padding: '8px 20px',
    preview: 'כתובית בולטת',
  },
  {
    id: 'glow',
    label: '✨ זוהר',
    font: "'Heebo', sans-serif",
    fontWeight: 700,
    bgColor: 'transparent',
    borderRadius: 0,
    shadow: '0 0 10px #fff, 0 0 20px #fff, 0 0 40px #FFD700, 0 0 80px #FFD700',
    padding: '8px 16px',
    preview: 'כתובית זוהרת',
  },
  {
    id: 'boxed',
    label: '📦 קופסה',
    font: "'Noto Sans Hebrew', sans-serif",
    fontWeight: 800,
    bgColor: 'rgba(255,200,0,0.95)',
    borderRadius: 6,
    shadow: 'none',
    padding: '10px 24px',
    preview: 'כתובית בקופסה',
    textColor: '#000000',
  },
  {
    id: 'outline',
    label: '🔲 מתאר',
    font: "'Rubik', sans-serif",
    fontWeight: 800,
    bgColor: 'transparent',
    borderRadius: 0,
    shadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 3px 6px rgba(0,0,0,0.5)',
    padding: '8px 16px',
    preview: 'כתובית עם מתאר',
  },
  {
    id: 'gradient',
    label: '🌈 גרדיאנט',
    font: "'Heebo', sans-serif",
    fontWeight: 700,
    bgColor: 'linear-gradient(135deg, rgba(255,0,128,0.9), rgba(255,165,0,0.9))',
    borderRadius: 16,
    shadow: '0 4px 20px rgba(255,0,128,0.4)',
    padding: '12px 28px',
    preview: 'כתובית צבעונית',
  },
  {
    id: 'cinema',
    label: '🎬 קולנועי',
    font: "'Noto Sans Hebrew', sans-serif",
    fontWeight: 500,
    bgColor: 'rgba(0,0,0,0.6)',
    borderRadius: 2,
    shadow: '0 2px 8px rgba(0,0,0,0.9)',
    padding: '10px 24px',
    preview: 'כתובית קולנועית',
  },
  {
    id: 'neon',
    label: '💡 ניאון',
    font: "'Rubik', sans-serif",
    fontWeight: 700,
    bgColor: 'transparent',
    borderRadius: 0,
    shadow: '0 0 7px #fff, 0 0 10px #fff, 0 0 21px #fff, 0 0 42px #0fa, 0 0 82px #0fa',
    padding: '8px 16px',
    preview: 'כתובית ניאון',
    textColor: '#FFFFFF',
  },
  {
    id: 'handwritten',
    label: '✍️ כתב יד',
    font: "'Heebo', sans-serif",
    fontWeight: 400,
    bgColor: 'rgba(255,255,200,0.9)',
    borderRadius: 3,
    shadow: '1px 1px 2px rgba(0,0,0,0.3)',
    padding: '10px 20px',
    preview: 'כתובית אישית',
    textColor: '#333333',
  },
] as const;

// ── Color options ──
const colorOptions = [
  { value: '#FFFFFF', label: 'לבן' },
  { value: '#FFD700', label: 'זהב' },
  { value: '#00FF88', label: 'ירוק' },
  { value: '#00BFFF', label: 'כחול' },
  { value: '#FF4444', label: 'אדום' },
  { value: '#FF69B4', label: 'ורוד' },
  { value: '#000000', label: 'שחור' },
  { value: '#FF6600', label: 'כתום' },
];

const fontSizeOptions = [
  { value: 20, label: 'S' },
  { value: 26, label: 'M' },
  { value: 32, label: 'L' },
  { value: 38, label: 'XL' },
  { value: 44, label: 'XXL' },
];

const emojiOptions = ['🔥', '✨', '👆', '💡', '⭐', '🎯', '💪', '❤️', '👇', '📌', '🚀', '💰', '👏', '🎉', '💎', '🏆'];

const bgMusicOptions = [
  { id: 'none', label: 'ללא מוזיקה', emoji: '🔇', prompt: '' },
  { id: 'upbeat', label: 'אנרגטי', emoji: '🎵', prompt: 'upbeat energetic background music, corporate, positive' },
  { id: 'calm', label: 'רגוע', emoji: '🎶', prompt: 'calm professional background music, soft piano, corporate' },
  { id: 'dramatic', label: 'דרמטי', emoji: '🎼', prompt: 'dramatic cinematic background music, inspiring, epic' },
  { id: 'modern', label: 'מודרני', emoji: '🎧', prompt: 'modern electronic background music, tech, trendy' },
  { id: 'chill', label: "צ'יל", emoji: '🌊', prompt: 'chill lofi background music, relaxed, ambient' },
];

// ── Sticker icons ──
const stickerOptions = [
  '👆', '👇', '👉', '👈', '⭐', '🔥', '💡', '📌', '🎯', '✅',
  '❌', '❓', '💰', '🏆', '🚀', '💎', '⚡', '🎉', '📢', '🔔',
  '💪', '❤️', '👏', '🤩', '😎', '🤔', '💯', '🎊', '📊', '🛒',
];

interface StickerOverlay {
  id: string;
  emoji: string;
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
  startTime: number;
  duration: number;
  scale: number;
}

interface SubtitleEditorProps {
  activeBrand: Brand | undefined;
  onBack: () => void;
}

// Step names
const STEPS = [
  { key: 'upload', label: 'העלאה', icon: Upload },
  { key: 'subtitles', label: 'כתוביות', icon: Subtitles },
  { key: 'style', label: 'עיצוב', icon: Palette },
  { key: 'extras', label: 'תוספות', icon: Layers },
] as const;

export function SubtitleEditor({ activeBrand, onBack }: SubtitleEditorProps) {
  const [step, setStep] = useState(0);
  const [subtitleSegments, setSubtitleSegments] = useState<SubtitleSegment[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Style
  const [selectedFont, setSelectedFont] = useState('impact');
  const [customColor, setCustomColor] = useState('#FFFFFF');
  const [customFontSize, setCustomFontSize] = useState(32);

  // Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(activeBrand?.logo || null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Stickers
  const [stickers, setStickers] = useState<StickerOverlay[]>([]);

  // Music
  const [selectedMusic, setSelectedMusic] = useState('none');
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicAudioUrl, setMusicAudioUrl] = useState<string | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);

  // Rendering
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  const currentFont = fontPresets.find(p => p.id === selectedFont) || fontPresets[0];

  const getAdjustedSegments = useCallback(() => {
    return subtitleSegments
      .map((seg) => ({
        ...seg,
        start: Math.max(0, Number((seg.start + subtitleOffset).toFixed(2))),
        end: Math.max(Math.max(0, Number((seg.start + subtitleOffset).toFixed(2))) + 0.1, Number((seg.end + subtitleOffset).toFixed(2))),
      }))
      .sort((a, b) => a.start - b.start);
  }, [subtitleSegments, subtitleOffset]);

  // ── Segment management ──
  const updateSegment = (index: number, updates: Partial<SubtitleSegment>) => {
    setSubtitleSegments(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const addSegment = (afterIndex: number) => {
    const prev = subtitleSegments[afterIndex];
    const next = subtitleSegments[afterIndex + 1];
    const newStart = prev ? prev.end + 0.5 : 0;
    const newEnd = next ? Math.min(next.start - 0.1, newStart + 3) : newStart + 3;
    const newSeg: SubtitleSegment = { start: newStart, end: Math.max(newEnd, newStart + 0.5), text: '' };
    setSubtitleSegments(prev => {
      const arr = [...prev];
      arr.splice(afterIndex + 1, 0, newSeg);
      return arr;
    });
    setEditingIndex(afterIndex + 1);
  };

  const addGapBetween = (index: number, gapSeconds: number) => {
    // Push all subsequent segments forward by gapSeconds
    setSubtitleSegments(prev => prev.map((s, i) => {
      if (i <= index) return s;
      return { ...s, start: s.start + gapSeconds, end: s.end + gapSeconds };
    }));
  };

  const deleteSegment = (index: number) => {
    setSubtitleSegments(prev => prev.filter((_, i) => i !== index));
  };

  const splitSegment = (index: number) => {
    const seg = subtitleSegments[index];
    const midTime = (seg.start + seg.end) / 2;
    const words = seg.text.split(' ');
    const midWord = Math.ceil(words.length / 2);
    const seg1: SubtitleSegment = { start: seg.start, end: midTime, text: words.slice(0, midWord).join(' ') };
    const seg2: SubtitleSegment = { start: midTime + 0.1, end: seg.end, text: words.slice(midWord).join(' ') };
    setSubtitleSegments(prev => {
      const arr = [...prev];
      arr.splice(index, 1, seg1, seg2);
      return arr;
    });
  };

  const addEmoji = (index: number, emoji: string) => {
    updateSegment(index, { text: subtitleSegments[index].text + ' ' + emoji });
  };

  const seekToSegment = (seg: SubtitleSegment) => {
    if (videoPreviewRef.current) {
      videoPreviewRef.current.currentTime = Math.max(0, seg.start + subtitleOffset);
      videoPreviewRef.current.play();
      setShowPreview(true);
    }
  };

  // ── Extract audio from video for transcription (smaller payload) ──
  const extractAudioBlob = async (video: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const videoEl = document.createElement('video');
      videoEl.src = URL.createObjectURL(video);
      // IMPORTANT: Do NOT set muted=true — we need audio to flow through AudioContext
      videoEl.volume = 0; // silence speakers but keep audio stream active

      videoEl.onloadedmetadata = () => {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(videoEl);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        // Don't connect to speakers — keeps it silent
        // source.connect(audioCtx.destination); // intentionally omitted

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4';
        const mediaRecorder = new MediaRecorder(dest.stream, { mimeType });
        const chunks: BlobPart[] = [];

        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        mediaRecorder.onstop = () => {
          URL.revokeObjectURL(videoEl.src);
          audioCtx.close();
          const blob = new Blob(chunks, { type: mimeType });
          if (blob.size < 100) {
            reject(new Error('חילוץ האודיו נכשל — הקובץ ריק'));
          } else {
            resolve(blob);
          }
        };
        mediaRecorder.onerror = () => {
          URL.revokeObjectURL(videoEl.src);
          reject(new Error('שגיאה בחילוץ אודיו'));
        };

        // Limit to first 2 minutes for transcription
        const maxDuration = Math.min(videoEl.duration, 120);
        mediaRecorder.start(1000); // collect chunks every second for reliability
        videoEl.play().catch(() => reject(new Error('הדפדפן חסם את ניגון הווידאו')));
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          videoEl.pause();
        }, maxDuration * 1000);
      };

      videoEl.onerror = () => {
        URL.revokeObjectURL(videoEl.src);
        reject(new Error('שגיאה בטעינת הווידאו'));
      };
    });
  };

  // ── Transcribe ──
  const handleTranscribe = async () => {
    if (!videoFile) return;
    setLoading(true);
    try {
      // For small files (<5MB), send directly as base64
      // For larger files, extract audio first to reduce payload size
      let base64: string;
      const MAX_DIRECT_SIZE = 5 * 1024 * 1024; // 5MB

      if (videoFile.size <= MAX_DIRECT_SIZE) {
        const ab = await videoFile.arrayBuffer();
        const bytes = new Uint8Array(ab);
        const chunkSize = 8192;
        let binary = '';
        for (let i = 0; i < bytes.length; i += chunkSize)
          binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
        base64 = btoa(binary);
      } else {
        toast.info('מחלץ אודיו מהסרטון לתמלול מהיר יותר...');
        try {
          const audioBlob = await extractAudioBlob(videoFile);
          const ab = await audioBlob.arrayBuffer();
          const bytes = new Uint8Array(ab);
          const chunkSize = 8192;
          let binary = '';
          for (let i = 0; i < bytes.length; i += chunkSize)
            binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
          base64 = btoa(binary);
        } catch {
          // Fallback: take only first 5MB of the original file
          toast.info('משתמש בקטע הראשון של הסרטון...');
          const ab = await videoFile.slice(0, MAX_DIRECT_SIZE).arrayBuffer();
          const bytes = new Uint8Array(ab);
          const chunkSize = 8192;
          let binary = '';
          for (let i = 0; i < bytes.length; i += chunkSize)
            binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
          base64 = btoa(binary);
        }
      }

      const data = await subtitleService.transcribe(base64);
      setSubtitleSegments(data.segments);
      setShowPreview(true);
      toast.success('התמלול מוכן!');
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בתמלול');
    } finally {
      setLoading(false);
    }
  };

  // ── Logo upload ──
  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const url = await storageService.upload(file);
      setLogoUrl(url);
      toast.success('לוגו הועלה!');
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בהעלאת לוגו');
    } finally {
      setLogoUploading(false);
    }
  };

  // ── Background music ──
  const generateMusic = async (musicId: string) => {
    const option = bgMusicOptions.find(m => m.id === musicId);
    if (!option?.prompt) { setMusicAudioUrl(null); return; }
    setMusicLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ prompt: option.prompt, duration: 30 }),
        }
      );
      if (!response.ok) throw new Error('שגיאה ביצירת מוזיקה');
      const blob = await response.blob();
      setMusicAudioUrl(URL.createObjectURL(blob));
      toast.success('מוזיקת רקע נוצרה!');
    } catch (e: any) {
      toast.error(e.message || 'שגיאה ביצירת מוזיקה');
    } finally {
      setMusicLoading(false);
    }
  };

  // ── Add sticker ──
  const addSticker = (emoji: string) => {
    const videoDuration = videoPreviewRef.current?.duration || 30;
    setStickers(prev => [...prev, {
      id: crypto.randomUUID(),
      emoji,
      position: 'topRight',
      startTime: 0,
      duration: Math.min(videoDuration, 5),
      scale: 1,
    }]);
  };

  const removeSticker = (id: string) => {
    setStickers(prev => prev.filter(s => s.id !== id));
  };

  // ── Render final video ──
  const handleRenderVideo = async () => {
    if (!videoFile) return;
    setRendering(true);
    setRenderProgress(5);

    try {
      toast.info('מעלה סרטון מקור...');
      const videoUrl = await storageService.upload(videoFile);
      setRenderProgress(15);

      let audioUrl: string | undefined;
      if (musicAudioUrl) {
        toast.info('מעלה מוזיקת רקע...');
        const musicBlob = await fetch(musicAudioUrl).then(r => r.blob());
        const musicFile = new File([musicBlob], `music-${Date.now()}.mp3`, { type: 'audio/mpeg' });
        audioUrl = await storageService.upload(musicFile);
        setRenderProgress(25);
      }

      const adjusted = getAdjustedSegments();
      const videoDuration = videoPreviewRef.current?.duration || 30;

      const scenes = adjusted.map((seg) => ({
        title: '',
        duration: seg.end - seg.start,
        subtitleText: seg.text,
        spokenText: seg.text,
        icons: [] as string[],
      }));

      if (scenes.length === 0) {
        scenes.push({ title: '', duration: videoDuration, subtitleText: '', spokenText: '', icons: [] });
      }

      setRenderProgress(30);
      toast.info('שולח להרכבה...');

      const renderParams = {
        videoUrl,
        scenes,
        logoUrl: logoUrl || undefined,
        brandColors: activeBrand?.colors || [],
        audioUrl,
        subtitleStyle: {
          font: currentFont.font,
          fontSize: customFontSize,
          color: (currentFont as any).textColor || customColor,
          bgColor: currentFont.bgColor,
          borderRadius: currentFont.borderRadius,
          shadow: currentFont.shadow,
          fontWeight: currentFont.fontWeight,
          padding: currentFont.padding,
        },
        stickers: stickers.map(s => ({
          emoji: s.emoji,
          position: s.position,
          startTime: s.startTime,
          duration: s.duration,
          scale: s.scale,
        })),
        subtitleSegments: adjusted,
        totalDuration: videoDuration,
      };

      const renderResult = await composeService.render(renderParams);
      const renderId = renderResult.renderId;
      const shotstackEnv = renderResult.shotstackEnv;

      if (!renderId) throw new Error('לא התקבל מזהה הרכבה');

      setRenderProgress(40);
      toast.info('מרכיב סרטון... זה עשוי לקחת כמה דקות');

      let attempts = 0;
      const maxAttempts = 120;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;

        const status = await composeService.checkStatus(renderId, shotstackEnv);

        if (status.status === 'done' && status.url) {
          setRenderedVideoUrl(status.url);
          setRenderProgress(100);
          toast.success('הסרטון מוכן! 🎬');
          break;
        } else if (status.status === 'failed') {
          throw new Error('ההרכבה נכשלה');
        }

        setRenderProgress(40 + Math.min(55, (attempts / maxAttempts) * 55));
      }

      if (attempts >= maxAttempts) {
        throw new Error('ההרכבה לקחה יותר מדי זמן');
      }
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בהרכבת הסרטון');
    } finally {
      setRendering(false);
    }
  };

  // ── Preview subtitle CSS ──
  const getPreviewSubtitleStyle = (): React.CSSProperties => ({
    fontFamily: currentFont.font,
    fontSize: `${Math.min(customFontSize * 0.6, 22)}px`,
    color: (currentFont as any).textColor || customColor,
    background: currentFont.bgColor,
    borderRadius: `${currentFont.borderRadius}px`,
    textShadow: currentFont.shadow,
    fontWeight: currentFont.fontWeight as any,
    padding: '6px 14px',
    direction: 'rtl',
    textAlign: 'center' as const,
    maxWidth: '90%',
  });

  // ── Video preview component (shared across steps) ──
  const VideoPreview = () => (
    videoPreviewUrl ? (
      <div className="rounded-xl overflow-hidden border border-border relative bg-black">
        <video
          ref={videoPreviewRef}
          src={videoPreviewUrl}
          controls
          className="w-full max-h-[240px]"
          onTimeUpdate={() => {
            if (!videoPreviewRef.current) return;
            const t = videoPreviewRef.current.currentTime;
            const active = getAdjustedSegments().find(s => t >= s.start && t <= s.end);
            setCurrentSubtitle(active?.text || '');
          }}
        />
        {showPreview && currentSubtitle && (
          <div className="absolute bottom-14 left-0 right-0 flex justify-center pointer-events-none px-4">
            <div style={getPreviewSubtitleStyle()}>{currentSubtitle}</div>
          </div>
        )}
        {logoUrl && (
          <div className="absolute top-3 right-3 pointer-events-none">
            <img src={logoUrl} alt="logo" className="w-10 h-10 object-contain rounded-lg opacity-90" />
          </div>
        )}
      </div>
    ) : null
  );

  // ── Step indicator ──
  const StepIndicator = () => (
    <div className="flex items-center gap-1 mb-3">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <button
            onClick={() => { if (i === 0 || (i > 0 && videoFile)) setStep(i); }}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
              step === i ? 'bg-primary text-primary-foreground' :
              step > i ? 'bg-primary/20 text-primary' :
              'bg-muted text-muted-foreground'
            )}
          >
            {step > i ? <Check className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
            {s.label}
          </button>
          {i < STEPS.length - 1 && (
            <ChevronLeft className="w-3 h-3 text-muted-foreground/50" />
          )}
        </div>
      ))}
    </div>
  );

  // ── Navigation buttons ──
  const NavButtons = ({ canNext = true }: { canNext?: boolean }) => (
    <div className="flex gap-2 pt-3 border-t border-border/50">
      <button
        onClick={() => setStep(s => s - 1)}
        className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5"
      >
        <ArrowRight className="w-3.5 h-3.5" /> הקודם
      </button>
      <div className="flex-1" />
      {step < STEPS.length - 1 ? (
        <button
          onClick={() => setStep(s => s + 1)}
          disabled={!canNext}
          className="gradient-gold text-primary-foreground px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          הבא <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          onClick={handleRenderVideo}
          disabled={rendering || subtitleSegments.length === 0}
          className="gradient-gold text-primary-foreground px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
          {rendering ? `מרכיב... ${Math.round(renderProgress)}%` : 'הרכב סרטון סופי 🎬'}
        </button>
      )}
    </div>
  );

  // ════════════════════════════════════════════
  // STEP 0: Upload
  // ════════════════════════════════════════════
  if (step === 0) return (
    <div className="space-y-4">
      <StepIndicator />
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault(); setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && file.type.startsWith('video/')) {
            setVideoFile(file);
            setVideoPreviewUrl(URL.createObjectURL(file));
            setStep(1);
          } else toast.error('יש להעלות קובץ וידאו');
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
        )}
      >
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) { setVideoFile(f); setVideoPreviewUrl(URL.createObjectURL(f)); setStep(1); }
          }}
        />
        <Upload className={cn('w-12 h-12 mx-auto mb-3', isDragging ? 'text-primary' : 'text-muted-foreground')} />
        <p className="text-sm font-medium">גרור סרטון לכאן או לחץ לבחירה</p>
        <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM</p>
      </div>
    </div>
  );

  // ════════════════════════════════════════════
  // STEP 1: Subtitles — edit text, timing, gaps
  // ════════════════════════════════════════════
  if (step === 1) return (
    <div className="space-y-3">
      <StepIndicator />
      <VideoPreview />

      {/* Transcribe + controls */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleTranscribe}
          disabled={loading}
          className="gradient-gold text-primary-foreground px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Subtitles className="w-4 h-4" />}
          {loading ? 'מתמלל...' : 'תמלל אוטומטית'}
        </button>
        {subtitleSegments.length > 0 && (
          <>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={cn('px-3 py-2 border rounded-lg text-sm flex items-center gap-2',
                showPreview ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}
            >
              <Eye className="w-4 h-4" /> תצוגה חיה
            </button>
            <button
              onClick={() => {
                const srt = subtitleService.toSRT(getAdjustedSegments());
                const blob = new Blob(['\uFEFF' + srt], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url; link.download = `subtitles-${Date.now()}.srt`;
                document.body.appendChild(link); link.click();
                document.body.removeChild(link); URL.revokeObjectURL(url);
                toast.success('SRT הורד!');
              }}
              className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> SRT
            </button>
          </>
        )}
      </div>

      {/* Subtitle segments with gap controls */}
      {subtitleSegments.length > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              כתוביות ({subtitleSegments.length})
            </h4>
          </div>

          <div className="space-y-0 max-h-[320px] overflow-y-auto pr-1">
            {subtitleSegments.map((seg, i) => {
              const gap = i < subtitleSegments.length - 1
                ? subtitleSegments[i + 1].start - seg.end
                : null;

              return (
                <div key={i}>
                  {/* Segment card */}
                  <div
                    className={cn(
                      'bg-muted/30 rounded-lg p-2.5 border transition-all',
                      editingIndex === i ? 'border-primary/50 bg-primary/5' : 'border-border/50'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <input type="number" step="0.1" min="0" value={seg.start}
                        onChange={e => updateSegment(i, { start: Number(e.target.value) })}
                        className="w-14 bg-background border border-border rounded px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                        title="התחלה" />
                      <span className="text-xs text-muted-foreground">—</span>
                      <input type="number" step="0.1" min="0" value={seg.end}
                        onChange={e => updateSegment(i, { end: Number(e.target.value) })}
                        className="w-14 bg-background border border-border rounded px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                        title="סיום" />
                      <span className="text-[10px] text-muted-foreground">({(seg.end - seg.start).toFixed(1)}s)</span>
                      <div className="mr-auto flex items-center gap-0.5">
                        <button onClick={() => seekToSegment(seg)} title="נגן"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Play className="w-3 h-3" />
                        </button>
                        <button onClick={() => splitSegment(i)} title="פצל"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Scissors className="w-3 h-3" />
                        </button>
                        <button onClick={() => deleteSegment(i)} title="מחק"
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <input
                      value={seg.text}
                      onFocus={() => setEditingIndex(i)}
                      onChange={e => updateSegment(i, { text: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      dir="rtl"
                      placeholder="טקסט כתובית..."
                    />
                    {editingIndex === i && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {emojiOptions.map(emoji => (
                          <button key={emoji} onClick={() => addEmoji(i, emoji)}
                            className="w-6 h-6 rounded hover:bg-muted text-sm flex items-center justify-center">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Gap control between segments */}
                  {gap !== null && (
                    <div className="flex items-center justify-center gap-2 py-1 group">
                      <div className="h-px flex-1 bg-border/30" />
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <button
                          onClick={() => addGapBetween(i, -0.3)}
                          className="w-5 h-5 rounded-full border border-border hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="צמצם רווח"
                        >
                          −
                        </button>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-medium',
                          gap > 0.3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        )}>
                          ⏸ {gap.toFixed(1)}s
                        </span>
                        <button
                          onClick={() => addGapBetween(i, 0.3)}
                          className="w-5 h-5 rounded-full border border-border hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="הגדל רווח"
                        >
                          +
                        </button>
                        <button
                          onClick={() => addSegment(i)}
                          className="w-5 h-5 rounded-full border border-primary/50 hover:bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="הוסף כתובית כאן"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="h-px flex-1 bg-border/30" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Global offset */}
          <div className="bg-card border border-border rounded-lg p-3 mt-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">סנכרון כללי</label>
              <span className="text-xs font-medium text-primary">{subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s</span>
            </div>
            <input type="range" min="-3" max="3" step="0.1" value={subtitleOffset}
              onChange={e => setSubtitleOffset(Number(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between mt-1">
              <button onClick={() => setSubtitleOffset(o => Math.max(-3, o - 0.2))}
                className="text-[10px] text-muted-foreground hover:text-foreground">◀ מוקדם</button>
              <button onClick={() => setSubtitleOffset(0)}
                className="text-[10px] text-primary hover:underline">איפוס</button>
              <button onClick={() => setSubtitleOffset(o => Math.min(3, o + 0.2))}
                className="text-[10px] text-muted-foreground hover:text-foreground">מאוחר ▶</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Subtitles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">לחץ "תמלל אוטומטית" כדי להתחיל</p>
        </div>
      )}

      <NavButtons canNext={subtitleSegments.length > 0} />
    </div>
  );

  // ════════════════════════════════════════════
  // STEP 2: Style — fonts, colors, size
  // ════════════════════════════════════════════
  if (step === 2) return (
    <div className="space-y-3">
      <StepIndicator />
      <VideoPreview />

      {/* Font presets grid */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">סגנון כתוביות</h4>
        <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
          {fontPresets.map(preset => (
            <button
              key={preset.id}
              onClick={() => {
                setSelectedFont(preset.id);
                if ((preset as any).textColor) setCustomColor((preset as any).textColor);
                else setCustomColor('#FFFFFF');
              }}
              className={cn(
                'p-3 rounded-lg border text-right transition-all',
                selectedFont === preset.id
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border hover:bg-muted'
              )}
            >
              <div className="text-xs font-medium mb-1.5">{preset.label}</div>
              <div
                className="text-xs px-2 py-1 rounded inline-block"
                style={{
                  fontFamily: preset.font,
                  color: (preset as any).textColor || '#FFFFFF',
                  background: preset.bgColor === 'transparent' ? 'rgba(0,0,0,0.5)' : preset.bgColor,
                  fontWeight: preset.fontWeight,
                  textShadow: preset.shadow,
                  borderRadius: `${preset.borderRadius}px`,
                }}
                dir="rtl"
              >
                {preset.preview}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">צבע טקסט</h4>
        <div className="flex gap-2 flex-wrap">
          {colorOptions.map(c => (
            <button
              key={c.value}
              onClick={() => setCustomColor(c.value)}
              className={cn(
                'w-8 h-8 rounded-full border-2 transition-all',
                customColor === c.value ? 'border-primary scale-110 shadow-lg' : 'border-border/50'
              )}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* Font size */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">גודל</h4>
        <div className="flex gap-2">
          {fontSizeOptions.map(s => (
            <button
              key={s.value}
              onClick={() => setCustomFontSize(s.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-xs font-bold transition-all',
                customFontSize === s.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <NavButtons />
    </div>
  );

  // ════════════════════════════════════════════
  // STEP 3: Extras — music, logo, stickers, render
  // ════════════════════════════════════════════
  if (step === 3) return (
    <div className="space-y-3">
      <StepIndicator />
      <VideoPreview />

      {/* Music section */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5" /> מוזיקת רקע
        </h4>
        <div className="grid grid-cols-3 gap-1.5">
          {bgMusicOptions.map(m => (
            <button
              key={m.id}
              onClick={() => {
                setSelectedMusic(m.id);
                if (m.id !== 'none') generateMusic(m.id);
                else setMusicAudioUrl(null);
              }}
              className={cn(
                'px-2 py-2 rounded-lg text-xs border transition-all text-center',
                selectedMusic === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
              )}
            >
              <div className="text-lg mb-0.5">{m.emoji}</div>
              {m.label}
            </button>
          ))}
        </div>
        {musicLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-3">
            <Loader2 className="w-4 h-4 animate-spin" /> מייצר מוזיקה...
          </div>
        )}
        {musicAudioUrl && (
          <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-2 border border-border/50">
            <button
              onClick={() => {
                if (!musicAudioRef.current) return;
                if (musicPlaying) musicAudioRef.current.pause();
                else musicAudioRef.current.play();
                setMusicPlaying(!musicPlaying);
              }}
              className="w-8 h-8 gradient-gold text-primary-foreground rounded-full flex items-center justify-center text-xs shrink-0"
            >
              {musicPlaying ? '⏸' : '▶'}
            </button>
            <audio ref={musicAudioRef} src={musicAudioUrl} onEnded={() => setMusicPlaying(false)} className="flex-1 h-8" controls />
          </div>
        )}
      </div>

      {/* Logo section */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5" /> לוגו
        </h4>
        {logoUrl ? (
          <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border/50">
            <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded-lg border border-border" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">יופיע בפינה הימנית העליונה</p>
              <button onClick={() => setLogoUrl(null)}
                className="text-xs text-destructive hover:underline flex items-center gap-1 mt-1">
                <Trash2 className="w-3 h-3" /> הסר
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => logoInputRef.current?.click()}
            className="border border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 transition-all"
          >
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
            />
            {logoUploading ? (
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
            ) : (
              <>
                <Image className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">העלה לוגו</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Stickers section */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Sticker className="w-3.5 h-3.5" /> סטיקרים ואייקונים
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {stickerOptions.map(emoji => (
            <button
              key={emoji}
              onClick={() => addSticker(emoji)}
              className="w-9 h-9 rounded-lg border border-border hover:bg-muted hover:border-primary/40 flex items-center justify-center text-lg transition-all"
            >
              {emoji}
            </button>
          ))}
        </div>
        {stickers.length > 0 && (
          <div className="space-y-1.5 mt-1">
            <h5 className="text-[10px] font-medium text-muted-foreground">נוספו ({stickers.length})</h5>
            {stickers.map(sticker => (
              <div key={sticker.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2 border border-border/50">
                <span className="text-lg">{sticker.emoji}</span>
                <select
                  value={sticker.position}
                  onChange={e => setStickers(prev => prev.map(s =>
                    s.id === sticker.id ? { ...s, position: e.target.value as any } : s
                  ))}
                  className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs"
                >
                  <option value="topLeft">שמאל עליון</option>
                  <option value="topRight">ימין עליון</option>
                  <option value="bottomLeft">שמאל תחתון</option>
                  <option value="bottomRight">ימין תחתון</option>
                  <option value="center">מרכז</option>
                </select>
                <input type="number" step="0.5" min="0" value={sticker.startTime}
                  onChange={e => setStickers(prev => prev.map(s =>
                    s.id === sticker.id ? { ...s, startTime: Number(e.target.value) } : s
                  ))}
                  className="w-12 bg-background border border-border rounded px-1 py-1 text-xs text-center" title="התחלה" />
                <input type="number" step="0.5" min="0.5" value={sticker.duration}
                  onChange={e => setStickers(prev => prev.map(s =>
                    s.id === sticker.id ? { ...s, duration: Number(e.target.value) } : s
                  ))}
                  className="w-12 bg-background border border-border rounded px-1 py-1 text-xs text-center" title="משך" />
                <button onClick={() => removeSticker(sticker.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Render action */}
      <NavButtons />

      {/* Render progress */}
      {rendering && (
        <div className="bg-card border border-primary/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">מרכיב סרטון...</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="gradient-gold h-2 rounded-full transition-all duration-500" style={{ width: `${renderProgress}%` }} />
          </div>
        </div>
      )}

      {/* Result */}
      {renderedVideoUrl && (
        <div className="bg-card border border-green-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-sm font-bold">הסרטון מוכן!</span>
          </div>
          <video src={renderedVideoUrl} controls className="w-full rounded-lg max-h-[300px]" />
          <a href={renderedVideoUrl} download={`edited-video-${Date.now()}.mp4`}
            className="w-full gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> הורד סרטון
          </a>
        </div>
      )}
    </div>
  );

  return null;
}
