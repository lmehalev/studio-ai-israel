import { AppLayout } from '@/components/layout/AppLayout';
import { useState, useEffect } from 'react';
import { UserCircle, Plus, Trash2, X, Loader2, Download, Sparkles } from 'lucide-react';
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
  const [baseAvatarId, setBaseAvatarId] = useState('');

  useEffect(() => {
    loadAvatars();
  }, []);

  useEffect(() => {
    setPhotos((prev) => {
      if (!baseAvatarId) return prev.slice(0, MAX_PHOTOS);
      const selectedBase = avatars.find((a) => a.id === baseAvatarId);
      if (!selectedBase) return prev.slice(0, MAX_PHOTOS);
      const baseRefs = [selectedBase.image_url, ...(selectedBase.source_photos ?? [])];
      const merged = Array.from(new Set([...baseRefs, ...prev])).slice(0, MAX_PHOTOS);
      return merged.filter((url) => !baseRefs.includes(url));
    });
  }, [baseAvatarId, avatars]);

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

  const selectedBaseAvatar = avatars.find((a) => a.id === baseAvatarId);
  const baseReferences = selectedBaseAvatar
    ? [selectedBaseAvatar.image_url, ...(selectedBaseAvatar.source_photos ?? [])]
    : [];
  const mergedReferencePreview = Array.from(new Set([...baseReferences, ...photos])).slice(0, MAX_PHOTOS);
  const remainingPhotoSlots = Math.max(0, MAX_PHOTOS - mergedReferencePreview.length);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('יש להזין שם לאווטאר');
      return;
    }

    if (mergedReferencePreview.length === 0) {
      toast.error('יש להעלות לפחות תמונה אחת או לבחור אווטאר קיים');
      return;
    }

    setGenerating(true);
    try {
      const result = await avatarGenService.generate(mergedReferencePreview, style, {
        baseAvatarUrl: selectedBaseAvatar?.image_url,
        strictIdentity: true,
      });

      if (!result.imageUrl) {
        toast.error('לא התקבלה תמונה');
        return;
      }

      const saved = await avatarDbService.save(name, result.imageUrl, style, mergedReferencePreview);
      setAvatars((prev) => [saved, ...prev]);
      setCreating(false);
      setName('');
      setPhotos([]);
      setStyle('professional headshot');
      setBaseAvatarId('');
      toast.success('האווטאר נוצר ונשמר בהצלחה!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await avatarDbService.remove(id);
      setAvatars((prev) => prev.filter((a) => a.id !== id));
      toast.success('האווטאר הוסר');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const startVariationFromAvatar = (avatar: SavedAvatar) => {
    setCreating(true);
    setBaseAvatarId(avatar.id);
    setName(`${avatar.name} - וריאציה`);
    setStyle('disney hand-drawn classic animation style');
    setPhotos([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedStyleObj = STYLE_OPTIONS.find((s) => s.value === style);

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

        {creating && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">אווטאר חדש</h3>
              <button
                onClick={() => {
                  setCreating(false);
                  setBaseAvatarId('');
                  setPhotos([]);
                }}
                className="p-1 hover:bg-muted rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">שם האווטאר</label>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="למשל: דוברת ראשית"
                  className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <VoiceDictationButton onResult={(text) => setName((prev) => (prev ? `${prev} ${text}` : text))} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">שכפול מאווטאר קיים (אופציונלי)</label>
              <select
                value={baseAvatarId}
                onChange={(e) => setBaseAvatarId(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">ללא שכפול - אעלה תמונות ידנית</option>
                {avatars.map((avatar) => (
                  <option key={avatar.id} value={avatar.id}>
                    {avatar.name}
                  </option>
                ))}
              </select>
              {selectedBaseAvatar && (
                <p className="text-xs text-primary mt-2">
                  🔁 בסיס נבחר: {selectedBaseAvatar.name} — המערכת תשתמש אוטומטית בתמונות המקור שלו לדיוק גבוה.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">סגנון</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {STYLE_OPTIONS.map((opt) => (
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                תמונות רפרנס כולל ({mergedReferencePreview.length}/{MAX_PHOTOS})
              </label>

              {selectedBaseAvatar && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-primary/40">
                    <img src={selectedBaseAvatar.image_url} alt={selectedBaseAvatar.name} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 inset-x-0 text-[9px] text-center bg-background/80 text-foreground py-0.5">
                      בסיס
                    </div>
                  </div>
                </div>
              )}

              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {photos.map((url, i) => (
                    <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
                      <img src={url} alt={`ref ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {remainingPhotoSlots > 0 && (
                <FileUploadZone
                  accept="image/*"
                  multiple
                  label="העלה תמונות"
                  hint={`JPG, PNG — אפשר להעלות כמה בבת אחת. נשארו ${remainingPhotoSlots} מקומות`}
                  onUploaded={(url) => {
                    if (!url) return;
                    setPhotos((prev) => {
                      const merged = Array.from(new Set([...baseReferences, ...prev, url])).slice(0, MAX_PHOTOS);
                      return merged.filter((item) => !baseReferences.includes(item));
                    });
                  }}
                  onMultipleUploaded={(urls) => {
                    setPhotos((prev) => {
                      const merged = Array.from(new Set([...baseReferences, ...prev, ...urls])).slice(0, MAX_PHOTOS);
                      return merged.filter((item) => !baseReferences.includes(item));
                    });
                  }}
                />
              )}

              {remainingPhotoSlots === 0 && (
                <div className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                  הגעת למקסימום {MAX_PHOTOS} תמונות רפרנס.
                </div>
              )}
            </div>

            {selectedStyleObj && (
              <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedStyleObj.label}</span> — {selectedStyleObj.desc}
                {selectedStyleObj.value.includes('cartoon') ||
                selectedStyleObj.value.includes('disney') ||
                selectedStyleObj.value.includes('anime') ||
                selectedStyleObj.value.includes('comic') ||
                selectedStyleObj.value.includes('watercolor') ||
                selectedStyleObj.value.includes('pop art') ? (
                  <span className="block mt-1 text-primary">✨ סגנון אמנותי — תישמר זהות הפנים, וישתנה רק סגנון הרינדור</span>
                ) : (
                  <span className="block mt-1">📷 סגנון ריאליסטי — מתאים לאווטארים מדברים בסטודיו</span>
                )}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={generating}
              className="w-full gradient-gold text-primary-foreground py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCircle className="w-4 h-4" />}
              {generating ? 'מייצר אווטאר...' : 'צור אווטאר'}
            </button>
          </div>
        )}

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
            {avatars.map((avatar) => (
              <div key={avatar.id} className="bg-card border border-border rounded-xl overflow-hidden group relative">
                <div className="aspect-square">
                  <img src={avatar.image_url} alt={avatar.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm">{avatar.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {STYLE_OPTIONS.find((s) => s.value === avatar.style)?.label || avatar.style}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(avatar.created_at).toLocaleDateString('he-IL')}</p>
                </div>
                <div className="absolute top-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startVariationFromAvatar(avatar)}
                    className="w-7 h-7 bg-accent text-accent-foreground rounded-full flex items-center justify-center"
                    title="צור וריאציה"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(avatar.image_url);
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = `${avatar.name}-avatar.${avatar.image_url.includes('.png') ? 'png' : 'jpg'}`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(blobUrl);
                        toast.success('ההורדה החלה');
                      } catch {
                        window.open(avatar.image_url, '_blank');
                      }
                    }}
                    className="w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center"
                    title="הורד"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(avatar.id)}
                    className="w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                    title="מחק"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
