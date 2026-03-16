import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const blockedMediaHosts = /(youtube\.com|youtu\.be|facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com)/i;

const extractGatewayMessage = (raw: string) => {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || raw;
  } catch {
    return raw;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, action, imageUrl, referenceImages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const mediaUrls = [
      ...(action === "edit" && imageUrl ? [imageUrl] : []),
      ...(Array.isArray(referenceImages) ? referenceImages : []),
    ].filter(Boolean) as string[];

    if (mediaUrls.some((url) => blockedMediaHosts.test(url))) {
      return new Response(
        JSON.stringify({ error: "הקישור שהוזן הוא עמוד אתר (למשל YouTube) ולא קובץ תמונה ישיר. הדבק קישור ישיר ל‑JPG/PNG/WebP." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages: any[] = [];

    const hebrewTextGuidelines = `CRITICAL RULES FOR HEBREW TEXT IN IMAGES:
- Hebrew is written RIGHT-TO-LEFT (RTL). Never reverse the letter order.
- Each Hebrew letter must be rendered in its correct isolated/final/medial form.
- Use a clean, professional Hebrew-compatible font style (similar to Heebo, Rubik, or Noto Sans Hebrew).
- Hebrew text must be sharp, legible, and properly kerned — never blurry or distorted.
- If the prompt includes specific Hebrew words or phrases, reproduce them EXACTLY as written, character by character.
- Do NOT transliterate Hebrew into Latin characters.
- Ensure proper spacing between Hebrew words.
- For mixed Hebrew+English text, Hebrew flows RTL and English flows LTR within the same line.
- Text should have good contrast against its background for readability.`;

    if (action === "edit" && imageUrl) {
      messages.push({
        role: "system",
        content: hebrewTextGuidelines,
      });
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      });
    } else if (referenceImages && referenceImages.length > 0) {
      // Generate with reference images
      messages.push({
        role: "system",
        content: hebrewTextGuidelines,
      });
      const contentParts: any[] = [
        { type: "text", text: `צור תמונה חדשה באיכות גבוהה לפי התיאור הבא. השתמש בתמונות הרפרנס המצורפות כהשראה — שלב אלמנטים מהן (אנשים, מוצרים, לוגו, סגנון) בתמונה החדשה. שים לב שכל טקסט בעברית יהיה מדויק וקריא.\n\nתיאור: ${prompt}` },
      ];
      for (const refUrl of referenceImages) {
        contentParts.push({ type: "image_url", image_url: { url: refUrl } });
      }
      messages.push({ role: "user", content: contentParts });
    } else {
      messages.push({
        role: "system",
        content: hebrewTextGuidelines,
      });
      messages.push({
        role: "user",
        content: `צור תמונה באיכות גבוהה לפי התיאור הבא. שים לב במיוחד שכל טקסט בעברית יהיה מדויק, קריא וברור: ${prompt}`,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages,
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      const gatewayMessage = extractGatewayMessage(raw);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד רגע" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 400) {
        const invalidImageMsg =
          gatewayMessage.includes("did not return an image") ||
          gatewayMessage.includes("image") && gatewayMessage.includes("URL");

        return new Response(
          JSON.stringify({
            error: invalidImageMsg
              ? "הקישור אינו תמונה ישירה. הדבק קישור ישיר לקובץ תמונה (jpg/png/webp)."
              : "בקשה לא תקינה ליצירת תמונה. בדוק את הטקסט/הקישור ונסה שוב.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.error("AI gateway error:", response.status, raw);
      return new Response(JSON.stringify({ error: "שגיאה בשירות יצירת התמונות" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    const imageData = message?.images?.[0]?.image_url?.url;
    const text = message?.content || "";

    if (!imageData) {
      return new Response(JSON.stringify({ error: "לא הצלחתי ליצור תמונה, נסה תיאור אחר", text }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ imageUrl: imageData, text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
