import { AppLayout } from '@/components/layout/AppLayout';
import { GuidedTour } from '@/components/GuidedTour';
import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Building2, Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { brandService, type Brand } from '@/services/creativeService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { StudioActionCards, type StudioAction } from '@/components/studio/StudioActionCards';
import { WizardFlow } from '@/components/studio/WizardFlow';

export default function CreativeStudioPage() {
  // Selected action (null = show action cards)
  const [selectedAction, setSelectedAction] = useState<StudioAction | null>(null);

  // Brand management
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [newBrand, setNewBrand] = useState<Partial<Brand>>({ name: '', tone: '', targetAudience: '', industry: '', colors: [], departments: [] });
  const [newDepartment, setNewDepartment] = useState('');

  useEffect(() => { setBrands(brandService.getAll()); }, []);

  const activeBrand = brands.find(b => b.id === activeBrandId);

  const buildPrompt = (basePrompt: string) => {
    if (!activeBrand) return basePrompt;
    return `${basePrompt}\n\nהנחיות מותג: ${activeBrand.name}. טון: ${activeBrand.tone}. קהל: ${activeBrand.targetAudience}. תחום: ${activeBrand.industry}.`;
  };

  const handleAddBrand = () => {
    if (!newBrand.name?.trim()) { toast.error('יש להזין שם'); return; }
    const brand: Brand = {
      id: crypto.randomUUID(),
      name: newBrand.name!,
      tone: newBrand.tone || '',
      targetAudience: newBrand.targetAudience || '',
      industry: newBrand.industry || '',
      colors: newBrand.colors || [],
      departments: newBrand.departments || [],
    };
    const updated = brandService.add(brand);
    setBrands(updated);
    setActiveBrandId(brand.id);
    setNewBrand({ name: '', tone: '', targetAudience: '', industry: '', colors: [], departments: [] });
    setBrandDialogOpen(false);
    toast.success(`"${brand.name}" נוסף`);
  };

  const handleAddDepartment = () => {
    if (!newDepartment.trim()) return;
    setNewBrand(prev => ({ ...prev, departments: [...(prev.departments || []), newDepartment] }));
    setNewDepartment('');
  };

  const handleRemoveBrand = (id: string) => {
    const updated = brandService.remove(id);
    setBrands(updated);
    if (activeBrandId === id) setActiveBrandId(null);
    toast.success('המותג הוסר');
  };

  return (
    <AppLayout>
      <GuidedTour />
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-rubik font-bold flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-primary" />
            סטודיו קריאייטיב
          </h1>
          <p className="text-muted-foreground text-sm mt-1">בחר פעולה ואנחה אותך צעד אחר צעד</p>
        </div>

        {/* Brand Selector */}
        <div data-tour="brand-selector" className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> חברה / מותג
            </h2>
            <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
              <DialogTrigger asChild>
                <button className="text-xs px-3 py-1.5 gradient-gold text-primary-foreground rounded-lg font-semibold flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> הוסף חברה
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="font-rubik">הוסף חברה / מותג</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  {[
                    { key: 'name', label: 'שם החברה', placeholder: 'למשל: המרכז הישראלי לחברות' },
                    { key: 'industry', label: 'תחום', placeholder: 'למשל: יבוא, מכירת עסקים, עמותה' },
                    { key: 'tone', label: 'טון דיבור', placeholder: 'למשל: מקצועי, חם, רשמי' },
                    { key: 'targetAudience', label: 'קהל יעד', placeholder: 'למשל: בעלי עסקים, משקיעים' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
                      <input
                        value={(newBrand as any)[f.key] || ''}
                        onChange={e => setNewBrand(prev => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  ))}
                  {/* Departments */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">מחלקות / תתי-חברות</label>
                    <div className="flex gap-2">
                      <input
                        value={newDepartment}
                        onChange={e => setNewDepartment(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddDepartment())}
                        placeholder="למשל: מכירת עסקים"
                        className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <button onClick={handleAddDepartment} className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">+</button>
                    </div>
                    {(newBrand.departments || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {newBrand.departments!.map((d, i) => (
                          <span key={i} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-md flex items-center gap-1">
                            {d}
                            <button onClick={() => setNewBrand(prev => ({ ...prev, departments: prev.departments?.filter((_, idx) => idx !== i) }))} className="hover:text-destructive">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={handleAddBrand} className="w-full gradient-gold text-primary-foreground py-2.5 rounded-lg font-semibold text-sm">
                    שמור חברה
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveBrandId(null)}
              className={cn(
                'px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                !activeBrandId ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30'
              )}
            >
              כללי
            </button>
            {brands.map(b => (
              <div key={b.id} className="relative group">
                <button
                  onClick={() => setActiveBrandId(b.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                    activeBrandId === b.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30'
                  )}
                >
                  {b.name}
                </button>
                <button
                  onClick={() => handleRemoveBrand(b.id)}
                  className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
          {activeBrand && (
            <div className="mt-2 text-xs text-muted-foreground flex gap-3 flex-wrap">
              {activeBrand.industry && <span>📋 {activeBrand.industry}</span>}
              {activeBrand.tone && <span>🎯 {activeBrand.tone}</span>}
              {activeBrand.departments && activeBrand.departments.length > 0 && (
                <span>🏢 {activeBrand.departments.join(' • ')}</span>
              )}
            </div>
          )}
        </div>

        {/* Main content: Action cards OR Wizard */}
        {!selectedAction ? (
          <StudioActionCards onSelect={setSelectedAction} />
        ) : (
          <WizardFlow
            action={selectedAction}
            activeBrand={activeBrand}
            onBack={() => setSelectedAction(null)}
            buildPrompt={buildPrompt}
          />
        )}
      </div>
    </AppLayout>
  );
}
