import { AppLayout } from '@/components/layout/AppLayout';
import { useState } from 'react';
import { Mic, Plus, Trash2, X, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { FileUploadZone } from '@/components/FileUploadZone';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';
import { useRef } from 'react';

interface SavedVoice {
  id: string;
  name: string;
  audioUrl: string;
  type: 'recorded' | 'uploaded';
  createdAt: string;
}

const STORAGE_KEY = 'studio-voices';

function getVoices(): SavedVoice[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveVoicesToStorage(voices: SavedVoice[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(voices));
}

export default function VoicesManagePage() {
  const [voices, setVoices] = useState<SavedVoice[]>(getVoices());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSaveVoice = (audioUrl: string, type: 'recorded' | 'uploaded') => {
    if (!name.trim()) { toast.error('יש להזין שם לקול'); return; }
    const newVoice: SavedVoice = {
      id: crypto.randomUUID(),
      name,
      audioUrl,
      type,
      createdAt: new Date().toISOString(),
    };
    const updated = [...voices, newVoice];
    setVoices(updated);
    saveVoicesToStorage(updated);
    setCreating(false);
    setName('');
    toast.success('הקול נשמר!');
  };

  const handleDelete = (id: string) => {
    const updated = voices.filter(v => v.id !== id);
    setVoices(updated);
    saveVoicesToStorage(updated);
    toast.success('הקול הוסר');
  };

  const togglePlay = (voice: SavedVoice) => {
    if (playingId === voice.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(voice.audioUrl);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.play();
      setPlayingId(voice.id);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-rubik font-bold flex items-center gap-2">
              <Mic className="w-6 h-6 text-primary" />
              דיבוב / קול
            </h1>
            <p className="text-muted-foreground text-sm mt-1">הקלט קולות או העלה קבצי אודיו לשימוש בסרטונים</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="gradient-gold text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> הוסף קול חדש
          </button>
        </div>

        {creating && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">קול חדש</h3>
              <button onClick={() => setCreating(false)} className="p-1 hover:bg-muted rounded-lg">
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
            <VoiceRecorder label="🎙️ הקלט קול" onSaved={url => handleSaveVoice(url, 'recorded')} />
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /> או העלה קובץ <span className="h-px flex-1 bg-border" /></div>
            <FileUploadZone accept="audio/*" label="העלה קובץ אודיו" hint="MP3, WAV, M4A, OGG"
              onUploaded={url => { if (url) handleSaveVoice(url, 'uploaded'); }} />
          </div>
        )}

        {voices.length === 0 && !creating ? (
          <div className="text-center py-16 text-muted-foreground">
            <Mic className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">אין קולות שמורים עדיין</p>
            <p className="text-sm mt-1">הקלט או העלה קול ראשון</p>
          </div>
        ) : (
          <div className="space-y-3">
            {voices.map(voice => (
              <div key={voice.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 group">
                <button onClick={() => togglePlay(voice)}
                  className="w-12 h-12 gradient-gold text-primary-foreground rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                  {playingId === voice.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 mr-[-2px]" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{voice.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {voice.type === 'recorded' ? '🎙️ הוקלט' : '📁 הועלה'} • {new Date(voice.createdAt).toLocaleDateString('he-IL')}
                  </p>
                </div>
                <button onClick={() => handleDelete(voice.id)}
                  className="w-8 h-8 bg-destructive/10 text-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
