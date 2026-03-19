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

    const { action } = await req.json();

    if (action === "migrate") {
      // Create brands table
      const { error: e1 } = await supabase.rpc("exec_sql", {
        sql: `
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
          ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='brands' AND policyname='Allow public all on brands') THEN
              CREATE POLICY "Allow public all on brands" ON public.brands FOR ALL TO public USING (true) WITH CHECK (true);
            END IF;
          END $$;
          
          CREATE TABLE IF NOT EXISTS public.scripts (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            content text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now()
          );
          ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scripts' AND policyname='Allow public all on scripts') THEN
              CREATE POLICY "Allow public all on scripts" ON public.scripts FOR ALL TO public USING (true) WITH CHECK (true);
            END IF;
          END $$;
        `
      });
      
      // If rpc doesn't work, try direct REST
      if (e1) {
        // Use the postgres connection directly via fetch
        const dbUrl = Deno.env.get("SUPABASE_DB_URL");
        if (!dbUrl) throw new Error("No DB URL configured");
        
        // Fallback: just return the error and let us handle it
        return new Response(JSON.stringify({ error: "rpc failed: " + e1.message, hint: "Tables need to be created manually" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
