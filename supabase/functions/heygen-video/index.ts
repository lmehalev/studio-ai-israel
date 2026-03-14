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
    const { action, avatarId, script, voiceId, aspectRatio } = await req.json();
    const HEYGEN_API_KEY = Deno.env.get("HEYGEN_API_KEY");

    if (!HEYGEN_API_KEY) {
      return new Response(
        JSON.stringify({ error: "מפתח HeyGen API לא מוגדר. יש להוסיף אותו בהגדרות." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create_video") {
      // Create a talking avatar video via HeyGen API v2
      const response = await fetch("https://api.heygen.com/v2/video/generate", {
        method: "POST",
        headers: {
          "X-Api-Key": HEYGEN_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_inputs: [
            {
              character: {
                type: "avatar",
                avatar_id: avatarId || "default",
                avatar_style: "normal",
              },
              voice: {
                type: "text",
                input_text: script,
                voice_id: voiceId,
                speed: 1.0,
              },
            },
          ],
          dimension: aspectRatio === "9:16"
            ? { width: 1080, height: 1920 }
            : aspectRatio === "1:1"
            ? { width: 1080, height: 1080 }
            : { width: 1920, height: 1080 },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("HeyGen create error:", data);
        return new Response(JSON.stringify({ error: `שגיאה ביצירת סרטון: ${data.message || response.status}` }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ videoId: data.data?.video_id, status: "processing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_status") {
      const { videoId } = await req.json();
      const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });

      const data = await response.json();
      return new Response(JSON.stringify({
        status: data.data?.status,
        videoUrl: data.data?.video_url,
        thumbnailUrl: data.data?.thumbnail_url,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_avatars") {
      const response = await fetch("https://api.heygen.com/v2/avatars", {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });

      const data = await response.json();
      return new Response(JSON.stringify({ avatars: data.data?.avatars || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
