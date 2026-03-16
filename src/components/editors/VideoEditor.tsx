import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Play, Pause, SkipBack, SkipForward, Scissors, Type, Smile,
  Download, Volume2, VolumeX, Repeat, Loader2, Save, RotateCcw,
  Plus, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  startTime: number;
  endTime: number;
}

interface IconOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
  startTime: number;
  endTime: number;
}

interface VideoEditorProps {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  onSave?: (editedData: { trimStart: number; trimEnd: number; texts: TextOverlay[]; icons: IconOverlay[] }) => void;
}

const EMOJI_OPTIONS = ['🎯', '💡', '🔥', '⭐', '✅', '❤️', '🚀', '💰', '📌', '🏆', '👍', '📣', '🎬', '💎', '🌟', '📈'];

type ActivePanel = 'none' | 'trim' | 'text' | 'icons';

export function VideoEditor({ open, onClose, videoUrl, onSave }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');

  // Trim
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Overlays
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [iconOverlays, setIconOverlays] = useState<IconOverlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // New text
  const [newText, setNewText] = useState('');
  const [newTextColor, setNewTextColor] = useState('#ffffff');

  useEffect(() => {
    if (open) {
      setIsPlaying(false);
      setCurrent(0);
      setTrimStart(0);
      setTrimEnd(0);
      setTextOverlays([]);
      setIconOverlays([]);
      setActivePanel('none');
    }
  }, [open, videoUrl]);

  const video = videoRef.current;

  const onLoadedMetadata = () => {
    if (video) {
      setDuration(video.duration);
      setTrimEnd(video.duration);
    }
  };

  const onTimeUpdate = () => {
    if (!video) return;
    setCurrent(video.currentTime);
    // Enforce trim bounds
    if (video.currentTime >= trimEnd) {
      if (loop) {
        video.currentTime = trimStart;
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }
  };

  const togglePlay = () => {
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
      }
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seekTo = (time: number) => {
    if (!video) return;
    video.currentTime = Math.max(trimStart, Math.min(time, trimEnd));
    setCurrent(video.currentTime);
  };

  const skip = (delta: number) => seekTo(currentTime + delta);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const addText = () => {
    if (!newText.trim()) return;
    const start = currentTime;
    const end = Math.min(start + 5, trimEnd);
    setTextOverlays(prev => [...prev, {
      id: `t-${Date.now()}`,
      text: newText,
      x: 50, y: 50,
      fontSize: 28,
      color: newTextColor,
      startTime: start,
      endTime: end,
    }]);
    setNewText('');
  };

  const addIcon = (emoji: string) => {
    const start = currentTime;
    const end = Math.min(start + 3, trimEnd);
    setIconOverlays(prev => [...prev, {
      id: `i-${Date.now()}`,
      emoji,
      x: 80 + Math.random() * 100,
      y: 80 + Math.random() * 100,
      size: 48,
      startTime: start,
      endTime: end,
    }]);
  };

  const deleteOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(t => t.id !== id));
    setIconOverlays(prev => prev.filter(i => i.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDragging(id);
    setSelectedId(id);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const container = (e.currentTarget as HTMLElement);
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    setTextOverlays(prev => prev.map(t => t.id === dragging ? { ...t, x, y } : t));
    setIconOverlays(prev => prev.map(i => i.id === dragging ? { ...i, x, y } : i));
  }, [dragging, dragOffset]);

  const handleMouseUp = () => setDragging(null);

  // Visible overlays at current time
  const visibleTexts = textOverlays.filter(t => currentTime >= t.startTime && currentTime <= t.endTime);
  const visibleIcons = iconOverlays.filter(i => currentTime >= i.startTime && currentTime <= i.endTime);

  const timelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seekTo(pct * duration);
  };

  const handleSave = () => {
    if (onSave) {
      onSave({ trimStart, trimEnd, texts: textOverlays, icons: iconOverlays });
      toast.success('העריכה נשמרה!');
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'edited-video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('הסרטון הורד!');
    } catch {
      window.open(videoUrl, '_blank');
    }
  };

  const tools: { id: ActivePanel; icon: any; label: string }[] = [
    { id: 'trim', icon: Scissors, label: 'חיתוך' },
    { id: 'text', icon: Type, label: 'טקסט' },
    { id: 'icons', icon: Smile, label: 'אייקונים' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[85vh] p-0 flex flex-col overflow-hidden" aria-describedby={undefined}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <span className="text-sm font-semibold">עורך וידאו</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 ml-1" /> הורד
            </Button>
            {onSave && (
              <Button size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 ml-1" /> שמור
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Toolbar */}
          <div className="w-14 bg-card border-l border-border flex flex-col items-center py-3 gap-1">
            {tools.map(tool => (
              <button key={tool.id} onClick={() => setActivePanel(activePanel === tool.id ? 'none' : tool.id)}
                className={cn('w-10 h-10 rounded-lg flex flex-col items-center justify-center text-[10px] gap-0.5 transition-colors',
                  activePanel === tool.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                <tool.icon className="w-4 h-4" />
                <span>{tool.label}</span>
              </button>
            ))}
          </div>

          {/* Side Panel */}
          {activePanel !== 'none' && (
            <div className="w-64 bg-card border-l border-border p-3 overflow-y-auto space-y-3">
              {activePanel === 'trim' && (
                <>
                  <h4 className="text-sm font-semibold">חיתוך סרטון</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground flex justify-between">
                        <span>התחלה</span><span>{formatTime(trimStart)}</span>
                      </label>
                      <Slider value={[trimStart]} min={0} max={duration} step={0.1}
                        onValueChange={([v]) => { setTrimStart(v); if (v > trimEnd) setTrimEnd(v); }} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground flex justify-between">
                        <span>סוף</span><span>{formatTime(trimEnd)}</span>
                      </label>
                      <Slider value={[trimEnd]} min={0} max={duration} step={0.1}
                        onValueChange={([v]) => { setTrimEnd(v); if (v < trimStart) setTrimStart(v); }} />
                    </div>
                    <div className="text-xs text-muted-foreground text-center">
                      אורך: {formatTime(trimEnd - trimStart)}
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => { setTrimStart(0); setTrimEnd(duration); }}>
                      <RotateCcw className="w-3.5 h-3.5 ml-1" /> איפוס
                    </Button>
                  </div>
                </>
              )}

              {activePanel === 'text' && (
                <>
                  <h4 className="text-sm font-semibold">הוסף כתובית</h4>
                  <Input value={newText} onChange={e => setNewText(e.target.value)} placeholder="כתוב טקסט..."
                    dir="rtl" className="text-sm" onKeyDown={e => e.key === 'Enter' && addText()} />
                  <div className="flex gap-2 items-center">
                    <input type="color" value={newTextColor} onChange={e => setNewTextColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                    <Button size="sm" className="flex-1" onClick={addText}><Plus className="w-4 h-4 ml-1" /> הוסף</Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">הטקסט יופיע מזמן {formatTime(currentTime)}</p>
                  {textOverlays.length > 0 && (
                    <div className="space-y-2 mt-2">
                      <h5 className="text-xs text-muted-foreground">שכבות טקסט</h5>
                      {textOverlays.map(t => (
                        <div key={t.id} className={cn('p-2 rounded-lg border text-sm space-y-1',
                          selectedId === t.id ? 'border-primary bg-primary/10' : 'border-border')}
                          onClick={() => setSelectedId(t.id)}>
                          <div className="flex items-center justify-between">
                            <span className="truncate flex-1" dir="rtl">{t.text}</span>
                            <button onClick={(e) => { e.stopPropagation(); deleteOverlay(t.id); }}
                              className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <div className="flex gap-1 text-[10px] text-muted-foreground">
                            <span>{formatTime(t.startTime)}</span>
                            <span>→</span>
                            <span>{formatTime(t.endTime)}</span>
                          </div>
                          <Slider value={[t.startTime, t.endTime]} min={0} max={duration} step={0.1}
                            onValueChange={([s, e]) => setTextOverlays(prev => prev.map(x => x.id === t.id ? { ...x, startTime: s, endTime: e } : x))} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activePanel === 'icons' && (
                <>
                  <h4 className="text-sm font-semibold">הוסף אייקונים</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {EMOJI_OPTIONS.map(e => (
                      <button key={e} onClick={() => addIcon(e)}
                        className="w-12 h-12 text-2xl rounded-lg border border-border hover:bg-muted flex items-center justify-center">
                        {e}
                      </button>
                    ))}
                  </div>
                  {iconOverlays.length > 0 && (
                    <div className="space-y-2 mt-2">
                      <h5 className="text-xs text-muted-foreground">אייקונים</h5>
                      {iconOverlays.map(i => (
                        <div key={i.id} className={cn('p-2 rounded-lg border flex items-center gap-2',
                          selectedId === i.id ? 'border-primary bg-primary/10' : 'border-border')}>
                          <span className="text-xl">{i.emoji}</span>
                          <div className="flex-1 text-[10px] text-muted-foreground">
                            {formatTime(i.startTime)} → {formatTime(i.endTime)}
                          </div>
                          <button onClick={() => deleteOverlay(i.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Video Area */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Video Preview */}
            <div className="flex-1 bg-black flex items-center justify-center relative"
              onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
              onClick={() => setSelectedId(null)}>
              <video ref={videoRef} src={videoUrl} className="max-w-full max-h-full"
                onLoadedMetadata={onLoadedMetadata} onTimeUpdate={onTimeUpdate}
                muted={muted} loop={false} playsInline />

              {/* Visible text overlays */}
              {visibleTexts.map(t => (
                <div key={t.id} className={cn('absolute cursor-move select-none',
                  selectedId === t.id && 'ring-2 ring-primary rounded')}
                  style={{
                    left: t.x, top: t.y,
                    fontSize: t.fontSize, color: t.color,
                    fontWeight: 'bold',
                    textShadow: '0 2px 8px rgba(0,0,0,0.7)',
                    fontFamily: "'Noto Sans Hebrew', sans-serif",
                    direction: 'rtl', whiteSpace: 'nowrap',
                  }}
                  onMouseDown={e => handleMouseDown(e, t.id)}>
                  {t.text}
                </div>
              ))}

              {/* Visible icon overlays */}
              {visibleIcons.map(i => (
                <div key={i.id} className={cn('absolute cursor-move select-none',
                  selectedId === i.id && 'ring-2 ring-primary rounded')}
                  style={{
                    left: i.x, top: i.y,
                    fontSize: i.size,
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                  }}
                  onMouseDown={e => handleMouseDown(e, i.id)}>
                  {i.emoji}
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="bg-card border-t border-border p-3 space-y-2">
              {/* Transport controls */}
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => skip(-5)} className="text-muted-foreground hover:text-foreground">
                  <SkipBack className="w-4 h-4" />
                </button>
                <button onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <button onClick={() => skip(5)} className="text-muted-foreground hover:text-foreground">
                  <SkipForward className="w-4 h-4" />
                </button>
                <button onClick={() => setLoop(!loop)}
                  className={cn('text-muted-foreground hover:text-foreground', loop && 'text-primary')}>
                  <Repeat className="w-4 h-4" />
                </button>
                <button onClick={() => setMuted(!muted)} className="text-muted-foreground hover:text-foreground">
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <div className="w-20">
                  <Slider value={[muted ? 0 : volume]} min={0} max={100} step={1}
                    onValueChange={([v]) => { setVolume(v); setMuted(v === 0); if (video) video.volume = v / 100; }} />
                </div>
                <span className="text-xs text-muted-foreground font-mono w-24 text-center">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Timeline bar */}
              <div ref={timelineRef} className="relative h-10 bg-muted/30 rounded-lg cursor-pointer overflow-hidden"
                onClick={timelineClick}>
                {/* Trim region */}
                <div className="absolute top-0 bottom-0 bg-primary/20 border-x-2 border-primary"
                  style={{
                    left: `${(trimStart / (duration || 1)) * 100}%`,
                    width: `${((trimEnd - trimStart) / (duration || 1)) * 100}%`,
                  }} />

                {/* Overlay markers on timeline */}
                {textOverlays.map(t => (
                  <div key={t.id} className="absolute top-0 h-3 bg-blue-500/60 rounded-sm"
                    style={{
                      left: `${(t.startTime / (duration || 1)) * 100}%`,
                      width: `${((t.endTime - t.startTime) / (duration || 1)) * 100}%`,
                    }} />
                ))}
                {iconOverlays.map(i => (
                  <div key={i.id} className="absolute bottom-0 h-3 bg-amber-500/60 rounded-sm"
                    style={{
                      left: `${(i.startTime / (duration || 1)) * 100}%`,
                      width: `${((i.endTime - i.startTime) / (duration || 1)) * 100}%`,
                    }} />
                ))}

                {/* Playhead */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
                  style={{ left: `${(currentTime / (duration || 1)) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
