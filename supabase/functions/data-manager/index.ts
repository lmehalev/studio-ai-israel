import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, data } = body;

    // ===== SETUP (create tables if needed) =====
    if (action === "setup") {
      const dbUrl = Deno.env.get("SUPABASE_DB_URL");
      if (!dbUrl) throw new Error("SUPABASE_DB_URL not set");
      
      const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
      const pool = new Pool(dbUrl, 1);
      const conn = await pool.connect();
      try {
        await conn.queryArray(`
          CREATE TABLE IF NOT EXISTS public.brands (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            logo text,
            colors text[] NOT NULL DEFAULT '{}',
            tone text NOT NULL DEFAULT '',
            target_audience text NOT NULL DEFAULT '',
            industry text NOT NULL DEFAULT '',
            departments text[] NOT NULL DEFAULT '{}',
            created_at timestamptz NOT NULL DEFAULT now()
          );
        `);
        await conn.queryArray(`ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;`);
        await conn.queryArray(`
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='brands' AND policyname='Allow public all on brands') THEN
              CREATE POLICY "Allow public all on brands" ON public.brands FOR ALL TO public USING (true) WITH CHECK (true);
            END IF;
          END $$;
        `);
        await conn.queryArray(`
          CREATE TABLE IF NOT EXISTS public.scripts (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            content text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now()
          );
        `);
        await conn.queryArray(`ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;`);
        await conn.queryArray(`
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scripts' AND policyname='Allow public all on scripts') THEN
              CREATE POLICY "Allow public all on scripts" ON public.scripts FOR ALL TO public USING (true) WITH CHECK (true);
            END IF;
          END $$;
        `);
        return new Response(JSON.stringify({ ok: true, message: "Tables created" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } finally {
        conn.release();
        await pool.end();
      }
    }

    // ===== BRANDS =====
    if (action === "list_brands") {
      const { data: brands, error } = await supabase
        .from("brands")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return new Response(JSON.stringify({ brands }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "save_brand") {
      const { data: brand, error } = await supabase
        .from("brands")
        .upsert(data, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ brand }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete_brand") {
      const { error } = await supabase.from("brands").delete().eq("id", data.id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== SCRIPTS =====
    if (action === "list_scripts") {
      const { data: scripts, error } = await supabase
        .from("scripts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ scripts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "save_script") {
      const { data: script, error } = await supabase
        .from("scripts")
        .upsert(data, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ script }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete_script") {
      const { error } = await supabase.from("scripts").delete().eq("id", data.id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== BULK IMPORT =====
    if (action === "import_all") {
      const results: string[] = [];
      
      // Import brands
      if (data.brands && data.brands.length > 0) {
        for (const b of data.brands) {
          const { error } = await supabase.from("brands").upsert({
            id: b.id,
            name: b.name,
            logo: b.logo || null,
            colors: b.colors || [],
            tone: b.tone || '',
            target_audience: b.targetAudience || b.target_audience || '',
            industry: b.industry || '',
            departments: b.departments || [],
          }, { onConflict: "id" });
          if (error) results.push(`Brand ${b.name}: ${error.message}`);
        }
      }
      
      // Import scripts
      if (data.scripts && data.scripts.length > 0) {
        for (const s of data.scripts) {
          const { error } = await supabase.from("scripts").upsert({
            id: s.id,
            name: s.name,
            content: s.content || '',
          }, { onConflict: "id" });
          if (error) results.push(`Script ${s.name}: ${error.message}`);
        }
      }

      return new Response(JSON.stringify({ 
        ok: true, 
        imported: { brands: data.brands?.length || 0, scripts: data.scripts?.length || 0 },
        errors: results 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== EXPORT ALL =====
    if (action === "export_all") {
      const { data: brands } = await supabase.from("brands").select("*").order("created_at");
      const { data: scripts } = await supabase.from("scripts").select("*").order("created_at");
      return new Response(JSON.stringify({ brands: brands || [], scripts: scripts || [] }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action: " + action }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
