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
    return "- Expression: neutral, natural resting face as shown in references";
  }
  const map: Record<string, string> = {
    smile: "- Expression: genuine warm smile with slight teeth showing, eyes slightly squinted naturally",
    big_smile: "- Expression: big joyful smile, wide and open, happy eyes",
    serious: "- Expression: serious and confident, slight intensity in eyes, closed mouth",
    friendly: "- Expression: soft friendly smile, approachable and warm",
    thinking: "- Expression: thoughtful look, slight head tilt, contemplative eyes",
  };
  return map[expression] || `- Expression: ${expression}`;
};

const getStyleInstructions = (styleDesc: string) => {
  const s = styleDesc.toLowerCase();

  if (s.includes("pixar") || s.includes("3d animated")) return `
- Apply Pixar/3D animation rendering style ONLY
- Keep facial geometry UNCHANGED: same jawline, nose bridge, eye spacing, ear shape
- Keep beard line, hairline, and head proportions identical
- Do NOT make features "cuter" or exaggerated — preserve adult proportions`;

  if (s.includes("disney")) return `
- Apply classic Disney hand-drawn illustration style ONLY
- Identity lock mandatory: exact facial structure and proportions preserved
- Preserve hairline, eyebrow shape, nose profile, lips, and beard boundaries exactly
- Avoid beautification, age changes, or proportion shifts`;

  if (s.includes("anime") || s.includes("manga")) return `
- Apply anime/manga rendering style ONLY
- Keep exact skull shape, jaw width, nose proportions, and eye spacing
- Preserve beard shape, hairline, and all distinguishing marks exactly
- Keep identity recognizable at first glance — no generic anime face`;

  if (s.includes("comic") || s.includes("graphic novel")) return `
- Apply western comic book / graphic novel style ONLY
- Keep face geometry and all proportions unchanged
- Preserve distinguishing features: beard shape, brow thickness, nose silhouette
- Do NOT add heroic exaggeration to face proportions`;

  if (s.includes("watercolor")) return `
- Apply watercolor texture and brushwork ONLY
- Keep exact facial landmarks and proportions under the painting style
- Preserve realistic facial structure — only the medium changes`;

  if (s.includes("pop art")) return `
- Apply bold pop-art color treatment and graphic styling ONLY
- Keep the same face geometry and expression structure
- Preserve facial hair, hairline, and identity markers exactly`;

  if (s.includes("oil painting") || s.includes("renaissance")) return `
- Apply classical oil painting / Renaissance portrait style ONLY
- Keep exact facial proportions and identity
- Rich color depth and traditional brushwork texture`;

  if (s.includes("caricature")) return `
- Apply caricature style with mild exaggeration ONLY
- Keep the person CLEARLY recognizable — exaggerate proportions slightly, not drastically
- Preserve key identity markers: nose shape, beard, hairline`;

  if (s.includes("minimalist") || s.includes("line art")) return `
- Apply clean minimalist line art / vector illustration style
- Capture the person's unique features with minimal lines
- Keep proportions accurate to source — identity must be obvious`;

  if (s.includes("retro") || s.includes("vintage")) return `
- Apply retro/vintage poster style with muted tones
- Keep facial identity exact — only color palette and texture change
- Warm film-grain aesthetic`;

  if (s.includes("cyberpunk") || s.includes("neon")) return `
- Apply cyberpunk/neon aesthetic: dramatic neon lighting, sci-fi elements
- Keep facial identity EXACT — only lighting and background change
- Preserve all facial features precisely`;

  if (s.includes("sticker") || s.includes("chibi")) return `
- Apply cute chibi/sticker style with large head proportions
- Despite stylization, preserve KEY facial markers: beard shape, nose, eyes, hairline
- Keep the person recognizable even in chibi form`;

  // Default: professional/realistic
  return `
- Generate a clean, well-lit professional portrait
- Face centered and clearly visible, neutral/gradient background
- Preserve photorealistic identity with no beautification or AI smoothing`;
};

const buildSystemPrompt = (styleDesc: string, strictIdentity: boolean, hasBaseAvatar: boolean, expression?: string) => {
  const styleInstructions = getStyleInstructions(styleDesc);
  const expressionInstruction = getExpressionInstruction(expression);

  const baseAnchor = hasBaseAvatar
    ? "\n- The base avatar image is the PRIMARY IDENTITY ANCHOR — match it exactly, change style only"
    : "";

  return `You are an elite identity-preserving portrait generator. Your #1 priority is EXACT facial likeness.

ABSOLUTE IDENTITY PRESERVATION RULES (NON-NEGOTIABLE):
- Study ALL reference images carefully before generating
- Map the EXACT craniofacial geometry: forehead height & shape, cheekbone width & angle, jaw shape & chin
- Map EXACT eyes: shape, color, spacing, depth, brow thickness and arch position
- Map EXACT nose: bridge width, tip shape, nostril width, length, profile angle
- Map EXACT mouth: lip width, upper/lower lip thickness, philtrum shape
- Map EXACT ears: size, angle, lobe shape
- Map EXACT skin: tone, texture, any marks, moles, or wrinkles visible
- Map EXACT hair: color, texture, density, hairline shape, part direction
- Map EXACT facial hair: beard density, mustache shape, sideburn length, neckline
- Preserve ALL accessories: glasses, head coverings (kippa/hat), earrings, etc.
- Do NOT beautify, smooth, slim, age, or alter ANY facial proportions
- The generated image must be INDISTINGUISHABLE in identity from the reference photos
- A friend or family member MUST be able to immediately recognize this as the same person
${baseAnchor}

${expressionInstruction}

STYLE DIRECTIVE:
- Requested style: ${styleDesc}
${styleInstructions}

OUTPUT:
- Return one final portrait image
- If style is artistic, change ONLY the rendering medium — face geometry stays pixel-perfect to source
- Do not explain; generate the image directly.`;
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

    const hasBaseAvatar = Boolean(body.baseAvatarUrl);
    const systemPrompt = buildSystemPrompt(styleDesc, strictIdentity, hasBaseAvatar, expression);

    const imageContentParts = referenceUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    }));

    const userPrompt = `I am providing ${referenceUrls.length} reference photo(s) of the SAME REAL person taken from different angles.

CRITICAL INSTRUCTIONS:
1. Analyze ALL ${referenceUrls.length} photos to build a complete 3D mental model of this person's face
2. Cross-reference every facial feature across all angles to ensure accuracy
3. The output MUST look like a real photo of THIS EXACT person — not someone who "looks similar"
4. Pay special attention to: nose shape from front AND side, exact beard density and boundaries, eye shape and color, skin tone, hairline

${hasBaseAvatar ? "The FIRST image is the base avatar — this is the PRIMARY identity reference. Match it exactly." : ""}

Style: ${styleDesc}
Expression: ${expression === "neutral" ? "natural resting face" : expression}

Generate the portrait now.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        modalities: ["image", "text"],
        temperature: 0.02,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              ...imageContentParts,
            ],
          },
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
