// Deno.serve used natively

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RUNWAY_API = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";
const MAX_RUNWAY_PROMPT_LENGTH = 950;

const normalizePromptText = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_RUNWAY_PROMPT_LENGTH);
};

const mapRunwayError = (status: number, errText: string): string => {
  const lowerErr = errText.toLowerCase();

  if (lowerErr.includes('not enough credits') || lowerErr.includes('you do not have enough credits')) {
    return "נגמרו הקרדיטים לספק הווידאו (Runway). יש לחדש קרדיטים ואז לנסות שוב.";
  }

  if (errText.includes('"code":"too_big"') || errText.includes("Too big")) {
    return "הפרומפט היה ארוך מדי לספק הווידאו. קיצרתי אותו אוטומטית — נסה שוב.";
  }

  if (status === 429) {
    return "יותר מדי בקשות לספק הווידאו כרגע, נסה שוב בעוד רגע.";
  }

  return `שגיאה ב-RunwayML [${status}]`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RUNWAY_API_KEY = Deno.env.get("RUNWAY_API_KEY");
    if (!RUNWAY_API_KEY) throw new Error("RUNWAY_API_KEY is not configured");

    const { action, promptText, promptImage, model, duration, ratio, taskId } = await req.json();

    const headers = {
      "Authorization": `Bearer ${RUNWAY_API_KEY}`,
      "Content-Type": "application/json",
      "X-Runway-Version": RUNWAY_VERSION,
    };

    // Create image-to-video task
    if (action === "image_to_video") {
      if (!promptImage) {
        return new Response(
          JSON.stringify({ error: "חסר קישור לתמונה" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const safePromptText = normalizePromptText(promptText);

      const response = await fetch(`${RUNWAY_API}/image_to_video`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: model || "gen4.5",
          promptImage,
          promptText: safePromptText,
          duration: duration || 5,
          ratio: ratio || "1280:720",
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Runway image_to_video error:", response.status, errText);
        return new Response(
          JSON.stringify({ error: mapRunwayError(response.status, errText) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ taskId: data.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create text-to-video task
    if (action === "text_to_video") {
      const safePromptText = normalizePromptText(promptText);
      if (!safePromptText) {
        return new Response(
          JSON.stringify({ error: "חסר תיאור לסרטון" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(`${RUNWAY_API}/text_to_video`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: model || "gen4.5",
          promptText: safePromptText,
          duration: duration || 5,
          ratio: ratio || "1280:720",
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Runway text_to_video error:", response.status, errText);
        return new Response(
          JSON.stringify({ error: mapRunwayError(response.status, errText) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ taskId: data.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check task status
    if (action === "check_status") {
      if (!taskId) {
        return new Response(
          JSON.stringify({ error: "חסר מזהה משימה" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(`${RUNWAY_API}/tasks/${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${RUNWAY_API_KEY}`,
          "X-Runway-Version": RUNWAY_VERSION,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Runway check_status error:", response.status, errText);
        return new Response(
          JSON.stringify({ error: `שגיאה בבדיקת סטטוס [${response.status}]` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({
          status: data.status, // PENDING, THROTTLED, RUNNING, SUCCEEDED, FAILED
          progress: data.progress || 0,
          resultUrl: data.output?.[0] || null,
          failureReason: data.failure || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "פעולה לא מוכרת" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("runway-video error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה ביצירת וידאו" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
