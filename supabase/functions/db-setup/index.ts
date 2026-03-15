import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(JSON.stringify({ error: "SUPABASE_DB_URL not set" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Use the Supabase Management API approach via pg
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.4/mod.js");
    const sql = postgres(dbUrl, { ssl: "require" });

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS public.projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        avatar_id text,
        avatar_name text,
        video_type text NOT NULL DEFAULT 'פרומפט חופשי',
        status text NOT NULL DEFAULT 'טיוטה',
        provider text,
        aspect_ratio text NOT NULL DEFAULT '9:16',
        brand_id text,
        content jsonb NOT NULL DEFAULT '{}',
        scenes jsonb NOT NULL DEFAULT '[]',
        settings jsonb NOT NULL DEFAULT '{}',
        script text,
        prompt text,
        enhanced_prompt text,
        tags text[] NOT NULL DEFAULT '{}',
        current_version int NOT NULL DEFAULT 1,
        output_count int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await sql.unsafe(`ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;`);
    
    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Allow all access to projects') THEN
          CREATE POLICY "Allow all access to projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `);

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS public.project_outputs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
        name text NOT NULL,
        description text,
        status text NOT NULL DEFAULT 'ממתין',
        provider text,
        aspect_ratio text,
        estimated_length text,
        video_url text,
        thumbnail_url text,
        script text,
        prompt text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await sql.unsafe(`ALTER TABLE public.project_outputs ENABLE ROW LEVEL SECURITY;`);
    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_outputs' AND policyname = 'Allow all access to project_outputs') THEN
          CREATE POLICY "Allow all access to project_outputs" ON public.project_outputs FOR ALL USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `);

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS public.project_timeline (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
        type text NOT NULL,
        description text NOT NULL,
        status text NOT NULL DEFAULT 'טיוטה',
        "timestamp" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await sql.unsafe(`ALTER TABLE public.project_timeline ENABLE ROW LEVEL SECURITY;`);
    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_timeline' AND policyname = 'Allow all access to project_timeline') THEN
          CREATE POLICY "Allow all access to project_timeline" ON public.project_timeline FOR ALL USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `);

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS public.project_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
        version int NOT NULL DEFAULT 1,
        changes text NOT NULL,
        status text NOT NULL DEFAULT 'טיוטה',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await sql.unsafe(`ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;`);
    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_versions' AND policyname = 'Allow all access to project_versions') THEN
          CREATE POLICY "Allow all access to project_versions" ON public.project_versions FOR ALL USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `);

    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION public.update_updated_at()
      RETURNS TRIGGER AS $func$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $func$ LANGUAGE plpgsql;
    `);

    await sql.unsafe(`DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;`);
    await sql.unsafe(`
      CREATE TRIGGER projects_updated_at
        BEFORE UPDATE ON public.projects
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    `);

    await sql.end();

    return new Response(JSON.stringify({ success: true, message: "All tables created successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
