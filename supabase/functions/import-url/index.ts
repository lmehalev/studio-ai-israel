import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "חסר קישור לייבוא" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // YouTube detection — extract thumbnail only (can't download full video server-side)
    const ytMatch = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
    );
    if (ytMatch) {
      const videoId = ytMatch[1];
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      return new Response(
        JSON.stringify({
          type: "image",
          sourceUrl: url,
          publicUrl: thumbnailUrl,
          isYoutube: true,
          youtubeId: videoId,
          metadata: { source: "youtube", videoId },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect type from URL extension
    const lower = url.toLowerCase().split("?")[0];
    let detectedType: "image" | "video" = "image";
    if (lower.match(/\.(mp4|mov|webm|avi|mkv)$/)) detectedType = "video";
    else if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/)) detectedType = "image";

    console.log(`Importing URL: ${url} (detected: ${detectedType})`);

    // Download the file
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; StudioBot/1.0)" },
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      return new Response(
        JSON.stringify({ error: `לא ניתן להוריד את הקובץ: ${fetchErr.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    clearTimeout(timeout);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `שגיאה בהורדה: HTTP ${response.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check content type from response headers
    const contentType = response.headers.get("content-type") || "";
    if (contentType.startsWith("video/")) detectedType = "video";
    else if (contentType.startsWith("image/")) detectedType = "image";

    // Get file size
    const contentLength = response.headers.get("content-length");
    const fileSizeMB = contentLength ? parseInt(contentLength) / (1024 * 1024) : 0;

    // Max 50MB for edge function
    if (fileSizeMB > 50) {
      return new Response(
        JSON.stringify({ error: `הקובץ גדול מדי (${fileSizeMB.toFixed(1)}MB). מקסימום 50MB` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read into array buffer
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Determine file extension and content type
    let ext = detectedType === "video" ? "mp4" : "jpg";
    let mimeType = detectedType === "video" ? "video/mp4" : "image/jpeg";
    
    if (contentType.includes("png")) { ext = "png"; mimeType = "image/png"; }
    else if (contentType.includes("webp")) { ext = "webp"; mimeType = "image/webp"; }
    else if (contentType.includes("gif")) { ext = "gif"; mimeType = "image/gif"; }
    else if (contentType.includes("webm")) { ext = "webm"; mimeType = "video/webm"; }
    else if (contentType.includes("quicktime") || contentType.includes("mov")) { ext = "mov"; mimeType = "video/quicktime"; }
    else if (lower.endsWith(".png")) { ext = "png"; mimeType = "image/png"; }
    else if (lower.endsWith(".webp")) { ext = "webp"; mimeType = "image/webp"; }
    else if (lower.endsWith(".webm")) { ext = "webm"; mimeType = "video/webm"; }

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b: any) => b.id === "media");
    if (!exists) {
      await supabase.storage.createBucket("media", { public: true, fileSizeLimit: 52428800 });
    }

    // Upload to storage
    const safeName = `imported-${Date.now()}.${ext}`;
    const storagePath = `uploads/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(storagePath, bytes, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("media")
      .getPublicUrl(storagePath);

    console.log(`Import complete: ${publicUrlData.publicUrl} (${detectedType}, ${(bytes.length / 1024 / 1024).toFixed(1)}MB)`);

    return new Response(
      JSON.stringify({
        type: detectedType,
        sourceUrl: url,
        publicUrl: publicUrlData.publicUrl,
        storagePath,
        metadata: {
          contentType: mimeType,
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
