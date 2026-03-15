import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";

    if (type === "enhance") {
      systemPrompt = `אתה מומחה שיווק ותוכן וידאו בעברית. תפקידך לקחת רעיון גולמי ולהפוך אותו לבריף מקצועי ומסודר ליצירת סרטון.

עליך להחזיר JSON בפורמט הבא בלבד (ללא טקסט נוסף):
{
  "enhanced": "הבריף המשופר עם מבנה של הוק, גוף, הוכחה חברתית וקריאה לפעולה",
  "variations": [
    {"type": "גרסת מכירה", "text": "..."},
    {"type": "גרסת UGC", "text": "..."},
    {"type": "גרסת תוכן אישי", "text": "..."}
  ]
}

הנחיות חשובות:
- כתוב בעברית מקצועית, טבעית ושוטפת — כמו קופירייטר ישראלי מנוסה
- הימנע מתרגום מאנגלית — כתוב כאילו עברית היא שפת האם שלך
- השתמש בביטויים ישראליים אותנטיים, לא מליצות ותרגומים ישירים
- כל וריאציה צריכה להיות שונה בסגנון ובטון
- גרסת מכירה: ישירה, עם CTA חזק, דחיפות — בשפה שמוכרת בישראל
- גרסת UGC: אותנטית, בגוף ראשון, כאילו מישהו מספר לחבר בוואטסאפ
- גרסת תוכן אישי: אישית, מעוררת השראה, סיפור אישי אמיתי
- הבריף המשופר צריך לכלול: הוק (פתיח תופס), גוף (בעיה + פתרון), הוכחה חברתית, וקריאה לפעולה
- אם יש שמות מוצרים או מותגים באנגלית — השאר אותם באנגלית
- הקפד על פיסוק נכון, ניקוד תקין (אם רלוונטי), וסדר מילים טבעי בעברית`;
    } else if (type === "script") {
      systemPrompt = `אתה כותב תסריטים מקצועי לסרטוני וידאו בעברית. תפקידך ליצור תסריט מוכן לצילום/הקלטה.

עליך להחזיר JSON בפורמט הבא בלבד (ללא טקסט נוסף):
{
  "script": "התסריט המלא שהאווטאר יגיד",
  "scenes": [
    {"title": "שם הסצנה", "spokenText": "מה נאמר", "visualDescription": "מה רואים", "duration": 5}
  ]
}

הנחיות:
- כתוב בעברית טבעית ושוטפת
- תסריט שמתאים לדיבור, לא לקריאה
- כל סצנה עם טקסט ותיאור חזותי
- פתיח חד שתופס תשומת לב
- סיום עם קריאה לפעולה ברורה`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד רגע" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "נדרש טעינת קרדיטים" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "שגיאה בשירות ה-AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Try to parse JSON from the response
    let parsed;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      parsed = { enhanced: content, variations: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enhance-prompt error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
