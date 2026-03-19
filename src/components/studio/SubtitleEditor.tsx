import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Loader2, Upload, Eye, Save, Download, ArrowRight, ArrowLeft,
  Subtitles, Check, X, Plus, Trash2, Scissors, Music,
  Smile, Type, Palette, Image, Sparkles, Play, Pause,
  Film, Sticker, Crown, Layers, ChevronLeft, ChevronRight,
  Clock, PlusCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  subtitleService, type SubtitleSegment, type Brand, type CaptionCue,
  storageService, composeService,
} from '@/services/creativeService';
import { CostApprovalDialog, buildSubtitleRenderEstimates } from '@/components/studio/CostApprovalDialog';

// ── Font presets (YouTube-style, creative) ──
const fontPresets = [
  {
    id: 'impact',
    label: '💥 Impact',
    font: "'Rubik', sans-serif",
    fontWeight: 900,
    bgColor: 'rgba(0,0,0,0.85)',
    borderRadius: 4,
    shadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
    padding: '8px 20px',
    preview: 'כתובית בולטת',
  },
  {
    id: 'glow',
    label: '✨ זוהר',
    font: "'Heebo', sans-serif",
    fontWeight: 700,
    bgColor: 'transparent',
    borderRadius: 0,
    shadow: '0 0 10px #fff, 0 0 20px #fff, 0 0 40px #FFD700, 0 0 80px #FFD700',
    padding: '8px 16px',
    preview: 'כתובית זוהרת',
  },
  {
    id: 'boxed',
    label: '📦 קופסה',
    font: "'Noto Sans Hebrew', sans-serif",
    fontWeight: 800,
    bgColor: 'rgba(255,200,0,0.95)',
    borderRadius: 6,
    shadow: 'none',
    padding: '10px 24px',
    preview: 'כתובית בקופסה',
    textColor: '#000000',
  },
  {
    id: 'outline',
    label: '🔲 מתאר',
    font: "'Rubik', sans-serif",
    fontWeight: 800,
    bgColor: 'transparent',
    borderRadius: 0,
    shadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 3px 6px rgba(0,0,0,0.5)',
    padding: '8px 16px',
    preview: 'כתובית עם מתאר',
  },
  {
    id: 'gradient',
    label: '🌈 גרדיאנט',
    font: "'Heebo', sans-serif",
    fontWeight: 700,
    bgColor: 'linear-gradient(135deg, rgba(255,0,128,0.9), rgba(255,165,0,0.9))',
    borderRadius: 16,
    shadow: '0 4px 20px rgba(255,0,128,0.4)',
    padding: '12px 28px',
    preview: 'כתובית צבעונית',
  },
  {
    id: 'cinema',
    label: '🎬 קולנועי',
    font: "'Noto Sans Hebrew', sans-serif",
    fontWeight: 500,
    bgColor: 'rgba(0,0,0,0.6)',
    borderRadius: 2,
    shadow: '0 2px 8px rgba(0,0,0,0.9)',
    padding: '10px 24px',
    preview: 'כתובית קולנועית',
  },
  {
    id: 'neon',
    label: '💡 ניאון',
    font: "'Rubik', sans-serif",
    fontWeight: 700,
    bgColor: 'transparent',
    borderRadius: 0,
    shadow: '0 0 7px #fff, 0 0 10px #fff, 0 0 21px #fff, 0 0 42px #0fa, 0 0 82px #0fa',
    padding: '8px 16px',
    preview: 'כתובית ניאון',
    textColor: '#FFFFFF',
  },
  {
    id: 'handwritten',
    label: '✍️ כתב יד',
    font: "'Heebo', sans-serif",
    fontWeight: 400,
    bgColor: 'rgba(255,255,200,0.9)',
    borderRadius: 3,
    shadow: '1px 1px 2px rgba(0,0,0,0.3)',
    padding: '10px 20px',
    preview: 'כתובית אישית',
    textColor: '#333333',
  },
] as const;

// ── Color options ──
const colorOptions = [
  { value: '#FFFFFF', label: 'לבן' },
  { value: '#FFD700', label: 'זהב' },
  { value: '#00FF88', label: 'ירוק' },
  { value: '#00BFFF', label: 'כחול' },
  { value: '#FF4444', label: 'אדום' },
  { value: '#FF69B4', label: 'ורוד' },
  { value: '#000000', label: 'שחור' },
  { value: '#FF6600', label: 'כתום' },
];

const fontSizeOptions = [
  { value: 20, label: 'S' },
  { value: 26, label: 'M' },
  { value: 32, label: 'L' },
  { value: 38, label: 'XL' },
  { value: 44, label: 'XXL' },
];

const emojiOptions = ['🔥', '✨', '👆', '💡', '⭐', '🎯', '💪', '❤️', '👇', '📌', '🚀', '💰', '👏', '🎉', '💎', '🏆'];

const bgMusicOptions = [
  { id: 'none', label: 'ללא מוזיקה', emoji: '🔇', prompt: '' },
  { id: 'upbeat', label: 'אנרגטי', emoji: '🎵', prompt: 'upbeat energetic background music, corporate, positive' },
  { id: 'calm', label: 'רגוע', emoji: '🎶', prompt: 'calm professional background music, soft piano, corporate' },
  { id: 'dramatic', label: 'דרמטי', emoji: '🎼', prompt: 'dramatic cinematic background music, inspiring, epic' },
  { id: 'modern', label: 'מודרני', emoji: '🎧', prompt: 'modern electronic background music, tech, trendy' },
  { id: 'chill', label: "צ'יל", emoji: '🌊', prompt: 'chill lofi background music, relaxed, ambient' },
];

// ── Sticker icons ──
const stickerOptions = [
  '👆', '👇', '👉', '👈', '⭐', '🔥', '💡', '📌', '🎯', '✅',
  '❌', '❓', '💰', '🏆', '🚀', '💎', '⚡', '🎉', '📢', '🔔',
  '💪', '❤️', '👏', '🤩', '😎', '🤔', '💯', '🎊', '📊', '🛒',
];

interface StickerOverlay {
  id: string;
  emoji: string;
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
  startTime: number;
  duration: number;
  scale: number;
}

interface SubtitleEditorProps {
  activeBrand: Brand | undefined;
  onBack: () => void;
}

interface SubtitleTranscribeDebug {
  provider: string;
  status: number;
  videoUrl: string;
  sourceAudioUrl: string;
  sourceAudioHttpStatus: number | null;
  sourceAudioCheckedAt: string;
  videoDuration: number;
  totalCueCount: number;
  firstCues: CaptionCue[];
  providerBody?: string;
}

interface SubtitleTranscribeFailure {
  provider: string;
  status: number | null;
  message: string;
}

type TranscriptionHealthState = 'idle' | 'testing' | 'ok' | 'fail';

interface SubtitleTranscriptionHealth {
  state: TranscriptionHealthState;
  provider: string;
  status: number | null;
  reason: string;
  checkedAt: string | null;
}

interface SubtitlePlaybackDebug {
  readyState: number;
  currentTime: number;
  startSec: number | null;
  endSec: number | null;
  playError: string | null;
  activeTimeupdateListeners: number;
  timeupdateEventsPerSecond: number;
}

// Step names
const STEPS = [
  { key: 'upload', label: 'העלאה', icon: Upload },
  { key: 'subtitles', label: 'כתוביות', icon: Subtitles },
  { key: 'style', label: 'עיצוב', icon: Palette },
  { key: 'extras', label: 'תוספות', icon: Layers },
] as const;

export function SubtitleEditor({ activeBrand, onBack }: SubtitleEditorProps) {
  const [step, setStep] = useState(0);
  const [subtitleSegments, setSubtitleSegments] = useState<SubtitleSegment[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [transcribeDebug, setTranscribeDebug] = useState<SubtitleTranscribeDebug | null>(null);
  const [transcribeFailure, setTranscribeFailure] = useState<SubtitleTranscribeFailure | null>(null);
  const [transcriptionHealth, setTranscriptionHealth] = useState<SubtitleTranscriptionHealth>({
    state: 'idle',
    provider: 'elevenlabs/scribe_v2',
    status: null,
    reason: 'טרם נבדק',
    checkedAt: null,
  });
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);

  // Style
  const [selectedFont, setSelectedFont] = useState('impact');
  const [customColor, setCustomColor] = useState('#FFFFFF');
  const [customFontSize, setCustomFontSize] = useState(32);

  // Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(activeBrand?.logo || null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Stickers
  const [stickers, setStickers] = useState<StickerOverlay[]>([]);

  // Music
  const [selectedMusic, setSelectedMusic] = useState('none');
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicAudioUrl, setMusicAudioUrl] = useState<string | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);

  // Rendering
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  // Cost approval gate
  const [showCostApproval, setShowCostApproval] = useState(false);

  const currentFont = fontPresets.find(p => p.id === selectedFont) || fontPresets[0];

  const getAdjustedSegments = useCallback(() => {
    return subtitleSegments
      .map((seg) => ({
        ...seg,
        start: Math.max(0, Number((seg.start + subtitleOffset).toFixed(2))),
        end: Math.max(Math.max(0, Number((seg.start + subtitleOffset).toFixed(2))) + 0.1, Number((seg.end + subtitleOffset).toFixed(2))),
      }))
      .sort((a, b) => a.start - b.start);
  }, [subtitleSegments, subtitleOffset]);

  // ── Segment management ──
  const updateSegment = (index: number, updates: Partial<SubtitleSegment>) => {
    setSubtitleSegments(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const addSegment = (afterIndex: number) => {
    const prev = subtitleSegments[afterIndex];
    const next = subtitleSegments[afterIndex + 1];
    const newStart = prev ? prev.end + 0.5 : 0;
    const newEnd = next ? Math.min(next.start - 0.1, newStart + 3) : newStart + 3;
    const newSeg: SubtitleSegment = { start: newStart, end: Math.max(newEnd, newStart + 0.5), text: '' };
    setSubtitleSegments(prev => {
      const arr = [...prev];
      arr.splice(afterIndex + 1, 0, newSeg);
      return arr;
    });
    setEditingIndex(afterIndex + 1);
  };

  const addGapBetween = (index: number, gapSeconds: number) => {
    // Push all subsequent segments forward by gapSeconds
    setSubtitleSegments(prev => prev.map((s, i) => {
      if (i <= index) return s;
      return { ...s, start: s.start + gapSeconds, end: s.end + gapSeconds };
    }));
  };

  const deleteSegment = (index: number) => {
    setSubtitleSegments(prev => prev.filter((_, i) => i !== index));
  };

  const splitSegment = (index: number) => {
    const seg = subtitleSegments[index];
    const midTime = (seg.start + seg.end) / 2;
    const words = seg.text.split(' ');
    const midWord = Math.ceil(words.length / 2);
    const seg1: SubtitleSegment = { start: seg.start, end: midTime, text: words.slice(0, midWord).join(' ') };
    const seg2: SubtitleSegment = { start: midTime + 0.1, end: seg.end, text: words.slice(midWord).join(' ') };
    setSubtitleSegments(prev => {
      const arr = [...prev];
      arr.splice(index, 1, seg1, seg2);
      return arr;
    });
  };

  const addEmoji = (index: number, emoji: string) => {
    updateSegment(index, { text: subtitleSegments[index].text + ' ' + emoji });
  };

  const [playingSegIndex, setPlayingSegIndex] = useState<number | null>(null);
  const [activeCueIndex, setActiveCueIndex] = useState<number | null>(null);
  const cuePlaybackRef = useRef<{ index: number; startSec: number; endSec: number } | null>(null);
  const activeCueIndexRef = useRef<number | null>(null);
  const adjustedSegmentsRef = useRef<SubtitleSegment[]>([]);
  const attachedVideoRef = useRef<HTMLVideoElement | null>(null);
  const playbackListenersCleanupRef = useRef<(() => void) | null>(null);
  const rafLoopRef = useRef<number | null>(null);
  const rvfcLoopRef = useRef<number | null>(null);
  const frameWindowRef = useRef({ startedAt: 0, count: 0, fps: 0 });
  const [playbackDebug, setPlaybackDebug] = useState<SubtitlePlaybackDebug>({
    readyState: 0,
    currentTime: 0,
    startSec: null,
    endSec: null,
    playError: null,
    activeTimeupdateListeners: 0,
    timeupdateEventsPerSecond: 0,
  });

  const ACTIVE_CUE_TOLERANCE_SEC = 0.05;

  const updatePlaybackDebug = useCallback((patch: Partial<SubtitlePlaybackDebug>) => {
    setPlaybackDebug((prev) => ({ ...prev, ...patch }));
  }, []);

  const formatPlaybackError = useCallback((error: unknown) => {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        return `ניגון נחסם על ידי הדפדפן (${error.name}): ${error.message}`;
      }
      if (error.name === 'AbortError') {
        return `הניגון הופסק לפני שהתחיל (${error.name}): ${error.message}`;
      }
      return `שגיאת ניגון (${error.name}): ${error.message}`;
    }

    if (error instanceof Error) {
      return `שגיאת ניגון (${error.name}): ${error.message}`;
    }

    return `שגיאת ניגון: ${String(error)}`;
  }, []);

  const clearCuePlaybackState = useCallback(() => {
    cuePlaybackRef.current = null;
    setPlayingSegIndex(null);
  }, []);

  useEffect(() => {
    adjustedSegmentsRef.current = getAdjustedSegments();
  }, [getAdjustedSegments]);

  const stopFrameTracking = useCallback(() => {
    const currentVideo = videoPreviewRef.current as (HTMLVideoElement & {
      cancelVideoFrameCallback?: (handle: number) => void;
    }) | null;

    if (rvfcLoopRef.current !== null && currentVideo && typeof currentVideo.cancelVideoFrameCallback === 'function') {
      currentVideo.cancelVideoFrameCallback(rvfcLoopRef.current);
    }

    if (rafLoopRef.current !== null) {
      cancelAnimationFrame(rafLoopRef.current);
    }

    rvfcLoopRef.current = null;
    rafLoopRef.current = null;
  }, []);

  const syncPlaybackFromVisibleVideo = useCallback(() => {
    const video = videoPreviewRef.current;
    if (!video) return;

    const now = performance.now();
    const currentTime = video.currentTime;

    if (!frameWindowRef.current.startedAt) {
      frameWindowRef.current.startedAt = now;
      frameWindowRef.current.count = 0;
    }

    frameWindowRef.current.count += 1;
    const elapsed = now - frameWindowRef.current.startedAt;
    if (elapsed >= 1000) {
      frameWindowRef.current.fps = Number((frameWindowRef.current.count / (elapsed / 1000)).toFixed(1));
      frameWindowRef.current.startedAt = now;
      frameWindowRef.current.count = 0;
    }

    const segments = adjustedSegmentsRef.current;
    const nextCueIdx = segments.findIndex((s) => (
      (currentTime + ACTIVE_CUE_TOLERANCE_SEC) >= s.start &&
      (currentTime - ACTIVE_CUE_TOLERANCE_SEC) <= s.end
    ));
    const normalizedCueIdx = nextCueIdx >= 0 ? nextCueIdx : null;

    if (normalizedCueIdx !== activeCueIndexRef.current) {
      activeCueIndexRef.current = normalizedCueIdx;
      setActiveCueIndex(normalizedCueIdx);
      setCurrentSubtitle(normalizedCueIdx !== null ? segments[normalizedCueIdx].text : '');
    }

    const playbackWindow = cuePlaybackRef.current;
    if (playbackWindow) {
      const stopAt = Math.max(playbackWindow.startSec, playbackWindow.endSec - ACTIVE_CUE_TOLERANCE_SEC);
      if (currentTime >= stopAt) {
        video.pause();
        const boundedEnd = Number.isFinite(video.duration)
          ? Math.min(playbackWindow.endSec, video.duration)
          : playbackWindow.endSec;
        video.currentTime = boundedEnd;
        clearCuePlaybackState();
        updatePlaybackDebug({
          readyState: video.readyState,
          currentTime: boundedEnd,
          startSec: null,
          endSec: null,
          activeTimeupdateListeners: videoPreviewRef.current ? 1 : 0,
          timeupdateEventsPerSecond: frameWindowRef.current.fps,
        });
        return;
      }
    }

    updatePlaybackDebug({
      readyState: video.readyState,
      currentTime,
      activeTimeupdateListeners: videoPreviewRef.current ? 1 : 0,
      timeupdateEventsPerSecond: frameWindowRef.current.fps,
    });
  }, [ACTIVE_CUE_TOLERANCE_SEC, clearCuePlaybackState, updatePlaybackDebug]);

  const scheduleFrameTracking = useCallback(() => {
    const video = videoPreviewRef.current as (HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number;
    }) | null;

    if (!video || video.paused || video.ended) {
      stopFrameTracking();
      return;
    }

    if (typeof video.requestVideoFrameCallback === 'function') {
      rvfcLoopRef.current = video.requestVideoFrameCallback(() => {
        syncPlaybackFromVisibleVideo();
        scheduleFrameTracking();
      });
      return;
    }

    rafLoopRef.current = requestAnimationFrame(() => {
      syncPlaybackFromVisibleVideo();
      scheduleFrameTracking();
    });
  }, [stopFrameTracking, syncPlaybackFromVisibleVideo]);

  const startFrameTracking = useCallback(() => {
    frameWindowRef.current = { startedAt: performance.now(), count: 0, fps: 0 };
    stopFrameTracking();
    syncPlaybackFromVisibleVideo();
    scheduleFrameTracking();
  }, [scheduleFrameTracking, stopFrameTracking, syncPlaybackFromVisibleVideo]);

  const attachPlaybackLifecycleListeners = useCallback((video: HTMLVideoElement) => {
    if (attachedVideoRef.current === video && playbackListenersCleanupRef.current) {
      updatePlaybackDebug({
        activeTimeupdateListeners: 1,
        readyState: video.readyState,
        currentTime: video.currentTime,
      });
      return;
    }

    playbackListenersCleanupRef.current?.();

    const handlePlay = () => {
      updatePlaybackDebug({ activeTimeupdateListeners: 1, playError: null });
      startFrameTracking();
    };

    const handlePause = () => {
      stopFrameTracking();
      const activePlayback = cuePlaybackRef.current;
      if (activePlayback && video.currentTime < activePlayback.endSec - ACTIVE_CUE_TOLERANCE_SEC) {
        clearCuePlaybackState();
        updatePlaybackDebug({ startSec: null, endSec: null });
      }
      syncPlaybackFromVisibleVideo();
    };

    const handleSeeked = () => {
      syncPlaybackFromVisibleVideo();
    };

    const handleEnded = () => {
      stopFrameTracking();
      clearCuePlaybackState();
      activeCueIndexRef.current = null;
      setActiveCueIndex(null);
      setCurrentSubtitle('');
      syncPlaybackFromVisibleVideo();
      updatePlaybackDebug({ startSec: null, endSec: null });
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('ended', handleEnded);

    attachedVideoRef.current = video;
    playbackListenersCleanupRef.current = () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('ended', handleEnded);
      if (attachedVideoRef.current === video) {
        attachedVideoRef.current = null;
      }
      stopFrameTracking();
    };

    updatePlaybackDebug({
      activeTimeupdateListeners: 1,
      readyState: video.readyState,
      currentTime: video.currentTime,
      timeupdateEventsPerSecond: frameWindowRef.current.fps,
    });

    if (!video.paused && !video.ended) {
      startFrameTracking();
    } else {
      syncPlaybackFromVisibleVideo();
    }
  }, [
    ACTIVE_CUE_TOLERANCE_SEC,
    clearCuePlaybackState,
    startFrameTracking,
    stopFrameTracking,
    syncPlaybackFromVisibleVideo,
    updatePlaybackDebug,
  ]);

  const setVideoPreviewElement = useCallback((node: HTMLVideoElement | null) => {
    videoPreviewRef.current = node;
    if (!node) return;
    attachPlaybackLifecycleListeners(node);
    syncPlaybackFromVisibleVideo();
  }, [attachPlaybackLifecycleListeners, syncPlaybackFromVisibleVideo]);

  useEffect(() => {
    const nextBlobUrl = videoPreviewUrl?.startsWith('blob:') ? videoPreviewUrl : null;
    const previousBlobUrl = previewBlobUrlRef.current;
    if (previousBlobUrl && previousBlobUrl !== nextBlobUrl) {
      URL.revokeObjectURL(previousBlobUrl);
    }
    previewBlobUrlRef.current = nextBlobUrl;
  }, [videoPreviewUrl]);

  useEffect(() => {
    return () => {
      playbackListenersCleanupRef.current?.();
      playbackListenersCleanupRef.current = null;
      stopFrameTracking();
      clearCuePlaybackState();
      activeCueIndexRef.current = null;
      updatePlaybackDebug({ activeTimeupdateListeners: 0, timeupdateEventsPerSecond: 0 });

      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
    };
  }, [clearCuePlaybackState, stopFrameTracking, updatePlaybackDebug]);

  const waitForVideoMetadata = useCallback(async (video: HTMLVideoElement) => {
    if (video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('טעינת הווידאו נכשלה - לא התקבל loadedmetadata בזמן'));
      }, 5000);

      const onLoaded = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error('לא ניתן לטעון את מטא-דאטה של הווידאו'));
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
      };

      video.addEventListener('loadedmetadata', onLoaded, { once: true });
      video.addEventListener('error', onError, { once: true });
      if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) {
        video.load();
      }
    });
  }, []);

  const seekVideoTo = useCallback(async (video: HTMLVideoElement, targetSec: number) => {
    const boundedTarget = Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(Math.max(0, targetSec), Math.max(video.duration - 0.01, 0))
      : Math.max(0, targetSec);

    if (Math.abs(video.currentTime - boundedTarget) <= 0.03) {
      video.currentTime = boundedTarget;
      updatePlaybackDebug({ readyState: video.readyState, currentTime: video.currentTime });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('הווידאו לא הצליח להגיע לזמן המבוקש'));
      }, 3000);

      const onSeeked = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error('אירעה שגיאה בעת קפיצה למקטע'));
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      };

      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });
      video.currentTime = boundedTarget;
    });

    updatePlaybackDebug({ readyState: video.readyState, currentTime: video.currentTime });
  }, [updatePlaybackDebug]);

  const ensureUploadedVideoUrl = useCallback(async () => {
    if (uploadedVideoUrl) return uploadedVideoUrl;
    if (!videoFile) throw new Error('לא נמצא קובץ וידאו לתמלול');

    toast.info('מעלה את הסרטון כדי לתמלל מהאודיו המקורי...');
    const remoteUrl = await storageService.upload(videoFile);
    setUploadedVideoUrl(remoteUrl);
    // Keep local blob URL for preview — don't replace with remote URL
    return remoteUrl;
  }, [uploadedVideoUrl, videoFile]);

  const probeTranscriptionSourceUrl = useCallback(async (url: string) => {
    const fetchProbe = async (method: 'HEAD' | 'GET') => {
      const headers: Record<string, string> = {};
      if (method === 'GET') headers.Range = 'bytes=0-1';
      return fetch(url, {
        method,
        headers,
        cache: 'no-store',
      });
    };

    try {
      let response: Response;
      try {
        response = await fetchProbe('HEAD');
        if (response.status === 405 || response.status === 501) {
          response = await fetchProbe('GET');
        }
      } catch {
        response = await fetchProbe('GET');
      }

      if (response.ok || response.status === 206) {
        return { ok: true, status: response.status, reason: 'OK' };
      }

      return {
        ok: false,
        status: response.status,
        reason: `מקור האודיו לא נגיש (HTTP ${response.status})`,
      };
    } catch (error) {
      return {
        ok: false,
        status: null,
        reason: `כשל בבדיקת מקור האודיו: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
      };
    }
  }, []);

  const ensureValidTranscriptionSourceUrl = useCallback(async () => {
    const initialUrl = await ensureUploadedVideoUrl();
    let sourceAudioUrl = initialUrl;
    let probe = await probeTranscriptionSourceUrl(sourceAudioUrl);

    const looksSigned = /[?&](token|signature|expires|x-amz-signature|x-amz-expires)=/i.test(sourceAudioUrl);

    if (!probe.ok && videoFile && (probe.status === 401 || probe.status === 403 || probe.status === 404 || looksSigned)) {
      const refreshedUrl = await storageService.upload(videoFile);
      setUploadedVideoUrl(refreshedUrl);
      sourceAudioUrl = refreshedUrl;
      probe = await probeTranscriptionSourceUrl(sourceAudioUrl);
    }

    if (!probe.ok) {
      throw new Error(`${probe.reason}. סטטוס: ${probe.status ?? 'לא ידוע'}`);
    }

    return {
      sourceAudioUrl,
      sourceAudioHttpStatus: probe.status ?? 200,
      checkedAt: new Date().toISOString(),
    };
  }, [ensureUploadedVideoUrl, probeTranscriptionSourceUrl, videoFile]);

  const createSilentWavBase64 = useCallback((durationMs: number = 350) => {
    const sampleRate = 16000;
    const numSamples = Math.max(1, Math.floor((durationMs / 1000) * sampleRate));
    const blockAlign = 2;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeAscii = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeAscii(36, 'data');
    view.setUint32(40, dataSize, true);

    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }, []);

  const handleHealthTest = useCallback(async () => {
    setTranscriptionHealth((prev) => ({
      ...prev,
      state: 'testing',
      reason: 'בודק זמינות...',
      checkedAt: new Date().toISOString(),
    }));

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          audioBase64: createSilentWavBase64(350),
          audioMimeType: 'audio/wav',
          language: 'עברית',
          videoDuration: 1,
        }),
      });

      const payload = await response.json().catch(() => null);
      const provider = typeof payload?.provider === 'string' ? payload.provider : 'elevenlabs/scribe_v2';
      const providerStatus = Number.isFinite(Number(payload?.status)) ? Number(payload.status) : response.status;
      const providerReachable = response.ok || (
        response.status === 422 &&
        provider === 'elevenlabs/scribe_v2' &&
        providerStatus === 200
      );

      if (providerReachable) {
        setTranscriptionHealth({
          state: 'ok',
          provider,
          status: providerStatus,
          reason: 'כלי התמלול זמין',
          checkedAt: new Date().toISOString(),
        });
        toast.success('בדיקת כלי התמלול עברה בהצלחה');
        return;
      }

      const reason = typeof payload?.error === 'string'
        ? payload.error
        : `כלי התמלול לא זמין (HTTP ${response.status})`;

      setTranscriptionHealth({
        state: 'fail',
        provider,
        status: providerStatus,
        reason,
        checkedAt: new Date().toISOString(),
      });
      toast.error(`בדיקת כלי התמלול נכשלה: ${reason}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'שגיאה לא ידועה';
      setTranscriptionHealth({
        state: 'fail',
        provider: 'transcribe-audio',
        status: null,
        reason,
        checkedAt: new Date().toISOString(),
      });
      toast.error(`בדיקת כלי התמלול נכשלה: ${reason}`);
    }
  }, [createSilentWavBase64]);

  const handleVideoSelected = useCallback((file: File) => {
    setVideoFile(file);
    setUploadedVideoUrl(null);
    setSubtitleSegments([]);
    setTranscribeDebug(null);
    setTranscribeFailure(null);
    setTranscriptionHealth({
      state: 'idle',
      provider: 'elevenlabs/scribe_v2',
      status: null,
      reason: 'טרם נבדק',
      checkedAt: null,
    });
    setVideoLoadError(null);
    setCurrentSubtitle('');
    setShowPreview(true);
    activeCueIndexRef.current = null;
    setActiveCueIndex(null);
    setPlayingSegIndex(null);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setStep(1);
  }, []);

  const seekToSegment = async (seg: SubtitleSegment, index: number) => {
    const video = videoPreviewRef.current;
    if (!video) {
      toast.error('הווידאו עדיין לא נטען');
      return;
    }

    if (!video.src) {
      toast.error('אין מקור וידאו תקין לתצוגה מקדימה');
      return;
    }

    const rawStart = seg.start + subtitleOffset;
    const rawEnd = seg.end + subtitleOffset;
    const start = Math.max(0, Math.min(rawStart, rawEnd));
    const end = Math.max(rawStart, rawEnd);

    if (!(end > start)) {
      const err = `טווח לא תקין לכתובית: התחלה ${start.toFixed(3)}, סיום ${end.toFixed(3)}`;
      updatePlaybackDebug({
        readyState: video.readyState,
        currentTime: video.currentTime,
        startSec: start,
        endSec: end,
        playError: err,
      });
      toast.error(err);
      return;
    }

    try {
      clearCuePlaybackState();
      video.pause();
      setShowPreview(true);

      updatePlaybackDebug({
        readyState: video.readyState,
        currentTime: video.currentTime,
        startSec: start,
        endSec: end,
        playError: null,
      });

      await waitForVideoMetadata(video);
      await seekVideoTo(video, start);

      cuePlaybackRef.current = { index, startSec: start, endSec: end };
      setPlayingSegIndex(index);
      activeCueIndexRef.current = index;
      setActiveCueIndex(index);
      setCurrentSubtitle(seg.text);

      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (error) {
      clearCuePlaybackState();
      const playbackError = formatPlaybackError(error);
      updatePlaybackDebug({
        readyState: video.readyState,
        currentTime: video.currentTime,
        startSec: start,
        endSec: end,
        playError: playbackError,
      });
      toast.error(playbackError);
    }
  };

  const handlePlayFullVideo = async () => {
    const video = videoPreviewRef.current;
    if (!video) {
      toast.error('הווידאו עדיין לא נטען');
      return;
    }

    if (!video.src) {
      toast.error('אין מקור וידאו תקין לניגון מלא');
      return;
    }

    try {
      clearCuePlaybackState();
      setShowPreview(true);
      setCurrentSubtitle('');
      activeCueIndexRef.current = null;
      setActiveCueIndex(null);

      updatePlaybackDebug({
        readyState: video.readyState,
        currentTime: video.currentTime,
        startSec: null,
        endSec: null,
        playError: null,
      });

      await waitForVideoMetadata(video);

      if (Number.isFinite(video.duration) && video.duration > 0 && video.currentTime >= video.duration - 0.1) {
        await seekVideoTo(video, 0);
      }

      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (error) {
      const playbackError = formatPlaybackError(error);
      updatePlaybackDebug({
        readyState: video.readyState,
        currentTime: video.currentTime,
        playError: playbackError,
      });
      toast.error(playbackError);
    }
  };

  // ── Transcribe ──
  const handleTranscribe = async () => {
    if (!videoFile) return;

    if (transcriptionHealth.state === 'fail') {
      toast.error(`בדיקת בריאות נכשלה: ${transcriptionHealth.reason}`);
      return;
    }

    setLoading(true);
    setEditingIndex(null);
    setPlayingSegIndex(null);
    setTranscribeDebug(null);
    setTranscribeFailure(null);

    try {
      const videoEl = videoPreviewRef.current;
      if (!videoEl) throw new Error('נגן הווידאו לא זמין כרגע');
      await waitForVideoMetadata(videoEl);

      const videoDuration = Number(videoEl.duration);
      if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
        throw new Error('אורך הווידאו לא תקין ולכן אי אפשר לתמלל');
      }

      const sourceCheck = await ensureValidTranscriptionSourceUrl();

      const result = await subtitleService.transcribe({
        sourceAudioUrl: sourceCheck.sourceAudioUrl,
        language: 'עברית',
        videoDuration,
      });

      const invalidCue = result.captions.find((cue) => !(cue.startSec >= 0 && cue.endSec > cue.startSec && cue.endSec <= videoDuration && cue.text.trim()));
      if (invalidCue) {
        throw new Error(
          `התקבלו זמנים לא תקינים מהתמלול: ${invalidCue.startSec} -> ${invalidCue.endSec}. תגובת ספק: ${result.debug.providerBody || 'לא סופקה'}`
        );
      }

      setSubtitleSegments(result.segments);
      setShowPreview(true);
      setTranscribeDebug({
        ...result.debug,
        videoUrl: sourceCheck.sourceAudioUrl,
        sourceAudioUrl: result.debug.sourceAudioUrl || sourceCheck.sourceAudioUrl,
        sourceAudioHttpStatus: sourceCheck.sourceAudioHttpStatus,
        sourceAudioCheckedAt: sourceCheck.checkedAt,
        videoDuration,
        totalCueCount: result.captions.length,
        firstCues: result.captions.slice(0, 5),
      });
      setTranscriptionHealth({
        state: 'ok',
        provider: result.debug.provider,
        status: result.debug.status,
        reason: 'כלי התמלול זמין',
        checkedAt: new Date().toISOString(),
      });
      toast.success(`התמלול מוכן! ${result.captions.length} כתוביות תקינות`);
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : 'שגיאה בתמלול';
      const statusMatch = message.match(/HTTP\s*(\d{3})|סטטוס\s*[:\)]?\s*(\d{3})/);
      const providerMatch = message.match(/\(([^,]+),\s*סטטוס/);
      const status = statusMatch ? Number(statusMatch[1] || statusMatch[2]) : null;
      const provider = providerMatch?.[1] || (message.includes('מקור האודיו') ? 'source-audio' : 'transcribe-audio');

      setTranscribeFailure({ provider, status, message });
      setTranscriptionHealth({
        state: 'fail',
        provider,
        status,
        reason: message,
        checkedAt: new Date().toISOString(),
      });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ── Logo upload ──
  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const url = await storageService.upload(file);
      setLogoUrl(url);
      toast.success('לוגו הועלה!');
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בהעלאת לוגו');
    } finally {
      setLogoUploading(false);
    }
  };

  // ── Background music ──
  const generateMusic = async (musicId: string) => {
    const option = bgMusicOptions.find(m => m.id === musicId);
    if (!option?.prompt) { setMusicAudioUrl(null); return; }
    setMusicLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ prompt: option.prompt, duration: 30 }),
        }
      );
      if (!response.ok) throw new Error('שגיאה ביצירת מוזיקה');
      const blob = await response.blob();
      setMusicAudioUrl(URL.createObjectURL(blob));
      toast.success('מוזיקת רקע נוצרה!');
    } catch (e: any) {
      toast.error(e.message || 'שגיאה ביצירת מוזיקה');
    } finally {
      setMusicLoading(false);
    }
  };

  // ── Add sticker ──
  const addSticker = (emoji: string) => {
    const videoDuration = videoPreviewRef.current?.duration || 30;
    setStickers(prev => [...prev, {
      id: crypto.randomUUID(),
      emoji,
      position: 'topRight',
      startTime: 0,
      duration: Math.min(videoDuration, 5),
      scale: 1,
    }]);
  };

  const removeSticker = (id: string) => {
    setStickers(prev => prev.filter(s => s.id !== id));
  };

  // ── Render final video ──
  const handleRenderVideo = async () => {
    if (!videoFile) return;
    setRendering(true);
    setRenderProgress(5);

    try {
      toast.info('מעלה סרטון מקור...');
      const videoUrl = await storageService.upload(videoFile);
      setRenderProgress(15);

      let audioUrl: string | undefined;
      if (musicAudioUrl) {
        toast.info('מעלה מוזיקת רקע...');
        const musicBlob = await fetch(musicAudioUrl).then(r => r.blob());
        const musicFile = new File([musicBlob], `music-${Date.now()}.mp3`, { type: 'audio/mpeg' });
        audioUrl = await storageService.upload(musicFile);
        setRenderProgress(25);
      }

      const adjusted = getAdjustedSegments();
      const videoDuration = videoPreviewRef.current?.duration || 30;

      const scenes = adjusted.map((seg) => ({
        title: '',
        duration: seg.end - seg.start,
        subtitleText: seg.text,
        spokenText: seg.text,
        icons: [] as string[],
      }));

      if (scenes.length === 0) {
        scenes.push({ title: '', duration: videoDuration, subtitleText: '', spokenText: '', icons: [] });
      }

      setRenderProgress(30);
      toast.info('שולח להרכבה...');

      const renderParams = {
        videoUrl,
        scenes,
        logoUrl: logoUrl || undefined,
        brandColors: activeBrand?.colors || [],
        audioUrl,
        subtitleStyle: {
          font: currentFont.font,
          fontSize: customFontSize,
          color: (currentFont as any).textColor || customColor,
          bgColor: currentFont.bgColor,
          borderRadius: currentFont.borderRadius,
          shadow: currentFont.shadow,
          fontWeight: currentFont.fontWeight,
          padding: currentFont.padding,
        },
        stickers: stickers.map(s => ({
          emoji: s.emoji,
          position: s.position,
          startTime: s.startTime,
          duration: s.duration,
          scale: s.scale,
        })),
        subtitleSegments: adjusted,
        totalDuration: videoDuration,
      };

      const renderResult = await composeService.render(renderParams);
      const renderId = renderResult.renderId;
      const shotstackEnv = renderResult.shotstackEnv;

      if (!renderId) throw new Error('לא התקבל מזהה הרכבה');

      setRenderProgress(40);
      toast.info('מרכיב סרטון... זה עשוי לקחת כמה דקות');

      let attempts = 0;
      const maxAttempts = 120;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;

        const status = await composeService.checkStatus(renderId, shotstackEnv);

        if (status.status === 'done' && status.url) {
          setRenderedVideoUrl(status.url);
          setRenderProgress(100);
          toast.success('הסרטון מוכן! 🎬');
          break;
        } else if (status.status === 'failed') {
          throw new Error('ההרכבה נכשלה');
        }

        setRenderProgress(40 + Math.min(55, (attempts / maxAttempts) * 55));
      }

      if (attempts >= maxAttempts) {
        throw new Error('ההרכבה לקחה יותר מדי זמן');
      }
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בהרכבת הסרטון');
    } finally {
      setRendering(false);
    }
  };

  // ── Preview subtitle CSS ──
  const getPreviewSubtitleStyle = (): React.CSSProperties => ({
    fontFamily: currentFont.font,
    fontSize: `${Math.min(customFontSize * 0.6, 22)}px`,
    color: (currentFont as any).textColor || customColor,
    background: currentFont.bgColor,
    borderRadius: `${currentFont.borderRadius}px`,
    textShadow: currentFont.shadow,
    fontWeight: currentFont.fontWeight as any,
    padding: '6px 14px',
    direction: 'rtl',
    textAlign: 'center' as const,
    maxWidth: '90%',
  });

  // ── Video preview (inline JSX — NOT a function component, to prevent remounting) ──
  const videoPreviewJSX = videoPreviewUrl ? (
    <div className="rounded-xl overflow-hidden border border-border relative bg-black">
      <video
        ref={setVideoPreviewElement}
        src={videoPreviewUrl}
        controls
        preload="metadata"
        className="w-full max-h-[240px]"
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          setVideoLoadError(null);
          updatePlaybackDebug({
            activeTimeupdateListeners: videoPreviewRef.current ? 1 : 0,
            readyState: video.readyState,
            currentTime: video.currentTime,
          });
          syncPlaybackFromVisibleVideo();
        }}
        onError={(e) => {
          const video = e.currentTarget;
          const mediaError = video.error;
          const msg = mediaError
            ? `שגיאת טעינת וידאו (קוד ${mediaError.code}): ${mediaError.message || 'לא ידוע'}`
            : 'שגיאת טעינת וידאו לא מזוהה';
          setVideoLoadError(msg);
          updatePlaybackDebug({ readyState: video.readyState, playError: msg });
        }}
      />
    </div>
  ) : null;

  // Caption overlay - always above the playing video
  const captionOverlayJSX = showPreview && currentSubtitle && videoPreviewUrl ? (
    <div className="absolute inset-0 z-30 pointer-events-none flex items-end justify-center px-4 pb-12" dir="rtl">
      <div style={getPreviewSubtitleStyle()}>{currentSubtitle}</div>
    </div>
  ) : null;

  const logoOverlayJSX = logoUrl ? (
    <div className="absolute top-3 right-3 z-20 pointer-events-none">
      <img src={logoUrl} alt="logo" className="w-10 h-10 object-contain rounded-lg opacity-90" />
    </div>
  ) : null;

  // Always-visible overlay debug strip
  const overlayDebugJSX = videoPreviewUrl ? (
    <div
      className="absolute top-1 left-1 right-1 z-40 pointer-events-none grid grid-cols-1 md:grid-cols-4 gap-1 text-[10px] font-mono leading-tight px-2 py-1 rounded border border-border bg-background/80 text-foreground"
      dir="ltr"
    >
      <span>activeCueIndex: {activeCueIndex ?? -1}</span>
      <span>currentTime: {playbackDebug.currentTime.toFixed(3)}</span>
      <span>activeListeners: {playbackDebug.activeTimeupdateListeners}</span>
      <span className="truncate">activeText: {(currentSubtitle || '').slice(0, 30) || '(empty)'}</span>
    </div>
  ) : null;

  const StepIndicator = () => (
    <div className="flex items-center gap-1 mb-3">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <button
            onClick={() => { if (i === 0 || (i > 0 && videoFile)) setStep(i); }}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
              step === i ? 'bg-primary text-primary-foreground' :
              step > i ? 'bg-primary/20 text-primary' :
              'bg-muted text-muted-foreground'
            )}
          >
            {step > i ? <Check className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
            {s.label}
          </button>
          {i < STEPS.length - 1 && (
            <ChevronLeft className="w-3 h-3 text-muted-foreground/50" />
          )}
        </div>
      ))}
    </div>
  );

  // ── Navigation buttons ──
  const NavButtons = ({ canNext = true }: { canNext?: boolean }) => (
    <div className="flex gap-2 pt-3 border-t border-border/50">
      <button
        onClick={() => setStep(s => s - 1)}
        className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5"
      >
        <ArrowRight className="w-3.5 h-3.5" /> הקודם
      </button>
      <div className="flex-1" />
      {step < STEPS.length - 1 ? (
        <button
          onClick={() => setStep(s => s + 1)}
          disabled={!canNext}
          className="gradient-gold text-primary-foreground px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          הבא <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          onClick={() => setShowCostApproval(true)}
          disabled={rendering || subtitleSegments.length === 0}
          className="gradient-gold text-primary-foreground px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
          {rendering ? `מרכיב... ${Math.round(renderProgress)}%` : '💰 הרכב סרטון סופי (בתשלום) 🎬'}
        </button>
      )}
    </div>
  );

  // ════════════════════════════════════════════
  // STEP 0: Upload
  // ════════════════════════════════════════════
  if (step === 0) return (
    <div className="space-y-4">
      <StepIndicator />
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && file.type.startsWith('video/')) {
            handleVideoSelected(file);
          } else {
            toast.error('יש להעלות קובץ וידאו');
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
        )}
      >
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) {
              handleVideoSelected(f);
            }
          }}
        />
        <Upload className={cn('w-12 h-12 mx-auto mb-3', isDragging ? 'text-primary' : 'text-muted-foreground')} />
        <p className="text-sm font-medium">גרור סרטון לכאן או לחץ לבחירה</p>
        <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM</p>
      </div>
    </div>
  );

  // ════════════════════════════════════════════
  // STEP 1: Subtitles — edit text, timing, gaps
  // ════════════════════════════════════════════
  if (step === 1) return (
    <div className="space-y-3">
      <StepIndicator />
      <div className="relative">
        {videoPreviewJSX}
        {overlayDebugJSX}
        {captionOverlayJSX}
        {logoOverlayJSX}
      </div>

      {videoLoadError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive" dir="rtl">
          <div className="font-semibold mb-1">⚠️ שגיאת טעינת וידאו</div>
          <div className="break-words">{videoLoadError}</div>
          <div className="text-xs mt-1 text-muted-foreground" dir="ltr">
            src type: {videoPreviewUrl?.startsWith('blob:') ? 'local blob' : 'remote URL'}
          </div>
        </div>
      )}

      {/* Transcribe health + controls */}
      <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs" dir="rtl">
          <span className="font-semibold">מצב כלי תמלול:</span>
          <span className={cn(
            'px-2 py-0.5 rounded-full border',
            transcriptionHealth.state === 'ok' && 'border-primary/40 text-primary bg-primary/10',
            transcriptionHealth.state === 'fail' && 'border-destructive/40 text-destructive bg-destructive/10',
            transcriptionHealth.state === 'testing' && 'border-border text-foreground bg-background/60',
            transcriptionHealth.state === 'idle' && 'border-border text-muted-foreground bg-background/60',
          )}>
            {transcriptionHealth.state === 'ok' ? 'OK' : transcriptionHealth.state === 'fail' ? 'FAIL' : transcriptionHealth.state === 'testing' ? 'בודק...' : 'לא נבדק'}
          </span>
          <span className="text-muted-foreground" dir="ltr">
            {transcriptionHealth.provider} • {transcriptionHealth.status ?? '—'}
          </span>
          {transcriptionHealth.checkedAt && (
            <span className="text-muted-foreground" dir="ltr">
              {new Date(transcriptionHealth.checkedAt).toLocaleTimeString('he-IL')}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground" dir="rtl">{transcriptionHealth.reason}</div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleHealthTest}
          disabled={loading || transcriptionHealth.state === 'testing'}
          className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-2 disabled:opacity-50"
        >
          {transcriptionHealth.state === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {transcriptionHealth.state === 'testing' ? 'בודק כלי תמלול...' : 'Test Transcription Tool'}
        </button>

        <button
          onClick={handleTranscribe}
          disabled={loading || transcriptionHealth.state === 'fail'}
          className="gradient-gold text-primary-foreground px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Subtitles className="w-4 h-4" />}
          {loading ? 'מתמלל...' : 'תמלל אוטומטית'}
        </button>

        {subtitleSegments.length > 0 && (
          <>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={cn('px-3 py-2 border rounded-lg text-sm flex items-center gap-2',
                showPreview ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}
            >
              <Eye className="w-4 h-4" /> תצוגה חיה
            </button>
            <button
              onClick={handlePlayFullVideo}
              className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> נגן וידאו מלא
            </button>
            <button
              onClick={() => {
                const srt = subtitleService.toSRT(getAdjustedSegments());
                const blob = new Blob(['\uFEFF' + srt], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url; link.download = `subtitles-${Date.now()}.srt`;
                document.body.appendChild(link); link.click();
                document.body.removeChild(link); URL.revokeObjectURL(url);
                toast.success('SRT הורד!');
              }}
              className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> SRT
            </button>
          </>
        )}
      </div>

      {transcribeFailure && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs space-y-1" dir="rtl">
          <div className="font-semibold text-destructive">שגיאת תמלול</div>
          <div className="text-destructive break-words">{transcribeFailure.message}</div>
          <div className="text-muted-foreground" dir="ltr">
            provider: {transcribeFailure.provider} • status: {transcribeFailure.status ?? '—'}
          </div>
        </div>
      )}

      {transcribeDebug && (
        <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2 text-xs">
          <div className="font-semibold text-foreground">דיבאג תמלול</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5" dir="ltr">
            <div><span className="text-muted-foreground">provider:</span> {transcribeDebug.provider}</div>
            <div><span className="text-muted-foreground">status:</span> {transcribeDebug.status}</div>
            <div><span className="text-muted-foreground">captions:</span> {transcribeDebug.totalCueCount}</div>
            <div><span className="text-muted-foreground">source HTTP:</span> {transcribeDebug.sourceAudioHttpStatus ?? '—'}</div>
            <div className="md:col-span-2 break-all"><span className="text-muted-foreground">videoUrl:</span> {transcribeDebug.videoUrl}</div>
            <div className="md:col-span-2 break-all"><span className="text-muted-foreground">sourceAudioUrl:</span> {transcribeDebug.sourceAudioUrl}</div>
            <div><span className="text-muted-foreground">videoDuration:</span> {transcribeDebug.videoDuration.toFixed(3)}s</div>
            <div><span className="text-muted-foreground">checkedAt:</span> {new Date(transcribeDebug.sourceAudioCheckedAt).toLocaleTimeString('he-IL')}</div>
          </div>

          <div className="space-y-1">
            <div className="text-muted-foreground">First cue preview:</div>
            <div className="bg-background border border-border rounded px-2 py-1" dir="rtl">
              {transcribeDebug.firstCues[0]?.text || 'אין טקסט'}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-muted-foreground">First 5 cues:</div>
            <div className="space-y-1" dir="ltr">
              {transcribeDebug.firstCues.map((cue, idx) => (
                <div key={`${cue.startSec}-${cue.endSec}-${idx}`} className="bg-background border border-border rounded px-2 py-1">
                  <span className="text-muted-foreground">#{idx + 1}</span>{' '}
                  {cue.startSec.toFixed(3)} → {cue.endSec.toFixed(3)} | {cue.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {videoPreviewUrl && (
        <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2 text-xs" dir="ltr">
          <div className="font-semibold text-foreground" dir="rtl">דיבאג נגן חי</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            <div><span className="text-muted-foreground">readyState:</span> {playbackDebug.readyState}</div>
            <div><span className="text-muted-foreground">currentTime:</span> {playbackDebug.currentTime.toFixed(3)}</div>
            <div><span className="text-muted-foreground">startSec:</span> {playbackDebug.startSec !== null ? playbackDebug.startSec.toFixed(3) : '—'}</div>
            <div><span className="text-muted-foreground">endSec:</span> {playbackDebug.endSec !== null ? playbackDebug.endSec.toFixed(3) : '—'}</div>
            <div><span className="text-muted-foreground">activeListeners:</span> {playbackDebug.activeTimeupdateListeners}</div>
            <div><span className="text-muted-foreground">timeupdate/sec:</span> {playbackDebug.timeupdateEventsPerSecond.toFixed(1)}</div>
          </div>
          {playbackDebug.playError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded px-2 py-1 text-destructive break-words">
              {playbackDebug.playError}
            </div>
          )}
        </div>
      )}

      {/* Subtitle segments with gap controls */}
      {subtitleSegments.length > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              כתוביות ({subtitleSegments.length})
            </h4>
          </div>

          <div className="space-y-0 max-h-[320px] overflow-y-auto pr-1">
            {subtitleSegments.map((seg, i) => {
              const gap = i < subtitleSegments.length - 1
                ? subtitleSegments[i + 1].start - seg.end
                : null;

              return (
                <div key={i}>
                  {/* Segment card */}
                  <div
                    className={cn(
                      'bg-muted/30 rounded-lg p-2.5 border transition-all',
                      editingIndex === i ? 'border-primary/50 bg-primary/5' : 'border-border/50'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5" dir="ltr">
                      <input type="number" step="0.1" min="0" value={seg.start}
                        onChange={e => updateSegment(i, { start: Number(e.target.value) })}
                        className="w-14 bg-background border border-border rounded px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                        title="התחלה" />
                      <span className="text-xs text-muted-foreground">—</span>
                      <input type="number" step="0.1" min="0" value={seg.end}
                        onChange={e => updateSegment(i, { end: Number(e.target.value) })}
                        className="w-14 bg-background border border-border rounded px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                        title="סיום" />
                      <span className="text-[10px] text-muted-foreground">({(seg.end - seg.start).toFixed(1)}s)</span>
                      <div className="mr-auto flex items-center gap-0.5">
                        <button onClick={() => seekToSegment(seg, i)} title="נגן"
                          className={cn("p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground", (playingSegIndex === i || activeCueIndex === i) && "text-primary bg-primary/10")}>
                          <Play className="w-3 h-3" />
                        </button>
                        <button onClick={() => splitSegment(i)} title="פצל"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Scissors className="w-3 h-3" />
                        </button>
                        <button onClick={() => deleteSegment(i)} title="מחק"
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <input
                      value={seg.text}
                      onFocus={() => setEditingIndex(i)}
                      onChange={e => updateSegment(i, { text: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      dir="rtl"
                      placeholder="טקסט כתובית..."
                    />
                    {editingIndex === i && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {emojiOptions.map(emoji => (
                          <button key={emoji} onClick={() => addEmoji(i, emoji)}
                            className="w-6 h-6 rounded hover:bg-muted text-sm flex items-center justify-center">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Gap control between segments */}
                  {gap !== null && (
                    <div className="flex items-center justify-center gap-2 py-1 group">
                      <div className="h-px flex-1 bg-border/30" />
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <button
                          onClick={() => addGapBetween(i, -0.3)}
                          className="w-5 h-5 rounded-full border border-border hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="צמצם רווח"
                        >
                          −
                        </button>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-medium',
                          gap > 0.3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        )}>
                          ⏸ {gap.toFixed(1)}s
                        </span>
                        <button
                          onClick={() => addGapBetween(i, 0.3)}
                          className="w-5 h-5 rounded-full border border-border hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="הגדל רווח"
                        >
                          +
                        </button>
                        <button
                          onClick={() => addSegment(i)}
                          className="w-5 h-5 rounded-full border border-primary/50 hover:bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="הוסף כתובית כאן"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="h-px flex-1 bg-border/30" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Global offset */}
          <div className="bg-card border border-border rounded-lg p-3 mt-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">סנכרון כללי</label>
              <span className="text-xs font-medium text-primary">{subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s</span>
            </div>
            <input type="range" min="-3" max="3" step="0.1" value={subtitleOffset}
              onChange={e => setSubtitleOffset(Number(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between mt-1">
              <button onClick={() => setSubtitleOffset(o => Math.max(-3, o - 0.2))}
                className="text-[10px] text-muted-foreground hover:text-foreground">◀ מוקדם</button>
              <button onClick={() => setSubtitleOffset(0)}
                className="text-[10px] text-primary hover:underline">איפוס</button>
              <button onClick={() => setSubtitleOffset(o => Math.min(3, o + 0.2))}
                className="text-[10px] text-muted-foreground hover:text-foreground">מאוחר ▶</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Subtitles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">לחץ "תמלל אוטומטית" כדי להתחיל</p>
        </div>
      )}

      <NavButtons canNext={subtitleSegments.length > 0} />
    </div>
  );

  // ════════════════════════════════════════════
  // STEP 2: Style — fonts, colors, size
  // ════════════════════════════════════════════
  if (step === 2) return (
    <div className="space-y-3">
      <StepIndicator />
      <div className="relative">
        {videoPreviewJSX}
        {overlayDebugJSX}
        {captionOverlayJSX}
        {logoOverlayJSX}
      </div>

      {/* Font presets grid */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">סגנון כתוביות</h4>
        <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
          {fontPresets.map(preset => (
            <button
              key={preset.id}
              onClick={() => {
                setSelectedFont(preset.id);
                if ((preset as any).textColor) setCustomColor((preset as any).textColor);
                else setCustomColor('#FFFFFF');
              }}
              className={cn(
                'p-3 rounded-lg border text-right transition-all',
                selectedFont === preset.id
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border hover:bg-muted'
              )}
            >
              <div className="text-xs font-medium mb-1.5">{preset.label}</div>
              <div
                className="text-xs px-2 py-1 rounded inline-block"
                style={{
                  fontFamily: preset.font,
                  color: (preset as any).textColor || '#FFFFFF',
                  background: preset.bgColor === 'transparent' ? 'rgba(0,0,0,0.5)' : preset.bgColor,
                  fontWeight: preset.fontWeight,
                  textShadow: preset.shadow,
                  borderRadius: `${preset.borderRadius}px`,
                }}
                dir="rtl"
              >
                {preset.preview}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">צבע טקסט</h4>
        <div className="flex gap-2 flex-wrap">
          {colorOptions.map(c => (
            <button
              key={c.value}
              onClick={() => setCustomColor(c.value)}
              className={cn(
                'w-8 h-8 rounded-full border-2 transition-all',
                customColor === c.value ? 'border-primary scale-110 shadow-lg' : 'border-border/50'
              )}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* Font size */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">גודל</h4>
        <div className="flex gap-2">
          {fontSizeOptions.map(s => (
            <button
              key={s.value}
              onClick={() => setCustomFontSize(s.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-xs font-bold transition-all',
                customFontSize === s.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <NavButtons />
    </div>
  );

  // ════════════════════════════════════════════
  // STEP 3: Extras — music, logo, stickers, render
  // ════════════════════════════════════════════
  if (step === 3) return (
    <div className="space-y-3">
      <StepIndicator />
      <div className="relative">
        <VideoPreview />
        {overlayDebugJSX}
        {captionOverlayJSX}
        {logoOverlayJSX}
      </div>

      {/* Music section */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5" /> מוזיקת רקע
        </h4>
        <div className="grid grid-cols-3 gap-1.5">
          {bgMusicOptions.map(m => (
            <button
              key={m.id}
              onClick={() => {
                setSelectedMusic(m.id);
                if (m.id !== 'none') generateMusic(m.id);
                else setMusicAudioUrl(null);
              }}
              className={cn(
                'px-2 py-2 rounded-lg text-xs border transition-all text-center',
                selectedMusic === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
              )}
            >
              <div className="text-lg mb-0.5">{m.emoji}</div>
              {m.label}
            </button>
          ))}
        </div>
        {musicLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-3">
            <Loader2 className="w-4 h-4 animate-spin" /> מייצר מוזיקה...
          </div>
        )}
        {musicAudioUrl && (
          <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-2 border border-border/50">
            <button
              onClick={() => {
                if (!musicAudioRef.current) return;
                if (musicPlaying) musicAudioRef.current.pause();
                else musicAudioRef.current.play();
                setMusicPlaying(!musicPlaying);
              }}
              className="w-8 h-8 gradient-gold text-primary-foreground rounded-full flex items-center justify-center text-xs shrink-0"
            >
              {musicPlaying ? '⏸' : '▶'}
            </button>
            <audio ref={musicAudioRef} src={musicAudioUrl} onEnded={() => setMusicPlaying(false)} className="flex-1 h-8" controls />
          </div>
        )}
      </div>

      {/* Logo section */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5" /> לוגו
        </h4>
        {logoUrl ? (
          <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border/50">
            <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded-lg border border-border" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">יופיע בפינה הימנית העליונה</p>
              <button onClick={() => setLogoUrl(null)}
                className="text-xs text-destructive hover:underline flex items-center gap-1 mt-1">
                <Trash2 className="w-3 h-3" /> הסר
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => logoInputRef.current?.click()}
            className="border border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 transition-all"
          >
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
            />
            {logoUploading ? (
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
            ) : (
              <>
                <Image className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">העלה לוגו</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Stickers section */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Sticker className="w-3.5 h-3.5" /> סטיקרים ואייקונים
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {stickerOptions.map(emoji => (
            <button
              key={emoji}
              onClick={() => addSticker(emoji)}
              className="w-9 h-9 rounded-lg border border-border hover:bg-muted hover:border-primary/40 flex items-center justify-center text-lg transition-all"
            >
              {emoji}
            </button>
          ))}
        </div>
        {stickers.length > 0 && (
          <div className="space-y-1.5 mt-1">
            <h5 className="text-[10px] font-medium text-muted-foreground">נוספו ({stickers.length})</h5>
            {stickers.map(sticker => (
              <div key={sticker.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2 border border-border/50">
                <span className="text-lg">{sticker.emoji}</span>
                <select
                  value={sticker.position}
                  onChange={e => setStickers(prev => prev.map(s =>
                    s.id === sticker.id ? { ...s, position: e.target.value as any } : s
                  ))}
                  className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs"
                >
                  <option value="topLeft">שמאל עליון</option>
                  <option value="topRight">ימין עליון</option>
                  <option value="bottomLeft">שמאל תחתון</option>
                  <option value="bottomRight">ימין תחתון</option>
                  <option value="center">מרכז</option>
                </select>
                <input type="number" step="0.5" min="0" value={sticker.startTime}
                  onChange={e => setStickers(prev => prev.map(s =>
                    s.id === sticker.id ? { ...s, startTime: Number(e.target.value) } : s
                  ))}
                  className="w-12 bg-background border border-border rounded px-1 py-1 text-xs text-center" title="התחלה" />
                <input type="number" step="0.5" min="0.5" value={sticker.duration}
                  onChange={e => setStickers(prev => prev.map(s =>
                    s.id === sticker.id ? { ...s, duration: Number(e.target.value) } : s
                  ))}
                  className="w-12 bg-background border border-border rounded px-1 py-1 text-xs text-center" title="משך" />
                <button onClick={() => removeSticker(sticker.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Render action */}
      <NavButtons />

      {/* Render progress */}
      {rendering && (
        <div className="bg-card border border-primary/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">מרכיב סרטון...</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="gradient-gold h-2 rounded-full transition-all duration-500" style={{ width: `${renderProgress}%` }} />
          </div>
        </div>
      )}

      {/* Result */}
      {renderedVideoUrl && (
        <div className="bg-card border border-green-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-sm font-bold">הסרטון מוכן!</span>
          </div>
          <video src={renderedVideoUrl} controls className="w-full rounded-lg max-h-[300px]" />
          <a href={renderedVideoUrl} download={`edited-video-${Date.now()}.mp4`}
            className="w-full gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> הורד סרטון
          </a>
        </div>
      )}
    </div>
  );

  return (
    <>
      {null}
      <CostApprovalDialog
        open={showCostApproval}
        onOpenChange={setShowCostApproval}
        estimates={buildSubtitleRenderEstimates()}
        onApprove={() => { setShowCostApproval(false); handleRenderVideo(); }}
        title="אישור הרכבת סרטון בתשלום"
      />
    </>
  );
}
