import { AppLayout } from '@/components/layout/AppLayout';
import { Shield, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function SystemSettingsPage() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-rubik font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-primary" /> הגדרות מערכת</h1>
            <p className="text-muted-foreground text-sm mt-1">ניהול הגדרות כלליות ואדמיניסטרציה</p>
          </div>
          <button onClick={() => toast.success('ההגדרות נשמרו')} className="gradient-gold text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
            <Save className="w-4 h-4" /> שמור
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-rubik font-semibold">ברירות מחדל</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['שפה', 'עברית', ['עברית', 'אנגלית', 'ערבית']],
              ['יחס מסך', '9:16', ['9:16', '1:1', '16:9']],
              ['ספק ברירת מחדל', 'Video Provider A', ['Video Provider A', 'Video Provider B']],
              ['סגנון כתוביות', 'מודרני', ['מודרני', 'בולט', 'מינימלי']],
              ['אורך סרטון (שניות)', '30', []],
            ].map(([label, def, opts]) => (
              <div key={label as string}>
                <label className="block text-sm font-medium mb-1">{label as string}</label>
                {(opts as string[]).length > 0 ? (
                  <select defaultValue={def as string} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm">
                    {(opts as string[]).map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input defaultValue={def as string} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm" />
                )}
              </div>
            ))}
          </div>
        </div>

        {[
          { title: 'ניהול משתמשים', items: ['תפקידים ומשתמשים', 'צוותים ו-Workspaces', 'מעקב שימוש'] },
          { title: 'חיוב ותשלומים', items: ['תוכנית נוכחית: Pro', 'שימוש חודשי: 45/100 סרטונים', 'חידוש: 01/04/2024'] },
          { title: 'לוגים', items: ['יומן יצירות (12 רשומות)', 'יומן שגיאות (2 רשומות)', 'יומן Webhooks (5 רשומות)'] },
        ].map(section => (
          <div key={section.title} className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-rubik font-semibold mb-3">{section.title}</h2>
            <div className="space-y-2">
              {section.items.map(item => (
                <div key={item} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm">{item}</span>
                  <span className="text-xs text-muted-foreground">בקרוב →</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-rubik font-semibold mb-3">התראות מערכת</h2>
          <div className="space-y-2">
            {[
              { label: 'שלח התראה כשסרטון מוכן', checked: true },
              { label: 'שלח התראה על שגיאות', checked: true },
              { label: 'שלח סיכום שבועי', checked: false },
            ].map(n => (
              <label key={n.label} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer">
                <input type="checkbox" defaultChecked={n.checked} className="rounded" />
                <span className="text-sm">{n.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
