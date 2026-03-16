import { AppLayout } from '@/components/layout/AppLayout';
import { useState } from 'react';
import { FileText, Plus, Trash2, X, Copy, Wand2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';
import { promptEnhanceService } from '@/services/creativeService';

interface SavedScript {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

const STORAGE_KEY = 'studio-scripts';

function getScripts(): SavedScript[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveScriptsToStorage(scripts: SavedScript[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
}

export default function ScriptsManagePage() {
  const [scripts, setScripts] = useState<SavedScript[]>(getScripts());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSave = () => {
    if (!name.trim()) { toast.error('יש להזין שם לתסריט'); return; }
    if (!content.trim()) { toast.error('יש להזין תוכן'); return; }

    if (editingId) {
      const updated = scripts.map(s => s.id === editingId ? { ...s, name, content } : s);
      setScripts(updated);
      saveScriptsToStorage(updated);
      setEditingId(null);
      toast.success('התסריט עודכן');
    } else {
      const newScript: SavedScript = {
        id: crypto.randomUUID(),
        name,
        content,
        createdAt: new Date().toISOString(),
      };
      const updated = [...scripts, newScript];
      setScripts(updated);
      saveScriptsToStorage(updated);
      toast.success('התסריט נשמר!');
    }
    setCreating(false);
    setName('');
    setContent('');
  };

  const handleGenerate = async () => {
    if (!content.trim()) { toast.error('יש להזין תיאור'); return; }
    setGenerating(true);
    try {
      const data = await promptEnhanceService.enhance(content, 'script');
      setContent(data.enhanced || JSON.stringify(data, null, 2));
      toast.success('התסריט נוצר!');
    } catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  const handleDelete = (id: string) => {
    const updated = scripts.filter(s => s.id !== id);
    setScripts(updated);
    saveScriptsToStorage(updated);
    toast.success('התסריט הוסר');
  };

  const handleEdit = (script: SavedScript) => {
    setEditingId(script.id);
    setName(script.name);
    setContent(script.content);
    setCreating(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-rubik font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              תסריטים
            </h1>
            <p className="text-muted-foreground text-sm mt-1">כתוב ונהל תסריטים לשימוש בסרטונים</p>
          </div>
          <button
            onClick={() => { setCreating(true); setEditingId(null); setName(''); setContent(''); }}
            className="gradient-gold text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> תסריט חדש
          </button>
        </div>

        {creating && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editingId ? 'ערוך תסריט' : 'תסריט חדש'}</h3>
              <button onClick={() => { setCreating(false); setEditingId(null); }} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">שם התסריט</label>
              <div className="flex gap-2">
                <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.stopPropagation()}
                  placeholder="למשל: תסריט למוצר חדש" className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <VoiceDictationButton onResult={text => setName(prev => prev ? prev + ' ' + text : text)} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-muted-foreground">תוכן התסריט</label>
                <VoiceDictationButton onResult={text => setContent(prev => prev ? prev + ' ' + text : text)} />
              </div>
              <textarea value={content} onChange={e => setContent(e.target.value)} onKeyDown={e => e.stopPropagation()}
                placeholder="כתוב כאן את התסריט, או תאר את המוצר ולחץ 'צור עם AI'" rows={8} dir="rtl"
                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleGenerate} disabled={generating || !content.trim()}
                className="flex-1 px-4 py-2.5 border border-primary/30 bg-primary/5 text-primary rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-primary/10 disabled:opacity-50">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {generating ? 'כותב...' : 'צור עם AI'}
              </button>
              <button onClick={handleSave}
                className="flex-1 gradient-gold text-primary-foreground py-2.5 rounded-lg font-semibold text-sm">
                שמור תסריט
              </button>
            </div>
          </div>
        )}

        {scripts.length === 0 && !creating ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">אין תסריטים עדיין</p>
            <p className="text-sm mt-1">צור תסריט ראשון או ייצר אחד עם AI</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scripts.map(script => (
              <div key={script.id} className="bg-card border border-border rounded-xl p-4 group">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{script.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(script.createdAt).toLocaleDateString('he-IL')}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { navigator.clipboard.writeText(script.content); toast.success('הועתק'); }}
                      className="p-1.5 hover:bg-muted rounded-lg"><Copy className="w-4 h-4" /></button>
                    <button onClick={() => handleEdit(script)}
                      className="p-1.5 hover:bg-muted rounded-lg"><FileText className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(script.id)}
                      className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap" dir="rtl">{script.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
