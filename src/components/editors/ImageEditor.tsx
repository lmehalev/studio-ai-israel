import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Type, Smile, Download, RotateCcw, RotateCw, FlipHorizontal,
  Crop, Palette, Sun, Contrast, Wand2, X, Plus, Trash2, Move,
  Bold, Italic, AlignCenter, AlignRight, AlignLeft, Loader2, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { imageService } from '@/services/creativeService';

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: string;
  fontStyle: string;
  textAlign: string;
}

interface IconOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
}

interface ImageEditorProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  onSave?: (editedUrl: string) => void;
}

const EMOJI_OPTIONS = ['🎯', '💡', '🔥', '⭐', '✅', '❤️', '🚀', '💰', '📌', '🏆', '👍', '📣', '🎬', '💎', '🌟', '📈'];

const FILTER_PRESETS = [
  { name: 'ללא', brightness: 100, contrast: 100, saturate: 100, sepia: 0, hueRotate: 0 },
  { name: 'חם', brightness: 105, contrast: 105, saturate: 120, sepia: 15, hueRotate: 0 },
  { name: 'קר', brightness: 100, contrast: 110, saturate: 80, sepia: 0, hueRotate: 180 },
  { name: 'דרמטי', brightness: 90, contrast: 140, saturate: 110, sepia: 0, hueRotate: 0 },
  { name: 'וינטג\'', brightness: 100, contrast: 90, saturate: 70, sepia: 40, hueRotate: 0 },
  { name: 'שחור לבן', brightness: 100, contrast: 120, saturate: 0, sepia: 0, hueRotate: 0 },
];

type ActiveTool = 'none' | 'text' | 'icons' | 'filters' | 'adjust' | 'ai';

export function ImageEditor({ open, onClose, imageUrl, onSave }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>('none');
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [iconOverlays, setIconOverlays] = useState<IconOverlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Filters
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);

  // AI edit
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);

  // New text input
  const [newText, setNewText] = useState('');
  const [newTextColor, setNewTextColor] = useState('#ffffff');
  const [newTextSize, setNewTextSize] = useState(32);

  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 0, h: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setCurrentImageUrl(imageUrl);
    setTextOverlays([]);
    setIconOverlays([]);
    setBrightness(100);
    setContrast(100);
    setSaturate(100);
    setRotation(0);
    setFlipH(false);
    setActiveTool('none');
  }, [imageUrl, open]);

  useEffect(() => {
    if (!open || !currentImageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = currentImageUrl;
  }, [currentImageUrl, open]);

  const filterStyle = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;

  const applyFilter = (preset: typeof FILTER_PRESETS[0]) => {
    setBrightness(preset.brightness);
    setContrast(preset.contrast);
    setSaturate(preset.saturate);
  };

  const addText = () => {
    if (!newText.trim()) return;
    setTextOverlays(prev => [...prev, {
      id: `t-${Date.now()}`,
      text: newText,
      x: 50, y: 50,
      fontSize: newTextSize,
      color: newTextColor,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'center',
    }]);
    setNewText('');
  };

  const addIcon = (emoji: string) => {
    setIconOverlays(prev => [...prev, {
      id: `i-${Date.now()}`,
      emoji,
      x: 50 + Math.random() * 200,
      y: 50 + Math.random() * 200,
      size: 48,
    }]);
  };

  const deleteOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(t => t.id !== id));
    setIconOverlays(prev => prev.filter(i => i.id !== id));
    if (selectedOverlayId === id) setSelectedOverlayId(null);
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDragging(id);
    setSelectedOverlayId(id);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;

    setTextOverlays(prev => prev.map(t => t.id === dragging ? { ...t, x, y } : t));
    setIconOverlays(prev => prev.map(i => i.id === dragging ? { ...i, x, y } : i));
  }, [dragging, dragOffset]);

  const handleMouseUp = () => setDragging(null);

  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const result = await imageService.edit(aiPrompt, currentImageUrl);
      if (result.imageUrl) {
        setCurrentImageUrl(result.imageUrl);
        toast.success('התמונה עודכנה בהצלחה!');
        setAiPrompt('');
      }
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בעריכת AI');
    } finally {
      setAiLoading(false);
    }
  };

  const exportImage = useCallback(async () => {
    const canvas = document.createElement('canvas');
    const img = imgRef.current;
    if (!img) return null;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.filter = filterStyle;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    if (flipH) ctx.scale(-1, 1);
    ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
    ctx.restore();
    ctx.filter = 'none';

    // Scale overlays from display to natural
    const container = containerRef.current;
    if (container) {
      const scaleX = canvas.width / container.clientWidth;
      const scaleY = canvas.height / container.clientHeight;

      for (const t of textOverlays) {
        ctx.save();
        ctx.font = `${t.fontStyle} ${t.fontWeight} ${t.fontSize * scaleX}px 'Noto Sans Hebrew', sans-serif`;
        ctx.fillStyle = t.color;
        ctx.textAlign = t.textAlign as CanvasTextAlign;
        ctx.direction = 'rtl';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4 * scaleX;
        ctx.fillText(t.text, t.x * scaleX, t.y * scaleY + t.fontSize * scaleX);
        ctx.restore();
      }

      for (const i of iconOverlays) {
        ctx.save();
        ctx.font = `${i.size * scaleX}px serif`;
        ctx.fillText(i.emoji, i.x * scaleX, i.y * scaleY + i.size * scaleX);
        ctx.restore();
      }
    }

    return canvas.toDataURL('image/png');
  }, [filterStyle, rotation, flipH, textOverlays, iconOverlays]);

  const handleDownload = async () => {
    const dataUrl = await exportImage();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'edited-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('התמונה הורדה!');
  };

  const handleSave = async () => {
    const dataUrl = await exportImage();
    if (dataUrl && onSave) {
      onSave(dataUrl);
    }
  };

  const tools: { id: ActiveTool; icon: any; label: string }[] = [
    { id: 'text', icon: Type, label: 'טקסט' },
    { id: 'icons', icon: Smile, label: 'אייקונים' },
    { id: 'filters', icon: Palette, label: 'פילטרים' },
    { id: 'adjust', icon: Sun, label: 'כיוונון' },
    { id: 'ai', icon: Wand2, label: 'עריכת AI' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[85vh] p-0 flex flex-col overflow-hidden" aria-describedby={undefined}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">עורך תמונות</span>
          </div>
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
              <button key={tool.id} onClick={() => setActiveTool(activeTool === tool.id ? 'none' : tool.id)}
                className={cn('w-10 h-10 rounded-lg flex flex-col items-center justify-center text-[10px] gap-0.5 transition-colors',
                  activeTool === tool.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                <tool.icon className="w-4 h-4" />
                <span>{tool.label}</span>
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => setRotation(r => r - 90)}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => setRotation(r => r + 90)}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
              <RotateCw className="w-4 h-4" />
            </button>
            <button onClick={() => setFlipH(f => !f)}
              className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted',
                flipH && 'bg-primary/20 text-primary')}>
              <FlipHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Side Panel */}
          {activeTool !== 'none' && (
            <div className="w-64 bg-card border-l border-border p-3 overflow-y-auto space-y-3">
              {activeTool === 'text' && (
                <>
                  <h4 className="text-sm font-semibold">הוסף טקסט</h4>
                  <Input value={newText} onChange={e => setNewText(e.target.value)} placeholder="כתוב טקסט..."
                    className="text-sm" dir="rtl" onKeyDown={e => e.key === 'Enter' && addText()} />
                  <div className="flex gap-2 items-center">
                    <input type="color" value={newTextColor} onChange={e => setNewTextColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                    <Input type="number" value={newTextSize} onChange={e => setNewTextSize(+e.target.value)} className="w-20 text-sm" min={12} max={120} />
                    <Button size="sm" onClick={addText}><Plus className="w-4 h-4" /></Button>
                  </div>
                  {textOverlays.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <h5 className="text-xs text-muted-foreground">שכבות טקסט</h5>
                      {textOverlays.map(t => (
                        <div key={t.id} className={cn('flex items-center gap-2 p-2 rounded-lg text-sm border cursor-pointer',
                          selectedOverlayId === t.id ? 'border-primary bg-primary/10' : 'border-border')}
                          onClick={() => setSelectedOverlayId(t.id)}>
                          <span className="flex-1 truncate" dir="rtl">{t.text}</span>
                          <button onClick={(e) => { e.stopPropagation(); deleteOverlay(t.id); }}
                            className="text-destructive hover:text-destructive/80"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTool === 'icons' && (
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
                    <div className="space-y-2 mt-3">
                      <h5 className="text-xs text-muted-foreground">אייקונים על התמונה</h5>
                      {iconOverlays.map(i => (
                        <div key={i.id} className={cn('flex items-center gap-2 p-2 rounded-lg border',
                          selectedOverlayId === i.id ? 'border-primary bg-primary/10' : 'border-border')}>
                          <span className="text-xl">{i.emoji}</span>
                          <Slider value={[i.size]} min={20} max={120} step={4}
                            onValueChange={([v]) => setIconOverlays(prev => prev.map(ic => ic.id === i.id ? { ...ic, size: v } : ic))} className="flex-1" />
                          <button onClick={() => deleteOverlay(i.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTool === 'filters' && (
                <>
                  <h4 className="text-sm font-semibold">פילטרים</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {FILTER_PRESETS.map(f => (
                      <button key={f.name} onClick={() => applyFilter(f)}
                        className={cn('p-2 rounded-lg border text-xs font-medium text-center transition-colors',
                          brightness === f.brightness && contrast === f.contrast && saturate === f.saturate
                            ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>
                        {f.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {activeTool === 'adjust' && (
                <>
                  <h4 className="text-sm font-semibold">כיוונון</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground flex justify-between"><span>בהירות</span><span>{brightness}%</span></label>
                      <Slider value={[brightness]} min={50} max={200} step={1} onValueChange={([v]) => setBrightness(v)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground flex justify-between"><span>ניגודיות</span><span>{contrast}%</span></label>
                      <Slider value={[contrast]} min={50} max={200} step={1} onValueChange={([v]) => setContrast(v)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground flex justify-between"><span>רוויה</span><span>{saturate}%</span></label>
                      <Slider value={[saturate]} min={0} max={200} step={1} onValueChange={([v]) => setSaturate(v)} />
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => { setBrightness(100); setContrast(100); setSaturate(100); }}>
                      <RotateCcw className="w-3.5 h-3.5 ml-1" /> איפוס
                    </Button>
                  </div>
                </>
              )}

              {activeTool === 'ai' && (
                <>
                  <h4 className="text-sm font-semibold">עריכת AI</h4>
                  <p className="text-xs text-muted-foreground">תאר מה לשנות בתמונה והבינה המלאכותית תבצע</p>
                  <Input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="לדוגמה: הוסף שקיעה ברקע..."
                    dir="rtl" className="text-sm" onKeyDown={e => e.key === 'Enter' && handleAiEdit()} />
                  <Button size="sm" className="w-full" onClick={handleAiEdit} disabled={aiLoading || !aiPrompt.trim()}>
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Wand2 className="w-4 h-4 ml-1" />}
                    {aiLoading ? 'מעבד...' : 'בצע שינוי'}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Canvas Area */}
          <div className="flex-1 bg-muted/20 flex items-center justify-center p-4 overflow-hidden"
            onClick={() => setSelectedOverlayId(null)}>
            <div ref={containerRef} className="relative inline-block max-w-full max-h-full"
              onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
              <img src={currentImageUrl} alt="editing" crossOrigin="anonymous"
                className="max-w-full max-h-[70vh] rounded-lg shadow-lg object-contain"
                style={{
                  filter: filterStyle,
                  transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
                  transition: 'filter 0.2s, transform 0.3s',
                }} />

              {/* Text overlays */}
              {textOverlays.map(t => (
                <div key={t.id} className={cn('absolute cursor-move select-none',
                  selectedOverlayId === t.id && 'ring-2 ring-primary ring-offset-1 rounded')}
                  style={{
                    left: t.x, top: t.y,
                    fontSize: t.fontSize, color: t.color,
                    fontWeight: t.fontWeight, fontStyle: t.fontStyle,
                    textAlign: t.textAlign as any,
                    textShadow: '0 2px 6px rgba(0,0,0,0.5)',
                    fontFamily: "'Noto Sans Hebrew', sans-serif",
                    direction: 'rtl',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseDown={e => handleMouseDown(e, t.id)}>
                  {t.text}
                </div>
              ))}

              {/* Icon overlays */}
              {iconOverlays.map(i => (
                <div key={i.id} className={cn('absolute cursor-move select-none',
                  selectedOverlayId === i.id && 'ring-2 ring-primary ring-offset-1 rounded')}
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
