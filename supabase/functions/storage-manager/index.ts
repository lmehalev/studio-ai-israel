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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.id === 'media');

    if (!exists) {
      const { error } = await supabase.storage.createBucket('media', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'image/jpeg', 'image/png', 'image/webp', 'image/gif',
          'video/mp4', 'video/webm', 'video/quicktime',
          'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/webm', 'audio/ogg', 'audio/m4a', 'audio/x-m4a',
          'text/plain', 'application/x-subrip',
        ],
      });
      if (error) throw error;
    }

    const { action, fileName, fileType, fileBase64 } = await req.json();

    if (action === 'upload') {
      if (!fileBase64 || !fileName) {
        return new Response(
          JSON.stringify({ error: "חסר קובץ להעלאה" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Decode base64 to bytes
      const binaryStr = atob(fileBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `uploads/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, bytes, {
          contentType: fileType || 'application/octet-stream',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('media')
        .getPublicUrl(path);

      return new Response(
        JSON.stringify({ publicUrl: publicUrlData.publicUrl, path }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'list') {
      const { data, error: listError } = await supabase.storage
        .from('media')
        .list('uploads', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
      if (listError) throw listError;
      return new Response(
        JSON.stringify({ files: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'delete') {
      if (!fileName) {
        return new Response(
          JSON.stringify({ error: "חסר שם קובץ למחיקה" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { error: delError } = await supabase.storage
        .from('media')
        .remove([`uploads/${fileName}`]);
      if (delError) throw delError;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: 'ok', bucketExists: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("storage-manager error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה באחסון" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
