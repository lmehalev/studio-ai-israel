import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabase();

    // Ensure table exists
    await supabase.rpc("exec_sql", { sql: "" }).catch(() => {});
    // Try a simple select first; if table doesn't exist, create it
    const { error: checkError } = await supabase.from("avatars").select("id").limit(1);
    if (checkError && checkError.message.includes("does not exist")) {
      // Create table via raw SQL through service role
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        },
      });
      // Fallback: try creating via pg
      console.log("Avatars table not found, it needs to be created via migration");
    }

    const { action, ...payload } = await req.json();

    // LIST avatars
    if (action === "list") {
      const { data, error } = await supabase
        .from("avatars")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ avatars: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SAVE avatar
    if (action === "save") {
      const { name, image_url, style, source_photos } = payload;
      if (!name || !image_url) {
        return new Response(JSON.stringify({ error: "שם ותמונה נדרשים" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("avatars")
        .insert({ name, image_url, style: style || "professional headshot", source_photos: source_photos || [] })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ avatar: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE avatar
    if (action === "delete") {
      const { id } = payload;
      if (!id) {
        return new Response(JSON.stringify({ error: "מזהה אווטאר נדרש" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("avatars").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "פעולה לא מוכרת" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("avatar-manager error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה בניהול אווטארים" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
