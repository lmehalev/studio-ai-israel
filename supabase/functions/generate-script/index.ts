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

## עיקרון מרכזי — התאמה מלאה לתחום הפעילות
אתה חייב לזהות את תחום הפעילות מתוך תיאור המשתמש ולהתאים את כל הבימוי, הסצנות, הרקעים, הדמויות והאווירה לתחום הזה.

**דוגמאות להתאמה לפי תחום:**
- **מוצרי ילדים/תינוקות**: הורים עם ילדים, חדרי ילדים צבעוניים, גני שעשועים, עגלות, צעצועים, תאורה חמה ורכה, חיוכים
- **עסקים/B2B**: משרדים מודרניים, אנשי עסקים בפגישות, גרפים על מסכים, לחיצות ידיים, בניינים מרשימים, תאורה מקצועית
- **מסעדנות/אוכל**: מטבח פעיל, שפים מבשלים, מנות צבעוניות, אדים עולים, טקסטורות של מזון, תאורה טבעית חמה
- **עמותות/חברתי**: אנשים מתנדבים, קהילה פעילה, חיבוקים, פעילות שטח, רגעים מרגשים
- **טכנולוגיה/סטארטאפ**: מסכים עם קוד, צוותים עובדים, משרד open-space, מוצר דיגיטלי בפעולה
- **אופנה/יופי**: דוגמניות, סטודיו צילום, תאורה דרמטית, בדים וטקסטורות, פוזות
- **נדל"ן**: דירות מעוצבות, נופים עירוניים, משפחות מאושרות בבית חדש, אדריכלות
- **בריאות/רפואה**: מרפאה נקייה, רופאים מקצועיים, מטופלים מחייכים, ציוד רפואי מודרני
- **חינוך**: כיתות לימוד, סטודנטים, ספרים, מורים, אווירת למידה
- **ספורט/כושר**: חדרי כושר, ספורטאים בפעולה, תחרויות, אנרגיה גבוהה

**אל תתקבע על תחום אחד! זהה את התחום מהתיאור של המשתמש והתאם הכל.**

## מבנה הסרטון
- צור תסריט של **3 עד 6 סצנות**, כל סצנה בת **10 שניות** בדיוק
- סך הכל הסרטון יהיה **30 עד 60 שניות**
- כל סצנה תיוצר כקליפ וידאו עצמאי ותחובר לסרטון אחד שלם
- התאם את מספר הסצנות לעומק התוכן — תוכן עשיר = יותר סצנות (עדיף 5-6)

## מבנה מומלץ:
1. **סצנת פתיחה (Hook)**: הוק מסקרן שתופס תשומת לב — שאלה, טענה מפתיעה, או סיטואציה מוכרת מהתחום
2. **סצנות תוכן (2-4 סצנות)**: הצגת המוצר/שירות/ערך — כל סצנה מתמקדת בנקודה אחת עם בימוי ייחודי
3. **סצנת סיום (CTA)**: קריאה לפעולה ברורה עם שם המותג

בהתבסס על בקשת המשתמש, צור תסריט מלא לסרטון AI קולנועי.
${avatarContext}${voiceContext}${imageContext}${brandInfo}

החזר JSON בפורמט הבא בלבד (ללא טקסט נוסף):
{
  "title": "שם הסרטון",
  "duration": <מספר כולל בשניות — כפולה של 10>,
  "script": "התסריט המלא כטקסט רציף — כל מה שהקריין אומר מתחילת הסרטון עד סופו. זה חייב להיות טקסט ארוך, שוטף ומקצועי בעברית, לא רק כותרת. כלול את כל המשפטים מכל הסצנות ברצף.",
  "scenes": [
    {
      "id": 1,
      "title": "שם הסצנה",
      "speaker": "שם הדובר/אווטאר או 'קריין'",
      "spokenText": "מה נאמר בסצנה הזו — 2-3 משפטים מלאים ומקצועיים שמתאימים ל-10 שניות של דיבור. חייב להיות טקסט אמיתי, לא תיאור כללי.",
      "visualDescription": "תיאור קולנועי עשיר ומפורט של מה שרואים על המסך. תאר את הסצנה כאילו אתה כותב הנחיות לצלם — כולל: מיקום (חדר/רחוב/חנות/משרד), דמויות (גיל, מראה, ביגוד, הבעה), פעולות (מה עושים), אובייקטים (מוצרים, ריהוט, עיצוב), צבעים דומיננטיים, תאורה (טבעית/סטודיו/חמה/קרה). מינימום 3 שורות!",
      "backgroundAction": "מה קורה ברקע הסצנה מאחורי הדמות הראשית — זה מה שנותן חיים לסצנה! תאר לפחות 2-3 אלמנטים דינמיים: אנשים שעוברים, ילדים שמשחקים, מכוניות נוסעות, עננים זזים, עובדים עובדים, לקוחות מסתכלים על מוצרים, ציפורים עפות — כל דבר שמתאים לתחום ולסיטואציה.",
      "cameraDirection": "תיאור מקצועי של זווית ותנועת מצלמה — קלוז-אפ על פנים, wide shot של החנות, tracking shot שעוקב אחרי הדמות, zoom in איטי, drone shot מלמעלה, שוט מעל הכתף",
      "environment": "תיאור מפורט של הסביבה הפיזית, התאורה והאווירה — למשל: 'חנות מוארת באור לבן-חם, מדפים מסודרים עם מוצרים צבעוניים, רצפת עץ בהיר, חלון גדול שדרכו נכנס אור טבעי'",
      "characters": "תיאור מפורט של כל הדמויות בסצנה — מראה, גיל משוער, ביגוד, הבעת פנים, תנוחת גוף, ומה הן עושות. למשל: 'אמא צעירה (30) עם שיער חום ארוך, לובשת חולצה לבנה וג׳ינס, מחייכת בחום בזמן שמרימה תינוק מעגלה כחולה'",
      "subtitleText": "כתובית בעברית (6-10 מילים) שתופיע על המסך — סיכום קצר וקולע של מה שנאמר בסצנה",
      "icons": ["🎯", "💡"],
      "duration": 10,
      "transition": "fade",
      "videoStyle": "cinematic / animation / documentary / commercial"
    }
  ],
  "style": {
    "tone": "דרמטי / קליל / מעורר השראה / מקצועי / חם ומשפחתי",
    "pace": "מהיר / בינוני / איטי",
    "music": "סגנון מוזיקה מומלץ שמתאים לתחום — למשל: מוזיקה משפחתית חמה, ביט עסקי מודרני, מוזיקה אלקטרונית אנרגטית",
    "cinematicStyle": "קולנועי / אנימציה / דוקומנטרי / פרסומת"
  }
}

## הנחיות קריטיות ליצירת תסריט קולנועי:

### חזון ויזואלי — זה החלק הכי חשוב!
- visualDescription הוא מה שמנוע ה-AI ישתמש בו כדי ליצור את הסרטון. ככל שהוא מפורט יותר — התוצאה תהיה טובה יותר
- **כל תיאור חזותי חייב להיות לפחות 3 שורות!** תאר תמונה מלאה שאפשר "לצלם"
- backgroundAction חייב להיות עשיר ודינמי — תן חיים לרקע עם תנועה, אנשים, אלמנטים סביבתיים
- characters חייב לתאר דמויות קונקרטיות עם מראה, ביגוד, הבעות ופעולות
- אל תשתמש במושגים מופשטים כמו "אווירה נעימה" — תאר בדיוק מה רואים
- שלב את המוצרים/שירותים של המותג באופן טבעי בתוך הסצנה

### בימוי דינמי — לא סרטון סטטי!
- כל סצנה חייבת להכיל תנועה ופעולה — דמויות שזזות, אינטראקציות, שינויי זווית
- צור מגוון סצנות: חלק בפנים, חלק בחוץ, חלק קרוב וחלק רחוק
- הוסף אלמנטים של "חיים אמיתיים" — רעש רקע, אנשים שעוברים, פעילות טבעית
- חשוב על הסרטון כ"חלון לעולם" של המותג — הצג את הסביבה האמיתית שבה הוא פועל

### טקסט וקריינות:
- spokenText חייב להיות טבעי ומקצועי — כאילו קריין אמיתי מדבר בעברית שוטפת
- כל סצנה: 2-3 משפטים מלאים שמתאימים ל-10 שניות דיבור
- script (השדה הראשי) חייב להכיל את כל הטקסט מכל הסצנות מחובר ברצף שוטף
- הקריינות חייבת להיות בעברית תקנית, שוטפת, מקצועית
- הטקסט חייב להיות רלוונטי ומדויק לתחום הפעילות — לא כללי!

### כתוביות:
- subtitleText — כתובית בעברית של 6-10 מילים שמסכמת את הנאמר
- הכתוביות יוצגו על הסרטון — חייבות להיות קריאות וברורות

### סגנון — התאם לתחום!
- זהה את תחום הפעילות ובחר את הסגנון הקולנועי המתאים
- התאם צבעים, תאורה, קצב ומוזיקה לתחום
- כל תחום דורש אווירה שונה — עסקי ≠ ילדים ≠ אוכל ≠ טכנולוגיה`;

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
