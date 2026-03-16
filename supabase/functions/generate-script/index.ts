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
      ? `\nיש תמונות/לוגו שהמשתמש העלה — שלב אותן בסצנות. הלוגו חייב להופיע לפחות בפתיחה ובסיום.`
      : "";

    const brandInfo = brandContext
      ? `\nהמותג: ${brandContext}. חובה לשלב את שם המותג ואת המסר המרכזי שלו בתסריט.`
      : "";

    const systemPrompt = `אתה במאי קולנוע ותסריטאי וידאו ברמה עולמית. אתה יוצר תסריטים קולנועיים מרהיבים — כמו סרט קצר מקצועי או פרסומת ברמת הוליווד.

## מגבלה טכנית קריטית — קרא בעיון!
מנוע הווידאו AI יוצר קליפ אחד של 10 שניות בלבד. לכן:
- צור תסריט של סצנה אחת בת 10 שניות בדיוק
- הפוך את ה-10 שניות למושלמות — כל שנייה חשובה
- כלול: הוק תופס (2 שניות) → תוכן מרכזי (5-6 שניות) → CTA/סיום (2-3 שניות)
- הכתוביות חייבות להיות קצרות וקולעות (4-6 מילים לכתובית)
- duration בתגובה חייב להיות 10

בהתבסס על בקשת המשתמש, צור תסריט מלא לסרטון AI קולנועי.
${avatarContext}${voiceContext}${imageContext}${brandInfo}

החזר JSON בפורמט הבא בלבד (ללא טקסט נוסף):
{
  "title": "שם הסרטון",
  "duration": 10,
  "script": "התסריט המלא כטקסט רציף — קצר וקולע, מתאים ל-10 שניות",
  "scenes": [
    {
      "id": 1,
      "title": "שם הסצנה",
      "speaker": "שם הדובר/אווטאר או 'קריין'",
      "spokenText": "מה נאמר — משפט או שניים קצרים",
      "visualDescription": "תיאור קולנועי מלא ומפורט של מה שרואים על המסך — זה מה שמנוע הווידאו ישתמש בו ליצירת הסרטון. תאר: מי מופיע, מה עושה, איפה, באיזה תאורה, מה הצבעים. היה ספציפי מאוד!",
      "cameraDirection": "תיאור זווית ותנועת מצלמה",
      "environment": "תיאור מפורט של הסביבה, התאורה והאווירה",
      "characters": "תיאור הדמויות, הביטויים, התנוחות והפעולות שלהן",
      "subtitleText": "כתובית קצרה (4-6 מילים) שתופיע על המסך",
      "icons": ["🎯", "💡"],
      "duration": 10,
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
- visualDescription הוא מה שמנוע ה-AI ישתמש בו כדי ליצור את הסרטון. ככל שהוא מפורט יותר — התוצאה תהיה טובה יותר
- תאר בדיוק מה רואים: "אישה צעירה עם תינוק, יושבת על שטיח רך בחדר ילדים צבעוני, סביבה צעצועים ומוצרי תינוקות, תאורה חמה ונעימה, מחייכת למצלמה"
- אל תשתמש במושגים מופשטים. תאר תמונה קונקרטית שאפשר לצלם
- שלב את המוצרים/שירותים של המותג באופן טבעי בסצנה

### טקסט וכתוביות:
- הוק (2 שניות ראשונות): שאלה מסקרנת או טענה מפתיעה
- גוף (5-6 שניות): הצגת הערך/מוצר/שירות בצורה ויזואלית
- CTA (2-3 שניות אחרונות): קריאה לפעולה ברורה עם שם המותג
- כתוביות קצרות של 4-6 מילים בלבד — הן מוצגות על הסרטון

### סגנון:
- בחר את הסגנון הקולנועי הכי מתאים למותג ולמסר
- אם זה מוצר ילדים — צבעים חמים, תאורה רכה, אווירה משפחתית
- אם זה עסקי — מקצועי, נקי, מודרני`;

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
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        const braceMatch = content.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[0]);
        } else {
          parsed = JSON.parse(content.trim());
        }
      }
      if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
        parsed.scenes = [];
      }
      // Force duration to 10 to match Runway's capability
      parsed.duration = 10;
      for (const scene of parsed.scenes) {
        scene.duration = 10;
      }
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Content preview:", content?.slice(0, 300));
      parsed = { script: content, scenes: [], title: "תסריט", duration: 10, style: {} };
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
