import { useState } from 'react';
import { Globe, Loader2, Check, X, ChevronDown, Palette, FileText, Image as ImageIcon, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface WebsiteBrandKit {
  colors: string[];
  logoCandidates: string[];
  typographyHint: string | null;
  colorScheme?: string | null;
}

export interface WebsiteContentKit {
  mainHeadline: string;
  subheadline: string;
  bullets: string[];
  ctas: string[];
  keywords: string[];
  faqPairs: { q: string; a: string }[];
  valueProposition: string;
  targetAudience: string;
  tone: string;
}

export interface WebsiteScanResult {
  brand: WebsiteBrandKit | null;
  content: WebsiteContentKit | null;
  screenshot: string | null;
  sourceUrl: string;
}

interface WebsiteScanPanelProps {
  onApplyContent: (data: {
    headline?: string;
    subheadline?: string;
    bullets?: string[];
    cta?: string;
    keywords?: string[];
    brandColors?: string[];
    logoUrl?: string;
  }) => void;
  onScanComplete?: (result: WebsiteScanResult) => void;
  className?: string;
}

export function WebsiteScanPanel({ onApplyContent, onScanComplete, className }: WebsiteScanPanelProps) {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<WebsiteScanResult | null>(null);
  const [activeTab, setActiveTab] = useState<'brand' | 'content'>('content');

  // Editable content state
  const [editHeadline, setEditHeadline] = useState('');
  const [editSubheadline, setEditSubheadline] = useState('');
  const [editCta, setEditCta] = useState('');
  const [selectedBullets, setSelectedBullets] = useState<Set<number>>(new Set());
  const [selectedKeywords, setSelectedKeywords] = useState<Set<number>>(new Set());
  const [selectedCtas, setSelectedCtas] = useState<number>(0);

  const handleScan = async () => {
    if (!url.trim()) { toast.error('יש להזין כתובת אתר'); return; }
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-website-content', {
        body: { url: url.trim() },
      });

      if (error) {
        // Structured error from Supabase client (e.g. network / CORS / 404)
        const status = (error as any)?.status || (error as any)?.context?.status;
        const detail = error.message || 'שגיאה בשליחה ל-Edge Function';
        console.error('[WebsiteScan] Edge Function error', { functionName: 'scrape-website-content', status, detail });
        throw new Error(`שגיאה (${status || '?'}): ${detail}`);
      }

      if (!data?.success) {
        const errMsg = data?.error || 'סריקה נכשלה ללא פרטים';
        console.error('[WebsiteScan] Function returned error', { functionName: 'scrape-website-content', error: errMsg });
        throw new Error(errMsg);
      }

      const result: WebsiteScanResult = {
        brand: data.brand,
        content: data.content,
        screenshot: data.screenshot,
        sourceUrl: data.sourceUrl,
      };
      setScanResult(result);
      onScanComplete?.(result);

      // Initialize editable state from content
      if (data.content) {
        setEditHeadline(data.content.mainHeadline || '');
        setEditSubheadline(data.content.subheadline || '');
        setEditCta(data.content.ctas?.[0] || '');
        setSelectedBullets(new Set(data.content.bullets?.map((_: string, i: number) => i) || []));
        setSelectedKeywords(new Set(data.content.keywords?.map((_: string, i: number) => i) || []));
        setSelectedCtas(0);
      }
      toast.success('האתר נסרק בהצלחה!');
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בסריקה');
    } finally {
      setScanning(false);
    }
  };

  const handleApply = () => {
    if (!scanResult?.content) return;
    const c = scanResult.content;
    const chosenBullets = c.bullets?.filter((_: string, i: number) => selectedBullets.has(i)) || [];
    const chosenKeywords = c.keywords?.filter((_: string, i: number) => selectedKeywords.has(i)) || [];

    onApplyContent({
      headline: editHeadline || undefined,
      subheadline: editSubheadline || undefined,
      bullets: chosenBullets.length > 0 ? chosenBullets : undefined,
      cta: editCta || undefined,
      keywords: chosenKeywords.length > 0 ? chosenKeywords : undefined,
      brandColors: scanResult.brand?.colors || undefined,
      logoUrl: scanResult.brand?.logoCandidates?.[0] || undefined,
    });
    toast.success('התוכן הוזרק לפרומפט!');
  };

  const toggleBullet = (i: number) => setSelectedBullets(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const toggleKeyword = (i: number) => setSelectedKeywords(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  return (
    <div className={cn('space-y-3', className)}>
      {/* URL input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !scanning && handleScan()}
            placeholder="https://example.com"
            dir="ltr"
            className="w-full bg-muted/50 border border-border rounded-lg pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button
          onClick={handleScan}
          disabled={scanning || !url.trim()}
          className="px-4 py-2.5 gradient-gold text-primary-foreground rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          {scanning ? 'סורק...' : 'סרוק אתר'}
        </button>
      </div>

      {/* Scan results */}
      {scanResult && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary" /> מה נסרק מהאתר
            </p>
            <button onClick={() => setScanResult(null)} className="p-1 hover:bg-muted rounded">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('content')}
              className={cn('flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                activeTab === 'content' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}
            >
              <FileText className="w-3.5 h-3.5" /> תוכן
            </button>
            <button
              onClick={() => setActiveTab('brand')}
              className={cn('flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                activeTab === 'brand' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}
            >
              <Palette className="w-3.5 h-3.5" /> מותג
            </button>
          </div>

          <div className="p-3 max-h-[300px] overflow-y-auto space-y-3">
            {activeTab === 'content' && scanResult.content && (
              <>
                {/* Headline */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">כותרת ראשית</label>
                  <input
                    value={editHeadline}
                    onChange={e => setEditHeadline(e.target.value)}
                    dir="rtl"
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                {/* Subheadline */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">תת-כותרת</label>
                  <input
                    value={editSubheadline}
                    onChange={e => setEditSubheadline(e.target.value)}
                    dir="rtl"
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                {/* Bullets with checkboxes */}
                {scanResult.content.bullets?.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      נקודות מכירה ({selectedBullets.size}/{scanResult.content.bullets.length})
                    </label>
                    {scanResult.content.bullets.map((b: string, i: number) => (
                      <label key={i} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={selectedBullets.has(i)}
                          onChange={() => toggleBullet(i)}
                          className="mt-0.5 accent-primary"
                        />
                        <span className={cn(!selectedBullets.has(i) && 'text-muted-foreground line-through')}>{b}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* CTAs */}
                {scanResult.content.ctas?.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">CTA (קריאה לפעולה)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {scanResult.content.ctas.map((cta: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => { setSelectedCtas(i); setEditCta(cta); }}
                          className={cn('px-2.5 py-1 rounded-lg text-xs border transition-all',
                            selectedCtas === i ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/30')}
                        >
                          {cta}
                        </button>
                      ))}
                    </div>
                    <input
                      value={editCta}
                      onChange={e => setEditCta(e.target.value)}
                      dir="rtl"
                      placeholder="או כתוב CTA מותאם אישית..."
                      className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                )}

                {/* Keywords */}
                {scanResult.content.keywords?.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Tag className="w-3 h-3" /> מילות מפתח
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {scanResult.content.keywords.map((kw: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => toggleKeyword(i)}
                          className={cn('px-2 py-0.5 rounded-full text-[10px] border transition-all',
                            selectedKeywords.has(i) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/30')}
                        >
                          {kw}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!scanResult.content && (
                  <p className="text-xs text-muted-foreground text-center py-4">לא נמצא תוכן מובנה באתר</p>
                )}
              </>
            )}

            {activeTab === 'brand' && (
              <>
                {/* Colors */}
                {scanResult.brand?.colors && scanResult.brand.colors.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">צבעים</label>
                    <div className="flex flex-wrap gap-2">
                      {scanResult.brand.colors.map((color, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-2 py-1">
                          <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: color }} />
                          <span className="font-mono text-[10px]">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logo candidates */}
                {scanResult.brand?.logoCandidates && scanResult.brand.logoCandidates.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> לוגו / תמונות מותג
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {scanResult.brand.logoCandidates.map((src, i) => (
                        <div key={i} className="w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted/50 flex items-center justify-center">
                          <img src={src} alt={`logo ${i+1}`} className="max-w-full max-h-full object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Typography */}
                {scanResult.brand?.typographyHint && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">פונט/סגנון</label>
                    <p className="text-xs bg-muted/50 border border-border rounded-lg px-3 py-2">{scanResult.brand.typographyHint}</p>
                  </div>
                )}

                {/* Screenshot */}
                {scanResult.screenshot && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">צילום מסך</label>
                    <div className="rounded-lg overflow-hidden border border-border">
                      <img src={scanResult.screenshot} alt="screenshot" className="w-full object-contain max-h-[200px]" />
                    </div>
                  </div>
                )}

                {!scanResult.brand && (
                  <p className="text-xs text-muted-foreground text-center py-4">לא נמצא מידע מותגי באתר</p>
                )}
              </>
            )}
          </div>

          {/* Apply button */}
          {scanResult.content && (
            <div className="px-3 pb-3">
              <button
                onClick={handleApply}
                className="w-full gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> השתמש בתוכן מהאתר
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
