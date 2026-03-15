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
    
    const systemPrompt = `You are an expert portrait artist and avatar designer. 
The user will provide reference photos of a person. Your task is to generate a single, high-quality professional avatar/headshot image of that person.

Guidelines:
- Carefully study ALL reference photos to capture the person's exact facial features, skin tone, hair color/style, and distinguishing characteristics
- Generate a clean, well-lit, professional-looking portrait
- The face should be clearly visible, centered, and facing forward
- Use clean, neutral or slightly blurred background
- Maintain photorealistic quality
- The result should look like a professional studio headshot suitable for video avatars
- Style: ${styleDesc}

IMPORTANT: Generate the image directly. Do not describe it - CREATE the image.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              ...imageContentParts,
              {
                type: "text",
                text: `Based on these ${imageUrls.length} reference photo(s) of the same person, generate a professional, high-quality avatar headshot portrait. Style: ${styleDesc}. Make sure the generated avatar closely resembles the person in the photos.`,
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

    // Extract image from response - could be in content array or inline_data
    let generatedImageUrl: string | null = null;
    let textResponse = "";

    if (choice?.content) {
      if (typeof choice.content === "string") {
        textResponse = choice.content;
      } else if (Array.isArray(choice.content)) {
        for (const part of choice.content) {
          if (part.type === "image_url" && part.image_url?.url) {
            generatedImageUrl = part.image_url.url;
          } else if (part.type === "text") {
            textResponse = part.text || "";
          } else if (part.inline_data) {
            // base64 image
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

      // Extract base64 data
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
