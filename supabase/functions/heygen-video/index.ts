import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HEYGEN_API = "https://api.heygen.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;
    const HEYGEN_API_KEY = Deno.env.get("HEYGEN_API_KEY");

    if (!HEYGEN_API_KEY) {
      return new Response(
        JSON.stringify({ error: "מפתח HeyGen API לא מוגדר. יש להוסיף אותו בהגדרות." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = {
      "X-Api-Key": HEYGEN_API_KEY,
      "Content-Type": "application/json",
    };

    // ====== Create talking avatar video ======
    if (action === "create_video") {
      const { avatarId, script, voiceId, audioUrl, aspectRatio, avatarStyle } = params;

      const videoInput: any = {
        character: {
          type: "avatar",
          avatar_id: avatarId || "default",
          avatar_style: avatarStyle || "normal",
        },
        voice: voiceId
          ? { type: "text", input_text: script, voice_id: voiceId, speed: 1.0 }
          : audioUrl
            ? { type: "audio", audio_url: audioUrl }
            : { type: "text", input_text: script, voice_id: "he-IL-AvriNeural", speed: 1.0 },
      };

      const dimension = aspectRatio === "9:16"
        ? { width: 1080, height: 1920 }
        : aspectRatio === "1:1"
          ? { width: 1080, height: 1080 }
          : { width: 1920, height: 1080 };

      const response = await fetch(`${HEYGEN_API}/v2/video/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          video_inputs: [videoInput],
          dimension,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("HeyGen create error:", data);
        return new Response(
          JSON.stringify({ error: `שגיאה ביצירת סרטון: ${data.message || data.error || response.status}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ videoId: data.data?.video_id, status: "processing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== Check video status ======
    if (action === "check_status") {
      const { videoId } = params;
      if (!videoId) {
        return new Response(
          JSON.stringify({ error: "חסר videoId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(`${HEYGEN_API}/v1/video_status.get?video_id=${videoId}`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("HeyGen status error:", data);
        return new Response(
          JSON.stringify({ error: `שגיאה בבדיקת סטטוס: ${data.message || response.status}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const status = data.data?.status;
      return new Response(
        JSON.stringify({
          status: status === "completed" ? "done" : status,
          videoUrl: data.data?.video_url || null,
          thumbnailUrl: data.data?.thumbnail_url || null,
          progress: status === "completed" ? 100 : status === "processing" ? 50 : 10,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== List available avatars ======
    if (action === "list_avatars") {
      const response = await fetch(`${HEYGEN_API}/v2/avatars`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });

      const data = await response.json();
      return new Response(
        JSON.stringify({ avatars: data.data?.avatars || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== List available voices ======
    if (action === "list_voices") {
      const response = await fetch(`${HEYGEN_API}/v2/voices`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });

      const data = await response.json();
      return new Response(
        JSON.stringify({ voices: data.data?.voices || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "פעולה לא מוכרת" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("HeyGen error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
