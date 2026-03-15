import { useState, useEffect } from 'react';
import { Check, Loader2, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Sparkles, Mic, UserCircle, Video, ImageIcon, Subtitles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface ServiceCredits {
  service: string;
  used: number;
  limit: number;
  unit: string;
  plan: string;
  canGenerate: boolean;
  dashboardUrl: string;
  error?: string;
}

const serviceConfig = [
  { id: 'gemini', name: 'Gemini AI', desc: 'תמונות + טקסט + תסריטים', icon: Sparkles, free: true, plan: 'חינם (מובנה)', hasCredits: false },
  { id: 'elevenlabs', name: 'ElevenLabs', desc: 'דיבוב בעברית (4 קולות)', icon: Mic, free: false, plan: 'חינם (מוגבל)', hasCredits: true },
  { id: 'did', name: 'D-ID', desc: 'אווטאר מדבר', icon: UserCircle, free: false, plan: 'חינם (Trial)', hasCredits: true },
  { id: 'runway', name: 'RunwayML', desc: 'וידאו AI (תמונה/טקסט → סרטון)', icon: Video, free: false, plan: 'חינם (Trial)', hasCredits: true },
  { id: 'shotstack', name: 'Shotstack', desc: 'עריכת וידאו ורינדור אוטומטי', icon: Video, free: false, plan: 'Sandbox (חינם)', hasCredits: true },
  { id: 'cloudinary', name: 'Cloudinary', desc: 'ניהול מדיה, עיבוד תמונות ווידאו', icon: ImageIcon, free: false, plan: 'חינם (מוגבל)', hasCredits: true },
  { id: 'whisper', name: 'Whisper AI', desc: 'כתוביות אוטומטיות בעברית', icon: Subtitles, free: true, plan: 'חינם (מובנה)', hasCredits: false },
  { id: 'storage', name: 'אחסון מדיה', desc: 'העלאה ושמירת קבצים', icon: ImageIcon, free: true, plan: 'חינם (מובנה)', hasCredits: false },
];

export function ConnectionsTab() {
  const [credits, setCredits] = useState<Record<string, ServiceCredits>>({});
  const [loading, setLoading] = useState(false);

  const loadCredits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-credits');
      if (error) throw error;
      const map: Record<string, ServiceCredits> = {};
      for (const c of (data?.credits || [])) {
        map[c.service] = c;
      }
      setCredits(map);
    } catch (err: any) {
      console.error('Error loading credits:', err);
      toast.error('שגיאה בטעינת נתוני קרדיטים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCredits(); }, []);

  const getUsagePercent = (c: ServiceCredits) => {
    if (c.limit <= 0) return 0;
    return Math.min(100, Math.round((c.used / c.limit) * 100));
  };

  const getUsageColor = (percent: number, canGenerate: boolean) => {
    if (!canGenerate) return 'bg-destructive';
    if (percent > 80) return 'bg-warning';
    return 'bg-success';
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-rubik font-semibold">שירותים מחוברים</h2>
        <button
          onClick={loadCredits}
          disabled={loading}
          className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted flex items-center gap-1.5 transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          בדוק קרדיטים
        </button>
      </div>

      <div className="space-y-3">
        {serviceConfig.map(s => {
          const Icon = s.icon;
          const credit = credits[s.id];

          return (
            <div key={s.id} className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    credit && !credit.canGenerate
                      ? "bg-destructive/20 text-destructive"
                      : "bg-success/20 text-success"
                  )}>
                    {credit && !credit.canGenerate
                      ? <AlertTriangle className="w-5 h-5" />
                      : <Check className="w-5 h-5" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Icon className="w-4 h-4 text-primary" />
                      {s.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    s.free ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
                  )}>
                    {credit?.plan || s.plan}
                  </span>
                  {credit?.canGenerate !== false ? (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-success font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> פעיל
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> נגמר
                    </span>
                  )}
                </div>
              </div>

              {/* Credits bar */}
              {s.hasCredits && credit && !credit.error && credit.limit > 0 && (
                <div className="mr-13 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      שימוש: {credit.used} / {credit.limit} {credit.unit}
                    </span>
                    <span className={cn(
                      "font-medium",
                      credit.canGenerate ? "text-foreground" : "text-destructive"
                    )}>
                      {getUsagePercent(credit)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", getUsageColor(getUsagePercent(credit), credit.canGenerate))}
                      style={{ width: `${getUsagePercent(credit)}%` }}
                    />
                  </div>
                  {!credit.canGenerate && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      הקרדיטים נגמרו — יש לשדרג את החבילה כדי להמשיך ליצור
                    </p>
                  )}
                  {credit.canGenerate && getUsagePercent(credit) > 80 && (
                    <p className="text-xs text-warning flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      נותרו מעט קרדיטים — שקול לשדרג את החבילה
                    </p>
                  )}
                </div>
              )}

              {/* Unlimited / dashboard-managed credits */}
              {s.hasCredits && credit && !credit.error && credit.limit === -1 && (
                <div className="mr-13">
                  <p className="text-xs text-muted-foreground">
                    ✅ {s.id === 'shotstack' 
                      ? 'Sandbox ללא הגבלה (עם ווטרמארק). להסרת ווטרמארק — שדרג חבילה.'
                      : 'מחובר ופעיל. ניהול קרדיטים דרך הדשבורד של הספק.'}
                  </p>
                </div>
              )}

              {/* Error state */}
              {s.hasCredits && credit?.error && (
                <div className="mr-13">
                  <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
                    ⚠️ לא הצלחתי לבדוק קרדיטים — ייתכן שמפתח ה-API לא תקין
                  </p>
                </div>
              )}

              {/* Loading state */}
              {s.hasCredits && loading && !credit && (
                <div className="mr-13 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> בודק קרדיטים...
                </div>
              )}

              {/* Dashboard link */}
              {s.hasCredits && credit?.dashboardUrl && (
                <div className="mr-13">
                  <a
                    href={credit.dashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    ניהול חשבון ושדרוג חבילה
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        💡 הקרדיטים מתעדכנים בזמן אמת מכל שירות. לחץ "בדוק קרדיטים" לרענון.
      </p>
    </div>
  );
}
