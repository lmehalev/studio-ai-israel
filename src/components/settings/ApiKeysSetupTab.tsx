import { useState, useEffect } from 'react';
import { ExternalLink, Copy, CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw, Key, CreditCard, Sparkles, Mic, UserCircle, Video, Wand2, Film } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProviderStatus {
  service: string;
  readiness: string;
  canGenerate: boolean;
  creditsAvailable: boolean | null;
  used: number;
  limit: number;
  unit: string;
  plan: string;
  statusLabel: string;
  error?: string;
}

interface ApiProvider {
  id: string;
  name: string;
  icon: any;
  secretKey: string;
  description: string;
  category: string;
  getKeyUrl: string;
  billingUrl: string;
  getKeySteps: string[];
  critical: boolean;
  color: string;
}

const PROVIDERS: ApiProvider[] = [
  {
    id: 'gemini',
    name: 'Gemini AI (Lovable)',
    icon: Sparkles,
    secretKey: 'LOVABLE_API_KEY',
    description: 'יצירת תסריטים, תמונות, שיפור פרומפטים — נדרש לכל פעולת AI',
    category: 'AI מרכזי',
    getKeyUrl: 'https://lovable.dev/settings',
    billingUrl: 'https://lovable.dev/billing',
    getKeySteps: [
      'כנס ל-lovable.dev',
      'לחץ על תמונת הפרופיל שלך',
      'הגדרות → API Keys',
      'העתק את המפתח',
    ],
    critical: true,
    color: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    icon: Mic,
    secretKey: 'ELEVENLABS_API_KEY',
    description: 'קריינות עברית, שכפול קול, SFX',
    category: 'קול',
    getKeyUrl: 'https://elevenlabs.io/app/settings/api-keys',
    billingUrl: 'https://elevenlabs.io/subscription',
    getKeySteps: [
      'כנס ל-elevenlabs.io',
      'לחץ על הפרופיל → Profile',
      'API Keys → Create new key',
      'העתק את המפתח',
    ],
    critical: true,
    color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
  },
  {
    id: 'heygen',
    name: 'HeyGen',
    icon: UserCircle,
    secretKey: 'HEYGEN_API_KEY',
    description: 'אווטאר מדבר, Photo Avatar — לסרטוני פנים',
    category: 'וידאו אווטאר',
    getKeyUrl: 'https://app.heygen.com/settings?tab=api',
    billingUrl: 'https://app.heygen.com/settings?tab=billing',
    getKeySteps: [
      'כנס ל-app.heygen.com',
      'Settings → API',
      'Generate API Token',
      'העתק את המפתח',
    ],
    critical: false,
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  },
  {
    id: 'krea',
    name: 'Krea AI',
    icon: Wand2,
    secretKey: 'KREA_API_KEY',
    description: 'יצירת וידאו AI — Veo 3, Kling 2.5, Flux, Upscale',
    category: 'וידאו AI',
    getKeyUrl: 'https://krea.ai/api',
    billingUrl: 'https://krea.ai/pricing',
    getKeySteps: [
      'כנס ל-krea.ai',
      'לחץ על הפרופיל → API',
      'Create API Key',
      'העתק את המפתח',
    ],
    critical: true,
    color: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
  },
  {
    id: 'runway',
    name: 'RunwayML',
    icon: Video,
    secretKey: 'RUNWAY_API_KEY',
    description: 'וידאו קולנועי — גיבוי ל-Krea (Gen 4.5)',
    category: 'וידאו AI (גיבוי)',
    getKeyUrl: 'https://app.runwayml.com/settings',
    billingUrl: 'https://app.runwayml.com/settings/billing',
    getKeySteps: [
      'כנס ל-app.runwayml.com',
      'Settings → Integrations',
      'API Keys → Create new',
      'העתק את המפתח',
    ],
    critical: false,
    color: 'from-slate-500/20 to-gray-500/20 border-slate-500/30',
  },
  {
    id: 'shotstack',
    name: 'Shotstack',
    icon: Film,
    secretKey: 'SHOTSTACK_API_KEY',
    description: 'הרכבת וידאו סופי — כתוביות, לוגו, מוזיקה',
    category: 'עריכת וידאו',
    getKeyUrl: 'https://dashboard.shotstack.io/api-keys',
    billingUrl: 'https://dashboard.shotstack.io/billing',
    getKeySteps: [
      'כנס ל-dashboard.shotstack.io',
      'לחץ על API Keys',
      'Create new key → Production',
      'העתק את המפתח',
    ],
    critical: true,
    color: 'from-red-500/20 to-rose-500/20 border-red-500/30',
  },
];

const SUPABASE_SECRETS_URL = 'https://supabase.com/dashboard/project/_/settings/vault';

function StatusBadge({ readiness, canGenerate }: { readiness?: string; canGenerate?: boolean }) {
  if (!readiness) return <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">לא נבדק</span>;

  if (readiness === 'generation_verified' || readiness === 'credits_ok') {
    return <span className="text-xs text-green-400 px-2 py-0.5 bg-green-500/10 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> מחובר ✓</span>;
  }
  if (readiness === 'blocked_credits') {
    return <span className="text-xs text-red-400 px-2 py-0.5 bg-red-500/10 rounded-full flex items-center gap-1"><CreditCard className="w-3 h-3" /> נגמרו קרדיטים</span>;
  }
  if (readiness === 'auth_failed') {
    return <span className="text-xs text-red-400 px-2 py-0.5 bg-red-500/10 rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" /> מפתח שגוי</span>;
  }
  if (readiness === 'error') {
    return <span className="text-xs text-orange-400 px-2 py-0.5 bg-orange-500/10 rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3" /> שגיאה</span>;
  }
  return <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">לא מוגדר</span>;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} הועתק`));
}

export function ApiKeysSetupTab() {
  const [credits, setCredits] = useState<Record<string, ProviderStatus>>({});
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadCredits = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('check-credits', { body: {} });
      const items: ProviderStatus[] = Array.isArray(data?.credits) ? data.credits : [];
      const map: Record<string, ProviderStatus> = {};
      for (const item of items) {
        map[item.service] = item;
      }
      setCredits(map);
    } catch (e) {
      console.error('Failed to load credits:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCredits(); }, []);

  const criticalIssues = PROVIDERS.filter(p => {
    const c = credits[p.id];
    if (!c) return false;
    return c.readiness === 'blocked_credits' || c.readiness === 'auth_failed' || c.readiness === 'error' || c.readiness === 'not_configured';
  });

  return (
    <div className="space-y-6" dir="rtl">

      {/* Alert banner */}
      {criticalIssues.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">נמצאו {criticalIssues.length} בעיות חיבור</p>
            <p className="text-xs text-muted-foreground mt-1">
              {criticalIssues.map(p => p.name).join(', ')} — יש להוסיף קרדיטים או לחדש את המפתח
            </p>
          </div>
        </div>
      )}

      {/* How to update keys in Supabase */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><Key className="w-4 h-4 text-primary" /> איך מעדכנים מפתח API?</h2>
          <a
            href={SUPABASE_SECRETS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors font-medium"
          >
            <ExternalLink className="w-3 h-3" /> פתח ניהול מפתחות Supabase
          </a>
        </div>
        <ol className="space-y-1.5 text-sm text-muted-foreground list-none">
          <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold shrink-0">1</span> לחץ על "פתח ניהול מפתחות Supabase" למעלה</li>
          <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold shrink-0">2</span> בחר את הפרויקט שלך → Settings → Vault</li>
          <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold shrink-0">3</span> מצא את המפתח לפי השם (לדוגמה: ELEVENLABS_API_KEY)</li>
          <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold shrink-0">4</span> לחץ על עיפרון ✏️ → הכנס את המפתח החדש → שמור</li>
        </ol>
      </div>

      {/* Refresh button */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">סטטוס חיבורים</h2>
        <button
          onClick={loadCredits}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          רענן
        </button>
      </div>

      {/* Provider cards */}
      <div className="space-y-3">
        {PROVIDERS.map(provider => {
          const credit = credits[provider.id];
          const isExpanded = expanded === provider.id;
          const Icon = provider.icon;
          const hasIssue = credit && (credit.readiness === 'blocked_credits' || credit.readiness === 'auth_failed' || credit.readiness === 'error');

          return (
            <div
              key={provider.id}
              className={`bg-gradient-to-l ${provider.color} border rounded-xl overflow-hidden transition-all`}
            >
              {/* Header row */}
              <button
                className="w-full p-4 text-right"
                onClick={() => setExpanded(isExpanded ? null : provider.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge readiness={credit?.readiness} canGenerate={credit?.canGenerate} />
                    <span className="text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <h3 className="font-semibold text-sm">{provider.name}</h3>
                      <div className="w-7 h-7 rounded-lg bg-background/50 flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
                  </div>
                </div>

                {/* Credits bar */}
                {credit && credit.limit > 0 && credit.unit !== 'קרדיטים' && (
                  <div className="mt-2 text-right">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{credit.used.toLocaleString()} / {credit.limit.toLocaleString()} {credit.unit}</span>
                      <span>{Math.round((credit.used / credit.limit) * 100)}% בשימוש</span>
                    </div>
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${credit.used / credit.limit > 0.9 ? 'bg-red-500' : credit.used / credit.limit > 0.7 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, (credit.used / credit.limit) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Credits remaining for credit-based services */}
                {credit && credit.limit > 0 && credit.unit === 'קרדיטים' && (
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    {credit.limit} {credit.unit} נותרו — {credit.plan}
                  </p>
                )}

                {/* Issue hint */}
                {hasIssue && (
                  <p className="text-xs text-red-400 mt-1 text-right">
                    {credit.readiness === 'blocked_credits' ? '⚠️ נגמרו הקרדיטים — יש לחדש' : '⚠️ מפתח API לא תקין — יש לעדכן'}
                  </p>
                )}
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">

                  {/* Secret name */}
                  <div className="bg-background/40 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">שם המפתח ב-Supabase:</p>
                    <div className="flex items-center gap-2 justify-between">
                      <button
                        onClick={() => copyToClipboard(provider.secretKey, 'שם המפתח')}
                        className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                        title="העתק"
                      >
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <code className="text-sm font-mono text-primary">{provider.secretKey}</code>
                    </div>
                  </div>

                  {/* Steps to get key */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">איך מקבלים מפתח:</p>
                    <ol className="space-y-1">
                      {provider.getKeySteps.map((step, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="w-4 h-4 rounded-full bg-muted text-[10px] flex items-center justify-center shrink-0">{i + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={provider.getKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border bg-background/50 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Key className="w-3 h-3" /> קבל מפתח API
                    </a>
                    <a
                      href={provider.billingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors font-medium"
                    >
                      <CreditCard className="w-3 h-3" /> הוסף קרדיטים / שדרג
                    </a>
                    <a
                      href={SUPABASE_SECRETS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border bg-background/50 hover:bg-muted rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> עדכן ב-Supabase
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom note */}
      <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">💡 טיפ</p>
        <p>אחרי עדכון מפתח ב-Supabase — לחץ "רענן" בדף זה לראות את הסטטוס המעודכן.</p>
        <p>מפתחות API הם סודיים — לעולם אל תשתף אותם עם אחרים.</p>
      </div>
    </div>
  );
}
