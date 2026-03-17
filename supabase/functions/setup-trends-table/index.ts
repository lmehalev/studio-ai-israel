import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'SUPABASE_DB_URL not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Connect directly to postgres
    const { Pool } = await import('https://deno.land/x/postgres@v0.19.3/mod.ts');
    const pool = new Pool(dbUrl, 1, true);
    const conn = await pool.connect();

    await conn.queryObject(`
      CREATE TABLE IF NOT EXISTS public.saved_trends (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category text NOT NULL,
        title text NOT NULL,
        description text NOT NULL DEFAULT '',
        platform text NOT NULL DEFAULT '',
        url text NOT NULL DEFAULT '',
        views text NOT NULL DEFAULT '',
        tip text NOT NULL DEFAULT '',
        visual_style text NOT NULL DEFAULT '',
        summary text NOT NULL DEFAULT '',
        fetched_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await conn.queryObject(`ALTER TABLE public.saved_trends ENABLE ROW LEVEL SECURITY;`);

    // Create policies if they don't exist
    await conn.queryObject(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_trends' AND policyname = 'Allow public select on saved_trends') THEN
          CREATE POLICY "Allow public select on saved_trends" ON public.saved_trends FOR SELECT TO public USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_trends' AND policyname = 'Allow public insert on saved_trends') THEN
          CREATE POLICY "Allow public insert on saved_trends" ON public.saved_trends FOR INSERT TO public WITH CHECK (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_trends' AND policyname = 'Allow public delete on saved_trends') THEN
          CREATE POLICY "Allow public delete on saved_trends" ON public.saved_trends FOR DELETE TO public USING (true);
        END IF;
      END $$;
    `);

    await conn.queryObject(`CREATE INDEX IF NOT EXISTS idx_saved_trends_category ON public.saved_trends(category);`);
    await conn.queryObject(`CREATE INDEX IF NOT EXISTS idx_saved_trends_fetched_at ON public.saved_trends(fetched_at DESC);`);

    conn.release();
    await pool.end();

    return new Response(
      JSON.stringify({ success: true, message: 'saved_trends table created successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Setup error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
