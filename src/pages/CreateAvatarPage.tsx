import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Upload, X, Plus } from 'lucide-react';
import { AvatarRole } from '@/types';
import { toast } from 'sonner';

const roles: AvatarRole[] = ['בעל עסק', 'יוצר תוכן', 'איש מכירות', 'מומחה', 'פרזנטור', 'משפיען', 'אחר'];

export default function CreateAvatarPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', description: '', language: 'עברית', role: '' as AvatarRole,
    speakingStyle: '', tone: '', notes: '', tags: [] as string[], tagInput: '',
    externalId: '', defaultProvider: '',
  });

  const addTag = () => {
    if (form.tagInput.trim() && !form.tags.includes(form.tagInput.trim())) {
      setForm(f => ({ ...f, tags: [...f.tags, f.tagInput.trim()], tagInput: '' }));
    }
  };

  const handleSave = () => {
    if (!form.name) { toast.error('נא למלא שם אווטאר'); return; }
    toast.success('האווטאר נוצר בהצלחה!');
    navigate('/avatars');
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-rubik font-bold">יצירת אווטאר חדש</h1>
          <p className="text-muted-foreground text-sm mt-1">מלאו את הפרטים ליצירת אווטאר חדש במערכת</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">שם האווטאר *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="לדוגמה: דנה כהן" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">שפה</label>
              <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option>עברית</option><option>אנגלית</option><option>ערבית</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">תיאור קצר</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="תארו את האווטאר בכמה מילים..."
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">תפקיד</label>
            <div className="flex flex-wrap gap-2">
              {roles.map(role => (
                <button key={role} onClick={() => setForm(f => ({ ...f, role }))}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.role === role ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50'}`}>
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">סגנון דיבור</label>
              <input value={form.speakingStyle} onChange={e => setForm(f => ({ ...f, speakingStyle: e.target.value }))}
                placeholder="מקצועי, לא פורמלי, חם..." className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">טון דיבור</label>
              <input value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))}
                placeholder="חם, אנרגטי, רגוע..." className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">הערות</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="הערות נוספות..."
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">תגיות</label>
            <div className="flex gap-2">
              <input value={form.tagInput} onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="הוסף תגית..." className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <button onClick={addTag} className="px-3 py-2 bg-muted border border-border rounded-lg text-sm hover:bg-muted/80">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                    {tag}
                    <button onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Media Upload */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-rubik font-semibold">העלאת חומרים</h2>
          <div className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-primary/50 transition-colors cursor-pointer">
            <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">גררו קבצים לכאן או לחצו להעלאה</p>
            <p className="text-xs text-muted-foreground mt-1">תמונות פנים מזוויות שונות, סרטוני רפרנס קצרים</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, MP4 • עד 50MB</p>
          </div>
        </div>

        {/* Future Provider Settings */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-rubik font-semibold">הגדרות ספק (עתידי)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">מזהה חיצוני אצל ספק</label>
              <input value={form.externalId} onChange={e => setForm(f => ({ ...f, externalId: e.target.value }))}
                placeholder="יוגדר בעתיד" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" disabled />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">ספק ברירת מחדל</label>
              <select disabled className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm opacity-50">
                <option>יוגדר בעתיד</option>
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={() => navigate('/avatars')} className="px-5 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
            ביטול
          </button>
          <button onClick={handleSave} className="gradient-gold text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
            צור אווטאר
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
