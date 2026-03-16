import { useState } from 'react';
import {
  ArrowRight, Loader2, Download, Play, Mic, MicOff,
  Save, Wand2, UserCircle, ChevronDown, ChevronUp,
  ImageIcon, Video, Volume2, Check, X, Edit3, RefreshCw,
  FileText, Sparkles, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSpeechToText } from '@/hooks/use-speech-to-text';
import {
  runwayService, didService, storageService,
  type Brand,
} from '@/services/creativeService';
import { projectService } from '@/services/projectService';
import { supabase } from '@/integrations/supabase/client';
import { FileUploadZone } from '@/components/FileUploadZone';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';

interface SavedAvatar { id: string; name: string; image_url: string; style: string; }
interface SavedVoice { id: string; name: string; audio_url: string; type: string; }

interface ScriptScene {
  id: number;
  title: string;
  speaker: string;
  spokenText: string;
  visualDescription: string;
  subtitleText: string;
  icons: string[];
  duration: number;
  transition: string;
}

interface GeneratedScript {
  title: string;
  duration: number;
  script: string;
  scenes: ScriptScene[];
  style: { tone?: string; pace?: string; music?: string };
}

interface VideoWizardFlowProps {
  avatars: SavedAvatar[];
  voices: SavedVoice[];
  activeBrand: Brand | undefined;
  activeBrandId: string | null;
  buildPrompt: (base: string) => string;
  initialCategory: string;
  brandDepartments: string[];
  onBack: () => void;
  onClose: () => void;
}

export function VideoWizardFlow({
  avatars, voices, activeBrand, activeBrandId,
  buildPrompt, initialCategory, brandDepartments,
  onBack, onClose,
}: VideoWizardFlowProps) {
  // Step: 0=prompt, 1=script review, 2=media+settings, 3=generating, 4=result
  const [step, setStep] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  // Multi-select avatars & voices
  const [selectedAvatarIds, setSelectedAvatarIds] = useState<string[]>([]);
  const [selectedVoiceIds, setSelectedVoiceIds] = useState<string[]>([]);
  const [useAiVoice, setUseAiVoice] = useState(false);

  // Script
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [editingSceneIdx, setEditingSceneIdx] = useState<number | null>(null);

  // Media
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const MAX_IMAGES = 7;

  // Result
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [runwayPolling, setRunwayPolling] = useState(false);
  const [runwayProgress, setRunwayProgress] = useState(0);

  // Save
  const [savingOutput, setSavingOutput] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || '');
  const [customCategory, setCustomCategory] = useState('');
  const effectiveCategory = customCategory.trim() || selectedCategory;

  // Speech
  const { isListening, isSupported: speechSupported, toggle: toggleSpeech } = useSpeechToText({
    language: 'he-IL',
    onResult: (text) => setPrompt(prev => prev ? `${prev} ${text}` : text),
  });

  const selectedAvatars = avatars.filter(a => selectedAvatarIds.includes(a.id));
  const selectedVoices = voices.filter(v => selectedVoiceIds.includes(v.id));

  const toggleAvatar = (id: string) => {
    setSelectedAvatarIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleVoice = (id: string) => {
    setSelectedVoiceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ===== Step 0: Prompt + Avatar/Voice selection =====
  const handleGenerateScript = async () => {
    if (!prompt.trim()) { toast.error('יש להזין תיאור לסרטון'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: {
          prompt: buildPrompt(prompt),
          avatarNames: selectedAvatars.map(a => a.name),
          voiceNames: selectedVoices.map(v => v.name),
          brandContext: activeBrand ? `${activeBrand.name} — ${activeBrand.industry || ''} — טון: ${activeBrand.tone || ''}` : undefined,
          hasImages: uploadedImages.length > 0,
        },
      });
      if (error) throw new Error(error.message || 'שגיאה ביצירת תסריט');
      if (data?.error) throw new Error(data.error);
      setGeneratedScript(data);
      setStep(1);
      toast.success('התסריט נוצר!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ===== Polling helper =====
  const pollDidStatus = (talkId: string) => {
    setRunwayPolling(true);
    setRunwayProgress(0);
    let attempts = 0;
    const poll = async () => {
      try {
        const status = await didService.checkStatus(talkId);
        if (status.status === 'done' && status.resultUrl) {
          setResultVideoUrl(status.resultUrl);
          setRunwayPolling(false);
          setStep(4);
          toast.success('הסרטון מוכן!');
          return;
        }
        if (status.status === 'error') {
          setRunwayPolling(false);
          setStep(2);
          toast.error('שגיאה ביצירת הסרטון. נסה שוב.');
          return;
        }
        attempts++;
        setRunwayProgress(Math.min(95, attempts * 5));
        if (attempts < 60) setTimeout(poll, 5000);
        else { setRunwayPolling(false); setStep(2); toast.error('תם הזמן'); }
      } catch { setRunwayPolling(false); setStep(2); toast.error('שגיאה בבדיקת סטטוס'); }
    };
    poll();
  };

  const pollRunwayStatus = (taskId: string) => {
    setRunwayPolling(true);
    setRunwayProgress(0);
    let attempts = 0;
    const poll = async () => {
      try {
        const status = await runwayService.checkStatus(taskId);
        setRunwayProgress(status.progress * 100);
        if (status.status === 'SUCCEEDED' && status.resultUrl) {
          setResultVideoUrl(status.resultUrl);
          setRunwayPolling(false);
          setStep(4);
          toast.success('הסרטון מוכן!');
          return;
        }
        if (status.status === 'FAILED') {
          setRunwayPolling(false);
          setStep(2);
          toast.error(status.failureReason || 'שגיאה');
          return;
        }
        attempts++;
        if (attempts < 120) setTimeout(poll, 5000);
        else { setRunwayPolling(false); setStep(2); toast.error('תם הזמן'); }
      } catch { setRunwayPolling(false); setStep(2); toast.error('שגיאה'); }
    };
    poll();
  };

  // ===== Step 3: Generate video =====
  const handleGenerateVideo = async () => {
    if (!generatedScript) return;
    setLoading(true);
    setStep(3);

    try {
      const avatarImage = selectedAvatars[0]?.image_url;
      // D-ID has a text limit — use only the first scene or max ~500 chars
      const fullScript = generatedScript.scenes.map(s => s.spokenText).join(' ');
      const trimmedScript = fullScript.length > 500 ? fullScript.slice(0, 497) + '...' : fullScript;

      if (avatarImage) {
        // Try D-ID for talking avatar
        const selectedVoice = selectedVoices[0];
        const voiceId = selectedVoice?.type === 'elevenlabs' ? selectedVoice.id : undefined;

        try {
          const talkResult = await didService.createTalk(avatarImage, trimmedScript, voiceId);
          
          // Check if D-ID returned an error in the response
          if (!talkResult.id) {
            throw new Error('D-ID לא החזיר מזהה תקין');
          }
          
          toast.success('הסרטון בהכנה (D-ID)...');
          pollDidStatus(talkResult.id);
        } catch (didErr: any) {
          // D-ID failed — fallback to RunwayML with avatar image
          console.warn('D-ID failed, falling back to RunwayML:', didErr.message);
          toast.info('D-ID לא זמין, עובר ל-RunwayML...');

          try {
            const promptText = generatedScript.scenes
              .map(s => `${s.visualDescription}. ${s.subtitleText}`)
              .join('. ');
            const taskData = await runwayService.imageToVideo(
              avatarImage,
              buildPrompt(promptText)
            );
            toast.success('הסרטון בהכנה (RunwayML)...');
            pollRunwayStatus(taskData.taskId);
          } catch (runwayErr: any) {
            toast.error(runwayErr.message || 'שגיאה ביצירת סרטון');
            setStep(2);
          }
        }
      } else {
        // No avatar — text-to-video via RunwayML
        const promptText = generatedScript.scenes
          .map(s => `${s.visualDescription}. ${s.subtitleText}`)
          .join('. ');

        const taskData = await runwayService.textToVideo(buildPrompt(promptText));
        toast.success('הסרטון בהכנה...');
        pollRunwayStatus(taskData.taskId);
      }
    } catch (e: any) {
      toast.error(e.message || 'שגיאה ביצירת סרטון');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activeBrandId || !activeBrand || !resultVideoUrl) return;
    setSavingOutput(true);
    try {
      const cat = effectiveCategory || undefined;
      const project = await projectService.findOrCreateByBrand(activeBrandId, activeBrand.name, cat);
      await projectService.addOutput(project.id, {
        name: `סרטון — ${activeBrand.name}${cat ? ` — ${cat}` : ''}`,
        description: generatedScript?.title || prompt,
        video_url: resultVideoUrl,
        thumbnail_url: selectedAvatars[0]?.image_url || null,
        prompt: prompt || null,
        script: generatedScript?.script || null,
      });
      toast.success(`נשמר בפרויקט "${activeBrand.name}${cat ? ` — ${cat}` : ''}"!`);
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בשמירה');
    } finally {
      setSavingOutput(false);
    }
  };

  const handleDownload = async () => {
    if (!resultVideoUrl) return;
    try {
      const res = await fetch(resultVideoUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${activeBrand?.name || 'video'}-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success('ההורדה החלה');
    } catch { if (resultVideoUrl) window.open(resultVideoUrl, '_blank'); }
  };

  const updateSceneText = (idx: number, field: keyof ScriptScene, value: string) => {
    if (!generatedScript) return;
    setGeneratedScript({
      ...generatedScript,
      scenes: generatedScript.scenes.map((s, i) =>
        i === idx ? { ...s, [field]: value } : s
      ),
    });
  };

  const stepTitles = [
    { title: 'תאר את הסרטון', desc: 'ספר מה צריך לקרות בסרטון, בחר אווטארים וקולות' },
    { title: 'אשר את התסריט', desc: 'בדוק ועדכן את התסריט שנוצר' },
    { title: 'הגדרות סופיות', desc: 'הוסף תמונות ולוגו, ובדוק הכל לפני ייצור' },
    { title: 'מייצר סרטון...', desc: 'אנא המתן, הסרטון בהכנה' },
    { title: 'הסרטון מוכן!', desc: 'צפה, הורד או שמור' },
  ];

  const totalSteps = 5;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={cn(
            'h-1.5 rounded-full flex-1 transition-all',
            i <= step ? 'bg-primary' : 'bg-muted'
          )} />
        ))}
      </div>
      <div className="text-right">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" />
          {stepTitles[step].title}
        </h3>
        <p className="text-xs text-muted-foreground">{stepTitles[step].desc}</p>
      </div>

      {/* ===== STEP 0: Prompt + selection ===== */}
      {step === 0 && (
        <div className="space-y-4">
          {/* Prompt */}
          <div className="relative">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              placeholder='ספר מה צריך לקרות בסרטון... למשל: "סרטון תדמית לחברה שמציג את השירותים שלנו עם הוק תופס בהתחלה"'
              rows={4}
              dir="rtl"
              className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 pl-12 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {speechSupported && (
              <button type="button" onClick={toggleSpeech}
                className={cn('absolute left-3 top-3 p-1.5 rounded-lg transition-all',
                  isListening ? 'bg-destructive/10 text-destructive animate-pulse' : 'bg-muted/50 text-muted-foreground hover:text-foreground')}>
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Avatars multi-select */}
          {avatars.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <UserCircle className="w-3.5 h-3.5" /> בחר אווטארים (ניתן לבחור כמה)
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {avatars.map(avatar => {
                  const selected = selectedAvatarIds.includes(avatar.id);
                  return (
                    <button key={avatar.id} onClick={() => toggleAvatar(avatar.id)}
                      className={cn('flex-shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden transition-all relative',
                        selected ? 'border-primary shadow-gold' : 'border-border hover:border-primary/30')}>
                      <img src={avatar.image_url} alt={avatar.name} className="w-full h-full object-cover" />
                      {selected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="w-5 h-5 text-primary drop-shadow" />
                        </div>
                      )}
                      <p className="absolute bottom-0 inset-x-0 text-[8px] text-center bg-background/80 py-0.5 truncate px-1">{avatar.name}</p>
                    </button>
                  );
                })}
              </div>
              {selectedAvatars.length > 0 && (
                <p className="text-xs text-primary">
                  נבחרו: {selectedAvatars.map(a => a.name).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Voices multi-select */}
          {voices.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" /> בחר קולות (ניתן לבחור כמה)
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setUseAiVoice(!useAiVoice)}
                  className={cn('px-3 py-1.5 rounded-lg border text-xs transition-all flex items-center gap-1.5',
                    useAiVoice ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30 text-muted-foreground')}>
                  <Sparkles className="w-3 h-3" /> קול AI אוטומטי
                </button>
                {voices.map(voice => {
                  const selected = selectedVoiceIds.includes(voice.id);
                  return (
                    <button key={voice.id} onClick={() => toggleVoice(voice.id)}
                      className={cn('px-3 py-1.5 rounded-lg border text-xs transition-all flex items-center gap-1.5',
                        selected ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30 text-muted-foreground')}>
                      {selected && <Check className="w-3 h-3" />}
                      <Volume2 className="w-3 h-3" />
                      {voice.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Images */}
          <div className="bg-card border border-border rounded-xl p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> תמונות / לוגו ({uploadedImages.length}/{MAX_IMAGES})
            </p>
            {uploadedImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedImages.map((url, i) => (
                  <div key={i} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-border">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {uploadedImages.length < MAX_IMAGES && (
              <FileUploadZone accept="image/*" multiple label="העלה לוגו / תמונות" hint="JPG, PNG"
                onUploaded={url => { if (url) setUploadedImages(prev => [...prev, url]); }}
                onMultipleUploaded={urls => setUploadedImages(prev => [...prev, ...urls].slice(0, MAX_IMAGES))}
              />
            )}
          </div>

          <button onClick={handleGenerateScript} disabled={loading}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {loading ? 'יוצר תסריט...' : 'צור תסריט'}
          </button>
        </div>
      )}

      {/* ===== STEP 1: Script review ===== */}
      {step === 1 && generatedScript && (
        <div className="space-y-4">
          {/* Script title & overview */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1">
            <p className="text-sm font-semibold text-primary">{generatedScript.title}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>⏱ {generatedScript.duration} שניות</span>
              <span>🎬 {generatedScript.scenes.length} סצנות</span>
              {generatedScript.style?.tone && <span>🎭 {generatedScript.style.tone}</span>}
            </div>
          </div>

          {/* Full script text */}
          <div className="bg-card border border-border rounded-xl p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> תסריט מלא
            </p>
            <textarea
              value={generatedScript.script}
              onChange={e => setGeneratedScript({ ...generatedScript, script: e.target.value })}
              onKeyDown={e => e.stopPropagation()}
              rows={4}
              dir="rtl"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Scenes */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {generatedScript.scenes.map((scene, idx) => (
              <div key={scene.id || idx} className="bg-card border border-border rounded-xl overflow-hidden">
                <button onClick={() => setEditingSceneIdx(editingSceneIdx === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 text-right">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">{idx + 1}</span>
                    <div>
                      <p className="text-xs font-medium">{scene.title}</p>
                      <p className="text-[10px] text-muted-foreground">{scene.speaker} • {scene.duration}s</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {scene.icons?.map((icon, i) => <span key={i} className="text-sm">{icon}</span>)}
                    {editingSceneIdx === idx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {editingSceneIdx === idx && (
                  <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">דובר</label>
                      <input value={scene.speaker} onChange={e => updateSceneText(idx, 'speaker', e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                        className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs" dir="rtl" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">טקסט מדובר</label>
                      <textarea value={scene.spokenText} onChange={e => updateSceneText(idx, 'spokenText', e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                        rows={2} className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs resize-none" dir="rtl" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">תיאור חזותי</label>
                      <textarea value={scene.visualDescription} onChange={e => updateSceneText(idx, 'visualDescription', e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                        rows={2} className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs resize-none" dir="rtl" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">כתובית</label>
                      <input value={scene.subtitleText} onChange={e => updateSceneText(idx, 'subtitleText', e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                        className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs" dir="rtl" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(0)}
              className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
              <Edit3 className="w-4 h-4" /> חזור לתיאור
            </button>
            <button onClick={() => setStep(2)}
              className="flex-1 gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> אשר תסריט
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 2: Final settings ===== */}
      {step === 2 && generatedScript && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-card border border-border rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold">סיכום</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 rounded-lg p-2">
                <span className="text-muted-foreground">תסריט:</span>
                <p className="font-medium truncate">{generatedScript.title}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <span className="text-muted-foreground">סצנות:</span>
                <p className="font-medium">{generatedScript.scenes.length}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <span className="text-muted-foreground">אווטארים:</span>
                <p className="font-medium">{selectedAvatars.length > 0 ? selectedAvatars.map(a => a.name).join(', ') : 'ללא'}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <span className="text-muted-foreground">קולות:</span>
                <p className="font-medium">{selectedVoices.length > 0 ? selectedVoices.map(v => v.name).join(', ') : useAiVoice ? 'AI אוטומטי' : 'ללא'}</p>
              </div>
            </div>
            {uploadedImages.length > 0 && (
              <div className="flex gap-2 pt-1">
                {uploadedImages.map((url, i) => (
                  <div key={i} className="w-10 h-10 rounded-lg overflow-hidden border border-border">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category selector */}
          {activeBrand && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">תת-פעילות / קטגוריה</label>
              {brandDepartments.length > 0 && (
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" dir="rtl">
                  <option value="">בחר...</option>
                  {brandDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              <input value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                placeholder="או כתוב תת-פעילות חדשה"
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" dir="rtl" />
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)}
              className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
              חזור לתסריט
            </button>
            <button onClick={handleGenerateVideo} disabled={loading}
              className="flex-1 gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <Play className="w-4 h-4" /> צור סרטון
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: Generating ===== */}
      {step === 3 && (
        <div className="space-y-4 text-center py-8">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium">מייצר את הסרטון...</p>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${runwayProgress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{Math.round(runwayProgress)}% הושלם</p>
        </div>
      )}

      {/* ===== STEP 4: Result ===== */}
      {step === 4 && resultVideoUrl && (
        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
            <video src={resultVideoUrl} controls className="w-full max-h-[300px]" />
          </div>

          {activeBrand && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">תת-פעילות / קטגוריה</label>
              {brandDepartments.length > 0 && (
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" dir="rtl">
                  <option value="">בחר...</option>
                  {brandDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              <input value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                placeholder="או כתוב תת-פעילות חדשה"
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" dir="rtl" />
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleDownload}
              className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> הורד
            </button>
            <button onClick={handleSave} disabled={savingOutput}
              className="flex-1 gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {savingOutput ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingOutput ? 'שומר...' : 'שמור'}
            </button>
          </div>

          <button onClick={() => { setStep(1); setResultVideoUrl(null); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-2">
            <Edit3 className="w-3.5 h-3.5" /> ערוך ותייצר מחדש
          </button>
          <button onClick={() => { setStep(0); setResultVideoUrl(null); setGeneratedScript(null); setPrompt(''); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1">
            <RefreshCw className="w-3.5 h-3.5" /> התחל מחדש
          </button>
        </div>
      )}
    </div>
  );
}
