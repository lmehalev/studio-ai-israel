import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Loader2, Upload, Eye, Save, Download, ArrowRight, ArrowLeft,
  Subtitles, Check, X, Plus, Trash2, Scissors, Music,
  Smile, Type, Palette, Image, Sparkles, Play, Pause,
  Film, Sticker, Crown, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  subtitleService, type SubtitleSegment, type Brand,
  storageService, composeService,
} from '@/services/creativeService';

// ── Subtitle style presets ──
const subtitlePresets = [
  {
    id: 'cinematic',
    label: '🎬 קולנועי',
    font: "'Noto Sans Hebrew', sans-serif",
    fontSize: 32,
    color: '#FFFFFF',
    bgColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    shadow: '0 2px 12px rgba(0,0,0,0.8)',
    fontWeight: 700,
    padding: '12px 28px',
  },
  {
    id: 'social',
    label: '📱 רשתות חברתיות',
    font: "'Rubik', sans-serif",
    fontSize: 28,
    color: '#FFFFFF',
    bgColor: 'rgba(255,180,0,0.9)',
    borderRadius: 8,
    shadow: '0 4px 16px rgba(255,150,0,0.5)',
    fontWeight: 800,
    padding: '10px 24px',
  },
  {
    id: 'minimal',
    label: '✨ מינימלי',
    font: "'Heebo', sans-serif",
    fontSize: 24,
    color: '#FFFFFF',
    bgColor: 'transparent',
    borderRadius: 0,
    shadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.4)',
    fontWeight: 500,
    padding: '8px 16px',
  },
  {
    id: 'bold',
    label: '💥 בולט',
    font: "'Rubik', sans-serif",
    fontSize: 36,
    color: '#FFD700',
    bgColor: 'rgba(0,0,0,0.85)',
    borderRadius: 16,
    shadow: '0 0 20px rgba(255,215,0,0.4)',
    fontWeight: 900,
    padding: '14px 32px',
  },
  {
    id: 'karaoke',
    label: '🎤 קריוקי',
    font: "'Noto Sans Hebrew', sans-serif",
    fontSize: 30,
    color: '#00FF88',
    bgColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    shadow: '0 0 30px rgba(0,255,136,0.3)',
    fontWeight: 700,
    padding: '12px 28px',
  },
] as const;

// ── Custom color options ──
const colorOptions = [
  { value: '#FFFFFF', label: 'לבן', tw: 'bg-white' },
  { value: '#FFD700', label: 'זהב', tw: 'bg-amber-400' },
  { value: '#00FF88', label: 'ירוק', tw: 'bg-green-400' },
  { value: '#00BFFF', label: 'כחול', tw: 'bg-blue-400' },
  { value: '#FF4444', label: 'אדום', tw: 'bg-red-400' },
  { value: '#FF69B4', label: 'ורוד', tw: 'bg-pink-400' },
];

const fontSizeOptions = [
  { value: 20, label: 'קטן' },
  { value: 26, label: 'רגיל' },
  { value: 32, label: 'בינוני' },
  { value: 38, label: 'גדול' },
  { value: 44, label: 'ענק' },
];

const emojiOptions = ['🔥', '✨', '👆', '💡', '⭐', '🎯', '💪', '❤️', '👇', '📌', '🚀', '💰', '👏', '🎉', '💎', '🏆'];

const bgMusicOptions = [
  { id: 'none', label: 'ללא מוזיקה', prompt: '' },
  { id: 'upbeat', label: '🎵 אנרגטי ושמח', prompt: 'upbeat energetic background music, corporate, positive' },
  { id: 'calm', label: '🎶 רגוע ומקצועי', prompt: 'calm professional background music, soft piano, corporate' },
  { id: 'dramatic', label: '🎼 דרמטי', prompt: 'dramatic cinematic background music, inspiring, epic' },
  { id: 'modern', label: '🎧 מודרני', prompt: 'modern electronic background music, tech, trendy' },
];

// ── Sticker icons for overlay ──
const stickerOptions = [
  '👆', '👇', '👉', '👈', '⭐', '🔥', '💡', '📌', '🎯', '✅',
  '❌', '❓', '💰', '🏆', '🚀', '💎', '⚡', '🎉', '📢', '🔔',
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

export function SubtitleEditor({ activeBrand, onBack }: SubtitleEditorProps) {
  // Steps: 0=upload, 1=edit, 2=render/save
  const [step, setStep] = useState(0);
  const [subtitleSegments, setSubtitleSegments] = useState<SubtitleSegment[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [savingSrt, setSavingSrt] = useState(false);
  const [savedSrtUrl, setSavedSrtUrl] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<'subtitles' | 'style' | 'music' | 'logo' | 'stickers'>('subtitles');

  // Subtitle styling
  const [selectedPreset, setSelectedPreset] = useState('cinematic');
  const [customColor, setCustomColor] = useState('#FFFFFF');
  const [customFontSize, setCustomFontSize] = useState(32);

  // Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(activeBrand?.logo || null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Stickers
  const [stickers, setStickers] = useState<StickerOverlay[]>([]);

  // Background music
  const [selectedMusic, setSelectedMusic] = useState('none');
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicAudioUrl, setMusicAudioUrl] = useState<string | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);

  // Rendering
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  const currentPreset = subtitlePresets.find(p => p.id === selectedPreset) || subtitlePresets[0];

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
    setSavedSrtUrl(null);
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
    setSavedSrtUrl(null);
  };

  const deleteSegment = (index: number) => {
    setSubtitleSegments(prev => prev.filter((_, i) => i !== index));
    setSavedSrtUrl(null);
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
    setSavedSrtUrl(null);
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

  // ── Transcribe ──
  const handleTranscribe = async () => {
    if (!videoFile) return;
    setLoading(true);
    try {
      const ab = await videoFile.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const chunkSize = 8192;
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunkSize)
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
      const base64 = btoa(binary);
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
      // 1. Upload source video
      toast.info('מעלה סרטון מקור...');
      const videoUrl = await storageService.upload(videoFile);
      setRenderProgress(15);

      // 2. Upload music if exists
      let audioUrl: string | undefined;
      if (musicAudioUrl) {
        toast.info('מעלה מוזיקת רקע...');
        const musicBlob = await fetch(musicAudioUrl).then(r => r.blob());
        const musicFile = new File([musicBlob], `music-${Date.now()}.mp3`, { type: 'audio/mpeg' });
        audioUrl = await storageService.upload(musicFile);
        setRenderProgress(25);
      }

      // 3. Build scenes from subtitle segments for Shotstack
      const adjusted = getAdjustedSegments();
      const videoDuration = videoPreviewRef.current?.duration || 30;

      // Build subtitle overlay clips
      const scenes = adjusted.map((seg, i) => ({
        title: '',
        duration: seg.end - seg.start,
        subtitleText: seg.text,
        spokenText: seg.text,
        icons: [] as string[],
      }));

      // If no subtitles, make one scene for the whole video
      if (scenes.length === 0) {
        scenes.push({
          title: '',
          duration: videoDuration,
          subtitleText: '',
          spokenText: '',
          icons: [],
        });
      }

      setRenderProgress(30);
      toast.info('שולח להרכבה...');

      // 4. Send to compose-video with custom subtitle styling
      const { data, error } = await supabase.functions.invoke('compose-video', {
        body: {
          action: 'render',
          videoUrl,
          scenes,
          logoUrl: logoUrl || undefined,
          brandColors: activeBrand?.colors || [],
          audioUrl,
          subtitleStyle: {
            font: currentPreset.font,
            fontSize: customFontSize,
            color: customColor,
            bgColor: currentPreset.bgColor,
            borderRadius: currentPreset.borderRadius,
            shadow: currentPreset.shadow,
            fontWeight: currentPreset.fontWeight,
            padding: currentPreset.padding,
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
        },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      const renderId = data.renderId;
      if (!renderId) throw new Error('לא התקבל מזהה הרכבה');

      setRenderProgress(40);
      toast.info('מרכיב סרטון... זה עשוי לקחת כמה דקות');

      // 5. Poll for status
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;

        const { data: statusData } = await supabase.functions.invoke('compose-video', {
          body: { action: 'check_status', renderId },
        });

        if (statusData?.status === 'done' && statusData?.url) {
          setRenderedVideoUrl(statusData.url);
          setRenderProgress(100);
          toast.success('הסרטון מוכן! 🎬');
          break;
        } else if (statusData?.status === 'failed') {
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
    fontFamily: currentPreset.font,
    fontSize: `${Math.min(customFontSize * 0.6, 22)}px`,
    color: customColor,
    backgroundColor: currentPreset.bgColor,
    borderRadius: `${currentPreset.borderRadius}px`,
    textShadow: currentPreset.shadow,
    fontWeight: currentPreset.fontWeight as any,
    padding: '6px 14px',
    direction: 'rtl',
    textAlign: 'center' as const,
    maxWidth: '90%',
  });

  // ════════════════════════════════════════════
  // STEP 0: Upload
  // ════════════════════════════════════════════
  if (step === 0) return (
    <div className="space-y-4">
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
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
        )}
      >
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) { setVideoFile(f); setVideoPreviewUrl(URL.createObjectURL(f)); setStep(1); }
          }}
        />
        <Upload className={cn('w-10 h-10 mx-auto mb-3', isDragging ? 'text-primary' : 'text-muted-foreground')} />
        <p className="text-sm font-medium">גרור סרטון לכאן או לחץ לבחירה</p>
        <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM</p>
      </div>
    </div>
  );

  // ════════════════════════════════════════════
  // STEP 1: Full Edit Suite
  // ════════════════════════════════════════════
  if (step === 1) return (
    <div className="space-y-3">
      {/* Video preview with live subtitles */}
      {videoPreviewUrl && (
        <div className="rounded-xl overflow-hidden border border-border relative bg-black">
          <video
            ref={videoPreviewRef}
            src={videoPreviewUrl}
            controls
            className="w-full max-h-[280px]"
            onTimeUpdate={() => {
              if (!videoPreviewRef.current) return;
              const t = videoPreviewRef.current.currentTime;
              const active = getAdjustedSegments().find(s => t >= s.start && t <= s.end);
              setCurrentSubtitle(active?.text || '');
            }}
          />
          {/* Live subtitle overlay */}
          {showPreview && currentSubtitle && (
            <div className="absolute bottom-14 left-0 right-0 flex justify-center pointer-events-none px-4">
              <div style={getPreviewSubtitleStyle()}>
                {currentSubtitle}
              </div>
            </div>
          )}
          {/* Logo preview */}
          {logoUrl && (
            <div className="absolute top-3 right-3 pointer-events-none">
              <img src={logoUrl} alt="logo" className="w-12 h-12 object-contain rounded-lg opacity-90" />
            </div>
          )}
        </div>
      )}

      {/* Primary actions */}
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
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={cn('px-3 py-2 border rounded-lg text-sm flex items-center gap-2',
              showPreview ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}
          >
            <Eye className="w-4 h-4" /> {showPreview ? 'הסתר תצוגה' : 'תצוגה חיה'}
          </button>
        )}
      </div>

      {/* Panel tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto">
        {([
          { id: 'subtitles' as const, icon: Subtitles, label: 'כתוביות' },
          { id: 'style' as const, icon: Palette, label: 'עיצוב' },
          { id: 'music' as const, icon: Music, label: 'מוזיקה' },
          { id: 'logo' as const, icon: Crown, label: 'לוגו' },
          { id: 'stickers' as const, icon: Sticker, label: 'סטיקרים' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
              activePanel === tab.id
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Panel: Subtitles ── */}
      {activePanel === 'subtitles' && subtitleSegments.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              כתוביות ({subtitleSegments.length})
            </h4>
            <button
              onClick={() => addSegment(subtitleSegments.length - 1)}
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3 h-3" /> הוסף כתובית
            </button>
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            {subtitleSegments.map((seg, i) => (
              <div
                key={i}
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
                    <button onClick={() => addSegment(i)} title="הוסף"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                      <Plus className="w-3 h-3" />
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
                {i < subtitleSegments.length - 1 && (subtitleSegments[i + 1].start - seg.end) > 0.5 && (
                  <div className="mt-1 text-[10px] text-muted-foreground/70 text-center">
                    ⏸ רווח {(subtitleSegments[i + 1].start - seg.end).toFixed(1)}s
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Offset control */}
          <div className="bg-card border border-border rounded-lg p-3 mt-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">סנכרון כתוביות</label>
              <span className="text-xs font-medium text-primary">{subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s</span>
            </div>
            <input type="range" min="-3" max="3" step="0.1" value={subtitleOffset}
              onChange={e => setSubtitleOffset(Number(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between mt-1">
              <button onClick={() => setSubtitleOffset(o => Math.max(-3, o - 0.2))}
                className="text-[10px] text-muted-foreground hover:text-foreground">◀ מוקדם יותר</button>
              <button onClick={() => setSubtitleOffset(0)}
                className="text-[10px] text-primary hover:underline">איפוס</button>
              <button onClick={() => setSubtitleOffset(o => Math.min(3, o + 0.2))}
                className="text-[10px] text-muted-foreground hover:text-foreground">מאוחר יותר ▶</button>
            </div>
          </div>
        </div>
      )}

      {activePanel === 'subtitles' && subtitleSegments.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Subtitles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">לחץ "תמלל אוטומטית" כדי להתחיל</p>
        </div>
      )}

      {/* ── Panel: Style ── */}
      {activePanel === 'style' && (
        <div className="space-y-4">
          {/* Presets */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">סגנון כתוביות</h4>
            <div className="grid grid-cols-2 gap-2">
              {subtitlePresets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setSelectedPreset(preset.id);
                    setCustomColor(preset.color);
                    setCustomFontSize(preset.fontSize);
                  }}
                  className={cn(
                    'p-3 rounded-lg border text-right transition-all',
                    selectedPreset === preset.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  <div className="text-sm font-medium">{preset.label}</div>
                  <div
                    className="mt-1.5 text-xs px-2 py-1 rounded inline-block"
                    style={{
                      fontFamily: preset.font,
                      color: preset.color,
                      backgroundColor: preset.bgColor === 'transparent' ? 'rgba(0,0,0,0.5)' : preset.bgColor,
                      fontWeight: preset.fontWeight,
                      textShadow: preset.shadow,
                    }}
                    dir="rtl"
                  >
                    דוגמה לכתובית
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom color */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">צבע טקסט</h4>
            <div className="flex gap-2">
              {colorOptions.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCustomColor(c.value)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    c.tw,
                    customColor === c.value ? 'border-primary scale-110 shadow-lg' : 'border-border/50'
                  )}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Font size */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">גודל טקסט</h4>
            <div className="flex gap-2">
              {fontSizeOptions.map(s => (
                <button
                  key={s.value}
                  onClick={() => setCustomFontSize(s.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-xs transition-all',
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
        </div>
      )}

      {/* ── Panel: Music ── */}
      {activePanel === 'music' && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">מוזיקת רקע</h4>
          <div className="grid grid-cols-2 gap-2">
            {bgMusicOptions.map(m => (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedMusic(m.id);
                  if (m.id !== 'none') generateMusic(m.id);
                  else setMusicAudioUrl(null);
                }}
                className={cn(
                  'px-3 py-2.5 rounded-lg text-sm border transition-all text-right',
                  selectedMusic === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          {musicLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> מייצר מוזיקת רקע...
            </div>
          )}
          {musicAudioUrl && (
            <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border/50">
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
      )}

      {/* ── Panel: Logo ── */}
      {activePanel === 'logo' && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">לוגו העסק</h4>
          {logoUrl ? (
            <div className="flex items-center gap-4 bg-muted/30 rounded-lg p-4 border border-border/50">
              <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-border" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">הלוגו יופיע בפינה הימנית העליונה</p>
                <button
                  onClick={() => setLogoUrl(null)}
                  className="text-xs text-destructive hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> הסר לוגו
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => logoInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 transition-all"
            >
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                }}
              />
              {logoUploading ? (
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
              ) : (
                <>
                  <Image className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">לחץ להעלאת לוגו</p>
                  <p className="text-xs text-muted-foreground/70">PNG, SVG, JPG</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Panel: Stickers ── */}
      {activePanel === 'stickers' && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">סטיקרים ואייקונים</h4>
          <div className="flex flex-wrap gap-2">
            {stickerOptions.map(emoji => (
              <button
                key={emoji}
                onClick={() => addSticker(emoji)}
                className="w-10 h-10 rounded-lg border border-border hover:bg-muted hover:border-primary/40 flex items-center justify-center text-xl transition-all"
              >
                {emoji}
              </button>
            ))}
          </div>
          {stickers.length > 0 && (
            <div className="space-y-2 mt-2">
              <h5 className="text-xs font-medium text-muted-foreground">סטיקרים שנוספו ({stickers.length})</h5>
              {stickers.map(sticker => (
                <div key={sticker.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2 border border-border/50">
                  <span className="text-xl">{sticker.emoji}</span>
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
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={sticker.startTime}
                    onChange={e => setStickers(prev => prev.map(s =>
                      s.id === sticker.id ? { ...s, startTime: Number(e.target.value) } : s
                    ))}
                    className="w-14 bg-background border border-border rounded px-1.5 py-1 text-xs text-center"
                    title="זמן התחלה"
                  />
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={sticker.duration}
                    onChange={e => setStickers(prev => prev.map(s =>
                      s.id === sticker.id ? { ...s, duration: Number(e.target.value) } : s
                    ))}
                    className="w-14 bg-background border border-border rounded px-1.5 py-1 text-xs text-center"
                    title="משך (שניות)"
                  />
                  <button onClick={() => removeSticker(sticker.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom action bar */}
      <div className="flex gap-2 pt-2 border-t border-border/50">
        <button onClick={() => setStep(0)}
          className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5">
          <ArrowRight className="w-3.5 h-3.5" /> החלף סרטון
        </button>
        <div className="flex-1" />
        {subtitleSegments.length > 0 && (
          <>
            <button
              onClick={() => {
                const srt = subtitleService.toSRT(getAdjustedSegments());
                const blob = new Blob(['\uFEFF' + srt], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `subtitles-${Date.now()}.srt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                toast.success('הורד!');
              }}
              className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> SRT
            </button>
            <button
              onClick={handleRenderVideo}
              disabled={rendering}
              className="gradient-gold text-primary-foreground px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
              {rendering ? `מרכיב... ${Math.round(renderProgress)}%` : 'הרכב סרטון סופי 🎬'}
            </button>
          </>
        )}
      </div>

      {/* Render progress */}
      {rendering && (
        <div className="bg-card border border-primary/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">מרכיב סרטון עם כתוביות, לוגו ומוזיקה...</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="gradient-gold h-2 rounded-full transition-all duration-500"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Rendered result */}
      {renderedVideoUrl && (
        <div className="bg-card border border-green-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-sm font-bold">הסרטון מוכן!</span>
          </div>
          <video src={renderedVideoUrl} controls className="w-full rounded-lg max-h-[300px]" />
          <div className="flex gap-2">
            <a
              href={renderedVideoUrl}
              download={`edited-video-${Date.now()}.mp4`}
              className="flex-1 gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> הורד סרטון
            </a>
          </div>
        </div>
      )}
    </div>
  );

  return null;
}
