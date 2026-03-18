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

  try {
    const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const pool = new Pool(dbUrl, 1, true);
    const conn = await pool.connect();
    try {
      await conn.queryObject(`
        CREATE TABLE IF NOT EXISTS public.voices (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          audio_url text NOT NULL,
          type text NOT NULL DEFAULT 'recorded',
          created_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voices' AND policyname = 'Allow public select on voices') THEN
            CREATE POLICY "Allow public select on voices" ON public.voices FOR SELECT USING (true);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voices' AND policyname = 'Allow public insert on voices') THEN
            CREATE POLICY "Allow public insert on voices" ON public.voices FOR INSERT WITH CHECK (true);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voices' AND policyname = 'Allow public delete on voices') THEN
            CREATE POLICY "Allow public delete on voices" ON public.voices FOR DELETE USING (true);
          END IF;
        END $$;

        -- voice_generations table for Script-to-Voice outputs
        CREATE TABLE IF NOT EXISTS public.voice_generations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          title text NOT NULL,
          script text NOT NULL,
          voice_id uuid REFERENCES public.voices(id) ON DELETE SET NULL,
          voice_name text NOT NULL DEFAULT '',
          provider text NOT NULL DEFAULT 'ElevenLabs',
          audio_url text NOT NULL,
          duration_seconds numeric,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE public.voice_generations ENABLE ROW LEVEL SECURITY;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_generations' AND policyname = 'Allow public select on voice_generations') THEN
            CREATE POLICY "Allow public select on voice_generations" ON public.voice_generations FOR SELECT USING (true);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_generations' AND policyname = 'Allow public insert on voice_generations') THEN
            CREATE POLICY "Allow public insert on voice_generations" ON public.voice_generations FOR INSERT WITH CHECK (true);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_generations' AND policyname = 'Allow public delete on voice_generations') THEN
            CREATE POLICY "Allow public delete on voice_generations" ON public.voice_generations FOR DELETE USING (true);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabase();

    if (!tableChecked) {
      await ensureTable();
      tableChecked = true;
    }

    const { action, ...payload } = await req.json();

    // === VOICES CRUD ===
    if (action === "list") {
      const { data, error } = await supabase
        .from("voices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ voices: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      const { name, audio_url, type } = payload;
      if (!name || !audio_url) {
        return new Response(JSON.stringify({ error: "שם וקובץ אודיו נדרשים" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("voices")
        .insert({ name, audio_url, type: type || "recorded" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ voice: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { id } = payload;
      if (!id) {
        return new Response(JSON.stringify({ error: "מזהה קול נדרש" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("voices").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === VOICE GENERATIONS CRUD ===
    if (action === "list_generations") {
      const { data, error } = await supabase
        .from("voice_generations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ generations: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_generation") {
      const { title, script, voice_id, voice_name, provider, audio_url, duration_seconds } = payload;
      if (!title || !script || !audio_url) {
        return new Response(JSON.stringify({ error: "כותרת, תסריט וקובץ אודיו נדרשים" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("voice_generations")
        .insert({
          title,
          script,
          voice_id: voice_id || null,
          voice_name: voice_name || '',
          provider: provider || 'ElevenLabs',
          audio_url,
          duration_seconds: duration_seconds || null,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ generation: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_generation") {
      const { id } = payload;
      if (!id) {
        return new Response(JSON.stringify({ error: "מזהה נדרש" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("voice_generations").delete().eq("id", id);
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
    console.error("voice-manager error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה בניהול קולות" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
