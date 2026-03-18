import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HEBREW_WARNING = "הקול שנבחר לא תומך בעברית בצורה טובה. בחר קול אחר או שנה הגדרות.";

const scriptToSafeNarration = (value: string) => value.slice(0, 4800);

const extFromMime = (contentType: string, fallbackFromUrl = "webm") => {
  if (contentType.includes("audio/mpeg") || contentType.includes("audio/mp3")) return "mp3";
  if (contentType.includes("audio/wav") || contentType.includes("audio/x-wav")) return "wav";
  if (contentType.includes("audio/ogg")) return "ogg";
  if (contentType.includes("audio/mp4") || contentType.includes("audio/x-m4a") || contentType.includes("audio/m4a")) return "m4a";
  if (contentType.includes("audio/webm")) return "webm";
  return fallbackFromUrl;
};

const extractStoragePathFromUrl = (audioUrl: string): string | null => {
  try {
    const parsed = new URL(audioUrl);
    const marker = "/storage/v1/object/public/media/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    const rawPath = parsed.pathname.slice(idx + marker.length);
    return decodeURIComponent(rawPath);
  } catch {
    return null;
  }
};

const parseProviderErrorBody = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const providerErrorResponse = (params: {
  status: number;
  error: string;
  providerError: unknown;
  modelId?: string;
  language?: string;
}) =>
  new Response(
    JSON.stringify({
      functionName: "clone-voice-tts",
      provider: "ElevenLabs",
      providerStatus: params.status,
      modelId: params.modelId,
      language: params.language,
      error: params.error,
      providerError: params.providerError,
    }),
    {
      status: params.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );

const downloadVoiceSample = async (
  audioUrl: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ arrayBuffer: ArrayBuffer; contentType: string; ext: string }> => {
  const directResponse = await fetch(audioUrl);
  if (directResponse.ok) {
    const contentType = directResponse.headers.get("content-type") || "audio/webm";
    const ext = extFromMime(contentType, "webm");
    return {
      arrayBuffer: await directResponse.arrayBuffer(),
      contentType,
      ext,
    };
  }

  const storagePath = extractStoragePathFromUrl(audioUrl);
  if (storagePath) {
    const { data, error } = await supabase.storage.from("media").download(storagePath);
    if (!error && data) {
      const contentType = data.type || "audio/webm";
      const ext = extFromMime(contentType, storagePath.split(".").pop() || "webm");
      return {
        arrayBuffer: await data.arrayBuffer(),
        contentType,
        ext,
      };
    }
  }

  throw new Error("קובץ הקול לא נמצא באחסון. העלה/הקלט קול מחדש ונסה שוב.");
};

const languageConfig = {
  he: { languageCode: "he", modelId: "eleven_v3" },
  en: { languageCode: "en", modelId: "eleven_multilingual_v2" },
  ar: { languageCode: "ar", modelId: "eleven_multilingual_v2" },
} as const;

type SupportedLanguage = keyof typeof languageConfig;

const resolveLanguage = (script: string, language?: string): SupportedLanguage => {
  const hasHebrew = /[\u0590-\u05FF]/.test(script);
  if (hasHebrew) return "he";
  if (language === "en" || language === "ar" || language === "he") return language;
  return "en";
};

const fetchAvailableModelIds = async (apiKey: string): Promise<Set<string>> => {
  const response = await fetch("https://api.elevenlabs.io/v1/models", {
    headers: { "xi-api-key": apiKey },
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`מודלים לא זמינים: ${response.status} ${raw}`);
  }

  const models = await response.json();
  const modelIds = new Set<string>();
  if (Array.isArray(models)) {
    for (const model of models) {
      if (typeof model?.model_id === "string") modelIds.add(model.model_id);
    }
  }
  return modelIds;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase admin credentials are not configured");
    }

    const { audioUrl, scriptText, language } = await req.json();

    if (!audioUrl || !scriptText?.trim()) {
      return new Response(JSON.stringify({ error: "יש לספק קובץ אודיו וטקסט לקריינות" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeScript = scriptToSafeNarration(scriptText);
    const selectedLanguage = resolveLanguage(safeScript, language);
    const selectedConfig = languageConfig[selectedLanguage];

    const modelIds = await fetchAvailableModelIds(ELEVENLABS_API_KEY);
    if (!modelIds.has(selectedConfig.modelId)) {
      const message = selectedLanguage === "he" ? HEBREW_WARNING : "המודל שנבחר לא זמין כרגע";
      return providerErrorResponse({
        status: 422,
        error: message,
        providerError: {
          code: "model_not_available",
          message: `Model ${selectedConfig.modelId} is not available for this account`,
        },
        modelId: selectedConfig.modelId,
        language: selectedConfig.languageCode,
      });
    }

    console.log(
      "TTS config:",
      JSON.stringify({ language: selectedLanguage, modelId: selectedConfig.modelId, forcedHebrew: selectedLanguage === "he" })
    );

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Downloading voice sample from:", audioUrl);
    const sample = await downloadVoiceSample(audioUrl, supabase);

    if (sample.arrayBuffer.byteLength < 5000) {
      throw new Error("דגימת הקול קצרה מדי. הקלט לפחות 5-10 שניות ודבר בצורה ברורה.");
    }

    console.log("Cloning voice via ElevenLabs...");
    const formData = new FormData();
    formData.append("name", `studio-clone-${Date.now()}`);
    formData.append(
      "files",
      new Blob([sample.arrayBuffer], { type: sample.contentType }),
      `voice-sample.${sample.ext}`
    );

    const cloneResponse = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: formData,
    });

    if (!cloneResponse.ok) {
      const raw = await cloneResponse.text();
      const providerError = parseProviderErrorBody(raw);
      console.error("Voice clone error:", cloneResponse.status, providerError);
      return providerErrorResponse({
        status: cloneResponse.status,
        error: "שגיאה בשכפול הקול",
        providerError,
        modelId: selectedConfig.modelId,
        language: selectedConfig.languageCode,
      });
    }

    const { voice_id } = await cloneResponse.json();
    console.log("Voice cloned successfully, voice_id:", voice_id);

    console.log("Generating TTS narration...");
    const ttsPayload: Record<string, unknown> = {
      text: safeScript,
      model_id: selectedConfig.modelId,
      language_code: selectedConfig.languageCode,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.9,
        use_speaker_boost: true,
        speed: 1,
      },
    };

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ttsPayload),
      }
    );

    if (!ttsResponse.ok) {
      const raw = await ttsResponse.text();
      const providerError = parseProviderErrorBody(raw);
      console.error("TTS error:", ttsResponse.status, providerError);

      const unsupportedLanguage =
        typeof providerError === "object" &&
        providerError !== null &&
        "detail" in providerError &&
        typeof (providerError as { detail?: { status?: string } }).detail?.status === "string" &&
        (providerError as { detail?: { status?: string } }).detail?.status === "unsupported_language";

      return providerErrorResponse({
        status: ttsResponse.status,
        error: unsupportedLanguage ? HEBREW_WARNING : "שגיאה ביצירת קריינות",
        providerError,
        modelId: selectedConfig.modelId,
        language: selectedConfig.languageCode,
      });
    }

    const ttsAudioBuffer = await ttsResponse.arrayBuffer();
    console.log("TTS audio generated, size:", ttsAudioBuffer.byteLength);

    const filePath = `uploads/tts-narration-${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage.from("media").upload(filePath, ttsAudioBuffer, {
      contentType: "audio/mpeg",
      upsert: false,
    });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("שגיאה בהעלאת קריינות");
    }

    const { data: urlData } = supabase.storage.from("media").getPublicUrl(filePath);

    return new Response(
      JSON.stringify({
        audioUrl: urlData.publicUrl,
        voiceId: voice_id,
        modelId: selectedConfig.modelId,
        language: selectedConfig.languageCode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("clone-voice-tts error:", e);
    return new Response(
      JSON.stringify({
        functionName: "clone-voice-tts",
        error: e instanceof Error ? e.message : "שגיאה בשכפול קול ויצירת קריינות",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
