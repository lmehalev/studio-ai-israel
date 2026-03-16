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
      // Support both single videoUrl and multiple videoUrls (one per scene)
      const { videoUrl, videoUrls, scenes, logoUrl, brandColors, audioUrl } = params;

      const clipUrls: string[] = videoUrls || (videoUrl ? [videoUrl] : []);
      
      if (clipUrls.length === 0) {
        return new Response(JSON.stringify({ error: "חסר קישור לסרטון בסיס" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const totalDuration = (scenes || []).reduce(
        (sum: number, s: any) => sum + (s.duration || 10),
        0
      );
      const safeDuration = Math.max(totalDuration, clipUrls.length * 10);

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

      // === Track: Scene text overlays (subtitles + icons + scene titles) ===
      const textClips: any[] = [];
      let cumulativeTime = 0;

      for (const scene of scenes || []) {
        const dur = scene.duration || 10;
        const icons = (scene.icons || []).join(" ");
        const subtitle =
          scene.subtitleText || scene.spokenText?.slice(0, 80) || "";

        // === Cinematic subtitle bar (bottom) ===
        if (subtitle) {
          textClips.push({
            asset: {
              type: "html",
              html: `<div style="
                font-family: 'Noto Sans Hebrew', 'Segoe UI', Arial, sans-serif;
                direction: rtl;
                text-align: center;
                padding: 16px 32px;
                background: linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.85) 100%);
                border-radius: 16px;
                color: white;
                font-size: 28px;
                font-weight: 700;
                line-height: 1.6;
                text-shadow: 0 2px 12px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.4);
                letter-spacing: 0.02em;
              ">${icons ? `<span style="font-size:36px;margin-left:12px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));">${icons}</span> ` : ""}${subtitle}</div>`,
              width: 900,
              height: 150,
            },
            start: cumulativeTime + 0.3,
            length: dur - 0.5,
            position: "bottom",
            offset: { y: 0.05 },
            transition: {
              in: "slideUp",
              out: "fade",
            },
          });
        }

        // === Scene title badge (top, cinematic entry) ===
        if (scene.title && dur > 2) {
          textClips.push({
            asset: {
              type: "html",
              html: `<div style="
                font-family: 'Noto Sans Hebrew', 'Segoe UI', Arial, sans-serif;
                direction: rtl;
                text-align: center;
                padding: 10px 28px;
                background: linear-gradient(135deg, rgba(255,200,50,0.95), rgba(255,140,0,0.95));
                border-radius: 12px;
                color: #1a1a1a;
                font-size: 22px;
                font-weight: 800;
                box-shadow: 0 6px 20px rgba(255,160,0,0.5), 0 0 40px rgba(255,160,0,0.2);
                letter-spacing: 0.03em;
              ">${scene.title}</div>`,
              width: 520,
              height: 60,
            },
            start: cumulativeTime + 0.15,
            length: Math.min(dur - 0.3, 3),
            position: "top",
            offset: { y: -0.05 },
            transition: {
              in: "slideRight",
              out: "slideLeft",
            },
          });
        }

        // === Floating icons with bounce-in effect ===
        if (scene.icons && scene.icons.length > 0) {
          const iconPositions = ["left", "right", "topLeft", "topRight"];
          scene.icons.slice(0, 4).forEach((icon: string, i: number) => {
            textClips.push({
              asset: {
                type: "html",
                html: `<div style="font-size:56px;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.4));">${icon}</div>`,
                width: 90,
                height: 90,
              },
              start: cumulativeTime + 0.8 + i * 0.5,
              length: Math.min(dur - 1.5, 2.5),
              position: iconPositions[i % iconPositions.length],
              offset: { x: i % 2 === 0 ? 0.1 : -0.1, y: -0.18 },
              scale: 0.85,
              transition: {
                in: "zoom",
                out: "fade",
              },
            });
          });
        }

        // === Progress indicator (thin bar at top) ===
        const progressWidth = Math.round((cumulativeTime / safeDuration) * 100);
        textClips.push({
          asset: {
            type: "html",
            html: `<div style="width:${progressWidth}%;height:4px;background:linear-gradient(90deg, #FFB800, #FF6B00);border-radius:0 2px 2px 0;"></div>`,
            width: 1920,
            height: 6,
          },
          start: cumulativeTime,
          length: dur,
          position: "top",
          offset: { y: 0 },
        });

        cumulativeTime += dur;
      }

      if (textClips.length > 0) {
        tracks.push({ clips: textClips });
      }

      // === Track: Video clips (multiple clips stitched sequentially) ===
      const videoClips: any[] = [];
      let videoStart = 0;
      for (let i = 0; i < clipUrls.length; i++) {
        const sceneDur = scenes?.[i]?.duration || 10;
        videoClips.push({
          asset: { type: "video", src: clipUrls[i] },
          start: videoStart,
          length: sceneDur,
          transition: i > 0 ? { in: "fade" } : undefined,
        });
        videoStart += sceneDur;
      }
      tracks.push({ clips: videoClips });

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
