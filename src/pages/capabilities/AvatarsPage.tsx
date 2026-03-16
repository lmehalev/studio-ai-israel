import { AppLayout } from '@/components/layout/AppLayout';
import { useState, useEffect } from 'react';
import { UserCircle, Plus, Trash2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FileUploadZone } from '@/components/FileUploadZone';
import { avatarGenService, avatarDbService } from '@/services/creativeService';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';

const MAX_PHOTOS = 7;

interface SavedAvatar {
  id: string;
  name: string;
  image_url: string;
  style: string;
  source_photos: string[];
  created_at: string;
}

const STYLE_OPTIONS = [
  { value: 'professional headshot', label: 'פורטרט מקצועי', desc: 'תמונת פנים נקייה ומקצועית לשימוש בוידאו' },
  { value: 'cinematic portrait with dramatic lighting', label: 'סינמטי דרמטי', desc: 'תאורה דרמטית וקולנועית' },
  { value: 'friendly casual portrait, warm tones', label: 'ידידותי וחם', desc: 'סגנון לא פורמלי עם גוונים חמים' },
  { value: 'corporate business photo, clean background', label: 'תאגידי עסקי', desc: 'רקע נקי, מראה מקצועי' },
  { value: 'cartoon pixar style 3d animated character', label: '🎬 דמות פיקסאר / 3D', desc: 'דמות תלת-ממדית בסגנון אנימציה' },
  { value: 'disney hand-drawn classic animation style', label: '🏰 דיסני קלאסי', desc: 'ציור יד בסגנון דיסני קלאסי' },
  { value: 'anime manga japanese animation style', label: '🎌 אנימה / מנגה', desc: 'סגנון אנימציה יפנית' },
  { value: 'comic book graphic novel superhero style', label: '💥 קומיקס / גרפיק נובל', desc: 'סגנון קומיקס מערבי' },
  { value: 'watercolor artistic painting portrait', label: '🎨 ציור בצבעי מים', desc: 'ציור אמנותי באקוורל' },
  { value: 'pop art andy warhol bold colors', label: '🟡 פופ ארט', desc: 'צבעים נועזים בסגנון וורהול' },
];

export default function AvatarsManagePage() {
  const [avatars, setAvatars] = useState<SavedAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [style, setStyle] = useState('professional headshot');
  const [generating, setGenerating] = useState(false);

  // Load avatars from DB
  useEffect(() => {
    loadAvatars();
  }, []);

  const loadAvatars = async () => {
    try {
      const list = await avatarDbService.list();
      setAvatars(list);
    } catch (e) {
      console.error('Failed to load avatars:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('יש להזין שם לאווטאר'); return; }
    if (photos.length === 0) { toast.error('יש להעלות לפחות תמונה אחת'); return; }
    setGenerating(true);
    try {
      const result = await avatarGenService.generate(photos, style);
      if (!result.imageUrl) { toast.error('לא התקבלה תמונה'); return; }
      
      // Save to DB
      const saved = await avatarDbService.save(name, result.imageUrl, style, photos);
      setAvatars(prev => [saved, ...prev]);
      setCreating(false);
      setName('');
      setPhotos([]);
      setStyle('professional headshot');
      toast.success('האווטאר נוצר ונשמר בהצלחה!');
    } catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await avatarDbService.remove(id);
      setAvatars(prev => prev.filter(a => a.id !== id));
      toast.success('האווטאר הוסר');
    } catch (e: any) { toast.error(e.message); }
  };

  const selectedStyleObj = STYLE_OPTIONS.find(s => s.value === style);

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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {STYLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setStyle(opt.value)}
                    className={`text-right p-2.5 rounded-lg border text-xs transition-all ${
                      style === opt.value
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border bg-muted/30 hover:bg-muted/60'
                    }`}
                  >
                    <div className="font-semibold mb-0.5">{opt.label}</div>
                    <div className="text-muted-foreground text-[10px] leading-tight">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">תמונות רפרנס ({photos.length}/{MAX_PHOTOS})</label>
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
              {photos.length < MAX_PHOTOS && (
                <FileUploadZone accept="image/*" multiple label="העלה תמונות" hint={`JPG, PNG — עד ${MAX_PHOTOS} תמונות, אפשר לבחור כמה בבת אחת`}
                  onUploaded={url => { if (url && photos.length < MAX_PHOTOS) setPhotos(prev => prev.length < MAX_PHOTOS ? [...prev, url] : prev); }}
                  onMultipleUploaded={urls => {
                    setPhotos(prev => {
                      const remaining = MAX_PHOTOS - prev.length;
                      return [...prev, ...urls.slice(0, remaining)];
                    });
                  }}
                />
              )}
            </div>
            {selectedStyleObj && (
              <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedStyleObj.label}</span> — {selectedStyleObj.desc}
                {selectedStyleObj.value.includes('cartoon') || selectedStyleObj.value.includes('disney') || selectedStyleObj.value.includes('anime') || selectedStyleObj.value.includes('comic') || selectedStyleObj.value.includes('watercolor') || selectedStyleObj.value.includes('pop art')
                  ? <span className="block mt-1 text-primary">✨ סגנון אמנותי — המערכת תיצור דמות מצוירת על בסיס התמונות שלך</span>
                  : <span className="block mt-1">📷 סגנון ריאליסטי — מתאים לאווטארים מדברים בסטודיו</span>
                }
              </div>
            )}
            <button onClick={handleCreate} disabled={generating}
              className="w-full gradient-gold text-primary-foreground py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCircle className="w-4 h-4" />}
              {generating ? 'מייצר אווטאר...' : 'צור אווטאר'}
            </button>
          </div>
        )}

        {/* Avatars grid */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin opacity-30" />
            <p className="text-sm">טוען אווטארים...</p>
          </div>
        ) : avatars.length === 0 && !creating ? (
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
                  <img src={avatar.image_url} alt={avatar.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm">{avatar.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {STYLE_OPTIONS.find(s => s.value === avatar.style)?.label || avatar.style}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(avatar.created_at).toLocaleDateString('he-IL')}</p>
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
