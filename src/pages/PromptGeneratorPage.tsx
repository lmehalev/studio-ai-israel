import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Wand2, Copy, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';

interface Variation {
  type: string;
  text: string;
}

export default function PromptGeneratorPage() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(false);
  const [enhanced, setEnhanced] = useState('');

  const handleEnhance = async () => {
    if (!input.trim()) { toast.error('נא להזין רעיון לשיפור'); return; }
    setLoading(true);
    setEnhanced('');
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('enhance-prompt', {
        body: { text: input, type: 'enhance' },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setEnhanced(data.enhanced || '');
      setResults(data.variations || []);
      if (data.variations?.length > 0) {
        toast.success(`נוצרו עבורך ${data.variations.length} וריאציות`);
      }
    } catch (err: any) {
      console.error('Enhance error:', err);
      toast.error('אירעה שגיאה, נסה שוב');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-rubik font-bold flex items-center gap-2"><Wand2 className="w-6 h-6 text-primary" /> מחולל פרומפטים</h1>
          <p className="text-muted-foreground text-sm mt-1">הכניסו רעיון גולמי וקבלו בריף מסודר עם וריאציות מותאמות – מופעל על ידי AI</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <label className="block text-sm font-medium">הרעיון שלך</label>
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={4}
            placeholder="למשל: אני רוצה סרטון שבו הדמות מסבירה על מוצר טיפוח בעברית בטון משכנע, עם פתיח חד ו-CTA חזק"
            className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          <button onClick={handleEnhance} disabled={loading}
            className="gradient-gold text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? 'ה-AI עובד על זה...' : 'שפר לי את הבריף'}
          </button>
        </div>

        {enhanced && (
          <div className="bg-card border border-primary/30 rounded-xl p-6 shadow-gold">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-rubik font-semibold text-primary">בריף משופר</h3>
              <button onClick={() => { navigator.clipboard.writeText(enhanced); toast.success('הועתק!'); }} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <Copy className="w-3.5 h-3.5" /> העתק
              </button>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{enhanced}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => toast.success('נשמר כתבנית')} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1">
                <FileText className="w-3 h-3" /> שמור כתבנית
              </button>
              <button onClick={() => toast.info('פונקציה זו תחובר בעתיד')} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium">
                השתמש בתוצאה בפרויקט
              </button>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-rubik font-semibold">וריאציות</h3>
            {results.map((r, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">{r.type}</span>
                  <button onClick={() => { navigator.clipboard.writeText(r.text); toast.success('הועתק!'); }}>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
                <p className="text-sm leading-relaxed">{r.text}</p>
              </div>
            ))}
            <button onClick={handleEnhance} disabled={loading} className="w-full py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> צור עוד וריאציות
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
