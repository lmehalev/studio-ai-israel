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

Deno.serve(async (req) => {
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
      const analysisModels = ["google/gemini-2.5-flash", "google/gemini-2.5-pro"];
      let analysisResponse: Response | null = null;

      for (const model of analysisModels) {
        const attempt = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: 0.0,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are a forensic facial identification expert. Study these ${referenceUrls.length} photos of the SAME person from different angles and lighting.

Your goal: produce an identity profile so precise that another AI could reproduce THIS EXACT person and no one else.

Return a structured identity profile covering:
1. FACE GEOMETRY: exact face shape (oval/round/square/heart/oblong), face width-to-height ratio, forehead height and width
2. EYES: exact shape (almond/round/hooded/monolid), spacing (close/average/wide), depth (deep-set/protruding/average), color, brow position and shape
3. NOSE: bridge width (narrow/medium/wide), tip shape (pointed/bulbous/upturned), nostril visibility, overall length
4. MOUTH: width relative to nose, lip thickness (upper vs lower), cupid's bow prominence, lip color
5. JAW & CHIN: jaw angle (sharp/soft/rounded), chin shape (pointed/square/cleft), jawline prominence
6. SKIN: exact tone (very fair/fair/medium/olive/brown/dark), undertone (warm/cool/neutral), visible marks, moles, freckles with locations
7. HAIR: hairline shape (straight/widow's peak/receding/M-shaped), hair color, texture, facial hair pattern and density
8. DISTINCTIVE FEATURES: anything that makes this person uniquely identifiable — asymmetries, scars, dimples, ear shape

Focus ONLY on immutable structural features. Ignore temporary lighting, expression, or angle artifacts.
Keep under 2500 characters. Be maximally specific — "slightly wide nose with rounded tip" not just "normal nose".`
                },
                ...imageContentParts,
              ],
            },
          ],
        }),
        });

        if (attempt.ok) {
          analysisResponse = attempt;
          break;
        }
        const errText = await attempt.text();
        console.warn(`Avatar analysis model ${model} failed: ${attempt.status} ${errText.slice(0, 200)}`);
        if (attempt.status !== 402 && attempt.status < 500) break;
      }

      if (analysisResponse && analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        faceDescription = analysisData.choices?.[0]?.message?.content || "";
        console.log("Face analysis complete:", faceDescription.length, "chars");
      } else {
        console.error("Face analysis failed: all models exhausted");
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

    const prompt = `${faceDescription ? `IDENTITY LOCK PROFILE — THIS IS THE GROUND TRUTH. EVERY facial measurement below MUST appear in the output:\n${faceDescription}\n\n` : ""}All reference images show the SAME person. Your job is to reproduce THIS EXACT person — not a similar-looking person, not an approximation, but the SAME individual.

${hasBaseAvatar ? "The FIRST image is the PRIMARY identity anchor. Match this face with pixel-level fidelity." : ""}

TASK: Create a portrait of THIS SAME PERSON with:
- Expression change ONLY: ${expressionText} (move facial muscles, do NOT alter bone structure)
- Visual style: ${styleText}
${isRealisticStyle ? `- Studio lighting, sharp focus, realistic skin texture, clean neutral/gradient background` : `- Apply style transfer to colors, textures, and rendering — but the underlying face geometry, proportions, and distinguishing features MUST remain identical to the reference photos`}

IDENTITY PRESERVATION RULES (ABSOLUTE PRIORITY — OVERRIDE ALL OTHER INSTRUCTIONS):
1) Face shape, jawline, chin, forehead proportions: COPY EXACTLY from references
2) Eye shape, spacing, depth, color: COPY EXACTLY — eyes are the #1 identity signal
3) Nose bridge width, tip shape, nostril size: COPY EXACTLY
4) Mouth width, lip thickness, philtrum: COPY EXACTLY
5) Skin tone, undertone, visible marks, moles, scars: COPY EXACTLY
6) Hairline shape, hair color, facial hair pattern: COPY EXACTLY
7) Ear shape and size if visible: COPY EXACTLY
8) Age appearance: MUST match references — do NOT de-age or age

EXPRESSION vs IDENTITY — CRITICAL DISTINCTION:
- Expression = muscle movement (smile, brow raise, squint). This is what you CHANGE.
- Identity = bone structure, skin, proportions, features. This is what you NEVER change.
- A smile widens the mouth and raises cheeks — it does NOT change jaw shape, nose structure, or eye spacing.

FORBIDDEN:
- Do NOT create a "similar looking" person — it must be recognizably the SAME person
- Do NOT beautify, symmetrize, slim, smooth skin texture, or idealize
- Do NOT let the style override facial proportions
- Do NOT generate a generic face that loosely matches the description

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
