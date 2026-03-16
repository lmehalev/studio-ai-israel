import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_REFERENCE_IMAGES = 7;
const MIN_STRICT_REFERENCE_IMAGES = 3;
const STRICT_IDENTITY_MODEL = "google/gemini-3-pro-image-preview";
const FAST_IDENTITY_MODEL = "google/gemini-3.1-flash-image-preview";

type GenerateAvatarRequest = {
  imageUrls?: string[];
  style?: string;
  expression?: string;
  baseAvatarUrl?: string;
  strictIdentity?: boolean;
};

const dedupeUrls = (urls: string[]) =>
  Array.from(new Set(urls.filter((url) => typeof url === "string" && url.trim().length > 0)));

const getExpressionText = (expression?: string) => {
  const map: Record<string, string> = {
    neutral: "neutral resting face",
    smile: "warm genuine smile",
    big_smile: "big joyful smile",
    serious: "serious confident look",
    friendly: "soft friendly expression",
    thinking: "thoughtful contemplative look",
  };
  return map[expression || "neutral"] || expression || "neutral resting face";
};

const getStyleText = (s: string) => {
  const lower = s.toLowerCase();
  if (lower.includes("pixar") || lower.includes("3d")) return "Pixar 3D animated character style";
  if (lower.includes("disney")) return "classic Disney hand-drawn illustration style";
  if (lower.includes("anime") || lower.includes("manga")) return "anime/manga style";
  if (lower.includes("comic")) return "comic book / graphic novel style";
  if (lower.includes("watercolor")) return "watercolor painting style";
  if (lower.includes("pop art")) return "pop art style with bold colors";
  if (lower.includes("oil") || lower.includes("renaissance")) return "classical oil painting portrait style";
  if (lower.includes("caricature")) return "mild caricature style";
  if (lower.includes("minimalist") || lower.includes("line")) return "minimalist line art style";
  if (lower.includes("retro") || lower.includes("vintage")) return "retro vintage poster style";
  if (lower.includes("cyberpunk") || lower.includes("neon")) return "cyberpunk neon-lit style";
  if (lower.includes("chibi") || lower.includes("sticker")) return "chibi/sticker style";
  return "professional studio headshot, high-end photography, perfect lighting";
};

const extractGeneratedImage = (choice: any): { imageUrl: string | null; text: string } => {
  let generatedImageUrl: string | null = null;
  let textResponse = "";

  if (choice?.images && Array.isArray(choice.images) && choice.images.length > 0) {
    generatedImageUrl = choice.images[0]?.image_url?.url || null;
  }
  if (choice?.content) {
    if (typeof choice.content === "string") {
      textResponse = choice.content;
    } else if (Array.isArray(choice.content)) {
      for (const part of choice.content) {
        if (!generatedImageUrl && part.type === "image_url" && part.image_url?.url) {
          generatedImageUrl = part.image_url.url;
        } else if (part.type === "text") {
          textResponse = part.text || "";
        } else if (!generatedImageUrl && part.inline_data) {
          generatedImageUrl = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
        }
      }
    }
  }
  return { imageUrl: generatedImageUrl, text: textResponse };
};

const uploadDataUrlToStorage = async (dataUrl: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) return dataUrl;

  const matches = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!matches) return dataUrl;

  const mimeType = matches[1];
  const base64Data = matches[2];
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const path = `avatars/${Date.now()}-generated.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, bytes, { contentType: mimeType, cacheControl: "3600" });

  if (uploadError) {
    console.error("upload avatar error:", uploadError);
    return dataUrl;
  }

  const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(path);
  return publicUrlData.publicUrl;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = (await req.json()) as GenerateAvatarRequest;
    const styleDesc = (body.style || "professional headshot").trim();
    const expression = body.expression || "neutral";
    const strictIdentity = body.strictIdentity !== false;

    const referenceUrls = dedupeUrls([
      ...(body.baseAvatarUrl ? [body.baseAvatarUrl] : []),
      ...(Array.isArray(body.imageUrls) ? body.imageUrls : []),
    ]).slice(0, MAX_REFERENCE_IMAGES);

    if (referenceUrls.length === 0) {
      return new Response(JSON.stringify({ error: "יש להעלות לפחות תמונה אחת" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (strictIdentity && referenceUrls.length < MIN_STRICT_REFERENCE_IMAGES) {
      return new Response(JSON.stringify({ error: "לדיוק פנים גבוה יש להעלות לפחות 3 תמונות מזוויות שונות" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasBaseAvatar = Boolean(body.baseAvatarUrl);
    const styleText = getStyleText(styleDesc);
    const expressionText = getExpressionText(expression);

    const imageContentParts = referenceUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    }));

    console.log("Pass 1: Analyzing face from", referenceUrls.length, "photos...");

    let faceDescription = "";
    try {
      const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          temperature: 0.0,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are a forensic facial analyst. Study these ${referenceUrls.length} photos of the SAME person from different angles and lighting.

Return a compact, ultra-precise identity profile with recurring facial signals only (ignore temporary lighting/expression noise):
- Face geometry and proportions
- Eyes (shape, spacing, depth)
- Nose structure
- Mouth/lips structure
- Jaw/chin/cheek structure
- Skin tone + stable marks
- Hairline and facial hair map
- Distinctive immutable traits

Keep it under 2200 characters. Prioritize identity-lock details.`
                },
                ...imageContentParts,
              ],
            },
          ],
        }),
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        faceDescription = analysisData.choices?.[0]?.message?.content || "";
        console.log("Face analysis complete:", faceDescription.length, "chars");
      } else {
        console.error("Face analysis failed:", analysisResponse.status);
      }
    } catch (e) {
      console.error("Face analysis error:", e);
    }

    console.log("Pass 2: Generating portrait...");

    const isRealisticStyle =
      styleText.includes("professional") ||
      styleText.includes("headshot") ||
      styleText.includes("photography");

    const selectedModel = strictIdentity ? STRICT_IDENTITY_MODEL : FAST_IDENTITY_MODEL;

    const prompt = `${faceDescription ? `IDENTITY LOCK PROFILE (MUST PRESERVE):\n${faceDescription}\n\n` : ""}All reference images are the SAME person. Build a consensus identity from all photos and preserve recurring facial structure.

${hasBaseAvatar ? "The FIRST image is the anchor identity. Match it exactly." : ""}

Create a NEW portrait with:
- Style: ${styleText}
- Expression: ${expressionText}
${isRealisticStyle ? `- Studio lighting, sharp focus, realistic skin texture, clean neutral/gradient background` : `- Apply only style transfer while keeping the exact same person underneath`}

IDENTITY RULES (HIGHEST PRIORITY):
1) Keep exact facial geometry and proportions
2) Keep exact skin tone and undertone
3) Keep exact facial-hair pattern and hairline
4) Keep unique marks and distinguishing traits
5) Do NOT beautify, smooth, slim, widen, de-age, or swap identity

Output one final image only.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        modalities: ["image", "text"],
        temperature: 0.0,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, ...imageContentParts],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד דקה" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "נדרש חידוש קרדיטים" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`שגיאה ביצירת אווטאר: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;
    const extracted = extractGeneratedImage(choice);

    let generatedImageUrl = extracted.imageUrl;
    if (generatedImageUrl && generatedImageUrl.startsWith("data:")) {
      generatedImageUrl = await uploadDataUrlToStorage(generatedImageUrl);
    }

    return new Response(
      JSON.stringify({
        imageUrl: generatedImageUrl,
        text: extracted.text || (strictIdentity ? "האווטאר נוצר במצב דיוק זהות מוגבר" : "האווטאר נוצר בהצלחה"),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-avatar error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה ביצירת אווטאר" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
