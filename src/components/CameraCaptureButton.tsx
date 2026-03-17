import { useState, useRef } from 'react';
import { Camera, X, Check, SwitchCamera, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { storageService } from '@/services/creativeService';
import { toast } from 'sonner';

interface CameraCaptureButtonProps {
  onCaptured: (url: string) => void;
  className?: string;
}

export function CameraCaptureButton({ onCaptured, className }: CameraCaptureButtonProps) {
  const [open, setOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async (facing: 'user' | 'environment' = facingMode) => {
    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      setStream(s);
      setFacingMode(facing);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
    } catch {
      toast.error('לא ניתן לגשת למצלמה');
      setOpen(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setCapturedImage(null);
    setTimeout(() => startCamera(), 100);
  };

  const handleClose = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setCapturedImage(null);
    setOpen(false);
  };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
  };

  const handleConfirm = async () => {
    if (!capturedImage) return;
    setUploading(true);
    try {
      const res = await fetch(capturedImage);
      const blob = await res.blob();
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = await storageService.upload(file);
      onCaptured(url);
      toast.success('התמונה צולמה והועלתה');
      handleClose();
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בהעלאת התמונה');
    } finally {
      setUploading(false);
    }
  };

  const retake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const flipCamera = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    startCamera(next);
  };

  return (
    <>
      <button onClick={handleOpen} className={className} title="צלם תמונה">
        <Camera className="w-4 h-4" />
      </button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <canvas ref={canvasRef} className="hidden" />
          {capturedImage ? (
            <div className="relative">
              <img src={capturedImage} alt="captured" className="w-full" />
              <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3">
                <button onClick={retake} className="w-12 h-12 bg-muted/90 rounded-full flex items-center justify-center backdrop-blur">
                  <X className="w-5 h-5" />
                </button>
                <button onClick={handleConfirm} disabled={uploading} className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="w-full" style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
              <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3">
                <button onClick={flipCamera} className="w-10 h-10 bg-muted/70 rounded-full flex items-center justify-center backdrop-blur">
                  <SwitchCamera className="w-4 h-4 text-foreground" />
                </button>
                <button onClick={capture} className="w-14 h-14 bg-white rounded-full border-4 border-primary flex items-center justify-center">
                  <div className="w-10 h-10 bg-primary rounded-full" />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
