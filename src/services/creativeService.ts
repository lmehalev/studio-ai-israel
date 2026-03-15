import { supabase } from "@/integrations/supabase/client";

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
    
    // The edge function returns audio/mpeg as ArrayBuffer
    // Convert to blob URL for playback
    if (data instanceof Blob) {
      return URL.createObjectURL(data);
    }
    // If it's JSON with error
    if (data?.error) throw new Error(data.error);
    throw new Error("תגובה לא צפויה מהשרת");
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

  remove: (id: string) => {
    const brands = brandService.getAll().filter(b => b.id !== id);
    brandService.save(brands);
    return brands;
  },
};
