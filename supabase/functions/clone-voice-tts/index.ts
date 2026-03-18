import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const scriptToSafeNarration = (value: string) =>
  value.replace(/\s+/g, " ").trim().slice(0, 4800);

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

const downloadVoiceSample = async (
  audioUrl: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ arrayBuffer: ArrayBuffer; contentType: string; ext: string }> => {
  // Try direct public URL first
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

  // Fallback: download via service role from storage path
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

    const { audioUrl, scriptText } = await req.json();

    if (!audioUrl || !scriptText?.trim()) {
      return new Response(JSON.stringify({ error: "יש לספק קובץ אודיו וטקסט לקריינות" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeScript = scriptToSafeNarration(scriptText);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Download the user's recorded audio
    console.log("Downloading voice sample from:", audioUrl);
    const sample = await downloadVoiceSample(audioUrl, supabase);

    if (sample.arrayBuffer.byteLength < 5000) {
      throw new Error("דגימת הקול קצרה מדי. הקלט לפחות 5-10 שניות ודבר בצורה ברורה.");
    }

    // Step 2: Clone voice via ElevenLabs Instant Voice Cloning
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
      const errText = await cloneResponse.text();
      console.error("Voice clone error:", cloneResponse.status, errText);
      throw new Error("שגיאה בשכפול הקול");
    }

    const { voice_id } = await cloneResponse.json();
    console.log("Voice cloned successfully, voice_id:", voice_id);

    // Step 3: Generate TTS with cloned voice
    console.log("Generating TTS narration...");
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: safeScript,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.85,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error("TTS error:", ttsResponse.status, errText);
      throw new Error("שגיאה ביצירת קריינות");
    }

    const ttsAudioBuffer = await ttsResponse.arrayBuffer();
    console.log("TTS audio generated, size:", ttsAudioBuffer.byteLength);

    // Step 4: Upload generated audio to storage
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("clone-voice-tts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה בשכפול קול ויצירת קריינות" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
