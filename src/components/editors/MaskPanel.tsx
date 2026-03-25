import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Square, Circle, Paintbrush, Eraser, Wand2, Replace,
  Trash2, Loader2, RotateCcw, ArrowLeftRight, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CostApprovalDialog, type CostEstimate } from '@/components/studio/CostApprovalDialog';

export type MaskTool = 'rect' | 'circle' | 'brush';

export type MaskAction = 'remove' | 'replace' | 'edit';

interface MaskPanelProps {
  maskTool: MaskTool;
  onMaskToolChange: (tool: MaskTool) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  feather: number;
  onFeatherChange: (f: number) => void;
  hasMask: boolean;
  onClearMask: () => void;
  onInvertMask: () => void;
  onMaskAction: (action: MaskAction, prompt?: string) => void;
  isProcessing: boolean;
  previewUrl: string | null;
  onAcceptPreview: () => void;
  onRejectPreview: () => void;
}

export function MaskPanel({
  maskTool, onMaskToolChange,
  brushSize, onBrushSizeChange,
  feather, onFeatherChange,
  hasMask, onClearMask, onInvertMask,
  onMaskAction, isProcessing,
  previewUrl, onAcceptPreview, onRejectPreview,
}: MaskPanelProps) {
  const [replacePrompt, setReplacePrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [costOpen, setCostOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ action: MaskAction; prompt?: string } | null>(null);

  const tools: { id: MaskTool; icon: any; label: string }[] = [
    { id: 'rect', icon: Square, label: 'מלבן' },
    { id: 'circle', icon: Circle, label: 'עיגול' },
    { id: 'brush', icon: Paintbrush, label: 'מברשת' },
  ];

  const requestAction = (action: MaskAction, prompt?: string) => {
    if (!hasMask) {
      return; // Error shown in parent
    }
    setPendingAction({ action, prompt });
    setCostOpen(true);
  };

  const handleApprove = () => {
    setCostOpen(false);
    if (pendingAction) {
      onMaskAction(pendingAction.action, pendingAction.prompt);
      setPendingAction(null);
    }
  };

  const getCostEstimates = (): CostEstimate[] => {
    if (!pendingAction) return [];
    const actionLabels: Record<MaskAction, string> = {
      remove: 'הסרת אובייקט (Inpaint)',
      replace: 'החלפת אזור',
      edit: 'עריכה באזור נבחר',
    };
    return [{
      provider: 'Lovable AI (Gemini)',
      estimatedCost: '~$0.01–0.03',
      action: actionLabels[pendingAction.action],
      details: pendingAction.prompt || 'מחיקה ומילוי רקע טבעי',
    }];
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">🎭 כלי מסכה ובחירה</h4>

      {/* Tool selection */}
      <div className="flex gap-1">
        {tools.map(t => (
          <Button key={t.id} size="sm"
            variant={maskTool === t.id ? 'default' : 'outline'}
            className="flex-1 h-8 text-xs"
            onClick={() => onMaskToolChange(t.id)}>
            <t.icon className="w-3.5 h-3.5 ml-1" />{t.label}
          </Button>
        ))}
      </div>

      {/* Brush size */}
      {maskTool === 'brush' && (
        <div>
          <label className="text-[10px] text-muted-foreground flex justify-between">
            <span>גודל מברשת</span><span>{brushSize}px</span>
          </label>
          <Slider value={[brushSize]} min={5} max={100} step={1}
            onValueChange={([v]) => onBrushSizeChange(v)} />
        </div>
      )}

      {/* Feather */}
      <div>
        <label className="text-[10px] text-muted-foreground flex justify-between">
          <span>ריכוך קצוות</span><span>{feather}px</span>
        </label>
        <Slider value={[feather]} min={0} max={30} step={1}
          onValueChange={([v]) => onFeatherChange(v)} />
      </div>

      {/* Mask actions */}
      <div className="flex gap-1">
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs"
          onClick={onClearMask} disabled={!hasMask}>
          <Eraser className="w-3 h-3 ml-1" />נקה
        </Button>
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs"
          onClick={onInvertMask} disabled={!hasMask}>
          <ArrowLeftRight className="w-3 h-3 ml-1" />הפוך
        </Button>
      </div>

      {!hasMask && (
        <p className="text-xs text-amber-500 bg-amber-500/10 rounded-lg p-2 text-center">
          סמן אזור על התמונה כדי להפעיל פעולות
        </p>
      )}

      {/* Preview */}
      {previewUrl && (
        <div className="space-y-2 border border-primary/30 rounded-lg p-2 bg-primary/5">
          <p className="text-xs font-semibold text-primary">תצוגה מקדימה:</p>
          <img src={previewUrl} alt="preview" className="w-full rounded-lg" />
          <div className="flex gap-1">
            <Button size="sm" className="flex-1 h-7 text-xs" onClick={onAcceptPreview}>
              ✅ אשר ושמור
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={onRejectPreview}>
              ❌ בטל
            </Button>
          </div>
        </div>
      )}

      {/* AI Operations */}
      <div className="border-t border-border pt-3 space-y-2">
        <h5 className="text-xs font-semibold text-muted-foreground">💰 פעולות AI על אזור נבחר</h5>

        {/* Remove */}
        <Button size="sm" variant="outline" className="w-full h-8 text-xs justify-start"
          onClick={() => requestAction('remove')}
          disabled={!hasMask || isProcessing}>
          {isProcessing ? <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 ml-1" />}
          מחק ומלא רקע (Remove)
        </Button>

        {/* Replace */}
        <div className="space-y-1">
          <Input value={replacePrompt} onChange={e => setReplacePrompt(e.target.value)}
            placeholder="מה לשים במקום?"
            dir="rtl" className="text-xs h-7" disabled={isProcessing} />
          <Button size="sm" variant="outline" className="w-full h-8 text-xs justify-start"
            onClick={() => requestAction('replace', replacePrompt)}
            disabled={!hasMask || !replacePrompt.trim() || isProcessing}>
            <Replace className="w-3.5 h-3.5 ml-1" />
            החלף באזור (Replace)
          </Button>
        </div>

        {/* Edit */}
        <div className="space-y-1">
          <Input value={editPrompt} onChange={e => setEditPrompt(e.target.value)}
            placeholder="שנה רק את מה שבמסכה..."
            dir="rtl" className="text-xs h-7" disabled={isProcessing} />
          <Button size="sm" variant="outline" className="w-full h-8 text-xs justify-start"
            onClick={() => requestAction('edit', editPrompt)}
            disabled={!hasMask || !editPrompt.trim() || isProcessing}>
            <Wand2 className="w-3.5 h-3.5 ml-1" />
            ערוך באזור (Edit)
          </Button>
        </div>
      </div>

      <CostApprovalDialog
        open={costOpen}
        onOpenChange={setCostOpen}
        estimates={getCostEstimates()}
        onApprove={handleApprove}
      />
    </div>
  );
}
