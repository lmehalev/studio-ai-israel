import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Loader2, Upload, Eye, Save, Download, ArrowRight,
  Subtitles, Check, X, Plus, Trash2, Scissors, Music,
  Smile, Type, Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { subtitleService, type SubtitleSegment, type Brand } from '@/services/creativeService';

const subtitleFontOptions = [
  { value: 'font-heebo', label: 'Heebo (ברירת מחדל)' },
  { value: 'font-rubik', label: 'Rubik' },
  { value: 'font-noto-hebrew', label: 'Noto Sans Hebrew' },
  { value: 'font-sans', label: 'Sans' },
  { value: 'font-serif', label: 'Serif' },
] as const;

const subtitleSizeOptions = [
  { value: 'text-xs', label: 'קטן' },
  { value: 'text-sm', label: 'רגיל' },
  { value: 'text-base', label: 'בינוני' },
  { value: 'text-lg', label: 'גדול' },
  { value: 'text-xl', label: 'גדול מאוד' },
] as const;

const subtitleColorOptions = [
  { value: 'text-foreground', label: 'לבן', preview: 'bg-white' },
  { value: 'text-primary', label: 'זהב', preview: 'bg-amber-400' },
  { value: 'text-green-400', label: 'ירוק', preview: 'bg-green-400' },
  { value: 'text-blue-400', label: 'כחול', preview: 'bg-blue-400' },
  { value: 'text-red-400', label: 'אדום', preview: 'bg-red-400' },
] as const;

const emojiOptions = ['🔥', '✨', '👆', '💡', '⭐', '🎯', '💪', '❤️', '👇', '📌', '🚀', '💰'];

const bgMusicOptions = [
  { id: 'none', label: 'ללא מוזיקה' },
  { id: 'upbeat', label: '🎵 אנרגטי ושמח', prompt: 'upbeat energetic background music, corporate, positive' },
  { id: 'calm', label: '🎶 רגוע ומקצועי', prompt: 'calm professional background music, soft piano, corporate' },
  { id: 'dramatic', label: '🎼 דרמטי', prompt: 'dramatic cinematic background music, inspiring, epic' },
  { id: 'modern', label: '🎧 מודרני', prompt: 'modern electronic background music, tech, trendy' },
];

interface SubtitleEditorProps {
  activeBrand: Brand | undefined;
  onBack: () => void;
}

export function SubtitleEditor({ activeBrand, onBack }: SubtitleEditorProps) {
  const [step, setStep] = useState(0);
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
  const [subtitleSizeClass, setSubtitleSizeClass] = useState<string>('text-sm');
  const [subtitleColorClass, setSubtitleColorClass] = useState<string>('text-foreground');
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Background music
  const [selectedMusic, setSelectedMusic] = useState('none');
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicAudioUrl, setMusicAudioUrl] = useState<string | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);

  const getAdjustedSegments = useCallback(() => {
    return subtitleSegments
      .map((seg) => ({
        ...seg,
        start: Math.max(0, Number((seg.start + subtitleOffset).toFixed(2))),
        end: Math.max(Math.max(0, Number((seg.start + subtitleOffset).toFixed(2))) + 0.1, Number((seg.end + subtitleOffset).toFixed(2))),
      }))
      .sort((a, b) => a.start - b.start);
  }, [subtitleSegments, subtitleOffset]);

  // Segment management
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

  // Background music
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
      toast.error(e.message || 'שגיאה ביצירת מוזיקה. ודא ש-ELEVENLABS_API_KEY מוגדר.');
    } finally {
      setMusicLoading(false);
    }
  };

  // Step 0: Upload
  if (step === 0) return (
    <div className="space-y-4">
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault(); setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && file.type.startsWith('video/')) { setVideoFile(file); setVideoPreviewUrl(URL.createObjectURL(file)); setStep(1); }
          else toast.error('יש להעלות קובץ וידאו');
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
        )}
      >
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { setVideoFile(f); setVideoPreviewUrl(URL.createObjectURL(f)); setStep(1); } }} />
        <Upload className={cn('w-10 h-10 mx-auto mb-3', isDragging ? 'text-primary' : 'text-muted-foreground')} />
        <p className="text-sm font-medium">גרור סרטון לכאן או לחץ לבחירה</p>
        <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM</p>
      </div>
    </div>
  );

  // Step 1: Edit
  if (step === 1) return (
    <div className="space-y-4">
      {/* Video preview */}
      {videoPreviewUrl && (
        <div className="rounded-xl overflow-hidden border border-border relative">
          <video ref={videoPreviewRef} src={videoPreviewUrl} controls className="w-full max-h-[300px]"
            onTimeUpdate={() => {
              if (!videoPreviewRef.current) return;
              const t = videoPreviewRef.current.currentTime;
              const active = getAdjustedSegments().find(s => t >= s.start && t <= s.end);
              setCurrentSubtitle(active?.text || '');
            }} />
          {showPreview && currentSubtitle && (
            <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none px-4">
              <div className={cn('bg-background/85 border border-border/70 px-4 py-2 rounded-lg font-medium max-w-[90%] text-center', subtitleFontClass, subtitleSizeClass, subtitleColorClass)} dir="rtl">
                {currentSubtitle}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
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
            setShowPreview(true);
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
            <button onClick={() => setStep(2)} className="px-4 py-2.5 border border-primary/30 bg-primary/5 text-primary rounded-lg text-sm flex items-center gap-2 hover:bg-primary/10">
              שמור / הורד <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </>
        )}
      </div>

      {/* Style controls */}
      {subtitleSegments.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">עיצוב כתוביות</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Font */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Type className="w-3 h-3" /> פונט</label>
              <select value={subtitleFontClass} onChange={e => setSubtitleFontClass(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {subtitleFontOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            {/* Size */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">גודל</label>
              <select value={subtitleSizeClass} onChange={e => setSubtitleSizeClass(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {subtitleSizeOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {/* Color */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Palette className="w-3 h-3" /> צבע</label>
              <div className="flex gap-2">
                {subtitleColorOptions.map(c => (
                  <button key={c.value} onClick={() => setSubtitleColorClass(c.value)}
                    className={cn('w-7 h-7 rounded-full border-2 transition-all', c.preview, subtitleColorClass === c.value ? 'border-primary scale-110' : 'border-border')}
                    title={c.label} />
                ))}
              </div>
            </div>
          </div>
          {/* Offset */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">השהיית כתוביות (סנכרון)</label>
              <span className="text-xs font-medium text-primary">{subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s</span>
            </div>
            <input type="range" min="-2" max="2" step="0.1" value={subtitleOffset} onChange={e => setSubtitleOffset(Number(e.target.value))} className="w-full accent-primary" />
          </div>
        </div>
      )}

      {/* Background music */}
      {subtitleSegments.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider"><Music className="w-3.5 h-3.5" /> מוזיקת רקע</h4>
          <div className="flex flex-wrap gap-2">
            {bgMusicOptions.map(m => (
              <button key={m.id} onClick={() => {
                setSelectedMusic(m.id);
                if (m.id !== 'none') generateMusic(m.id);
                else setMusicAudioUrl(null);
              }}
                className={cn('px-3 py-2 rounded-lg text-xs border transition-all',
                  selectedMusic === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>
                {m.label}
              </button>
            ))}
          </div>
          {musicLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> מייצר מוזיקת רקע...
            </div>
          )}
          {musicAudioUrl && (
            <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border/50">
              <button onClick={() => {
                if (!musicAudioRef.current) return;
                if (musicPlaying) musicAudioRef.current.pause();
                else musicAudioRef.current.play();
                setMusicPlaying(!musicPlaying);
              }} className="w-8 h-8 gradient-gold text-primary-foreground rounded-full flex items-center justify-center text-xs">
                {musicPlaying ? '⏸' : '▶'}
              </button>
              <audio ref={musicAudioRef} src={musicAudioUrl} onEnded={() => setMusicPlaying(false)} className="flex-1 h-8" controls />
              <a href={musicAudioUrl} download={`bg-music-${Date.now()}.mp3`} className="p-2 border border-border rounded-lg hover:bg-muted">
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Editable segments */}
      {subtitleSegments.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">כתוביות ({subtitleSegments.length})</h4>
            <button onClick={() => addSegment(subtitleSegments.length - 1)}
              className="text-xs text-primary flex items-center gap-1 hover:underline">
              <Plus className="w-3 h-3" /> הוסף כתובית
            </button>
          </div>
          <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
            {subtitleSegments.map((seg, i) => (
              <div key={i} className={cn(
                'bg-muted/30 rounded-lg p-3 border transition-all',
                editingIndex === i ? 'border-primary/50 bg-primary/5' : 'border-border/50'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  {/* Time inputs */}
                  <input type="number" step="0.1" min="0" value={seg.start}
                    onChange={e => updateSegment(i, { start: Number(e.target.value) })}
                    className="w-16 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                    title="זמן התחלה" />
                  <span className="text-xs text-muted-foreground">—</span>
                  <input type="number" step="0.1" min="0" value={seg.end}
                    onChange={e => updateSegment(i, { end: Number(e.target.value) })}
                    className="w-16 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                    title="זמן סיום" />
                  <span className="text-[10px] text-muted-foreground">({(seg.end - seg.start).toFixed(1)}s)</span>

                  <div className="mr-auto flex items-center gap-1">
                    <button onClick={() => seekToSegment(seg)} title="נגן מכאן"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">▶</button>
                    <button onClick={() => splitSegment(i)} title="פצל"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                      <Scissors className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => addSegment(i)} title="הוסף אחרי"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteSegment(i)} title="מחק"
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Text */}
                <input value={seg.text}
                  onFocus={() => setEditingIndex(i)}
                  onChange={e => updateSegment(i, { text: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  dir="rtl" placeholder="טקסט כתובית..." />
                {/* Emoji row */}
                {editingIndex === i && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {emojiOptions.map(emoji => (
                      <button key={emoji} onClick={() => addEmoji(i, emoji)}
                        className="w-7 h-7 rounded hover:bg-muted text-sm flex items-center justify-center">{emoji}</button>
                    ))}
                  </div>
                )}
                {/* Gap indicator */}
                {i < subtitleSegments.length - 1 && (subtitleSegments[i + 1].start - seg.end) > 0.5 && (
                  <div className="mt-1.5 text-[10px] text-muted-foreground/70 text-center">
                    ⏸ רווח {(subtitleSegments[i + 1].start - seg.end).toFixed(1)} שניות
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Step 2: Save
  if (step === 2) return (
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
      {musicAudioUrl && (
        <div className="bg-card border border-border rounded-xl p-4 text-center space-y-2">
          <p className="text-sm font-medium">🎵 מוזיקת רקע</p>
          <a href={musicAudioUrl} download={`bg-music-${Date.now()}.mp3`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <Download className="w-4 h-4" /> הורד MP3 מוזיקת רקע
          </a>
        </div>
      )}
    </div>
  );

  return null;
}
