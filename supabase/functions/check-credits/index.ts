import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

async function checkElevenLabs(apiKey: string): Promise<ServiceCredits> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const used = data.character_count || 0;
    const limit = data.character_limit || 10000;
    return {
      service: "elevenlabs",
      used,
      limit,
      unit: "תווים",
      plan: data.tier || "free",
      canGenerate: used < limit,
      dashboardUrl: "https://elevenlabs.io/subscription",
    };
  } catch (e) {
    return { service: "elevenlabs", used: 0, limit: 0, unit: "תווים", plan: "unknown", canGenerate: false, dashboardUrl: "https://elevenlabs.io/subscription", error: e.message };
  }
}

async function checkDID(apiKey: string): Promise<ServiceCredits> {
  try {
    const res = await fetch("https://api.d-id.com/credits", {
      headers: { Authorization: `Basic ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const remaining = data.remaining || 0;
    const total = data.total || 20;
    return {
      service: "did",
      used: total - remaining,
      limit: total,
      unit: "קרדיטים",
      plan: remaining > 0 ? "active" : "exhausted",
      canGenerate: remaining > 0,
      dashboardUrl: "https://studio.d-id.com/account",
    };
  } catch (e) {
    return { service: "did", used: 0, limit: 0, unit: "קרדיטים", plan: "unknown", canGenerate: false, dashboardUrl: "https://studio.d-id.com/account", error: e.message };
  }
}

async function checkRunway(apiKey: string): Promise<ServiceCredits> {
  try {
    const res = await fetch("https://api.dev.runwayml.com/v1/credits", {
      headers: { Authorization: `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const used = data.creditsUsed ?? 0;
    const total = data.creditsTotal ?? 125;
    return {
      service: "runway",
      used,
      limit: total,
      unit: "קרדיטים",
      plan: data.plan || "trial",
      canGenerate: used < total,
      dashboardUrl: "https://app.runwayml.com/settings/billing",
    };
  } catch (e) {
    return { service: "runway", used: 0, limit: 0, unit: "קרדיטים", plan: "unknown", canGenerate: false, dashboardUrl: "https://app.runwayml.com/settings/billing", error: e.message };
  }
}

async function checkShotstack(apiKey: string): Promise<ServiceCredits> {
  try {
    // Shotstack doesn't have a direct credits endpoint in sandbox, return static info
    return {
      service: "shotstack",
      used: 0,
      limit: -1, // unlimited in sandbox (with watermark)
      unit: "רינדורים",
      plan: "sandbox",
      canGenerate: true,
      dashboardUrl: "https://dashboard.shotstack.io/",
    };
  } catch (e) {
    return { service: "shotstack", used: 0, limit: 0, unit: "רינדורים", plan: "unknown", canGenerate: false, dashboardUrl: "https://dashboard.shotstack.io/", error: e.message };
  }
}

async function checkCloudinary(cloudName: string, apiKey: string, apiSecret: string): Promise<ServiceCredits> {
  try {
    const auth = btoa(`${apiKey}:${apiSecret}`);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/usage`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
  } catch (e) {
    return { service: "cloudinary", used: 0, limit: 0, unit: "% קרדיטים", plan: "unknown", canGenerate: false, dashboardUrl: "https://console.cloudinary.com/settings/account", error: e.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const results: ServiceCredits[] = [];

    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    const didKey = Deno.env.get("DID_API_KEY");
    const runwayKey = Deno.env.get("RUNWAY_API_KEY");
    const shotstackKey = Deno.env.get("SHOTSTACK_API_KEY");
    const cloudinaryName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const cloudinaryKey = Deno.env.get("CLOUDINARY_API_KEY");
    const cloudinarySecret = Deno.env.get("CLOUDINARY_API_SECRET");

    // Run all checks in parallel
    const promises: Promise<ServiceCredits>[] = [];

    if (elevenLabsKey) promises.push(checkElevenLabs(elevenLabsKey));
    if (didKey) promises.push(checkDID(didKey));
    if (runwayKey) promises.push(checkRunway(runwayKey));
    if (shotstackKey) promises.push(checkShotstack(shotstackKey));
    if (cloudinaryName && cloudinaryKey && cloudinarySecret)
      promises.push(checkCloudinary(cloudinaryName, cloudinaryKey, cloudinarySecret));

    const settled = await Promise.allSettled(promises);
    for (const r of settled) {
      if (r.status === "fulfilled") results.push(r.value);
    }

    return new Response(JSON.stringify({ credits: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-credits error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
