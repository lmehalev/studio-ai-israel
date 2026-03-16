import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const escapeControlCharsInJsonStrings = (input: string): string => {
  let output = "";
  let inString = false;
  let escaped = false;

  for (const ch of input) {
    if (escaped) {
      output += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      output += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      output += ch;
      continue;
    }

    if (inString) {
      if (ch === "\n") {
        output += "\\n";
        continue;
      }
      if (ch === "\r") {
        output += "\\r";
        continue;
      }
      if (ch === "\t") {
        output += "\\t";
        continue;
      }

      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        output += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }
    }

    output += ch;
  }

  return output;
};

const parseModelJsonContent = (content: string) => {
  const candidates: string[] = [];

  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) candidates.push(fencedMatch[1].trim());

  const braceMatch = content.match(/\{[\s\S]*\}/);
  if (braceMatch?.[0]) candidates.push(braceMatch[0].trim());

  candidates.push(content.trim());

  let lastErr: unknown = null;

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      return JSON.parse(candidate);
    } catch (firstErr) {
      lastErr = firstErr;
    }

    try {
      return JSON.parse(escapeControlCharsInJsonStrings(candidate));
    } catch (secondErr) {
      lastErr = secondErr;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("Failed to parse AI JSON");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { prompt, avatarNames, voiceNames, brandContext, hasImages, videoStyle, websiteUrl, websiteContext, hasScreenshot } = await req.json();

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

    const websiteInfo = websiteContext
      ? `\n## מידע מהאתר של הלקוח (${websiteUrl || 'לא צוין URL'})
המערכת סרקה את האתר ומצאה את המידע הבא. **חובה** לשלב את התוכן, הצבעים, והמסרים מהאתר בתסריט:
${websiteContext}
${hasScreenshot ? '\nיש צילום מסך של האתר — שלב סצנה שמציגה את האתר (מסך מחשב/טלפון שמציג את הדף, גלילה באתר, אינטראקציה עם הממשק).' : ''}`
      : "";

    const styleMap: Record<string, string> = {
      cinematic: `סגנון קולנועי ריאליסטי — אנשים אמיתיים, לוקיישנים אמיתיים, תאורה דרמטית כמו בסרט הוליוודי. צלם כאילו יש צוות הפקה מלא עם מצלמות RED. הדמויות נראות כמו שחקנים אמיתיים, הסביבה ריאלית לחלוטין.`,
      disney: `סגנון אנימציה תלת-ממדית כמו דיסני/פיקסאר — דמויות מונפשות עם עיניים גדולות ומבטיות, צבעים עשירים ורוויים, תאורה חמה וקסומה, סביבות מפורטות עם טקסטורות עדינות. הכל נראה כמו סצנה מסרט פיקסאר. הדמויות חמודות, אקספרסיביות, עם הבעות פנים מוגזמות ומקסימות.`,
      anime: `סגנון אנימה יפני — קווי מתאר ברורים, עיניים גדולות ונוצצות, שיער דינמי, אפקטי תאורה דרמטיים עם ניצוצות ואור. רקעים מצוירים בפירוט רב עם שמיים צבעוניים. תנועות דינמיות ודרמטיות. סגנון שמזכיר Studio Ghibli או Makoto Shinkai.`,
      cartoon: `סגנון קריקטורה / איור — דמויות מצוירות ביד עם קווים עבים, צבעים בוהקים ושטוחים, הגזמה בתנועות ובהבעות. סביבות מעוצבות כמו איור בספר ילדים או קומיקס. הומור ויזואלי, אלמנטים מעופפים, אפקטים קומיים.`,
      documentary: `סגנון דוקומנטרי מקצועי — צילום טבעי, תאורה אמביינטית, מצלמה ביד עם רעידות קלות שנותנות תחושת אותנטיות. ראיונות עם רקע מטושטש (bokeh), טקסט על המסך עם שם ותפקיד. הכל מרגיש אמיתי ואותנטי, לא מבוים.`,
      commercial: `סגנון פרסומת טלוויזיה — הפקה מבריקה, תאורת סטודיו מושלמת, צבעים חיים ומדויקים, תנועות מצלמה חלקות ומרהיבות. מוצרים מצולמים בזוויות מושלמות עם השתקפויות ובוהק. הכל נקי, חד, ומלוטש ברמה הגבוהה ביותר.`,
    };

    const chosenStyle = styleMap[videoStyle || 'cinematic'] || styleMap.cinematic;

    const systemPrompt = `אתה במאי קולנוע ותסריטאי וידאו ברמה עולמית. אתה יוצר תסריטים קולנועיים מרהיבים — כמו סרט קצר מקצועי או פרסומת ברמת הוליווד.

## סגנון ויזואלי שנבחר
${chosenStyle}
**חובה**: כל תיאור ויזואלי, דמויות, סביבות ורקעים חייבים להיות בסגנון הזה בלבד. אל תערבב סגנונות.

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
      "visualDescription": "**בימוי מלא ומפורט של הסצנה — מינימום 8-10 שורות!**
תאר כאילו אתה כותב תסריט בימוי לצוות הפקה שלם:

1. **פריים פתיחה**: מה רואים ברגע הראשון? באיזו זווית נפתחת הסצנה? מה בפוקוס?
2. **הדמות המרכזית**: מי נמצא במרכז הפריים? מה הדמות עושה? באיזו תנוחה? מה הבעת הפנים שלה? לאן היא מסתכלת?
3. **פעולה ראשית**: מה קורה — הדמות מרימה מוצר? מצביעה על מסך? הולכת לעבר המצלמה? מחייכת ומדברת?
4. **רקע קדמי (Foreground)**: אלמנטים שעוברים לפני המצלמה — יד שמניחה כוס, עלה שנופל, אדם שחולף
5. **רקע אמצעי (Midground)**: מה קורה מסביב לדמות — אנשים אחרים, רהיטים, מוצרים על מדף, ציוד
6. **רקע אחורי (Background)**: מה רואים ברקע הרחוק — חלון עם נוף, קיר עם פוסטרים, עצים, שמיים, בניינים
7. **תאורה ואווירה**: סוג התאורה (טבעית/מלאכותית, חמה/קרה, רכה/דרמטית), צללים, השתקפויות, זוהר
8. **צבעים דומיננטיים**: פלטת הצבעים המרכזית של הסצנה — למשל: גוונים חמים של כתום וזהב, או כחולים קרירים ומקצועיים
9. **טקסטורות וחומרים**: עץ, מתכת, זכוכית, בד, עור — מה מרגישים כשמסתכלים?
10. **תנועה ודינמיות**: מה זז בסצנה? אדים עולים, וילון מתנפנף, אנשים הולכים, מסך מחליף תמונות",
      "backgroundAction": "**תיאור מלא של כל מה שקורה ברקע — מינימום 5 אלמנטים דינמיים!**
הרקע הוא מה שהופך סרטון חובבני לסרט מקצועי. תאר בדיוק:
1. **אנשים ברקע**: מי הם? מה הם עושים? לאן הם הולכים? — למשל: 'זוג צעיר עובר מימין לשמאל ומסתכל על חלון ראווה', 'ילד רץ עם בלון אדום', 'עובד מסדר מוצרים על מדף'
2. **תנועה סביבתית**: מכוניות חולפות, ציפורים עפות, עננים זזים, עלים נושרים, אורות מהבהבים
3. **אינטראקציות ברקע**: לקוח מדבר עם מוכר, ילדים משחקים, אנשים צוחקים, מישהו מצלם בטלפון
4. **אלמנטים חיים**: צמחים מתנדנדים, מים זורמים, אדים עולים מכוס קפה, שלט ניאון דולק ונכבה
5. **צלילים ויזואליים**: כלומר דברים שגורמים לך ל'שמוע' כשאתה רואה — דלת נפתחת, פעמון מצלצל, ידיים מוחאות",
      "cameraDirection": "תנועת מצלמה מקצועית ומפורטת — למשל:
- 'פתיחה ב-Wide Shot ממרחק 10 מטרים, Dolly In איטי לעבר הדמות תוך 3 שניות'
- 'Close-Up על ידיים מחזיקות מוצר, Rack Focus לפנים מחייכות'
- 'Drone Shot מלמעלה שמתקרב בספירלה לחנות'
- 'שוט מעל הכתף של הלקוח, רואים את המוכר מול'
- 'Tracking Shot עוקב אחרי הדמות ההולכת במסדרון'
- 'Slow Motion על רגע ה-Reveal של המוצר'",
      "environment": "תיאור מפורט ועשיר של הסביבה הפיזית — כולל:
- **מבנה החלל**: גודל, צורה, תקרה גבוהה/נמוכה, חלונות, דלתות, מדרגות
- **ריהוט ואביזרים**: שולחנות, כיסאות, מדפים, עציצים, תמונות על הקיר
- **תאורה מדויקת**: 'אור שמש חם נכנס מחלון צד ימין, יוצר פסים של אור על הרצפה. תאורה תקרתית רכה משלימה'
- **אווירה**: טמפרטורה, ניקיון, סדר/אי-סדר, עונה (חורף/קיץ), שעה ביום
- **פרטים ייחודיים**: לוגו על הקיר, צמח בפינה, ספלי קפה על שולחן, מחשב נייד פתוח",
      "characters": "**תיאור מלא ומפורט של כל דמות בסצנה — כאילו אתה כותב casting:**
- **דמות מרכזית**: גיל (למשל: 'אישה בת 32'), מוצא/מראה ('עור שזוף, שיער חום גלי עד הכתפיים'), ביגוד ('חולצת פשתן לבנה, מכנסי ג׳ינס כהים, נעלי סניקרס לבנות'), הבעת פנים ('חיוך חם ופתוח, עיניים נוצצות'), תנוחת גוף ('עומדת בביטחון, יד אחת על הירך'), מה עושה ('מציגה מוצר למצלמה בגאווה')
- **דמויות משניות**: תאר 2-3 דמויות נוספות באותה רמת פירוט
- **אינטראקציות בין דמויות**: מי מדבר עם מי, מבטים, חיוכים, מגע",
      "subtitleText": "כתובית בעברית (6-10 מילים) שתופיע על המסך — סיכום קצר וקולע של מה שנאמר בסצנה",
      "icons": ["🎯", "💡"],
      "duration": 10,
      "transition": "fade",
      "videoStyle": "${videoStyle || 'cinematic'}"
    }
  ],
  "style": {
    "tone": "דרמטי / קליל / מעורר השראה / מקצועי / חם ומשפחתי",
    "pace": "מהיר / בינוני / איטי",
    "music": "סגנון מוזיקה מומלץ שמתאים לתחום — למשל: מוזיקה משפחתית חמה, ביט עסקי מודרני, מוזיקה אלקטרונית אנרגטית",
    "cinematicStyle": "${videoStyle || 'cinematic'}"
  }
}

## הנחיות קריטיות ליצירת תסריט ברמת בימוי מלא:

### חזון ויזואלי — זה החלק הכי חשוב! צריך לתאר כמו במאי לצוות הפקה!
- **visualDescription חייב להיות מינימום 8-10 שורות מפורטות!** לא 3 שורות — 10 שורות של בימוי מלא!
- תאר כל שכבה בנפרד: Foreground, Midground, Background
- תאר תאורה ספציפית: מאיפה האור בא, איזה צבע, איזו עוצמה, צללים
- תאר צבעים ספציפיים: לא "צבעוני" אלא "גוונים של אפרסק וזהב עם ניגוד של כחול כהה"
- תאר טקסטורות: עץ חם, מתכת מצוחצחת, זכוכית שקופה, בד רך
- **backgroundAction חייב לכלול מינימום 5 אלמנטים דינמיים שונים!** לא 2-3, אלא 5!
- **characters חייב לתאר כל דמות כמו casting call** — גיל, מראה, ביגוד, הבעה, תנוחה, פעולה

### הסרטון חייב להרגיש חי ודינמי — לא סטטי!
- כל פריים חייב להכיל תנועה — דמויות זזות, אובייקטים זזים, מצלמה זזה
- שלב Slow Motion ברגעי שיא
- שלב Close-Up על פרטים קטנים ומעניינים (ידיים, מוצר, חיוך, עיניים)
- צור מגוון: פנים/חוץ, קרוב/רחוק, שקט/אנרגטי
- הוסף "רגעי WOW" — reveal דרמטי, זווית מפתיעה, מעבר יצירתי

### ויראליות — הסרטון חייב לגרום לאנשים לשתף!
- Hook תופס ב-3 שניות הראשונות — שאלה פרובוקטיבית, תמונה מפתיעה, סיטואציה מוכרת
- כל סצנה חייבת לתת ערך או רגש
- הסיום חייב להשאיר רושם — twist, חיוך, מסר חזק
- המוזיקה חייבת להתאים לקצב ולתחום

### טקסט וקריינות:
- spokenText חייב להיות טבעי ומקצועי — כאילו קריין אמיתי מדבר בעברית שוטפת
- כל סצנה: 2-3 משפטים מלאים שמתאימים ל-10 שניות דיבור
- script (השדה הראשי) חייב להכיל את כל הטקסט מכל הסצנות מחובר ברצף שוטף
- הקריינות חייבת להיות בעברית תקנית, שוטפת, מקצועית
- הטקסט חייב להיות רלוונטי ומדויק לתחום הפעילות — לא כללי!

### כתוביות:
- subtitleText — כתובית בעברית של 6-10 מילים שמסכמת את הנאמר
- הכתוביות יוצגו על הסרטון — חייבות להיות קריאות וברורות`;

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
      parsed = parseModelJsonContent(content || "");

      if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
        parsed.scenes = [];
      }

      // Fallback: if JSON parsed but scenes are missing, create baseline scenes from script
      if (parsed.scenes.length === 0 && typeof parsed.script === "string" && parsed.script.trim()) {
        const sentences = parsed.script
          .split(/\n+|(?<=[.!?！？。])\s+/)
          .map((s: string) => s.trim())
          .filter(Boolean);

        const grouped: string[] = [];
        for (let i = 0; i < sentences.length; i += 2) {
          grouped.push(sentences.slice(i, i + 2).join(" "));
          if (grouped.length >= 6) break;
        }

        const fallbackScenes = grouped.length > 0 ? grouped : [parsed.script.trim()];
        parsed.scenes = fallbackScenes.slice(0, 6).map((text: string, idx: number) => ({
          id: idx + 1,
          title: `סצנה ${idx + 1}`,
          speaker: "קריין",
          spokenText: text,
          visualDescription: "סצנה קולנועית מפורטת המתאימה לתחום הפעילות, עם עומק שדה, תאורה מקצועית ורקע חי ודינמי.",
          backgroundAction: "ברקע נראים אנשים בתנועה טבעית, פעילות סביבתית ותאורה משתנה שמעניקים תחושת חיים לסצנה.",
          cameraDirection: "Wide shot בפתיחה עם Dolly-in איטי אל הדמות המרכזית",
          environment: "סביבה מקצועית מותאמת לתחום העסקי שהוגדר בפרומפט",
          characters: "דמויות רלוונטיות לתוכן, בלבוש מתאים ובשפת גוף טבעית",
          subtitleText: text.slice(0, 64),
          icons: ["🎬", "✨"],
          duration: 10,
          transition: "fade",
          videoStyle: videoStyle || "cinematic",
        }));
      }

      // Enforce each scene = 10s, total = scenes * 10
      for (const scene of parsed.scenes) {
        scene.duration = 10;
      }
      parsed.duration = parsed.scenes.length * 10;

      // Clamp to 3-6 scenes (30-60 seconds)
      if (parsed.scenes.length < 3) {
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
