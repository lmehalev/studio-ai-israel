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
    const { Pool } = await import('https://deno.land/x/postgres@v0.19.3/mod.ts');
    const pool = new Pool(dbUrl, 1, true);
    const conn = await pool.connect();

    // Enable required extensions
    await conn.queryObject(`CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;`);
    await conn.queryObject(`CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Remove existing job if any
    await conn.queryObject(`SELECT cron.unschedule('auto-fetch-trends-every-2-days') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-fetch-trends-every-2-days');`).catch(() => {});

    // Schedule: every 2 days at 06:00 UTC
    await conn.queryObject(`
      SELECT cron.schedule(
        'auto-fetch-trends-every-2-days',
        '0 6 */2 * *',
        $$
        SELECT net.http_post(
          url := '${supabaseUrl}/functions/v1/auto-fetch-trends',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}'::jsonb,
          body := '{"category": "all"}'::jsonb
        ) AS request_id;
        $$
      );
    `);

    conn.release();
    await pool.end();

    return new Response(
      JSON.stringify({ success: true, message: 'Cron job scheduled: every 2 days at 06:00 UTC' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Cron setup error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
