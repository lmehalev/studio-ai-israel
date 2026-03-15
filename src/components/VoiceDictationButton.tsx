import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpeechToText } from '@/hooks/use-speech-to-text';
import { useCallback } from 'react';

interface VoiceDictationButtonProps {
  /** Called with transcribed text to append */
  onResult: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function VoiceDictationButton({ onResult, className, size = 'sm' }: VoiceDictationButtonProps) {
  const handleResult = useCallback((text: string) => {
    onResult(text);
  }, [onResult]);

  const { isListening, isSupported, toggle } = useSpeechToText({
    language: 'he-IL',
    onResult: handleResult,
    continuous: true,
  });

  if (!isSupported) return null;

  const sizeClasses = size === 'sm' 
    ? 'w-7 h-7' 
    : 'w-9 h-9';

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <button
      type="button"
      onClick={toggle}
      title={isListening ? 'הפסק הקלטה' : 'הקלט בקול'}
      className={cn(
        'rounded-full flex items-center justify-center transition-all',
        isListening
          ? 'bg-destructive text-destructive-foreground animate-pulse shadow-md'
          : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground',
        sizeClasses,
        className
      )}
    >
      {isListening ? <MicOff className={iconSize} /> : <Mic className={iconSize} />}
    </button>
  );
}
