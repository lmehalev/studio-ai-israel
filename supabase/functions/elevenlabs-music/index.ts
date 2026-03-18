// Deno.serve used natively

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

    const body = await req.json();
    const { action } = body;

    // ====== Generate Music ======
    if (action === "music" || !action) {
      const { prompt, duration } = body;
      if (!prompt) {
        return new Response(
          JSON.stringify({ error: "חסר פרומפט למוזיקה" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch("https://api.elevenlabs.io/v1/music", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          duration_seconds: duration || 30,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("ElevenLabs music error:", response.status, errText);
        throw new Error(`ElevenLabs music error: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      return new Response(audioBuffer, {
        headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
      });
    }

    // ====== Generate Sound Effects ======
    if (action === "sound_effect") {
      const { text, duration_seconds } = body;
      if (!text) {
        return new Response(
          JSON.stringify({ error: "חסר תיאור לאפקט סאונד" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          duration_seconds: duration_seconds || undefined,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("ElevenLabs SFX error:", response.status, errText);
        throw new Error(`ElevenLabs SFX error: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      return new Response(audioBuffer, {
        headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
      });
    }

    // ====== Voice Isolation (Remove background noise / separate vocals) ======
    if (action === "isolate") {
      const { audioBase64 } = body;
      if (!audioBase64) {
        return new Response(
          JSON.stringify({ error: "חסר קובץ אודיו לבידוד" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Decode base64 to binary
      const binaryStr = atob(audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const formData = new FormData();
      formData.append("audio", new Blob([bytes], { type: "audio/mpeg" }), "audio.mp3");

      const response = await fetch("https://api.elevenlabs.io/v1/audio-isolation", {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("ElevenLabs isolation error:", response.status, errText);
        throw new Error(`ElevenLabs isolation error: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      return new Response(audioBuffer, {
        headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
      });
    }

    // ====== List Available Voices ======
    if (action === "list_voices") {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs voices error: ${response.status}`);
      }

      const data = await response.json();
      const voices = (data.voices || []).map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        labels: v.labels,
        preview_url: v.preview_url,
      }));

      return new Response(
        JSON.stringify({ voices }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "פעולה לא מוכרת. השתמש ב: music, sound_effect, isolate, list_voices" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("elevenlabs-music error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
