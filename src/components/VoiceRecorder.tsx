import { useState, useRef } from 'react';
import { Mic, Square, Loader2, Play, Pause, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { storageService } from '@/services/creativeService';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onRecorded?: (url: string, blob: Blob) => void;
  onSaved?: (publicUrl: string) => void;
  className?: string;
  label?: string;
}

export function VoiceRecorder({ onRecorded, onSaved, className, label = 'הקלט קול' }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        onRecorded?.(url, blob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      toast.error('לא ניתן לגשת למיקרופון — יש לאשר הרשאה');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleSave = async () => {
    if (!audioBlob) return;
    setSaving(true);
    try {
      const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
      const publicUrl = await storageService.upload(file);
      onSaved?.(publicUrl);
      toast.success('ההקלטה נשמרה באחסון');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setDuration(0);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className={cn('bg-muted/30 border border-border rounded-xl p-4 space-y-3', className)}>
      <p className="text-sm font-medium">{label}</p>

      {!audioUrl ? (
        <div className="flex items-center gap-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md',
              isRecording
                ? 'bg-destructive text-destructive-foreground animate-pulse'
                : 'gradient-gold text-primary-foreground'
            )}
          >
            {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <div>
            <p className="text-sm">{isRecording ? 'מקליט...' : 'לחץ להקלטה'}</p>
            {isRecording && <p className="text-xs text-destructive font-mono">{formatTime(duration)}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-background rounded-lg p-3 border border-border">
            <button onClick={handlePlayPause} className="w-10 h-10 gradient-gold text-primary-foreground rounded-full flex items-center justify-center">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 mr-[-1px]" />}
            </button>
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              controls
              className="flex-1 h-8"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              שמור באחסון
            </button>
            <button onClick={() => { handleClear(); startRecording(); }} className="px-4 py-2 border border-border rounded-lg text-xs hover:bg-muted flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5" /> הקלט שוב
            </button>
            <button onClick={handleClear} className="px-4 py-2 border border-destructive/30 rounded-lg text-xs text-destructive hover:bg-destructive/10 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> מחק
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
