import { AppLayout } from '@/components/layout/AppLayout';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ImageIcon, Film, Mic, Wand2, Loader2, Download, Copy, RefreshCw,
  Play, Pause, Plus, Trash2, Building2, UserCircle, FileText, ChevronDown, Check,
  Upload, Subtitles, Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { imageService, voiceService, didService, promptEnhanceService, subtitleService, brandService, type Brand, type SubtitleSegment } from '@/services/creativeService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type StudioTab = 'image' | 'edit' | 'avatar' | 'voice' | 'script' | 'subtitles';

const tabs: { id: StudioTab; label: string; icon: typeof ImageIcon; desc: string }[] = [
  { id: 'image', label: 'תמונה', icon: ImageIcon, desc: 'צור תמונות שיווקיות מטקסט' },
  { id: 'edit', label: 'עריכת תמונה', icon: Wand2, desc: 'ערוך תמונה קיימת עם AI' },
  { id: 'avatar', label: 'אווטאר מדבר', icon: UserCircle, desc: 'צור סרטון עם דמות מדברת (D-ID)' },
  { id: 'voice', label: 'דיבוב', icon: Mic, desc: 'המר טקסט לדיבור מקצועי בעברית' },
  { id: 'script', label: 'תסריט', icon: FileText, desc: 'כתוב וערוך תסריט שיווקי עם AI' },
  { id: 'subtitles', label: 'כתוביות', icon: Subtitles, desc: 'העלה סרטון וקבל כתוביות אוטומטיות בעברית' },
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
  const [result, setResult] = useState<{ imageUrl?: string; text?: string; audioUrl?: string; videoUrl?: string; talkId?: string } | null>(null);

  // Image edit
  const [editImageUrl, setEditImageUrl] = useState('');

  // Voice
  const [selectedVoice, setSelectedVoice] = useState(hebrewVoices[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Avatar (D-ID)
  const [avatarImageUrl, setAvatarImageUrl] = useState('');
  const [polling, setPolling] = useState(false);

  // Script
  const [scriptResult, setScriptResult] = useState<{ enhanced?: string; scenes?: any[]; hook?: string; cta?: string } | null>(null);

  // Subtitles
  const [subtitleSegments, setSubtitleSegments] = useState<SubtitleSegment[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Brand management
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [newBrand, setNewBrand] = useState<Partial<Brand>>({ name: '', tone: '', targetAudience: '', industry: '', colors: [], departments: [] });
  const [newDepartment, setNewDepartment] = useState('');

  useEffect(() => { setBrands(brandService.getAll()); }, []);

  const activeBrand = brands.find(b => b.id === activeBrandId);

  const buildPrompt = (basePrompt: string) => {
    if (!activeBrand) return basePrompt;
    return `${basePrompt}\n\nהנחיות מותג: ${activeBrand.name}. טון: ${activeBrand.tone}. קהל: ${activeBrand.targetAudience}. תחום: ${activeBrand.industry}.`;
  };

  // Poll D-ID status
  const pollTalkStatus = useCallback(async (talkId: string) => {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 60;

    const poll = async () => {
      try {
        const status = await didService.checkStatus(talkId);
        if (status.status === 'done' && status.resultUrl) {
          setResult(prev => ({ ...prev, videoUrl: status.resultUrl! }));
          setPolling(false);
          toast.success('הסרטון מוכן!');
          return;
        }
        if (status.status === 'error') {
          setPolling(false);
          toast.error('שגיאה ביצירת הסרטון');
          return;
        }
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setPolling(false);
          toast.error('תם הזמן – נסה שוב');
        }
      } catch {
        setPolling(false);
        toast.error('שגיאה בבדיקת סטטוס');
      }
    };
    poll();
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error('יש להזין תיאור'); return; }
    setLoading(true);
    setResult(null);
    setScriptResult(null);

    try {
      if (activeTab === 'image') {
        const data = await imageService.generate(buildPrompt(prompt));
        setResult({ imageUrl: data.imageUrl, text: data.text });
        toast.success('התמונה נוצרה!');
      } else if (activeTab === 'edit') {
        if (!editImageUrl.trim()) { toast.error('יש להזין קישור לתמונה'); setLoading(false); return; }
        const data = await imageService.edit(buildPrompt(prompt), editImageUrl);
        setResult({ imageUrl: data.imageUrl, text: data.text });
        toast.success('התמונה נערכה!');
      } else if (activeTab === 'avatar') {
        if (!avatarImageUrl.trim()) { toast.error('יש להזין קישור לתמונת הדמות'); setLoading(false); return; }
        const data = await didService.createTalk(avatarImageUrl, prompt, selectedVoice);
        setResult({ talkId: data.id });
        toast.success('הסרטון בהכנה...');
        pollTalkStatus(data.id);
      } else if (activeTab === 'voice') {
        const audioUrl = await voiceService.generate(prompt, selectedVoice);
        setResult({ audioUrl });
        toast.success('הקול נוצר!');
      } else if (activeTab === 'script') {
        const data = await promptEnhanceService.enhance(buildPrompt(prompt), 'script');
        setScriptResult(data);
        toast.success('התסריט מוכן!');
      }
    } catch (err: any) {
      toast.error(err.message || 'שגיאה ביצירה');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    const url = result?.imageUrl || result?.audioUrl || result?.videoUrl;
    if (!url) return;
    const ext = result?.videoUrl ? 'mp4' : result?.audioUrl ? 'mp3' : 'png';
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeBrand?.name || 'studio'}-${Date.now()}.${ext}`;
    link.click();
    toast.success('ההורדה החלה');
  };

  const handleCopy = async () => {
    const url = result?.imageUrl || result?.audioUrl || result?.videoUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('הקישור הועתק');
    } catch { toast.error('שגיאה בהעתקה'); }
  };

  const handleAddBrand = () => {
    if (!newBrand.name?.trim()) { toast.error('יש להזין שם'); return; }
    const brand: Brand = {
      id: crypto.randomUUID(),
      name: newBrand.name!,
      tone: newBrand.tone || '',
      targetAudience: newBrand.targetAudience || '',
      industry: newBrand.industry || '',
      colors: newBrand.colors || [],
      departments: newBrand.departments || [],
    };
    const updated = brandService.add(brand);
    setBrands(updated);
    setActiveBrandId(brand.id);
    setNewBrand({ name: '', tone: '', targetAudience: '', industry: '', colors: [], departments: [] });
    setBrandDialogOpen(false);
    toast.success(`"${brand.name}" נוסף`);
  };

  const handleAddDepartment = () => {
    if (!newDepartment.trim()) return;
    setNewBrand(prev => ({ ...prev, departments: [...(prev.departments || []), newDepartment] }));
    setNewDepartment('');
  };

  const handleRemoveBrand = (id: string) => {
    const updated = brandService.remove(id);
    setBrands(updated);
    if (activeBrandId === id) setActiveBrandId(null);
    toast.success('המותג הוסר');
  };

  const placeholders: Record<StudioTab, string> = {
    image: 'תאר את התמונה... למשל: "באנר לחברת יבוא עם מוצרים על רקע מקצועי"',
    edit: 'תאר מה לשנות... למשל: "שנה רקע לכחול, הוסף לוגו"',
    avatar: 'מה הדמות תגיד? למשל: "שלום, אני מציג לכם את המוצר החדש שלנו..."',
    voice: 'הקלד טקסט לדיבוב... למשל: "ברוכים הבאים למרכז הישראלי לחברות"',
    script: 'תאר את המוצר/שירות... למשל: "שירות הערכות שווי לעסקים קטנים ובינוניים"',
  };

  const buttonLabels: Record<StudioTab, string> = {
    image: 'צור תמונה',
    edit: 'ערוך תמונה',
    avatar: 'צור אווטאר מדבר',
    voice: 'צור דיבוב',
    script: 'צור תסריט',
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-rubik font-bold flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-primary" />
            סטודיו קריאייטיב
          </h1>
          <p className="text-muted-foreground text-sm mt-1">תמונות • אווטאר מדבר • דיבוב • תסריטים — הכל במקום אחד</p>
        </div>

        {/* Brand Selector */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> חברה / מותג
            </h2>
            <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
              <DialogTrigger asChild>
                <button className="text-xs px-3 py-1.5 gradient-gold text-primary-foreground rounded-lg font-semibold flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> הוסף חברה
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="font-rubik">הוסף חברה / מותג</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  {[
                    { key: 'name', label: 'שם החברה', placeholder: 'למשל: המרכז הישראלי לחברות' },
                    { key: 'industry', label: 'תחום', placeholder: 'למשל: יבוא, מכירת עסקים, עמותה' },
                    { key: 'tone', label: 'טון דיבור', placeholder: 'למשל: מקצועי, חם, רשמי' },
                    { key: 'targetAudience', label: 'קהל יעד', placeholder: 'למשל: בעלי עסקים, משקיעים' },
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
                  {/* Departments */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">מחלקות / תתי-חברות</label>
                    <div className="flex gap-2">
                      <input
                        value={newDepartment}
                        onChange={e => setNewDepartment(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddDepartment())}
                        placeholder="למשל: מכירת עסקים"
                        className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <button onClick={handleAddDepartment} className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">+</button>
                    </div>
                    {(newBrand.departments || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {newBrand.departments!.map((d, i) => (
                          <span key={i} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-md flex items-center gap-1">
                            {d}
                            <button onClick={() => setNewBrand(prev => ({ ...prev, departments: prev.departments?.filter((_, idx) => idx !== i) }))} className="hover:text-destructive">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={handleAddBrand} className="w-full gradient-gold text-primary-foreground py-2.5 rounded-lg font-semibold text-sm">
                    שמור חברה
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
              כללי
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
            <div className="mt-2 text-xs text-muted-foreground flex gap-3 flex-wrap">
              {activeBrand.industry && <span>📋 {activeBrand.industry}</span>}
              {activeBrand.tone && <span>🎯 {activeBrand.tone}</span>}
              {activeBrand.departments && activeBrand.departments.length > 0 && (
                <span>🏢 {activeBrand.departments.join(' • ')}</span>
              )}
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
                onClick={() => { setActiveTab(tab.id); setResult(null); setScriptResult(null); }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
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
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm text-muted-foreground">{tabs.find(t => t.id === activeTab)?.desc}</p>

          {activeTab === 'edit' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">קישור לתמונה מקורית</label>
              <input
                value={editImageUrl}
                onChange={e => setEditImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}

          {activeTab === 'avatar' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">קישור לתמונת הדמות (פנים)</label>
              <input
                value={avatarImageUrl}
                onChange={e => setAvatarImageUrl(e.target.value)}
                placeholder="https://example.com/face.jpg — תמונה חזיתית ברורה"
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}

          {(activeTab === 'voice' || activeTab === 'avatar') && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">בחר קול</label>
              <select
                value={selectedVoice}
                onChange={e => setSelectedVoice(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            rows={activeTab === 'script' ? 6 : 4}
            className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading || polling}
              className="gradient-gold text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (() => { const Icon = tabs.find(t => t.id === activeTab)?.icon || ImageIcon; return <Icon className="w-4 h-4" />; })()}
              {loading ? 'מייצר...' : buttonLabels[activeTab]}
            </button>
            {polling && (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> מעבד סרטון...
              </span>
            )}
            {(result || scriptResult) && (
              <button onClick={() => { setResult(null); setScriptResult(null); setPrompt(''); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> התחל מחדש
              </button>
            )}
          </div>
        </div>

        {/* Image Result */}
        {result?.imageUrl && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-rubik font-semibold">התוצאה {activeBrand ? `– ${activeBrand.name}` : ''}</h2>
              <div className="flex gap-2">
                <button onClick={handleDownload} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> הורד
                </button>
                <button onClick={handleCopy} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1">
                  <Copy className="w-3.5 h-3.5" /> העתק
                </button>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
              <img src={result.imageUrl} alt="תוצאה" className="max-w-full max-h-[500px] object-contain" />
            </div>
            {result.text && <p className="text-sm text-muted-foreground">{result.text}</p>}
          </div>
        )}

        {/* Video Result (D-ID) */}
        {result?.videoUrl && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-rubik font-semibold">🎬 הסרטון מוכן {activeBrand ? `– ${activeBrand.name}` : ''}</h2>
              <div className="flex gap-2">
                <button onClick={handleDownload} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> הורד MP4
                </button>
                <button onClick={handleCopy} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1">
                  <Copy className="w-3.5 h-3.5" /> העתק קישור
                </button>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
              <video src={result.videoUrl} controls className="w-full max-h-[500px]" />
            </div>
          </div>
        )}

        {/* Voice Result */}
        {result?.audioUrl && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-rubik font-semibold">🎙️ הקול מוכן {activeBrand ? `– ${activeBrand.name}` : ''}</h2>
              <button onClick={handleDownload} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> הורד MP3
              </button>
            </div>
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
              <button onClick={handlePlayPause} className="w-12 h-12 gradient-gold text-primary-foreground rounded-full flex items-center justify-center shadow-lg">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 mr-[-2px]" />}
              </button>
              <div className="flex-1">
                <audio ref={audioRef} src={result.audioUrl} onEnded={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} controls className="w-full" />
              </div>
            </div>
          </div>
        )}

        {/* Script Result */}
        {scriptResult && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-rubik font-semibold">📝 התסריט {activeBrand ? `– ${activeBrand.name}` : ''}</h2>
              <button
                onClick={async () => {
                  const text = scriptResult.enhanced || JSON.stringify(scriptResult, null, 2);
                  await navigator.clipboard.writeText(text);
                  toast.success('התסריט הועתק');
                }}
                className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> העתק
              </button>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 border border-border whitespace-pre-wrap text-sm leading-relaxed" dir="rtl">
              {scriptResult.enhanced || JSON.stringify(scriptResult, null, 2)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPrompt(scriptResult.enhanced || '');
                  setActiveTab('voice');
                  setScriptResult(null);
                  toast.info('התסריט הועבר לדיבוב – לחץ "צור דיבוב"');
                }}
                className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-2"
              >
                <Mic className="w-4 h-4" /> העבר לדיבוב
              </button>
              <button
                onClick={() => {
                  setPrompt(scriptResult.enhanced || '');
                  setActiveTab('avatar');
                  setScriptResult(null);
                  toast.info('התסריט הועבר לאווטאר – הוסף תמונה ולחץ "צור"');
                }}
                className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-2"
              >
                <UserCircle className="w-4 h-4" /> העבר לאווטאר מדבר
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
