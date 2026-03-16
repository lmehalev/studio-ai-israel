import { supabase } from "@/integrations/supabase/client";

// ====== File Upload Service ======
export const storageService = {
  /**
   * Upload a file via the storage-manager edge function (uses service role, no RLS issues).
   */
  upload: async (file: File): Promise<string> => {
    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    const { data, error } = await supabase.functions.invoke("storage-manager", {
      body: {
        action: "upload",
        fileName: file.name,
        fileType: file.type,
        fileBase64: base64,
      },
    });
    if (error) throw new Error(error.message || 'שגיאה בהעלאת קובץ');
    if (data?.error) throw new Error(data.error);
    return data.publicUrl;
  },
};

// ====== Image Generation Service ======
export const imageService = {
  generate: async (prompt: string, referenceImages?: string[]): Promise<{ imageUrl: string; text: string }> => {
    const { data, error } = await supabase.functions.invoke("generate-image", {
      body: { prompt, action: "generate", referenceImages },
    });
    if (error) throw new Error(error.message || "שגיאה ביצירת תמונה");
    if (data?.error) throw new Error(data.error);
    return data;
  },

  edit: async (prompt: string, imageUrl: string): Promise<{ imageUrl: string; text: string }> => {
    const { data, error } = await supabase.functions.invoke("generate-image", {
      body: { prompt, action: "edit", imageUrl },
    });
    if (error) throw new Error(error.message || "שגיאה בעריכת תמונה");
    if (data?.error) throw new Error(data.error);
    return data;
  },
};

// ====== Voice Generation Service (ElevenLabs) ======
export const voiceService = {
  generate: async (text: string, voiceId?: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("text-to-speech", {
      body: { text, voiceId },
    });
    if (error) throw new Error(error.message || "שגיאה ביצירת קול");
    if (data instanceof Blob) {
      return URL.createObjectURL(data);
    }
    if (data?.error) throw new Error(data.error);
    throw new Error("תגובה לא צפויה מהשרת");
  },

  /**
   * Generate TTS and upload to cloud storage, returning a public URL
   * suitable for use with Shotstack / D-ID compositing.
   */
  generateAndUpload: async (text: string, voiceId?: string): Promise<string> => {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const safeText = normalizedText.length > 4500 ? `${normalizedText.slice(0, 4500)}...` : normalizedText;
    if (!safeText) throw new Error('אין טקסט לקריינות');

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ text: safeText, voiceId }),
    });

    if (!response.ok) {
      let apiError = `שגיאה ביצירת קריינות: ${response.status}`;
      try {
        const data = await response.json();
        if (data?.error) apiError = data.error;
      } catch {
        // ignore json parsing issues
      }
      throw new Error(apiError);
    }

    const blob = await response.blob();
    const file = new File([blob], `narration-${Date.now()}.mp3`, { type: 'audio/mpeg' });
    return storageService.upload(file);
  },
};

// ====== Avatar Generation Service (AI) ======
export const avatarGenService = {
  generate: async (
    imageUrls: string[],
    style?: string,
    options?: { baseAvatarUrl?: string; strictIdentity?: boolean; expression?: string }
  ): Promise<{ imageUrl: string | null; text: string }> => {
    const { data, error } = await supabase.functions.invoke("generate-avatar", {
      body: { imageUrls, style, ...options },
    });
    if (error) throw new Error(error.message || "שגיאה ביצירת אווטאר");
    if (data?.error) throw new Error(data.error);
    return data;
  },
};

// ====== Avatar DB Service (CRUD) ======
export const avatarDbService = {
  list: async () => {
    const { data, error } = await supabase.functions.invoke("avatar-manager", {
      body: { action: "list" },
    });
    if (error) throw new Error(error.message || "שגיאה בטעינת אווטארים");
    if (data?.error) throw new Error(data.error);
    return data.avatars || [];
  },

  save: async (name: string, imageUrl: string, style: string, sourcePhotos: string[]) => {
    const { data, error } = await supabase.functions.invoke("avatar-manager", {
      body: { action: "save", name, image_url: imageUrl, style, source_photos: sourcePhotos },
    });
    if (error) throw new Error(error.message || "שגיאה בשמירת אווטאר");
    if (data?.error) throw new Error(data.error);
    return data.avatar;
  },

  remove: async (id: string) => {
    const { data, error } = await supabase.functions.invoke("avatar-manager", {
      body: { action: "delete", id },
    });
    if (error) throw new Error(error.message || "שגיאה במחיקת אווטאר");
    if (data?.error) throw new Error(data.error);
  },
};

// ====== Voice Clone + TTS Service ======
export const voiceCloneService = {
  cloneAndSpeak: async (audioUrl: string, scriptText: string): Promise<{ audioUrl: string; voiceId: string }> => {
    const { data, error } = await supabase.functions.invoke("clone-voice-tts", {
      body: { audioUrl, scriptText },
    });
    if (error) throw new Error(error.message || "שגיאה בשכפול קול");
    if (data?.error) throw new Error(data.error);
    return data;
  },
};

// ====== Video Compositing Service (Shotstack) ======
export const composeService = {
  render: async (params: {
    videoUrl: string;
    scenes: any[];
    logoUrl?: string;
    brandColors?: string[];
    audioUrl?: string;
  }): Promise<{ renderId: string; status: string }> => {
    const { data, error } = await supabase.functions.invoke("compose-video", {
      body: { action: "render", ...params },
    });
    if (error) throw new Error(error.message || "שגיאה בהרכבת סרטון");
    if (data?.error) throw new Error(data.error);
    return data;
  },

  checkStatus: async (renderId: string): Promise<{ status: string; url: string | null; progress: number }> => {
    const { data, error } = await supabase.functions.invoke("compose-video", {
      body: { action: "check_status", renderId },
    });
    if (error) throw new Error(error.message || "שגיאה בבדיקת סטטוס");
    if (data?.error) throw new Error(data.error);
    return data;
  },
};

// ====== D-ID Avatar Service ======
export const didService = {
  createTalk: async (imageUrl: string, text?: string, voiceId?: string, audioUrl?: string): Promise<{ id: string; status: string }> => {
    const { data, error } = await supabase.functions.invoke("did-avatar", {
      body: { action: "create_talk", imageUrl, text, voiceId, audioUrl },
    });
    if (error) throw new Error(error.message || "שגיאה ביצירת אווטאר מדבר");
    if (data?.error) throw new Error(data.error);
    return data;
  },

  checkStatus: async (talkId: string): Promise<{ status: string; resultUrl: string | null; thumbnailUrl: string | null }> => {
    const { data, error } = await supabase.functions.invoke("did-avatar", {
      body: { action: "check_status", talkId },
    });
    if (error) throw new Error(error.message || "שגיאה בבדיקת סטטוס");
    if (data?.error) throw new Error(data.error);
    return data;
  },

  listPresenters: async () => {
    const { data, error } = await supabase.functions.invoke("did-avatar", {
      body: { action: "list_presenters" },
    });
    if (error) throw new Error(error.message || "שגיאה בטעינת דמויות");
    if (data?.error) throw new Error(data.error);
    return data.actors || [];
  },
};

// ====== Transcription / Subtitles Service ======
export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

export const subtitleService = {
  transcribe: async (audioBase64: string, language: string = 'עברית'): Promise<{ segments: SubtitleSegment[] }> => {
    const { data, error } = await supabase.functions.invoke("transcribe-audio", {
      body: { audioBase64, language },
    });
    if (error) throw new Error(error.message || "שגיאה בתמלול");
    if (data?.error) throw new Error(data.error);
    return data;
  },

  toSRT: (segments: SubtitleSegment[]): string => {
    return segments.map((seg, i) => {
      const formatTime = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.round((s % 1) * 1000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
      };
      return `${i + 1}\n${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text}\n`;
    }).join('\n');
  },
};

// ====== RunwayML Video Service ======
export const runwayService = {
  imageToVideo: async (promptImage: string, promptText: string, model?: string, duration?: number, ratio?: string) => {
    const { data, error } = await supabase.functions.invoke("runway-video", {
      body: { action: "image_to_video", promptImage, promptText, model, duration, ratio },
    });
    if (error) throw new Error(error.message || "שגיאה ביצירת וידאו");
    if (data?.error) throw new Error(data.error);
    return data as { taskId: string };
  },

  textToVideo: async (promptText: string, model?: string, duration?: number, ratio?: string) => {
    const { data, error } = await supabase.functions.invoke("runway-video", {
      body: { action: "text_to_video", promptText, model, duration, ratio },
    });
    if (error) throw new Error(error.message || "שגיאה ביצירת וידאו");
    if (data?.error) throw new Error(data.error);
    return data as { taskId: string };
  },

  checkStatus: async (taskId: string) => {
    const { data, error } = await supabase.functions.invoke("runway-video", {
      body: { action: "check_status", taskId },
    });
    if (error) throw new Error(error.message || "שגיאה בבדיקת סטטוס");
    if (data?.error) throw new Error(data.error);
    return data as { status: string; progress: number; resultUrl: string | null; failureReason: string | null };
  },
};

// ====== Prompt Enhancement Service ======
export const promptEnhanceService = {
  enhance: async (text: string, type: "enhance" | "script" = "enhance") => {
    const { data, error } = await supabase.functions.invoke("enhance-prompt", {
      body: { text, type },
    });
    if (error) throw new Error(error.message || "שגיאה בשיפור הפרומפט");
    if (data?.error) throw new Error(data.error);
    return data;
  },
};

// ====== Brand Management (Local Storage) ======
export interface Brand {
  id: string;
  name: string;
  logo?: string;
  colors: string[];
  tone: string;
  targetAudience: string;
  industry: string;
  departments?: string[];
}

const BRANDS_KEY = "creative_studio_brands";

export const brandService = {
  getAll: (): Brand[] => {
    try {
      const raw = localStorage.getItem(BRANDS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  save: (brands: Brand[]) => {
    localStorage.setItem(BRANDS_KEY, JSON.stringify(brands));
  },

  add: (brand: Brand) => {
    const brands = brandService.getAll();
    brands.push(brand);
    brandService.save(brands);
    return brands;
  },

  update: (id: string, updates: Partial<Brand>) => {
    const brands = brandService.getAll().map(b => b.id === id ? { ...b, ...updates } : b);
    brandService.save(brands);
    return brands;
  },

  remove: (id: string) => {
    const brands = brandService.getAll().filter(b => b.id !== id);
    brandService.save(brands);
    return brands;
  },
};

// ====== Website Scraper Service (Firecrawl) ======
export interface WebsiteScrapeResult {
  screenshot?: string;
  markdown?: string;
  branding?: {
    logo?: string;
    colors?: Record<string, string>;
    fonts?: { family: string }[];
    colorScheme?: string;
  };
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
  };
  links?: string[];
}

export const websiteScraperService = {
  scrape: async (url: string): Promise<WebsiteScrapeResult> => {
    const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
      body: {
        url,
        options: {
          formats: ['markdown', 'screenshot', 'branding'],
          onlyMainContent: true,
          waitFor: 3000,
        },
      },
    });
    if (error) throw new Error(error.message || 'שגיאה בסריקת האתר');
    if (data?.success === false) throw new Error(data.error || 'שגיאה בסריקת האתר');

    // Firecrawl nests inside data.data
    const result = data?.data || data;
    return {
      screenshot: result?.screenshot,
      markdown: result?.markdown,
      branding: result?.branding,
      metadata: result?.metadata,
      links: result?.links,
    };
  },
};
