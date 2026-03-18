// Deno.serve used natively

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ELEVENLABS_DASHBOARD_URL = "https://elevenlabs.io/subscription";
const RUNWAY_DASHBOARD_URL = "https://app.runwayml.com/settings/billing";
const RUNWAY_VERSION = "2024-11-06";
const RUNWAY_VALIDATION_TASK_ID = "00000000-0000-0000-0000-000000000000";
const SERVICE_CHECK_TIMEOUT_MS = 20000;

interface ServiceCredits {
  service: string;
  used: number;
  limit: number;
  unit: string;
  plan: string;
  canGenerate: boolean;
  dashboardUrl: string;
  error?: string;
}

const withServiceTimeout = (
  service: ServiceCredits["service"],
  unit: string,
  dashboardUrl: string,
  checkPromise: Promise<ServiceCredits>,
): Promise<ServiceCredits> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    checkPromise,
    new Promise<ServiceCredits>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve({
          service,
          used: 0,
          limit: 0,
          unit,
          plan: "unknown",
          canGenerate: false,
          dashboardUrl,
          error: `Timeout after ${SERVICE_CHECK_TIMEOUT_MS}ms`,
        });
      }, SERVICE_CHECK_TIMEOUT_MS);
    }),
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const toErrorResult = (
  service: ServiceCredits["service"],
  unit: string,
  dashboardUrl: string,
  error: unknown,
): ServiceCredits => ({
  service,
  used: 0,
  limit: 0,
  unit,
  plan: "unknown",
  canGenerate: false,
  dashboardUrl,
  error: getErrorMessage(error),
});

const parseErrorBody = async (response: Response): Promise<string> => {
  const text = await response.text();
  if (!text) return "No response body";

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") return parsed;
    if (parsed?.detail) return String(parsed.detail);
    if (parsed?.message) return String(parsed.message);
    return JSON.stringify(parsed);
  } catch {
    return text;
  }
};

async function checkElevenLabs(apiKey: string): Promise<ServiceCredits> {
  try {
    const headers = { "xi-api-key": apiKey };

    // Try subscription endpoint first (works with full API keys)
    const subscriptionRes = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers,
    });

    if (subscriptionRes.ok) {
      const data = await subscriptionRes.json();
      const used = data.character_count || 0;
      const limit = data.character_limit || 10000;

      return {
        service: "elevenlabs",
        used,
        limit,
        unit: "תווים",
        plan: data.tier || "free",
        canGenerate: used < limit,
        dashboardUrl: ELEVENLABS_DASHBOARD_URL,
      };
    }

    // Try /v1/user endpoint as fallback (sometimes accessible with different key types)
    const userRes = await fetch("https://api.elevenlabs.io/v1/user", { headers });
    if (userRes.ok) {
      const userData = await userRes.json();
      const sub = userData.subscription;
      if (sub) {
        const used = sub.character_count || 0;
        const limit = sub.character_limit || 10000;
        return {
          service: "elevenlabs",
          used,
          limit,
          unit: "תווים",
          plan: sub.tier || "free",
          canGenerate: used < limit,
          dashboardUrl: ELEVENLABS_DASHBOARD_URL,
        };
      }
    }

    // Last resort: validate key can at least call models
    const modelsRes = await fetch("https://api.elevenlabs.io/v1/models", { headers });
    if (modelsRes.ok) {
      return {
        service: "elevenlabs",
        used: 0,
        limit: -1,
        unit: "תווים",
        plan: "API מחובר",
        canGenerate: true,
        dashboardUrl: ELEVENLABS_DASHBOARD_URL,
      };
    }

    const modelsError = await parseErrorBody(modelsRes);
    throw new Error(`subscription:${subscriptionRes.status}; user:${userRes.status}; models:${modelsRes.status} ${modelsError}`);
  } catch (error) {
    return toErrorResult("elevenlabs", "תווים", ELEVENLABS_DASHBOARD_URL, error);
  }
}

async function checkHeyGen(apiKey: string): Promise<ServiceCredits> {
  try {
    const res = await fetch("https://api.heygen.com/v2/avatars", {
      headers: { "X-Api-Key": apiKey },
    });

    if (res.ok) {
      return {
        service: "heygen",
        used: 0,
        limit: -1,
        unit: "קרדיטים",
        plan: "API מחובר",
        canGenerate: true,
        dashboardUrl: "https://app.heygen.com/settings",
      };
    }

    if (res.status === 401 || res.status === 403) {
      const message = await parseErrorBody(res);
      throw new Error(`HTTP ${res.status}: ${message}`);
    }

    return {
      service: "heygen",
      used: 0,
      limit: -1,
      unit: "קרדיטים",
      plan: "API מחובר",
      canGenerate: true,
      dashboardUrl: "https://app.heygen.com/settings",
    };
  } catch (error) {
    return toErrorResult("heygen", "קרדיטים", "https://app.heygen.com/settings", error);
  }
}

async function checkRunway(apiKey: string): Promise<ServiceCredits> {
  try {
    // Runway currently has no dedicated "credits" endpoint.
    // Validate API key by hitting a known endpoint with a dummy task id.
    const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${RUNWAY_VALIDATION_TASK_ID}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_VERSION,
      },
    });

    // 200 = task exists, 400/404/422 = endpoint reached + auth valid, task invalid/not found.
    if (res.ok || res.status === 400 || res.status === 404 || res.status === 422) {
      return {
        service: "runway",
        used: 0,
        limit: -1,
        unit: "קרדיטים",
        plan: "API מחובר",
        canGenerate: true,
        dashboardUrl: RUNWAY_DASHBOARD_URL,
      };
    }

    const errorText = await parseErrorBody(res);
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  } catch (error) {
    return toErrorResult("runway", "קרדיטים", RUNWAY_DASHBOARD_URL, error);
  }
}

async function checkShotstack(apiKey: string): Promise<ServiceCredits> {
  try {
    // Try to get usage from Shotstack API
    const res = await fetch("https://api.shotstack.io/stage/render", {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });

    // If we get any valid response (even 400), the key is valid
    if (res.ok || res.status === 400 || res.status === 404) {
      return {
        service: "shotstack",
        used: 0,
        limit: -1,
        unit: "רינדורים",
        plan: "sandbox",
        canGenerate: true,
        dashboardUrl: "https://dashboard.shotstack.io/",
      };
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(`API key invalid (${res.status})`);
    }

    return {
      service: "shotstack",
      used: 0,
      limit: -1,
      unit: "רינדורים",
      plan: "sandbox",
      canGenerate: true,
      dashboardUrl: "https://dashboard.shotstack.io/",
    };
  } catch (error) {
    return toErrorResult("shotstack", "רינדורים", "https://dashboard.shotstack.io/", error);
  }
}

async function checkCloudinary(cloudName: string, apiKey: string, apiSecret: string): Promise<ServiceCredits> {
  try {
    const auth = btoa(`${apiKey}:${apiSecret}`);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/usage`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) {
      const message = await parseErrorBody(res);
      throw new Error(`HTTP ${res.status}: ${message}`);
    }

    const data = await res.json();
    const used = data.credits?.used_percent ?? 0;

    return {
      service: "cloudinary",
      used: Math.round(used * 100) / 100,
      limit: 100,
      unit: "% קרדיטים",
      plan: data.plan || "free",
      canGenerate: used < 100,
      dashboardUrl: "https://console.cloudinary.com/settings/account",
    };
  } catch (error) {
    return toErrorResult("cloudinary", "% קרדיטים", "https://console.cloudinary.com/settings/account", error);
  }
}

async function checkKrea(apiKey: string): Promise<ServiceCredits> {
  try {
    // Validate the Krea API key by listing models
    const res = await fetch("https://api.krea.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.ok || res.status === 404) {
      return {
        service: "krea",
        used: 0,
        limit: -1,
        unit: "קרדיטים",
        plan: "API מחובר",
        canGenerate: true,
        dashboardUrl: "https://krea.ai/account",
      };
    }

    if (res.status === 401 || res.status === 403) {
      const message = await parseErrorBody(res);
      throw new Error(`HTTP ${res.status}: ${message}`);
    }

    return {
      service: "krea",
      used: 0,
      limit: -1,
      unit: "קרדיטים",
      plan: "API מחובר",
      canGenerate: true,
      dashboardUrl: "https://krea.ai/account",
    };
  } catch (error) {
    return toErrorResult("krea", "קרדיטים", "https://krea.ai/account", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const results: ServiceCredits[] = [];

    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    const heygenKey = Deno.env.get("HEYGEN_API_KEY");
    const runwayKey = Deno.env.get("RUNWAY_API_KEY");
    const shotstackKey = Deno.env.get("SHOTSTACK_API_KEY");
    const cloudinaryName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const cloudinaryKey = Deno.env.get("CLOUDINARY_API_KEY");
    const cloudinarySecret = Deno.env.get("CLOUDINARY_API_SECRET");
    const kreaKey = Deno.env.get("KREA_API_KEY");

    const promises: Promise<ServiceCredits>[] = [];

    if (elevenLabsKey) {
      promises.push(withServiceTimeout("elevenlabs", "תווים", ELEVENLABS_DASHBOARD_URL, checkElevenLabs(elevenLabsKey)));
    }
    if (heygenKey) {
      promises.push(withServiceTimeout("heygen", "קרדיטים", "https://app.heygen.com/settings", checkHeyGen(heygenKey)));
    }
    if (runwayKey) {
      promises.push(withServiceTimeout("runway", "קרדיטים", RUNWAY_DASHBOARD_URL, checkRunway(runwayKey)));
    }
    if (shotstackKey) {
      promises.push(withServiceTimeout("shotstack", "רינדורים", "https://dashboard.shotstack.io/", checkShotstack(shotstackKey)));
    }
    if (cloudinaryName && cloudinaryKey && cloudinarySecret) {
      promises.push(withServiceTimeout("cloudinary", "% קרדיטים", "https://console.cloudinary.com/settings/account", checkCloudinary(cloudinaryName, cloudinaryKey, cloudinarySecret)));
    }
    if (kreaKey) {
      promises.push(withServiceTimeout("krea", "קרדיטים", "https://krea.ai/account", checkKrea(kreaKey)));
    }

    const settled = await Promise.allSettled(promises);
    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }

    return new Response(JSON.stringify({ credits: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("check-credits error:", error);

    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
