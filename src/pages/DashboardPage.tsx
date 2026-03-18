import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useState, useEffect } from 'react';
import {
  Sparkles, FolderOpen, Zap, ImageIcon, Mic, UserCircle, FileText,
  ArrowLeft, Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { projectService, type ProjectRow } from '@/services/projectService';

const quickActions = [
  { label: 'יצירת תמונה', icon: ImageIcon, path: '/creative-studio', color: 'from-primary/20 to-primary/5' },
  { label: 'אווטאר מדבר', icon: UserCircle, path: '/creative-studio', color: 'from-emerald-600/20 to-emerald-600/5' },
  { label: 'דיבוב בעברית', icon: Mic, path: '/creative-studio', color: 'from-blue-600/20 to-blue-600/5' },
  { label: 'כתיבת תסריט', icon: FileText, path: '/creative-studio', color: 'from-purple-600/20 to-purple-600/5' },
];

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectService.getAll()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeJobs = projects.filter(p => p.status === 'בעיבוד' || p.status === 'ממתין').length;

  const kpis = [
    { label: 'פרויקטים', value: projects.length, icon: FolderOpen, color: 'text-info' },
    { label: 'משימות פעילות', value: activeJobs, icon: Zap, color: 'text-warning' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-rubik font-bold">שלום, ברוכים הבאים 👋</h1>
          <p className="text-muted-foreground mt-1">מה תרצה ליצור היום?</p>
        </motion.div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-3xl font-rubik font-bold mt-1">{loading ? '—' : kpi.value}</p>
                </div>
                <div className={cn('w-12 h-12 rounded-xl bg-muted flex items-center justify-center', kpi.color)}>
                  <kpi.icon className="w-6 h-6" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions → Creative Studio */}
        <div>
          <h2 className="text-lg font-rubik font-semibold mb-3">התחל ליצור</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map(action => (
              <Link
                key={action.label}
                to={action.path}
                className={cn(
                  'bg-gradient-to-b border border-border rounded-xl p-5 text-center hover:border-primary/30 transition-all hover:scale-[1.02]',
                  action.color
                )}
              >
                <action.icon className="w-7 h-7 mx-auto mb-2 text-foreground" />
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-rubik font-semibold">פרויקטים אחרונים</h2>
            <Link to="/projects" className="text-sm text-primary hover:underline flex items-center gap-1">
              הצג הכל <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="text-center py-10">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            </div>
          ) : projects.length > 0 ? (
            <div className="space-y-2">
              {projects.slice(0, 5).map(project => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="flex items-center justify-between bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">{project.avatar_name || '—'} • {project.video_type}</p>
                  </div>
                  <StatusBadge status={project.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">אין פרויקטים עדיין</p>
              <Link to="/creative-studio" className="text-sm text-primary hover:underline mt-2 inline-block">צרו את הקריאייטיב הראשון →</Link>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
