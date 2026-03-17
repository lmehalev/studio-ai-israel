import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, FolderOpen, CheckCircle2, Image, Film, Music, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoragePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (urls: string[]) => void;
  accept?: string; // e.g. 'image/*', 'video/*', 'audio/*'
  multiple?: boolean;
}

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata: { size?: number; mimetype?: string };
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return Image;
  if (['mp4', 'webm', 'mov'].includes(ext)) return Film;
  if (['mp3', 'wav', 'ogg', 'webm', 'm4a'].includes(ext)) return Music;
  return FileText;
}

function matchesAccept(name: string, accept?: string) {
  if (!accept) return true;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (accept.includes('image/*') && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return true;
  if (accept.includes('video/*') && ['mp4', 'webm', 'mov'].includes(ext)) return true;
  if (accept.includes('audio/*') && ['mp3', 'wav', 'ogg', 'webm', 'm4a'].includes(ext)) return true;
  if (accept === '*') return true;
  return !accept.includes('/');
}

export function StoragePicker({ open, onClose, onSelect, accept, multiple = false }: StoragePickerProps) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      loadFiles();
    }
  }, [open]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('storage-manager', {
        body: { action: 'list' },
      });
      if (error) throw error;
      const allFiles = (data?.files || []) as StorageFile[];
      setFiles(allFiles.filter(f => matchesAccept(f.name, accept)));
    } catch (e) {
      console.error('Failed to load storage files:', e);
    } finally {
      setLoading(false);
    }
  };

  const getPublicUrl = (fileName: string) => {
    const { data } = supabase.storage.from('media').getPublicUrl(`uploads/${fileName}`);
    return data.publicUrl;
  };

  const toggleFile = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        if (!multiple) next.clear();
        next.add(name);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const urls = Array.from(selected).map(name => getPublicUrl(name));
    onSelect(urls);
    onClose();
  };

  const isImage = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            בחירה מהאחסון
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            אין קבצים מתאימים באחסון
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
            {files.map(file => {
              const Icon = getFileIcon(file.name);
              const isSelected = selected.has(file.name);
              const imgUrl = isImage(file.name) ? getPublicUrl(file.name) : null;
              return (
                <button
                  key={file.id}
                  onClick={() => toggleFile(file.name)}
                  className={cn(
                    'relative rounded-lg border-2 overflow-hidden aspect-square flex flex-col items-center justify-center transition-all',
                    isSelected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border hover:border-primary/40 bg-muted/30'
                  )}
                >
                  {imgUrl ? (
                    <img src={imgUrl} alt={file.name} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="w-8 h-8 text-muted-foreground" />
                  )}
                  <span className="absolute bottom-0 inset-x-0 text-[9px] bg-background/80 text-foreground px-1 py-0.5 truncate text-center">
                    {file.name}
                  </span>
                  {isSelected && (
                    <div className="absolute top-1 left-1">
                      <CheckCircle2 className="w-5 h-5 text-primary drop-shadow" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-3 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">
            ביטול
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="gradient-gold text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            בחר {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
