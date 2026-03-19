import { useState, useCallback } from 'react';
import {
  Loader2, Download, Save, ChevronLeft, ChevronRight, Plus, X,
  Wand2, Edit3, ImageIcon, RefreshCw, Layers, GripVertical, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { imageService, storageService, type Brand, brandService } from '@/services/creativeService';
import { projectService } from '@/services/projectService';
import { CostApprovalDialog, type CostEstimate } from '@/components/studio/CostApprovalDialog';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';

interface CarouselSlide {
  title: string;
  body: string;
  imageUrl?: string;
  refinePrompt?: string;
}

interface CarouselGeneratorProps {
  prompt: string;
  buildPrompt: (base: string) => string;
  activeBrand?: Brand;
  activeBrandId?: string | null;
  brandColors?: string[];
  logoUrl?: string;
  referenceImages?: string[];
  websiteContent?: {
    headline?: string;
    subheadline?: string;
    bullets?: string[];
    cta?: string;
    keywords?: string[];
  } | null;
  onBack: () => void;
}

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 (ריבוע)', w: 1024, h: 1024 },
  { id: '4:5', label: '4:5 (אינסטגרם)', w: 1024, h: 1280 },
  { id: '9:16', label: '9:16 (סטורי)', w: 720, h: 1280 },
];

export function CarouselGenerator({
  prompt, buildPrompt, activeBrand, activeBrandId,
  brandColors, logoUrl, referenceImages, websiteContent, onBack,
}: CarouselGeneratorProps) {
  const [slideCount, setSlideCount] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedSlides, setGeneratedSlides] = useState<CarouselSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showCostApproval, setShowCostApproval] = useState(false);
  const [storyInput, setStoryInput] = useState('');
  const [splitting, setSplitting] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [refiningIndex, setRefiningIndex] = useState<number | null>(null);
  const [savingOutput, setSavingOutput] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number; failed: number[] }>({ done: 0, total: 0, failed: [] });
  const [savedProjectName, setSavedProjectName] = useState<string | null>(null);
  const [showSlideNumbers, setShowSlideNumbers] = useState(true);

  // Step: 'setup' | 'slides' | 'generating' | 'result'
  const [step, setStep] = useState<'setup' | 'slides' | 'generating' | 'result'>('setup');

  const buildFromWebsite = () => {
    if (!websiteContent) return;
    const { headline, subheadline, bullets, cta } = websiteContent;
    const autoSlides: CarouselSlide[] = [];

    // Problem
    if (headline) autoSlides.push({ title: 'הבעיה', body: headline });
    // Solution
    if (subheadline) autoSlides.push({ title: 'הפתרון', body: subheadline });
    // Benefits (split into 2-3 slides)
    if (bullets && bullets.length > 0) {
      const mid = Math.ceil(bullets.length / 2);
      autoSlides.push({ title: 'יתרונות (חלק 1)', body: bullets.slice(0, mid).map(b => `• ${b}`).join('\n') });
      if (bullets.length > mid) {
        autoSlides.push({ title: 'יתרונות (חלק 2)', body: bullets.slice(mid).map(b => `• ${b}`).join('\n') });
      }
    }
    // How it works
    autoSlides.push({ title: 'איך זה עובד?', body: 'תהליך פשוט ומהיר בכמה צעדים' });
    // CTA
    if (cta) autoSlides.push({ title: 'התחילו עכשיו', body: cta });

    setSlides(autoSlides.slice(0, 10));
    setSlideCount(autoSlides.length);
    setStep('slides');
    toast.success(`${autoSlides.length} שקופיות נוצרו מתוכן האתר!`);
  };

  const splitToSlides = async () => {
    if (!storyInput.trim() && !prompt.trim()) {
      toast.error('יש להזין טקסט לחלוקה');
      return;
    }
    setSplitting(true);
    try {
      const text = storyInput.trim() || prompt.trim();
      // Simple split: by numbered items or paragraphs
      const lines = text.split(/\n+/).filter(l => l.trim());
      const newSlides: CarouselSlide[] = [];

      if (lines.length >= slideCount) {
        // Use first N lines
        for (let i = 0; i < Math.min(slideCount, lines.length); i++) {
          const line = lines[i].replace(/^\d+[\.\)]\s*/, '');
          newSlides.push({ title: `שלב ${i + 1}`, body: line });
        }
      } else {
        // Split evenly
        const chunkSize = Math.ceil(text.length / slideCount);
        for (let i = 0; i < slideCount; i++) {
          const chunk = text.slice(i * chunkSize, (i + 1) * chunkSize).trim();
          if (chunk) newSlides.push({ title: `שלב ${i + 1}`, body: chunk });
        }
      }

      setSlides(newSlides.length > 0 ? newSlides : [{ title: 'שלב 1', body: text }]);
      setStep('slides');
    } finally {
      setSplitting(false);
    }
  };

  const addSlide = () => {
    if (slides.length >= 10) { toast.error('מקסימום 10 שקופיות'); return; }
    setSlides(prev => [...prev, { title: `שלב ${prev.length + 1}`, body: '' }]);
  };

  const removeSlide = (i: number) => {
    setSlides(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateSlide = (i: number, field: 'title' | 'body', val: string) => {
    setSlides(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  const moveSlide = (from: number, to: number) => {
    setSlides(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  const requestGenerate = () => {
    if (slides.length < 2) { toast.error('צריך לפחות 2 שקופיות'); return; }
    setShowCostApproval(true);
  };

  const handleGenerate = async () => {
    setShowCostApproval(false);
    setStep('generating');
    setGenerating(true);
    const results: CarouselSlide[] = [];

    const brandContext = activeBrand
      ? `\nBrand: ${activeBrand.name}. Industry: ${activeBrand.industry || 'general'}. Tone: ${activeBrand.tone || 'professional'}.`
      : '';
    const colorContext = brandColors?.length
      ? `\nBrand colors: ${brandColors.join(', ')}. Use these colors consistently.`
      : '';
    const logoContext = logoUrl ? `\nBrand logo is provided as a reference image — include it subtly.` : '';
    const styleConsistency = `\nCRITICAL: This is slide ${'{INDEX}'} of ${slides.length} in a carousel set. ALL slides MUST share the same visual style, color palette, font style, and layout structure. Only the content text changes per slide.`;
    const slideNumberText = showSlideNumbers ? `\nAdd "${'{INDEX}'}/${slides.length}" as a small page number in the corner.` : '';

    try {
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const slidePrompt = `Create a marketing image for a carousel/sequence post.
${styleConsistency.replace(/\{INDEX\}/g, String(i + 1))}
${slideNumberText.replace(/\{INDEX\}/g, String(i + 1))}
${brandContext}${colorContext}${logoContext}

Slide content:
Title: ${slide.title}
Body: ${slide.body}

Overall theme: ${prompt}

The text on the image should be in Hebrew. Make it visually engaging and professional.`;

        const refs = [
          ...(logoUrl ? [logoUrl] : []),
          ...(referenceImages || []),
          // Use previous slide as reference for style consistency
          ...(results.length > 0 && results[results.length - 1].imageUrl ? [results[results.length - 1].imageUrl!] : []),
        ].slice(0, 5);

        const data = await imageService.generate(buildPrompt(slidePrompt), refs.length > 0 ? refs : undefined);
        results.push({ ...slide, imageUrl: data.imageUrl });
        // Update progress
        setGeneratedSlides([...results]);
      }

      setGeneratedSlides(results);
      setCurrentSlide(0);
      setStep('result');
      toast.success(`${results.length} תמונות נוצרו בהצלחה!`);
    } catch (e: any) {
      toast.error(e.message || 'שגיאה ביצירת הסט');
      if (results.length > 0) {
        setGeneratedSlides(results);
        setStep('result');
      } else {
        setStep('slides');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleRefineSlide = async (index: number) => {
    if (!refinePrompt.trim()) { toast.error('יש לתאר מה לשנות'); return; }
    const slide = generatedSlides[index];
    if (!slide?.imageUrl) return;

    setRefiningIndex(index);
    try {
      const refs = [
        ...(logoUrl ? [logoUrl] : []),
        // Include adjacent slides for style consistency
        ...(index > 0 && generatedSlides[index - 1]?.imageUrl ? [generatedSlides[index - 1].imageUrl!] : []),
        ...(index < generatedSlides.length - 1 && generatedSlides[index + 1]?.imageUrl ? [generatedSlides[index + 1].imageUrl!] : []),
      ].slice(0, 3);

      const data = await imageService.edit(
        buildPrompt(`${refinePrompt}\n\nIMPORTANT: Keep the same visual style, colors, and layout as the rest of the carousel set.`),
        slide.imageUrl,
        refs.length > 0 ? refs : undefined,
      );

      setGeneratedSlides(prev => prev.map((s, i) => i === index ? { ...s, imageUrl: data.imageUrl, refinePrompt } : s));
      setRefinePrompt('');
      toast.success(`שקופית ${index + 1} עודכנה!`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRefiningIndex(null);
    }
  };

  const handleDownloadAll = async () => {
    const images = generatedSlides.filter(s => s.imageUrl);
    if (images.length === 0) return;

    toast.info('מכין ZIP...');
    try {
      const zip = new JSZip();
      for (let i = 0; i < images.length; i++) {
        const url = images[i].imageUrl!;
        const res = await fetch(url);
        const blob = await res.blob();
        const ext = url.includes('png') ? 'png' : 'jpg';
        zip.file(`slide-${i + 1}.${ext}`, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const blobUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `carousel-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success('הZIP הורד בהצלחה!');
    } catch {
      toast.error('שגיאה ביצירת ZIP');
    }
  };

  const handleDownloadSingle = async (index: number) => {
    const url = generatedSlides[index]?.imageUrl;
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `slide-${index + 1}.${url.includes('png') ? 'png' : 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleSaveAll = async (retryIndices?: number[]) => {
    const brandObj = activeBrand;
    const brandId = activeBrandId;
    if (!brandId || !brandObj) {
      toast.error('יש לבחור חברה / מותג לפני השמירה');
      return;
    }

    const indicesToSave = retryIndices || generatedSlides.map((_, i) => i).filter(i => generatedSlides[i].imageUrl);
    setSavingOutput(true);
    setSaveProgress({ done: 0, total: indicesToSave.length, failed: [] });
    setSavedProjectName(null);

    try {
      // Phase A: create project row quickly
      const project = await projectService.findOrCreateByBrand(brandId, brandObj.name);
      setSavedProjectName(project.name);
      toast.success(`פרויקט "${project.name}" מוכן — שומר תמונות ברקע...`);

      // Phase B: upload & insert in parallel (concurrency limit 3)
      const failed: number[] = [];
      let doneCount = 0;

      const uploadAndInsert = async (i: number) => {
        const slide = generatedSlides[i];
        try {
          let finalUrl = slide.imageUrl!;
          if (finalUrl.startsWith('data:')) {
            const blob = await fetch(finalUrl).then(r => r.blob());
            const file = new File([blob], `carousel-${i + 1}-${Date.now()}.png`, { type: blob.type });
            finalUrl = await storageService.upload(file);
          }
          await projectService.addOutput(project.id, {
            name: `קרוסלה ${i + 1}/${generatedSlides.length} — ${brandObj.name}`,
            description: `${slide.title}: ${slide.body}`,
            thumbnail_url: finalUrl,
            prompt: prompt || null,
            script: null,
            video_url: null,
            provider: null,
          });
        } catch {
          failed.push(i);
        } finally {
          doneCount++;
          setSaveProgress(prev => ({ ...prev, done: doneCount, failed: [...failed] }));
        }
      };

      // Run with concurrency limit of 3
      const queue = [...indicesToSave];
      const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
        while (queue.length > 0) {
          const idx = queue.shift()!;
          await uploadAndInsert(idx);
        }
      });
      await Promise.all(workers);

      if (failed.length > 0) {
        toast.error(`${failed.length} תמונות נכשלו בשמירה — ניתן לנסות שוב`);
      } else {
        toast.success(`${indicesToSave.length} תמונות נשמרו בהצלחה!`);
      }
      setSaveProgress(prev => ({ ...prev, failed }));
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בשמירה');
    } finally {
      setSavingOutput(false);
    }
  };

  const costEstimates: CostEstimate[] = [
    { provider: 'Lovable AI', action: `יצירת ${slides.length} תמונות`, estimatedCost: `~$${(slides.length * 0.03).toFixed(2)}`, details: [`${slides.length} שקופיות × Gemini Image`] },
  ];

  // ====== SETUP STEP ======
  if (step === 'setup') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">כמות:</label>
            <select
              value={slideCount}
              onChange={e => setSlideCount(Number(e.target.value))}
              className="bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-sm"
            >
              {Array.from({ length: 9 }, (_, i) => i + 2).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">פורמט:</label>
            <select
              value={aspectRatio}
              onChange={e => setAspectRatio(e.target.value)}
              className="bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-sm"
            >
              {ASPECT_RATIOS.map(ar => (
                <option key={ar.id} value={ar.id}>{ar.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Story/steps input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">שלבים / סיפור</label>
            <VoiceDictationButton onResult={(text) => setStoryInput(prev => prev ? prev + ' ' + text : text)} />
          </div>
          <textarea
            value={storyInput}
            onChange={e => setStoryInput(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder={'הדבק רשימה ממוספרת:\n1. הבעיה\n2. הפתרון\n3. יתרונות\n...\n\nאו כתוב פסקה אחת והמערכת תחלק אוטומטית'}
            rows={4}
            dir="rtl"
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <button
          onClick={splitToSlides}
          disabled={splitting}
          className="w-full border border-border rounded-lg px-4 py-2.5 text-sm hover:bg-muted flex items-center justify-center gap-2"
        >
          {splitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
          חלק לשלבים אוטומטית
        </button>

        {websiteContent && (
          <button
            onClick={buildFromWebsite}
            className="w-full gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Globe className="w-4 h-4" /> בנה סט מהאתר
          </button>
        )}
      </div>
    );
  }

  // ====== SLIDES EDITOR ======
  if (step === 'slides') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{slides.length} שקופיות</p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showSlideNumbers} onChange={e => setShowSlideNumbers(e.target.checked)} className="accent-primary" />
              מספור שקופיות
            </label>
            <button onClick={addSlide} disabled={slides.length >= 10}
              className="text-xs px-2 py-1 border border-border rounded-lg hover:bg-muted flex items-center gap-1 disabled:opacity-50">
              <Plus className="w-3 h-3" /> הוסף
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {slides.map((slide, i) => (
            <div key={i} className="border border-border rounded-lg p-2.5 space-y-1.5 bg-card">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                <input
                  value={slide.title}
                  onChange={e => updateSlide(i, 'title', e.target.value)}
                  dir="rtl"
                  className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
                  placeholder="כותרת שקופית..."
                />
                <div className="flex gap-0.5">
                  {i > 0 && (
                    <button onClick={() => moveSlide(i, i - 1)} className="p-1 hover:bg-muted rounded text-muted-foreground">
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                  {i < slides.length - 1 && (
                    <button onClick={() => moveSlide(i, i + 1)} className="p-1 hover:bg-muted rounded text-muted-foreground">
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                  )}
                  <button onClick={() => removeSlide(i)} className="p-1 hover:bg-destructive/10 rounded text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <textarea
                value={slide.body}
                onChange={e => updateSlide(i, 'body', e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                dir="rtl"
                rows={2}
                className="w-full bg-muted/30 rounded px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder="תוכן השקופית..."
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setStep('setup')}
            className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
            <ChevronRight className="w-4 h-4" /> חזור
          </button>
          <button onClick={requestGenerate}
            className="flex-1 gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
            💰 צור סט ({slides.length} תמונות)
          </button>
        </div>

        <CostApprovalDialog
          open={showCostApproval}
          onOpenChange={setShowCostApproval}
          estimates={costEstimates}
          onApprove={handleGenerate}
          title="אישור יצירת סט תמונות בתשלום"
        />
      </div>
    );
  }

  // ====== GENERATING ======
  if (step === 'generating') {
    return (
      <div className="space-y-6 py-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Layers className="w-8 h-8 text-primary animate-pulse" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">מייצר שקופית {generatedSlides.length + 1} מתוך {slides.length}...</p>
          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden max-w-xs mx-auto">
            <div className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${(generatedSlides.length / slides.length) * 100}%` }} />
          </div>
        </div>
        {generatedSlides.length > 0 && (
          <div className="flex gap-2 justify-center overflow-x-auto pb-2">
            {generatedSlides.map((s, i) => s.imageUrl && (
              <div key={i} className="w-14 h-14 rounded-lg overflow-hidden border border-primary/30 flex-shrink-0">
                <img src={s.imageUrl} alt={`slide ${i+1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ====== RESULT ======
  if (step === 'result') {
    const current = generatedSlides[currentSlide];
    return (
      <div className="space-y-4">
        {/* Gallery navigation */}
        <div className="flex items-center gap-2 justify-center">
          <button onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold">{currentSlide + 1} / {generatedSlides.length}</span>
          <button onClick={() => setCurrentSlide(Math.min(generatedSlides.length - 1, currentSlide + 1))}
            disabled={currentSlide >= generatedSlides.length - 1}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Main image */}
        {current?.imageUrl && (
          <div className="rounded-lg overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
            <img src={current.imageUrl} alt={`שקופית ${currentSlide + 1}`} className="max-w-full max-h-[250px] object-contain" />
          </div>
        )}

        {/* Thumbnail strip */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 justify-center">
          {generatedSlides.map((s, i) => (
            <button key={i} onClick={() => setCurrentSlide(i)}
              className={cn('w-12 h-12 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all',
                i === currentSlide ? 'border-primary shadow-gold' : 'border-border/50 opacity-60 hover:opacity-100')}>
              {s.imageUrl ? (
                <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-[10px]">{i + 1}</div>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={() => handleDownloadSingle(currentSlide)}
            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-1.5">
            <Download className="w-4 h-4" /> הורד תמונה
          </button>
          <button onClick={handleDownloadAll}
            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-1.5">
            <Download className="w-4 h-4" /> הורד הכל (ZIP)
          </button>
        </div>

        {activeBrand && (
          <div className="space-y-1.5">
            <button onClick={() => handleSaveAll()} disabled={savingOutput}
              className="w-full gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {savingOutput ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingOutput
                ? `שומר ${saveProgress.done}/${saveProgress.total}...`
                : savedProjectName
                  ? `✓ נשמר בפרויקט "${savedProjectName}"`
                  : `שמור ${generatedSlides.length} תמונות בפרויקט`}
            </button>
            {savingOutput && saveProgress.total > 0 && (
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(saveProgress.done / saveProgress.total) * 100}%` }} />
              </div>
            )}
            {!savingOutput && saveProgress.failed.length > 0 && (
              <button onClick={() => handleSaveAll(saveProgress.failed)}
                className="w-full text-xs text-destructive hover:underline py-1">
                {saveProgress.failed.length} תמונות נכשלו — לחץ לניסיון חוזר
              </button>
            )}
          </div>
        )}

        {/* Per-slide refine */}
        <div className="bg-muted/30 rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" /> שפר שקופית #{currentSlide + 1}
            </p>
            <VoiceDictationButton onResult={(text) => setRefinePrompt(prev => prev ? prev + ' ' + text : text)} />
          </div>
          <textarea
            value={refinePrompt}
            onChange={e => setRefinePrompt(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder='למשל: "שנה את הרקע", "הגדל את הטקסט"'
            rows={2}
            dir="rtl"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={() => handleRefineSlide(currentSlide)}
            disabled={refiningIndex !== null || !refinePrompt.trim()}
            className="w-full gradient-gold text-primary-foreground px-4 py-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {refiningIndex === currentSlide ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            {refiningIndex === currentSlide ? 'משפר...' : 'עדכן שקופית'}
          </button>
        </div>

        <button onClick={() => { setStep('setup'); setGeneratedSlides([]); setSlides([]); }}
          className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-2">
          <RefreshCw className="w-3.5 h-3.5" /> התחל מחדש
        </button>
      </div>
    );
  }

  return null;
}

// Needed for globe icon reference
function Globe(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
    </svg>
  );
}
