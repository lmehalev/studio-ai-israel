import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockTemplates } from '@/data/mockData';
import { Search, Copy, Edit, Play } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const categories = ['הכל', ...new Set(mockTemplates.map(t => t.category))];

export default function TemplatesPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('הכל');

  const filtered = mockTemplates.filter(t => {
    if (search && !t.name.includes(search) && !t.description.includes(search)) return false;
    if (category !== 'הכל' && t.category !== category) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-rubik font-bold">ספריית תבניות</h1>
          <p className="text-muted-foreground text-sm mt-1">{mockTemplates.length} תבניות מוכנות לשימוש</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש תבנית..."
              className="w-full bg-card border border-border rounded-lg pr-10 pl-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  category === c ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:border-primary/30')}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <div key={t.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{t.name}</h3>
                <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{t.usageCount} שימושים</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.description}</p>
              <div className="text-xs space-y-1">
                <p><span className="text-muted-foreground">Hook:</span> {t.hook}</p>
                <p><span className="text-muted-foreground">CTA:</span> {t.cta}</p>
                <p><span className="text-muted-foreground">פורמט:</span> {t.recommendedFormat} • {t.recommendedLength}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {t.tags.map(tag => <span key={tag} className="px-2 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">{tag}</span>)}
              </div>
              <div className="flex gap-2 pt-2 border-t border-border">
                <button onClick={() => toast.success('התבנית נטענה')} className="flex-1 flex items-center justify-center gap-1 py-1.5 gradient-gold text-primary-foreground rounded-lg text-xs font-semibold">
                  <Play className="w-3 h-3" /> השתמש
                </button>
                <button className="p-1.5 border border-border rounded-lg hover:bg-muted"><Edit className="w-3.5 h-3.5 text-muted-foreground" /></button>
                <button className="p-1.5 border border-border rounded-lg hover:bg-muted"><Copy className="w-3.5 h-3.5 text-muted-foreground" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
