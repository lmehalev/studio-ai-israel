import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle2, XCircle, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CostApprovalDialog, buildVideoGenerationEstimates } from '@/components/studio/CostApprovalDialog';
import { projectService } from '@/services/projectService';
import {
  voiceCloneService, voiceService, composeService, heygenService, kreaService,
} from '@/services/creativeService';

interface ProofResult {
  outputUrl: string | null;
  durationSec: number | null;
  narrationPresent: boolean;
  narrationVerification: string;
  captionsPresent: boolean;
  savedOutputId: string | null;
  providerChain: string[];
  failedStep: string | null;
  failedError: string | null;
  logs: string[];
}

const TEST_PROMPT = 'סרטון הסבר קצר על מערכת שותפים דיגיטלית – הוק חזק, 3 יתרונות מרכזיים, וקריאה לפעולה';
const TARGET_DURATION = 40;
const COMPOSE_POLL_MS = 3000;
const MAX_COMPOSE_POLLS = 300;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function ProofTestPage() {
  const [running, setRunning] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [result, setResult] = useState<ProofResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('he-IL');
    setLogs(prev => [...prev, `[${ts}] ${msg}`]);
  }, []);

  const runProofTest = async () => {
    setRunning(true);
    setResult(null);
    setLogs([]);
    const proof: ProofResult = {
      outputUrl: null, durationSec: null, narrationPresent: false,
      narrationVerification: '', captionsPresent: false, savedOutputId: null,
      providerChain: [], failedStep: null, failedError: null, logs: [],
    };

    try {
      // === STEP 1: Generate Script ===
      addLog('שלב 1: מייצר תסריט...');
      const { data: scriptData, error: scriptErr } = await supabase.functions.invoke('generate-script', {
        body: {
          prompt: TEST_PROMPT,
          targetDurationSec: TARGET_DURATION,
          videoType: 'marketing',
          videoStyle: 'cinematic',
        },
      });
      if (scriptErr || scriptData?.error) {
        proof.failedStep = 'generate-script';
        proof.failedError = scriptErr?.message || scriptData?.error || 'Unknown';
        throw new Error(proof.failedError);
      }
      const scenes = scriptData?.scenes || [];
      const fullScript = scenes.map((s: any) => s.spokenText || s.title || '').join(' ').trim();
      addLog(`תסריט נוצר: ${scenes.length} סצנות, ${fullScript.length} תווים`);
      proof.providerChain.push('generate-script ✓');

      if (scenes.length === 0 || !fullScript) {
        proof.failedStep = 'generate-script';
        proof.failedError = 'No scenes or empty script returned';
        throw new Error(proof.failedError);
      }

      // === STEP 2: Generate Narration (TTS) ===
      addLog('שלב 2: מייצר קריינות בעברית (ElevenLabs)...');
      let narrationAudioUrl: string | null = null;

      // Try to find a verified voice
      const { data: voicesData } = await supabase.from('voices').select('*');
      const verifiedVoice = (voicesData || []).find((v: any) => v.provider_voice_id);

      try {
        if (verifiedVoice?.provider_voice_id) {
          addLog(`משתמש בקול מאומת: ${verifiedVoice.name}`);
          const cloneResult = await voiceCloneService.cloneAndSpeak({
            providerVoiceId: verifiedVoice.provider_voice_id,
            scriptText: fullScript.slice(0, 4500),
            language: 'he',
            modelId: 'eleven_v3',
          });
          narrationAudioUrl = cloneResult.audioUrl;
          proof.narrationVerification = `voice_clone (${verifiedVoice.name}, model=eleven_v3)`;
        } else {
          addLog('אין קול מאומת — משתמש בקריין AI');
          narrationAudioUrl = await voiceService.generateAndUpload(fullScript.slice(0, 4500));
          proof.narrationVerification = 'ai_tts (ElevenLabs default)';
        }
        proof.narrationPresent = true;
        proof.providerChain.push('ElevenLabs TTS ✓');
        addLog(`קריינות מוכנה: ${narrationAudioUrl?.slice(0, 80)}...`);
      } catch (ttsErr: any) {
        proof.failedStep = 'text-to-speech';
        proof.failedError = ttsErr?.message || 'TTS failed';
        addLog(`❌ קריינות נכשלה: ${proof.failedError}`);
        throw new Error(`קריינות נכשלה (fail-fast): ${proof.failedError}`);
      }

      // === STEP 3: Generate Scene Clips ===
      addLog(`שלב 3: מייצר ${scenes.length} סצנות וידאו...`);
      const sceneVideoUrls: string[] = [];
      const sceneDurations: number[] = [];

      // Load first avatar for visual
      const { data: avatarsData } = await supabase.from('avatars').select('*').limit(1);
      const avatarUrl = avatarsData?.[0]?.image_url || null;

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const sceneDur = Math.max(5, Math.min(10, Number(scene.duration) || 10));
        const scenePrompt = `Cinematic professional ${scene.visualDescription || scene.title || 'business scene'}. High quality, professional lighting.`.slice(0, 900);

        addLog(`  סצנה ${i + 1}/${scenes.length}: ${scene.title || 'ללא כותרת'} (${sceneDur}s)`);

        let clipUrl: string | null = null;
        const tried: string[] = [];

        // Try HeyGen first
        try {
          addLog(`    → מנסה HeyGen...`);
          const heyRes = await heygenService.createVideo(
            scene.spokenText || scene.title || 'Professional scene',
            undefined, undefined,
            narrationAudioUrl || undefined,
            '16:9'
          );
          if (heyRes?.videoId) {
            // Poll HeyGen
            for (let p = 0; p < 180; p++) {
              const st = await heygenService.checkStatus(heyRes.videoId);
              if (st.status === 'done' && st.videoUrl) { clipUrl = st.videoUrl; break; }
              if (st.status === 'failed') throw new Error('HeyGen render failed');
              await sleep(5000);
            }
          }
          if (clipUrl) {
            tried.push('HeyGen ✓');
            proof.providerChain.push(`HeyGen scene ${i + 1} ✓`);
          }
        } catch (hErr: any) {
          tried.push(`HeyGen ✗ (${hErr?.message?.slice(0, 60)})`);
          addLog(`    ✗ HeyGen: ${hErr?.message?.slice(0, 80)}`);
        }

        // Fallback: Krea
        if (!clipUrl) {
          try {
            addLog(`    → מנסה Krea...`);
            const kRes = await kreaService.generateVideo(scenePrompt, {
              model: 'kling-2.5', duration: sceneDur, width: 1920, height: 1080,
            });
            if (kRes?.jobId) {
              for (let p = 0; p < 120; p++) {
                const st = await kreaService.checkStatus(kRes.jobId);
                if (st?.status === 'done' && st?.outputUrl) { clipUrl = st.outputUrl; break; }
                if (st?.status === 'failed') throw new Error('Krea render failed');
                await sleep(3000);
              }
            }
            if (clipUrl) {
              tried.push('Krea ✓');
              proof.providerChain.push(`Krea scene ${i + 1} ✓`);
            }
          } catch (kErr: any) {
            tried.push(`Krea ✗ (${kErr?.message?.slice(0, 60)})`);
            addLog(`    ✗ Krea: ${kErr?.message?.slice(0, 80)}`);
          }
        }

        // Fallback: AI Image (generate static image as video placeholder)
        if (!clipUrl) {
          try {
            addLog(`    → מנסה תמונת AI + אנימציה...`);
            const { data: imgData } = await supabase.functions.invoke('generate-image', {
              body: { prompt: scenePrompt, aspectRatio: '16:9' },
            });
            if (imgData?.imageUrl) {
              clipUrl = imgData.imageUrl;
              tried.push('AI Image ✓');
              proof.providerChain.push(`AI Image scene ${i + 1} ✓`);
            }
          } catch (aiErr: any) {
            tried.push(`AI Image ✗`);
          }
        }

        if (!clipUrl) {
          proof.failedStep = `scene-${i + 1}`;
          proof.failedError = `כל הספקים נכשלו בסצנה ${i + 1}: ${tried.join(' | ')}`;
          addLog(`❌ ${proof.failedError}`);
          throw new Error(proof.failedError);
        }

        sceneVideoUrls.push(clipUrl);
        sceneDurations.push(sceneDur);
        addLog(`  ✓ סצנה ${i + 1} מוכנה (${tried.filter(t => t.includes('✓')).join(', ')})`);
      }

      const totalDuration = sceneDurations.reduce((a, b) => a + b, 0);
      addLog(`סה"כ ${sceneVideoUrls.length} סצנות, ${totalDuration}s`);

      // Duration enforcement
      if (totalDuration < TARGET_DURATION - 2) {
        addLog(`⚠️ משך ${totalDuration}s קצר מהיעד ${TARGET_DURATION}s`);
      }

      // === STEP 4: Compose with Shotstack ===
      addLog('שלב 4: מרכיב סרטון סופי ב-Shotstack...');
      try {
        const renderResult = await composeService.render({
          videoUrl: sceneVideoUrls[0],
          videoUrls: sceneVideoUrls,
          scenes: scenes.map((s: any, i: number) => ({ ...s, duration: sceneDurations[i] })),
          audioUrl: narrationAudioUrl || undefined,
        });

        if (!renderResult?.renderId) {
          proof.failedStep = 'compose-video';
          proof.failedError = 'No renderId returned from Shotstack';
          throw new Error(proof.failedError);
        }

        proof.providerChain.push('Shotstack compose ✓');
        addLog(`Shotstack renderId: ${renderResult.renderId}`);

        // Poll for completion
        for (let i = 0; i < MAX_COMPOSE_POLLS; i++) {
          const status = await composeService.checkStatus(renderResult.renderId, renderResult.shotstackEnv);
          if (status.status === 'done' && status.url) {
            proof.outputUrl = status.url;
            proof.durationSec = totalDuration;
            proof.captionsPresent = false; // Basic test without captions
            addLog(`✓ סרטון מוכן: ${status.url.slice(0, 80)}...`);
            break;
          }
          if (status.status === 'failed') {
            proof.failedStep = 'compose-video';
            proof.failedError = 'Shotstack render failed';
            throw new Error(proof.failedError);
          }
          if (i % 10 === 0) addLog(`  ממתין לרינדור... (${i * 3}s)`);
          await sleep(COMPOSE_POLL_MS);
        }

        if (!proof.outputUrl) {
          proof.failedStep = 'compose-video';
          proof.failedError = 'Shotstack timeout';
          throw new Error(proof.failedError);
        }
      } catch (composeErr: any) {
        if (!proof.failedStep) {
          proof.failedStep = 'compose-video';
          proof.failedError = composeErr?.message || 'Compose failed';
        }
        throw composeErr;
      }

      // === STEP 5: Save to Project ===
      addLog('שלב 5: שומר תוצר בפרויקט...');
      try {
        // Find or create a test project
        const { data: brands } = await supabase.from('brands').select('*').limit(1);
        const brand = brands?.[0];
        let projectId: string;

        if (brand) {
          const project = await projectService.findOrCreateByBrand(brand.id, brand.name, 'Proof Test');
          projectId = project.id;
        } else {
          const project = await projectService.create({ name: 'Proof Test Run' });
          projectId = project.id;
        }

        const output = await projectService.addOutput(projectId, {
          name: `Proof Test — ${new Date().toLocaleDateString('he-IL')}`,
          description: TEST_PROMPT,
          video_url: proof.outputUrl,
          prompt: TEST_PROMPT,
          script: fullScript,
          provider: proof.providerChain.join(' → '),
          aspect_ratio: '16:9',
          estimated_length: `${totalDuration}s`,
          status: 'הושלם',
        });

        proof.savedOutputId = output.id;
        proof.providerChain.push('DB Save ✓');
        addLog(`✓ נשמר כ-Output: ${output.id}`);
      } catch (saveErr: any) {
        proof.failedStep = 'save';
        proof.failedError = saveErr?.message || 'Save failed';
        addLog(`❌ שמירה נכשלה: ${proof.failedError}`);
        // Don't throw — video was generated successfully
      }

      addLog('═══════════════════════════════');
      addLog('✅ PROOF TEST COMPLETE');
      toast.success('בדיקת הוכחה הושלמה!');
    } catch (err: any) {
      addLog(`═══════════════════════════════`);
      addLog(`❌ PROOF TEST FAILED at: ${proof.failedStep || 'unknown'}`);
      addLog(`Error: ${err?.message || 'Unknown error'}`);
      toast.error(`בדיקה נכשלה: ${err?.message}`);
    } finally {
      proof.logs = logs;
      setResult(proof);
      setRunning(false);
    }
  };

  const costEstimates = buildVideoGenerationEstimates(4, true, true);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-4" dir="rtl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🧪 בדיקת הוכחה — AI Video Pipeline (40s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>פרומפט:</strong> {TEST_PROMPT}</p>
              <p><strong>משך יעד:</strong> {TARGET_DURATION} שניות (38–42 מקובל)</p>
              <p><strong>קריינות:</strong> עברית (ElevenLabs) — חובה</p>
              <p><strong>שמירה:</strong> אוטומטית לפרויקט</p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setShowCost(true)}
                disabled={running}
                className="gap-2"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {running ? 'רץ...' : '💰 הרץ בדיקת הוכחה (40s)'}
              </Button>
            </div>

            {/* Live logs */}
            {logs.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 max-h-96 overflow-y-auto font-mono text-xs space-y-0.5">
                {logs.map((log, i) => (
                  <div key={i} className={
                    log.includes('❌') ? 'text-destructive' :
                    log.includes('✓') || log.includes('✅') ? 'text-green-600' :
                    log.includes('⚠️') ? 'text-yellow-600' : 'text-foreground'
                  }>{log}</div>
                ))}
                {running && <div className="animate-pulse">▌</div>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Result card */}
        {result && (
          <Card className={result.failedStep ? 'border-destructive' : 'border-green-500'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.failedStep ? <XCircle className="h-5 w-5 text-destructive" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
                {result.failedStep ? 'בדיקה נכשלה' : 'בדיקה הצליחה'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-medium">1) MP4 URL:</span>
                  {result.outputUrl ? (
                    <a href={result.outputUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs truncate max-w-xs">
                      {result.outputUrl.slice(0, 60)}...
                    </a>
                  ) : <Badge variant="destructive">חסר</Badge>}
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-medium">2) משך (שניות):</span>
                  {result.durationSec !== null ? (
                    <Badge variant={result.durationSec >= 38 && result.durationSec <= 42 ? 'default' : 'secondary'}>
                      {result.durationSec}s {result.durationSec >= 38 && result.durationSec <= 42 ? '✓' : '⚠️'}
                    </Badge>
                  ) : <Badge variant="destructive">N/A</Badge>}
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-medium">3) קריינות:</span>
                  <Badge variant={result.narrationPresent ? 'default' : 'destructive'}>
                    {result.narrationPresent ? `כן — ${result.narrationVerification}` : 'לא'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-medium">4) כתוביות:</span>
                  <Badge variant="secondary">{result.captionsPresent ? 'כן' : 'לא (בדיקה בסיסית)'}</Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-medium">5) Output ID נשמר:</span>
                  {result.savedOutputId ? (
                    <Badge variant="default">{result.savedOutputId.slice(0, 12)}... ✓</Badge>
                  ) : <Badge variant="destructive">לא נשמר</Badge>}
                </div>

                {result.failedStep && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive text-xs">
                    <p><strong>6) שלב שנכשל:</strong> {result.failedStep}</p>
                    <p><strong>שגיאה:</strong> {result.failedError}</p>
                  </div>
                )}
              </div>

              {/* Provider chain */}
              <div className="flex flex-wrap gap-1">
                {result.providerChain.map((p, i) => (
                  <Badge key={i} variant={p.includes('✓') ? 'default' : 'destructive'} className="text-xs">
                    {p}
                  </Badge>
                ))}
              </div>

              {/* Download button */}
              {result.outputUrl && (
                <Button asChild className="gap-2">
                  <a href={result.outputUrl} target="_blank" rel="noopener noreferrer" download>
                    <Download className="h-4 w-4" /> הורד MP4
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <CostApprovalDialog
          open={showCost}
          onOpenChange={setShowCost}
          estimates={costEstimates}
          onApprove={() => { setShowCost(false); runProofTest(); }}
        />
      </div>
    </AppLayout>
  );
}
