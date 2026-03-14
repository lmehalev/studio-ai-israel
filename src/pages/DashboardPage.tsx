import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockProjects, mockAvatars, mockTemplates, mockJobs, mockNotifications, mockActivityLogs } from '@/data/mockData';
import {
  Video, Users, FolderOpen, Zap, Plus, Upload, Plug, FileText,
  ArrowLeft, TrendingUp, Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadge';

const quickActions = [
  { label: 'יצירת אווטאר חדש', icon: Users, path: '/avatars/new', color: 'from-emerald-600/20 to-emerald-600/5' },
  { label: 'יצירת סרטון חדש', icon: Video, path: '/create-video', color: 'from-primary/20 to-primary/5' },
  { label: 'העלאת מדיה', icon: Upload, path: '/avatars/new', color: 'from-blue-600/20 to-blue-600/5' },
  { label: 'חיבור ספק API', icon: Plug, path: '/providers', color: 'from-purple-600/20 to-purple-600/5' },
  { label: 'ספריית תבניות', icon: FileText, path: '/templates', color: 'from-orange-600/20 to-orange-600/5' },
];

const contentIdeas = [
  'סרטון שבו הדמות מרחפת באוויר בזמן הצגת מוצר',
  'סרטון UGC קצר עם פתיח חד וקריאה לפעולה ישירה',
  'סרטון פרימיום למותג יוקרתי עם תאורת סטודיו',
  'סרטון עדות לקוח מרגשת עם מוזיקה אקוסטית',
  'סרטון מכירה עם CTA אגרסיבי ואנרגיה גבוהה',
];

export default function DashboardPage() {
  const activeJobs = mockJobs.filter(j => j.status === 'בעיבוד' || j.status === 'ממתין').length;
  const totalOutputs = mockProjects.reduce((sum, p) => sum + p.outputCount, 0);

  const kpis = [
    { label: 'פרויקטים', value: mockProjects.length, icon: FolderOpen, color: 'text-info' },
    { label: 'אווטארים', value: mockAvatars.length, icon: Users, color: 'text-success' },
    { label: 'סרטונים שנוצרו', value: totalOutputs, icon: Video, color: 'text-primary' },
    { label: 'משימות פעילות', value: activeJobs, icon: Zap, color: 'text-warning' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-rubik font-bold">שלום, ברוכים הבאים לסטודיו 👋</h1>
          <p className="text-muted-foreground mt-1">התחל ליצור סרטונים – הוסף אווטאר וצא לדרך</p>
        </motion.div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <p className="text-3xl font-rubik font-bold mt-1">{kpi.value}</p>
                </div>
                <div className={cn('w-12 h-12 rounded-xl bg-muted flex items-center justify-center', kpi.color)}>
                  <kpi.icon className="w-6 h-6" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-lg font-rubik font-semibold mb-3">פעולות מהירות</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {quickActions.map(action => (
                  <Link
                    key={action.label}
                    to={action.path}
                    className={cn(
                      'bg-gradient-to-b border border-border rounded-xl p-4 text-center hover:border-primary/30 transition-all hover:scale-[1.02]',
                      action.color
                    )}
                  >
                    <action.icon className="w-6 h-6 mx-auto mb-2 text-foreground" />
                    <span className="text-xs font-medium">{action.label}</span>
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
              {mockProjects.length > 0 ? (
                <div className="space-y-2">
                  {mockProjects.slice(0, 4).map(project => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="flex items-center justify-between bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <Video className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">{project.avatarName} • {project.videoType}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={project.status} />
                        <span className="text-xs text-muted-foreground">{project.createdAt}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">אין פרויקטים עדיין</p>
                  <Link to="/create-video" className="text-sm text-primary hover:underline mt-2 inline-block">צרו את הסרטון הראשון שלכם →</Link>
                </div>
              )}
            </div>

            {/* Recent Avatars */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-rubik font-semibold">האווטארים שלי</h2>
                <Link to="/avatars" className="text-sm text-primary hover:underline flex items-center gap-1">
                  הצג הכל <ArrowLeft className="w-3 h-3" />
                </Link>
              </div>
              {mockAvatars.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {mockAvatars.slice(0, 4).map(avatar => (
                    <Link
                      key={avatar.id}
                      to={`/avatars/${avatar.id}`}
                      className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors text-center"
                    >
                      <div className="w-14 h-14 rounded-full bg-muted gradient-gold mx-auto mb-2 flex items-center justify-center text-xl font-bold text-primary-foreground">
                        {avatar.name[0]}
                      </div>
                      <p className="text-sm font-medium">{avatar.name}</p>
                      <p className="text-xs text-muted-foreground">{avatar.role}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">אין אווטארים עדיין</p>
                  <Link to="/avatars/new" className="text-sm text-primary hover:underline mt-2 inline-block">צרו את האווטאר הראשון שלכם →</Link>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Content Ideas */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-rubik font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                רעיונות מהירים לתוכן
              </h3>
              <ul className="space-y-2">
                {contentIdeas.map((idea, i) => (
                  <li key={i} className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-2 rounded-lg hover:bg-muted/50">
                    💡 {idea}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recent Activity */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-rubik font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                פעילות אחרונה
              </h3>
              {mockActivityLogs.length > 0 ? (
                <ul className="space-y-3">
                  {mockActivityLogs.slice(0, 5).map(log => (
                    <li key={log.id} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm">{log.details}</p>
                        <p className="text-[10px] text-muted-foreground">{log.timestamp}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">אין פעילות עדיין</p>
              )}
            </div>

            {/* System Notifications */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-rubik font-semibold mb-3">התראות מערכת</h3>
              {mockNotifications.length > 0 ? (
                <ul className="space-y-2">
                  {mockNotifications.slice(0, 3).map(n => (
                    <li key={n.id} className={cn(
                      'p-2 rounded-lg text-sm',
                      n.type === 'error' && 'bg-destructive/10 text-destructive',
                      n.type === 'success' && 'bg-success/10 text-success',
                      n.type === 'info' && 'bg-info/10 text-info',
                      n.type === 'warning' && 'bg-warning/10 text-warning',
                    )}>
                      {n.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">אין התראות</p>
              )}
            </div>

            {/* Popular Templates */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-rubik font-semibold mb-3">תבניות תוכן</h3>
              <ul className="space-y-2">
                {mockTemplates.slice(0, 4).map(t => (
                  <Link key={t.id} to="/templates" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="text-sm">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.category}</span>
                  </Link>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
