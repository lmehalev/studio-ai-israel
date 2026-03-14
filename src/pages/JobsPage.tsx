import { AppLayout } from '@/components/layout/AppLayout';
import { mockJobs } from '@/data/mockData';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Zap, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function JobsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-rubik font-bold flex items-center gap-2"><Zap className="w-6 h-6 text-primary" /> משימות יצירה</h1>
          <p className="text-muted-foreground text-sm mt-1">{mockJobs.length} משימות במערכת</p>
        </div>

        <div className="space-y-3">
          {mockJobs.map(job => (
            <div key={job.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Link to={`/projects/${job.projectId}`} className="font-semibold hover:text-primary transition-colors">{job.projectName}</Link>
                  <p className="text-xs text-muted-foreground">{job.provider} • {job.createdAt}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={job.status} size="md" />
                  {job.status === 'נכשל' && (
                    <button onClick={() => toast.info('ניסיון חוזר...')} className="p-1.5 border border-border rounded-lg hover:bg-muted">
                      <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                  {(job.status === 'בעיבוד' || job.status === 'ממתין') && (
                    <button onClick={() => toast.info('המשימה בוטלה')} className="p-1.5 border border-border rounded-lg hover:bg-destructive/10">
                      <XCircle className="w-4 h-4 text-destructive" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">התקדמות</span>
                  <span className="font-medium">{job.progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className={`rounded-full h-2 transition-all ${job.status === 'הושלם' ? 'bg-success' : job.status === 'נכשל' ? 'bg-destructive' : 'bg-primary'}`}
                    style={{ width: `${job.progress}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>זמן משוער: {job.estimatedTime}</span>
                <span>עודכן: {job.updatedAt}</span>
              </div>

              {/* Logs */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">יומן:</p>
                {job.logs.map((log, i) => (
                  <p key={i} className="text-xs text-muted-foreground">• {log}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
