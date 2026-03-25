import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Type, Smile, Download, RotateCcw, RotateCw, FlipHorizontal,
  Palette, Sun, Wand2, Plus, Trash2, Loader2, Save,
  Eye, EyeOff, Lock, Unlock, Copy, ArrowUp, ArrowDown,
  Square, Circle, Image as ImageIcon, ZoomIn, ZoomOut,
  Undo2, Redo2, MousePointer, GripVertical, Scissors, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { imageService } from '@/services/creativeService';
import { MaskPanel, type MaskTool, type MaskAction } from './MaskPanel';
import { ComponentsPanel, type DetectedComponent } from './ComponentsPanel';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

type LayerType = 'text' | 'icon' | 'shape' | 'image';

interface BaseLayer {
  id: string;
  type: LayerType;
  x: number; y: number;
  width: number; height: number;
  rotation: number; opacity: number;
  visible: boolean; locked: boolean;
  name: string;
}

interface TextLayer extends BaseLayer {
  type: 'text'; text: string; fontSize: number; color: string;
  fontWeight: string; fontStyle: string; textAlign: string;
  bgColor: string | null; strokeColor: string | null;
  strokeWidth: number; shadowEnabled: boolean;
}

interface IconLayer extends BaseLayer { type: 'icon'; emoji: string; fontSize: number; }
interface ShapeLayer extends BaseLayer { type: 'shape'; shape: 'rect' | 'circle'; fillColor: string; borderColor: string; borderWidth: number; }
interface ImageLayer extends BaseLayer { type: 'image'; src: string; }

type Layer = TextLayer | IconLayer | ShapeLayer | ImageLayer;

interface ImageEditorProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  onSave?: (editedUrl: string) => void;
}

type ActiveTool = 'select' | 'text' | 'icons' | 'shapes' | 'filters' | 'adjust' | 'ai' | 'images' | 'layers' | 'mask' | 'components';

// ── Mask shape types ──
type MaskShape =
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'circle'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'brush'; points: { x: number; y: number }[] };

// ── Constants ──

const EMOJI_OPTIONS = ['🎯', '💡', '🔥', '⭐', '✅', '❤️', '🚀', '💰', '📌', '🏆', '👍', '📣', '🎬', '💎', '🌟', '📈', '➡️', '⬅️', '🔔', '💬'];

const FILTER_PRESETS = [
  { name: 'ללא', brightness: 100, contrast: 100, saturate: 100 },
  { name: 'חם', brightness: 105, contrast: 105, saturate: 120 },
  { name: 'קר', brightness: 100, contrast: 110, saturate: 80 },
  { name: 'דרמטי', brightness: 90, contrast: 140, saturate: 110 },
  { name: 'וינטג\'', brightness: 100, contrast: 90, saturate: 70 },
  { name: 'שחור לבן', brightness: 100, contrast: 120, saturate: 0 },
];

const SHAPE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000', '#6b7280'];

const MAX_UNDO = 30;

let layerCounter = 0;
const nextId = () => `layer-${++layerCounter}-${Date.now()}`;

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

type Handle = 'nw' | 'ne' | 'sw' | 'se';

export function ImageEditor({ open, onClose, imageUrl, onSave }: ImageEditorProps) {
  // Canvas state
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 0, h: 0 });
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);

  // Layers
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Undo/redo
  const [undoStack, setUndoStack] = useState<Layer[][]>([]);
  const [redoStack, setRedoStack] = useState<Layer[][]>([]);

  // Zoom
  const [zoom, setZoom] = useState(1);

  // Filters
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [baseRotation, setBaseRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);

  // Tool
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');

  // Drag state
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize';
    layerId: string; startX: number; startY: number;
    origLayer: Layer; handle?: Handle;
  } | null>(null);

  // AI
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Text input
  const [newText, setNewText] = useState('');
  const [newTextColor, setNewTextColor] = useState('#ffffff');
  const [newTextSize, setNewTextSize] = useState(32);

  // Shape input
  const [newShapeType, setNewShapeType] = useState<'rect' | 'circle'>('rect');
  const [newShapeColor, setNewShapeColor] = useState('#3b82f6');

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── MASK STATE ──
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [maskTool, setMaskTool] = useState<MaskTool>('rect');
  const [maskShapes, setMaskShapes] = useState<MaskShape[]>([]);
  const [isDrawingMask, setIsDrawingMask] = useState(false);
  const [maskStart, setMaskStart] = useState<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState(30);
  const [feather, setFeather] = useState(5);
  const [maskProcessing, setMaskProcessing] = useState(false);
  const [maskPreviewUrl, setMaskPreviewUrl] = useState<string | null>(null);
  const [currentBrushPoints, setCurrentBrushPoints] = useState<{ x: number; y: number }[]>([]);

  // ── COMPONENTS STATE ──
  const [componentsAnalyzing, setComponentsAnalyzing] = useState(false);
  const [detectedComponents, setDetectedComponents] = useState<DetectedComponent[]>([]);

  // ── Undo helpers ──
  const pushUndo = useCallback((prev: Layer[]) => {
    setUndoStack(s => [...s.slice(-MAX_UNDO), prev]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack(r => [...r, layers]);
      setLayers(last);
      return prev.slice(0, -1);
    });
  }, [layers]);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack(u => [...u, layers]);
      setLayers(last);
      return prev.slice(0, -1);
    });
  }, [layers]);

  // ── Reset on open/url change ──
  useEffect(() => {
    setCurrentImageUrl(imageUrl);
    setLayers([]); setUndoStack([]); setRedoStack([]);
    setSelectedId(null);
    setBrightness(100); setContrast(100); setSaturate(100);
    setBaseRotation(0); setFlipH(false); setZoom(1);
    setActiveTool('select');
    setMaskShapes([]); setMaskPreviewUrl(null);
    setDetectedComponents([]);
    layerCounter = 0;
  }, [imageUrl, open]);

  // ── Load image ──
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

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          pushUndo(layers);
          setLayers(prev => prev.filter(l => l.id !== selectedId));
          setSelectedId(null);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedId) duplicateLayer(selectedId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, selectedId, layers, undo, redo]);

  // ── Redraw mask canvas ──
  const redrawMask = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing shapes
    ctx.fillStyle = 'rgba(255, 80, 80, 0.35)';
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)';
    ctx.lineWidth = 2;

    for (const shape of maskShapes) {
      if (shape.type === 'rect') {
        ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      } else if (shape.type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(shape.cx, shape.cy, Math.abs(shape.rx), Math.abs(shape.ry), 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else if (shape.type === 'brush') {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const p of shape.points) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw current brush stroke in progress
    if (isDrawingMask && maskTool === 'brush' && currentBrushPoints.length > 0) {
      for (const p of currentBrushPoints) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [maskShapes, isDrawingMask, maskTool, brushSize, currentBrushPoints]);

  useEffect(() => { redrawMask(); }, [redrawMask]);

  // ── Mask canvas sizing ──
  useEffect(() => {
    if (activeTool !== 'mask') return;
    const canvas = maskCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const imgEl = container.querySelector('img');
    if (!imgEl) return;
    canvas.width = imgEl.clientWidth;
    canvas.height = imgEl.clientHeight;
    redrawMask();
  }, [activeTool, imgNaturalSize, zoom, redrawMask]);

  // ── Layer operations ──
  const updateLayer = useCallback((id: string, updates: Partial<Layer>) => {
    pushUndo(layers);
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } as Layer : l));
  }, [layers, pushUndo]);

  const duplicateLayer = useCallback((id: string) => {
    const source = layers.find(l => l.id === id);
    if (!source) return;
    pushUndo(layers);
    const dup = { ...source, id: nextId(), name: source.name + ' (עותק)', x: source.x + 20, y: source.y + 20 };
    setLayers(prev => [...prev, dup]);
    setSelectedId(dup.id);
  }, [layers, pushUndo]);

  const moveLayerOrder = useCallback((id: string, direction: 'up' | 'down') => {
    pushUndo(layers);
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx < 0) return prev;
      const newArr = [...prev];
      const swapIdx = direction === 'up' ? idx + 1 : idx - 1;
      if (swapIdx < 0 || swapIdx >= newArr.length) return prev;
      [newArr[idx], newArr[swapIdx]] = [newArr[swapIdx], newArr[idx]];
      return newArr;
    });
  }, [layers, pushUndo]);

  const deleteLayer = useCallback((id: string) => {
    pushUndo(layers);
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [layers, selectedId, pushUndo]);

  // ── Add elements ──
  const addTextLayer = () => {
    if (!newText.trim()) return;
    pushUndo(layers);
    const id = nextId();
    const layer: TextLayer = {
      id, type: 'text', name: newText.slice(0, 20),
      x: 100, y: 100, width: 300, height: 60,
      rotation: 0, opacity: 1, visible: true, locked: false,
      text: newText, fontSize: newTextSize, color: newTextColor,
      fontWeight: 'bold', fontStyle: 'normal', textAlign: 'center',
      bgColor: null, strokeColor: null, strokeWidth: 0, shadowEnabled: true,
    };
    setLayers(prev => [...prev, layer]);
    setSelectedId(id); setNewText('');
  };

  const addIconLayer = (emoji: string) => {
    pushUndo(layers);
    const id = nextId();
    const layer: IconLayer = {
      id, type: 'icon', name: emoji,
      x: 100 + Math.random() * 150, y: 100 + Math.random() * 150,
      width: 60, height: 60, rotation: 0, opacity: 1,
      visible: true, locked: false, emoji, fontSize: 48,
    };
    setLayers(prev => [...prev, layer]);
    setSelectedId(id);
  };

  const addShapeLayer = () => {
    pushUndo(layers);
    const id = nextId();
    const layer: ShapeLayer = {
      id, type: 'shape', name: newShapeType === 'rect' ? 'מלבן' : 'עיגול',
      x: 80, y: 80, width: 150, height: newShapeType === 'circle' ? 150 : 100,
      rotation: 0, opacity: 0.8, visible: true, locked: false,
      shape: newShapeType, fillColor: newShapeColor, borderColor: '#ffffff', borderWidth: 0,
    };
    setLayers(prev => [...prev, layer]);
    setSelectedId(id);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        pushUndo(layers);
        const id = nextId();
        const maxDim = 200;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const layer: ImageLayer = {
          id, type: 'image', name: file.name.slice(0, 20),
          x: 60, y: 60, width: img.width * scale, height: img.height * scale,
          rotation: 0, opacity: 1, visible: true, locked: false, src,
        };
        setLayers(prev => [...prev, layer]);
        setSelectedId(id);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Mouse interactions ──
  const getCanvasCoords = (e: React.MouseEvent) => {
    if (!containerRef.current) return { cx: 0, cy: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { cx: (e.clientX - rect.left) / zoom, cy: (e.clientY - rect.top) / zoom };
  };

  // ── MASK MOUSE HANDLERS ──
  const handleMaskMouseDown = (e: React.MouseEvent) => {
    const { cx, cy } = getCanvasCoords(e);
    setIsDrawingMask(true);
    setMaskStart({ x: cx, y: cy });
    if (maskTool === 'brush') {
      setCurrentBrushPoints([{ x: cx, y: cy }]);
    }
  };

  const handleMaskMouseMove = (e: React.MouseEvent) => {
    if (!isDrawingMask || !maskStart) return;
    const { cx, cy } = getCanvasCoords(e);

    if (maskTool === 'brush') {
      setCurrentBrushPoints(prev => [...prev, { x: cx, y: cy }]);
      return;
    }

    // Preview rect/circle on mask canvas
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw existing shapes
    ctx.fillStyle = 'rgba(255, 80, 80, 0.35)';
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)';
    ctx.lineWidth = 2;
    for (const shape of maskShapes) {
      if (shape.type === 'rect') {
        ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      } else if (shape.type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(shape.cx, shape.cy, Math.abs(shape.rx), Math.abs(shape.ry), 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else if (shape.type === 'brush') {
        for (const p of shape.points) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw preview shape
    ctx.fillStyle = 'rgba(255, 80, 80, 0.2)';
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.6)';
    ctx.setLineDash([5, 5]);
    if (maskTool === 'rect') {
      const w = cx - maskStart.x;
      const h = cy - maskStart.y;
      ctx.fillRect(maskStart.x, maskStart.y, w, h);
      ctx.strokeRect(maskStart.x, maskStart.y, w, h);
    } else if (maskTool === 'circle') {
      const rx = Math.abs(cx - maskStart.x) / 2;
      const ry = Math.abs(cy - maskStart.y) / 2;
      const ccx = (maskStart.x + cx) / 2;
      const ccy = (maskStart.y + cy) / 2;
      ctx.beginPath();
      ctx.ellipse(ccx, ccy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.setLineDash([]);
  };

  const handleMaskMouseUp = (e: React.MouseEvent) => {
    if (!isDrawingMask || !maskStart) {
      setIsDrawingMask(false);
      return;
    }
    const { cx, cy } = getCanvasCoords(e);

    if (maskTool === 'rect') {
      const x = Math.min(maskStart.x, cx);
      const y = Math.min(maskStart.y, cy);
      const w = Math.abs(cx - maskStart.x);
      const h = Math.abs(cy - maskStart.y);
      if (w > 5 && h > 5) {
        setMaskShapes(prev => [...prev, { type: 'rect', x, y, w, h }]);
      }
    } else if (maskTool === 'circle') {
      const rx = Math.abs(cx - maskStart.x) / 2;
      const ry = Math.abs(cy - maskStart.y) / 2;
      const ccx = (maskStart.x + cx) / 2;
      const ccy = (maskStart.y + cy) / 2;
      if (rx > 3 && ry > 3) {
        setMaskShapes(prev => [...prev, { type: 'circle', cx: ccx, cy: ccy, rx, ry }]);
      }
    } else if (maskTool === 'brush') {
      if (currentBrushPoints.length > 0) {
        setMaskShapes(prev => [...prev, { type: 'brush', points: [...currentBrushPoints] }]);
        setCurrentBrushPoints([]);
      }
    }

    setIsDrawingMask(false);
    setMaskStart(null);
  };

  // ── Create mask composite for AI ──
  const createMaskComposite = useCallback(async (): Promise<string | null> => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container || maskShapes.length === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;

    // Draw original image
    ctx.drawImage(img, 0, 0);

    // Scale from display to natural
    const imgEl = container.querySelector('img');
    if (!imgEl) return null;
    const scaleX = img.naturalWidth / imgEl.clientWidth;
    const scaleY = img.naturalHeight / imgEl.clientHeight;

    // Draw mask overlay in bright red
    ctx.fillStyle = 'rgba(255, 0, 0, 0.45)';
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    ctx.lineWidth = 3 * scaleX;

    for (const shape of maskShapes) {
      if (shape.type === 'rect') {
        ctx.fillRect(shape.x * scaleX, shape.y * scaleY, shape.w * scaleX, shape.h * scaleY);
        ctx.strokeRect(shape.x * scaleX, shape.y * scaleY, shape.w * scaleX, shape.h * scaleY);
      } else if (shape.type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(shape.cx * scaleX, shape.cy * scaleY, Math.abs(shape.rx) * scaleX, Math.abs(shape.ry) * scaleY, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else if (shape.type === 'brush') {
        for (const p of shape.points) {
          ctx.beginPath();
          ctx.arc(p.x * scaleX, p.y * scaleY, (brushSize / 2) * scaleX, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    return canvas.toDataURL('image/png');
  }, [maskShapes, brushSize]);

  // ── Mask AI operations ──
  const handleMaskAction = async (action: MaskAction, prompt?: string) => {
    if (maskShapes.length === 0) {
      toast.error('בחר אזור לעריכה קודם');
      return;
    }

    setMaskProcessing(true);
    try {
      const compositeUrl = await createMaskComposite();
      if (!compositeUrl) throw new Error('שגיאה ביצירת מסכה');

      let aiPromptText = '';
      if (action === 'remove') {
        aiPromptText = 'Remove/erase everything inside the area highlighted in bright red and fill it with natural background that matches the surrounding area. Keep everything outside the red highlighted area exactly as is. Do not add any red tint.';
      } else if (action === 'replace') {
        aiPromptText = `Replace ONLY the content inside the area highlighted in bright red with: ${prompt}. Keep everything outside the red highlighted area exactly as is. Do not add any red tint.`;
      } else if (action === 'edit') {
        aiPromptText = `Edit ONLY the area highlighted in bright red: ${prompt}. Keep everything outside the red highlighted area exactly as is. Do not add any red tint.`;
      }

      const result = await imageService.edit(aiPromptText, compositeUrl);
      if (result.imageUrl) {
        setMaskPreviewUrl(result.imageUrl);
        toast.success('תצוגה מקדימה מוכנה — בדוק ואשר');
      }
    } catch (e: any) {
      toast.error(`שגיאת AI: ${e.message || 'שגיאה לא ידועה'}`);
    } finally {
      setMaskProcessing(false);
    }
  };

  const handleAcceptMaskPreview = () => {
    if (maskPreviewUrl) {
      setCurrentImageUrl(maskPreviewUrl);
      setMaskPreviewUrl(null);
      setMaskShapes([]);
      pushUndo(layers);
      setLayers([]);
      toast.success('השינוי הוחל — שמור כגרסה כשתסיים');
    }
  };

  const handleRejectMaskPreview = () => {
    setMaskPreviewUrl(null);
  };

  // ── Components analysis ──
  const handleComponentsAnalyze = async () => {
    setComponentsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: `Analyze this image and identify all separate visual components. Return a JSON array where each item has: label (short Hebrew description), type (one of: person, logo, text, background, object), bounds (object with x, y, w, h as percentages 0-100 of the image dimensions indicating the bounding box).
Example: [{"label":"איש בחולצה כחולה","type":"person","bounds":{"x":10,"y":5,"w":40,"h":90}},{"label":"לוגו חברה","type":"logo","bounds":{"x":60,"y":10,"w":30,"h":15}}]
Return ONLY the JSON array, no other text.`,
          imageUrl: currentImageUrl,
          action: 'edit',
        },
      });

      if (error) throw error;

      const text = data?.text || data?.imageUrl || '';
      // Try to parse JSON from response
      let components: DetectedComponent[] = [];
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          components = parsed.map((item: any, i: number) => ({
            id: `comp-${i}`,
            label: item.label || `קומפוננט ${i + 1}`,
            type: item.type || 'object',
            bounds: item.bounds || { x: 0, y: 0, w: 100, h: 100 },
            selected: true,
          }));
        }
      } catch {
        // Fallback: create basic components
        components = [
          { id: 'comp-bg', label: 'רקע', type: 'background', bounds: { x: 0, y: 0, w: 100, h: 100 }, selected: true },
          { id: 'comp-main', label: 'אלמנט ראשי', type: 'object', bounds: { x: 20, y: 10, w: 60, h: 80 }, selected: true },
        ];
      }

      if (components.length === 0) {
        toast.error('לא זוהו קומפוננטים בתמונה');
      } else {
        setDetectedComponents(components);
        toast.success(`זוהו ${components.length} קומפוננטים`);
      }
    } catch (e: any) {
      toast.error(`שגיאת ניתוח: ${e.message || 'שגיאה לא ידועה'}`);
    } finally {
      setComponentsAnalyzing(false);
    }
  };

  const handleToggleComponent = (id: string) => {
    setDetectedComponents(prev =>
      prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c)
    );
  };

  const handleApplyComponents = () => {
    const selected = detectedComponents.filter(c => c.selected);
    if (selected.length === 0) return;

    pushUndo(layers);
    const container = containerRef.current;
    const imgEl = container?.querySelector('img');
    if (!imgEl) return;

    const displayW = imgEl.clientWidth;
    const displayH = imgEl.clientHeight;

    const newLayers: Layer[] = selected.map(comp => {
      const id = nextId();
      const x = (comp.bounds.x / 100) * displayW;
      const y = (comp.bounds.y / 100) * displayH;
      const w = (comp.bounds.w / 100) * displayW;
      const h = (comp.bounds.h / 100) * displayH;

      return {
        id, type: 'shape' as const,
        name: comp.label,
        x, y, width: w, height: h,
        rotation: 0, opacity: 0.3,
        visible: true, locked: comp.type === 'background',
        shape: 'rect' as const,
        fillColor: comp.type === 'person' ? '#3b82f6' : comp.type === 'logo' ? '#22c55e' : comp.type === 'text' ? '#eab308' : '#6b7280',
        borderColor: '#ffffff', borderWidth: 2,
      } as ShapeLayer;
    });

    setLayers(prev => [...prev, ...newLayers]);
    setActiveTool('select');
    toast.success(`נוצרו ${newLayers.length} שכבות — הזז, שנה גודל ועשה סידור`);
  };

  const handleResetComponents = () => {
    setDetectedComponents([]);
  };

  // ── Standard mouse handlers ──
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'mask') {
      handleMaskMouseDown(e);
      return;
    }
    if (activeTool !== 'select') return;
    const { cx, cy } = getCanvasCoords(e);
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (!l.visible || l.locked) continue;
      if (cx >= l.x && cx <= l.x + l.width && cy >= l.y && cy <= l.y + l.height) {
        setSelectedId(l.id);
        setDragState({ type: 'move', layerId: l.id, startX: cx, startY: cy, origLayer: { ...l } });
        e.stopPropagation();
        return;
      }
    }
    setSelectedId(null);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, layerId: string, handle: Handle) => {
    e.stopPropagation(); e.preventDefault();
    const { cx, cy } = getCanvasCoords(e);
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    setDragState({ type: 'resize', layerId, startX: cx, startY: cy, origLayer: { ...layer }, handle });
  };

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (activeTool === 'mask' && isDrawingMask) {
      handleMaskMouseMove(e);
      return;
    }
    if (!dragState) return;
    const { cx, cy } = getCanvasCoords(e);
    const dx = cx - dragState.startX;
    const dy = cy - dragState.startY;
    const orig = dragState.origLayer;

    if (dragState.type === 'move') {
      setLayers(prev => prev.map(l => l.id === dragState.layerId ? { ...l, x: orig.x + dx, y: orig.y + dy } as Layer : l));
    } else if (dragState.type === 'resize') {
      let newX = orig.x, newY = orig.y, newW = orig.width, newH = orig.height;
      const h = dragState.handle!;
      if (h === 'se') { newW = Math.max(20, orig.width + dx); newH = Math.max(20, orig.height + dy); }
      if (h === 'sw') { newX = orig.x + dx; newW = Math.max(20, orig.width - dx); newH = Math.max(20, orig.height + dy); }
      if (h === 'ne') { newY = orig.y + dy; newW = Math.max(20, orig.width + dx); newH = Math.max(20, orig.height - dy); }
      if (h === 'nw') { newX = orig.x + dx; newY = orig.y + dy; newW = Math.max(20, orig.width - dx); newH = Math.max(20, orig.height - dy); }
      setLayers(prev => prev.map(l => l.id === dragState.layerId ? { ...l, x: newX, y: newY, width: newW, height: newH } as Layer : l));
    }
  }, [dragState, zoom, activeTool, isDrawingMask]);

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    if (activeTool === 'mask' && isDrawingMask) {
      handleMaskMouseUp(e);
      return;
    }
    if (dragState) {
      const current = layers.find(l => l.id === dragState.layerId);
      if (current && (current.x !== dragState.origLayer.x || current.y !== dragState.origLayer.y || current.width !== dragState.origLayer.width || current.height !== dragState.origLayer.height)) {
        setUndoStack(s => [...s.slice(-MAX_UNDO), layers.map(l => l.id === dragState.layerId ? dragState.origLayer : l)]);
        setRedoStack([]);
      }
    }
    setDragState(null);
  }, [dragState, layers, activeTool, isDrawingMask]);

  // ── Export ──
  const filterStyle = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;

  const exportImage = useCallback(async (): Promise<string | null> => {
    const img = imgRef.current;
    if (!img) return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.filter = filterStyle;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((baseRotation * Math.PI) / 180);
    if (flipH) ctx.scale(-1, 1);
    ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
    ctx.restore();
    ctx.filter = 'none';

    const container = containerRef.current;
    if (!container) return canvas.toDataURL('image/png');
    const imgEl = container.querySelector('img');
    if (!imgEl) return canvas.toDataURL('image/png');
    const displayW = imgEl.clientWidth;
    const displayH = imgEl.clientHeight;
    const scaleX = canvas.width / displayW;
    const scaleY = canvas.height / displayH;

    for (const layer of layers) {
      if (!layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      const lx = layer.x * scaleX, ly = layer.y * scaleY;
      const lw = layer.width * scaleX, lh = layer.height * scaleY;

      if (layer.rotation) {
        ctx.translate(lx + lw / 2, ly + lh / 2);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.translate(-(lx + lw / 2), -(ly + lh / 2));
      }

      switch (layer.type) {
        case 'text': {
          const t = layer as TextLayer;
          const fs = t.fontSize * scaleX;
          if (t.bgColor) {
            ctx.fillStyle = t.bgColor;
            ctx.fillRect(lx - 8 * scaleX, ly - fs * 0.2, lw + 16 * scaleX, fs * 1.4);
          }
          ctx.font = `${t.fontStyle} ${t.fontWeight} ${fs}px 'Noto Sans Hebrew', sans-serif`;
          ctx.fillStyle = t.color;
          ctx.textAlign = t.textAlign as CanvasTextAlign;
          ctx.direction = 'rtl';
          if (t.shadowEnabled) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4 * scaleX; }
          if (t.strokeColor && t.strokeWidth > 0) {
            ctx.strokeStyle = t.strokeColor;
            ctx.lineWidth = t.strokeWidth * scaleX;
            ctx.strokeText(t.text, lx + lw / 2, ly + fs);
          }
          ctx.fillText(t.text, lx + lw / 2, ly + fs);
          break;
        }
        case 'icon': {
          const ic = layer as IconLayer;
          ctx.font = `${ic.fontSize * scaleX}px serif`;
          ctx.textAlign = 'center';
          ctx.fillText(ic.emoji, lx + lw / 2, ly + lh * 0.8);
          break;
        }
        case 'shape': {
          const s = layer as ShapeLayer;
          ctx.fillStyle = s.fillColor;
          if (s.borderWidth > 0) { ctx.strokeStyle = s.borderColor; ctx.lineWidth = s.borderWidth * scaleX; }
          if (s.shape === 'rect') {
            ctx.fillRect(lx, ly, lw, lh);
            if (s.borderWidth > 0) ctx.strokeRect(lx, ly, lw, lh);
          } else {
            ctx.beginPath();
            ctx.ellipse(lx + lw / 2, ly + lh / 2, lw / 2, lh / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            if (s.borderWidth > 0) ctx.stroke();
          }
          break;
        }
        case 'image': {
          const il = layer as ImageLayer;
          try {
            const layerImg = new Image();
            layerImg.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
              layerImg.onload = () => resolve();
              layerImg.onerror = reject;
              layerImg.src = il.src;
            });
            ctx.drawImage(layerImg, lx, ly, lw, lh);
          } catch { /* skip */ }
          break;
        }
      }
      ctx.restore();
    }

    return canvas.toDataURL('image/png');
  }, [filterStyle, baseRotation, flipH, layers, zoom]);

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
    if (dataUrl && onSave) onSave(dataUrl);
  };

  // ── AI edit (full image) ──
  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const result = await imageService.edit(aiPrompt, currentImageUrl);
      if (result.imageUrl) {
        setCurrentImageUrl(result.imageUrl);
        pushUndo(layers);
        setLayers([]);
        toast.success('התמונה עודכנה בהצלחה!');
        setAiPrompt('');
      }
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בעריכת AI');
    } finally {
      setAiLoading(false);
    }
  };

  const selectedLayer = useMemo(() => layers.find(l => l.id === selectedId), [layers, selectedId]);
  const hasMask = maskShapes.length > 0;

  // ── Tools ──
  const tools: { id: ActiveTool; icon: any; label: string }[] = [
    { id: 'select', icon: MousePointer, label: 'בחירה' },
    { id: 'mask', icon: Scissors, label: 'מסכה' },
    { id: 'components', icon: Layers, label: 'פירוק' },
    { id: 'text', icon: Type, label: 'טקסט' },
    { id: 'icons', icon: Smile, label: 'אייקונים' },
    { id: 'shapes', icon: Square, label: 'צורות' },
    { id: 'images', icon: ImageIcon, label: 'תמונה' },
    { id: 'filters', icon: Palette, label: 'פילטרים' },
    { id: 'adjust', icon: Sun, label: 'כיוונון' },
    { id: 'layers', icon: GripVertical, label: 'שכבות' },
    { id: 'ai', icon: Wand2, label: 'AI' },
  ];

  // ── Render layer ──
  const renderLayer = (layer: Layer) => {
    if (!layer.visible) return null;
    const isSelected = selectedId === layer.id;
    const style: React.CSSProperties = {
      position: 'absolute', left: layer.x, top: layer.y,
      width: layer.width, height: layer.height,
      opacity: layer.opacity,
      transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
      cursor: layer.locked ? 'not-allowed' : (activeTool === 'select' ? 'move' : 'default'),
      pointerEvents: layer.locked ? 'none' : 'auto',
    };

    let content: React.ReactNode = null;
    switch (layer.type) {
      case 'text': {
        const t = layer as TextLayer;
        content = (
          <div style={{
            fontSize: t.fontSize, color: t.color,
            fontWeight: t.fontWeight, fontStyle: t.fontStyle,
            textAlign: t.textAlign as any,
            fontFamily: "'Noto Sans Hebrew', sans-serif",
            direction: 'rtl', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center',
            justifyContent: t.textAlign === 'center' ? 'center' : t.textAlign === 'right' ? 'flex-end' : 'flex-start',
            textShadow: t.shadowEnabled ? '0 2px 6px rgba(0,0,0,0.5)' : undefined,
            backgroundColor: t.bgColor || undefined,
            padding: t.bgColor ? '4px 8px' : undefined,
            borderRadius: t.bgColor ? '4px' : undefined,
            WebkitTextStroke: t.strokeColor && t.strokeWidth > 0 ? `${t.strokeWidth}px ${t.strokeColor}` : undefined,
          }}>{t.text}</div>
        );
        break;
      }
      case 'icon': {
        const ic = layer as IconLayer;
        content = (
          <div style={{ fontSize: ic.fontSize, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
            {ic.emoji}
          </div>
        );
        break;
      }
      case 'shape': {
        const s = layer as ShapeLayer;
        content = (
          <div style={{
            width: '100%', height: '100%',
            borderRadius: s.shape === 'circle' ? '50%' : undefined,
            backgroundColor: s.fillColor,
            border: s.borderWidth > 0 ? `${s.borderWidth}px solid ${s.borderColor}` : undefined,
          }} />
        );
        break;
      }
      case 'image': {
        const il = layer as ImageLayer;
        content = <img src={il.src} alt={il.name} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />;
        break;
      }
    }

    return (
      <div key={layer.id} style={style}
        onMouseDown={e => { if (activeTool !== 'select' || layer.locked) return; handleCanvasMouseDown(e); }}>
        {content}
        {isSelected && activeTool === 'select' && !layer.locked && (
          <>
            <div className="absolute inset-0 border-2 border-primary rounded pointer-events-none" />
            {(['nw', 'ne', 'sw', 'se'] as Handle[]).map(h => (
              <div key={h}
                className="absolute w-3 h-3 bg-primary rounded-sm border border-primary-foreground cursor-nwse-resize"
                style={{
                  top: h.startsWith('n') ? -6 : undefined,
                  bottom: h.startsWith('s') ? -6 : undefined,
                  left: h.endsWith('w') ? -6 : undefined,
                  right: h.endsWith('e') ? -6 : undefined,
                }}
                onMouseDown={e => handleResizeMouseDown(e, layer.id, h)}
              />
            ))}
          </>
        )}
      </div>
    );
  };

  // ── Selected layer props panel ──
  const renderSelectedProps = () => {
    if (!selectedLayer) return null;
    return (
      <div className="space-y-3 border-t border-border pt-3 mt-3">
        <h5 className="text-xs font-semibold text-muted-foreground">מאפייני שכבה</h5>
        <div className="grid grid-cols-2 gap-2">
          {[['X', 'x'], ['Y', 'y'], ['רוחב', 'width'], ['גובה', 'height']].map(([label, key]) => (
            <div key={key}>
              <label className="text-[10px] text-muted-foreground">{label}</label>
              <Input type="number" value={Math.round((selectedLayer as any)[key])} className="h-7 text-xs"
                onChange={e => updateLayer(selectedLayer.id, { [key]: +e.target.value })} />
            </div>
          ))}
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground flex justify-between"><span>שקיפות</span><span>{Math.round(selectedLayer.opacity * 100)}%</span></label>
          <Slider value={[selectedLayer.opacity * 100]} min={0} max={100} step={1}
            onValueChange={([v]) => updateLayer(selectedLayer.id, { opacity: v / 100 })} />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground flex justify-between"><span>סיבוב</span><span>{selectedLayer.rotation}°</span></label>
          <Slider value={[selectedLayer.rotation]} min={0} max={360} step={1}
            onValueChange={([v]) => updateLayer(selectedLayer.id, { rotation: v })} />
        </div>
        {selectedLayer.type === 'text' && (() => {
          const t = selectedLayer as TextLayer;
          return (
            <div className="space-y-2">
              <Input value={t.text} dir="rtl" className="text-sm h-8"
                onChange={e => updateLayer(t.id, { text: e.target.value, name: e.target.value.slice(0, 20) })} />
              <div className="flex gap-2 items-center">
                <input type="color" value={t.color} onChange={e => updateLayer(t.id, { color: e.target.value })} className="w-7 h-7 rounded cursor-pointer" />
                <Input type="number" value={t.fontSize} className="w-16 h-7 text-xs" min={10} max={200}
                  onChange={e => updateLayer(t.id, { fontSize: +e.target.value })} />
                <label className="flex items-center gap-1 text-[10px]">
                  <input type="checkbox" checked={t.shadowEnabled} onChange={e => updateLayer(t.id, { shadowEnabled: e.target.checked })} />צל
                </label>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant={t.fontWeight === 'bold' ? 'default' : 'outline'} className="h-7 w-7 p-0"
                  onClick={() => updateLayer(t.id, { fontWeight: t.fontWeight === 'bold' ? 'normal' : 'bold' })}>B</Button>
                <Button size="sm" variant={t.fontStyle === 'italic' ? 'default' : 'outline'} className="h-7 w-7 p-0"
                  onClick={() => updateLayer(t.id, { fontStyle: t.fontStyle === 'italic' ? 'normal' : 'italic' })}>I</Button>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">רקע טקסט</label>
                <div className="flex gap-1 items-center">
                  <input type="checkbox" checked={!!t.bgColor} onChange={e => updateLayer(t.id, { bgColor: e.target.checked ? '#000000aa' : null })} />
                  {t.bgColor && <input type="color" value={t.bgColor.slice(0, 7)} onChange={e => updateLayer(t.id, { bgColor: e.target.value + 'cc' })} className="w-6 h-6 rounded cursor-pointer" />}
                </div>
              </div>
            </div>
          );
        })()}
        {selectedLayer.type === 'shape' && (() => {
          const s = selectedLayer as ShapeLayer;
          return (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-muted-foreground">צבע מילוי</label>
                <div className="flex gap-1 flex-wrap">
                  {SHAPE_COLORS.map(c => (
                    <button key={c} className={cn('w-6 h-6 rounded-full border-2', s.fillColor === c ? 'border-primary' : 'border-transparent')}
                      style={{ backgroundColor: c }} onClick={() => updateLayer(s.id, { fillColor: c })} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground flex justify-between"><span>גבול</span><span>{s.borderWidth}px</span></label>
                <Slider value={[s.borderWidth]} min={0} max={10} step={1}
                  onValueChange={([v]) => updateLayer(s.id, { borderWidth: v })} />
              </div>
            </div>
          );
        })()}
        {selectedLayer.type === 'icon' && (() => {
          const ic = selectedLayer as IconLayer;
          return (
            <div>
              <label className="text-[10px] text-muted-foreground flex justify-between"><span>גודל</span><span>{ic.fontSize}px</span></label>
              <Slider value={[ic.fontSize]} min={20} max={150} step={2}
                onValueChange={([v]) => updateLayer(ic.id, { fontSize: v })} />
            </div>
          );
        })()}
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs flex-1" onClick={() => duplicateLayer(selectedLayer.id)}>
            <Copy className="w-3 h-3 ml-1" />שכפל
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs flex-1 text-destructive" onClick={() => deleteLayer(selectedLayer.id)}>
            <Trash2 className="w-3 h-3 ml-1" />מחק
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] p-0 flex flex-col overflow-hidden" aria-describedby={undefined}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">עורך תמונות</span>
            <div className="flex gap-1 border-r border-border pr-3">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={undo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)">
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={redo} disabled={redoStack.length === 0} title="Redo (Ctrl+Shift+Z)">
                <Redo2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex gap-1 items-center border-r border-border pr-3">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setZoom(z => clamp(z - 0.1, 0.3, 3))}>
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setZoom(z => clamp(z + 0.1, 0.3, 3))}>
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>
            {hasMask && (
              <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                🎭 מסכה פעילה
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 ml-1" />הורד
            </Button>
            {onSave && (
              <Button size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 ml-1" />שמור כגרסה
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Toolbar */}
          <div className="w-14 bg-card border-l border-border flex flex-col items-center py-2 gap-0.5 flex-shrink-0">
            {tools.map(tool => (
              <button key={tool.id} onClick={() => setActiveTool(activeTool === tool.id && tool.id !== 'select' ? 'select' : tool.id)}
                className={cn('w-11 h-11 rounded-lg flex flex-col items-center justify-center text-[9px] gap-0.5 transition-colors',
                  activeTool === tool.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                <tool.icon className="w-4 h-4" />
                <span>{tool.label}</span>
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => setBaseRotation(r => r - 90)}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => setBaseRotation(r => r + 90)}
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
          {activeTool !== 'select' && (
            <div className="w-64 bg-card border-l border-border p-3 overflow-y-auto space-y-3 flex-shrink-0">
              {activeTool === 'mask' && (
                <MaskPanel
                  maskTool={maskTool}
                  onMaskToolChange={setMaskTool}
                  brushSize={brushSize}
                  onBrushSizeChange={setBrushSize}
                  feather={feather}
                  onFeatherChange={setFeather}
                  hasMask={hasMask}
                  onClearMask={() => setMaskShapes([])}
                  onInvertMask={() => {
                    // For simplicity, clear mask (invert is complex with canvas approach)
                    toast.info('היפוך מסכה — סמן את האזור ההפוך');
                    setMaskShapes([]);
                  }}
                  onMaskAction={handleMaskAction}
                  isProcessing={maskProcessing}
                  previewUrl={maskPreviewUrl}
                  onAcceptPreview={handleAcceptMaskPreview}
                  onRejectPreview={handleRejectMaskPreview}
                />
              )}

              {activeTool === 'components' && (
                <ComponentsPanel
                  onAnalyze={handleComponentsAnalyze}
                  isAnalyzing={componentsAnalyzing}
                  components={detectedComponents}
                  onToggleComponent={handleToggleComponent}
                  onApplyComponents={handleApplyComponents}
                  onReset={handleResetComponents}
                />
              )}

              {activeTool === 'text' && (
                <>
                  <h4 className="text-sm font-semibold">הוסף טקסט</h4>
                  <Input value={newText} onChange={e => setNewText(e.target.value)} placeholder="כתוב טקסט..."
                    className="text-sm" dir="rtl" onKeyDown={e => e.key === 'Enter' && addTextLayer()} />
                  <div className="flex gap-2 items-center">
                    <input type="color" value={newTextColor} onChange={e => setNewTextColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                    <Input type="number" value={newTextSize} onChange={e => setNewTextSize(+e.target.value)} className="w-20 text-sm" min={12} max={200} />
                    <Button size="sm" onClick={addTextLayer}><Plus className="w-4 h-4" /></Button>
                  </div>
                  {renderSelectedProps()}
                </>
              )}

              {activeTool === 'icons' && (
                <>
                  <h4 className="text-sm font-semibold">הוסף אייקונים</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {EMOJI_OPTIONS.map(e => (
                      <button key={e} onClick={() => addIconLayer(e)}
                        className="w-11 h-11 text-xl rounded-lg border border-border hover:bg-muted flex items-center justify-center">
                        {e}
                      </button>
                    ))}
                  </div>
                  {renderSelectedProps()}
                </>
              )}

              {activeTool === 'shapes' && (
                <>
                  <h4 className="text-sm font-semibold">הוסף צורה</h4>
                  <div className="flex gap-2">
                    <Button size="sm" variant={newShapeType === 'rect' ? 'default' : 'outline'} onClick={() => setNewShapeType('rect')}>
                      <Square className="w-4 h-4 ml-1" />מלבן
                    </Button>
                    <Button size="sm" variant={newShapeType === 'circle' ? 'default' : 'outline'} onClick={() => setNewShapeType('circle')}>
                      <Circle className="w-4 h-4 ml-1" />עיגול
                    </Button>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {SHAPE_COLORS.map(c => (
                      <button key={c} className={cn('w-7 h-7 rounded-full border-2', newShapeColor === c ? 'border-primary' : 'border-transparent')}
                        style={{ backgroundColor: c }} onClick={() => setNewShapeColor(c)} />
                    ))}
                  </div>
                  <Button size="sm" className="w-full" onClick={addShapeLayer}>
                    <Plus className="w-4 h-4 ml-1" />הוסף
                  </Button>
                  {renderSelectedProps()}
                </>
              )}

              {activeTool === 'images' && (
                <>
                  <h4 className="text-sm font-semibold">העלה תמונה</h4>
                  <p className="text-xs text-muted-foreground">הוסף תמונה, לוגו או אלמנט חדש כשכבה</p>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <Button size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon className="w-4 h-4 ml-1" />בחר קובץ
                  </Button>
                  {renderSelectedProps()}
                </>
              )}

              {activeTool === 'filters' && (
                <>
                  <h4 className="text-sm font-semibold">פילטרים</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {FILTER_PRESETS.map(f => (
                      <button key={f.name} onClick={() => { setBrightness(f.brightness); setContrast(f.contrast); setSaturate(f.saturate); }}
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
                      <RotateCcw className="w-3.5 h-3.5 ml-1" />איפוס
                    </Button>
                  </div>
                </>
              )}

              {activeTool === 'layers' && (
                <>
                  <h4 className="text-sm font-semibold">שכבות ({layers.length})</h4>
                  {layers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">אין שכבות — הוסף טקסט, אייקון או צורה</p>
                  ) : (
                    <div className="space-y-1">
                      {[...layers].reverse().map((layer) => (
                        <div key={layer.id}
                          className={cn('flex items-center gap-1.5 p-1.5 rounded-lg border text-xs cursor-pointer',
                            selectedId === layer.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50')}
                          onClick={() => setSelectedId(layer.id)}>
                          <span className="truncate flex-1" dir="rtl">{layer.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}
                            className="text-muted-foreground hover:text-foreground">
                            {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }}
                            className="text-muted-foreground hover:text-foreground">
                            {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); moveLayerOrder(layer.id, 'up'); }}
                            className="text-muted-foreground hover:text-foreground"><ArrowUp className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); moveLayerOrder(layer.id, 'down'); }}
                            className="text-muted-foreground hover:text-foreground"><ArrowDown className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                            className="text-destructive hover:text-destructive/80"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {renderSelectedProps()}
                </>
              )}

              {activeTool === 'ai' && (
                <>
                  <h4 className="text-sm font-semibold">✨ ערוך עם AI</h4>
                  <p className="text-xs text-muted-foreground">תאר מה לשנות בתמונה (בעברית או אנגלית)</p>
                  <Input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="לדוגמה: שנה רקע לשקיעה..."
                    dir="rtl" className="text-sm" onKeyDown={e => e.key === 'Enter' && handleAiEdit()} />
                  <Button size="sm" className="w-full" onClick={handleAiEdit} disabled={aiLoading || !aiPrompt.trim()}>
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Wand2 className="w-4 h-4 ml-1" />}
                    {aiLoading ? 'מעבד...' : 'בצע שינוי'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">💡 שינויי AI מחליפים את תמונת הבסיס — השכבות ישמרו בנפרד</p>
                </>
              )}
            </div>
          )}

          {/* Canvas Area */}
          <div className="flex-1 bg-muted/20 flex items-center justify-center overflow-auto relative"
            onClick={() => { if (activeTool === 'select') setSelectedId(null); }}>
            <div
              ref={containerRef}
              className="relative inline-block"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onMouseDown={handleCanvasMouseDown}
            >
              <img
                src={currentImageUrl}
                alt="editing"
                crossOrigin="anonymous"
                className="max-w-full max-h-[75vh] rounded-lg shadow-lg object-contain select-none"
                style={{
                  filter: filterStyle,
                  transform: `rotate(${baseRotation}deg) scaleX(${flipH ? -1 : 1})`,
                  transition: 'filter 0.2s, transform 0.3s',
                }}
                draggable={false}
              />
              {/* Mask canvas overlay */}
              {activeTool === 'mask' && (
                <canvas
                  ref={maskCanvasRef}
                  className="absolute inset-0 w-full h-full rounded-lg"
                  style={{ cursor: maskTool === 'brush' ? `crosshair` : 'crosshair', pointerEvents: 'none' }}
                />
              )}
              {/* Always show mask shapes even when not in mask tool */}
              {activeTool !== 'mask' && hasMask && (
                <div className="absolute inset-0 pointer-events-none">
                  {maskShapes.map((shape, i) => {
                    if (shape.type === 'rect') {
                      return <div key={i} className="absolute border-2 border-red-400 rounded" style={{
                        left: shape.x, top: shape.y, width: shape.w, height: shape.h,
                        backgroundColor: 'rgba(255,80,80,0.2)',
                      }} />;
                    }
                    if (shape.type === 'circle') {
                      return <div key={i} className="absolute border-2 border-red-400 rounded-full" style={{
                        left: shape.cx - Math.abs(shape.rx), top: shape.cy - Math.abs(shape.ry),
                        width: Math.abs(shape.rx) * 2, height: Math.abs(shape.ry) * 2,
                        backgroundColor: 'rgba(255,80,80,0.2)',
                      }} />;
                    }
                    return null;
                  })}
                </div>
              )}
              {/* Render layers */}
              {layers.map(renderLayer)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
