import { AppLayout } from '@/components/layout/AppLayout';
import { Settings, Plug, Palette, Shield, Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const connectedServices = [
  { name: 'Gemini (תמונות + טקסט)', status: 'connected', free: true },
  { name: 'ElevenLabs (דיבוב)', status: 'connected', free: false },
  { name: 'D-ID (אווטאר מדבר)', status: 'connected', free: false },
];

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-rubik font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" /> הגדרות
          </h1>
          <p className="text-muted-foreground text-sm mt-1">ניהול חיבורים, מותגים והגדרות מערכת</p>
        </div>

        <Tabs defaultValue="connections" dir="rtl">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="connections" className="flex items-center gap-2"><Plug className="w-4 h-4" /> חיבורים</TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2"><Shield className="w-4 h-4" /> מערכת</TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="mt-4 space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-rubik font-semibold mb-4">שירותים מחוברים</h2>
              <div className="space-y-3">
                {connectedServices.map(s => (
                  <div key={s.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${s.status === 'connected' ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {s.status === 'connected' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.free ? 'חינם (מובנה)' : 'מחובר'}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${s.status === 'connected' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {s.status === 'connected' ? 'פעיל' : 'לא מחובר'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="system" className="mt-4 space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="font-rubik font-semibold">הגדרות כלליות</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">שפת ברירת מחדל</label>
                  <select className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm">
                    <option>עברית</option>
                    <option>English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">יחס מסך ברירת מחדל</label>
                  <select className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm">
                    <option>9:16 (רילס / סטורי)</option>
                    <option>1:1 (מרובע)</option>
                    <option>16:9 (יוטיוב)</option>
                  </select>
                </div>
              </div>
              <button onClick={() => toast.success('ההגדרות נשמרו')} className="gradient-gold text-primary-foreground px-5 py-2 rounded-lg font-semibold text-sm">
                שמור הגדרות
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
