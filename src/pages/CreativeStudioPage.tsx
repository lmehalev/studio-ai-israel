import { AppLayout } from '@/components/layout/AppLayout';
import { useState, useRef, useEffect } from 'react';
import { ImageIcon, Film, Mic, Wand2, Loader2, Download, Copy, RefreshCw, Play, Pause, Square, Plus, Trash2, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { imageService, voiceService, brandService, type Brand } from '@/services/creativeService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type StudioTab = 'image' | 'video' | 'voice' | 'edit';

const tabs: { id: StudioTab; label: string; icon: typeof ImageIcon; desc: string }[] = [
  { id: 'image', label: 'יצירת תמונה', icon: ImageIcon, desc: 'צור תמונות שיווקיות מטקסט עם AI' },
  { id: 'edit', label: 'עריכת תמונה', icon: Wand2, desc: 'ערוך תמונה קיימת עם AI' },
  { id: 'video', label: 'יצירת סרטון', icon: Film, desc: 'יצירת סרטון – בקרוב! (דורש ספק וידאו)' },
  { id: 'voice', label: 'יצירת קול', icon: Mic, desc: 'המר טקסט לדיבור מקצועי בעברית' },
];

const hebrewVoices = [
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'דניאל (גברי)' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'רייצ\'ל (נשי)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'בלה (נשי)' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'אנטוני (גברי)' },
];

export default function CreativeStudioPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>('image');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imageUrl?: string; text?: string; audioUrl?: string } | null>(null);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(hebrewVoices[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Brand management
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [newBrand, setNewBrand] = useState<Partial<Brand>>({ name: '', tone: '', targetAudience: '', industry: '', colors: [] });

  useEffect(() => {
    setBrands(brandService.getAll());
  }, []);

  const activeBrand = brands.find(b => b.id === activeBrandId);

  const buildPrompt = (basePrompt: string) => {
    if (!activeBrand) return basePrompt;
    return `${basePrompt}\n\nהנחיות מותג: שם המותג: ${activeBrand.name}. טון דיבור: ${activeBrand.tone}. קהל יעד: ${activeBrand.targetAudience}. תחום: ${activeBrand.industry}. צבעים: ${activeBrand.colors.join(', ')}.`;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error('יש להזין תיאור'); return; }
    setLoading(true);
    setResult(null);
    try {
      if (activeTab === 'image') {
        const data = await imageService.generate(buildPrompt(prompt));
        setResult({ imageUrl: data.imageUrl, text: data.text });
        toast.success('התמונה נוצרה בהצלחה!');
      } else if (activeTab === 'edit') {
        if (!editImageUrl.trim()) { toast.error('יש להזין קישור לתמונה'); setLoading(false); return; }
        const data = await imageService.edit(buildPrompt(prompt), editImageUrl);
        setResult({ imageUrl: data.imageUrl, text: data.text });
        toast.success('התמונה נערכה בהצלחה!');
      } else if (activeTab === 'voice') {
        const audioUrl = await voiceService.generate(prompt, selectedVoice);
        setResult({ audioUrl });
        toast.success('הקול נוצר בהצלחה!');
      } else if (activeTab === 'video') {
        toast.info('יצירת סרטון – הפיצ\'ר בפיתוח. ניתן להוסיף ספק וידאו בהמשך.');
      }
    } catch (err: any) {
      toast.error(err.message || 'שגיאה ביצירה');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (result?.imageUrl) {
      const link = document.createElement('a');
      link.href = result.imageUrl;
      link.download = `creative-${activeBrand?.name || 'studio'}-${Date.now()}.png`;
      link.click();
    } else if (result?.audioUrl) {
      const link = document.createElement('a');
      link.href = result.audioUrl;
      link.download = `voice-${activeBrand?.name || 'studio'}-${Date.now()}.mp3`;
      link.click();
    }
    toast.success('ההורדה החלה');
  };

  const handleCopy = async () => {
    const url = result?.imageUrl || result?.audioUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('הקישור הועתק');
    } catch { toast.error('שגיאה בהעתקה'); }
  };

  const handleAddBrand = () => {
    if (!newBrand.name?.trim()) { toast.error('יש להזין שם מותג'); return; }
    const brand: Brand = {
      id: crypto.randomUUID(),
      name: newBrand.name!,
      tone: newBrand.tone || '',
      targetAudience: newBrand.targetAudience || '',
      industry: newBrand.industry || '',
      colors: newBrand.colors || [],
    };
    const updated = brandService.add(brand);
    setBrands(updated);
    setActiveBrandId(brand.id);
    setNewBrand({ name: '', tone: '', targetAudience: '', industry: '', colors: [] });
    setBrandDialogOpen(false);
    toast.success(`המותג "${brand.name}" נוסף בהצלחה`);
  };

  const handleRemoveBrand = (id: string) => {
    const updated = brandService.remove(id);
    setBrands(updated);
    if (activeBrandId === id) setActiveBrandId(null);
    toast.success('המותג הוסר');
  };

  const placeholders: Record<StudioTab, string> = {
    image: 'תאר את התמונה שאתה רוצה... למשל: "באנר שיווקי לחברת יבוא עם מוצרים על רקע מקצועי"',
    edit: 'תאר מה לשנות בתמונה... למשל: "הוסף לוגו בפינה, שנה רקע לצבע כחול מקצועי"',
    video: 'תאר את הסרטון... למשל: "סרטון תדמית 30 שניות לחברת שיווק דיגיטלי"',
    voice: 'הקלד את הטקסט שאתה רוצה להפוך לדיבור... למשל: "ברוכים הבאים לחברת ABC, המובילה בתחום היבוא"',
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
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-rubik font-bold flex items-center gap-2">
              <Wand2 className="w-7 h-7 text-primary" />
              סטודיו קריאייטיב AI
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              מרכז השליטה שלך – תמונות, סרטונים, קול ופרומפטים. הכל במקום אחד.
            </p>
          </div>
        </div>

        {/* Brand Selector */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              בחר מותג / עסק
            </h2>
            <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
              <DialogTrigger asChild>
                <button className="text-xs px-3 py-1.5 gradient-gold text-primary-foreground rounded-lg font-semibold flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> הוסף מותג
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="font-rubik">הוסף מותג חדש</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  {[
                    { key: 'name', label: 'שם המותג / העסק', placeholder: 'למשל: חברת ABC' },
                    { key: 'industry', label: 'תחום פעילות', placeholder: 'למשל: יבוא, שיווק, עמותה' },
                    { key: 'tone', label: 'טון דיבור', placeholder: 'למשל: מקצועי, חם, רשמי' },
                    { key: 'targetAudience', label: 'קהל יעד', placeholder: 'למשל: בעלי עסקים, צעירים 25-35' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
                      <input
                        value={(newBrand as any)[f.key] || ''}
                        onChange={e => setNewBrand(prev => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  ))}
                  <button onClick={handleAddBrand} className="w-full gradient-gold text-primary-foreground py-2.5 rounded-lg font-semibold text-sm">
                    שמור מותג
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveBrandId(null)}
              className={cn(
                'px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                !activeBrandId ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30'
              )}
            >
              כללי (ללא מותג)
            </button>
            {brands.map(b => (
              <div key={b.id} className="relative group">
                <button
                  onClick={() => setActiveBrandId(b.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                    activeBrandId === b.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30'
                  )}
                >
                  {b.name}
                </button>
                <button
                  onClick={() => handleRemoveBrand(b.id)}
                  className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
          {activeBrand && (
            <div className="mt-3 text-xs text-muted-foreground flex gap-4 flex-wrap">
              {activeBrand.industry && <span>📋 {activeBrand.industry}</span>}
              {activeBrand.tone && <span>🎯 {activeBrand.tone}</span>}
              {activeBrand.targetAudience && <span>👥 {activeBrand.targetAudience}</span>}
            </div>
          )}
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

          {activeTab === 'voice' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">בחר קול</label>
              <select
                value={selectedVoice}
                onChange={e => setSelectedVoice(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {hebrewVoices.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (() => { const Icon = tabs.find(t => t.id === activeTab)?.icon || ImageIcon; return <Icon className="w-4 h-4" />; })()}
              {loading ? 'מייצר...' : buttonLabels[activeTab]}
            </button>
            {result && (
              <button onClick={() => { setResult(null); setPrompt(''); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> התחל מחדש
              </button>
            )}
          </div>
        </div>

        {/* Image Result */}
        {result?.imageUrl && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-rubik font-semibold">התוצאה {activeBrand ? `– ${activeBrand.name}` : ''}</h2>
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
              <img src={result.imageUrl} alt="תוצאה שנוצרה" className="max-w-full max-h-[500px] object-contain" />
            </div>
            {result.text && <p className="text-sm text-muted-foreground">{result.text}</p>}
          </div>
        )}

        {/* Voice Result */}
        {result?.audioUrl && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-rubik font-semibold">הקול שנוצר {activeBrand ? `– ${activeBrand.name}` : ''}</h2>
              <div className="flex gap-2">
                <button onClick={handleDownload} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> הורד MP3
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
              <button
                onClick={handlePlayPause}
                className="w-12 h-12 gradient-gold text-primary-foreground rounded-full flex items-center justify-center shadow-lg"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 mr-[-2px]" />}
              </button>
              <div className="flex-1">
                <audio
                  ref={audioRef}
                  src={result.audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  controls
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
