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

    const { imageUrls, style } = await req.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "יש להעלות לפחות תמונה אחת" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build image content parts for the multimodal request
    const imageContentParts = imageUrls.map((url: string) => ({
      type: "image_url" as const,
      image_url: { url },
    }));

    const styleDesc = style || "professional headshot";

    // Build style-specific instructions
    let styleInstructions = "";
    if (styleDesc.includes("cartoon") || styleDesc.includes("pixar")) {
      styleInstructions = `
- Create a 3D animated/Pixar-style character based on the person's features
- Use vibrant colors, smooth skin textures, and slightly exaggerated proportions
- Large expressive eyes, rounded features
- The character should be clearly recognizable as the same person`;
    } else if (styleDesc.includes("disney")) {
      styleInstructions = `
- Create a classic Disney hand-drawn animation style portrait
- Elegant lines, warm color palette, magical lighting
- Slightly idealized but clearly recognizable as the same person
- Add subtle sparkle or magical atmosphere`;
    } else if (styleDesc.includes("anime")) {
      styleInstructions = `
- Create a Japanese anime/manga style portrait
- Large expressive eyes, sharp features, dynamic hair
- Clean line art with cel-shading style coloring
- The character should be clearly recognizable as the same person`;
    } else if (styleDesc.includes("comic")) {
      styleInstructions = `
- Create a Western comic book / graphic novel style portrait
- Bold outlines, dramatic shading, halftone dots effect
- Heroic proportions, dynamic pose
- The character should be clearly recognizable as the same person`;
    } else if (styleDesc.includes("watercolor")) {
      styleInstructions = `
- Create an artistic watercolor painting portrait
- Soft flowing colors, visible brush strokes, organic textures
- Dreamy ethereal quality
- The person should be clearly recognizable`;
    } else if (styleDesc.includes("pop art")) {
      styleInstructions = `
- Create a bold pop art style portrait inspired by Andy Warhol / Roy Lichtenstein
- Bright contrasting colors, bold outlines, Ben-Day dots
- Dramatic and eye-catching composition
- The person should be clearly recognizable`;
    } else {
      // Professional / photorealistic styles
      styleInstructions = `
- Generate a clean, well-lit, professional-looking portrait
- The face should be clearly visible, centered, and facing forward
- Use clean, neutral or slightly blurred background
- Maintain photorealistic quality
- The result should look like a professional studio headshot suitable for video avatars`;
    }
    
    const systemPrompt = `You are an expert portrait artist specializing in creating photorealistic avatars from reference photos.

CRITICAL ACCURACY REQUIREMENTS:
- You MUST preserve the EXACT facial structure: jaw shape, chin, cheekbones, forehead size and shape
- You MUST preserve the EXACT nose shape and size
- You MUST preserve the EXACT eye shape, color, spacing, and brow thickness
- You MUST preserve the EXACT mouth shape and lip thickness
- You MUST preserve the EXACT skin tone, complexion, and any facial marks (moles, freckles, scars)
- You MUST preserve the EXACT hair color, texture, style, hairline, and any facial hair (beard shape, mustache)
- You MUST preserve the EXACT ear shape and size
- You MUST preserve any head coverings (kippa, hat, glasses) exactly as shown
- The generated person must be IMMEDIATELY recognizable as the same individual in the reference photos
- Do NOT idealize, beautify, or change any facial proportions

${styleInstructions}
- Style: ${styleDesc}

IMPORTANT: Generate the image directly. Do not describe it - CREATE the image. The result MUST look like the SAME PERSON from the photos.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        modalities: ["image", "text"],
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              ...imageContentParts,
              {
                type: "text",
                text: `Based on these ${imageUrls.length} reference photo(s) of the same person, generate a high-quality avatar portrait. Style: ${styleDesc}. Make sure the generated avatar closely resembles the person in the photos.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד דקה" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "נדרש חידוש קרדיטים" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`שגיאה ביצירת אווטאר: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;

    // Extract image from response
    let generatedImageUrl: string | null = null;
    let textResponse = "";

    // Check for images array (new format)
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

    // If we got a base64 image, upload it to storage
    if (generatedImageUrl && generatedImageUrl.startsWith("data:")) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const matches = generatedImageUrl.match(/^data:(.+?);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const ext = mimeType.includes("png") ? "png" : "jpg";
        const path = `avatars/${Date.now()}-generated.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(path, bytes, { contentType: mimeType, cacheControl: "3600" });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(path);
          generatedImageUrl = publicUrlData.publicUrl;
        }
      }
    }

    return new Response(
      JSON.stringify({
        imageUrl: generatedImageUrl,
        text: textResponse || "האווטאר נוצר בהצלחה",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-avatar error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה ביצירת אווטאר" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
