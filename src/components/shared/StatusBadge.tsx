import { cn } from '@/lib/utils';
import { JobStatus } from '@/types';

const statusConfig: Record<string, { bg: string; text: string }> = {
  'טיוטה': { bg: 'bg-muted', text: 'text-muted-foreground' },
  'מוכן לשליחה': { bg: 'bg-info/15', text: 'text-info' },
  'ממתין': { bg: 'bg-warning/15', text: 'text-warning' },
  'בעיבוד': { bg: 'bg-info/15', text: 'text-info' },
  'הושלם': { bg: 'bg-success/15', text: 'text-success' },
  'נכשל': { bg: 'bg-destructive/15', text: 'text-destructive' },
  'בוטל': { bg: 'bg-muted', text: 'text-muted-foreground' },
  'בארכיון': { bg: 'bg-muted', text: 'text-muted-foreground' },
  'מוכן': { bg: 'bg-success/15', text: 'text-success' },
  'בהכנה': { bg: 'bg-warning/15', text: 'text-warning' },
  'מחובר': { bg: 'bg-success/15', text: 'text-success' },
  'לא מחובר': { bg: 'bg-muted', text: 'text-muted-foreground' },
  'שגיאה': { bg: 'bg-destructive/15', text: 'text-destructive' },
  'בבדיקה': { bg: 'bg-info/15', text: 'text-info' },
};

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const config = statusConfig[status] || { bg: 'bg-muted', text: 'text-muted-foreground' };
  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium',
      config.bg, config.text,
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
    )}>
      {status}
    </span>
  );
}
