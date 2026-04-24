import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env.functions") });

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));

const SUPABASE_ORIGIN = "https://fyfqyeouyxotohtxlbdg.supabase.co";

// ── helpers ─────────────────────────────────────────────────────────────────
const json = (res, data, status = 200) =>
  res.status(status).json(data);

const err = (res, msg, status = 500) =>
  res.status(status).json({ error: msg });

// ── Claude API — primary AI engine ───────────────────────────────────────────
async function claude(systemPrompt, userContent, { model = "claude-sonnet-4-6", maxTokens = 4096 } = {}) {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) throw new Error("חסר ANTHROPIC_API_KEY ב-.env.functions");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: "user", content: userContent }] }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Claude API error ${r.status}: ${t.slice(0, 200)}`);
  }
  const d = await r.json();
  return d.content?.[0]?.text || "";
}

// Fast Claude Haiku for simple/quick tasks
async function claudeFast(systemPrompt, userContent) {
  return claude(systemPrompt, userContent, { model: "claude-haiku-4-5-20251001", maxTokens: 2048 });
}

// Robust JSON extraction from any AI output
function extractJSON(text) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  // Try direct parse
  try { return JSON.parse(clean); } catch {}
  // Try finding first {...}
  const start = clean.indexOf("{");
  if (start !== -1) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < clean.length; i++) {
      const ch = clean[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(clean.slice(start, i + 1)); } catch {} } }
    }
  }
  throw new Error("לא הצלחתי לפרסר JSON מהתשובה");
}

// Legacy alias for existing endpoints that use aiChat
async function aiChat(systemPrompt, userContent) {
  return claude(systemPrompt, userContent, { model: "claude-haiku-4-5-20251001", maxTokens: 2048 });
}

// Krea: start job + poll until done
async function kreaGenerateImage(apiKey, prompt, options = {}) {
  const { width = 1024, height = 1024, imageUrls, model = "bfl/flux-1-dev" } = options;
  // Krea minimum is 512x512
  const safeW = Math.max(512, width);
  const safeH = Math.max(512, height);
  const payload = { prompt, width: safeW, height: safeH };
  if (imageUrls?.length) payload.imageUrls = imageUrls;
  const r = await fetch(`https://api.krea.ai/generate/image/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Krea start failed: ${r.status} ${await r.text()}`);
  const { job_id } = await r.json();
  // Poll up to 120s
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise(ok => setTimeout(ok, 3000));
    const pr = await fetch(`https://api.krea.ai/jobs/${job_id}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!pr.ok) throw new Error(`Krea poll failed: ${pr.status}`);
    const job = await pr.json();
    if (job.completed_at) {
      if (job.status === "completed") return job.result?.urls?.[0] || null;
      throw new Error(`Krea job failed: ${job.result?.error || job.status}`);
    }
  }
  throw new Error("Krea job timed out");
}

// ── HeyGen ──────────────────────────────────────────────────────────────────
app.post("/functions/v1/heygen-video", async (req, res) => {
  const KEY = process.env.HEYGEN_API_KEY;
  if (!KEY) return err(res, "HEYGEN_API_KEY חסר", 400);
  const { action, ...params } = req.body;
  const API = "https://api.heygen.com";
  const headers = { "X-Api-Key": KEY, "Content-Type": "application/json" };

  if (action === "create_video") {
    const { avatarId, script, voiceId, audioUrl, aspectRatio, avatarStyle } = params;
    const dim = aspectRatio === "9:16" ? { width: 1080, height: 1920 } : aspectRatio === "1:1" ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 };
    // Default Hebrew voice: first Hebrew voice in account
    const defaultVoice = "4ebba0f2f4944d2aa75d21552764c638";
    const voice = audioUrl ? { type: "audio", audio_url: audioUrl } : { type: "text", input_text: script, voice_id: voiceId || defaultVoice, speed: 1.0 };
    const resolvedAvatarId = (avatarId && avatarId !== "default") ? avatarId : "Abigail_expressive_2024112501";
    const r = await fetch(`${API}/v2/video/generate`, { method: "POST", headers, body: JSON.stringify({ video_inputs: [{ character: { type: "avatar", avatar_id: resolvedAvatarId, avatar_style: avatarStyle || "normal" }, voice }], dimension: dim }) });
    const d = await r.json();
    if (!r.ok || d?.error) return err(res, d?.error?.message || "שגיאה ביצירת סרטון");
    return json(res, { videoId: d.data?.video_id, status: "processing" });
  }

  if (action === "check_status") {
    const r = await fetch(`${API}/v1/video_status.get?video_id=${params.videoId}`, { headers: { "X-Api-Key": KEY } });
    const d = await r.json();
    const status = d.data?.status;
    return json(res, { status: status === "completed" ? "done" : status, videoUrl: d.data?.video_url || null, thumbnailUrl: d.data?.thumbnail_url || null, progress: status === "completed" ? 100 : status === "processing" ? 50 : 10 });
  }

  if (action === "list_avatars") {
    const r = await fetch(`${API}/v2/avatars`, { headers: { "X-Api-Key": KEY } });
    const d = await r.json();
    return json(res, { avatars: d.data?.avatars || [] });
  }

  if (action === "list_voices") {
    const r = await fetch(`${API}/v2/voices`, { headers: { "X-Api-Key": KEY } });
    const d = await r.json();
    return json(res, { voices: d.data?.voices || [] });
  }

  if (action === "get_quota") {
    const r = await fetch(`${API}/v2/user/remaining_quota`, { headers: { "X-Api-Key": KEY } });
    if (!r.ok) return json(res, { quota: { error: "לא ניתן לבדוק מכסה" } });
    const d = await r.json();
    return json(res, { quota: d.data || d || {} });
  }

  if (action === "health_check") {
    const r = await fetch(`${API}/v2/avatars`, { headers: { "X-Api-Key": KEY } });
    return json(res, { ok: r.ok, status: r.status });
  }

  return err(res, "פעולה לא מוכרת", 400);
});

// ── Runway ───────────────────────────────────────────────────────────────────
// Valid models (2026): gen3a_turbo | gen4.5 | kling3.0_pro | kling3.0_standard |
//                      klingO3_pro | klingO3_standard | seedance2 | veo3 | veo3.1 | veo3.1_fast
app.post("/functions/v1/runway-video", async (req, res) => {
  const KEY = process.env.RUNWAY_API_KEY;
  if (!KEY) return err(res, "RUNWAY_API_KEY חסר", 400);
  const { action, promptText, promptImage, model, duration, ratio, taskId } = req.body;
  const API = "https://api.dev.runwayml.com/v1";
  const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "X-Runway-Version": "2024-11-06" };
  const safePrompt = (promptText || "").replace(/\s+/g, " ").trim().slice(0, 950);

  const mapRunwayError = (status, text) => {
    if (text.includes("not enough credits") || text.includes("INSUFFICIENT")) return "אין מספיק קרדיטים ב-Runway. כנס ל-app.runwayml.com לרכישת קרדיטים.";
    if (status === 429) return "יותר מדי בקשות, נסה שוב בעוד רגע.";
    return `שגיאה ב-RunwayML [${status}]`;
  };

  if (action === "image_to_video") {
    if (!promptImage) return err(res, "חסר קישור לתמונה", 400);
    const validModel = ["gen4.5","seedance2","gen3a_turbo","klingO3_pro","klingO3_standard","veo3","veo3.1"].includes(model) ? model : "gen4.5";
    const r = await fetch(`${API}/image_to_video`, { method: "POST", headers, body: JSON.stringify({ model: validModel, promptImage, promptText: safePrompt, duration: duration || 5, ratio: ratio || "1280:720" }) });
    if (!r.ok) { const t = await r.text(); return err(res, mapRunwayError(r.status, t)); }
    const d = await r.json();
    return json(res, { taskId: d.id });
  }

  if (action === "text_to_video") {
    if (!safePrompt) return err(res, "חסר תיאור לסרטון", 400);
    const validModel = ["gen4.5","seedance2","gen3a_turbo","klingO3_pro","klingO3_standard","veo3","veo3.1"].includes(model) ? model : "gen4.5";
    const r = await fetch(`${API}/text_to_video`, { method: "POST", headers, body: JSON.stringify({ model: validModel, promptText: safePrompt, duration: duration || 5, ratio: ratio || "1280:720" }) });
    if (!r.ok) { const t = await r.text(); return err(res, mapRunwayError(r.status, t)); }
    const d = await r.json();
    return json(res, { taskId: d.id });
  }

  if (action === "check_status") {
    if (!taskId) return err(res, "חסר מזהה משימה", 400);
    const r = await fetch(`${API}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${KEY}`, "X-Runway-Version": "2024-11-06" } });
    if (!r.ok) { const t = await r.text(); return err(res, mapRunwayError(r.status, t)); }
    const d = await r.json();
    return json(res, { status: d.status, progress: d.progress || 0, resultUrl: d.output?.[0] || null, failureReason: d.failure || null });
  }

  return err(res, "פעולה לא מוכרת", 400);
});

// ── ElevenLabs TTS ───────────────────────────────────────────────────────────
app.post("/functions/v1/text-to-speech", async (req, res) => {
  const KEY = process.env.ELEVENLABS_API_KEY;
  if (!KEY) return err(res, "ELEVENLABS_API_KEY חסר", 400);
  const { text, voiceId, modelId, stability, similarityBoost, style } = req.body;
  if (!text) return err(res, "חסר טקסט", 400);
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId || "J1xFxuLLC179EfEjbCax"}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: modelId || "eleven_multilingual_v2", voice_settings: { stability: stability ?? 0.5, similarity_boost: similarityBoost ?? 0.75, style: style ?? 0, use_speaker_boost: true } }),
  });
  if (!r.ok) return err(res, `שגיאה ב-ElevenLabs [${r.status}]`);
  const buffer = Buffer.from(await r.arrayBuffer());
  res.set({ "Content-Type": "audio/mpeg", "Access-Control-Allow-Origin": "*" });
  return res.send(buffer);
});

// ── ElevenLabs Voices ────────────────────────────────────────────────────────
app.all("/functions/v1/voice-manager", async (req, res) => {
  const KEY = process.env.ELEVENLABS_API_KEY;
  if (!KEY) return err(res, "ELEVENLABS_API_KEY חסר", 400);
  const { action } = req.body || {};

  if (action === "list_voices" || req.method === "GET") {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": KEY } });
    const d = await r.json();
    return json(res, { voices: d.voices || [] });
  }
  return err(res, "פעולה לא מוכרת", 400);
});

// ── Krea Image ───────────────────────────────────────────────────────────────
app.post("/functions/v1/krea-image", async (req, res) => {
  const KEY = process.env.KREA_API_KEY;
  if (!KEY) return err(res, "KREA_API_KEY חסר", 400);
  const { prompt, imageUrls, aspectRatio, model } = req.body;
  const w = aspectRatio === "9:16" ? 720 : aspectRatio === "1:1" ? 1024 : 1280;
  const h = aspectRatio === "9:16" ? 1280 : aspectRatio === "1:1" ? 1024 : 720;
  try {
    const imgUrl = await kreaGenerateImage(KEY, prompt || "Professional high quality image", { width: w, height: h, imageUrls, model: model || "bfl/flux-1-dev" });
    if (!imgUrl) return err(res, "לא הצלחתי ליצור תמונה", 400);
    return json(res, { success: true, imageUrl: imgUrl });
  } catch (e) {
    return err(res, `שגיאה ב-Krea: ${e.message}`);
  }
});

// ── Generate Image ────────────────────────────────────────────────────────────
app.post("/functions/v1/generate-image", async (req, res) => {
  const KEY = process.env.KREA_API_KEY;
  if (!KEY) return err(res, "KREA_API_KEY חסר", 400);
  const { prompt, imageUrls, aspectRatio } = req.body;
  const w = aspectRatio === "9:16" ? 720 : aspectRatio === "1:1" ? 1024 : 1280;
  const h = aspectRatio === "9:16" ? 1280 : aspectRatio === "1:1" ? 1024 : 720;
  try {
    const imgUrl = await kreaGenerateImage(KEY, prompt || "Professional high quality image", { width: w, height: h, imageUrls });
    if (!imgUrl) return err(res, "לא הצלחתי ליצור תמונה", 400);
    return json(res, { imageUrl: imgUrl, text: "" });
  } catch (e) {
    return err(res, `שגיאה ב-Krea: ${e.message}`);
  }
});

// ── Krea Video ────────────────────────────────────────────────────────────────
app.post("/functions/v1/krea-video", async (req, res) => {
  const KEY = process.env.KREA_API_KEY;
  if (!KEY) return err(res, "KREA_API_KEY חסר", 400);
  const { action, prompt, imageUrl, model, duration, fps, taskId, motionStrength } = req.body;

  // Check job status
  if (action === "check_status" && taskId) {
    try {
      const r = await fetch(`https://api.krea.ai/jobs/${taskId}`, {
        headers: { Authorization: `Bearer ${KEY}` }
      });
      if (!r.ok) return err(res, `שגיאה בבדיקת סטטוס: ${r.status}`);
      const job = await r.json();
      const done = !!job.completed_at;
      return json(res, {
        status: done ? (job.status === "completed" ? "done" : "failed") : "processing",
        resultUrl: job.result?.urls?.[0] || null,
        jobId: job.job_id,
        failureReason: job.result?.error || null
      });
    } catch (e) { return err(res, e.message); }
  }

  // Valid Krea video models (2026)
  const validModels = ["kling/kling-2.5","kling/kling-2.1","kling/kling-1.6","kling/kling-1.5","kling/kling-2.6"];
  const chosenModel = validModels.includes(model) ? model : "kling/kling-2.5";

  const payload = { prompt: (prompt || "").slice(0, 950), duration: duration || 5, fps: fps || 24 };
  if (imageUrl) payload.image_url = imageUrl;
  if (motionStrength !== undefined) payload.motion_strength = motionStrength;

  try {
    const r = await fetch(`https://api.krea.ai/generate/video/${chosenModel}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const d = await r.json();

    if (d.message === "INSUFFICIENT_BALANCE") {
      return err(res, "אין קרדיטים API ל-Krea וידאו. רכוש Compute Pack ב: krea.ai → Settings → Billing → Compute Packs", 402);
    }
    if (!r.ok) return err(res, `שגיאה ב-Krea וידאו: ${d.message || r.status}`);

    return json(res, { taskId: d.job_id, status: "processing" });
  } catch (e) { return err(res, e.message); }
});

// ── Generate Avatar ───────────────────────────────────────────────────────────
app.post("/functions/v1/generate-avatar", async (req, res) => {
  const KEY = process.env.KREA_API_KEY;
  if (!KEY) return err(res, "KREA_API_KEY חסר", 400);
  const { imageUrls, style, expression, baseAvatarUrl } = req.body;
  const refUrls = [baseAvatarUrl, ...(imageUrls || [])].filter(Boolean);
  const styleText = style || "professional studio headshot";
  const expText = expression === "smile" ? "warm genuine smile" : expression === "serious" ? "serious confident look" : "neutral resting face";
  const prompt = `Portrait of a person. Expression: ${expText}. Style: ${styleText}. Professional high quality image, studio lighting.`;
  try {
    const imgUrl = await kreaGenerateImage(KEY, prompt, { width: 1024, height: 1024, imageUrls: refUrls.slice(0, 3) });
    if (!imgUrl) return err(res, "שגיאה ביצירת אווטאר", 400);
    return json(res, { imageUrl: imgUrl, faceDescription: "" });
  } catch (e) {
    return err(res, `שגיאה ב-Krea: ${e.message}`);
  }
});

// ── Generate Script ───────────────────────────────────────────────────────────
app.post("/functions/v1/generate-script", async (req, res) => {
  const { prompt, avatarNames, voiceNames, brandContext, hasImages, videoStyle, websiteUrl, websiteContext, hasScreenshot, targetDurationSec, videoType } = req.body;
  if (!prompt?.trim()) return err(res, "יש להזין תיאור לסרטון", 400);

  const dur = (typeof targetDurationSec === "number" && targetDurationSec > 0) ? targetDurationSec : 60;
  const sceneCount = Math.max(3, Math.min(60, Math.round(dur / 10)));
  const minScenes = Math.max(3, sceneCount - 2);
  const maxScenes = sceneCount + 2;

  const fmtDur = (s) => { const m = Math.floor(s/60), r = s%60; if (!m) return `${r} שניות`; if (!r) return `${m} דקות`; return `${m}:${String(r).padStart(2,"0")} דקות`; };

  const styleMap = {
    cinematic: "סגנון קולנועי ריאליסטי — אנשים אמיתיים, לוקיישנים אמיתיים, תאורה דרמטית כמו בסרט הוליוודי. צלם כאילו יש צוות הפקה מלא עם מצלמות RED.",
    disney: "סגנון אנימציה תלת-ממדית איכותית ברמת Pixar/DreamWorks — דמויות עם עיניים גדולות נוצצות, שיער מפורט, תאורה Volumetric, עקביות מלאה בין הסצנות.",
    anime: "סגנון אנימה יפני — קווי מתאר ברורים, עיניים גדולות, שיער דינמי, אפקטי אור ניצוצות, רקעים מפורטים. מזכיר Studio Ghibli.",
    cartoon: "סגנון קריקטורה / איור — דמויות מצוירות ביד, קווים עבים, צבעים שטוחים בוהקים, הגזמה בתנועות. כמו קומיקס אמריקאי.",
    documentary: "סגנון דוקומנטרי — צילום טבעי, תאורה אמביינטית, מצלמה ביד, ראיונות עם bokeh, טקסט עם שם ותפקיד. מרגיש אמיתי ואותנטי.",
    commercial: "סגנון פרסומת טלוויזיה — הפקה מבריקה, תאורת סטודיו מושלמת, צבעים חיים, תנועות מצלמה חלקות. הכל נקי, חד, מלוטש.",
  };
  const chosenStyle = styleMap[videoStyle || "cinematic"] || styleMap.cinematic;

  const avatarCtx = avatarNames?.length ? `\nאווטארים זמינים: ${avatarNames.join(", ")} — שלב אותם כדוברים.` : "";
  const voiceCtx = voiceNames?.length ? `\nקולות זמינים: ${voiceNames.join(", ")} — ציין בכל סצנה מי הדובר.` : "";
  const imgCtx = hasImages ? `\nיש תמונות/לוגו שהועלו — שלב אותם. הלוגו חייב להופיע בפתיחה ובסיום.` : "";
  const brandCtx = brandContext ? `\nמותג: ${brandContext} — חובה לשלב שם המותג ומסרו בתסריט.` : "";
  const webCtx = websiteContext ? `\n## מידע מהאתר (${websiteUrl || ""})\nחובה לשלב את התוכן, הצבעים והמסרים מהאתר:\n${websiteContext}${hasScreenshot ? "\nיש צילום מסך — שלב סצנה שמציגה את האתר על מסך." : ""}` : "";
  const typeNote = videoType === "podcast" ? "זהו פודקאסט/Talking Head — טון שיחתי, קריינות עם B-Roll תומך." : videoType === "episode" ? "זוהי אפיזודה AI — קשר נרטיבי בין הסצנות, תחושת סדרה." : "";

  const systemPrompt = `אתה במאי קולנוע ותסריטאי וידאו ברמה עולמית. אתה יוצר תסריטים קולנועיים מרהיבים — כמו סרט קצר מקצועי או פרסומת ברמת הוליווד.

## סגנון ויזואלי
${chosenStyle}
חובה: כל תיאור ויזואלי בסגנון הזה בלבד.

## עיקרון — התאמה מלאה לתחום הפעילות
זהה את התחום מהתיאור והתאם בימוי, סצנות, רקעים, דמויות ואווירה.
דוגמאות: ילדים→הורים/גני שעשועים | עסקים→משרדים מודרניים | אוכל→מטבח פעיל | נדל"ן→דירות מעוצבות | טכנולוגיה→מסכים/קוד | ספורט→אנרגיה גבוהה

## מבנה הסרטון
- ${minScenes}–${maxScenes} סצנות, כל סצנה 10 שניות בדיוק
- סך הכל: ${fmtDur(dur)} (${dur} שניות)
- ${typeNote || "מבנה שיווקי: Hook → תוכן → CTA"}
- אל תעצור מוקדם — מלא בתוכן: יתרונות, המלצות, שאלות נפוצות, before/after
${avatarCtx}${voiceCtx}${imgCtx}${brandCtx}${webCtx}

החזר JSON בלבד (ללא markdown):
{
  "title": "שם הסרטון",
  "duration": <שניות כפולת 10>,
  "script": "הטקסט המלא הרציף של כל הסצנות",
  "scenes": [{
    "id": 1,
    "title": "שם הסצנה",
    "speaker": "קריין",
    "spokenText": "2-3 משפטים מלאים שמתאימים ל-10 שניות דיבור בעברית שוטפת",
    "visualDescription": "בימוי מפורט: פריים פתיחה, דמות מרכזית, פעולה, Foreground/Midground/Background, תאורה, צבעים, טקסטורות, תנועת מצלמה",
    "backgroundAction": "5 אלמנטים דינמיים ברקע: אנשים בתנועה, אינטראקציות, אלמנטים סביבתיים, חיות, מוצרים",
    "cameraDirection": "Wide Shot → Dolly In / Close-Up / Tracking Shot / Drone",
    "environment": "תיאור מפורט: חלל, ריהוט, תאורה, אווירה, עונה, שעה",
    "characters": "גיל, מראה, ביגוד, הבעה, תנוחה, פעולה של כל דמות",
    "subtitleText": "כתובית 6-10 מילים",
    "icons": ["🎬","✨"],
    "duration": 10,
    "transition": "fade",
    "videoStyle": "${videoStyle || "cinematic"}"
  }],
  "style": { "tone": "...", "pace": "...", "music": "...", "cinematicStyle": "${videoStyle || "cinematic"}" }
}`;

  // ~600 tokens per scene (rich descriptions), min 2500, cap 8000
  const tokenBudget = Math.min(8000, Math.max(2500, maxScenes * 600));

  try {
    const raw = await claude(systemPrompt, prompt, { maxTokens: tokenBudget });
    let parsed;
    try { parsed = extractJSON(raw); } catch {
      // fallback: build from text
      const chunks = prompt.split(/[.!?]/).filter(s => s.trim().length > 5).slice(0, maxScenes);
      const fb = chunks.length >= 2 ? chunks : [prompt];
      parsed = {
        title: "תסריט וידאו", duration: fb.length * 10, script: prompt,
        scenes: fb.map((t, i) => ({ id: i+1, title: `סצנה ${i+1}`, speaker: "קריין", spokenText: t.trim(), visualDescription: "סצנה קולנועית מקצועית עם תאורה דרמטית ועומק שדה.", backgroundAction: "תנועה טבעית של אנשים ואלמנטים סביבתיים.", cameraDirection: "Wide Shot → Close-Up", environment: "סביבה מקצועית מותאמת לנושא", characters: "דמות מרכזית עם הבעה אותנטית", subtitleText: t.trim().slice(0,64), icons: ["🎬","✨"], duration: 10, transition: "fade", videoStyle: videoStyle || "cinematic" })),
        style: { tone: "מקצועי", pace: "בינוני", music: "מוזיקה מותאמת לתחום", cinematicStyle: videoStyle || "cinematic" }
      };
    }

    // Normalize scenes
    if (Array.isArray(parsed.scenes)) {
      parsed.scenes = parsed.scenes.filter(s => s?.spokenText?.trim()).map((s, i) => ({
        id: i+1, title: s.title || `סצנה ${i+1}`, speaker: s.speaker || "קריין",
        spokenText: s.spokenText.trim(),
        visualDescription: s.visualDescription?.length >= 80 ? s.visualDescription : `סצנה ${i+1} — ${s.spokenText.slice(0,60)}. תאורה קולנועית מקצועית עם עומק שדה ותנועה טבעית בפריים.`,
        backgroundAction: s.backgroundAction || "תנועה דינמית טבעית של אנשים ואלמנטים סביבתיים.",
        cameraDirection: s.cameraDirection || "Wide Shot → Dolly In → Close-Up",
        environment: s.environment || "סביבה מקצועית מותאמת לתחום",
        characters: s.characters || "דמות מרכזית אותנטית עם שפת גוף טבעית",
        subtitleText: (s.subtitleText || s.spokenText).slice(0,64),
        icons: Array.isArray(s.icons) && s.icons.length ? s.icons : ["🎬","✨"],
        duration: 10, transition: s.transition || "fade", videoStyle: videoStyle || "cinematic"
      }));
    }

    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      return err(res, "לא הצלחתי לייצר סצנות — נסה שוב");
    }
    parsed.duration = parsed.scenes.length * 10;
    if (!parsed.script?.trim()) parsed.script = parsed.scenes.map(s => s.spokenText).join(" ");
    if (!parsed.title?.trim()) parsed.title = "תסריט וידאו";

    return json(res, parsed);
  } catch (e) {
    return err(res, e.message || "שגיאה בשירות ה-AI");
  }
});

// ── Enhance Prompt ────────────────────────────────────────────────────────────
app.post("/functions/v1/enhance-prompt", async (req, res) => {
  const { text, type } = req.body;
  if (!text?.trim()) return err(res, "יש להזין טקסט", 400);

  const enhanceSystem = `אתה מומחה שיווק ותוכן וידאו בעברית. תפקידך לקחת רעיון גולמי ולהפוך אותו לבריף מקצועי ומסודר ליצירת סרטון.

החזר JSON בלבד (ללא טקסט נוסף):
{"enhanced":"הבריף המשופר עם מבנה של הוק, גוף, הוכחה חברתית וקריאה לפעולה","variations":[{"type":"גרסת מכירה","text":"..."},{"type":"גרסת UGC","text":"..."},{"type":"גרסת תוכן אישי","text":"..."}]}

הנחיות:
- כתוב בעברית מקצועית טבעית — כמו קופירייטר ישראלי מנוסה, לא תרגום מאנגלית
- השתמש בביטויים ישראליים אותנטיים
- גרסת מכירה: ישירה, CTA חזק, דחיפות — בשפה שמוכרת בישראל
- גרסת UGC: אותנטית, גוף ראשון, כאילו מישהו מספר לחבר בוואטסאפ
- גרסת תוכן אישי: אישית, מעוררת השראה, סיפור אמיתי
- הבריף המשופר: הוק תופס → בעיה + פתרון → הוכחה חברתית → CTA
- שמות מוצרים/מותגים באנגלית — השאר אותם כמו שהם`;

  const scriptSystem = `אתה כותב תסריטים מקצועי לסרטוני וידאו בעברית.

החזר JSON בלבד:
{"script":"התסריט המלא","scenes":[{"title":"שם הסצנה","spokenText":"מה נאמר — 2-3 משפטים טבעיים","visualDescription":"מה רואים בסצנה","duration":10}]}

הנחיות:
- עברית ישראלית טבעית כמו שאדם מדבר, לא כמו תרגום
- משפטים קצרים, מתאימים לדיבור מול מצלמה
- פתיח ב-3 שניות שתופס תשומת לב
- סיום עם CTA ברור`;

  try {
    const raw = await claude(type === "script" ? scriptSystem : enhanceSystem, text, { maxTokens: 3000 });
    try { return json(res, extractJSON(raw)); }
    catch { return json(res, type === "script" ? { script: raw, scenes: [] } : { enhanced: raw, variations: [] }); }
  } catch (e) {
    return err(res, e.message || "שגיאה בשירות ה-AI");
  }
});

// ── ElevenLabs Clone Voice TTS ────────────────────────────────────────────────
app.post("/functions/v1/clone-voice-tts", async (req, res) => {
  const KEY = process.env.ELEVENLABS_API_KEY;
  if (!KEY) return err(res, "ELEVENLABS_API_KEY חסר", 400);
  const { text, voiceId, modelId } = req.body;
  if (!text || !voiceId) return err(res, "חסר טקסט או voiceId", 400);
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: modelId || "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (!r.ok) return err(res, `שגיאה ב-ElevenLabs [${r.status}]`);
  const buffer = Buffer.from(await r.arrayBuffer());
  res.set({ "Content-Type": "audio/mpeg", "Access-Control-Allow-Origin": "*" });
  return res.send(buffer);
});

// ── ElevenLabs Music ─────────────────────────────────────────────────────────
app.post("/functions/v1/elevenlabs-music", async (req, res) => {
  const KEY = process.env.ELEVENLABS_API_KEY;
  if (!KEY) return err(res, "ELEVENLABS_API_KEY חסר", 400);
  const { action, text, voiceId, modelId, audioUrl, language } = req.body;
  const headers = { "xi-api-key": KEY, "Content-Type": "application/json" };

  if (action === "text_to_speech" || action === "generate") {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId || "J1xFxuLLC179EfEjbCax"}`, {
      method: "POST", headers,
      body: JSON.stringify({ text: text || "", model_id: modelId || "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!r.ok) return err(res, `שגיאה ב-ElevenLabs [${r.status}]`);
    const buffer = Buffer.from(await r.arrayBuffer());
    res.set({ "Content-Type": "audio/mpeg", "Access-Control-Allow-Origin": "*" });
    return res.send(buffer);
  }

  if (action === "list_voices") {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers });
    const d = await r.json();
    return json(res, { voices: d.voices || [] });
  }

  if (action === "transcribe" || action === "speech_to_text") {
    if (!audioUrl) return err(res, "חסר audioUrl", 400);
    const audioRes = await fetch(audioUrl);
    const audioBuffer = await audioRes.arrayBuffer();
    const formData = new FormData();
    formData.append("audio", new Blob([audioBuffer], { type: "audio/mpeg" }), "audio.mp3");
    formData.append("model_id", "scribe_v1");
    if (language) formData.append("language_code", language);
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": KEY }, body: formData });
    if (!r.ok) return err(res, `שגיאה בתמלול [${r.status}]`);
    const d = await r.json();
    return json(res, { text: d.text || "", words: d.words || [] });
  }

  return err(res, "פעולה לא מוכרת", 400);
});

// ── Transcribe Audio ──────────────────────────────────────────────────────────
app.post("/functions/v1/transcribe-audio", async (req, res) => {
  const KEY = process.env.ELEVENLABS_API_KEY;
  if (!KEY) return err(res, "ELEVENLABS_API_KEY חסר", 400);
  const { audioUrl, language } = req.body;
  if (!audioUrl) return err(res, "חסר audioUrl", 400);
  const audioRes = await fetch(audioUrl);
  const audioBuffer = await audioRes.arrayBuffer();
  const formData = new FormData();
  formData.append("audio", new Blob([audioBuffer], { type: "audio/mpeg" }), "audio.mp3");
  formData.append("model_id", "scribe_v1");
  if (language) formData.append("language_code", language);
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": KEY }, body: formData });
  if (!r.ok) return err(res, `שגיאה בתמלול [${r.status}]`);
  const d = await r.json();
  return json(res, { text: d.text || "", words: d.words || [], language: d.language || language });
});

// ── Fetch Trends ──────────────────────────────────────────────────────────────
app.post("/functions/v1/fetch-trends", async (req, res) => {
  const { platform = "TikTok", category = "כללי", count = 8 } = req.body;

  const systemPrompt = `אתה מומחה לתוכן ויראלי ברשתות חברתיות בישראל ובעולם.
תפקידך ליצור רשימת טרנדים שמשרתת יוצרי תוכן ישראלים.
החזר JSON תקין בלבד — ללא הסברים, ללא markdown.`;

  const userPrompt = `צור ${count} טרנדים לתוכן וידאו בתחום "${category}" לפלטפורמת ${platform}.

לכל טרנד ספק:
- title: כותרת מושכת בעברית
- description: מה התוכן ולמה הוא עובד (2-3 משפטים)
- platform: "${platform}"
- category: "${category}"
- visualStyle: סגנון ויזואלי מומלץ (cinematic/anime/ugc/documentary)
- contentHook: הוק פתיחה לדוגמה בעברית
- scriptIdea: רעיון תסריט קצר בעברית
- engagementScore: ציון 7-10
- tags: מערך של 3-5 תגיות רלוונטיות

פורמט: {"trends":[{...}]}`;

  try {
    const raw = await claudeFast(systemPrompt, userPrompt);
    try { return json(res, extractJSON(raw)); }
    catch { return json(res, { trends: [] }); }
  } catch (e) {
    return err(res, e.message || "שגיאה בשירות הטרנדים");
  }
});

app.post("/functions/v1/auto-fetch-trends", async (req, res) => {
  const categories = ["עולם עסקי", "נדל\"ן", "טכנולוגיה", "אופנה ויופי", "בריאות וכושר"];
  const cat = req.body?.category;
  const toFetch = cat && cat !== "all" ? [cat] : categories;
  const results = {};
  await Promise.all(toFetch.map(async (c) => {
    try {
      const raw = await claudeFast(
        "אתה מומחה לתוכן ויראלי. החזר JSON תקין בלבד.",
        `צור 5 טרנדים לתוכן וידאו בתחום "${c}". פורמט: {"trends":[{"title":"...","description":"...","platform":"TikTok","category":"${c}","visualStyle":"...","contentHook":"...","engagementScore":8,"tags":[]}]}`
      );
      results[c] = extractJSON(raw).trends || [];
    } catch { results[c] = []; }
  }));
  const allTrends = Object.values(results).flat();
  return json(res, { trends: allTrends, byCategory: results });
});

// ── Check Credits ─────────────────────────────────────────────────────────────
app.post("/functions/v1/check-credits", async (req, res) => {
  const results = await Promise.all([
    // HeyGen
    (async () => {
      const k = process.env.HEYGEN_API_KEY;
      if (!k) return { service: "heygen", readiness: "not_configured", canGenerate: false, statusLabel: "לא מוגדר", credits: 0 };
      try {
        const r = await fetch("https://api.heygen.com/v2/user/remaining_quota", { headers: { "X-Api-Key": k } });
        const d = await r.json();
        const credits = d?.data?.remaining_quota ?? 0;
        return { service: "heygen", readiness: credits > 0 ? "credits_ok" : "no_credits", authValid: r.ok, canGenerate: credits > 0, credits, statusLabel: credits > 0 ? `✅ ${credits} קרדיטים` : "⚠️ אין קרדיטים" };
      } catch { return { service: "heygen", readiness: "error", canGenerate: false, statusLabel: "שגיאה" }; }
    })(),
    // ElevenLabs
    (async () => {
      const k = process.env.ELEVENLABS_API_KEY;
      if (!k) return { service: "elevenlabs", readiness: "not_configured", canGenerate: false, statusLabel: "לא מוגדר" };
      try {
        const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": k } });
        const d = await r.json();
        const used = d?.character_count ?? 0, total = d?.character_limit ?? 1;
        const pct = Math.round(used/total*100);
        const ok = used < total;
        return { service: "elevenlabs", readiness: ok ? "credits_ok" : "no_credits", authValid: r.ok, canGenerate: ok, statusLabel: ok ? `✅ ${total-used} תווים נותרו (${100-pct}%)` : "⚠️ מכסה מלאה", characterCount: used, characterLimit: total };
      } catch { return { service: "elevenlabs", readiness: "error", canGenerate: false, statusLabel: "שגיאה" }; }
    })(),
    // Runway
    (async () => {
      const k = process.env.RUNWAY_API_KEY;
      if (!k) return { service: "runway", readiness: "not_configured", canGenerate: false, statusLabel: "לא מוגדר" };
      try {
        const r = await fetch("https://api.dev.runwayml.com/v1/organization", { headers: { Authorization: `Bearer ${k}`, "X-Runway-Version": "2024-11-06" } });
        const d = await r.json();
        const credits = d?.creditBalance ?? 0;
        const ok = credits >= 50;
        return { service: "runway", readiness: ok ? "credits_ok" : "low_credits", authValid: r.ok, canGenerate: ok, credits, statusLabel: ok ? `✅ ${credits} קרדיטים` : `⚠️ ${credits} קרדיטים (צריך לפחות 50)` };
      } catch { return { service: "runway", readiness: "error", canGenerate: false, statusLabel: "שגיאה" }; }
    })(),
    // Krea
    (async () => {
      const k = process.env.KREA_API_KEY;
      if (!k) return { service: "krea", readiness: "not_configured", canGenerate: false, statusLabel: "לא מוגדר" };
      try {
        // Test image generation (works with subscription)
        const r = await fetch("https://api.krea.ai/jobs?limit=1", { headers: { Authorization: `Bearer ${k}` } });
        const imageOk = r.ok;
        // Test video generation (requires Compute Pack)
        const vr = await fetch("https://api.krea.ai/generate/video/kling/kling-2.5", {
          method: "POST", headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "test", duration: 5 })
        });
        const vd = await vr.json();
        const videoOk = vd.message !== "INSUFFICIENT_BALANCE" && !vd.message?.includes("not found");
        return {
          service: "krea", authValid: imageOk, canGenerate: imageOk,
          readiness: imageOk ? "credits_ok" : "auth_failed",
          statusLabel: imageOk
            ? (videoOk ? "✅ תמונות + וידאו" : "✅ תמונות | ⚠️ וידאו — נדרש Compute Pack")
            : "שגיאת אימות"
        };
      } catch { return { service: "krea", readiness: "error", canGenerate: false, statusLabel: "שגיאה" }; }
    })(),
    // Shotstack
    (async () => {
      const k = process.env.SHOTSTACK_API_KEY;
      if (!k) return { service: "shotstack", readiness: "not_configured", canGenerate: false, statusLabel: "לא מוגדר" };
      try {
        const r = await fetch("https://api.shotstack.io/v1/templates", { headers: { "x-api-key": k } });
        return { service: "shotstack", readiness: r.ok ? "credits_ok" : "auth_failed", authValid: r.ok, canGenerate: r.ok, statusLabel: r.ok ? "✅ מחובר" : "שגיאת אימות" };
      } catch { return { service: "shotstack", readiness: "error", canGenerate: false, statusLabel: "שגיאה" }; }
    })(),
    // Claude / Anthropic
    (async () => {
      const k = process.env.ANTHROPIC_API_KEY;
      if (!k) return { service: "claude", readiness: "not_configured", canGenerate: false, statusLabel: "לא מוגדר" };
      return { service: "claude", readiness: "credits_ok", authValid: true, canGenerate: true, statusLabel: "✅ מחובר (Claude Sonnet)" };
    })(),
  ]);
  return json(res, { providers: results });
});

// ── Provider Balances ─────────────────────────────────────────────────────────
app.post("/functions/v1/provider-balances", async (req, res) => {
  return res.redirect(307, "/functions/v1/check-credits");
});

// ── Scrape Website ────────────────────────────────────────────────────────────
app.post("/functions/v1/scrape-website-content", async (req, res) => {
  const { url } = req.body;
  if (!url) return err(res, "חסר URL", 400);
  let html = "";
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" } });
    html = await r.text();
    html = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, 8000);
  } catch {
    return err(res, "לא ניתן להגיע לאתר");
  }
  try {
    const raw = await claude(
      `אתה מומחה שיווק ישראלי. נתח תוכן אתר ותחזיר JSON תקין בלבד.
פורמט:
{
  "mainHeadline": "כותרת ראשית",
  "subheadline": "תת-כותרת",
  "valueProposition": "הצעת הערך המרכזית",
  "targetAudience": "קהל היעד",
  "tone": "טון המסר",
  "bullets": ["יתרון 1","יתרון 2","יתרון 3"],
  "ctas": ["קריאה לפעולה 1","קריאה לפעולה 2"],
  "keywords": ["מילת מפתח 1","מילת מפתח 2","מילת מפתח 3"],
  "videoScriptIdea": "רעיון לתסריט סרטון בעברית המבוסס על האתר",
  "brandColors": "תיאור פלטת הצבעים אם ניתן לזהות"
}`,
      `נתח את תוכן האתר הבא ותחזיר JSON:\n\n${html}`
    );
    try { return json(res, { success: true, content: extractJSON(raw), sourceUrl: url }); }
    catch { return json(res, { success: true, content: null, sourceUrl: url }); }
  } catch {
    return json(res, { success: true, content: null, sourceUrl: url });
  }
});

// ── AI Prompt Booster (visual prompts for Krea/Runway) ───────────────────────
app.post("/functions/v1/boost-prompt", async (req, res) => {
  const { prompt, type = "image", style, targetPlatform } = req.body;
  if (!prompt?.trim()) return err(res, "חסר prompt", 400);

  const systemPrompt = type === "video"
    ? `אתה מומחה ל-prompt engineering לסרטוני AI (Runway, Krea).
הפוך prompt קצר לתיאור קולנועי מפורט באנגלית שמניב תוצאות מרהיבות.
החזר JSON: {"boosted":"...", "negative":"...", "cameraMotion":"...", "mood":"..."}`
    : `אתה מומחה ל-prompt engineering לתמונות AI (Flux, Midjourney, DALL-E).
הפוך תיאור קצר ל-prompt מקצועי מפורט באנגלית שמניב תמונות ברמת פרסומת.
החזר JSON: {"boosted":"...", "negative":"...", "style":"...", "lighting":"...", "aspectRatio":"16:9"}`;

  try {
    const raw = await claudeFast(systemPrompt, `Prompt: ${prompt}\nStyle: ${style || "cinematic"}\nPlatform: ${targetPlatform || "general"}`);
    try { return json(res, extractJSON(raw)); }
    catch { return json(res, { boosted: raw, negative: "" }); }
  } catch (e) {
    return err(res, e.message || "שגיאה");
  }
});

// ── AI Caption Generator ──────────────────────────────────────────────────────
app.post("/functions/v1/generate-caption", async (req, res) => {
  const { script, platform = "Instagram", brand, tone = "מקצועי" } = req.body;
  if (!script?.trim()) return err(res, "חסר תסריט/תוכן", 400);

  try {
    const raw = await claudeFast(
      `אתה קופירייטר ישראלי מוביל. כתוב קפשן לרשתות חברתיות.
החזר JSON: {"caption":"...","hashtags":["..."],"cta":"...","shortVersion":"..."}`,
      `פלטפורמה: ${platform}\nמותג: ${brand || "לא צוין"}\nטון: ${tone}\nתוכן: ${script.slice(0, 1000)}`
    );
    try { return json(res, extractJSON(raw)); }
    catch { return json(res, { caption: raw, hashtags: [], cta: "" }); }
  } catch (e) {
    return err(res, e.message || "שגיאה");
  }
});

// ── Auth Gate ─────────────────────────────────────────────────────────────────
app.all("/functions/v1/auth-gate", (req, res) => {
  return json(res, { authenticated: true, user: null });
});

// ── Storage Manager (Cloudinary or Supabase Storage fallback) ─────────────────
app.post("/functions/v1/storage-manager", async (req, res) => {
  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
  const CLOUD_KEY = process.env.CLOUDINARY_API_KEY;
  const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET;
  const { action, fileUrl, fileName, folder } = req.body;

  if (!CLOUD_NAME || !CLOUD_KEY || !CLOUD_SECRET) {
    // Return original URL as fallback when Cloudinary not configured
    return json(res, { url: fileUrl || null, message: "Cloudinary לא מוגדר — השתמש ב-URL המקורי" });
  }

  if (action === "upload" && fileUrl) {
    const { createHash, createHmac } = await import("crypto");
    const timestamp = Math.floor(Date.now() / 1000);
    const params = `folder=${folder || "studio"}&timestamp=${timestamp}&upload_preset=ml_default`;
    const signature = createHash("sha256").update(params + CLOUD_SECRET).digest("hex");
    const formData = new FormData();
    formData.append("file", fileUrl);
    formData.append("timestamp", timestamp.toString());
    formData.append("api_key", CLOUD_KEY);
    formData.append("signature", signature);
    formData.append("folder", folder || "studio");
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: "POST", body: formData });
    if (!r.ok) return err(res, "שגיאה בהעלאה ל-Cloudinary");
    const d = await r.json();
    return json(res, { url: d.secure_url, publicId: d.public_id });
  }

  return err(res, "פעולה לא מוכרת", 400);
});

// ── Data Manager ──────────────────────────────────────────────────────────────
app.all("/functions/v1/data-manager", (req, res) => json(res, { ok: true }));

// ── Avatar Manager ────────────────────────────────────────────────────────────
app.all("/functions/v1/avatar-manager", (req, res) => json(res, { avatars: [] }));

// ── Import URL ────────────────────────────────────────────────────────────────
app.post("/functions/v1/import-url", async (req, res) => {
  const { url } = req.body;
  if (!url) return err(res, "חסר URL", 400);
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const contentType = r.headers.get("content-type") || "";
    if (contentType.includes("image") || contentType.includes("video") || contentType.includes("audio")) {
      return json(res, { url, contentType, imported: true });
    }
    return json(res, { url, contentType, imported: false, error: "סוג קובץ לא נתמך" });
  } catch (e) {
    return err(res, "לא ניתן לגשת ל-URL");
  }
});

// ── Compose Video (Shotstack) ─────────────────────────────────────────────────
app.post("/functions/v1/compose-video", async (req, res) => {
  const KEY = process.env.SHOTSTACK_API_KEY;
  if (!KEY) return err(res, "SHOTSTACK_API_KEY חסר", 400);
  const { timeline, output } = req.body;
  if (!timeline) return err(res, "חסר timeline", 400);
  const r = await fetch("https://api.shotstack.io/v1/render", {
    method: "POST",
    headers: { "x-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ timeline, output: output || { format: "mp4", resolution: "hd" } }),
  });
  if (!r.ok) { const t = await r.text(); return err(res, `שגיאה ב-Shotstack: ${t.slice(0, 200)}`); }
  const d = await r.json();
  return json(res, { renderId: d.response?.id, status: "queued" });
});

// ── Proxy everything else to Supabase ─────────────────────────────────────────
app.use(
  createProxyMiddleware({
    target: SUPABASE_ORIGIN,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader("host", "fyfqyeouyxotohtxlbdg.supabase.co");
      },
    },
  })
);

const PORT = process.env.SERVER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Studio AI Local Server running on http://localhost:${PORT}`);
  console.log(`   → Functions: http://localhost:${PORT}/functions/v1/`);
  console.log(`   → DB proxy: Supabase (${SUPABASE_ORIGIN})`);
});
