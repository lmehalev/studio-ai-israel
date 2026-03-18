import { AppLayout } from '@/components/layout/AppLayout';
import { useState, useEffect, useRef } from 'react';
import { Mic, Plus, Trash2, X, Play, Pause, Loader2, Download, DollarSign, FileText, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { toast } from 'sonner';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { FileUploadZone } from '@/components/FileUploadZone';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';
import { supabase } from '@/integrations/supabase/client';
import { CostApprovalDialog, CostEstimate } from '@/components/studio/CostApprovalDialog';

interface SavedVoice {
  id: string;
  name: string;
  audio_url: string;
  type: 'recorded' | 'uploaded';
  provider_voice_id?: string | null;
  created_at: string;
}

interface VoiceGeneration {
  id: string;
  title: string;
  script: string;
  voice_id: string | null;
  voice_name: string;
  provider: string;
  audio_url: string;
  duration_seconds: number | null;
  created_at: string;
}

// Vibe/Delivery presets - only affect delivery, not identity
const VIBE_PRESETS: Record<string, { label: string; settings: { stability: number; similarity_boost: number; style?: number; use_speaker_boost: boolean; speed: number } }> = {
  default: {
    label: 'רגיל',
    settings: { stability: 0.45, similarity_boost: 0.9, use_speaker_boost: true, speed: 1 },
  },
  happy: {
    label: 'שמח / עליז',
    settings: { stability: 0.35, similarity_boost: 0.9, style: 0.4, use_speaker_boost: true, speed: 1.05 },
  },
  sad: {
    label: 'עצוב / אמפתי',
    settings: { stability: 0.55, similarity_boost: 0.9, style: 0.3, use_speaker_boost: true, speed: 0.9 },
  },
  energetic: {
    label: 'אנרגטי / מכירתי',
    settings: { stability: 0.3, similarity_boost: 0.9, style: 0.6, use_speaker_boost: true, speed: 1.1 },
  },
  calm: {
    label: 'רגוע / מקצועי',
    settings: { stability: 0.6, similarity_boost: 0.9, style: 0.1, use_speaker_boost: true, speed: 0.95 },
  },
  gentle: {
    label: 'מתנצל / עדין',
    settings: { stability: 0.55, similarity_boost: 0.9, style: 0.2, use_speaker_boost: true, speed: 0.9 },
  },
};

// Preprocess script for punctuation/pauses
function preprocessPauses(text: string): string {
  // Convert double newlines to longer pause
  let result = text.replace(/\n\n+/g, '... ... ');
  // Convert single newlines to short pause
  result = result.replace(/\n/g, '... ');
  return result;
}

export default function VoicesManagePage() {
  const [voices, setVoices] = useState<SavedVoice[]>([]);
  const [generations, setGenerations] = useState<VoiceGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Script-to-Voice state
  const [showScriptToVoice, setShowScriptToVoice] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [scriptText, setScriptText] = useState('');
  const [scriptTitle, setScriptTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedVoiceId, setGeneratedVoiceId] = useState<string | null>(null);
  const [costApprovalOpen, setCostApprovalOpen] = useState(false);
  const [savingGeneration, setSavingGeneration] = useState(false);
  const [language, setLanguage] = useState<'he' | 'en' | 'ar'>('he');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationErrorMeta, setGenerationErrorMeta] = useState<{
    functionName?: string;
    status?: number;
    providerError?: string;
  } | null>(null);

  // New: vibe preset + punctuation toggle + tech details
  const [vibePreset, setVibePreset] = useState<string>('default');
  const [respectPauses, setRespectPauses] = useState(true);
  const [techDetails, setTechDetails] = useState<{
    selectedVoiceId: string;
    providerVoiceIdSent: string;
    voiceIdReturned: string;
    clonedFresh: boolean;
    provider: string;
    modelId: string;
    language: string;
    voiceSettings: Record<string, unknown>;
  } | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Generation detail view
  const [expandedGenId, setExpandedGenId] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [voicesRes, gensRes] = await Promise.all([
        supabase.functions.invoke('voice-manager', { body: { action: 'list' } }),
        supabase.functions.invoke('voice-manager', { body: { action: 'list_generations' } }),
      ]);
      if (voicesRes.data?.voices) setVoices(voicesRes.data.voices);
      if (gensRes.data?.generations) setGenerations(gensRes.data.generations);
    } catch (e: any) {
      console.error('Failed to load:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVoice = async (audioUrl: string, type: 'recorded' | 'uploaded') => {
    if (!name.trim()) { toast.error('יש להזין שם לקול'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('voice-manager', {
        body: { action: 'save', name, audio_url: audioUrl, type },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setVoices(prev => [data.voice, ...prev]);
      setCreating(false);
      setName('');
      toast.success('הקול נשמר בהצלחה!');
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בשמירת הקול');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const voice = voices.find(v => v.id === id);
      const { data, error } = await supabase.functions.invoke('voice-manager', {
        body: { action: 'delete', id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (voice?.audio_url) {
        const match = voice.audio_url.match(/\/media\/(.+)$/);
        if (match) await supabase.storage.from('media').remove([match[1]]);
      }
      setVoices(prev => prev.filter(v => v.id !== id));
      toast.success('הקול הוסר');
    } catch (e: any) {
      toast.error(e.message || 'שגיאה במחיקת הקול');
    }
  };

  const handleDeleteGeneration = async (id: string) => {
    try {
      const gen = generations.find(g => g.id === id);
      const { data, error } = await supabase.functions.invoke('voice-manager', {
        body: { action: 'delete_generation', id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (gen?.audio_url) {
        const match = gen.audio_url.match(/\/media\/(.+)$/);
        if (match) await supabase.storage.from('media').remove([match[1]]);
      }
      setGenerations(prev => prev.filter(g => g.id !== id));
      toast.success('הדיבוב הוסר');
    } catch (e: any) {
      toast.error(e.message || 'שגיאה במחיקה');
    }
  };

  const togglePlay = (id: string, url: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.play();
      setPlayingId(id);
    }
  };

  // === Script-to-Voice Flow ===
  const selectedVoice = voices.find(v => v.id === selectedVoiceId);

  const parseGenerateError = async (error: any) => {
    const fallback = error?.message || 'שגיאה ביצירת דיבוב';
    const response = error?.context;

    if (!response || typeof response.text !== 'function') {
      return { message: fallback, meta: null };
    }

    try {
      const raw = await response.text();
      const parsed = raw ? JSON.parse(raw) : null;
      const providerError = parsed?.providerError
        ? (typeof parsed.providerError === 'string' ? parsed.providerError : JSON.stringify(parsed.providerError))
        : undefined;

      return {
        message: parsed?.warning || parsed?.error || fallback,
        meta: {
          functionName: parsed?.functionName,
          status: typeof response.status === 'number' ? response.status : undefined,
          providerError,
        },
      };
    } catch {
      return {
        message: fallback,
        meta: {
          status: typeof response.status === 'number' ? response.status : undefined,
        },
      };
    }
  };

  const openScriptToVoice = () => {
    setShowScriptToVoice(true);
    setGenerationError(null);
    setGenerationErrorMeta(null);
    setTechDetails(null);
    setShowTechDetails(false);
    if (!selectedVoiceId && voices.length > 0) {
      setSelectedVoiceId(voices[0].id);
    }
  };

  const currentVibeSettings = VIBE_PRESETS[vibePreset]?.settings || VIBE_PRESETS.default.settings;

  const costEstimates: CostEstimate[] = [{
    provider: 'ElevenLabs',
    model: language === 'he' ? 'eleven_v3' : 'eleven_multilingual_v2',
    action: selectedVoice?.provider_voice_id ? 'קריינות (קול שמור)' : 'שכפול קול + קריינות',
    estimatedCost: `~${scriptText.length} תווים`,
    details: [
      selectedVoice?.provider_voice_id
        ? 'שימוש בקול ששוכפל בעבר — ללא עלות שכפול נוספת'
        : 'שכפול הקול הנבחר ויצירת קריינות',
      `פריסט: ${VIBE_PRESETS[vibePreset]?.label || 'רגיל'}`,
    ],
  }];

  const handleRequestGenerate = () => {
    if (!selectedVoiceId) { toast.error('יש לבחור קול'); return; }
    if (!scriptText.trim()) { toast.error('יש להזין תסריט'); return; }
    if (scriptText.length > 4500) { toast.error('התסריט ארוך מדי (מקסימום 4,500 תווים)'); return; }
    if (!scriptTitle.trim()) { toast.error('יש להזין כותרת לדיבוב'); return; }
    setGenerationError(null);
    setGenerationErrorMeta(null);
    setCostApprovalOpen(true);
  };

  const executeGenerate = async () => {
    setCostApprovalOpen(false);
    if (!selectedVoice) return;

    setGenerating(true);
    setGeneratedAudioUrl(null);
    setGenerationError(null);
    setGenerationErrorMeta(null);
    setTechDetails(null);

    try {
      // Prepare script: optionally preprocess pauses
      const processedScript = respectPauses ? preprocessPauses(scriptText) : scriptText;

      // Build request body
      const body: Record<string, unknown> = {
        scriptText: processedScript,
        language,
        voiceSettings: currentVibeSettings,
      };

      // If we have a stored provider_voice_id, reuse it (no re-clone)
      if (selectedVoice.provider_voice_id) {
        body.providerVoiceId = selectedVoice.provider_voice_id;
      } else {
        body.audioUrl = selectedVoice.audio_url;
      }

      const { data, error } = await supabase.functions.invoke('clone-voice-tts', { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.audioUrl) throw new Error('לא התקבל קובץ אודיו');

      setGeneratedAudioUrl(data.audioUrl);
      setGeneratedVoiceId(data.voiceId || null);

      // Save tech details for debugging
      setTechDetails({
        selectedVoiceId: selectedVoice.id,
        providerVoiceIdSent: selectedVoice.provider_voice_id || '(שוכפל חדש)',
        voiceIdReturned: data.voiceId || '',
        clonedFresh: data.clonedFresh || false,
        provider: 'ElevenLabs',
        modelId: data.modelId || '',
        language: data.language || '',
        voiceSettings: data.voiceSettings || currentVibeSettings,
      });

      // If cloned fresh, save the provider_voice_id back to DB for reuse
      if (data.clonedFresh && data.voiceId) {
        try {
          await supabase.functions.invoke('voice-manager', {
            body: { action: 'update_provider_voice_id', id: selectedVoice.id, provider_voice_id: data.voiceId },
          });
          // Update local state
          setVoices(prev => prev.map(v =>
            v.id === selectedVoice.id ? { ...v, provider_voice_id: data.voiceId } : v
          ));
        } catch (e) {
          console.warn('Failed to save provider_voice_id:', e);
        }
      }

      toast.success('הדיבוב נוצר בהצלחה!');
    } catch (e: any) {
      console.error('TTS generation error:', e);
      const parsed = await parseGenerateError(e);
      setGenerationError(parsed.message);
      setGenerationErrorMeta(parsed.meta);
      toast.error(parsed.message || 'שגיאה ביצירת דיבוב');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadMp3 = () => {
    if (!generatedAudioUrl) return;
    const a = document.createElement('a');
    a.href = generatedAudioUrl;
    a.download = `${scriptTitle || 'dubbing'}-${Date.now()}.mp3`;
    a.click();
  };

  const handleSaveGeneration = async () => {
    if (!generatedAudioUrl) return;
    setSavingGeneration(true);
    try {
      const { data, error } = await supabase.functions.invoke('voice-manager', {
        body: {
          action: 'save_generation',
          title: scriptTitle,
          script: scriptText,
          voice_id: selectedVoiceId,
          voice_name: selectedVoice?.name || '',
          provider: 'ElevenLabs',
          audio_url: generatedAudioUrl,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setGenerations(prev => [data.generation, ...prev]);
      toast.success('הדיבוב נשמר בספריית הקולות!');
      setShowScriptToVoice(false);
      setScriptText('');
      setScriptTitle('');
      setGeneratedAudioUrl(null);
      setGeneratedVoiceId(null);
      setGenerationError(null);
      setGenerationErrorMeta(null);
      setTechDetails(null);
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בשמירה');
    } finally {
      setSavingGeneration(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-rubik font-bold flex items-center gap-2">
              <Mic className="w-6 h-6 text-primary" />
              דיבוב / קול
            </h1>
            <p className="text-muted-foreground text-sm mt-1">הקלט קולות, העלה אודיו או צור דיבוב מתסריט</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openScriptToVoice}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> 💰 צור דיבוב
            </button>
            <button
              onClick={() => setCreating(true)}
              className="gradient-gold text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> הוסף קול חדש
            </button>
          </div>
        </div>

        {/* Script-to-Voice Panel */}
        {showScriptToVoice && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                צור דיבוב מתסריט
              </h3>
              <button
                onClick={() => {
                  setShowScriptToVoice(false);
                  setGeneratedAudioUrl(null);
                  setGenerationError(null);
                  setGenerationErrorMeta(null);
                  setTechDetails(null);
                }}
                className="p-1 hover:bg-muted rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Voice selector */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">בחר קול</label>
              {voices.length === 0 ? (
                <p className="text-sm text-destructive">אין קולות שמורים. הקלט או העלה קול קודם.</p>
              ) : (
                <select
                  value={selectedVoiceId}
                  onChange={e => setSelectedVoiceId(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">בחר קול...</option>
                  {voices.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.type === 'recorded' ? '🎙️ הוקלט' : '📁 הועלה'})
                      {v.provider_voice_id ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
              )}
              {selectedVoice?.provider_voice_id && (
                <p className="text-xs text-green-500 mt-1">✓ קול זה כבר שוכפל — ישתמש בקול המקורי ללא שכפול חוזר</p>
              )}
            </div>

            {/* Language selector */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">שפת הדיבוב</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value as 'he' | 'en' | 'ar')}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="he">🇮🇱 עברית</option>
                <option value="en">🇺🇸 English</option>
                <option value="ar">🇸🇦 عربية</option>
              </select>
            </div>

            {/* Vibe / Delivery preset */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">סגנון דיבור (Vibe)</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(VIBE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setVibePreset(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      vibePreset === key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Punctuation / Pauses toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-medium text-muted-foreground">כבד פסיקים ושורות</label>
                <p className="text-xs text-muted-foreground/70">שורות חדשות יהפכו להפסקות קצרות</p>
              </div>
              <button
                onClick={() => setRespectPauses(!respectPauses)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  respectPauses ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  respectPauses ? 'right-0.5' : 'left-0.5'
                }`} />
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">כותרת הדיבוב</label>
              <div className="flex gap-2">
                <input
                  value={scriptTitle}
                  onChange={e => setScriptTitle(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                  placeholder="למשל: פתיח סרטון מכירות"
                  className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <VoiceDictationButton onResult={text => setScriptTitle(prev => prev ? prev + ' ' + text : text)} />
              </div>
            </div>

            {/* Script textarea */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                תסריט ({language === 'he' ? 'עברית' : language === 'ar' ? 'عربية' : 'English'}) — {scriptText.length}/4,500 תווים
              </label>
              <div className="relative">
                <textarea
                  value={scriptText}
                  onChange={e => setScriptText(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                  placeholder="הקלד את הטקסט שיוקרא בקול שלך..."
                  rows={6}
                  dir="rtl"
                  maxLength={4500}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                />
                <div className="absolute bottom-2 left-2">
                  <VoiceDictationButton onResult={text => setScriptText(prev => prev ? prev + ' ' + text : text)} />
                </div>
              </div>
            </div>

            {generationError && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-destructive">{generationError}</p>
                {(generationErrorMeta?.functionName || generationErrorMeta?.status) && (
                  <p className="text-xs text-muted-foreground">
                    פונקציה: {generationErrorMeta?.functionName || 'לא ידוע'}
                    {generationErrorMeta?.status ? ` • סטטוס: ${generationErrorMeta.status}` : ''}
                  </p>
                )}
                {generationErrorMeta?.providerError && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">פרטי שגיאה מהספק</summary>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words bg-background/70 border border-border rounded-md p-2">
                      {generationErrorMeta.providerError}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Generate button */}
            {!generatedAudioUrl && (
              <button
                onClick={handleRequestGenerate}
                disabled={generating || !selectedVoiceId || !scriptText.trim() || !scriptTitle.trim()}
                className="w-full gradient-gold text-primary-foreground py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    יוצר דיבוב... (עשוי לקחת 30-60 שניות)
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4" />
                    💰 צור דיבוב
                  </>
                )}
              </button>
            )}

            {/* Generated output */}
            {generatedAudioUrl && (
              <div className="bg-muted/30 border border-primary/30 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-primary">✅ הדיבוב נוצר בהצלחה!</p>
                <div className="flex items-center gap-3 bg-background rounded-lg p-3 border border-border">
                  <button
                    onClick={() => togglePlay('generated', generatedAudioUrl)}
                    className="w-10 h-10 gradient-gold text-primary-foreground rounded-full flex items-center justify-center"
                  >
                    {playingId === 'generated' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 mr-[-1px]" />}
                  </button>
                  <audio
                    src={generatedAudioUrl}
                    controls
                    className="flex-1 h-8"
                    onEnded={() => setPlayingId(null)}
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={handleDownloadMp3}
                    className="px-4 py-2 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> הורד MP3
                  </button>
                  <button
                    onClick={handleSaveGeneration}
                    disabled={savingGeneration}
                    className="px-4 py-2 gradient-gold text-primary-foreground rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingGeneration ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                    שמור לספריית קולות
                  </button>
                </div>

                {/* Technical details panel */}
                {techDetails && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowTechDetails(!showTechDetails)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                      פרטים טכניים
                      {showTechDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {showTechDetails && (
                      <div className="mt-2 bg-background border border-border rounded-lg p-3 text-xs space-y-1 font-mono" dir="ltr">
                        <p><span className="text-muted-foreground">selectedVoiceId:</span> {techDetails.selectedVoiceId}</p>
                        <p><span className="text-muted-foreground">providerVoiceId sent:</span> {techDetails.providerVoiceIdSent}</p>
                        <p><span className="text-muted-foreground">voiceId returned:</span> {techDetails.voiceIdReturned}</p>
                        <p><span className="text-muted-foreground">clonedFresh:</span> {techDetails.clonedFresh ? 'yes' : 'no (reused)'}</p>
                        <p><span className="text-muted-foreground">provider:</span> {techDetails.provider}</p>
                        <p><span className="text-muted-foreground">modelId:</span> {techDetails.modelId}</p>
                        <p><span className="text-muted-foreground">language_code:</span> {techDetails.language}</p>
                        <p><span className="text-muted-foreground">voice_settings:</span> {JSON.stringify(techDetails.voiceSettings)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Create new voice */}
        {creating && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">קול חדש</h3>
              <button onClick={() => { setCreating(false); setName(''); }} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">שם הקול</label>
              <div className="flex gap-2">
                <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.stopPropagation()}
                  placeholder="למשל: קול ראשי, קול מכירות" className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <VoiceDictationButton onResult={text => setName(prev => prev ? prev + ' ' + text : text)} />
              </div>
            </div>
            {saving && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> שומר קול...
              </div>
            )}
            {!saving && (
              <>
                <VoiceRecorder label="🎙️ הקלט קול" onSaved={url => handleSaveVoice(url, 'recorded')} />
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /> או העלה קובץ <span className="h-px flex-1 bg-border" /></div>
                <FileUploadZone accept="audio/*" label="העלה קובץ אודיו" hint="MP3, WAV, M4A, OGG"
                  onUploaded={url => { if (url) handleSaveVoice(url, 'uploaded'); }} />
              </>
            )}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin opacity-30" />
            <p className="text-sm">טוען קולות...</p>
          </div>
        ) : (
          <>
            {/* Generated Voiceovers History */}
            {generations.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  דיבובים שנוצרו
                </h2>
                {generations.map(gen => (
                  <div key={gen.id} className="bg-card border border-border rounded-xl p-4 space-y-2 group">
                    <div className="flex items-center gap-4">
                      <button onClick={() => togglePlay(gen.id, gen.audio_url)}
                        className="w-12 h-12 gradient-gold text-primary-foreground rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                        {playingId === gen.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 mr-[-2px]" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{gen.title}</p>
                        <p className="text-xs text-muted-foreground">
                          🎙️ {gen.voice_name || 'קול לא ידוע'} • {gen.provider} • {new Date(gen.created_at).toLocaleDateString('he-IL')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setExpandedGenId(expandedGenId === gen.id ? null : gen.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                          title="הצג פרטים">
                          {expandedGenId === gen.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button onClick={() => {
                          const a = document.createElement('a');
                          a.href = gen.audio_url;
                          a.download = `${gen.title}.mp3`;
                          a.click();
                        }}
                          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                          title="הורד MP3">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteGeneration(gen.id)}
                          className="w-8 h-8 bg-destructive/10 text-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {expandedGenId === gen.id && (
                      <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">תסריט:</p>
                          <p className="text-foreground whitespace-pre-wrap" dir="rtl">{gen.script}</p>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>קול: {gen.voice_name}</span>
                          <span>ספק: {gen.provider}</span>
                          {gen.duration_seconds && <span>אורך: {Math.round(gen.duration_seconds)} שניות</span>}
                        </div>
                        <audio src={gen.audio_url} controls className="w-full h-8" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Saved Voices */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary" />
                קולות שמורים
              </h2>
              {voices.length === 0 && !creating ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Mic className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">אין קולות שמורים עדיין</p>
                  <p className="text-sm mt-1">הקלט או העלה קול ראשון</p>
                </div>
              ) : (
                voices.map(voice => (
                  <div key={voice.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 group">
                    <button onClick={() => togglePlay(voice.id, voice.audio_url)}
                      className="w-12 h-12 gradient-gold text-primary-foreground rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                      {playingId === voice.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 mr-[-2px]" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{voice.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {voice.type === 'recorded' ? '🎙️ הוקלט' : '📁 הועלה'} • {new Date(voice.created_at).toLocaleDateString('he-IL')}
                        {voice.provider_voice_id && ' • ✓ משוכפל'}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(voice.id)}
                      className="w-8 h-8 bg-destructive/10 text-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Cost Approval Dialog */}
      <CostApprovalDialog
        open={costApprovalOpen}
        onOpenChange={setCostApprovalOpen}
        estimates={costEstimates}
        onApprove={executeGenerate}
        title="אישור יצירת דיבוב"
      />
    </AppLayout>
  );
}
