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
  runwayService, didService, storageService, voiceCloneService, composeService,
  voiceService, type Brand,
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
  cameraDirection?: string;
  environment?: string;
  characters?: string;
  videoStyle?: string;
}

interface GeneratedScript {
  title: string;
  duration: number;
  script: string;
  scenes: ScriptScene[];
  style: { tone?: string; pace?: string; music?: string; cinematicStyle?: string };
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

const RUNWAY_PROMPT_MAX_CHARS = 900;
const toRunwayPrompt = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, RUNWAY_PROMPT_MAX_CHARS);

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
  const [progressStage, setProgressStage] = useState('');

  // Improve / refine
  const [improvePrompt, setImprovePrompt] = useState('');
  const [isImproving, setIsImproving] = useState(false);

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

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalizeAvatarForVideo = async (avatarUrl: string): Promise<string> => {
    const ensureUpload = async (blob: Blob, forceJpg = false) => {
      const fileType = forceJpg ? 'image/jpeg' : (blob.type || 'image/png');
      const ext = fileType.includes('jpeg') ? 'jpg' : 'png';
      const file = new File([blob], `avatar-source-${Date.now()}.${ext}`, { type: fileType });
      return storageService.upload(file);
    };

    if (avatarUrl.startsWith('data:image/')) {
      const res = await fetch(avatarUrl);
      const blob = await res.blob();
      return ensureUpload(blob, true);
    }

    if (!/\.(png|jpe?g)(\?|$)/i.test(avatarUrl)) {
      const res = await fetch(avatarUrl);
      const blob = await res.blob();
      return ensureUpload(blob, true);
    }

    return avatarUrl;
  };

  const waitForDidResult = async (talkId: string, onProgress: (p: number) => void): Promise<string> => {
    for (let attempts = 1; attempts <= 90; attempts++) {
      const status = await didService.checkStatus(talkId);
      if (status.status === 'done' && status.resultUrl) return status.resultUrl;
      if (status.status === 'error') throw new Error('שגיאה ביצירת סרטון אווטאר');
      onProgress(Math.min(95, attempts * 2));
      await sleep(5000);
    }
    throw new Error('תם הזמן ליצירת הסרטון');
  };

  const waitForRunwayResult = async (taskId: string, onProgress: (p: number) => void): Promise<string> => {
    for (let attempts = 1; attempts <= 120; attempts++) {
      const status = await runwayService.checkStatus(taskId);
      onProgress(Math.max(5, Math.min(95, status.progress * 100)));
      if (status.status === 'SUCCEEDED' && status.resultUrl) return status.resultUrl;
      if (status.status === 'FAILED') throw new Error(status.failureReason || 'שגיאה ביצירת סרטון');
      await sleep(5000);
    }
    throw new Error('תם הזמן ליצירת הסרטון');
  };

  // Build the best possible prompt for Runway from the script
  const buildRunwayPromptFromScript = (): string => {
    if (!generatedScript) return prompt;
    
    // Use the first scene's visual description as the primary prompt (since Runway generates one clip)
    const mainScene = generatedScript.scenes[0];
    if (!mainScene) return generatedScript.script || prompt;

    const parts: string[] = [];
    
    // Visual description is most important
    if (mainScene.visualDescription) parts.push(mainScene.visualDescription);
    if (mainScene.cameraDirection) parts.push(`Camera: ${mainScene.cameraDirection}`);
    if (mainScene.environment) parts.push(mainScene.environment);
    if (mainScene.characters) parts.push(mainScene.characters);
    
    // Add style context
    const style = generatedScript.style;
    if (style?.cinematicStyle) parts.push(`Style: ${style.cinematicStyle}`);
    
    // Add brand context
    if (activeBrand?.name) parts.push(`Brand: ${activeBrand.name}`);
    
    return toRunwayPrompt(parts.join('. '));
  };

  // ===== Step 3: Generate video (full pipeline) =====
  const handleGenerateVideo = async () => {
    if (!generatedScript) return;
    setLoading(true);
    setStep(3);
    setRunwayPolling(true);
    setRunwayProgress(0);
    setProgressStage('מכין את הייצור...');

    try {
      const avatarImage = selectedAvatars[0]?.image_url;
      const fullScript = generatedScript.scenes.map(s => s.spokenText).join(' ');
      const selectedVoice = selectedVoices[0];
      let narrationAudioUrl: string | undefined;
      let baseVideoUrl: string | undefined;

      // === Stage 1: ALWAYS generate Hebrew narration ===
      setProgressStage('מייצר קריינות בעברית...');
      setRunwayProgress(5);

      if (selectedVoice?.audio_url) {
        // User selected their own voice → clone it
        try {
          const cloneResult = await voiceCloneService.cloneAndSpeak(
            selectedVoice.audio_url,
            fullScript
          );
          narrationAudioUrl = cloneResult.audioUrl;
          toast.success('הקריינות בקול שלך מוכנה!');
        } catch (cloneErr: any) {
          console.warn('Voice clone failed, falling back to AI TTS:', cloneErr?.message);
          toast.info('לא הצלחתי לשכפל את הקול, משתמש בקריין AI...');
        }
      }

      // If no cloned voice succeeded, generate AI narration
      if (!narrationAudioUrl) {
        try {
          narrationAudioUrl = await voiceService.generateAndUpload(fullScript);
          toast.success('קריינות AI בעברית מוכנה!');
        } catch (ttsErr: any) {
          console.warn('TTS failed:', ttsErr?.message);
          toast.info('לא הצלחתי ליצור קריינות, ממשיך ללא קול...');
        }
      }
      setRunwayProgress(25);

      // === Stage 2: Generate base video ===
      if (avatarImage) {
        setProgressStage('יוצר אווטאר מדבר...');
        setRunwayProgress(30);
        const normalizedAvatarUrl = await normalizeAvatarForVideo(avatarImage);

        try {
          const talkResult = await didService.createTalk(
            normalizedAvatarUrl,
            narrationAudioUrl ? undefined : fullScript,
            undefined,
            narrationAudioUrl
          );
          if (!talkResult?.id) throw new Error('D-ID error');

          setProgressStage('האווטאר מדבר... ממתין לתוצאה');
          baseVideoUrl = await waitForDidResult(talkResult.id, (p) => {
            setRunwayProgress(30 + p * 0.35);
          });
          toast.success('אווטאר מדבר מוכן!');
        } catch (didErr: any) {
          console.warn('D-ID failed, switching to Runway:', didErr?.message);
          setProgressStage('מעביר ל-RunwayML...');
          toast.info('מעביר אוטומטית ל-RunwayML...');

          const runwayPrompt = buildRunwayPromptFromScript();

          const taskData = await runwayService.imageToVideo(
            normalizedAvatarUrl,
            runwayPrompt,
            undefined,
            10,
          );

          baseVideoUrl = await waitForRunwayResult(taskData.taskId, (p) => {
            setRunwayProgress(30 + p * 0.35);
          });
        }
      } else {
        // No avatar → cinematic text-to-video via Runway
        setProgressStage('מייצר סרטון AI קולנועי...');
        
        const runwayPrompt = buildRunwayPromptFromScript();

        const taskData = await runwayService.textToVideo(
          runwayPrompt,
          undefined,
          10,
        );

        baseVideoUrl = await waitForRunwayResult(taskData.taskId, (p) => {
          setRunwayProgress(30 + p * 0.35);
        });
      }

      // === Stage 3: Composite with Shotstack (add subtitles, logo, icons) ===
      if (baseVideoUrl) {
        setProgressStage('מרכיב סרטון סופי — כתוביות, לוגו ואייקונים...');
        setRunwayProgress(70);

        // First uploaded image is treated as logo
        const logoUrl = uploadedImages[0] || activeBrand?.logo || undefined;
        const brandColors = activeBrand?.colors || [];

        try {
          const renderResult = await composeService.render({
            videoUrl: baseVideoUrl,
            scenes: generatedScript.scenes,
            logoUrl,
            brandColors,
            audioUrl: narrationAudioUrl,
          });

          if (!renderResult?.renderId) throw new Error('Shotstack error');

          setProgressStage('מעבד וידאו סופי עם כתוביות ולוגו...');
          for (let i = 0; i < 90; i++) {
            const status = await composeService.checkStatus(renderResult.renderId);
            if (status.status === 'done' && status.url) {
              setResultVideoUrl(status.url);
              setStep(4);
              setProgressStage('');
              toast.success('🎬 הסרטון המקצועי מוכן עם כתוביות ולוגו!');
              return;
            }
            if (status.status === 'failed') throw new Error('Shotstack render failed');
            setRunwayProgress(70 + (i / 90) * 28);
            await sleep(3000);
          }
          throw new Error('תם הזמן להרכבת הסרטון');
        } catch (composeErr: any) {
          console.warn('Shotstack compositing failed, using base video:', composeErr?.message);
          toast.info('ההרכבה לא הצליחה — הסרטון מוגש ללא כתוביות/לוגו. ניתן לשפר אותו.');
          setResultVideoUrl(baseVideoUrl);
          setStep(4);
          setProgressStage('');
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'שגיאה ביצירת סרטון');
      setStep(2);
      setProgressStage('');
    } finally {
      setLoading(false);
      setRunwayPolling(false);
    }
  };

  // ===== Improve/Refine existing video =====
  const handleImproveVideo = async () => {
    if (!improvePrompt.trim()) { toast.error('תאר מה לשפר בסרטון'); return; }
    setIsImproving(true);
    setStep(3);
    setRunwayProgress(0);
    setProgressStage('משפר את הסרטון לפי הבקשה שלך...');

    try {
      const improveContext = [
        improvePrompt,
        generatedScript?.scenes[0]?.visualDescription || '',
        activeBrand?.name ? `Brand: ${activeBrand.name}` : '',
      ].filter(Boolean).join('. ');

      const runwayPrompt = toRunwayPrompt(improveContext);
      const fullScript = generatedScript?.scenes.map(s => s.spokenText).join(' ') || '';

      // Generate narration for improved video too
      let narrationAudioUrl: string | undefined;
      if (fullScript) {
        setProgressStage('מייצר קריינות בעברית...');
        try {
          const selectedVoice = selectedVoices[0];
          if (selectedVoice?.audio_url) {
            const cloneResult = await voiceCloneService.cloneAndSpeak(selectedVoice.audio_url, fullScript);
            narrationAudioUrl = cloneResult.audioUrl;
          } else {
            narrationAudioUrl = await voiceService.generateAndUpload(fullScript);
          }
        } catch { /* continue without narration */ }
      }

      setProgressStage('מייצר סרטון משופר...');
      const avatarImage = selectedAvatars[0]?.image_url;
      let newVideoUrl: string;

      if (avatarImage) {
        const normalizedUrl = await normalizeAvatarForVideo(avatarImage);
        const taskData = await runwayService.imageToVideo(normalizedUrl, runwayPrompt, undefined, 10);
        newVideoUrl = await waitForRunwayResult(taskData.taskId, (p) => setRunwayProgress(p));
      } else {
        const taskData = await runwayService.textToVideo(runwayPrompt, undefined, 10);
        newVideoUrl = await waitForRunwayResult(taskData.taskId, (p) => setRunwayProgress(p));
      }

      // Composite with narration + subtitles + logo
      if (generatedScript) {
        const logoUrl = uploadedImages[0] || activeBrand?.logo || undefined;
        setProgressStage('מרכיב כתוביות, קריינות ולוגו...');
        try {
          const renderResult = await composeService.render({
            videoUrl: newVideoUrl,
            scenes: generatedScript.scenes,
            logoUrl,
            brandColors: activeBrand?.colors || [],
            audioUrl: narrationAudioUrl,
          });
          if (renderResult?.renderId) {
            for (let i = 0; i < 60; i++) {
              const status = await composeService.checkStatus(renderResult.renderId);
              if (status.status === 'done' && status.url) {
                newVideoUrl = status.url;
                break;
              }
              if (status.status === 'failed') break;
              await sleep(3000);
            }
          }
        } catch {
          // Use video without compositing
        }
      }

      setResultVideoUrl(newVideoUrl);
      setStep(4);
      setProgressStage('');
      setImprovePrompt('');
      toast.success('🎬 הסרטון המשופר מוכן!');
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בשיפור הסרטון');
      setStep(4);
      setProgressStage('');
    } finally {
      setIsImproving(false);
      setRunwayPolling(false);
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
    { title: 'הסרטון מוכן!', desc: 'צפה, הורד, שפר או שמור' },
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

          {/* Info about duration */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
            <span>הסרטון יהיה <strong className="text-foreground">10 שניות</strong> של תוכן AI קולנועי. המערכת תוסיף כתוביות, לוגו ואייקונים אוטומטית.</span>
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
            <p className="text-[10px] text-muted-foreground">התמונה הראשונה תשמש כלוגו על הסרטון</p>
            {uploadedImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedImages.map((url, i) => (
                  <div key={i} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-border">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {i === 0 && (
                      <span className="absolute top-0.5 left-0.5 text-[8px] bg-primary text-primary-foreground px-1 rounded">לוגו</span>
                    )}
                    <button onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {uploadedImages.length < MAX_IMAGES && (
              <FileUploadZone accept="image/*" multiple label="העלה לוגו / תמונות" hint="JPG, PNG — התמונה הראשונה = לוגו"
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
                      <label className="text-[10px] text-muted-foreground">🎬 תיאור חזותי — זה מה שמנוע הווידאו רואה!</label>
                      <textarea value={scene.visualDescription} onChange={e => updateSceneText(idx, 'visualDescription', e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                        rows={3} className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs resize-none" dir="rtl"
                        placeholder="תאר בדיוק מה רואים על המסך — דמויות, מוצרים, סביבה, תאורה, צבעים..." />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">📷 כיוון מצלמה</label>
                        <input value={scene.cameraDirection || ''} onChange={e => updateSceneText(idx, 'cameraDirection', e.target.value)}
                          onKeyDown={e => e.stopPropagation()}
                          className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs" dir="rtl"
                          placeholder="קלוז-אפ, wide shot, דרון..." />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">🎨 סגנון וידאו</label>
                        <select value={scene.videoStyle || 'cinematic'} onChange={e => updateSceneText(idx, 'videoStyle', e.target.value)}
                          className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs">
                          <option value="cinematic">קולנועי</option>
                          <option value="animation">אנימציה</option>
                          <option value="documentary">דוקומנטרי</option>
                          <option value="commercial">פרסומת</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">🌍 סביבה ואווירה</label>
                      <input value={scene.environment || ''} onChange={e => updateSceneText(idx, 'environment', e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                        className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs" dir="rtl"
                        placeholder="משרד מודרני, רחוב שוק הומה, פארק ירוק..." />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">👥 דמויות ופעולות</label>
                      <input value={scene.characters || ''} onChange={e => updateSceneText(idx, 'characters', e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                        className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs" dir="rtl"
                        placeholder="אישה צעירה עם מחשב נייד, מחייכת..." />
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
                  <div key={i} className="w-10 h-10 rounded-lg overflow-hidden border border-border relative">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {i === 0 && <span className="absolute top-0 left-0 text-[6px] bg-primary text-primary-foreground px-0.5 rounded-br">לוגו</span>}
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
          <p className="text-sm font-medium">{progressStage || 'מייצר את הסרטון...'}</p>
          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-primary/70 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${runwayProgress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{Math.round(runwayProgress)}% הושלם</p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {[
              { label: 'שכפול קול', done: runwayProgress > 25 },
              { label: 'יצירת וידאו', done: runwayProgress > 65 },
              { label: 'כתוביות ולוגו', done: runwayProgress > 95 },
            ].map(s => (
              <span key={s.label} className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border',
                s.done ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border'
              )}>
                {s.done ? '✓' : '○'} {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== STEP 4: Result ===== */}
      {step === 4 && resultVideoUrl && (
        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
            <video src={resultVideoUrl} controls loop className="w-full max-h-[300px]" />
          </div>

          {/* Improve section */}
          <div className="bg-card border border-primary/20 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-primary" /> שפר את הסרטון
            </p>
            <p className="text-[10px] text-muted-foreground">תאר מה לשנות — למשל: "יותר צבעוני", "הוסף תנועה", "שים דגש על המוצרים"</p>
            <div className="flex gap-2">
              <input
                value={improvePrompt}
                onChange={e => setImprovePrompt(e.target.value)}
                onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleImproveVideo(); }}
                placeholder="מה לשפר..."
                dir="rtl"
                className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button onClick={handleImproveVideo} disabled={isImproving || !improvePrompt.trim()}
                className="px-4 py-2 gradient-gold text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
                {isImproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                שפר
              </button>
            </div>
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
            <Edit3 className="w-3.5 h-3.5" /> ערוך תסריט ותייצר מחדש
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
