// Deno.serve used natively

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { audioBase64, language } = await req.json();

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: "חסר קובץ אודיו" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Gemini to transcribe audio
    const modelsToTry = ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash"];
    let response: Response | null = null;

    for (const model of modelsToTry) {
      console.log(`Trying transcribe model: ${model}`);
      const attempt = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
          {
            role: "system",
              content: `אתה מתמלל מקצועי ברמה הגבוהה ביותר. תמלל את האודיו הבא בצורה מדויקת ביותר.

חוקים חשובים:
1. פצל לפי משפטים או ביטויים טבעיים — לפי נשימות, הפסקות, ושינויי נושא.
2. כל סגמנט חייב לייצג רגע דיבור אמיתי. start = הרגע שהדובר מתחיל לדבר, end = הרגע שהדובר מסיים.
3. אם יש שקט/הפסקה בין משפטים — אל תכלול אותו בסגמנט. תשאיר רווח בזמנים.
   למשל: אם דובר מסיים ב-3.2s ומתחיל שוב ב-5.1s, הסגמנט הראשון יסתיים ב-3.2 והבא יתחיל ב-5.1.
4. אל תיצור סגמנטים באורך קבוע. סגמנט יכול להיות 0.5 שניות או 8 שניות — לפי הדיבור בפועל.
5. אל תוסיף סגמנטים לרגעי שקט.
6. הטקסט ב${language || "עברית"} — כתוב עברית תקנית, עם פיסוק נכון (נקודות, פסיקים).

החזר JSON בלבד (ללא markdown):
{
  "segments": [
    {"start": 0.0, "end": 2.5, "text": "הטקסט כאן."},
    {"start": 4.1, "end": 7.3, "text": "המשך אחרי הפסקה."}
  ]
}`,
          },
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: "mp3",
                },
              },
              {
                type: "text",
                text: `תמלל את האודיו הזה ל${language || "עברית"}. החזר JSON עם segments שכוללים start, end, text לפי תזמון דיבור אמיתי ומדויק, לא חלוקה של 2-4 שניות.`,
              },
            ],
          },
        ],
      }),
    });

      if (attempt.ok) {
        response = attempt;
        break;
      }

      const errText = await attempt.text();
      console.warn(`Transcribe model ${model} failed: ${attempt.status} ${errText.slice(0, 200)}`);
      if (attempt.status !== 402 && attempt.status < 500) break;
    }

    if (!response) {
      // Fallback: generate mock subtitles
      return new Response(
        JSON.stringify({
          segments: [
            { start: 0, end: 3, text: "תמלול אוטומטי לא זמין כרגע" },
            { start: 3, end: 6, text: "נא להזין כתוביות ידנית" },
          ],
          note: "התמלול האוטומטי אינו זמין כרגע. ניתן לערוך ידנית."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("Transcription error:", response.status, errText);
      
      return new Response(
        JSON.stringify({
          segments: [
            { start: 0, end: 3, text: "תמלול אוטומטי לא זמין כרגע" },
            { start: 3, end: 6, text: "נא להזין כתוביות ידנית" },
          ],
          note: "התמלול האוטומטי אינו זמין כרגע. ניתן לערוך ידנית."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let segments;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        segments = parsed.segments || [];
      } else {
        segments = [{ start: 0, end: 5, text: content }];
      }
    } catch {
      segments = [{ start: 0, end: 5, text: content }];
    }

    return new Response(
      JSON.stringify({ segments }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("transcribe error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה בתמלול" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
