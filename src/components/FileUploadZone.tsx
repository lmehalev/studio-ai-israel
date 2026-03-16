import { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { storageService } from '@/services/creativeService';
import { toast } from 'sonner';

interface FileUploadZoneProps {
  accept: string;
  label: string;
  hint?: string;
  onUploaded: (url: string) => void;
  onMultipleUploaded?: (urls: string[]) => void;
  multiple?: boolean;
  className?: string;
}

export function FileUploadZone({ accept, label, hint, onUploaded, onMultipleUploaded, multiple, className }: FileUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setFileName(file.name);
    try {
      const url = await storageService.upload(file);
      setUploadedUrl(url);
      onUploaded(url);
      toast.success(`"${file.name}" הועלה בהצלחה`);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהעלאה');
      setFileName(null);
    } finally {
      setUploading(false);
    }
  };

  const handleMultipleFiles = async (files: File[]) => {
    setUploading(true);
    const urls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`מעלה ${i + 1}/${files.length}...`);
        setFileName(files[i].name);
        const url = await storageService.upload(files[i]);
        urls.push(url);
      }
      if (onMultipleUploaded) {
        onMultipleUploaded(urls);
      } else {
        urls.forEach(url => onUploaded(url));
      }
      toast.success(`${urls.length} קבצים הועלו בהצלחה`);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהעלאה');
      // Still send whatever succeeded
      if (urls.length > 0) {
        if (onMultipleUploaded) {
          onMultipleUploaded(urls);
        } else {
          urls.forEach(url => onUploaded(url));
        }
      }
    } finally {
      setUploading(false);
      setFileName(null);
      setUploadProgress('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (multiple && files.length > 1) {
      handleMultipleFiles(files);
    } else if (files[0]) {
      if (multiple) {
        handleMultipleFiles([files[0]]);
      } else {
        handleFile(files[0]);
      }
    }
  };

  const handleClear = () => {
    setUploadedUrl(null);
    setFileName(null);
    onUploaded('');
  };

  // For multiple mode, never show "uploaded" state — parent manages the list
  if (!multiple && uploadedUrl) {
    return (
      <div className={cn('bg-muted/30 border border-border rounded-lg p-3 flex items-center justify-between', className)}>
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
          <span className="text-sm truncate">{fileName}</span>
        </div>
        <button onClick={handleClear} className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center flex-shrink-0">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={cn(
        'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all',
        isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
        uploading && 'pointer-events-none opacity-70',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={e => {
          const files = Array.from(e.target.files || []);
          if (multiple && files.length > 0) {
            handleMultipleFiles(files);
          } else if (files[0]) {
            handleFile(files[0]);
          }
          // Reset input so same files can be re-selected
          e.target.value = '';
        }}
      />
      {uploading ? (
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">{uploadProgress || `מעלה ${fileName}...`}</span>
        </div>
      ) : (
        <>
          <Upload className={cn('w-6 h-6 mx-auto mb-1.5', isDragging ? 'text-primary' : 'text-muted-foreground')} />
          <p className="text-sm font-medium">{label}</p>
          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </>
      )}
    </div>
  );
}
