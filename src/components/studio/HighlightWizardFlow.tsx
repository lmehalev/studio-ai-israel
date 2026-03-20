import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowRight, Loader2, Download, Save, X, Scissors, Upload,
  ChevronDown, ChevronUp, GripVertical, Play, Pause, Image as ImageIcon,
  Video, Music, Eye, RefreshCw, Bug, Check, Settings2, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { storageService, composeService, type SubtitleSegment, type Brand, brandService } from '@/services/creativeService';
import { projectService } from '@/services/projectService';
import { supabase } from '@/integrations/supabase/client';
import { FileUploadZone } from '@/components/FileUploadZone';
import { CostApprovalDialog, type CostEstimate } from '@/components/studio/CostApprovalDialog';

// ============ TYPES ============

interface UploadedAsset {
  id: string;
  url: string;
  name: string;
  type: 'video' | 'image';
  size: number;
  status: 'uploading' | 'ready' | 'failed';
  error?: string;
  durationSec?: number;
}

interface HighlightSegment {
  id: string;
  sourceAssetId: string;
  sourceUrl: string;
  sourceName: string;
  startSec: number;
  endSec: number;
  type: 'video' | 'image';
  reason?: string;
}

interface HighlightSettings {
  outputDuration: '30' | '60' | 'custom' | 'long';
  customDurationSec: number;
  contentStyle: 'podcast' | 'product' | 'drama' | 'auto';
  captionsOn: boolean;
  orientation: 'auto' | '9:16' | '16:9';
  logoUrl: string | null;
  logoPlacement: { xPct: number; yPct: number; scalePct: number; opacity: number };
  musicUrl: string | null;
  musicVolume: number;
  musicDucking: boolean;
}

interface HighlightWizardFlowProps {
  activeBrand?: Brand;
  activeBrandId: string | null;
  onComplete?: () => void;
  onBack?: () => void;
}

const MAX_FILES = 20;
const MAX_FILE_SIZE_MB = 500;
const MAX_TOTAL_SIZE_MB = 2000;
const IMAGE_DISPLAY_DURATION = 5; // seconds per image in final video

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function getFileType(file: File): 'video' | 'image' {
  if (file.type.startsWith('video/')) return 'video';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
  return 'image';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}ש׳`;
}

export function HighlightWizardFlow({ activeBrand, activeBrandId, onComplete, onBack }: HighlightWizardFlowProps) {
  // Step: 0=upload, 1=settings, 2=plan, 3=render
  const [step, setStep] = useState(0);

  // Step 0: Assets
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1: Settings
  const [settings, setSettings] = useState<HighlightSettings>({
    outputDuration: '60',
    customDurationSec: 60,
    contentStyle: 'auto',
    captionsOn: false,
    orientation: 'auto',
    logoUrl: null,
    logoPlacement: { xPct: 75, yPct: 85, scalePct: 12, opacity: 0.9 },
    musicUrl: null,
    musicVolume: 0.3,
    musicDucking: true,
  });

  // Step 2: Plan
  const [segments, setSegments] = useState<HighlightSegment[]>([]);
  const [planLoading, setPlanLoading] = useState(false);

  // Step 3: Render
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStage, setRenderStage] = useState('');
  const [renderRunId, setRenderRunId] = useState('');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);
  const [savingOutput, setSavingOutput] = useState(false);
  const [saved, setSaved] = useState(false);

  // Cost approval
  const [showCostApproval, setShowCostApproval] = useState(false);

  // Brands (inline selector when no brand pre-selected)
  const [inlineBrandId, setInlineBrandId] = useState<string | null>(null);
  const brands = brandService.getAll();

  const effectiveBrandId = activeBrandId || inlineBrandId;
  const effectiveBrandObj = activeBrand || brands.find(b => b.id === inlineBrandId);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('he-IL');
    setDebugLogs(prev => [...prev, `[${ts}] ${msg}`]);
  }, []);

  // ============ STEP 0: UPLOAD ============

  const handleFilesSelected = async (files: File[]) => {
    if (assets.length + files.length > MAX_FILES) {
      toast.error(`מותר עד ${MAX_FILES} קבצים`);
      return;
    }

    const totalCurrentSize = assets.reduce((s, a) => s + a.size, 0);
    const newAssets: UploadedAsset[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`"${file.name}" גדול מדי (מקסימום ${MAX_FILE_SIZE_MB}MB)`);
        continue;
      }
      const asset: UploadedAsset = {
        id: generateId(),
        url: '',
        name: file.name,
        type: getFileType(file),
        size: file.size,
        status: 'uploading',
      };
      newAssets.push(asset);
    }

    setAssets(prev => [...prev, ...newAssets]);

    // Upload sequentially to avoid overwhelming the server
    for (let i = 0; i < newAssets.length; i++) {
      const asset = newAssets[i];
      const file = files.find(f => f.name === asset.name && f.size === asset.size);
      if (!file) continue;

      try {
        const url = await storageService.upload(file);
        setAssets(prev => prev.map(a =>
          a.id === asset.id ? { ...a, url, status: 'ready' as const } : a
        ));
      } catch (err: any) {
        setAssets(prev => prev.map(a =>
          a.id === asset.id ? { ...a, status: 'failed' as const, error: err.message || 'שגיאה בהעלאה' } : a
        ));
      }
    }
  };

  const removeAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const readyAssets = assets.filter(a => a.status === 'ready');
  const uploadingCount = assets.filter(a => a.status === 'uploading').length;
  const failedAssets = assets.filter(a => a.status === 'failed');

  // ============ STEP 1: SETTINGS ============

  const getTargetDuration = () => {
    if (settings.outputDuration === '30') return 30;
    if (settings.outputDuration === '60') return 60;
    if (settings.outputDuration === 'custom') return settings.customDurationSec;
    return 0; // 'long' = no cap
  };

  const handleLogoUpload = async (file: File) => {
    try {
      const url = await storageService.upload(file);
      setSettings(prev => ({ ...prev, logoUrl: url }));
      toast.success('לוגו הועלה');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהעלאת לוגו');
    }
  };

  const handleMusicUpload = async (file: File) => {
    try {
      const url = await storageService.upload(file);
      setSettings(prev => ({ ...prev, musicUrl: url }));
      toast.success('מוזיקה הועלה');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהעלאת מוזיקה');
    }
  };

  // ============ STEP 2: PLAN ============

  const buildPlan = useCallback(async () => {
    setPlanLoading(true);
    addLog('בונה תוכנית חיתוך...');

    const targetDuration = getTargetDuration();
    const videoAssets = readyAssets.filter(a => a.type === 'video');
    const imageAssets = readyAssets.filter(a => a.type === 'image');

    const newSegments: HighlightSegment[] = [];

    if (targetDuration === 0) {
      // "Long compilation" — use everything
      for (const asset of videoAssets) {
        newSegments.push({
          id: generateId(),
          sourceAssetId: asset.id,
          sourceUrl: asset.url,
          sourceName: asset.name,
          startSec: 0,
          endSec: asset.durationSec || 30,
          type: 'video',
          reason: 'כל הסרטון',
        });
      }
      for (const asset of imageAssets) {
        newSegments.push({
          id: generateId(),
          sourceAssetId: asset.id,
          sourceUrl: asset.url,
          sourceName: asset.name,
          startSec: 0,
          endSec: IMAGE_DISPLAY_DURATION,
          type: 'image',
          reason: 'תמונה',
        });
      }
    } else {
      // Distribute duration across assets
      const totalAssets = videoAssets.length + imageAssets.length;
      if (totalAssets === 0) {
        setPlanLoading(false);
        return;
      }

      const perAssetSec = Math.max(3, Math.floor(targetDuration / totalAssets));

      for (const asset of videoAssets) {
        const clipLen = Math.min(perAssetSec, asset.durationSec || 30);
        newSegments.push({
          id: generateId(),
          sourceAssetId: asset.id,
          sourceUrl: asset.url,
          sourceName: asset.name,
          startSec: 0,
          endSec: clipLen,
          type: 'video',
          reason: `${clipLen} שניות ראשונות`,
        });
      }

      for (const asset of imageAssets) {
        const imgDur = Math.min(perAssetSec, IMAGE_DISPLAY_DURATION);
        newSegments.push({
          id: generateId(),
          sourceAssetId: asset.id,
          sourceUrl: asset.url,
          sourceName: asset.name,
          startSec: 0,
          endSec: imgDur,
          type: 'image',
          reason: 'תמונה',
        });
      }
    }

    setSegments(newSegments);
    addLog(`תוכנית מוכנה: ${newSegments.length} קטעים`);
    setPlanLoading(false);
  }, [readyAssets, settings, addLog]);

  useEffect(() => {
    if (step === 2 && segments.length === 0 && readyAssets.length > 0) {
      buildPlan();
    }
  }, [step]);

  const removeSegment = (id: string) => setSegments(prev => prev.filter(s => s.id !== id));

  const moveSegment = (idx: number, dir: -1 | 1) => {
    setSegments(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  const totalPlanDuration = segments.reduce((s, seg) => s + (seg.endSec - seg.startSec), 0);

  // ============ STEP 3: RENDER ============

  const buildCostEstimates = (): CostEstimate[] => {
    const estimates: CostEstimate[] = [];

    if (settings.captionsOn) {
      estimates.push({
        provider: 'ElevenLabs',
        action: 'תמלול אוטומטי (STT)',
        estimatedCost: `~${segments.filter(s => s.type === 'video').length} קבצים`,
        details: ['תמלול לצורך כתוביות בעברית'],
      });
    }

    estimates.push({
      provider: 'Shotstack',
      model: 'Production',
      action: `הרכבה ורינדור — ${segments.length} קטעים`,
      estimatedCost: '1 רינדור',
      details: [
        `משך כולל: ~${Math.round(totalPlanDuration)} שניות`,
        settings.logoUrl ? 'כולל לוגו' : '',
        settings.musicUrl ? 'כולל מוזיקת רקע' : '',
        settings.captionsOn ? 'כולל כתוביות בעברית' : '',
      ].filter(Boolean),
    });

    return estimates;
  };

  const requestRender = () => {
    if (segments.length === 0) {
      toast.error('אין קטעים לרינדור');
      return;
    }
    setShowCostApproval(true);
  };

  const handleCostApproved = () => {
    setShowCostApproval(false);
    setStep(3);
    executeRender();
  };

  const executeRender = async () => {
    const runId = `hl_${Date.now()}_${generateId()}`;
    setRenderRunId(runId);
    setRendering(true);
    setRenderProgress(0);
    setRenderStage('מתחיל...');
    setOutputVideoUrl(null);
    addLog(`התחלת רינדור — runId: ${runId}`);

    try {
      // Step A: If captions ON, transcribe video segments (max 2 concurrency)
      let allSubtitleSegments: SubtitleSegment[] = [];

      if (settings.captionsOn) {
        setRenderStage('מתמלל סרטונים...');
        const videoSegs = segments.filter(s => s.type === 'video');
        let timeOffset = 0;

        for (let i = 0; i < videoSegs.length; i++) {
          const seg = videoSegs[i];
          const segDuration = seg.endSec - seg.startSec;
          setRenderProgress(Math.round((i / videoSegs.length) * 30));
          addLog(`מתמלל: ${seg.sourceName} (${i + 1}/${videoSegs.length})`);

          try {
            const { data: txData, error: txError } = await supabase.functions.invoke('transcribe-audio', {
              body: {
                sourceAudioUrl: seg.sourceUrl,
                language: 'he',
                videoDuration: segDuration,
              },
            });

            if (txError) {
              addLog(`שגיאת תמלול: ${txError.message}`);
            } else if (txData?.segments) {
              // Offset timestamps to match the timeline position
              const offsetSegments: SubtitleSegment[] = txData.segments.map((s: SubtitleSegment) => ({
                ...s,
                start: s.start + timeOffset,
                end: Math.min(s.end + timeOffset, timeOffset + segDuration),
              }));
              allSubtitleSegments.push(...offsetSegments);
            }
          } catch (err: any) {
            addLog(`כשלון תמלול ${seg.sourceName}: ${err.message}`);
          }

          timeOffset += segDuration;
        }

        addLog(`תמלול הושלם: ${allSubtitleSegments.length} מקטעי כתוביות`);
      }

      setRenderProgress(35);
      setRenderStage('בונה ציר זמן...');

      // Step B: Build Shotstack scenes array
      const scenes = segments.map(seg => ({
        src: seg.sourceUrl,
        length: seg.endSec - seg.startSec,
        fit: 'contain' as const,
        type: seg.type,
      }));

      // Determine orientation
      const orientation = settings.orientation === 'auto' ? 'landscape' : (settings.orientation === '9:16' ? 'portrait' : 'landscape');

      addLog(`שולח לרינדור: ${scenes.length} קטעים, כיוון: ${orientation}`);

      setRenderProgress(40);
      setRenderStage('שולח לרינדור...');

      const composeResult = await composeService.render({
        videoUrl: scenes[0]?.src,
        videoUrls: scenes.map(s => s.src),
        scenes,
        audioUrl: settings.musicUrl || undefined,
        logoUrl: settings.logoUrl || undefined,
        logoPlacement: settings.logoUrl ? settings.logoPlacement : undefined,
        subtitleSegments: settings.captionsOn ? allSubtitleSegments : undefined,
        totalDuration: totalPlanDuration,
        orientation,
        subtitleStyle: settings.captionsOn ? {
          font: 'NotoSansHebrew',
          color: '#FFFFFF',
          size: 32,
          position: 'bottom',
          animation: 'slideUp',
        } : undefined,
      });

      if (!composeResult?.renderId) {
        throw new Error('לא התקבל מזהה רינדור מ-Shotstack');
      }

      addLog(`renderId: ${composeResult.renderId}, env: ${composeResult.shotstackEnv || 'production'}`);

      setRenderProgress(50);
      setRenderStage('ממתין לרינדור...');

      // Step C: Poll for completion
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const progress = 50 + Math.min(45, Math.floor(i * 0.8));
        setRenderProgress(progress);

        try {
          const statusResult = await composeService.checkStatus(
            composeResult.renderId,
            composeResult.shotstackEnv
          );

          if (statusResult?.status === 'done' && statusResult?.url) {
            setOutputVideoUrl(statusResult.url);
            setRenderProgress(100);
            setRenderStage('הרינדור הושלם!');
            addLog(`סיום! URL: ${statusResult.url}`);

            // Auto-save to project if brand selected
            if (effectiveBrandId && effectiveBrandObj) {
              await autoSaveToProject(statusResult.url);
            }

            toast.success('🎬 הסרטון מוכן!');
            setRendering(false);
            return;
          }

          if (statusResult?.status === 'failed') {
            throw new Error(`רינדור נכשל — Shotstack status: failed`);
          }

          setRenderStage(`ממתין לרינדור... (${statusResult?.progress || 0}%)`);
        } catch (pollErr: any) {
          addLog(`שגיאת בדיקת סטטוס: ${pollErr.message}`);
        }
      }

      throw new Error('הרינדור חרג מזמן המתנה (10 דקות)');
    } catch (err: any) {
      addLog(`שגיאה: ${err.message}`);
      toast.error(err.message || 'שגיאה ברינדור');
      setRenderStage(`שגיאה: ${err.message}`);
    } finally {
      setRendering(false);
    }
  };

  const autoSaveToProject = async (videoUrl: string) => {
    if (!effectiveBrandId || !effectiveBrandObj) return;
    try {
      addLog('שומר תוצר בפרויקט...');
      const project = await projectService.findOrCreateByBrand(effectiveBrandId, effectiveBrandObj.name);
      await projectService.addOutput(project.id, {
        name: `Highlight — ${effectiveBrandObj.name}`,
        description: `${segments.length} קטעים, ${Math.round(totalPlanDuration)} שניות`,
        video_url: videoUrl,
        provider: 'shotstack',
      });
      addLog('נשמר בפרויקט בהצלחה');
      setSaved(true);
    } catch (err: any) {
      addLog(`שגיאת שמירה: ${err.message}`);
    }
  };

  const handleManualSave = async () => {
    if (!outputVideoUrl) return;
    if (!effectiveBrandId || !effectiveBrandObj) {
      toast.error('יש לבחור חברה / מותג');
      return;
    }
    setSavingOutput(true);
    try {
      await autoSaveToProject(outputVideoUrl);
      toast.success('נשמר בפרויקט!');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בשמירה');
    } finally {
      setSavingOutput(false);
    }
  };

  const handleDownload = () => {
    if (!outputVideoUrl) return;
    const a = document.createElement('a');
    a.href = outputVideoUrl;
    a.download = `highlight-${Date.now()}.mp4`;
    a.target = '_blank';
    a.click();
  };

  // ============ RENDER UI ============

  const stepTitles = [
    { title: 'העלה תוכן', desc: 'העלה סרטונים ותמונות' },
    { title: 'הגדרות', desc: 'בחר אורך, סגנון ותוספות' },
    { title: 'תוכנית חיתוך', desc: 'סקור ועדכן את הסדר' },
    { title: rendering ? 'מעבד...' : 'התוצאה', desc: rendering ? 'מרכיב את הסרטון' : 'הסרטון שלך מוכן' },
  ];

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {stepTitles.map((_, i) => (
          <div key={i} className={cn('h-1.5 rounded-full flex-1 transition-all', i <= step ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>
      <div className="text-right">
        <h3 className="text-sm font-semibold">{stepTitles[step]?.title}</h3>
        <p className="text-xs text-muted-foreground">{stepTitles[step]?.desc}</p>
      </div>

      {/* ============ STEP 0: UPLOAD ============ */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            העלה סרטונים ו/או תמונות — המערכת תייצר ממנו סרטון קצר, קולע וויראלי (30‑60 שניות)
          </p>

          <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground space-y-0.5">
            <p>📎 נתמך: MP4, MOV, WEBM, JPG, PNG, WEBP</p>
            <p>📦 עד {MAX_FILES} קבצים, עד {MAX_FILE_SIZE_MB}MB לקובץ</p>
          </div>

          <FileUploadZone
            accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
            multiple
            label="העלה סרטונים ותמונות"
            hint={`גרור לכאן או לחץ — עד ${MAX_FILES} קבצים`}
            onUploaded={url => {
              if (url) {
                const ext = url.split('.').pop()?.toLowerCase() || '';
                const isVid = ['mp4', 'mov', 'webm'].includes(ext) || url.match(/\.(mp4|mov|webm)/i);
                setAssets(prev => [...prev, {
                  id: generateId(), url, name: url.split('/').pop() || 'קובץ',
                  type: isVid ? 'video' : 'image', size: 0, status: 'ready',
                }]);
              }
            }}
            onMultipleUploaded={urls => {
              const newAssets: UploadedAsset[] = urls.map(url => {
                const ext = url.split('.').pop()?.toLowerCase() || '';
                const isVid = ['mp4', 'mov', 'webm'].includes(ext) || !!url.match(/\.(mp4|mov|webm)/i);
                return {
                  id: generateId(), url, name: url.split('/').pop() || 'קובץ',
                  type: isVid ? 'video' as const : 'image' as const, size: 0, status: 'ready' as const,
                };
              });
              setAssets(prev => [...prev, ...newAssets]);
            }}
          />

          {/* Asset list */}
          {assets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{readyAssets.length} קבצים מוכנים{uploadingCount > 0 ? `, ${uploadingCount} מועלים...` : ''}</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {assets.map(asset => (
                  <div key={asset.id} className={cn(
                    'flex items-center gap-2 bg-card border rounded-lg px-3 py-2 text-xs',
                    asset.status === 'failed' ? 'border-destructive/50' : 'border-border',
                  )}>
                    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                      {asset.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                      {asset.status === 'ready' && (asset.type === 'video' ? <Video className="w-4 h-4 text-green-500" /> : <ImageIcon className="w-4 h-4 text-amber-500" />)}
                      {asset.status === 'failed' && <X className="w-4 h-4 text-destructive" />}
                    </div>
                    <span className="flex-1 truncate">{asset.name}</span>
                    {asset.size > 0 && <span className="text-muted-foreground">{formatBytes(asset.size)}</span>}
                    {asset.status === 'failed' && <span className="text-destructive truncate max-w-[120px]">{asset.error}</span>}
                    <button onClick={() => removeAsset(asset.id)} className="p-0.5 hover:bg-muted rounded">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (readyAssets.length === 0) { toast.error('יש להעלות לפחות קובץ אחד'); return; }
              setStep(1);
            }}
            disabled={uploadingCount > 0}
            className="w-full gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            המשך <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      )}

      {/* ============ STEP 1: SETTINGS ============ */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Output Duration */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">אורך פלט</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: '30', label: 'קצר 30ש׳', icon: '⚡' },
                { id: '60', label: 'קצר 60ש׳', icon: '🔥' },
                { id: 'custom', label: 'מותאם אישית', icon: '⏱️' },
                { id: 'long', label: 'הרכבה ארוכה', icon: '🎞️' },
              ] as const).map(opt => (
                <button key={opt.id} onClick={() => setSettings(p => ({ ...p, outputDuration: opt.id }))}
                  className={cn('text-right p-2.5 rounded-lg border transition-all text-xs',
                    settings.outputDuration === opt.id
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                      : 'border-border hover:border-primary/30 bg-card'
                  )}>
                  <span className="mr-1">{opt.icon}</span> {opt.label}
                </button>
              ))}
            </div>
            {settings.outputDuration === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="number" min={10} max={180} value={settings.customDurationSec}
                  onChange={e => setSettings(p => ({ ...p, customDurationSec: Math.max(10, Math.min(180, Number(e.target.value))) }))}
                  className="w-20 bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-center" />
                <span className="text-xs text-muted-foreground">שניות (10–180)</span>
              </div>
            )}
          </div>

          {/* Content Style */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">סגנון תוכן</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'auto', label: 'אוטומטי', desc: 'המערכת תזהה' },
                { id: 'podcast', label: 'פודקאסט', desc: 'הדגשות מפודקאסט' },
                { id: 'product', label: 'מוצר / שיווק', desc: 'תוכן שיווקי' },
                { id: 'drama', label: 'דרמה / סיפור', desc: 'קטעים דרמטיים' },
              ] as const).map(opt => (
                <button key={opt.id} onClick={() => setSettings(p => ({ ...p, contentStyle: opt.id }))}
                  className={cn('text-right p-2.5 rounded-lg border transition-all text-xs',
                    settings.contentStyle === opt.id
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                      : 'border-border hover:border-primary/30 bg-card'
                  )}>
                  <span className="font-semibold">{opt.label}</span>
                  <p className="text-muted-foreground text-[10px]">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Captions */}
          <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2.5">
            <div>
              <p className="text-xs font-medium">כתוביות בעברית</p>
              <p className="text-[10px] text-muted-foreground">תמלול אוטומטי + צריבה (RTL)</p>
            </div>
            <button onClick={() => setSettings(p => ({ ...p, captionsOn: !p.captionsOn }))}
              className={cn('w-10 h-5 rounded-full transition-colors relative', settings.captionsOn ? 'bg-primary' : 'bg-muted')}>
              <div className={cn('w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all', settings.captionsOn ? 'right-0.5' : 'right-[22px]')} />
            </button>
          </div>

          {/* Orientation */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">כיווניות</label>
            <div className="flex gap-2">
              {(['auto', '9:16', '16:9'] as const).map(opt => (
                <button key={opt} onClick={() => setSettings(p => ({ ...p, orientation: opt }))}
                  className={cn('flex-1 text-center py-2 rounded-lg border text-xs font-medium transition-all',
                    settings.orientation === opt ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/30'
                  )}>
                  {opt === 'auto' ? 'אוטומטי' : opt}
                </button>
              ))}
            </div>
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">לוגו (אופציונלי)</label>
            {settings.logoUrl ? (
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                <img src={settings.logoUrl} alt="logo" className="w-8 h-8 object-contain rounded" />
                <span className="text-xs flex-1 truncate">לוגו הועלה</span>
                <button onClick={() => setSettings(p => ({ ...p, logoUrl: null }))} className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-border rounded-lg p-3 text-center cursor-pointer hover:border-primary/40 transition-colors">
                <Upload className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">העלה לוגו</p>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); }} />
              </label>
            )}
            {settings.logoUrl && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-muted-foreground">גודל (%)</label>
                  <input type="range" min={2} max={30} value={settings.logoPlacement.scalePct}
                    onChange={e => setSettings(p => ({ ...p, logoPlacement: { ...p.logoPlacement, scalePct: Number(e.target.value) } }))}
                    className="w-full" />
                </div>
                <div>
                  <label className="text-muted-foreground">שקיפות</label>
                  <input type="range" min={10} max={100} value={Math.round(settings.logoPlacement.opacity * 100)}
                    onChange={e => setSettings(p => ({ ...p, logoPlacement: { ...p.logoPlacement, opacity: Number(e.target.value) / 100 } }))}
                    className="w-full" />
                </div>
              </div>
            )}
          </div>

          {/* Music */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">מוזיקת רקע (אופציונלי)</label>
            {settings.musicUrl ? (
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                <Music className="w-4 h-4 text-primary" />
                <span className="text-xs flex-1">מוזיקה הועלה</span>
                <button onClick={() => setSettings(p => ({ ...p, musicUrl: null }))} className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-border rounded-lg p-3 text-center cursor-pointer hover:border-primary/40 transition-colors">
                <Music className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">העלה קובץ מוזיקה</p>
                <input type="file" accept="audio/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleMusicUpload(e.target.files[0]); }} />
              </label>
            )}
            {settings.musicUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-muted-foreground">עוצמה</label>
                  <input type="range" min={5} max={100} value={Math.round(settings.musicVolume * 100)}
                    onChange={e => setSettings(p => ({ ...p, musicVolume: Number(e.target.value) / 100 }))}
                    className="flex-1" />
                  <span className="text-muted-foreground w-8 text-center">{Math.round(settings.musicVolume * 100)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Ducking (הנמכה בזמן דיבור)</span>
                  <button onClick={() => setSettings(p => ({ ...p, musicDucking: !p.musicDucking }))}
                    className={cn('w-8 h-4 rounded-full transition-colors relative', settings.musicDucking ? 'bg-primary' : 'bg-muted')}>
                    <div className={cn('w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all', settings.musicDucking ? 'right-0.5' : 'right-[18px]')} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <button onClick={() => setStep(0)} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">
              חזרה
            </button>
            <button onClick={() => { setSegments([]); setStep(2); }}
              className="flex-1 gradient-gold text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
              בנה תוכנית <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* ============ STEP 2: PLAN ============ */}
      {step === 2 && (
        <div className="space-y-4">
          {planLoading ? (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">בונה תוכנית חיתוך...</p>
            </div>
          ) : (
            <>
              <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{segments.length} קטעים</span>
                <span className="font-semibold">{formatDuration(totalPlanDuration)} סה״כ</span>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {segments.map((seg, idx) => (
                  <div key={seg.id} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveSegment(idx, -1)} disabled={idx === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20">
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => moveSegment(idx, 1)} disabled={idx === segments.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20">
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                      {seg.type === 'video' ? <Video className="w-4 h-4 text-green-500" /> : <ImageIcon className="w-4 h-4 text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{seg.sourceName}</p>
                      <p className="text-muted-foreground">
                        {seg.type === 'video' ? `${seg.startSec}ש׳ → ${seg.endSec}ש׳` : `${seg.endSec}ש׳ תצוגה`}
                        {seg.reason && ` — ${seg.reason}`}
                      </p>
                    </div>
                    <span className="text-muted-foreground font-mono">{formatDuration(seg.endSec - seg.startSec)}</span>
                    <button onClick={() => removeSegment(seg.id)} className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">
                  חזרה
                </button>
                <button onClick={requestRender} disabled={segments.length === 0}
                  className="flex-1 gradient-gold text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  💰 רנדור סרטון <Scissors className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ STEP 3: RENDER / RESULT ============ */}
      {step === 3 && (
        <div className="space-y-4">
          {rendering && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <Scissors className="w-7 h-7 text-primary animate-pulse" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">{renderStage}</p>
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden max-w-xs mx-auto">
                  <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${renderProgress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{renderProgress}%</p>
              </div>
              {renderRunId && <p className="text-[10px] text-muted-foreground font-mono">runId: {renderRunId}</p>}
            </div>
          )}

          {!rendering && outputVideoUrl && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                <video src={outputVideoUrl} controls className="w-full max-h-[300px]" />
              </div>

              {/* Brand selector for saving */}
              {!activeBrand && (
                <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">שמור תחת חברה / מותג</label>
                  <select value={inlineBrandId || ''} onChange={e => setInlineBrandId(e.target.value || null)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm" dir="rtl">
                    <option value="">בחר חברה...</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={handleDownload} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> הורד MP4
                </button>
                {!saved && (
                  <button onClick={handleManualSave} disabled={savingOutput || !effectiveBrandId}
                    className="flex-1 px-4 py-2.5 gradient-gold text-primary-foreground rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                    {savingOutput ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingOutput ? 'שומר...' : 'שמור בפרויקט'}
                  </button>
                )}
                {saved && (
                  <div className="flex-1 px-4 py-2.5 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-600 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> נשמר!
                  </div>
                )}
              </div>

              <button onClick={() => { onComplete?.(); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-2">
                <RefreshCw className="w-3.5 h-3.5" /> התחל מחדש
              </button>
            </div>
          )}

          {!rendering && !outputVideoUrl && renderStage.startsWith('שגיאה') && (
            <div className="space-y-3 text-center py-4">
              <p className="text-sm text-destructive font-medium">{renderStage}</p>
              <button onClick={() => { setStep(2); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">
                חזרה לתוכנית
              </button>
            </div>
          )}

          {/* Debug panel */}
          {debugLogs.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <button onClick={() => setShowDebug(p => !p)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30">
                <span className="flex items-center gap-1"><Bug className="w-3 h-3" /> פרטים טכניים ({debugLogs.length})</span>
                {showDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showDebug && (
                <div className="max-h-32 overflow-y-auto px-3 pb-2 space-y-0.5 text-[10px] font-mono text-muted-foreground">
                  {debugLogs.map((log, i) => <p key={i}>{log}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cost approval dialog */}
      <CostApprovalDialog
        open={showCostApproval}
        onOpenChange={setShowCostApproval}
        estimates={buildCostEstimates()}
        onApprove={handleCostApproved}
        title="אישור רינדור סרטון"
      />
    </div>
  );
}
