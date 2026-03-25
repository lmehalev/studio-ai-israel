import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Layers, Check, X, Eye, EyeOff } from 'lucide-react';
import { CostApprovalDialog, type CostEstimate } from '@/components/studio/CostApprovalDialog';
import { cn } from '@/lib/utils';

export interface DetectedComponent {
  id: string;
  label: string;
  type: 'person' | 'logo' | 'text' | 'background' | 'object';
  bounds: { x: number; y: number; w: number; h: number }; // percentages 0-100
  selected: boolean;
}

interface ComponentsPanelProps {
  onAnalyze: () => void;
  isAnalyzing: boolean;
  components: DetectedComponent[];
  onToggleComponent: (id: string) => void;
  onApplyComponents: () => void;
  onReset: () => void;
}

export function ComponentsPanel({
  onAnalyze, isAnalyzing, components,
  onToggleComponent, onApplyComponents, onReset,
}: ComponentsPanelProps) {
  const [costOpen, setCostOpen] = useState(false);

  const handleRequestAnalyze = () => {
    setCostOpen(true);
  };

  const handleApprove = () => {
    setCostOpen(false);
    onAnalyze();
  };

  const estimates: CostEstimate[] = [{
    provider: 'Lovable AI (Gemini)',
    estimatedCost: '~$0.02',
    action: 'ניתוח וזיהוי קומפוננטים',
    details: 'זיהוי אלמנטים בתמונה: אנשים, לוגואים, טקסטים, רקע',
  }];

  const typeLabels: Record<string, string> = {
    person: '👤 אדם',
    logo: '🏷️ לוגו',
    text: '📝 טקסט',
    background: '🖼️ רקע',
    object: '📦 אובייקט',
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">🧩 פירוק לקומפוננטים</h4>
      <p className="text-xs text-muted-foreground">
        AI יזהה את האלמנטים בתמונה ויפרק אותם לשכבות נפרדות שתוכל להזיז ולערוך
      </p>

      {components.length === 0 ? (
        <>
          <Button size="sm" className="w-full" onClick={handleRequestAnalyze}
            disabled={isAnalyzing}>
            {isAnalyzing ? (
              <><Loader2 className="w-4 h-4 ml-1 animate-spin" />מנתח תמונה...</>
            ) : (
              <><Layers className="w-4 h-4 ml-1" />💰 פצל לקומפוננטים</>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            💡 ה-AI יזהה אנשים, לוגואים, טקסטים ורקע — ויציע אותם כשכבות נפרדות
          </p>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            {components.map(comp => (
              <div key={comp.id}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors',
                  comp.selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
                )}
                onClick={() => onToggleComponent(comp.id)}>
                <span className="flex-1 truncate">
                  {typeLabels[comp.type] || comp.type} — {comp.label}
                </span>
                {comp.selected ? (
                  <Eye className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={onApplyComponents}
              disabled={!components.some(c => c.selected)}>
              <Check className="w-3.5 h-3.5 ml-1" />צור שכבות
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={onReset}>
              <X className="w-3.5 h-3.5 ml-1" />איפוס
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground">
            בחר את הקומפוננטים שברצונך לפרק לשכבות. אחרי היצירה תוכל להזיז, לשנות גודל ולערוך כל שכבה בנפרד.
          </p>
        </>
      )}

      <CostApprovalDialog
        open={costOpen}
        onOpenChange={setCostOpen}
        estimates={estimates}
        onApprove={handleApprove}
      />
    </div>
  );
}
