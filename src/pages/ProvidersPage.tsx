import { AppLayout } from '@/components/layout/AppLayout';
import { mockProviders } from '@/data/mockData';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useState } from 'react';
import { Plug, Shield, CheckCircle, XCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const providerTypeLabels: Record<string, string> = {
  'אווטארים': '👤 ספק אווטארים', 'וידאו': '🎬 ספק וידאו', 'קול': '🎙️ ספק קול',
  'כתוביות': '📝 ספק כתוביות', 'אחסון': '💾 ספק אחסון', 'webhook': '🔗 Webhook',
};

export default function ProvidersPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = mockProviders.find(p => p.id === selectedId);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-rubik font-bold flex items-center gap-2"><Plug className="w-6 h-6 text-primary" /> חיבורי API וספקים</h1>
          <p className="text-muted-foreground text-sm mt-1">נהלו את כל הספקים החיצוניים במקום אחד</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockProviders.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className={cn('text-right bg-card border rounded-xl p-5 hover:border-primary/30 transition-all space-y-3',
                selectedId === p.id ? 'border-primary shadow-gold' : 'border-border')}>
              <div className="flex items-center justify-between">
                <span className="text-sm">{providerTypeLabels[p.type] || p.type}</span>
                <StatusBadge status={p.status} />
              </div>
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-xs text-muted-foreground">{p.description}</p>
              {p.isEnabled && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-bold text-success">{p.successRate}%</p><p className="text-[10px] text-muted-foreground">הצלחה</p></div>
                  <div><p className="text-lg font-bold">{p.avgResponseTime}s</p><p className="text-[10px] text-muted-foreground">זמן תגובה</p></div>
                  <div><p className="text-xs text-muted-foreground mt-1">עדיפות {p.priority}</p></div>
                </div>
              )}
            </button>
          ))}
        </div>

        {selected && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-rubik font-semibold flex items-center gap-2"><Settings className="w-5 h-5" /> הגדרות: {selected.name}</h2>
              <div className="flex gap-2">
                <button onClick={() => toast.info('בודק חיבור...')} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted">בדיקת חיבור</button>
                <button onClick={() => toast.success('נשמר בהצלחה')} className="px-3 py-1.5 gradient-gold text-primary-foreground rounded-lg text-xs font-semibold">שמור</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['API Key', selected.apiKey || ''], ['Base URL', selected.baseUrl],
                ['Create Endpoint', selected.createEndpoint], ['Status Endpoint', selected.statusEndpoint],
                ['Model Name', selected.modelName], ['Webhook URL', selected.webhookUrl],
                ['Timeout (ms)', String(selected.timeout)], ['Retry Policy', String(selected.retryPolicy)],
              ].map(([label, value]) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                  <input defaultValue={value} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked={selected.isEnabled} className="rounded" /> ספק פעיל
              </label>
              <div><label className="text-xs text-muted-foreground">עדיפות:</label> <input type="number" defaultValue={selected.priority} className="w-16 bg-muted/50 border border-border rounded px-2 py-1 text-sm mr-1" /></div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">{selected.notes || 'אין הערות'}</div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
