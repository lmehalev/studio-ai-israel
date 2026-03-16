import { AppLayout } from '@/components/layout/AppLayout';
import { useState } from 'react';
import { UserCircle, Plus, Trash2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { FileUploadZone } from '@/components/FileUploadZone';
import { avatarGenService } from '@/services/creativeService';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';

interface SavedAvatar {
  id: string;
  name: string;
  imageUrl: string;
  style: string;
  sourcePhotos: string[];
  createdAt: string;
}

const STORAGE_KEY = 'studio-avatars';

function getAvatars(): SavedAvatar[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveAvatars(avatars: SavedAvatar[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(avatars));
}

export default function AvatarsManagePage() {
  const [avatars, setAvatars] = useState<SavedAvatar[]>(getAvatars());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [style, setStyle] = useState('professional headshot');
  const [generating, setGenerating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('יש להזין שם לאווטאר'); return; }
    if (photos.length === 0) { toast.error('יש להעלות לפחות תמונה אחת'); return; }
    setGenerating(true);
    try {
      const result = await avatarGenService.generate(photos, style);
      if (!result.imageUrl) { toast.error('לא התקבלה תמונה'); return; }
      const newAvatar: SavedAvatar = {
        id: crypto.randomUUID(),
        name,
        imageUrl: result.imageUrl,
        style,
        sourcePhotos: photos,
        createdAt: new Date().toISOString(),
      };
      const updated = [...avatars, newAvatar];
      setAvatars(updated);
      saveAvatars(updated);
      setCreating(false);
      setName('');
      setPhotos([]);
      toast.success('האווטאר נוצר בהצלחה!');
    } catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  const handleDelete = (id: string) => {
    const updated = avatars.filter(a => a.id !== id);
    setAvatars(updated);
    saveAvatars(updated);
    toast.success('האווטאר הוסר');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-rubik font-bold flex items-center gap-2">
              <UserCircle className="w-6 h-6 text-primary" />
              אווטארים
            </h1>
            <p className="text-muted-foreground text-sm mt-1">צור ונהל אווטארים לשימוש בסרטונים ותמונות</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="gradient-gold text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> צור אווטאר חדש
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">אווטאר חדש</h3>
              <button onClick={() => setCreating(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">שם האווטאר</label>
              <div className="flex gap-2">
                <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.stopPropagation()}
                  placeholder="למשל: דוברת ראשית" className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <VoiceDictationButton onResult={text => setName(prev => prev ? prev + ' ' + text : text)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">סגנון</label>
              <select value={style} onChange={e => setStyle(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="professional headshot">פורטרט מקצועי</option>
                <option value="cinematic portrait with dramatic lighting">סינמטי דרמטי</option>
                <option value="friendly casual portrait, warm tones">ידידותי וחם</option>
                <option value="corporate business photo, clean background">תאגידי עסקי</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">תמונות רפרנס ({photos.length}/5)</label>
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {photos.map((url, i) => (
                    <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
                      <img src={url} alt={`ref ${i+1}`} className="w-full h-full object-cover" />
                      <button onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < 5 && (
                <FileUploadZone accept="image/*" label="העלה תמונה" hint="JPG, PNG — עד 5 תמונות"
                  onUploaded={url => { if (url && photos.length < 5) setPhotos(prev => [...prev, url]); }} />
              )}
            </div>
            <button onClick={handleCreate} disabled={generating}
              className="w-full gradient-gold text-primary-foreground py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCircle className="w-4 h-4" />}
              {generating ? 'מייצר אווטאר...' : 'צור אווטאר'}
            </button>
          </div>
        )}

        {/* Avatars grid */}
        {avatars.length === 0 && !creating ? (
          <div className="text-center py-16 text-muted-foreground">
            <UserCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">אין אווטארים עדיין</p>
            <p className="text-sm mt-1">צור אווטאר ראשון כדי להשתמש בו בסרטונים</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {avatars.map(avatar => (
              <div key={avatar.id} className="bg-card border border-border rounded-xl overflow-hidden group relative">
                <div className="aspect-square">
                  <img src={avatar.imageUrl} alt={avatar.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm">{avatar.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(avatar.createdAt).toLocaleDateString('he-IL')}</p>
                </div>
                <button onClick={() => handleDelete(avatar.id)}
                  className="absolute top-2 left-2 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
