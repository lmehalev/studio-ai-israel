import { useState, useRef } from 'react';
import { Download, Upload, AlertTriangle, X, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { brandService } from '@/services/creativeService';
import { supabase } from '@/integrations/supabase/client';

/**
 * Domain migration banner: shown when brands table is empty but localStorage might have data on the old domain.
 */
export function DomainMigrationBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [showImport, setShowImport] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-3" dir="rtl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-sm">נראה שעברת דומיין</p>
          <p className="text-xs text-muted-foreground mt-1">
            אם יצרת חברות/מותגים בדומיין הישן (lovable.app), יש לייצא אותם שם ולייבא כאן.
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1 hover:bg-muted rounded-lg shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setShowImport(true)}
          className="px-4 py-2 bg-amber-500 text-primary-foreground rounded-lg text-sm font-semibold flex items-center gap-2"
        >
          <Upload className="w-4 h-4" /> ייבא נתונים (JSON)
        </button>
      </div>
      {showImport && <DataImporter onDone={() => { setShowImport(false); setDismissed(true); }} />}
    </div>
  );
}

/**
 * Export button: exports all brands + scripts to a JSON file
 */
export function DataExportButton() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await brandService.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studio-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`ייצוא הושלם: ${data.brands.length} חברות, ${data.scripts.length} תסריטים`);
    } catch (e: any) {
      toast.error('שגיאה בייצוא: ' + e.message);
    }
    setExporting(false);
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="px-4 py-2 border border-border rounded-lg text-sm flex items-center gap-2 hover:bg-muted disabled:opacity-50"
    >
      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      ייצוא נתונים (JSON)
    </button>
  );
}

/**
 * Data importer: reads a JSON file and imports brands + scripts to Supabase
 */
function DataImporter({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      let brandCount = 0;
      let scriptCount = 0;

      // Import brands
      if (data.brands && Array.isArray(data.brands)) {
        for (const b of data.brands) {
          const { error } = await supabase.from('brands').upsert({
            id: b.id,
            name: b.name,
            logo: b.logo || null,
            colors: b.colors || [],
            tone: b.tone || '',
            target_audience: b.targetAudience || b.target_audience || '',
            industry: b.industry || '',
            departments: b.departments || [],
          }, { onConflict: 'id' });
          if (!error) brandCount++;
        }
      }

      // Import scripts
      if (data.scripts && Array.isArray(data.scripts)) {
        for (const s of data.scripts) {
          const { error } = await supabase.from('scripts').upsert({
            id: s.id,
            name: s.name,
            content: s.content || '',
          }, { onConflict: 'id' });
          if (!error) scriptCount++;
        }
      }

      setResult(`יובאו בהצלחה: ${brandCount} חברות, ${scriptCount} תסריטים`);
      toast.success('הייבוא הושלם!');
      
      // Reload page after short delay to reflect changes
      setTimeout(() => { window.location.reload(); }, 1500);
    } catch (e: any) {
      toast.error('שגיאה בייבוא: ' + e.message);
      setResult('שגיאה: ' + e.message);
    }
    setImporting(false);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <p className="text-xs text-muted-foreground">
        בחר קובץ JSON שייצאת מהדומיין הקודם (lovable.app → הגדרות → ייצוא נתונים)
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        onChange={handleFile}
        className="text-sm"
        disabled={importing}
      />
      {importing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> מייבא...
        </div>
      )}
      {result && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="w-4 h-4" /> {result}
        </div>
      )}
      <button onClick={onDone} className="text-xs text-muted-foreground hover:underline">סגור</button>
    </div>
  );
}
