import { AppLayout } from '@/components/layout/AppLayout';
import { useState } from 'react';
import { ImageIcon, Film, Mic, Wand2, Loader2, Download, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { imageService } from '@/services/creativeService';

type StudioTab = 'image' | 'video' | 'voice' | 'edit';

const tabs: { id: StudioTab; label: string; icon: typeof ImageIcon; desc: string }[] = [
  { id: 'image', label: 'יצירת תמונה', icon: ImageIcon, desc: 'צור תמונות מטקסט עם AI' },
  { id: 'edit', label: 'עריכת תמונה', icon: Wand2, desc: 'ערוך תמונה קיימת עם AI' },
  { id: 'video', label: 'יצירת סרטון', icon: Film, desc: 'צור סרטון מטקסט או תמונה' },
  { id: 'voice', label: 'יצירת קול', icon: Mic, desc: 'המר טקסט לדיבור בעברית' },
];

export default function CreativeStudioPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>('image');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imageUrl?: string; text?: string; audioUrl?: string } | null>(null);
  const [editImageUrl, setEditImageUrl] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error('יש להזין תיאור'); return; }
    setLoading(true);
    setResult(null);
    try {
      if (activeTab === 'image') {
        const data = await imageService.generate(prompt);
        setResult({ imageUrl: data.imageUrl, text: data.text });
        toast.success('התמונה נוצרה בהצלחה!');
      } else if (activeTab === 'edit') {
        if (!editImageUrl.trim()) { toast.error('יש להזין קישור לתמונה'); setLoading(false); return; }
        const data = await imageService.edit(prompt, editImageUrl);
        setResult({ imageUrl: data.imageUrl, text: data.text });
        toast.success('התמונה נערכה בהצלחה!');
      } else if (activeTab === 'video') {
        toast.info('יצירת סרטון – הפיצ\'ר בפיתוח, בקרוב!');
      } else if (activeTab === 'voice') {
        toast.info('יצירת קול – הפיצ\'ר בפיתוח, בקרוב!');
      }
    } catch (err: any) {
      toast.error(err.message || 'שגיאה ביצירה');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.imageUrl) return;
    const link = document.createElement('a');
    link.href = result.imageUrl;
    link.download = `creative-${Date.now()}.png`;
    link.click();
    toast.success('ההורדה החלה');
  };

  const handleCopy = async () => {
    if (!result?.imageUrl) return;
    try {
      await navigator.clipboard.writeText(result.imageUrl);
      toast.success('הקישור הועתק');
    } catch { toast.error('שגיאה בהעתקה'); }
  };

  const placeholders: Record<StudioTab, string> = {
    image: 'תאר את התמונה שאתה רוצה ליצור... למשל: "איש עסקים ישראלי מחייך ליד שלט של החברה שלו"',
    edit: 'תאר מה לשנות בתמונה... למשל: "הפוך את הרקע לשקיעה על הים"',
    video: 'תאר את הסרטון שאתה רוצה... למשל: "סרטון תדמית קצר לחברת יבוא עם אנימציה דינמית"',
    voice: 'הקלד את הטקסט שאתה רוצה להפוך לדיבור בעברית...',
  };

  const buttonLabels: Record<StudioTab, string> = {
    image: 'צור תמונה',
    edit: 'ערוך תמונה',
    video: 'צור סרטון',
    voice: 'צור דיבוב',
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-rubik font-bold flex items-center gap-2">
            <Wand2 className="w-7 h-7 text-primary" />
            סטודיו קריאייטיב
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            כל הכלים שלך ליצירת תמונות, סרטונים וקול במקום אחד
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setResult(null); }}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                  activeTab === tab.id
                    ? 'border-primary bg-primary/10 text-primary shadow-gold'
                    : 'border-border bg-card hover:border-primary/30 text-muted-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Input Area */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <p className="text-sm text-muted-foreground">{tabs.find(t => t.id === activeTab)?.desc}</p>

          {activeTab === 'edit' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">קישור לתמונה מקורית</label>
              <input
                value={editImageUrl}
                onChange={e => setEditImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg או data:image/..."
                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}

          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={placeholders[activeTab]}
            rows={4}
            className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="gradient-gold text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : tabs.find(t => t.id === activeTab)?.icon && <ImageIcon className="w-4 h-4" />}
              {loading ? 'מייצר...' : buttonLabels[activeTab]}
            </button>
            {result && (
              <button onClick={() => { setResult(null); setPrompt(''); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> התחל מחדש
              </button>
            )}
          </div>
        </div>

        {/* Result */}
        {result?.imageUrl && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-rubik font-semibold">התוצאה</h2>
              <div className="flex gap-2">
                <button onClick={handleDownload} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> הורד
                </button>
                <button onClick={handleCopy} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1">
                  <Copy className="w-3.5 h-3.5" /> העתק קישור
                </button>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
              <img
                src={result.imageUrl}
                alt="תוצאה שנוצרה"
                className="max-w-full max-h-[500px] object-contain"
              />
            </div>
            {result.text && (
              <p className="text-sm text-muted-foreground">{result.text}</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
