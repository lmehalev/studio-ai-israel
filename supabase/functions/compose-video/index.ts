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

const HEBREW_FONT_URLS = [
  "https://raw.githubusercontent.com/openmaptiles/fonts/master/noto-sans/NotoSansHebrew-Regular.ttf",
  "https://cdn.jsdelivr.net/gh/openmaptiles/fonts@noto-sans/NotoSansHebrew-Regular.ttf",
];

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

interface LogoPlacement {
  xPct: number; // 0-100, left edge as % of contentRect width
  yPct: number; // 0-100, top edge as % of contentRect height
  scalePct: number; // 2-30 (logo width as % of contentRect width)
  opacity: number; // 0-1
}

interface ContentRectPx {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface OutputConfig {
  width: number;
  height: number;
  resolution: string;
}

interface LogoPlacementSummary {
  outputSize: { width: number; height: number };
  contentRectPx: { x: number; y: number; w: number; h: number };
  logoPxX: number;
  logoPxY: number;
  logoPxW: number;
  logoPxH: number;
}

interface ComposeRenderResponse {
  renderId: string | null;
  status: string;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  subtitleCount: number;
  logoPlacementSummary: LogoPlacementSummary | null;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const round2 = (value: number): number => Math.round(value * 100) / 100;

let cachedHebrewFontUrl: string | null = null;

async function ensureHebrewFontUrl(): Promise<string> {
  if (cachedHebrewFontUrl) return cachedHebrewFontUrl;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const fontStoragePath = "fonts/NotoSansHebrew-Regular.ttf";

  // If we have Supabase credentials, try storage first
  if (supabaseUrl && serviceKey) {
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/media/${fontStoragePath}`;

    // Check if already uploaded
    try {
      const head = await fetch(publicUrl, { method: "HEAD" });
      if (head.ok) {
        cachedHebrewFontUrl = publicUrl;
        console.log("Hebrew font already in storage:", publicUrl);
        return publicUrl;
      }
    } catch (_) { /* continue to upload */ }

    // Fetch from CDN and upload to storage
    for (const cdnUrl of HEBREW_FONT_URLS) {
      try {
        const res = await fetch(cdnUrl);
        if (!res.ok) continue;
        const fontBytes = new Uint8Array(await res.arrayBuffer());

        const uploadRes = await fetch(
          `${supabaseUrl}/storage/v1/object/media/${fontStoragePath}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "font/ttf",
              "x-upsert": "true",
            },
            body: fontBytes,
          },
        );

        if (uploadRes.ok || uploadRes.status === 200) {
          cachedHebrewFontUrl = publicUrl;
          console.log("Hebrew font uploaded to storage:", publicUrl);
          return publicUrl;
        }
        // consume body
        await uploadRes.text();
      } catch (_) { /* try next */ }
    }
  }

  // Fallback: use CDN URL directly (Shotstack HTML renderer should fetch it)
  cachedHebrewFontUrl = HEBREW_FONT_URLS[0];
  console.log("Using CDN font URL fallback:", cachedHebrewFontUrl);
  return cachedHebrewFontUrl;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parsePadding(padding: string | undefined): { vertical: number; horizontal: number } {
  if (!padding) return { vertical: 12, horizontal: 28 };
  const tokens = padding
    .split(/\s+/)
    .map((t) => Number.parseFloat(t.replace("px", "")))
    .filter((n) => Number.isFinite(n));

  if (tokens.length === 1) {
    return { vertical: tokens[0], horizontal: tokens[0] };
  }
  if (tokens.length >= 2) {
    return { vertical: tokens[0], horizontal: tokens[1] };
  }
  return { vertical: 12, horizontal: 28 };
}

function wrapText(text: string, maxCharsPerLine: number, maxLines = 3): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    const next = `${current} ${word}`;
    if (next.length <= maxCharsPerLine) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;

    if (lines.length >= maxLines - 1) {
      break;
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  // Hard split for very long single tokens (e.g. no spaces)
  if (lines.length === 1 && lines[0].length > maxCharsPerLine) {
    const hard: string[] = [];
    for (let i = 0; i < lines[0].length && hard.length < maxLines; i += maxCharsPerLine) {
      hard.push(lines[0].slice(i, i + maxCharsPerLine));
    }
    return hard;
  }

  return lines.slice(0, maxLines);
}

function buildSubtitleHtmlAsset(
  text: string,
  style: SubtitleStyle,
  width: number,
  height: number,
  fontUrl: string,
): string {
  const fontSize = style.fontSize || 30;
  const color = style.color || "#FFFFFF";
  const bgColor = style.bgColor || "rgba(0,0,0,0.65)";
  const borderRadius = style.borderRadius ?? 16;
  const fontWeight = style.fontWeight || 800;
  const padding = parsePadding(style.padding);

  const maxCharsPerLine = Math.max(10, Math.floor((width - padding.horizontal * 2) / Math.max(10, fontSize * 0.62)));
  const lines = wrapText(text, maxCharsPerLine, 3);
  const safeLines = (lines.length > 0 ? lines : [text]).map(escapeXml).join("<br />");

  return `<style>
      @font-face {
        font-family: 'HebrewEmbedded';
        src: url('${fontUrl}') format('truetype');
        font-style: normal;
        font-weight: 100 900;
      }
    </style>
    <div style="
      width:${width}px;
      height:${height}px;
      box-sizing:border-box;
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      direction:rtl;
      unicode-bidi:bidi-override;
      font-family:'HebrewEmbedded','Arial',sans-serif;
      font-size:${fontSize}px;
      font-weight:${fontWeight};
      color:${color};
      background:${bgColor};
      border-radius:${borderRadius}px;
      line-height:1.35;
      text-shadow:0 2px 6px rgba(0,0,0,0.85),0 0 1px rgba(0,0,0,0.65);
      padding:${padding.vertical}px ${padding.horizontal}px;
      white-space:normal;
      overflow-wrap:break-word;
      word-break:break-word;
    ">${safeLines}</div>`;
}

function buildSubtitleClips(
  segments: SubtitleSegment[],
  style: SubtitleStyle,
  outputWidth: number,
  outputHeight: number,
  fontUrl: string,
): any[] {
  const subWidth = Math.round(outputWidth * 0.85);
  const subHeight = Math.round(outputHeight * 0.15);

  return segments
    .filter((seg) => seg.text && seg.text.trim())
    .map((seg) => ({
      asset: {
        type: "html",
        html: buildSubtitleHtmlAsset(seg.text, style, subWidth, subHeight, fontUrl),
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

function resolveOutputConfig(orientation?: string): OutputConfig {
  if (orientation === "portrait" || orientation === "9:16") {
    return { width: 1080, height: 1920, resolution: "1080" };
  }
  return { width: 1920, height: 1080, resolution: "hd" };
}

function resolveContentRect(
  outputWidth: number,
  outputHeight: number,
  sourceWidth?: number,
  sourceHeight?: number,
): ContentRectPx {
  const sw = Number(sourceWidth);
  const sh = Number(sourceHeight);

  if (!Number.isFinite(sw) || !Number.isFinite(sh) || sw <= 0 || sh <= 0) {
    return { x: 0, y: 0, w: outputWidth, h: outputHeight };
  }

  const sourceAspect = sw / sh;
  const targetAspect = outputWidth / outputHeight;

  if (sourceAspect > targetAspect) {
    const w = outputWidth;
    const h = outputWidth / sourceAspect;
    return { x: 0, y: (outputHeight - h) / 2, w, h };
  }

  const h = outputHeight;
  const w = outputHeight * sourceAspect;
  return { x: (outputWidth - w) / 2, y: 0, w, h };
}

function buildLogoClip(
  logoUrl: string,
  totalDuration: number,
  outputWidth: number,
  outputHeight: number,
  contentRect: ContentRectPx,
  placement?: LogoPlacement,
): { track: any; debug: Record<string, unknown> } {
  const p = placement || { xPct: 88, yPct: 4, scalePct: 10, opacity: 0.92 };
  const scalePct = clamp(Number(p.scalePct) || 10, 2, 30);
  const xPct = clamp(Number(p.xPct) || 0, 0, 100 - scalePct);
  const yPct = clamp(Number(p.yPct) || 0, 0, 100 - scalePct);
  const opacity = clamp(Number(p.opacity) || 0.92, 0, 1);

  // EXACT preview parity:
  // logo width/height are based on contentRect WIDTH, while x/y are percentages over contentRect.
  const logoPxW = (contentRect.w * scalePct) / 100;
  const logoPxH = logoPxW;
  const logoPxX = contentRect.x + (contentRect.w * xPct) / 100;
  const logoPxY = contentRect.y + (contentRect.h * yPct) / 100;

  const centerX = logoPxX + logoPxW / 2;
  const centerY = logoPxY + logoPxH / 2;

  const offsetX = centerX / outputWidth - 0.5;
  const offsetY = -(centerY / outputHeight - 0.5);

  return {
    track: {
      clips: [
        {
          asset: { type: "image", src: logoUrl },
          start: 0,
          length: totalDuration,
          position: "center",
          offset: { x: offsetX, y: offsetY },
          scale: logoPxW / outputWidth,
          opacity,
        },
      ],
    },
    debug: {
      outputSize: { width: outputWidth, height: outputHeight },
      contentRectPx: {
        x: round2(contentRect.x),
        y: round2(contentRect.y),
        w: round2(contentRect.w),
        h: round2(contentRect.h),
      },
      logoPxX: round2(logoPxX),
      logoPxY: round2(logoPxY),
      logoPxW: round2(logoPxW),
      logoPxH: round2(logoPxH),
      normalized: {
        offsetX: round2(offsetX),
        offsetY: round2(offsetY),
        scale: round2(logoPxW / outputWidth),
      },
      input: { xPct, yPct, scalePct, opacity },
    },
  };
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
        sourceWidth,
        sourceHeight,
      } = params;

      const clipUrls: string[] = videoUrls || (videoUrl ? [videoUrl] : []);

      if (clipUrls.length === 0) {
        return new Response(JSON.stringify({ error: "חסר קישור לסרטון בסיס" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const outputConfig = resolveOutputConfig(orientation);

      const sceneDuration = (scenes || []).reduce(
        (sum: number, s: any) => sum + (s.duration || 10),
        0,
      );
      const totalDuration = requestedDuration || Math.max(sceneDuration, clipUrls.length * 10) || 30;

      const contentRect = resolveContentRect(
        outputConfig.width,
        outputConfig.height,
        Number(sourceWidth),
        Number(sourceHeight),
      );

      const tracks: any[] = [];

      let logoDebug: Record<string, unknown> | null = null;
      if (logoUrl) {
        const logo = buildLogoClip(
          logoUrl,
          totalDuration,
          outputConfig.width,
          outputConfig.height,
          contentRect,
          logoPlacement as LogoPlacement | undefined,
        );
        logoDebug = logo.debug;
        tracks.push(logo.track);
      }

      if (stickers && stickers.length > 0) {
        tracks.push({ clips: buildStickerClips(stickers) });
      }

      const hebrewFontUrl = await ensureHebrewFontUrl();

      if (subtitleSegments && subtitleSegments.length > 0) {
        const subClips = buildSubtitleClips(
          subtitleSegments,
          subtitleStyle || {},
          outputConfig.width,
          outputConfig.height,
          hebrewFontUrl,
        );
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
              hebrewFontUrl,
            );
            textClips.push(...subClips);
          }

          if (scene.title && dur > 2) {
            const titleWidth = 520;
            const titleHeight = 70;
            const titleHtml = buildSubtitleHtmlAsset(
              scene.title,
              {
                fontSize: 22,
                color: "#1a1a1a",
                bgColor: "rgba(255,180,40,0.95)",
                borderRadius: 12,
                fontWeight: 800,
                padding: "10px 24px",
              },
              titleWidth,
              titleHeight,
              hebrewFontUrl,
            );

            textClips.push({
              asset: {
                type: "html",
                html: titleHtml,
                width: titleWidth,
                height: titleHeight,
              },
              start: cumulativeTime + 0.15,
              length: Math.min(dur - 0.3, 3),
              position: "top",
              offset: { y: -0.05 },
              transition: { in: "slideRight", out: "slideLeft" },
            });
          }

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

      const videoClips: any[] = [];
      let videoStart = 0;
      for (let i = 0; i < clipUrls.length; i++) {
        const sceneDur = scenes?.[i]?.duration || totalDuration / clipUrls.length;
        videoClips.push({
          asset: {
            type: "video",
            src: clipUrls[i],
            volume: audioUrl ? 0.15 : 1,
          },
          start: videoStart,
          length: clipUrls.length === 1 ? totalDuration : sceneDur,
          fit: "contain",
          transition: i > 0 ? { in: "fade", out: "fade" } : undefined,
        });
        videoStart += sceneDur;
      }
      tracks.push({ clips: videoClips });

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
          size: { width: outputConfig.width, height: outputConfig.height },
        },
      };

      const debugObject = {
        orientation: orientation || "landscape",
        outputSize: { width: outputConfig.width, height: outputConfig.height },
        sourceSize: {
          width: Number(sourceWidth) || null,
          height: Number(sourceHeight) || null,
        },
        contentRectPx: {
          x: round2(contentRect.x),
          y: round2(contentRect.y),
          w: round2(contentRect.w),
          h: round2(contentRect.h),
        },
        logo: logoDebug,
        subtitleCount: subtitleSegments?.length || 0,
      };

      console.log("Submitting Shotstack render (payload KB):", Math.round(JSON.stringify(renderBody).length / 1024));
      console.log("Compose debug object:", JSON.stringify(debugObject));

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
              debug: debugObject,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});