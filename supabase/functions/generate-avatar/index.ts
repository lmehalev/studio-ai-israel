import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_REFERENCE_IMAGES = 7;

type GenerateAvatarRequest = {
  imageUrls?: string[];
  style?: string;
  expression?: string;
  baseAvatarUrl?: string;
  strictIdentity?: boolean;
};

const dedupeUrls = (urls: string[]) =>
  Array.from(new Set(urls.filter((url) => typeof url === "string" && url.trim().length > 0)));

const getExpressionInstruction = (expression?: string) => {
  if (!expression || expression === "neutral") {
    return "neutral, natural resting face exactly as shown in references";
  }
  const map: Record<string, string> = {
    smile: "genuine warm smile with slight teeth showing, eyes slightly squinted naturally",
    big_smile: "big joyful smile, wide and open, happy eyes",
    serious: "serious and confident, slight intensity in eyes, closed mouth",
    friendly: "soft friendly smile, approachable and warm",
    thinking: "thoughtful look, slight head tilt, contemplative eyes",
  };
  return map[expression] || expression;
};

const getStyleInstructions = (styleDesc: string) => {
  const s = styleDesc.toLowerCase();

  if (s.includes("pixar") || s.includes("3d animated")) return `Pixar/3D animation rendering. Keep facial geometry UNCHANGED: same jawline, nose bridge, eye spacing, ear shape. Keep beard line, hairline, and head proportions identical. Do NOT make features "cuter" or exaggerated — preserve adult proportions.`;
  if (s.includes("disney")) return `Classic Disney hand-drawn illustration style. Identity lock mandatory: exact facial structure and proportions preserved. Preserve hairline, eyebrow shape, nose profile, lips, and beard boundaries exactly. Avoid beautification, age changes, or proportion shifts.`;
  if (s.includes("anime") || s.includes("manga")) return `Anime/manga rendering style. Keep exact skull shape, jaw width, nose proportions, and eye spacing. Preserve beard shape, hairline, and all distinguishing marks exactly. Keep identity recognizable at first glance — no generic anime face.`;
  if (s.includes("comic") || s.includes("graphic novel")) return `Western comic book / graphic novel style. Keep face geometry and all proportions unchanged. Preserve distinguishing features: beard shape, brow thickness, nose silhouette. Do NOT add heroic exaggeration to face proportions.`;
  if (s.includes("watercolor")) return `Watercolor texture and brushwork. Keep exact facial landmarks and proportions under the painting style. Preserve realistic facial structure — only the medium changes.`;
  if (s.includes("pop art")) return `Bold pop-art color treatment and graphic styling. Keep the same face geometry and expression structure. Preserve facial hair, hairline, and identity markers exactly.`;
  if (s.includes("oil painting") || s.includes("renaissance")) return `Classical oil painting / Renaissance portrait style. Keep exact facial proportions and identity. Rich color depth and traditional brushwork texture.`;
  if (s.includes("caricature")) return `Caricature style with mild exaggeration. Keep the person CLEARLY recognizable — exaggerate proportions slightly, not drastically. Preserve key identity markers: nose shape, beard, hairline.`;
  if (s.includes("minimalist") || s.includes("line art")) return `Clean minimalist line art / vector illustration style. Capture the person's unique features with minimal lines. Keep proportions accurate to source — identity must be obvious.`;
  if (s.includes("retro") || s.includes("vintage")) return `Retro/vintage poster style with muted tones. Keep facial identity exact — only color palette and texture change. Warm film-grain aesthetic.`;
  if (s.includes("cyberpunk") || s.includes("neon")) return `Cyberpunk/neon aesthetic: dramatic neon lighting, sci-fi elements. Keep facial identity EXACT — only lighting and background change. Preserve all facial features precisely.`;
  if (s.includes("sticker") || s.includes("chibi")) return `Cute chibi/sticker style with large head proportions. Despite stylization, preserve KEY facial markers: beard shape, nose, eyes, hairline. Keep the person recognizable even in chibi form.`;

  return `Clean, well-lit professional portrait. Face centered and clearly visible, neutral/gradient background. Preserve photorealistic identity with no beautification or AI smoothing.`;
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

    const hasBaseAvatar = Boolean(body.baseAvatarUrl);

    const imageContentParts = referenceUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    }));

    // =====================================================
    // PASS 1: Deep face analysis — extract precise identity
    // =====================================================
    console.log("Pass 1: Analyzing face from", referenceUrls.length, "reference images...");

    const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.05,
        messages: [
          {
            role: "system",
            content: `You are a forensic facial analysis expert. Your job is to produce an EXTREMELY detailed facial description from reference photos. This description will be used to generate an identical portrait — so precision is critical.

Analyze ALL provided photos and cross-reference features across angles. Write a single comprehensive report covering EVERY detail below. Be specific with measurements (relative proportions), colors (exact shade), and shapes.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze these ${referenceUrls.length} photos of the SAME person. Produce an exhaustive facial identity report:

1. FACE SHAPE & STRUCTURE: Overall shape (oval/round/square/heart/oblong), forehead height & width, cheekbone prominence & width, jawline angle & width, chin shape & size, face length-to-width ratio
2. EYES: Shape (almond/round/hooded/deep-set), size, color (exact shade), spacing (close/average/wide), brow-to-eye distance, upper eyelid visibility, under-eye features, lash density
3. EYEBROWS: Thickness, arch type (flat/soft/high), color, length, starting point relative to nose, tail shape
4. NOSE: Bridge width (narrow/medium/wide), bridge profile (straight/convex/concave), tip shape (pointed/bulbous/upturned), nostril width & shape, nose length relative to face, any asymmetry
5. MOUTH & LIPS: Width, upper lip thickness vs lower lip, cupid's bow shape, lip color, mouth corners direction
6. SKIN: Exact tone/shade, texture (smooth/textured), any visible marks/moles/scars (describe location precisely), wrinkle patterns
7. FACIAL HAIR: Beard density (patchy/medium/full), color, mustache style, cheek line shape, neckline boundary, stubble length, any gray hairs
8. HAIR: Color (exact shade), texture (straight/wavy/curly), density, hairline shape (straight/M-shaped/receding), parting side, length on top vs sides
9. EARS: Size relative to head, angle (flat/protruding), lobe type (attached/free)
10. DISTINGUISHING FEATURES: Anything unique — dimples, facial asymmetry, distinctive marks, expression lines, head shape quirks
11. APPROXIMATE AGE & ETHNICITY markers for accurate skin tone rendering
12. ACCESSORIES: Glasses, earrings, head coverings, etc.

Be extremely precise. This report will be used to generate an IDENTICAL portrait of this person.`
              },
              ...imageContentParts,
            ],
          },
        ],
      }),
    });

    if (!analysisResponse.ok) {
      console.error("Face analysis failed:", analysisResponse.status);
      // Fall back to single-pass if analysis fails
    }

    let faceDescription = "";
    if (analysisResponse.ok) {
      const analysisData = await analysisResponse.json();
      faceDescription = analysisData.choices?.[0]?.message?.content || "";
      console.log("Face analysis complete, length:", faceDescription.length);
    }

    // =====================================================
    // PASS 2: Generate portrait using analysis + references
    // =====================================================
    console.log("Pass 2: Generating portrait with style:", styleDesc);

    const styleInstructions = getStyleInstructions(styleDesc);
    const expressionText = getExpressionInstruction(expression);

    const generationSystemPrompt = `You are an elite identity-preserving portrait generator. You have been given:
1. A detailed forensic facial analysis of a real person
2. ${referenceUrls.length} reference photo(s) of that same person

Your ABSOLUTE #1 PRIORITY is producing an image where the person is IMMEDIATELY recognizable as the EXACT same person in the references. A family member must look at your output and say "that's definitely them."

IDENTITY RULES (NON-NEGOTIABLE):
- Every facial measurement, proportion, and feature MUST match the analysis and reference photos exactly
- Do NOT beautify, smooth skin, slim the face, change skin tone, alter nose shape, or modify ANY feature
- Facial hair must match EXACTLY: same density, same coverage area, same color
- Hairline must be pixel-perfect to references
- Any marks, moles, or scars visible in references MUST appear in the output
- Eye color, shape, and spacing must be identical
- If the person has asymmetric features, PRESERVE the asymmetry
${hasBaseAvatar ? "\n- The FIRST reference image is the primary identity anchor — match it with highest priority" : ""}

STYLE: ${styleInstructions}
EXPRESSION: ${expressionText}

Generate ONE portrait image. Change ONLY the artistic style/medium — the face underneath must be an exact copy of this person's real face.`;

    const generationUserContent: any[] = [
      {
        type: "text",
        text: `${faceDescription ? `DETAILED FACE ANALYSIS OF THIS PERSON:\n${faceDescription}\n\n` : ""}Here are ${referenceUrls.length} reference photos. Generate a portrait in "${styleDesc}" style with ${expressionText} expression.

REMINDER: The output must look like THIS EXACT person — not a similar-looking person. Match every detail from the analysis and photos: nose shape, beard pattern, eye shape, skin tone, hairline, facial proportions. Generate the image now.`
      },
      ...imageContentParts,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        modalities: ["image", "text"],
        temperature: 0.01,
        messages: [
          { role: "system", content: generationSystemPrompt },
          { role: "user", content: generationUserContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד דקה" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "נדרש חידוש קרדיטים" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      JSON.stringify({ imageUrl: generatedImageUrl, text: extracted.text || "האווטאר נוצר בהצלחה" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-avatar error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה ביצירת אווטאר" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
