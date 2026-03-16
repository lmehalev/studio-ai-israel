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
  baseAvatarUrl?: string;
  strictIdentity?: boolean;
};

const dedupeUrls = (urls: string[]) =>
  Array.from(new Set(urls.filter((url) => typeof url === "string" && url.trim().length > 0)));

const getStyleInstructions = (styleDesc: string) => {
  const normalizedStyle = styleDesc.toLowerCase();

  if (normalizedStyle.includes("cartoon") || normalizedStyle.includes("pixar")) {
    return `
- Apply Pixar/3D animation rendering style ONLY
- Keep facial geometry unchanged: same jawline, same nose bridge, same eye spacing
- Keep beard line, hairline, and ear proportions identical
- Keep the same kippa/head covering shape and placement
- Do NOT alter face proportions to be "cuter" or exaggerated`;
  }

  if (normalizedStyle.includes("disney")) {
    return `
- Apply classic Disney illustration style ONLY
- Identity lock is mandatory: keep exact facial structure and proportions
- Preserve hairline, eyebrow shape, nose profile, lips, and beard boundaries
- Keep kippa/head covering exactly positioned and recognizable
- Avoid beautification or age changes`;
  }

  if (normalizedStyle.includes("anime")) {
    return `
- Apply anime rendering style ONLY
- Keep exact skull shape, jaw width, nose proportions, and eye spacing
- Preserve beard shape and hairline details exactly
- Keep identity recognizable at first glance`;
  }

  if (normalizedStyle.includes("comic")) {
    return `
- Apply western comic style ONLY
- Keep face geometry and all proportions unchanged
- Preserve distinguishing features: beard shape, brow thickness, nose silhouette
- Do not add heroic exaggeration to face proportions`;
  }

  if (normalizedStyle.includes("watercolor")) {
    return `
- Apply watercolor texture and brushwork ONLY
- Keep exact facial landmarks and proportions
- Preserve realistic facial structure under the painting style`;
  }

  if (normalizedStyle.includes("pop art")) {
    return `
- Apply pop-art color treatment and graphic styling ONLY
- Keep the same face geometry and expression structure
- Preserve facial hair, hairline, and identity markers exactly`;
  }

  return `
- Generate a clean, well-lit professional portrait
- Face centered and clearly visible, neutral background
- Preserve photorealistic identity with no beautification`;
};

const getIdentityInstructions = (strictIdentity: boolean, hasBaseAvatar: boolean) => {
  const baseAnchorInstruction = hasBaseAvatar
    ? "- The provided base avatar image is an IDENTITY ANCHOR; preserve it exactly while changing style only"
    : "";

  if (!strictIdentity) {
    return `
- Keep the person recognizable across all references
${baseAnchorInstruction}`;
  }

  return `
CRITICAL IDENTITY LOCK (MANDATORY):
- Preserve EXACT craniofacial geometry: forehead height, cheekbone width, jaw shape, chin size
- Preserve EXACT eyes: shape, spacing, brow thickness and arch
- Preserve EXACT nose: bridge, tip shape, nostril width, profile
- Preserve EXACT mouth and lips: width, upper/lower lip thickness, corner shape
- Preserve EXACT skin tone and complexion; keep natural marks if visible
- Preserve EXACT hairline, hair density, beard/mustache boundaries and texture
- Preserve EXACT ears and head proportions
- Preserve accessories/head covering (including kippa) exactly as shown
- Do NOT beautify, slim, age-change, or stylize facial proportions
- Output must be immediately recognizable as the SAME real person
${baseAnchorInstruction}`;
};

const buildSystemPrompt = (styleDesc: string, strictIdentity: boolean, hasBaseAvatar: boolean) => {
  const styleInstructions = getStyleInstructions(styleDesc);
  const identityInstructions = getIdentityInstructions(strictIdentity, hasBaseAvatar);

  return `You are an elite identity-preserving portrait generator.

${identityInstructions}

STYLE DIRECTIVE:
- Requested style: ${styleDesc}
${styleInstructions}

OUTPUT RULES:
- Return one final portrait image
- Keep identity consistency across all supplied references
- If style is artistic, change rendering style ONLY while preserving face geometry 1:1
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

    const systemPrompt = buildSystemPrompt(styleDesc, strictIdentity, hasBaseAvatar);

    const imageContentParts = referenceUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    }));

    const userPrompt = `I am providing ${referenceUrls.length} reference image(s) of the SAME person.

Identity requirements:
- Build one consistent identity map from all angles.
- Keep the person identical to references (1:1 identity), not approximate.
- Preserve exact likeness even in artistic style.

${hasBaseAvatar ? "Base avatar image is provided and must be treated as identity anchor." : ""}

Requested style: ${styleDesc}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        modalities: ["image", "text"],
        temperature: 0.05,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPrompt,
              },
              ...imageContentParts,
            ],
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
        text: extracted.text || "האווטאר נוצר בהצלחה",
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
