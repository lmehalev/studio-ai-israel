import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    const { audioUrl, scriptText } = await req.json();

    if (!audioUrl || !scriptText?.trim()) {
      return new Response(JSON.stringify({ error: "יש לספק קובץ אודיו וטקסט לקריינות" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit script length for TTS (ElevenLabs max ~5000 chars)
    const safeScript = scriptText.length > 4800 ? `${scriptText.slice(0, 4800)}...` : scriptText;

    // Step 1: Download the user's recorded audio
    console.log("Downloading voice sample from:", audioUrl);
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error("שגיאה בהורדת קובץ הקול");
    const audioArrayBuffer = await audioResponse.arrayBuffer();

    // Step 2: Clone voice via ElevenLabs Instant Voice Cloning
    console.log("Cloning voice via ElevenLabs...");
    const formData = new FormData();
    formData.append("name", `studio-clone-${Date.now()}`);
    formData.append(
      "files",
      new Blob([audioArrayBuffer], { type: "audio/mpeg" }),
      "voice-sample.mp3"
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

    // Step 4: Upload generated audio to Supabase Storage
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const fileName = `tts-narration-${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, ttsAudioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("שגיאה בהעלאת קריינות");
    }

    const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);

    console.log("Narration uploaded:", urlData.publicUrl);

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
