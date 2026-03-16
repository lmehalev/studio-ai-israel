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

    const systemPrompt = `אתה במאי קולנוע ותסריטאי וידאו ברמה עולמית. אתה יוצר תסריטים קולנועיים מרהיבים — כמו סרט קצר מקצועי, סרט אנימציה או פרסומת ברמת הוליווד.

בהתבסס על בקשת המשתמש, צור תסריט מלא לסרטון AI קולנועי שמספר סיפור ויזואלי עוצמתי.
${avatarContext}${voiceContext}${imageContext}${brandInfo}

החזר JSON בפורמט הבא בלבד (ללא טקסט נוסף):
{
  "title": "שם הסרטון",
  "duration": 90,
  "script": "התסריט המלא כטקסט רציף",
  "scenes": [
    {
      "id": 1,
      "title": "שם הסצנה",
      "speaker": "שם הדובר/אווטאר או 'קריין'",
      "spokenText": "מה נאמר בסצנה הזו",
      "visualDescription": "תיאור קולנועי מלא — ראה הנחיות למטה",
      "cameraDirection": "תיאור זווית ותנועת מצלמה",
      "environment": "תיאור מפורט של הסביבה, התאורה והאווירה",
      "characters": "תיאור הדמויות, הביטויים, התנוחות והפעולות שלהן",
      "subtitleText": "הכתובית שתופיע על המסך",
      "icons": ["🎯", "💡"],
      "duration": 8,
      "transition": "fade",
      "videoStyle": "cinematic / animation / documentary / commercial"
    }
  ],
  "style": {
    "tone": "דרמטי / קליל / מעורר השראה",
    "pace": "מהיר / בינוני / איטי",
    "music": "סגנון מוזיקה מומלץ",
    "cinematicStyle": "קולנועי / אנימציה / דוקומנטרי / פרסומת"
  }
}

## הנחיות קריטיות ליצירת תסריט קולנועי:

### חזון ויזואלי — זה החלק הכי חשוב!
- כל סצנה חייבת לתאר עולם ויזואלי שלם כמו סרט קולנוע אמיתי
- תאר סביבות מציאותיות ספציפיות: "אישה צעירה יושבת ברכבת תחתית צפופה בשעת שיא, מחזיקה טלפון, דרך החלון רואים עיר גדולה בשקיעה עם גורדי שחקים"
- תאר דמויות חיות: "גבר מבוגר בשנות ה-60, שיער אפור, חולצה מכופתרת כחולה, יושב בספסל בפארק ירוק, מביט למצלמה עם חיוך חם ומדבר בביטחון"
- תאר תנועת מצלמה: "המצלמה מתקרבת לאט מ-wide shot לקלוז-אפ על הפנים", "דרון שוט ממעוף הציפור מעל שדה ירוק", "מצלמה עוקבת מאחורי הדמות ברחוב שוק הומה"
- תאר תאורה ואווירה: "תאורה חמה של שעת הזהב", "תאורת נאון כחולה-ורודה בלילה", "אור טבעי רך דרך חלון גדול"

### סוגי סצנות שחובה לשלב (מגוון!):
- סצנת פתיחה דרמטית: זום אין ממבט רחב, או דמות שנכנסת לפריים
- סצנות "חיים אמיתיים": אנשים ברכבת, בבית קפה, במשרד, ברחוב, בבית — סיטואציות יומיומיות אמיתיות
- סצנות אקשן/תנועה: מעבר בין מיקומים, הליכה, ריצה, נהיגה
- סצנות קלוז-אפ רגשיות: הבעות פנים, מבטים, רגעי תובנה
- סצנות אווירה/נוף: נופים, עירוניות, טבע — ליצור עומק קולנועי
- סצנת סיום: מסר חזק עם CTA, קלוז-אפ או wide shot דרמטי

### טקסט ודיבור:
- פתיח חד שתופס תשומת לב ב-3 שניות (Hook דרמטי)
- משפטים קצרים וחזקים — כמו קריינות סרט
- עברית ישראלית טבעית — שפה חיה ודינמית
- אם יש כמה דמויות — צור דיאלוגים טבעיים ביניהן
- סיום עם CTA ברור ומשכנע

### סגנון:
- ציין מעברים קולנועיים: dissolve, match cut, whip pan, fade to black
- כל סצנה צריכה להרגיש כמו שוט מסרט — לא כמו שקופית מצגת
- הוסף אמוג'י/אייקונים רלוונטיים שמחזקים את המסר
- אם המשתמש לא ציין סגנון — בחר את הסגנון הקולנועי הכי מתאים (אנימציה, ריאליסטי, דוקומנטרי, פרסומת)`;

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
      // Try extracting JSON from markdown code blocks first
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try parsing the raw content — might have leading/trailing text
        const braceMatch = content.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[0]);
        } else {
          parsed = JSON.parse(content.trim());
        }
      }
      // Ensure scenes array exists
      if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
        parsed.scenes = [];
      }
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Content preview:", content?.slice(0, 300));
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
