import { supabase } from "@/integrations/supabase/client";

// ====== File Upload Service ======
export const storageService = {
  /**
   * Upload a file to Supabase storage and return the public URL.
   */
  upload: async (file: File): Promise<string> => {
    // First ensure bucket exists via edge function
    await supabase.functions.invoke("storage-manager", {
      body: { action: "init" },
    });

    const path = `uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage
      .from('media')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw new Error(error.message || 'שגיאה בהעלאת קובץ');

    const { data: publicUrlData } = supabase.storage
      .from('media')
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  },
};

// ====== Image Generation Service ======
export const imageService = {
  generate: async (prompt: string): Promise<{ imageUrl: string; text: string }> => {
    const { data, error } = await supabase.functions.invoke("generate-image", {
      body: { prompt, action: "generate" },
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
};

// ====== D-ID Avatar Service ======
export const didService = {
  createTalk: async (imageUrl: string, text: string, voiceId?: string): Promise<{ id: string; status: string }> => {
    const { data, error } = await supabase.functions.invoke("did-avatar", {
      body: { action: "create_talk", imageUrl, text, voiceId },
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
