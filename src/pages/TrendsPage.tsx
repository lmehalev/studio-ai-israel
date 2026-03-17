import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TrendingUp, ExternalLink, Lightbulb, Search, RefreshCw, Eye, Flame, Palette, Database, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TrendItem {
  title: string;
  description: string;
  platform: string;
  url: string;
  views: string;
  tip: string;
  visual_style?: string;
}

interface SavedTrend extends TrendItem {
  id: string;
  category: string;
  fetched_at: string;
}

const INDUSTRY_PRESETS = [
  'עולם עסקי וליווי עסקי',
  'נדל"ן',
  'בנייה ואחזקת מבנים',
  'ייבוא ויצוא',
  'טכנולוגיה וצ\'אטבוטים',
  'עמותות ומלכ"רים',
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

function TrendCard({ trend, idx }: { trend: TrendItem | SavedTrend; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.06 }}
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
              {'category' in trend && (
                <Badge variant="secondary" className="text-xs">
                  {(trend as SavedTrend).category}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{trend.description}</p>
            {trend.tip && (
              <div className="flex items-start gap-1.5 bg-accent/50 rounded-lg p-2 mt-2">
                <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-foreground">{trend.tip}</p>
              </div>
            )}
            {trend.visual_style && (
              <div className="flex items-start gap-1.5 bg-primary/5 rounded-lg p-2 mt-1">
                <Palette className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">סגנון ויזואלי:</span> {trend.visual_style}
                </p>
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
  );
}

export default function TrendsPage() {
  const [industry, setIndustry] = useState('');
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [summary, setSummary] = useState('');
  const [citations, setCitations] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('search');
  const [savedTrends, setSavedTrends] = useState<SavedTrend[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Load saved trends from DB
  const loadSavedTrends = async (category?: string) => {
    setSavedLoading(true);
    try {
      let query = supabase
        .from('saved_trends')
        .select('*')
        .order('fetched_at', { ascending: false })
        .limit(50);
      
      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSavedTrends((data as any[]) || []);
    } catch (err: any) {
      console.error('Error loading saved trends:', err);
    } finally {
      setSavedLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'saved') {
      loadSavedTrends(selectedCategory || undefined);
    }
  }, [activeTab, selectedCategory]);

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

  const triggerAutoFetch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-fetch-trends', {
        body: { category: 'all' },
      });
      if (error) throw new Error(error.message);
      toast.success(`עדכון אוטומטי הושלם! ${data?.results?.map((r: any) => `${r.category}: ${r.count}`).join(', ')}`);
      if (activeTab === 'saved') {
        loadSavedTrends(selectedCategory || undefined);
      }
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בעדכון אוטומטי');
    } finally {
      setLoading(false);
    }
  };

  const lastFetchDate = savedTrends.length > 0 
    ? new Date(savedTrends[0].fetched_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <Flame className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">טרנדים חזקים היום</h1>
              <p className="text-sm text-muted-foreground">גלה מה מתפוצץ ברשת — המערכת לומדת ומשתפרת כל יום</p>
            </div>
          </div>
          <Button variant="outline" onClick={triggerAutoFetch} disabled={loading} className="gap-2">
            <Database className="w-4 h-4" />
            עדכן את כל הקטגוריות
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">
              <Search className="w-4 h-4 ml-2" />
              חיפוש חופשי
            </TabsTrigger>
            <TabsTrigger value="saved">
              <Database className="w-4 h-4 ml-2" />
              מאגר טרנדים שמור
            </TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-4 mt-4">
            <Card className="p-4 space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="הזן תחום עסקי או טקסט חופשי..."
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

            {summary && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground">{summary}</p>
                </div>
              </Card>
            )}

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

            {!loading && trends.length > 0 && (
              <div className="space-y-4">
                {trends.map((trend, idx) => (
                  <TrendCard key={idx} trend={trend} idx={idx} />
                ))}
              </div>
            )}

            {citations.length > 0 && (
              <Card className="p-4">
                <h4 className="text-sm font-semibold text-foreground mb-2">מקורות</h4>
                <ul className="space-y-1">
                  {citations.map((c, i) => (
                    <li key={i}>
                      <a href={c} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {c}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </TabsContent>

          {/* Saved Trends Tab */}
          <TabsContent value="saved" className="space-y-4 mt-4">
            {lastFetchDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                עדכון אחרון: {lastFetchDate}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedCategory === null ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedCategory(null)}
              >
                הכל
              </Badge>
              {INDUSTRY_PRESETS.map((cat) => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>

            {savedLoading && (
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

            {!savedLoading && savedTrends.length === 0 && (
              <Card className="p-8 text-center">
                <Database className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-1">עדיין אין טרנדים שמורים</h3>
                <p className="text-sm text-muted-foreground mb-4">לחץ על "עדכן את כל הקטגוריות" כדי לשלוף טרנדים חדשים ולשמור אותם</p>
                <Button onClick={triggerAutoFetch} disabled={loading}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : <Database className="w-4 h-4 ml-2" />}
                  עדכן עכשיו
                </Button>
              </Card>
            )}

            {!savedLoading && savedTrends.length > 0 && (
              <div className="space-y-4">
                {savedTrends.map((trend, idx) => (
                  <TrendCard key={trend.id} trend={trend} idx={idx} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
