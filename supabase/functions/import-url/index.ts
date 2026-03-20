import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── CONSTANTS ──
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;   // 25 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;   // 500 MB
const MAX_REDIRECTS = 5;
const HEAD_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 300_000; // 5 min

const ALLOWED_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_VIDEO_EXTS = [".mp4", ".mov", ".webm"];
const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"];

const PLATFORM_PATTERNS = [
  /youtube\.com/i, /youtu\.be/i,
  /tiktok\.com/i,
  /instagram\.com/i, /instagr\.am/i,
  /facebook\.com/i, /fb\.watch/i,
  /twitter\.com/i, /x\.com/i,
  /vimeo\.com/i,
  /dailymotion\.com/i,
  /twitch\.tv/i,
];

// ── SSRF Protection ──
function isPrivateOrLocalhost(hostname: string): boolean {
  if (!hostname) return true;
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1" || lower === "[::1]") return true;
  if (lower.endsWith(".local") || lower.endsWith(".internal")) return true;
  // Private IP ranges
  const parts = hostname.split(".");
  if (parts.length === 4) {
    const a = parseInt(parts[0]);
    const b = parseInt(parts[1]);
    if (a === 10) return true;                        // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16
    if (a === 169 && b === 254) return true;            // 169.254.0.0/16
    if (a === 0) return true;
  }
  return false;
}

function isPlatformUrl(url: string): boolean {
  return PLATFORM_PATTERNS.some(p => p.test(url));
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function detectTypeFromUrl(url: string): "image" | "video" | null {
  const path = url.toLowerCase().split("?")[0].split("#")[0];
  if (ALLOWED_IMAGE_EXTS.some(e => path.endsWith(e))) return "image";
  if (ALLOWED_VIDEO_EXTS.some(e => path.endsWith(e))) return "video";
  return null;
}

function detectTypeFromMime(ct: string): "image" | "video" | null {
  if (ALLOWED_IMAGE_MIMES.some(m => ct.startsWith(m))) return "image";
  if (ALLOWED_VIDEO_MIMES.some(m => ct.startsWith(m))) return "video";
  return null;
}

function extFromMime(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webm")) return "webm";
  if (ct.includes("quicktime") || ct.includes("mov")) return "mov";
  if (ct.includes("mp4")) return "mp4";
  return "bin";
}

function err(msg: string, status = 400) {
  return new Response(
    JSON.stringify({ error: msg }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") return err("חסר קישור לייבוא");

    // ── 1. HTTPS only ──
    let parsedUrl: URL;
    try { parsedUrl = new URL(url); } catch { return err("קישור לא תקין"); }
    if (parsedUrl.protocol !== "https:") return err("רק קישורים מסוג HTTPS מותרים");

    // ── 2. SSRF protection ──
    if (isPrivateOrLocalhost(parsedUrl.hostname)) {
      return err("הקישור מפנה לכתובת פנימית ולא מותר לייבוא");
    }

    // ── 3. Platform detection ──
    if (isPlatformUrl(url)) {
      const ytId = getYouTubeId(url);
      if (ytId) {
        return new Response(
          JSON.stringify({
            type: "image",
            sourceUrl: url,
            publicUrl: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
            isYoutube: true,
            youtubeId: ytId,
            isPlatform: true,
            platformMessage: "קישורי YouTube אינם ניתנים להורדה ישירה. יש להעלות את הסרטון ידנית.",
            metadata: { source: "youtube", videoId: ytId },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Non-YouTube platform
      return err("קישורי פלטפורמות (TikTok, Instagram, Facebook וכו׳) אינם ניתנים להורדה. יש להעלות את הקובץ ידנית.");
    }

    // ── 4. Extension pre-check ──
    const extType = detectTypeFromUrl(url);
    // We'll validate with HEAD even if extension matches

    // ── 5. HEAD request for validation ──
    const controller = new AbortController();
    const headTimeout = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
    let headResp: Response;
    try {
      headResp = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; StudioBot/1.0)" },
      });
    } catch (e: any) {
      clearTimeout(headTimeout);
      return err(`לא ניתן לגשת לקישור: ${e.message}`);
    }
    clearTimeout(headTimeout);

    // Check final redirected URL for SSRF
    const finalUrl = headResp.url || url;
    try {
      const finalParsed = new URL(finalUrl);
      if (isPrivateOrLocalhost(finalParsed.hostname)) {
        return err("הקישור מפנה לכתובת פנימית לאחר הפניה (redirect) ואינו מותר");
      }
    } catch {}

    if (!headResp.ok) return err(`הקישור החזיר שגיאה: HTTP ${headResp.status}`);

    const contentType = (headResp.headers.get("content-type") || "").toLowerCase();
    const contentLength = headResp.headers.get("content-length");

    // ── 6. Content-type validation ──
    const mimeType = detectTypeFromMime(contentType);
    const detectedType = mimeType || extType;
    if (!detectedType) {
      return err(`סוג הקובץ אינו נתמך (content-type: ${contentType}). נתמכים: JPG, PNG, WebP, MP4, MOV, WebM`);
    }

    // ── 7. Size validation ──
    const sizeBytes = contentLength ? parseInt(contentLength) : 0;
    const maxBytes = detectedType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (contentLength && sizeBytes > maxBytes) {
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
      const limitMB = (maxBytes / (1024 * 1024)).toFixed(0);
      return err(`הקובץ גדול מדי (${sizeMB}MB). מגבלה: ${limitMB}MB עבור ${detectedType === 'video' ? 'סרטונים' : 'תמונות'}`);
    }
    if (!contentLength) {
      // Allow but warn — we'll check after download
      console.warn("content-length missing, will validate after download");
    }

    console.log(`Importing: ${url} → type=${detectedType}, size=${sizeBytes}, mime=${contentType}`);

    // ── 8. Download file (GET) ──
    const dlController = new AbortController();
    const dlTimeout = setTimeout(() => dlController.abort(), DOWNLOAD_TIMEOUT_MS);
    let dlResp: Response;
    try {
      dlResp = await fetch(finalUrl, {
        signal: dlController.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; StudioBot/1.0)" },
      });
    } catch (e: any) {
      clearTimeout(dlTimeout);
      return err(`לא ניתן להוריד את הקובץ: ${e.message}`);
    }
    clearTimeout(dlTimeout);

    if (!dlResp.ok) return err(`שגיאה בהורדה: HTTP ${dlResp.status}`);

    const arrayBuffer = await dlResp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Post-download size check
    if (bytes.length > maxBytes) {
      const sizeMB = (bytes.length / (1024 * 1024)).toFixed(1);
      const limitMB = (maxBytes / (1024 * 1024)).toFixed(0);
      return err(`הקובץ גדול מדי (${sizeMB}MB). מגבלה: ${limitMB}MB`);
    }

    // ── 9. Upload to Supabase Storage ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const ext = extFromMime(contentType) || (detectedType === "video" ? "mp4" : "jpg");
    const uploadMime = contentType || (detectedType === "video" ? "video/mp4" : "image/jpeg");
    const safeName = `imported-${Date.now()}.${ext}`;
    const storagePath = `uploads/${safeName}`;

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b: any) => b.id === "media")) {
      await supabase.storage.createBucket("media", { public: true, fileSizeLimit: 524288000 });
    }

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(storagePath, bytes, { contentType: uploadMime, cacheControl: "3600", upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(storagePath);

    console.log(`Import done: ${publicUrlData.publicUrl} (${detectedType}, ${(bytes.length / 1024 / 1024).toFixed(1)}MB)`);

    return new Response(
      JSON.stringify({
        type: detectedType,
        sourceUrl: url,
        publicUrl: publicUrlData.publicUrl,
        storagePath,
        isPlatform: false,
        metadata: {
          contentType: uploadMime,
          sizeBytes: bytes.length,
          sizeMB: (bytes.length / 1024 / 1024).toFixed(1),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("import-url error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה בייבוא" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
