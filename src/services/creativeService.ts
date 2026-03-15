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
  generate: async (text: string, voiceId?: string): Promise<Blob> => {
    const { data, error } = await supabase.functions.invoke("text-to-speech", {
      body: { text, voiceId },
    });
    if (error) throw new Error(error.message || "שגיאה ביצירת קול");
    return data;
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
