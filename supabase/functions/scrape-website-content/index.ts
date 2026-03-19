const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BLOCKED_HOSTS = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|localhost|::1)/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Security: HTTPS only, block internal IPs
    if (!formattedUrl.startsWith('https://')) {
      return new Response(JSON.stringify({ success: false, error: 'Only HTTPS URLs are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    try {
      const parsed = new URL(formattedUrl);
      if (BLOCKED_HOSTS.test(parsed.hostname)) {
        return new Response(JSON.stringify({ success: false, error: 'Internal/private URLs are not allowed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 1: Scrape with Firecrawl
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Scraping URL for content extraction:', formattedUrl);

    const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'screenshot', 'branding', 'links'],
        onlyMainContent: false,
        waitFor: 5000,
      }),
    });

    if (!scrapeRes.ok) {
      const errData = await scrapeRes.text();
      console.error('Firecrawl error:', errData);
      return new Response(JSON.stringify({ success: false, error: `Scraping failed: ${scrapeRes.status}` }),
        { status: scrapeRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const scrapeData = await scrapeRes.json();
    const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || '';
    const branding = scrapeData?.data?.branding || scrapeData?.branding || null;
    const screenshot = scrapeData?.data?.screenshot || scrapeData?.screenshot || null;
    const metadata = scrapeData?.data?.metadata || scrapeData?.metadata || {};
    const links = scrapeData?.data?.links || scrapeData?.links || [];

    // Truncate markdown to prevent excessive AI costs
    const truncatedMarkdown = markdown.slice(0, 8000);

    // Step 2: Extract structured content via AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      // Return raw scrape data without AI extraction
      return new Response(JSON.stringify({
        success: true,
        brand: branding ? {
          colors: branding.colors ? Object.values(branding.colors).filter(Boolean) : [],
          logoCandidates: [branding.logo, branding.images?.logo, branding.images?.favicon, branding.images?.ogImage].filter(Boolean),
          typographyHint: branding.typography?.fontFamilies?.primary || branding.fonts?.[0]?.family || null,
        } : null,
        content: null,
        screenshot,
        sourceUrl: formattedUrl,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const extractionPrompt = `Analyze this website content and extract structured marketing data.
Return ONLY valid JSON with this exact structure (Hebrew values when the site is Hebrew):

{
  "mainHeadline": "string - the main H1/hero headline",
  "subheadline": "string - secondary headline or tagline",
  "bullets": ["string array - 3 to 8 key selling points, features, or benefits"],
  "ctas": ["string array - 2 to 5 call-to-action texts found (button texts, link texts)"],
  "keywords": ["string array - 5 to 15 important keywords/phrases"],
  "faqPairs": [{"q": "question", "a": "short answer"}],
  "valueProposition": "string - the core value proposition in one sentence",
  "targetAudience": "string - who this product/service is for",
  "tone": "string - the brand's voice tone (professional/casual/playful/authoritative/etc)"
}

Website metadata:
Title: ${metadata.title || 'N/A'}
Description: ${metadata.description || 'N/A'}
OG Title: ${metadata.ogTitle || metadata['og:title'] || 'N/A'}
OG Description: ${metadata.ogDescription || metadata['og:description'] || 'N/A'}

Website content (markdown):
${truncatedMarkdown}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a marketing content extractor. Return ONLY valid JSON, no markdown fences, no explanation.' },
          { role: 'user', content: extractionPrompt },
        ],
      }),
    });

    let content = null;
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const rawText = aiData.choices?.[0]?.message?.content || '';
      // Strip markdown fences if present
      const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      try {
        content = JSON.parse(cleaned);
      } catch {
        console.warn('AI returned non-JSON content:', rawText.slice(0, 200));
      }
    } else {
      console.warn('AI extraction failed:', aiRes.status);
    }

    // Build brand kit from branding data
    const brandKit = branding ? {
      colors: branding.colors ? Object.values(branding.colors).filter((v): v is string => typeof v === 'string' && v.startsWith('#')) : [],
      logoCandidates: [branding.logo, branding.images?.logo, branding.images?.favicon, branding.images?.ogImage].filter(Boolean) as string[],
      typographyHint: branding.typography?.fontFamilies?.primary || branding.fonts?.[0]?.family || null,
      colorScheme: branding.colorScheme || null,
    } : null;

    return new Response(JSON.stringify({
      success: true,
      brand: brandKit,
      content,
      screenshot,
      sourceUrl: formattedUrl,
      metadata: {
        title: metadata.title,
        description: metadata.description,
        ogImage: metadata.ogImage || metadata['og:image'],
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('scrape-website-content error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
