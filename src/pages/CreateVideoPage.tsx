import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockAvatars } from '@/data/mockData';
import { VideoType } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, Copy, GripVertical, Loader2 } from 'lucide-react';
import { projectService } from '@/services/projectService';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';

const steps = ['בחירת אווטאר', 'סוג סרטון', 'תוכן', 'בונה סצנות', 'הגדרות מתקדמות', 'סקירה'];
const videoTypes: { type: VideoType; desc: string }[] = [
  { type: 'אווטאר מדבר', desc: 'אווטאר מדבר ישירות למצלמה' },
  { type: 'פרומפט חופשי', desc: 'סרטון מפרומפט טקסט חופשי' },
  { type: 'מוצר', desc: 'סרטון הצגת מוצר' },
  { type: 'UGC', desc: 'סרטון בסגנון תוכן גולשים' },
  { type: 'מכירה', desc: 'סרטון מכירה ישיר' },
  { type: 'תוכן אישי', desc: 'תוכן אישי של בעל עסק' },
  { type: 'הדרכה', desc: 'סרטון הדרכה קצר' },
  { type: 'עדות לקוח', desc: 'עדות של לקוח מרוצה' },
  { type: 'רילס', desc: 'סרטון קצר לרשתות חברתיות' },
  { type: 'תסריט', desc: 'סרטון מתסריט מלא' },
];
const promptExamples = [
  'אני רוצה שהדמות תרחף באוויר בזמן שהיא מסבירה על המוצר',
  'אני רוצה סרטון מכירה עם אנרגיה גבוהה וכותרות חזקות',
  'אני רוצה סרטון יוקרתי, רגוע, אמין ומשכנע',
  'אני רוצה שהאווטאר ידבר למצלמה ויצביע על המוצר',
  'אני רוצה סרטון שנראה מתאים לאינסטגרם רילס',
  'אני רוצה מסר בעברית שנשמע טבעי ומוכר',
];

export default function CreateVideoPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [selectedType, setSelectedType] = useState<VideoType | ''>('');
  const [content, setContent] = useState({
    projectName: '', whatToSay: '', description: '', visualDescription: '',
    productDescription: '', targetAudience: '', painPoint: '', solution: '',
    cta: '', speakingStyle: '', mood: '', keywords: '',
  });
  const [scenes, setScenes] = useState([
    { id: '1', title: 'פתיח', text: '', visual: '', duration: 3, shotType: 'קלוז אפ' },
    { id: '2', title: 'גוף', text: '', visual: '', duration: 8, shotType: 'בינוני' },
    { id: '3', title: 'סיום', text: '', visual: '', duration: 4, shotType: 'קלוז אפ' },
  ]);
  const [settings, setSettings] = useState({
    aspectRatio: '9:16', videoLength: 30, voiceType: 'נשי - חם', energyLevel: 'בינוני',
    subtitleStyle: 'מודרני', music: true, musicStyle: 'לאונג׳', logo: false,
    variationsCount: 1, preferredProvider: '',
  });

  const avatar = mockAvatars.find(a => a.id === selectedAvatar);

  const handleCreate = async (asDraft = false) => {
    setSaving(true);
    try {
      const project = await projectService.create({
        name: content.projectName || 'פרויקט ללא שם',
        avatar_id: selectedAvatar || null,
        avatar_name: avatar?.name || null,
        video_type: selectedType || 'פרומפט חופשי',
        status: asDraft ? 'טיוטה' : 'ממתין',
        aspect_ratio: settings.aspectRatio,
        content: {
          whatToSay: content.whatToSay,
          description: content.description,
          visualDescription: content.visualDescription,
          productDescription: content.productDescription,
          targetAudience: content.targetAudience,
          painPoint: content.painPoint,
          solution: content.solution,
          cta: content.cta,
          speakingStyle: content.speakingStyle,
          mood: content.mood,
          keywords: content.keywords ? content.keywords.split(',').map(k => k.trim()) : [],
        },
        scenes: scenes.map((s, i) => ({
          id: s.id,
          order: i,
          title: s.title,
          spokenText: s.text,
          visualDescription: s.visual,
          duration: s.duration,
          shotType: s.shotType,
        })),
        settings: {
          videoLength: settings.videoLength,
          voiceType: settings.voiceType,
          energyLevel: settings.energyLevel,
          subtitleStyle: settings.subtitleStyle,
          music: settings.music,
          musicStyle: settings.musicStyle,
          logo: settings.logo,
          variationsCount: settings.variationsCount,
          preferredProvider: settings.preferredProvider,
        },
        script: content.whatToSay || null,
        tags: [],
      });
      
      toast.success(asDraft ? 'נשמר כטיוטה!' : 'הפרויקט נוצר בהצלחה!');
      navigate(`/projects/${project.id}`);
    } catch (e: any) {
      toast.error(e.message || 'שגיאה ביצירת הפרויקט');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-rubik font-bold">יצירת סרטון חדש</h1>

        {/* Stepper */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setStep(i)}
                className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  i === step ? 'bg-primary text-primary-foreground' :
                  i < step ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                {i < step ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
                {s}
              </button>
              {i < steps.length - 1 && <div className="w-6 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-card border border-border rounded-xl p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-rubik font-semibold text-lg">בחרו אווטאר</h2>
              {mockAvatars.filter(a => a.status === 'מוכן').length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">אין אווטארים מוכנים. ניתן לדלג על שלב זה.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {mockAvatars.filter(a => a.status === 'מוכן').map(a => (
                    <button key={a.id} onClick={() => setSelectedAvatar(a.id)}
                      className={cn('p-4 rounded-xl border text-right transition-all',
                        selectedAvatar === a.id ? 'border-primary bg-primary/5 shadow-gold' : 'border-border hover:border-primary/30')}>
                      <div className="w-12 h-12 rounded-full gradient-gold flex items-center justify-center text-lg font-bold text-primary-foreground mb-2">
                        {a.name[0]}
                      </div>
                      <p className="font-medium text-sm">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.role} • {a.qualityScore}% מוכנות</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-rubik font-semibold text-lg">בחרו סוג סרטון</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {videoTypes.map(vt => (
                  <button key={vt.type} onClick={() => setSelectedType(vt.type)}
                    className={cn('p-4 rounded-xl border text-right transition-all',
                      selectedType === vt.type ? 'border-primary bg-primary/5 shadow-gold' : 'border-border hover:border-primary/30')}>
                    <p className="font-medium text-sm">{vt.type}</p>
                    <p className="text-xs text-muted-foreground mt-1">{vt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-rubik font-semibold text-lg">תוכן הסרטון</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">שם הפרויקט</label>
                  <input value={content.projectName} onChange={e => setContent(c => ({...c, projectName: e.target.value}))}
                    placeholder="סרטון השקה - מוצר חדש" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium">מה האווטאר אומר</label>
                    <VoiceDictationButton onResult={(text) => setContent(c => ({...c, whatToSay: c.whatToSay ? c.whatToSay + ' ' + text : text}))} />
                  </div>
                  <textarea value={content.whatToSay} onChange={e => setContent(c => ({...c, whatToSay: e.target.value}))}
                    rows={3} placeholder="כתבו כאן את הטקסט שהאווטאר יגיד..." className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium">תיאור הסרטון</label>
                    <VoiceDictationButton onResult={(text) => setContent(c => ({...c, description: c.description ? c.description + ' ' + text : text}))} />
                  </div>
                  <textarea value={content.description} onChange={e => setContent(c => ({...c, description: e.target.value}))}
                    rows={2} placeholder="תארו מה צריך לקרות בסרטון..." className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                </div>
                {[
                  ['תיאור המוצר', 'productDescription', 'מהו המוצר או השירות?'],
                  ['קהל יעד', 'targetAudience', 'למי הסרטון מיועד?'],
                  ['כאב הלקוח', 'painPoint', 'מה הבעיה של הלקוח?'],
                  ['פתרון', 'solution', 'איך אתם פותרים את הבעיה?'],
                  ['קריאה לפעולה', 'cta', 'מה אתם רוצים שהצופה יעשה?'],
                  ['אווירה', 'mood', 'יוקרתי, אנרגטי, רגוע...'],
                ].map(([label, key, placeholder]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium mb-1">{label}</label>
                    <input value={(content as any)[key]} onChange={e => setContent(c => ({...c, [key]: e.target.value}))}
                      placeholder={placeholder} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                ))}
              </div>
              <div className="bg-muted/30 rounded-lg p-4 mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">💡 רעיונות לפרומפט:</p>
                <div className="space-y-1">
                  {promptExamples.map((ex, i) => (
                    <p key={i} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      onClick={() => setContent(c => ({...c, description: ex}))}>• {ex}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-rubik font-semibold text-lg">בונה סצנות</h2>
                <button onClick={() => setScenes(s => [...s, { id: String(Date.now()), title: `סצנה ${s.length + 1}`, text: '', visual: '', duration: 5, shotType: 'בינוני' }])}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium">
                  <Plus className="w-3 h-3" /> הוסף סצנה
                </button>
              </div>
              {scenes.map((scene, i) => (
                <div key={scene.id} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">סצנה {i + 1}</span>
                      <input value={scene.title} onChange={e => { const s = [...scenes]; s[i].title = e.target.value; setScenes(s); }}
                        className="bg-transparent text-sm font-medium focus:outline-none" />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setScenes(s => [...s, { ...scene, id: String(Date.now()) }])} className="p-1 hover:bg-muted rounded"><Copy className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      {scenes.length > 1 && <button onClick={() => setScenes(s => s.filter((_, j) => j !== i))} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">טקסט שנאמר</label>
                        <VoiceDictationButton onResult={(text) => { const s = [...scenes]; s[i].text = s[i].text ? s[i].text + ' ' + text : text; setScenes(s); }} />
                      </div>
                      <textarea value={scene.text} onChange={e => { const s = [...scenes]; s[i].text = e.target.value; setScenes(s); }}
                        rows={2} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">תיאור חזותי</label>
                      <textarea value={scene.visual} onChange={e => { const s = [...scenes]; s[i].visual = e.target.value; setScenes(s); }}
                        rows={2} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none mt-1" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div><label className="text-xs text-muted-foreground">משך (שניות)</label>
                      <input type="number" value={scene.duration} onChange={e => { const s = [...scenes]; s[i].duration = +e.target.value; setScenes(s); }}
                        className="w-20 bg-muted/50 border border-border rounded-lg px-2 py-1 text-sm mt-1" />
                    </div>
                    <div><label className="text-xs text-muted-foreground">סוג שוט</label>
                      <select value={scene.shotType} onChange={e => { const s = [...scenes]; s[i].shotType = e.target.value; setScenes(s); }}
                        className="bg-muted/50 border border-border rounded-lg px-2 py-1 text-sm mt-1">
                        <option>קלוז אפ</option><option>בינוני</option><option>רחב</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-rubik font-semibold text-lg">הגדרות מתקדמות</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">יחס מסך</label>
                  <div className="flex gap-2 mt-1">
                    {['9:16', '1:1', '16:9'].map(r => (
                      <button key={r} onClick={() => setSettings(s => ({...s, aspectRatio: r}))}
                        className={cn('px-3 py-1.5 rounded-lg text-sm border', settings.aspectRatio === r ? 'bg-primary text-primary-foreground border-primary' : 'border-border')}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">אורך (שניות)</label>
                  <input type="number" value={settings.videoLength} onChange={e => setSettings(s => ({...s, videoLength: +e.target.value}))}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">סוג קול</label>
                  <select value={settings.voiceType} onChange={e => setSettings(s => ({...s, voiceType: e.target.value}))}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm mt-1">
                    <option>נשי - חם</option><option>נשי - מקצועי</option><option>גברי - צעיר</option><option>גברי - בוגר</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">רמת אנרגיה</label>
                  <select value={settings.energyLevel} onChange={e => setSettings(s => ({...s, energyLevel: e.target.value}))}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm mt-1">
                    <option>נמוך</option><option>בינוני</option><option>גבוה</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">סגנון כתוביות</label>
                  <select value={settings.subtitleStyle} onChange={e => setSettings(s => ({...s, subtitleStyle: e.target.value}))}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm mt-1">
                    <option>מודרני</option><option>בולט</option><option>מינימלי</option><option>דינמי</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">מספר וריאציות</label>
                  <input type="number" value={settings.variationsCount} onChange={e => setSettings(s => ({...s, variationsCount: +e.target.value}))}
                    min={1} max={5} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm mt-1" />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input type="checkbox" checked={settings.music} onChange={e => setSettings(s => ({...s, music: e.target.checked}))} className="rounded" />
                  <label className="text-sm">הוסף מוזיקת רקע</label>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input type="checkbox" checked={settings.logo} onChange={e => setSettings(s => ({...s, logo: e.target.checked}))} className="rounded" />
                  <label className="text-sm">הוסף לוגו</label>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="font-rubik font-semibold text-lg">סקירה לפני יצירה</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">אווטאר</p>
                  <p className="font-medium">{avatar?.name || 'לא נבחר'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">סוג סרטון</p>
                  <p className="font-medium">{selectedType || 'לא נבחר'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">שם פרויקט</p>
                  <p className="font-medium">{content.projectName || '—'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">הגדרות</p>
                  <p className="font-medium">{settings.aspectRatio} • {settings.videoLength} שניות • {settings.variationsCount} וריאציות</p>
                </div>
              </div>
              {content.whatToSay && (
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">סקריפט</p>
                  <p className="text-sm">{content.whatToSay}</p>
                </div>
              )}
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">סצנות ({scenes.length})</p>
                {scenes.map((s, i) => (
                  <p key={s.id} className="text-sm">סצנה {i + 1}: {s.title} ({s.duration} שניות)</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2.5 border border-border rounded-lg text-sm disabled:opacity-30 hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4" /> הקודם
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 gradient-gold text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold">
              הבא <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => handleCreate(true)} disabled={saving}
                className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שמור כטיוטה'}
              </button>
              <button onClick={() => handleCreate(false)} disabled={saving}
                className="gradient-gold text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold animate-pulse-gold disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                צור סרטון 🎬
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
