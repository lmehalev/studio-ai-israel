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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { prompt, avatarNames, voiceNames, brandContext, hasImages } = await req.json();

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: "יש להזין תיאור לסרטון" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const avatarContext = avatarNames?.length
      ? `\nהאווטארים הזמינים לסרטון: ${avatarNames.join(", ")}. שלב אותם בתסריט כדוברים או דמויות.`
      : "";

    const voiceContext = voiceNames?.length
      ? `\nהקולות הזמינים לקריינות: ${voiceNames.join(", ")}. ציין בכל סצנה מי הדובר/קריין.`
      : "";

    const imageContext = hasImages
      ? `\nיש תמונות/לוגו שהמשתמש העלה — שלב אותן בסצנות כשרלוונטי (הצגת לוגו, תמונת מוצר וכו').`
      : "";

    const brandInfo = brandContext
      ? `\nהמותג: ${brandContext}`
      : "";

    const systemPrompt = `אתה תסריטאי וידאו מקצועי שיוצר תסריטים מוכנים לייצור. אתה כותב עברית ישראלית טבעית.

בהתבסס על בקשת המשתמש, צור תסריט מלא לסרטון וידאו מקצועי.
${avatarContext}${voiceContext}${imageContext}${brandInfo}

החזר JSON בפורמט הבא בלבד (ללא טקסט נוסף):
{
  "title": "שם הסרטון",
  "duration": 60,
  "script": "התסריט המלא כטקסט רציף שהדובר/ים יגידו",
  "scenes": [
    {
      "id": 1,
      "title": "שם הסצנה",
      "speaker": "שם הדובר/אווטאר או 'קריין'",
      "spokenText": "מה נאמר בסצנה הזו",
      "visualDescription": "תיאור מפורט של מה שרואים — כולל טקסטים על המסך, אייקונים, תנועות, רקע",
      "subtitleText": "הכתובית שתופיע על המסך",
      "icons": ["🎯", "💡"],
      "duration": 8,
      "transition": "fade"
    }
  ],
  "style": {
    "tone": "מקצועי / קליל / דרמטי",
    "pace": "מהיר / בינוני / איטי",
    "music": "סגנון מוזיקה מומלץ"
  }
}

הנחיות:
- פתיח חד שתופס תשומת לב ב-3 שניות (Hook)
- משפטים קצרים, ברורים, מותאמים לדיבור מול מצלמה
- עברית ישראלית טבעית — לא תרגום מאנגלית
- כל סצנה עם טקסט מדובר + תיאור חזותי + כתובית + אייקונים רלוונטיים
- סיום עם CTA ברור
- אם יש כמה אווטארים/קולות — חלק את הדיבור ביניהם בצורה טבעית
- ציין מעברים בין סצנות (fade, cut, slide)
- הוסף אמוג'י/אייקונים רלוונטיים לכל סצנה`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
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
      throw new Error("שגיאה בשירות ה-AI");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      parsed = { script: content, scenes: [], title: "תסריט", duration: 60, style: {} };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-script error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה ביצירת תסריט" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
