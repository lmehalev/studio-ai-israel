import { AppLayout } from '@/components/layout/AppLayout';
import { mockProjects } from '@/data/mockData';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Link } from 'react-router-dom';
import { PlayCircle, Download, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function OutputsPage() {
  const allOutputs = mockProjects.flatMap(p => p.outputs.map(o => ({ ...o, projectName: p.name })));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-rubik font-bold flex items-center gap-2"><PlayCircle className="w-6 h-6 text-primary" /> תוצאות</h1>
          <p className="text-muted-foreground text-sm mt-1">{allOutputs.length} תוצאות במערכת</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allOutputs.map(o => (
            <div key={o.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
              <div className="aspect-video bg-muted flex items-center justify-center">
                {o.videoUrl ? (
                  <video src={o.videoUrl} controls className="w-full h-full object-contain" />
                ) : o.thumbnailUrl ? (
                  <img src={o.thumbnailUrl} alt={o.name} className="w-full h-full object-cover" />
                ) : (
                  <PlayCircle className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{o.name}</h3>
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-xs text-muted-foreground">{o.description}</p>
                <p className="text-xs text-muted-foreground">{o.avatarName} • {o.aspectRatio} • {o.estimatedLength}</p>
                <p className="text-[10px] text-muted-foreground">{o.createdAt} • {o.provider}</p>
                <div className="flex gap-2 pt-2 border-t border-border">
                   <button onClick={() => toast.info('הורדה תתבצע בעתיד')} className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-border rounded-lg text-xs hover:bg-muted">
                    <Download className="w-3 h-3" /> {o.videoUrl ? 'הורד MP4' : 'הורד תמונה'}
                  </button>
                  <button className="p-1.5 border border-border rounded-lg hover:bg-muted"><Copy className="w-3.5 h-3.5 text-muted-foreground" /></button>
                  <button className="p-1.5 border border-border rounded-lg hover:bg-muted"><RefreshCw className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {allOutputs.length === 0 && (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <p className="text-lg text-muted-foreground">אין תוצאות עדיין</p>
            <Link to="/create-video" className="text-sm text-primary hover:underline mt-2 inline-block">צרו את הסרטון הראשון שלכם</Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
