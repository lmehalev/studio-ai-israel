import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TrendingUp, ExternalLink, Lightbulb, Search, RefreshCw, Eye, Flame, Palette } from 'lucide-react';
import { motion } from 'framer-motion';

interface TrendItem {
  title: string;
  description: string;
  platform: string;
  url: string;
  views: string;
  tip: string;
  visual_style?: string;
}

const INDUSTRY_PRESETS = [
  'שיווק דיגיטלי',
  'ייבוא ויצוא',
  'עמותות ומלכ"רים',
  'נדל"ן',
  'מסעדנות ואוכל',
  'אופנה וביוטי',
  'טכנולוגיה וסטארטאפים',
  'בריאות וכושר',
];

const platformColors: Record<string, string> = {
  tiktok: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  instagram: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  youtube: 'bg-red-500/10 text-red-500 border-red-500/20',
  facebook: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  linkedin: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
};

const getPlatformClass = (platform: string) => {
  const key = platform.toLowerCase();
  for (const [k, v] of Object.entries(platformColors)) {
    if (key.includes(k)) return v;
  }
  return 'bg-muted text-muted-foreground';
};

export default function TrendsPage() {
  const [industry, setIndustry] = useState('');
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [summary, setSummary] = useState('');
  const [citations, setCitations] = useState<string[]>([]);

  const fetchTrends = async (selectedIndustry?: string) => {
    const query = selectedIndustry || industry;
    if (!query.trim()) {
      toast.error('יש להזין תחום פעילות');
      return;
    }
    setLoading(true);
    setTrends([]);
    setSummary('');
    try {
      const { data, error } = await supabase.functions.invoke('fetch-trends', {
        body: { industry: query },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'שגיאה בשליפת טרנדים');

      setTrends(data.trends || []);
      setSummary(data.summary || '');
      setCitations(data.citations || []);
      toast.success(`נמצאו ${data.trends?.length || 0} טרנדים בתחום "${query}"`);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בשליפת טרנדים');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
            <Flame className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">טרנדים חזקים היום</h1>
            <p className="text-sm text-muted-foreground">גלה מה מתפוצץ ברשת השבוע לפי תחום עסקי</p>
          </div>
        </div>

        {/* Search */}
        <Card className="p-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="הזן תחום עסקי, לדוגמה: שיווק דיגיטלי, ייבוא..."
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTrends()}
              className="flex-1"
            />
            <Button onClick={() => fetchTrends()} disabled={loading}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="mr-2">{loading ? 'מחפש...' : 'חפש טרנדים'}</span>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {INDUSTRY_PRESETS.map((preset) => (
              <Badge
                key={preset}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={() => {
                  setIndustry(preset);
                  fetchTrends(preset);
                }}
              >
                {preset}
              </Badge>
            ))}
          </div>
        </Card>

        {/* Summary */}
        {summary && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-2">
              <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground">{summary}</p>
            </div>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </Card>
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && trends.length > 0 && (
          <div className="space-y-4">
            {trends.map((trend, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
              >
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{trend.title}</h3>
                        <Badge className={getPlatformClass(trend.platform)} variant="outline">
                          {trend.platform}
                        </Badge>
                        {trend.views && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {trend.views}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{trend.description}</p>
                      {trend.tip && (
                        <div className="flex items-start gap-1.5 bg-accent/50 rounded-lg p-2 mt-2">
                          <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-foreground">{trend.tip}</p>
                        </div>
                      )}
                    </div>
                    {trend.url && trend.url !== '#' && (
                      <a href={trend.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Citations */}
        {citations.length > 0 && (
          <Card className="p-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">מקורות</h4>
            <ul className="space-y-1">
              {citations.map((c, i) => (
                <li key={i}>
                  <a
                    href={c}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {c}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
