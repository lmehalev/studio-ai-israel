import { ImageIcon, Subtitles, Video, Link2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StudioAction = 'image' | 'video_ai' | 'subtitles' | 'import_edit';

export interface ActionItem {
  id: StudioAction;
  label: string;
  desc: string;
  icon: typeof ImageIcon;
  color: string;
}

export const studioActions: ActionItem[] = [
  { id: 'image', label: 'צור תמונה', desc: 'יצירת תמונה שיווקית מתיאור טקסט', icon: ImageIcon, color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30' },
  { id: 'video_ai', label: 'וידאו AI', desc: 'צור סרטון מתמונה או טקסט', icon: Video, color: 'from-green-500/20 to-emerald-500/20 border-green-500/30' },
  { id: 'subtitles', label: 'כתוביות לסרטון', desc: 'תמלול אוטומטי + עריכת כתוביות', icon: Subtitles, color: 'from-teal-500/20 to-cyan-500/20 border-teal-500/30' },
  { id: 'import_edit', label: 'ייבוא ועריכה', desc: 'קישור לתמונה, סרטון או YouTube — חלץ וערוך', icon: Link2, color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30' },
];

interface StudioActionCardsProps {
  onSelect: (action: StudioAction) => void;
}

export function StudioActionCards({ onSelect }: StudioActionCardsProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2 py-4">
        <div className="w-14 h-14 mx-auto rounded-2xl gradient-gold flex items-center justify-center shadow-gold">
          <Sparkles className="w-7 h-7 text-primary-foreground" />
        </div>
        <h2 className="text-xl font-rubik font-bold">מה תרצה ליצור היום?</h2>
        <p className="text-sm text-muted-foreground">בחר פעולה ואנחה אותך צעד אחר צעד</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {studioActions.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onSelect(action.id)}
              className={cn(
                'group relative bg-gradient-to-br border rounded-xl p-4 text-right transition-all hover:scale-[1.03] hover:shadow-lg cursor-pointer',
                action.color,
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-background/60 flex items-center justify-center mb-3 group-hover:bg-background/80 transition-colors">
                <Icon className="w-5 h-5 text-foreground" />
              </div>
              <h3 className="font-semibold text-sm">{action.label}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
