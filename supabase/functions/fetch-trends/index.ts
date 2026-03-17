const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { industry, language = 'he' } = await req.json();

    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Perplexity API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const industryText = industry || 'שיווק דיגיטלי';

    const prompt = `מצא לי את 5-8 הסרטונים והתכנים הויראליים ביותר מהשבוע האחרון בישראל בתחום "${industryText}".

עבור כל פריט תן לי:
1. כותרת (title)
2. תיאור קצר (description) - מה הסרטון/תוכן מראה ולמה הוא הצליח
3. פלטפורמה (platform) - TikTok, Instagram, YouTube, Facebook, LinkedIn וכו'
4. קישור (url) - הקישור המקורי לתוכן
5. מספר צפיות/אינטראקציות משוער (views) - מספר בלבד
6. טיפ (tip) - מה אפשר ללמוד מהתוכן הזה ליצירת תוכן דומה

החזר את התשובה בפורמט JSON בלבד, ללא טקסט נוסף, במבנה:
{
  "trends": [
    {
      "title": "...",
      "description": "...",
      "platform": "...",
      "url": "...",
      "views": "...",
      "tip": "..."
    }
  ],
  "summary": "סיכום קצר של הטרנדים העיקריים השבוע"
}`;

    console.log('Fetching trends for industry:', industryText);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'אתה מומחה לטרנדים דיגיטליים בישראל. תמיד תענה בעברית ובפורמט JSON בלבד. אל תוסיף טקסט מחוץ ל-JSON.'
          },
          { role: 'user', content: prompt }
        ],
        search_recency_filter: 'week',
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Perplexity API error:', response.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `Perplexity API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    // Try to parse JSON from response
    let parsed;
    try {
      // Remove code fences if present
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, return raw content
      parsed = { trends: [], summary: content, raw: true };
    }

    console.log('Trends fetched successfully, count:', parsed.trends?.length || 0);

    return new Response(
      JSON.stringify({ success: true, ...parsed, citations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching trends:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch trends';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
