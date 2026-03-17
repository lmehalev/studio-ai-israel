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

    const prompt = `אתה מומחה לטרנדים ויראליים ברשתות החברתיות ומומחה קריאייטיב. מצא בדיוק 10 טרנדים חזקים ואיכותיים מהשבוע האחרון בתחום "${industryText}".

כללים קריטיים:
- עדיפות לתוכן ישראלי בעברית. אם אין מספיק, אפשר להוסיף השראות מחו"ל שרלוונטיות לשוק הישראלי.
- בדיוק 10 טרנדים - לא פחות ולא יותר.
- רק תוכן שבאמת התפוצץ ויראלית - צפיות גבוהות, שיתופים, תגובות.
- כלול גם תמונות ויזואליות חזקות (פרומפטים, עיצובים, קמפיינים) ולא רק סרטונים!
- כל URL חייב להיות אמיתי ומאומת ממקורות החיפוש שלך. אם אין לך URL אמיתי, השתמש בURL של המקור/ציטוט.
- הכל בעברית חוץ משמות פלטפורמות.

לכל טרנד תן:
1. title - כותרת קצרה ומושכת בעברית
2. description - תיאור קצר בעברית: מה התוכן מראה, למה הוא הצליח, מה הקהל אהב
3. platform - TikTok, Instagram, YouTube, Facebook, LinkedIn
4. url - קישור אמיתי מהמקורות שלך
5. views - מספר צפיות/אינטראקציות משוער
6. content_type - "video" או "image" או "carousel" - סוג התוכן
7. tip - טיפ קריאייטיבי בעברית: איך ליצור תוכן דומה, עם דגש על מבנה הסרטון/תמונה, קצב העריכה, טקסטים ו-CTA
8. visual_style - תיאור מפורט של הסגנון הויזואלי בעברית: צבעים דומיננטיים, קומפוזיציה, זוויות צילום, סגנון עריכה, תאורה, טיפוגרפיה, אפקטים מיוחדים
9. music_style - תיאור סגנון המוזיקה/אודיו: סוג המוזיקה, קצב (BPM משוער), אווירה, האם יש קריינות, אפקטי סאונד בולטים. לתמונות - "ללא"

החזר רק JSON תקין:
{
  "trends": [
    {
      "title": "...",
      "description": "...",
      "platform": "...",
      "url": "...",
      "views": "...",
      "content_type": "video|image|carousel",
      "tip": "...",
      "visual_style": "...",
      "music_style": "..."
    }
  ],
  "summary": "סיכום של 2-3 משפטים בעברית על הטרנדים והסגנון הויזואלי השולט השבוע"
}`;

    console.log('Fetching trends for industry:', industryText);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'אתה מומחה בטרנדים דיגיטליים בישראל ובעולם ומומחה קריאייטיב. תמיד תענה ב-JSON תקין בלבד. קריטי: השתמש רק בURLים שמגיעים מתוצאות החיפוש שלך. אל תמציא URLים. תן בדיוק 10 טרנדים. כלול גם טרנדים של תמונות ולא רק סרטונים.'
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

    let parsed;
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { trends: [], summary: content, raw: true };
    }

    // Replace fake URLs with citation URLs where possible
    if (parsed.trends && citations.length > 0) {
      parsed.trends = parsed.trends.map((trend: any, idx: number) => {
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

    // Limit to max 10 trends
    if (parsed.trends && parsed.trends.length > 10) {
      parsed.trends = parsed.trends.slice(0, 10);
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
