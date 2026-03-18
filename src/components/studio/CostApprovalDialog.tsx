import { AlertTriangle, DollarSign, ShieldCheck } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface CostEstimate {
  provider: string;
  model?: string;
  action: string;
  estimatedCost: string;
  details: string[];
}

interface CostApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimates: CostEstimate[];
  onApprove: () => void;
  title?: string;
}

export function CostApprovalDialog({ open, onOpenChange, estimates, onApprove, title }: CostApprovalDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl" className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <DollarSign className="w-5 h-5 text-warning" />
            {title || 'אישור פעולה בתשלום'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">הפעולה הבאה תשתמש בספקים חיצוניים שצורכים קרדיטים:</p>
              <div className="space-y-2">
                {estimates.map((est, i) => (
                  <div key={i} className="bg-muted/50 border border-border rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{est.provider}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">
                        {est.estimatedCost}
                      </span>
                    </div>
                    {est.model && <p className="text-xs text-muted-foreground">מודל: {est.model}</p>}
                    <p className="text-xs text-muted-foreground">פעולה: {est.action}</p>
                    {est.details.map((d, j) => (
                      <p key={j} className="text-xs text-muted-foreground">• {d}</p>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 bg-warning/10 border border-warning/20 rounded-lg p-2.5 text-xs text-warning">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>לא תתבצע יצירה ללא אישור מפורש שלך. ניתן לבטל בכל שלב.</span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogAction onClick={onApprove}
            className="gradient-gold text-primary-foreground font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> אשר והתחל
          </AlertDialogAction>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Helper: build cost estimates for common flows
export function buildVideoGenerationEstimates(sceneCount: number, hasVoice: boolean, hasAvatar: boolean): CostEstimate[] {
  const estimates: CostEstimate[] = [];

  if (hasVoice) {
    estimates.push({
      provider: 'ElevenLabs',
      action: 'קריינות בעברית',
      estimatedCost: '~500-2000 תווים',
      details: ['שכפול קול או TTS', 'עלות: לפי תוכנית המנוי שלך'],
    });
  }

  if (hasAvatar) {
    estimates.push({
      provider: 'HeyGen',
      model: 'Avatar Video v2',
      action: `יצירת ${sceneCount} סצנות אווטאר`,
      estimatedCost: `~${sceneCount} קרדיטים`,
      details: ['ספק ראשי לסרטוני אווטאר', 'Fallback: Krea → Runway → תמונת AI'],
    });
  } else {
    estimates.push({
      provider: 'HeyGen / Krea',
      action: `יצירת ${sceneCount} סצנות וידאו`,
      estimatedCost: `~${sceneCount} קרדיטים`,
      details: ['שרשרת: HeyGen → Krea → Runway (גיבוי)', 'כל ספק צורך קרדיטים בנפרד'],
    });
  }

  estimates.push({
    provider: 'Shotstack',
    model: 'Production',
    action: 'הרכבה ורינדור סופי',
    estimatedCost: '1 רינדור',
    details: ['כולל כתוביות, לוגו ומוזיקה אם נבחרו'],
  });

  return estimates;
}

export function buildSubtitleRenderEstimates(): CostEstimate[] {
  return [{
    provider: 'Shotstack',
    model: 'Production',
    action: 'צריבת כתוביות לסרטון',
    estimatedCost: '1 רינדור',
    details: ['כולל עיצוב, מוזיקת רקע ולוגו אם נבחרו'],
  }];
}

export function buildHighlightEstimates(hasVoice: boolean, hasVideo: boolean): CostEstimate[] {
  const estimates: CostEstimate[] = [];

  if (hasVoice) {
    estimates.push({
      provider: 'ElevenLabs',
      action: 'קריינות',
      estimatedCost: '~500-2000 תווים',
      details: ['שכפול קול או TTS'],
    });
  }

  if (!hasVideo) {
    estimates.push({
      provider: 'Krea',
      action: 'יצירת וידאו מתמונות',
      estimatedCost: '~1 קרדיט',
      details: ['המרת תמונות לקליפ וידאו'],
    });
  }

  estimates.push({
    provider: 'Shotstack',
    model: 'Production',
    action: 'הרכבה סופית',
    estimatedCost: '1 רינדור',
    details: ['חיתוך, חיבור והרכבה עם אודיו'],
  });

  return estimates;
}
