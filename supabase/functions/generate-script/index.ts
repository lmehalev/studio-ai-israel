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

## מבנה הסרטון
- צור תסריט של **3 עד 6 סצנות**, כל סצנה בת **10 שניות** בדיוק
- סך הכל הסרטון יהיה **30 עד 60 שניות**
- כל סצנה תיוצר כקליפ וידאו עצמאי ותחובר לסרטון אחד שלם
- התאם את מספר הסצנות לעומק התוכן — תוכן עשיר = יותר סצנות

## מבנה מומלץ:
1. **סצנת פתיחה (Hook)**: הוק מסקרן שתופס תשומת לב — שאלה, טענה מפתיעה, או סיטואציה מוכרת
2. **סצנות תוכן (2-4 סצנות)**: הצגת המוצר/שירות/ערך — כל סצנה מתמקדת בנקודה אחת
3. **סצנת סיום (CTA)**: קריאה לפעולה ברורה עם שם המותג

בהתבסס על בקשת המשתמש, צור תסריט מלא לסרטון AI קולנועי.
${avatarContext}${voiceContext}${imageContext}${brandInfo}

החזר JSON בפורמט הבא בלבד (ללא טקסט נוסף):
{
  "title": "שם הסרטון",
  "duration": <מספר כולל בשניות — כפולה של 10>,
  "script": "התסריט המלא כטקסט רציף — כל מה שהקריין אומר מתחילת הסרטון עד סופו",
  "scenes": [
    {
      "id": 1,
      "title": "שם הסצנה",
      "speaker": "שם הדובר/אווטאר או 'קריין'",
      "spokenText": "מה נאמר בסצנה הזו — 2-3 משפטים שמתאימים ל-10 שניות של דיבור",
      "visualDescription": "תיאור קולנועי מלא ומפורט של מה שרואים על המסך — כולל רקע, דמויות, פעולות, מוצרים, צבעים, תאורה. זה מה שמנוע הווידאו AI ישתמש בו. תאר גם מה קורה ברקע!",
      "backgroundAction": "מה קורה ברקע הסצנה — אנשים שהולכים, ילדים שמשחקים, רחוב עירוני, פעילות סביבתית. תן חיים לסצנה!",
      "cameraDirection": "תיאור זווית ותנועת מצלמה — קלוז-אפ, wide shot, tracking shot, zoom in",
      "environment": "תיאור מפורט של הסביבה, התאורה והאווירה — חדר ילדים צבעוני, חנות מוארת, פארק ירוק",
      "characters": "תיאור הדמויות, הביטויים, התנוחות והפעולות שלהן — אמא מחייכת דוחפת עגלה, ילד רוכב על אופניים",
      "subtitleText": "כתובית בעברית (6-10 מילים) שתופיע על המסך — סיכום קצר של מה שנאמר",
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
- backgroundAction חייב לתאר מה קורה מאחורי הדמות הראשית — אנשים שעוברים, ילדים שמשחקים, מוצרים על מדף, תנועה ברחוב
- אל תשתמש במושגים מופשטים. תאר תמונה קונקרטית שאפשר לצלם
- שלב את המוצרים/שירותים של המותג באופן טבעי בסצנה

### טקסט וקריינות:
- spokenText חייב להיות טבעי ומקצועי — כאילו קריין אמיתי מדבר
- כל סצנה: 2-3 משפטים קצרים וברורים שמתאימים ל-10 שניות דיבור
- script (השדה הראשי) הוא כל הטקסט מחובר — זה מה שהקריין יקריא
- הקריינות חייבת להיות בעברית תקנית, שוטפת, מקצועית

### כתוביות:
- subtitleText — כתובית בעברית של 6-10 מילים שמסכמת את הנאמר
- הכתוביות יוצגו על הסרטון — חייבות להיות קריאות וברורות

### סגנון:
- בחר את הסגנון הקולנועי הכי מתאים למותג ולמסר
- אם זה מוצר ילדים — צבעים חמים, תאורה רכה, אווירה משפחתית
- אם זה עסקי — מקצועי, נקי, מודרני
- אם זה אוכל — צבעים חיים, תאורה טבעית, טקסטורות`;

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
      // Enforce each scene = 10s, total = scenes * 10
      for (const scene of parsed.scenes) {
        scene.duration = 10;
      }
      parsed.duration = parsed.scenes.length * 10;
      
      // Clamp to 3-6 scenes (30-60 seconds)
      if (parsed.scenes.length < 3) {
        // If AI generated fewer than 3, keep what we have but don't force
        parsed.duration = parsed.scenes.length * 10;
      }
      if (parsed.scenes.length > 6) {
        parsed.scenes = parsed.scenes.slice(0, 6);
        parsed.duration = 60;
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
