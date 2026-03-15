import { useState } from 'react';
import { Link2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UrlImportInputProps {
  onSubmit: (url: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function UrlImportInput({ onSubmit, placeholder = 'הדבק קישור לסרטון או תמונה...', label = 'ייבוא מקישור', className }: UrlImportInputProps) {
  const [url, setUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!url.trim()) return;
    onSubmit(url.trim());
    setSubmitted(true);
  };

  const handleClear = () => {
    setUrl('');
    setSubmitted(false);
    onSubmit('');
  };

  if (submitted) {
    return (
      <div className={cn('bg-muted/30 border border-border rounded-lg p-3 flex items-center justify-between', className)}>
        <div className="flex items-center gap-2 min-w-0">
          <Check className="w-4 h-4 text-success flex-shrink-0" />
          <span className="text-sm truncate">{url}</span>
        </div>
        <button onClick={handleClear} className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center flex-shrink-0">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <div className="relative flex-1">
        <Link2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder={placeholder}
          className="w-full bg-muted/50 border border-border rounded-lg pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          dir="ltr"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={!url.trim()}
        className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted disabled:opacity-50 flex items-center gap-1.5"
      >
        <Link2 className="w-4 h-4" /> ייבא
      </button>
    </div>
  );
}
