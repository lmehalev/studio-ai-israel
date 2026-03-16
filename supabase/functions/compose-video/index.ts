import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHOTSTACK_API_URL = "https://api.shotstack.io/edit/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SHOTSTACK_API_KEY = Deno.env.get("SHOTSTACK_API_KEY");
    if (!SHOTSTACK_API_KEY) throw new Error("SHOTSTACK_API_KEY is not configured");

    const { action, ...params } = await req.json();

    const headers = {
      "x-api-key": SHOTSTACK_API_KEY,
      "Content-Type": "application/json",
    };

    // ====== Render composited video ======
    if (action === "render") {
      const { videoUrl, scenes, logoUrl, brandColors, audioUrl } = params;

      if (!videoUrl) {
        return new Response(JSON.stringify({ error: "חסר קישור לסרטון בסיס" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const totalDuration = (scenes || []).reduce(
        (sum: number, s: any) => sum + (s.duration || 5),
        0
      );
      const safeDuration = Math.max(totalDuration, 5);

      const tracks: any[] = [];

      // === Track: Logo overlay (top-right corner) ===
      if (logoUrl) {
        tracks.push({
          clips: [
            {
              asset: { type: "image", src: logoUrl },
              start: 0,
              length: safeDuration,
              position: "topRight",
              offset: { x: -0.03, y: -0.03 },
              scale: 0.12,
              opacity: 0.9,
            },
          ],
        });
      }

      // === Track: Scene text overlays (subtitles + icons) ===
      const textClips: any[] = [];
      let cumulativeTime = 0;

      for (const scene of scenes || []) {
        const dur = scene.duration || 5;
        const icons = (scene.icons || []).join(" ");
        const subtitle =
          scene.subtitleText || scene.spokenText?.slice(0, 80) || "";

        // Bottom subtitle with icons
        if (subtitle) {
          textClips.push({
            asset: {
              type: "html",
              html: `<div style="
                font-family: 'Noto Sans Hebrew', 'Segoe UI', Arial, sans-serif;
                direction: rtl;
                text-align: center;
                padding: 14px 28px;
                background: linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.75) 100%);
                border-radius: 14px;
                color: white;
                font-size: 26px;
                font-weight: 600;
                line-height: 1.5;
                text-shadow: 0 2px 8px rgba(0,0,0,0.6);
              ">${icons ? `<span style="font-size:34px;margin-left:10px;">${icons}</span> ` : ""}${subtitle}</div>`,
              width: 860,
              height: 140,
            },
            start: cumulativeTime,
            length: dur,
            position: "bottom",
            offset: { y: 0.06 },
            transition: {
              in: "fade",
              out: "fade",
            },
          });
        }

        // Scene title badge (top area, brief appearance)
        if (scene.title && dur > 2) {
          textClips.push({
            asset: {
              type: "html",
              html: `<div style="
                font-family: 'Noto Sans Hebrew', 'Segoe UI', Arial, sans-serif;
                direction: rtl;
                text-align: center;
                padding: 8px 24px;
                background: linear-gradient(135deg, rgba(255,180,0,0.9), rgba(255,120,0,0.9));
                border-radius: 10px;
                color: #000;
                font-size: 20px;
                font-weight: 700;
                box-shadow: 0 4px 12px rgba(255,160,0,0.4);
              ">${scene.title}</div>`,
              width: 500,
              height: 55,
            },
            start: cumulativeTime + 0.2,
            length: Math.min(dur - 0.3, 3.5),
            position: "top",
            offset: { y: -0.06 },
            transition: {
              in: "slideRight",
              out: "fade",
            },
          });
        }

        // Floating icons (mid-screen, staggered)
        if (scene.icons && scene.icons.length > 0) {
          const iconPositions = ["left", "right", "topLeft", "topRight"];
          scene.icons.slice(0, 4).forEach((icon: string, i: number) => {
            textClips.push({
              asset: {
                type: "html",
                html: `<div style="font-size:52px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3));">${icon}</div>`,
                width: 80,
                height: 80,
              },
              start: cumulativeTime + 0.5 + i * 0.4,
              length: Math.min(dur - 1, 2.5),
              position: iconPositions[i % iconPositions.length],
              offset: { x: i % 2 === 0 ? 0.08 : -0.08, y: -0.15 },
              scale: 0.8,
              transition: {
                in: "fade",
                out: "fade",
              },
            });
          });
        }

        cumulativeTime += dur;
      }

      if (textClips.length > 0) {
        tracks.push({ clips: textClips });
      }

      // === Track: Main video (avatar or AI-generated) ===
      tracks.push({
        clips: [
          {
            asset: { type: "video", src: videoUrl },
            start: 0,
            length: "auto",
          },
        ],
      });

      // === Track: Background gradient ===
      const bgColor = brandColors?.[0] || "#0f0f23";
      tracks.push({
        clips: [
          {
            asset: {
              type: "html",
              html: `<div style="width:100%;height:100%;background:linear-gradient(160deg, ${bgColor} 0%, #1a1a2e 50%, #0d0d1a 100%);"></div>`,
              width: 1920,
              height: 1080,
            },
            start: 0,
            length: safeDuration,
          },
        ],
      });

      // === Soundtrack (narration audio) ===
      const soundtrack: any = {};
      if (audioUrl) {
        soundtrack.src = audioUrl;
        soundtrack.effect = "fadeOut";
      }

      const renderBody: any = {
        timeline: {
          background: bgColor,
          tracks,
          ...(audioUrl ? { soundtrack } : {}),
        },
        output: {
          format: "mp4",
          resolution: "hd",
          fps: 30,
        },
      };

      console.log(
        "Submitting Shotstack render:",
        JSON.stringify(renderBody).slice(0, 500)
      );

      const response = await fetch(`${SHOTSTACK_API_URL}/render`, {
        method: "POST",
        headers,
        body: JSON.stringify(renderBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Shotstack render error:", response.status, errText);
        return new Response(
          JSON.stringify({
            error: `שגיאה בהרכבת הסרטון (${response.status})`,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({
          renderId: data.response?.id,
          status: "rendering",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== Check render status ======
    if (action === "check_status") {
      const { renderId } = params;

      const response = await fetch(
        `${SHOTSTACK_API_URL}/render/${renderId}`,
        { headers }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("Shotstack status error:", response.status, errText);
        return new Response(
          JSON.stringify({ error: "שגיאה בבדיקת סטטוס הרכבה" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data = await response.json();
      const r = data.response;

      return new Response(
        JSON.stringify({
          status: r.status,
          url: r.url || null,
          progress:
            r.status === "done"
              ? 100
              : r.status === "rendering"
              ? 50
              : r.status === "fetching"
              ? 20
              : 10,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "פעולה לא מוכרת" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("compose-video error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "שגיאה בהרכבת סרטון",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
