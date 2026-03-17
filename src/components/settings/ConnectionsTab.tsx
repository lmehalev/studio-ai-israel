import { useState, useEffect, useRef } from 'react';
import { Check, Loader2, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Sparkles, Mic, UserCircle, Video, ImageIcon, Subtitles, Bell, Zap, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
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
  { id: 'gemini', name: 'Gemini AI', desc: 'תמונות + טקסט + תסריטים + שיפור פרומפטים', icon: Sparkles, free: true, plan: 'חינם (מובנה)', hasCredits: false },
  { id: 'elevenlabs', name: 'ElevenLabs', desc: 'דיבוב, שכפול קול, מוזיקה, SFX, Voice Isolation', icon: Mic, free: false, plan: 'חינם (מוגבל)', hasCredits: true },
  { id: 'heygen', name: 'HeyGen', desc: 'אווטאר מדבר, Photo Avatar, תבניות, Quota', icon: UserCircle, free: false, plan: 'חינם (Trial)', hasCredits: true },
  { id: 'runway', name: 'RunwayML', desc: 'וידאו AI קולנועי (Image/Text → Video)', icon: Video, free: false, plan: 'חינם (Trial)', hasCredits: true },
  { id: 'krea', name: 'Krea AI', desc: '40+ מודלים: Flux, Seedream, Veo 3, Kling 2.5, Upscale 22K', icon: Wand2, free: false, plan: 'API מחובר', hasCredits: true },
  { id: 'shotstack', name: 'Shotstack', desc: 'עריכת וידאו, רינדור רב-שכבתי, כתוביות', icon: Video, free: false, plan: 'Sandbox (חינם)', hasCredits: true },
  { id: 'cloudinary', name: 'Cloudinary', desc: 'ניהול מדיה, עיבוד תמונות ווידאו', icon: ImageIcon, free: false, plan: 'חינם (מוגבל)', hasCredits: true },
  { id: 'perplexity', name: 'Perplexity AI', desc: 'ניתוח טרנדים ויראליים בזמן אמת', icon: Zap, free: false, plan: 'API מחובר', hasCredits: false },
  { id: 'whisper', name: 'Whisper AI', desc: 'כתוביות אוטומטיות בעברית', icon: Subtitles, free: true, plan: 'חינם (מובנה)', hasCredits: false },
  { id: 'storage', name: 'אחסון מדיה', desc: 'העלאה ושמירת קבצים', icon: ImageIcon, free: true, plan: 'חינם (מובנה)', hasCredits: false },
];

const AUTO_REFRESH_INTERVAL = 60_000; // 60 seconds

export function ConnectionsTab() {
  const [credits, setCredits] = useState<Record<string, ServiceCredits>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevCreditsRef = useRef<Record<string, ServiceCredits>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const loadCredits = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-credits');
      if (error) throw error;
      const map: Record<string, ServiceCredits> = {};
      for (const c of (data?.credits || [])) {
        map[c.service] = c;
      }

      // Check for credit changes and notify
      const prev = prevCreditsRef.current;
      for (const [svc, cur] of Object.entries(map)) {
        const old = prev[svc];
        if (!old) continue;
        // Was active, now exhausted
        if (old.canGenerate && !cur.canGenerate) {
          const name = serviceConfig.find(s => s.id === svc)?.name || svc;
          toast.error(`⚠️ הקרדיטים של ${name} נגמרו!`, {
            description: 'יש לשדרג את החבילה כדי להמשיך ליצור.',
            duration: 10000,
          });
        }
        // Was below 80%, now above 80%
        if (old.limit > 0 && cur.limit > 0) {
          const oldPct = (old.used / old.limit) * 100;
          const curPct = (cur.used / cur.limit) * 100;
          if (oldPct <= 80 && curPct > 80 && cur.canGenerate) {
            const name = serviceConfig.find(s => s.id === svc)?.name || svc;
            toast.warning(`${name}: נותרו מעט קרדיטים (${Math.round(curPct)}%)`, {
              duration: 8000,
            });
          }
        }
      }

      prevCreditsRef.current = map;
      setCredits(map);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error loading credits:', err);
      if (!silent) toast.error('שגיאה בטעינת נתוני קרדיטים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCredits();
    intervalRef.current = setInterval(() => loadCredits(true), AUTO_REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const getUsagePercent = (c: ServiceCredits) => {
    if (c.limit <= 0) return 0;
    return Math.min(100, Math.round((c.used / c.limit) * 100));
  };

  const getUsageColor = (percent: number, canGenerate: boolean) => {
    if (!canGenerate) return 'bg-destructive';
    if (percent > 80) return 'bg-warning';
    return 'bg-success';
  };

  const formatTimeAgo = (date: Date) => {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 10) return 'עכשיו';
    if (diff < 60) return `לפני ${diff} שניות`;
    return `לפני ${Math.floor(diff / 60)} דקות`;
  };

  // Count exhausted services
  const exhaustedCount = Object.values(credits).filter(c => !c.canGenerate && !c.error).length;
  const warningCount = Object.values(credits).filter(c => c.canGenerate && c.limit > 0 && getUsagePercent(c) > 80).length;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-rubik font-semibold">שירותים מחוברים</h2>
          {(exhaustedCount > 0 || warningCount > 0) && (
            <div className="flex items-center gap-2">
              {exhaustedCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {exhaustedCount} נגמרו
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium flex items-center gap-1">
                  <Bell className="w-3 h-3" />
                  {warningCount} עומדים להיגמר
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              עודכן {formatTimeAgo(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => loadCredits()}
            disabled={loading}
            className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted flex items-center gap-1.5 transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            בדוק קרדיטים
          </button>
        </div>
      </div>

      {/* Services list */}
      <div className="space-y-3">
        {serviceConfig.map(s => {
          const Icon = s.icon;
          const credit = credits[s.id];

          return (
            <ServiceCard
              key={s.id}
              config={s}
              Icon={Icon}
              credit={credit}
              loading={loading}
              getUsagePercent={getUsagePercent}
              getUsageColor={getUsageColor}
            />
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        💡 הקרדיטים מתעדכנים אוטומטית כל דקה. שירותים שנגמרו יוצגו עם התראה.
      </p>
    </div>
  );
}

// Extracted service card component
function ServiceCard({
  config: s,
  Icon,
  credit,
  loading,
  getUsagePercent,
  getUsageColor,
}: {
  config: typeof serviceConfig[number];
  Icon: any;
  credit?: ServiceCredits;
  loading: boolean;
  getUsagePercent: (c: ServiceCredits) => number;
  getUsageColor: (p: number, can: boolean) => string;
}) {
  return (
    <div className={cn(
      "p-4 rounded-lg border space-y-3 transition-colors",
      credit && !credit.canGenerate
        ? "bg-destructive/5 border-destructive/30"
        : "bg-muted/30 border-border"
    )}>
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
            <span className="text-xs px-2.5 py-1 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-1 animate-pulse">
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
}
