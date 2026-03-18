import { useState, useEffect, useRef } from 'react';
import { Check, Loader2, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Sparkles, Mic, UserCircle, Video, ImageIcon, Subtitles, Bell, Zap, Wand2, ShieldCheck, ShieldAlert, ShieldX, CircleDot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ProviderStatus {
  service: string;
  readiness: string;
  authValid: boolean;
  creditsAvailable: boolean | null;
  modelsAccessible: boolean | null;
  liveGenerationPassed: boolean | null;
  environment: string;
  used: number;
  limit: number;
  unit: string;
  plan: string;
  canGenerate: boolean;
  dashboardUrl: string;
  statusLabel: string;
  lastFailureReason?: string;
  error?: string;
}

const serviceConfig = [
  { id: 'gemini', name: 'Gemini AI', desc: 'תמונות + טקסט + תסריטים + שיפור פרומפטים', icon: Sparkles, free: true, plan: 'חינם (מובנה)', hasCredits: false },
  { id: 'elevenlabs', name: 'ElevenLabs', desc: 'דיבוב, שכפול קול, מוזיקה, SFX', icon: Mic, free: false, plan: 'חינם (מוגבל)', hasCredits: true },
  { id: 'heygen', name: 'HeyGen', desc: 'אווטאר מדבר, Photo Avatar, תבניות', icon: UserCircle, free: false, plan: 'חינם (Trial)', hasCredits: true },
  { id: 'runway', name: 'RunwayML', desc: 'וידאו AI קולנועי (Image/Text → Video)', icon: Video, free: false, plan: 'חינם (Trial)', hasCredits: true },
  { id: 'krea', name: 'Krea AI', desc: '40+ מודלים: Flux, Veo 3, Kling 2.5, Upscale', icon: Wand2, free: false, plan: 'API מחובר', hasCredits: true },
  { id: 'shotstack', name: 'Shotstack', desc: 'עריכת וידאו, רינדור רב-שכבתי, כתוביות', icon: Video, free: false, plan: 'Sandbox (חינם)', hasCredits: true },
  { id: 'cloudinary', name: 'Cloudinary', desc: 'ניהול מדיה, עיבוד תמונות ווידאו', icon: ImageIcon, free: false, plan: 'חינם (מוגבל)', hasCredits: true },
  { id: 'perplexity', name: 'Perplexity AI', desc: 'ניתוח טרנדים ויראליים בזמן אמת', icon: Zap, free: false, plan: 'API מחובר', hasCredits: false },
  { id: 'whisper', name: 'Whisper AI', desc: 'כתוביות אוטומטיות בעברית', icon: Subtitles, free: true, plan: 'חינם (מובנה)', hasCredits: false },
  { id: 'storage', name: 'אחסון מדיה', desc: 'העלאה ושמירת קבצים', icon: ImageIcon, free: true, plan: 'חינם (מובנה)', hasCredits: false },
];

const readinessColors: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  generation_verified: { bg: 'bg-success/15', text: 'text-success', icon: CheckCircle2 },
  credits_ok: { bg: 'bg-success/10', text: 'text-success', icon: ShieldCheck },
  authenticated: { bg: 'bg-warning/15', text: 'text-warning', icon: ShieldAlert },
  connected: { bg: 'bg-info/15', text: 'text-info', icon: CircleDot },
  blocked_credits: { bg: 'bg-destructive/15', text: 'text-destructive', icon: ShieldX },
  blocked_env: { bg: 'bg-warning/15', text: 'text-warning', icon: ShieldAlert },
  auth_failed: { bg: 'bg-destructive/15', text: 'text-destructive', icon: ShieldX },
  error: { bg: 'bg-destructive/15', text: 'text-destructive', icon: AlertTriangle },
  not_configured: { bg: 'bg-muted', text: 'text-muted-foreground', icon: CircleDot },
};

const AUTO_REFRESH_INTERVAL = 60_000;

export function ConnectionsTab() {
  const [credits, setCredits] = useState<Record<string, ProviderStatus>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevCreditsRef = useRef<Record<string, ProviderStatus>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const loadCredits = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-credits');
      if (error) throw error;
      const map: Record<string, ProviderStatus> = {};
      for (const c of (data?.credits || [])) {
        map[c.service] = c;
      }

      const prev = prevCreditsRef.current;
      for (const [svc, cur] of Object.entries(map)) {
        const old = prev[svc];
        if (!old) continue;
        if (old.canGenerate && !cur.canGenerate) {
          const name = serviceConfig.find(s => s.id === svc)?.name || svc;
          toast.error(`⚠️ ${name} — ${cur.statusLabel || 'חסום'}`, { duration: 10000 });
        }
      }

      prevCreditsRef.current = map;
      setCredits(map);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error loading credits:', err);
      if (!silent) toast.error('שגיאה בטעינת נתוני ספקים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCredits();
    intervalRef.current = setInterval(() => loadCredits(true), AUTO_REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const getUsagePercent = (c: ProviderStatus) => {
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

  const blockedCount = Object.values(credits).filter(c => c.readiness === 'blocked_credits' || c.readiness === 'auth_failed').length;
  const warningCount = Object.values(credits).filter(c => c.readiness === 'authenticated' || c.readiness === 'blocked_env').length;
  const verifiedCount = Object.values(credits).filter(c => c.readiness === 'generation_verified').length;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-rubik font-semibold">מצב ספקים</h2>
          <div className="flex items-center gap-2">
            {verifiedCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {verifiedCount} אומתו
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {warningCount} לא אומתו
              </span>
            )}
            {blockedCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium flex items-center gap-1">
                <ShieldX className="w-3 h-3" /> {blockedCount} חסומים
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="text-xs text-muted-foreground">עודכן {formatTimeAgo(lastUpdated)}</span>}
          <button onClick={() => loadCredits()} disabled={loading}
            className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted flex items-center gap-1.5 transition-colors">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            בדוק ספקים
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {serviceConfig.map(s => (
          <ServiceCard key={s.id} config={s} Icon={s.icon} credit={credits[s.id]} loading={loading}
            getUsagePercent={getUsagePercent} getUsageColor={getUsageColor} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        💡 המערכת בודקת אימות, קרדיטים ויכולת יצירה חיה עבור כל ספק. ספקים שרק "מחוברים" לא ישמשו ליצירה.
      </p>
    </div>
  );
}

function ServiceCard({ config: s, Icon, credit, loading, getUsagePercent, getUsageColor }: {
  config: typeof serviceConfig[number]; Icon: any; credit?: ProviderStatus; loading: boolean;
  getUsagePercent: (c: ProviderStatus) => number; getUsageColor: (p: number, can: boolean) => string;
}) {
  const readiness = credit?.readiness || (s.free ? 'credits_ok' : 'not_configured');
  const rConfig = readinessColors[readiness] || readinessColors.not_configured;
  const StatusIcon = rConfig.icon;

  return (
    <div className={cn(
      "p-4 rounded-lg border space-y-3 transition-colors",
      readiness === 'blocked_credits' || readiness === 'auth_failed' ? "bg-destructive/5 border-destructive/30"
        : readiness === 'authenticated' || readiness === 'blocked_env' ? "bg-warning/5 border-warning/30"
        : "bg-muted/30 border-border"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", rConfig.bg, rConfig.text)}>
            <StatusIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" /> {s.name}
            </p>
            <p className="text-xs text-muted-foreground">{s.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", s.free ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning")}>
            {credit?.plan || s.plan}
          </span>
          {credit?.environment && credit.environment !== 'unknown' && credit.environment !== 'production' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-info/10 text-info font-medium">
              {credit.environment}
            </span>
          )}
          <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1", rConfig.bg, rConfig.text,
            (readiness === 'blocked_credits' || readiness === 'auth_failed') && "animate-pulse"
          )}>
            <StatusIcon className="w-3 h-3" />
            {credit?.statusLabel || (s.free ? 'פעיל' : 'לא מוגדר')}
          </span>
        </div>
      </div>

      {/* Validation checklist */}
      {credit && (
        <div className="mr-13 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <ChecklistItem label="אימות" value={credit.authValid} />
          <ChecklistItem label="קרדיטים" value={credit.creditsAvailable} />
          <ChecklistItem label="מודלים" value={credit.modelsAccessible} />
          <ChecklistItem label="יצירה חיה" value={credit.liveGenerationPassed} />
        </div>
      )}

      {/* Credits bar */}
      {s.hasCredits && credit && !credit.error && credit.limit > 0 && (
        <div className="mr-13 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">שימוש: {credit.used} / {credit.limit} {credit.unit}</span>
            <span className={cn("font-medium", credit.canGenerate ? "text-foreground" : "text-destructive")}>{getUsagePercent(credit)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-500", getUsageColor(getUsagePercent(credit), credit.canGenerate))}
              style={{ width: `${getUsagePercent(credit)}%` }} />
          </div>
        </div>
      )}

      {/* Failure reason */}
      {credit?.lastFailureReason && (
        <div className="mr-13">
          <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2 break-all">
            ⚠️ {credit.lastFailureReason}
          </p>
        </div>
      )}

      {/* Error state */}
      {credit?.error && !credit.lastFailureReason && (
        <div className="mr-13">
          <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">⚠️ {credit.error}</p>
        </div>
      )}

      {/* Loading */}
      {s.hasCredits && loading && !credit && (
        <div className="mr-13 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" /> בודק ספק...
        </div>
      )}

      {/* Dashboard */}
      {s.hasCredits && credit?.dashboardUrl && (
        <div className="mr-13">
          <a href={credit.dashboardUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
            <ExternalLink className="w-3 h-3" /> ניהול חשבון ושדרוג
          </a>
        </div>
      )}
    </div>
  );
}

function ChecklistItem({ label, value }: { label: string; value: boolean | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="flex items-center gap-1 text-muted-foreground">⬜ {label}</span>;
  }
  return value
    ? <span className="flex items-center gap-1 text-success">✅ {label}</span>
    : <span className="flex items-center gap-1 text-destructive">❌ {label}</span>;
}
