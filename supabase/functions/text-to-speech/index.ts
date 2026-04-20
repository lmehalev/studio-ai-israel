const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HEBREW_WARNING = "הקול שנבחר לא תומך בעברית בצורה טובה. בחר קול אחר או שנה הגדרות.";

const languageConfig = {
  he: { languageCode: "he", modelId: "eleven_multilingual_v2", omitLanguageCode: true },
  en: { languageCode: "en", modelId: "eleven_multilingual_v2", omitLanguageCode: false },
  ar: { languageCode: "ar", modelId: "eleven_multilingual_v2", omitLanguageCode: false },
} as const;

// Fallback model order — tried if primary model fails with auth/perm error
const FALLBACK_MODELS = ["eleven_multilingual_v2", "eleven_turbo_v2_5", "eleven_turbo_v2"] as const;

type SupportedLanguage = keyof typeof languageConfig;
type LanguageConfig = { languageCode: string; modelId: string; omitLanguageCode: boolean };

const resolveLanguage = (text: string, requestedLanguage?: string): SupportedLanguage => {
  if (/[\u0590-\u05FF]/.test(text)) return "he";
  if (requestedLanguage === "he" || requestedLanguage === "en" || requestedLanguage === "ar") {
    return requestedLanguage;
  }
  return "en";
};

const parseProviderErrorBody = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
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

const providerErrorResponse = (params: {
  status: number;
  error: string;
  providerError: unknown;
  modelId: string;
  language: string;
}) =>
  new Response(
    JSON.stringify({
      functionName: "text-to-speech",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, language } = await req.json();
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");
    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: "יש להזין טקסט לקריינות" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedVoiceId = voiceId || "onwK4e9ZLuTAKqWW03F9";
    const selectedLanguage = resolveLanguage(text, language);
    const selectedConfig = languageConfig[selectedLanguage];

    const modelIds = await fetchAvailableModelIds(ELEVENLABS_API_KEY);
    if (!modelIds.has(selectedConfig.modelId)) {
      return providerErrorResponse({
        status: 422,
        error: selectedLanguage === "he" ? HEBREW_WARNING : "המודל שנבחר לא זמין כרגע",
        providerError: {
          code: "model_not_available",
          message: `Model ${selectedConfig.modelId} is not available for this account`,
        },
        modelId: selectedConfig.modelId,
        language: selectedConfig.languageCode,
      });
    }

    const buildPayload = (modelId: string, langCode: string, omitLang: boolean) => {
      const base: Record<string, unknown> = {
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.85,
          use_speaker_boost: true,
        },
      };
      if (!omitLang) base.language_code = langCode;
      return base;
    };

    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_44100_128`;
    const ttsHeaders = { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" };

    // First attempt with configured model
    let response = await fetch(ttsUrl, {
      method: "POST",
      headers: ttsHeaders,
      body: JSON.stringify(buildPayload(selectedConfig.modelId, selectedConfig.languageCode, selectedConfig.omitLanguageCode)),
    });

    // If auth/perm/bad-request error, retry with fallback models
    if (!response.ok && [400, 401, 403, 422].includes(response.status)) {
      const firstStatus = response.status;
      const firstBody = await response.text();
      console.warn(`ElevenLabs primary model ${selectedConfig.modelId} failed (${firstStatus}): ${firstBody}. Retrying with fallbacks...`);

      let retried = false;
      for (const fallbackModel of FALLBACK_MODELS) {
        if (fallbackModel === selectedConfig.modelId) continue;
        console.log(`Trying fallback model: ${fallbackModel}`);
        const fbResponse = await fetch(ttsUrl, {
          method: "POST",
          headers: ttsHeaders,
          body: JSON.stringify(buildPayload(fallbackModel, selectedConfig.languageCode, fallbackModel === "eleven_multilingual_v2")),
        });
        if (fbResponse.ok) {
          response = fbResponse;
          retried = true;
          console.log(`Fallback model ${fallbackModel} succeeded!`);
          break;
        }
        console.warn(`Fallback model ${fallbackModel} also failed: ${fbResponse.status}`);
      }
      // If all fallbacks failed too, restore the original failed response for error reporting
      if (!retried) {
        // Re-issue original request to get a fresh response object for error reporting
        response = await fetch(ttsUrl, {
          method: "POST",
          headers: ttsHeaders,
          body: JSON.stringify(buildPayload(selectedConfig.modelId, selectedConfig.languageCode, selectedConfig.omitLanguageCode)),
        });
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      const providerError = parseProviderErrorBody(errorText);
      console.error("ElevenLabs error:", response.status, providerError);

      const unsupportedLanguage =
        typeof providerError === "object" &&
        providerError !== null &&
        "detail" in providerError &&
        typeof (providerError as { detail?: { status?: string } }).detail?.status === "string" &&
        (providerError as { detail?: { status?: string } }).detail?.status === "unsupported_language";

      // Build a detailed error message that includes the provider's response
      const providerDetail = typeof providerError === "string"
        ? providerError.slice(0, 300)
        : JSON.stringify(providerError).slice(0, 300);

      return providerErrorResponse({
        status: response.status,
        error: unsupportedLanguage ? HEBREW_WARNING : `שגיאה ביצירת קול (${response.status}): ${providerDetail}`,
        providerError,
        modelId: selectedConfig.modelId,
        language: selectedConfig.languageCode,
      });
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "x-tts-model": selectedConfig.modelId,
        "x-tts-language": selectedConfig.languageCode,
      },
    });
  } catch (e) {
    console.error("TTS error:", e);
    return new Response(
      JSON.stringify({ functionName: "text-to-speech", error: e instanceof Error ? e.message : "שגיאה לא ידועה" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
