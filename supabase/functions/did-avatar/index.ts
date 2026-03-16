import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DID_API_URL = "https://api.d-id.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DID_API_KEY = Deno.env.get("DID_API_KEY");
    if (!DID_API_KEY) throw new Error("DID_API_KEY is not configured");

    const { action, ...params } = await req.json();

    const headers = {
      Authorization: `Basic ${DID_API_KEY}`,
      "Content-Type": "application/json",
    };

    // ====== Create talking avatar video ======
    if (action === "create_talk") {
      const { imageUrl, text, voiceId, language } = params;

      const body: any = {
        source_url: imageUrl,
        script: {
          type: "text",
          input: text,
          provider: {
            type: "microsoft",
            voice_id: voiceId || "he-IL-AvriNeural",
          },
        },
        config: {
          stitch: true,
          result_format: "mp4",
        },
      };

      // If ElevenLabs voice is provided
      if (voiceId && voiceId.length > 15) {
        body.script.provider = {
          type: "elevenlabs",
          voice_id: voiceId,
        };
      }

      const response = await fetch(`${DID_API_URL}/talks`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("D-ID create error:", response.status, errText);
        return new Response(
          JSON.stringify({ error: `שגיאה ביצירת אווטאר מדבר (${response.status}). נסה שוב מאוחר יותר.` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      return new Response(JSON.stringify({ id: data.id, status: data.status || "created" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== Check talk status ======
    if (action === "check_status") {
      const { talkId } = params;
      const response = await fetch(`${DID_API_URL}/talks/${talkId}`, { headers });

      if (!response.ok) {
        const errText = await response.text();
        console.error("D-ID status error:", response.status, errText);
        return new Response(
          JSON.stringify({ error: `שגיאה בבדיקת סטטוס: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({
          status: data.status,
          resultUrl: data.result_url || null,
          thumbnailUrl: data.thumbnail_url || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== List presenters ======
    if (action === "list_presenters") {
      const response = await fetch(`${DID_API_URL}/clips/actors`, { headers });
      if (!response.ok) {
        return new Response(JSON.stringify({ error: "שגיאה בטעינת רשימת הדמויות" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await response.json();
      return new Response(JSON.stringify({ actors: data.clips || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "פעולה לא מוכרת" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("did-avatar error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
