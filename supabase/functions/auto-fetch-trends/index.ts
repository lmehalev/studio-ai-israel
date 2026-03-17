import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIES = [
  'עולם עסקי וליווי עסקי',
  'נדל"ן',
  'בנייה ואחזקת מבנים',
  'ייבוא ויצוא',
  'טכנולוגיה וצ\'אטבוטים',
  'עמותות ומלכ"רים',
];

async function ensureTable(supabaseUrl: string, serviceKey: string) {
  const sql = `
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
    ALTER TABLE public.saved_trends ENABLE ROW LEVEL SECURITY;
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
  `;

  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!dbUrl) {
    console.warn('SUPABASE_DB_URL not set, skipping table creation');
    return;
  }

  // Use the Supabase REST API to run SQL
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json',
    },
  });
  console.log('Table ensure attempted');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!perplexityKey) {
    return new Response(JSON.stringify({ error: 'Missing PERPLEXITY_API_KEY' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Parse optional body for single category or "all"
  let categoriesToFetch = CATEGORIES;
  try {
    const body = await req.json();
    if (body?.category && body.category !== 'all') {
      categoriesToFetch = [body.category];
    }
  } catch {
    // No body = fetch all categories
  }

  const results: { category: string; count: number }[] = [];

  // Delete trends older than 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('saved_trends').delete().lt('fetched_at', weekAgo);

  for (const category of categoriesToFetch) {
    try {
      console.log(`Fetching trends for: ${category}`);

      const prompt = `Find the 5 most viral videos and content from the past 3 days in Israel in the field of "${category}".

CRITICAL RULES:
- ONLY include content with REAL, VERIFIED URLs from your search sources/citations.
- Every URL must come from your actual search results. If unavailable, use the citation URL.

For each item provide:
1. title - in Hebrew
2. description - in Hebrew, what the content shows and why it succeeded
3. platform - TikTok, Instagram, YouTube, Facebook, LinkedIn etc.
4. url - the REAL original link (must be from your sources)
5. views - estimated views/interactions as a string
6. tip - in Hebrew, actionable tip for creating similar content, focusing on image/video generation techniques
7. visual_style - in Hebrew, describe colors, composition, camera angles, editing style, lighting, typography

Return ONLY valid JSON:
{
  "trends": [
    { "title": "...", "description": "...", "platform": "...", "url": "...", "views": "...", "tip": "...", "visual_style": "..." }
  ],
  "summary": "סיכום קצר בעברית"
}`;

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            { role: 'system', content: 'You are an expert on digital trends in Israel. Always respond in valid JSON only. CRITICAL: Only include URLs from your actual search results/citations. Never fabricate URLs.' },
            { role: 'user', content: prompt }
          ],
          search_recency_filter: 'week',
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        console.error(`Perplexity error for ${category}:`, response.status);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const citations = data.citations || [];

      let parsed;
      try {
        const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        console.error(`JSON parse failed for ${category}`);
        continue;
      }

      if (!parsed.trends || !Array.isArray(parsed.trends)) continue;

      // Fix fake URLs with citations
      parsed.trends = parsed.trends.map((trend: any, idx: number) => {
        const url = trend.url || '';
        const isFake = !url || url === '#' || url.includes('example.com');
        if (isFake && citations[idx]) {
          trend.url = citations[idx];
        }
        return trend;
      });

      // Save each trend
      for (const trend of parsed.trends) {
        const { error } = await supabase.from('saved_trends').insert({
          category,
          title: trend.title || '',
          description: trend.description || '',
          platform: trend.platform || '',
          url: trend.url || '',
          views: trend.views || '',
          tip: trend.tip || '',
          visual_style: trend.visual_style || '',
          summary: parsed.summary || '',
        });
        if (error) console.error('Insert error:', error.message);
      }

      results.push({ category, count: parsed.trends.length });
      console.log(`Saved ${parsed.trends.length} trends for ${category}`);

    } catch (err) {
      console.error(`Error processing ${category}:`, err);
    }
  }

  return new Response(
    JSON.stringify({ success: true, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
