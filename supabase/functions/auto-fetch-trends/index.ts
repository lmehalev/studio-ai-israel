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

      // Delete existing trends for this category before inserting new ones
      await supabase.from('saved_trends').delete().eq('category', category);

      const prompt = `אתה מומחה לטרנדים ויראליים ברשתות החברתיות. מצא בדיוק 10 טרנדים חזקים ואיכותיים מהשבוע האחרון בתחום "${category}".

כללים קריטיים:
- עדיפות לתוכן ישראלי בעברית. אם אין מספיק, אפשר להוסיף השראות מחו"ל שרלוונטיות לשוק הישראלי.
- בדיוק 10 טרנדים - לא פחות ולא יותר.
- רק תוכן שבאמת התפוצץ ויראלית - צפיות גבוהות, שיתופים, תגובות.
- כל URL חייב להיות אמיתי ומאומת ממקורות החיפוש שלך.
- הכל בעברית חוץ משמות פלטפורמות.

לכל טרנד תן:
1. title - כותרת קצרה ומושכת בעברית
2. description - תיאור קצר בעברית: מה התוכן מראה, למה הוא הצליח
3. platform - TikTok, Instagram, YouTube, Facebook, LinkedIn
4. url - קישור אמיתי מהמקורות שלך
5. views - מספר צפיות/אינטראקציות משוער
6. tip - טיפ קריאייטיבי בעברית: איך ליצור תוכן דומה, עם דגש על סגנון צילום, עריכה, וטקסטים
7. visual_style - תיאור הסגנון הויזואלי בעברית: צבעים, קומפוזיציה, זוויות צילום, סגנון עריכה

החזר רק JSON תקין:
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
          model: 'sonar-pro',
          messages: [
            { role: 'system', content: 'אתה מומחה בטרנדים דיגיטליים בישראל ובעולם. תמיד תענה ב-JSON תקין בלבד. קריטי: השתמש רק בURLים מתוצאות החיפוש שלך. תן בדיוק 10 טרנדים.' },
            { role: 'user', content: prompt }
          ],
          search_recency_filter: 'week',
          temperature: 0.3,
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

      // Limit to 10
      const trendsToSave = parsed.trends.slice(0, 10);

      // Save each trend
      for (const trend of trendsToSave) {
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

      results.push({ category, count: trendsToSave.length });
      console.log(`Saved ${trendsToSave.length} trends for ${category}`);

    } catch (err) {
      console.error(`Error processing ${category}:`, err);
    }
  }

  return new Response(
    JSON.stringify({ success: true, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
