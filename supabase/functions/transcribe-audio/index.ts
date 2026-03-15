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

    const { audioBase64, language } = await req.json();

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: "חסר קובץ אודיו" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Gemini to transcribe audio
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
              content: `אתה מתמלל מקצועי. תמלל את האודיו הבא בצורה מדויקת.
חובה להחזיר JSON בפורמט הבא:
{
  "segments": [
    {"start": 0.0, "end": 2.5, "text": "הטקסט כאן"},
    {"start": 2.5, "end": 5.0, "text": "המשך הטקסט"}
  ]
}
כל סגמנט חייב להיות מתוזמן לפי זמן הדיבור האמיתי באודיו (לא לפי הערכה כללית).
אל תכפה אורכי סגמנטים קבועים. פצל לפי משפטים/נשימות טבעיות.
start = רגע תחילת הדיבור של המשפט, end = רגע סיום הדיבור של המשפט.
הזמנים חייבים להיות בשניות ובסדר עולה. הטקסט ב${language || "עברית"}.
החזר רק JSON תקין, ללא markdown.`,
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

    if (!response.ok) {
      const errText = await response.text();
      console.error("Transcription error:", response.status, errText);
      
      // Fallback: generate mock subtitles based on estimated duration
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
