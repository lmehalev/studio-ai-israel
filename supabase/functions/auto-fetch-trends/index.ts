const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function claudeAPI(system: string, user: string): Promise<string> {
  const KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!KEY) throw new Error("ANTHROPIC_API_KEY לא מוגדר");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 2048, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`Claude error ${r.status}`);
  const d = await r.json();
  return d.content?.[0]?.text || "";
}

function extractJSON(text: string): any {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try { return JSON.parse(clean); } catch {}
  const start = clean.indexOf("{");
  if (start !== -1) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < clean.length; i++) {
      const ch = clean[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(clean.slice(start, i + 1)); } catch {} } }
    }
  }
  return { trends: [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const categories = ["עולם עסקי", "נדל\"ן", "טכנולוגיה", "אופנה ויופי", "בריאות וכושר"];
    const cat = body?.category;
    const toFetch = cat && cat !== "all" ? [cat] : categories;

    const results: Record<string, any[]> = {};
    await Promise.all(toFetch.map(async (c) => {
      try {
        const raw = await claudeAPI(
          "אתה מומחה לתוכן ויראלי. החזר JSON תקין בלבד.",
          `צור 5 טרנדים לתוכן וידאו בתחום "${c}". פורמט: {"trends":[{"title":"...","description":"...","platform":"TikTok","category":"${c}","visualStyle":"...","contentHook":"...","engagementScore":8,"tags":[]}]}`
        );
        results[c] = extractJSON(raw).trends || [];
      } catch { results[c] = []; }
    }));

    const allTrends = Object.values(results).flat();
    return new Response(JSON.stringify({ trends: allTrends, byCategory: results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
