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

    const prompt = `Find the 5-8 most viral videos and content from the past week in Israel in the field of "${industryText}".

CRITICAL RULES:
- ONLY include content with REAL, VERIFIED URLs that actually exist. Do NOT invent or guess URLs.
- Every URL must come from your search sources/citations. If you cannot find a real URL, use the citation URL where you found the information.
- Prefer direct links to the actual content (TikTok, Instagram, YouTube posts). If unavailable, link to the article/source discussing it.

For each item provide:
1. title - in Hebrew
2. description - in Hebrew, what the content shows and why it succeeded  
3. platform - TikTok, Instagram, YouTube, Facebook, LinkedIn etc.
4. url - the REAL original link (must be from your sources)
5. views - estimated views/interactions as a string
6. tip - in Hebrew, what can be learned for creating similar content, specifically tips for generating images and videos that match this trend style
7. visual_style - in Hebrew, describe the visual style, colors, composition, camera angles, editing style that made this content successful

Return ONLY valid JSON, no extra text:
{
  "trends": [
    {
      "title": "...",
      "description": "...",
      "platform": "...",
      "url": "...",
      "views": "...",
      "tip": "...",
      "visual_style": "..."
    }
  ],
  "summary": "סיכום קצר בעברית של הטרנדים והסגנון הויזואלי השולט השבוע"
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
            content: 'You are an expert on digital trends in Israel. Always respond in valid JSON only. CRITICAL: Only include URLs that come from your actual search results/citations. Never fabricate URLs. If you reference content, use the citation URL where you found it. Include visual style analysis for each trend.'
          },
          { role: 'user', content: prompt }
        ],
        search_recency_filter: 'week',
        temperature: 0.2,
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

    // Replace fake URLs with citation URLs where possible
    if (parsed.trends && citations.length > 0) {
      parsed.trends = parsed.trends.map((trend: any, idx: number) => {
        // If URL looks fake or is missing, use citation
        const url = trend.url || '';
        const isFake = !url || url === '#' || url.includes('example.com') || 
          (url.includes('tiktok.com') && url.includes('1234')) ||
          (url.includes('instagram.com') && url.match(/\/[A-Za-z0-9]{3,5}\/?$/)) ||
          (url.includes('youtube.com') && url.includes('abc123'));
        if (isFake && citations[idx]) {
          trend.url = citations[idx];
        }
        return trend;
      });
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
