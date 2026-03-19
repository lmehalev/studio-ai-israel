// Deno.serve used natively

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHOTSTACK_ENDPOINTS = {
  production: "https://api.shotstack.io/edit/v1",
  stage: "https://api.shotstack.io/edit/stage",
} as const;

type ShotstackEnv = keyof typeof SHOTSTACK_ENDPOINTS;

interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

interface SubtitleStyle {
  font?: string;
  fontSize?: number;
  color?: string;
  bgColor?: string;
  borderRadius?: number;
  shadow?: string;
  fontWeight?: number;
  padding?: string;
}

interface StickerItem {
  emoji: string;
  position: string;
  startTime: number;
  duration: number;
  scale?: number;
}

// Google Fonts @import for Hebrew fonts — embedded in every HTML asset to guarantee rendering
const GOOGLE_FONTS_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;600;700;800;900&family=Heebo:wght@400;500;600;700;800;900&family=Rubik:wght@400;500;600;700;800;900&display=swap');`;

function buildSubtitleClips(
  segments: SubtitleSegment[],
  style: SubtitleStyle,
  outputWidth: number,
  outputHeight: number,
): any[] {
  const font = style.font || "'Noto Sans Hebrew', 'Arial', sans-serif";
  const fontSize = style.fontSize || 30;
  const color = style.color || "#FFFFFF";
  const bgColor = style.bgColor || "rgba(0,0,0,0.65)";
  const borderRadius = style.borderRadius ?? 16;
  const shadow = style.shadow || "0 2px 16px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.5)";
  const fontWeight = style.fontWeight || 800;
  const padding = style.padding || "14px 32px";

  // Scale subtitle box to output resolution
  const subWidth = Math.round(outputWidth * 0.85);
  const subHeight = Math.round(outputHeight * 0.15);

  return segments
    .filter((seg) => seg.text && seg.text.trim())
    .map((seg) => ({
      asset: {
        type: "html",
        html: `<style>${GOOGLE_FONTS_IMPORT}</style><div style="
          font-family: ${font};
          direction: rtl;
          unicode-bidi: bidi-override;
          text-align: center;
          padding: ${padding};
          background: ${bgColor};
          backdrop-filter: blur(8px);
          border-radius: ${borderRadius}px;
          color: ${color};
          font-size: ${fontSize}px;
          font-weight: ${fontWeight};
          line-height: 1.5;
          text-shadow: ${shadow};
          letter-spacing: 0.03em;
          white-space: pre-wrap;
          word-wrap: break-word;
          border: 1px solid rgba(255,255,255,0.1);
        ">${seg.text}</div>`,
        width: subWidth,
        height: subHeight,
      },
      start: seg.start,
      length: Math.max(0.5, seg.end - seg.start),
      position: "bottom",
      offset: { y: 0.08 },
      transition: {
        in: "slideUp",
        out: "fade",
      },
    }));
}

function buildStickerClips(stickers: StickerItem[]): any[] {
  return stickers.map((s) => ({
    asset: {
      type: "html",
      html: `<div style="font-size:64px;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.4));">${s.emoji}</div>`,
      width: 100,
      height: 100,
    },
    start: s.startTime,
    length: Math.max(0.5, s.duration),
    position: s.position || "topRight",
    offset: {
      x: s.position?.includes("Right") ? -0.05 : s.position?.includes("Left") ? 0.05 : 0,
      y: s.position?.includes("top") ? -0.05 : s.position?.includes("bottom") ? 0.05 : 0,
    },
    scale: s.scale || 0.8,
    transition: {
      in: "zoom",
      out: "fade",
    },
  }));
}

interface LogoPlacement {
  xPct: number;   // 0-100, left edge as % of video width
  yPct: number;   // 0-100, top edge as % of video height
  scalePct: number; // logo width as % of video width (2-30)
  opacity: number;  // 0-1
}

function buildLogoClip(logoUrl: string, totalDuration: number, placement?: LogoPlacement): any {
  // Convert percentage-based placement to Shotstack offset system
  // Shotstack offset: x/y are -0.5 to 0.5 from center, scale is fraction of frame
  const p = placement || { xPct: 88, yPct: 4, scalePct: 10, opacity: 0.92 };

  // Convert xPct/yPct (0-100, top-left origin) to Shotstack offset (center origin, -0.5 to 0.5)
  // Logo center in normalized coords:
  const logoCenterX = (p.xPct + p.scalePct / 2) / 100; // 0-1
  const logoCenterY = (p.yPct + p.scalePct / 2) / 100;  // 0-1
  const offsetX = logoCenterX - 0.5; // -0.5 to 0.5
  const offsetY = -(logoCenterY - 0.5); // Shotstack Y is inverted (positive = up)

  return {
    clips: [
      {
        asset: { type: "image", src: logoUrl },
        start: 0,
        length: totalDuration,
        position: "center",
        offset: { x: offsetX, y: offsetY },
        scale: p.scalePct / 100,
        opacity: p.opacity,
      },
    ],
  };
}

// Resolve output dimensions from orientation
function resolveOutputConfig(orientation?: string): { width: number; height: number; resolution: string } {
  if (orientation === "portrait" || orientation === "9:16") {
    return { width: 1080, height: 1920, resolution: "1080", };
  }
  // Default: landscape 16:9
  return { width: 1920, height: 1080, resolution: "hd" };
}

function getShotstackEnvOrder(preferredEnv?: unknown): ShotstackEnv[] {
  const normalized = typeof preferredEnv === "string" ? preferredEnv.toLowerCase() : "";
  if (normalized === "stage") return ["stage", "production"];
  if (normalized === "production") return ["production", "stage"];
  return ["production", "stage"];
}

Deno.serve(async (req) => {
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
      const {
        videoUrl,
        videoUrls,
        scenes,
        logoUrl,
        logoPlacement,
        brandColors,
        audioUrl,
        subtitleStyle,
        stickers,
        subtitleSegments,
        totalDuration: requestedDuration,
        orientation,
      } = params;

      const clipUrls: string[] = videoUrls || (videoUrl ? [videoUrl] : []);

      if (clipUrls.length === 0) {
        return new Response(JSON.stringify({ error: "חסר קישור לסרטון בסיס" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve output dimensions based on orientation
      const outputConfig = resolveOutputConfig(orientation);

      // Calculate duration
      const sceneDuration = (scenes || []).reduce(
        (sum: number, s: any) => sum + (s.duration || 10),
        0
      );
      const totalDuration = requestedDuration || Math.max(sceneDuration, clipUrls.length * 10) || 30;

      const tracks: any[] = [];

      // === Logo overlay track ===
      if (logoUrl) {
        tracks.push(buildLogoClip(logoUrl, totalDuration, logoPlacement as LogoPlacement | undefined));
      }

      // === Sticker overlays track ===
      if (stickers && stickers.length > 0) {
        tracks.push({ clips: buildStickerClips(stickers) });
      }

      // === Subtitle track ===
      if (subtitleSegments && subtitleSegments.length > 0) {
        const subClips = buildSubtitleClips(subtitleSegments, subtitleStyle || {}, outputConfig.width, outputConfig.height);
        if (subClips.length > 0) {
          tracks.push({ clips: subClips });
        }
      } else if (scenes && scenes.length > 0) {
        const textClips: any[] = [];
        let cumulativeTime = 0;

        for (const scene of scenes) {
          const dur = scene.duration || 10;
          const subtitle = scene.subtitleText || scene.spokenText?.slice(0, 80) || "";

          if (subtitle) {
            const style = subtitleStyle || {};
            const subClips = buildSubtitleClips(
              [{ start: cumulativeTime + 0.3, end: cumulativeTime + dur - 0.3, text: subtitle }],
              style,
              outputConfig.width,
              outputConfig.height,
            );
            textClips.push(...subClips);
          }

          // Scene title badge
          if (scene.title && dur > 2) {
            textClips.push({
              asset: {
                type: "html",
                html: `<style>${GOOGLE_FONTS_IMPORT}</style><div style="
                  font-family: 'Noto Sans Hebrew', 'Segoe UI', Arial, sans-serif;
                  direction: rtl;
                  unicode-bidi: bidi-override;
                  text-align: center;
                  padding: 10px 28px;
                  background: linear-gradient(135deg, rgba(255,200,50,0.95), rgba(255,140,0,0.95));
                  border-radius: 12px;
                  color: #1a1a1a;
                  font-size: 22px;
                  font-weight: 800;
                  box-shadow: 0 6px 20px rgba(255,160,0,0.5);
                  letter-spacing: 0.03em;
                ">${scene.title}</div>`,
                width: 520,
                height: 60,
              },
              start: cumulativeTime + 0.15,
              length: Math.min(dur - 0.3, 3),
              position: "top",
              offset: { y: -0.05 },
              transition: { in: "slideRight", out: "slideLeft" },
            });
          }

          // Floating icons
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
                transition: { in: "zoom", out: "fade" },
              });
            });
          }

          cumulativeTime += dur;
        }

        if (textClips.length > 0) {
          tracks.push({ clips: textClips });
        }
      }

      // === Video clips track ===
      // Use "contain" fit so the video is letterboxed/pillarboxed to match output — no crop
      const videoClips: any[] = [];
      let videoStart = 0;
      for (let i = 0; i < clipUrls.length; i++) {
        const sceneDur = scenes?.[i]?.duration || totalDuration / clipUrls.length;
        videoClips.push({
          asset: {
            type: "video",
            src: clipUrls[i],
            volume: audioUrl ? 0.15 : 1, // duck original audio if music is added
          },
          start: videoStart,
          length: clipUrls.length === 1 ? totalDuration : sceneDur,
          fit: "contain", // ← KEY: no crop, letterbox/pillarbox to fit target aspect
          transition: i > 0 ? { in: "fade", out: "fade" } : undefined,
        });
        videoStart += sceneDur;
      }
      tracks.push({ clips: videoClips });

      // === Background track ===
      const bgColor = brandColors?.[0] || "#0f0f23";
      tracks.push({
        clips: [
          {
            asset: {
              type: "html",
              html: `<div style="width:100%;height:100%;background:linear-gradient(160deg, ${bgColor} 0%, #1a1a2e 50%, #0d0d1a 100%);"></div>`,
              width: outputConfig.width,
              height: outputConfig.height,
            },
            start: 0,
            length: totalDuration,
          },
        ],
      });

      // === Soundtrack ===
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
          resolution: outputConfig.resolution,
          fps: 30,
          ...(orientation === "portrait" || orientation === "9:16"
            ? { size: { width: 1080, height: 1920 } }
            : {}),
        },
      };

      console.log("Submitting Shotstack render:", JSON.stringify(renderBody).slice(0, 1200));
      console.log("Render debug: orientation=" + (orientation || "default/landscape") +
        " output=" + outputConfig.width + "x" + outputConfig.height +
        " clips=" + clipUrls.length +
        " subtitleSegs=" + (subtitleSegments?.length || 0) +
        " logoUrl=" + (logoUrl ? "yes" : "no") +
        " logoPlacement=" + JSON.stringify(logoPlacement || null));

      const envOrder = getShotstackEnvOrder(params.shotstackEnv);
      const renderErrors: string[] = [];

      for (const env of envOrder) {
        const baseUrl = SHOTSTACK_ENDPOINTS[env];
        const response = await fetch(`${baseUrl}/render`, {
          method: "POST",
          headers,
          body: JSON.stringify(renderBody),
        });

        if (response.ok) {
          const data = await response.json();
          return new Response(
            JSON.stringify({
              renderId: data.response?.id,
              status: "rendering",
              shotstackEnv: env,
              debug: {
                orientation: orientation || "landscape",
                outputSize: `${outputConfig.width}x${outputConfig.height}`,
                logoPlacement: logoPlacement || null,
                subtitleCount: subtitleSegments?.length || 0,
                timelineJson: JSON.stringify(renderBody).slice(0, 2000),
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const errText = await response.text();
        renderErrors.push(`${env}:${response.status} ${errText}`);
        console.error(`Shotstack render error (${env}):`, response.status, errText);

        if (![401, 403, 404].includes(response.status)) {
          break;
        }
      }

      return new Response(
        JSON.stringify({ error: `שגיאה בהרכבת הסרטון: ${renderErrors.join(" | ")}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== Check render status ======
    if (action === "check_status") {
      const { renderId } = params;
      const envOrder = getShotstackEnvOrder(params.shotstackEnv);
      const statusErrors: string[] = [];
      let data: any = null;

      for (const env of envOrder) {
        const baseUrl = SHOTSTACK_ENDPOINTS[env];
        const response = await fetch(`${baseUrl}/render/${renderId}`, { headers });

        if (response.ok) {
          data = await response.json();
          break;
        }

        const errText = await response.text();
        statusErrors.push(`${env}:${response.status} ${errText}`);
        console.error(`Shotstack status error (${env}):`, response.status, errText);

        if (![401, 403, 404].includes(response.status)) {
          break;
        }
      }

      if (!data) {
        return new Response(
          JSON.stringify({ error: `שגיאה בבדיקת סטטוס הרכבה: ${statusErrors.join(" | ")}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const r = data.response;

      const isDone = r.status === "done" || r.status === "rendered";
      const normalizedStatus = isDone ? "done" : r.status;

      return new Response(
        JSON.stringify({
          status: normalizedStatus,
          url: r.url || null,
          progress:
            isDone ? 100 :
            r.status === "rendering" ? 50 :
            r.status === "fetching" ? 20 : 10,
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
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה בהרכבת סרטון" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
