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

async function ensureTable() {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return;
  
  // Use Deno's postgres to create table if needed
  try {
    const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const pool = new Pool(dbUrl, 1, true);
    const conn = await pool.connect();
    try {
      await conn.queryObject(`
        CREATE TABLE IF NOT EXISTS public.avatars (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          image_url text NOT NULL,
          style text NOT NULL DEFAULT 'professional headshot',
          source_photos text[] NOT NULL DEFAULT '{}',
          created_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'avatars' AND policyname = 'Allow public select on avatars') THEN
            CREATE POLICY "Allow public select on avatars" ON public.avatars FOR SELECT USING (true);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'avatars' AND policyname = 'Allow public insert on avatars') THEN
            CREATE POLICY "Allow public insert on avatars" ON public.avatars FOR INSERT WITH CHECK (true);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'avatars' AND policyname = 'Allow public delete on avatars') THEN
            CREATE POLICY "Allow public delete on avatars" ON public.avatars FOR DELETE USING (true);
          END IF;
        END $$;
      `);
    } finally {
      conn.release();
      await pool.end();
    }
  } catch (e) {
    console.error("ensureTable error (non-fatal):", e);
  }
}

let tableChecked = false;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabase();

    // Ensure table exists on first call
    if (!tableChecked) {
      await ensureTable();
      tableChecked = true;
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
