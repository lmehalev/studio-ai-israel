// Deno.serve used natively

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function claudeAPI(system: string, user: string, maxTokens = 3000): Promise<string> {
  const KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!KEY) throw new Error("ANTHROPIC_API_KEY לא מוגדר");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`Claude error ${r.status}: ${t.slice(0, 200)}`); }
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
  throw new Error("לא הצלחתי לפרסר JSON");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, type } = await req.json();
    if (!text?.trim()) return new Response(JSON.stringify({ error: "יש להזין טקסט" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const enhanceSystem = `אתה מומחה שיווק ותוכן וידאו בעברית. קח רעיון גולמי והפוך אותו לבריף מקצועי.
החזר JSON בלבד: {"enhanced":"הבריף המשופר עם הוק, גוף, הוכחה חברתית וCTA","variations":[{"type":"גרסת מכירה","text":"..."},{"type":"גרסת UGC","text":"..."},{"type":"גרסת תוכן אישי","text":"..."}]}
- עברית מקצועית טבעית, לא תרגום מאנגלית
- גרסת מכירה: ישירה, CTA חזק, דחיפות
- גרסת UGC: אותנטית, גוף ראשון, וואטסאפ-סגנון
- גרסת תוכן אישי: אישית, מעוררת השראה`;

    const scriptSystem = `אתה כותב תסריטים מקצועי לסרטוני וידאו בעברית.
החזר JSON בלבד: {"script":"התסריט המלא","scenes":[{"title":"שם הסצנה","spokenText":"2-3 משפטים טבעיים","visualDescription":"מה רואים","duration":10}]}
- עברית ישראלית טבעית
- פתיח ב-3 שניות שתופס תשומת לב
- סיום עם CTA ברור`;

    const raw = await claudeAPI(type === "script" ? scriptSystem : enhanceSystem, text);
    try { return new Response(JSON.stringify(extractJSON(raw)), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    catch { return new Response(JSON.stringify(type === "script" ? { script: raw, scenes: [] } : { enhanced: raw, variations: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
  } catch (e) {
    console.error("enhance-prompt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
