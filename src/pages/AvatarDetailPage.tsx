import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockAvatars, mockProjects } from '@/data/mockData';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Edit, Copy, Archive, Video, Image, Settings, Plug, Clock } from 'lucide-react';

const tabs = [
  { id: 'general', label: 'פרטים כלליים', icon: Settings },
  { id: 'media', label: 'קבצי מדיה', icon: Image },
  { id: 'providers', label: 'מיפוי ספקים', icon: Plug },
  { id: 'history', label: 'היסטוריית שימוש', icon: Clock },
];

export default function AvatarDetailPage() {
  const { id } = useParams();
  const avatar = mockAvatars.find(a => a.id === id);
  const [activeTab, setActiveTab] = useState('general');

  if (!avatar) return <AppLayout><div className="text-center py-20"><p className="text-lg text-muted-foreground">האווטאר לא נמצא</p></div></AppLayout>;

  const avatarProjects = mockProjects.filter(p => p.avatarId === avatar.id);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl gradient-gold flex items-center justify-center text-3xl font-bold text-primary-foreground">
              {avatar.name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-rubik font-bold flex items-center gap-3">
                {avatar.name}
                <StatusBadge status={avatar.status} size="md" />
              </h1>
              <p className="text-muted-foreground mt-1">{avatar.description}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>{avatar.role}</span>•<span>{avatar.language}</span>•<span>נוצר ב-{avatar.createdAt}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted"><Edit className="w-4 h-4" /> עריכה</button>
            <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted"><Copy className="w-4 h-4" /> שכפול</button>
            <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted"><Archive className="w-4 h-4" /> ארכוב</button>
            <Link to="/create-video" className="flex items-center gap-1.5 gradient-gold text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold">
              <Video className="w-4 h-4" /> יצירת סרטון
            </Link>
          </div>
        </div>

        {/* Quality Score */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">ציון מוכנות</span>
            <span className="text-2xl font-rubik font-bold text-primary">{avatar.qualityScore}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div className="bg-primary rounded-full h-3 transition-all" style={{ width: `${avatar.qualityScore}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{avatar.images.length} תמונות</span>
            <span>{avatar.videos.length} סרטוני רפרנס</span>
            <span>{avatar.providerMappings.length} ספקים מחוברים</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['סגנון דיבור', avatar.speakingStyle], ['טון דיבור', avatar.tone],
              ['הערות', avatar.notes], ['תגיות', avatar.tags.join(', ')],
            ].map(([label, value]) => (
              <div key={label as string} className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-sm font-medium">{value || '—'}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-4">
            <h3 className="font-semibold">תמונות ({avatar.images.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {avatar.images.map(img => (
                <div key={img.id} className="bg-card border border-border rounded-lg p-3 text-center">
                  <div className="w-full h-24 bg-muted rounded-lg mb-2 flex items-center justify-center">
                    <Image className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-medium">{img.name}</p>
                  <p className="text-[10px] text-muted-foreground">{img.angle}</p>
                </div>
              ))}
            </div>
            <h3 className="font-semibold mt-6">סרטוני רפרנס ({avatar.videos.length})</h3>
            {avatar.videos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {avatar.videos.map(vid => (
                  <div key={vid.id} className="bg-card border border-border rounded-lg p-3 text-center">
                    <div className="w-full h-24 bg-muted rounded-lg mb-2 flex items-center justify-center">
                      <Video className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-medium">{vid.name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">אין סרטוני רפרנס עדיין</p>
            )}
          </div>
        )}

        {activeTab === 'providers' && (
          <div className="space-y-3">
            {avatar.providerMappings.length > 0 ? avatar.providerMappings.map(pm => (
              <div key={pm.providerId} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{pm.providerName}</p>
                  <p className="text-xs text-muted-foreground">מזהה: {pm.externalAvatarId}</p>
                </div>
                <div className="text-left">
                  <StatusBadge status={pm.status} />
                  <p className="text-[10px] text-muted-foreground mt-1">סנכרון אחרון: {pm.lastSync}</p>
                </div>
              </div>
            )) : (
              <div className="text-center py-10 bg-card border border-border rounded-xl">
                <Plug className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">אין ספקים מחוברים לאווטאר זה</p>
                <p className="text-xs text-muted-foreground mt-1">ניתן לחבר ספקים דרך עמוד חיבורי API</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {avatarProjects.length > 0 ? avatarProjects.map(p => (
              <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.videoType} • {p.createdAt}</p>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            )) : (
              <div className="text-center py-10 bg-card border border-border rounded-xl">
                <p className="text-sm text-muted-foreground">אין פרויקטים עם אווטאר זה</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
