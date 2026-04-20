const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KREA_API = 'https://api.krea.ai';

// ===== IMAGE MODELS =====
const IMAGE_MODELS: Record<string, string> = {
  flux: 'bfl/flux-1-dev',
  'nano-banana-pro': 'google/nano-banana-pro',
  'seedream-4': 'bytedance/seedream-4',
  'chatgpt-image': 'openai/chatgpt-image',
};

// ===== VIDEO MODELS =====
const VIDEO_MODELS: Record<string, string> = {
  'veo-3': 'google/veo-3',
  'veo-3.1': 'google/veo-3.1',
  'kling-2.5': 'kling/kling-2.5',
  'hailuo-2.3': 'minimax/hailuo-2.3',
  'wan-2.5': 'alibaba/wan-2.5',
};

// ===== UPSCALE MODELS =====
const UPSCALE_MODELS: Record<string, string> = {
  standard: 'topaz/standard',
  bloom: 'topaz/bloom',
  generative: 'topaz/generative',
};

async function pollJob(jobId: string, apiToken: string, maxWaitMs = 120000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${KREA_API}/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });
    if (!res.ok) throw new Error(`Job poll failed: ${res.status}`);
    const job = await res.json();

    if (job.completed_at) {
      if (job.status === 'completed') return job.result;
      throw new Error(`Job ${job.status}: ${job.result?.error || 'Unknown error'}`);
    }

    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Job timed out');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiToken = Deno.env.get('KREA_API_KEY');
    if (!apiToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'KREA_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // === GENERATE IMAGE ===
    if (action === 'generate') {
      const { prompt, model = 'flux', width = 1024, height = 1024, imageUrls, steps } = body;
      if (!prompt) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing prompt' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const modelPath = IMAGE_MODELS[model] || IMAGE_MODELS.flux;
      const payload: any = { prompt, width, height };
      if (steps) payload.steps = steps;
      if (imageUrls && imageUrls.length > 0) payload.imageUrls = imageUrls;

      console.log(`Krea generate image: model=${modelPath}`);
      const res = await fetch(`${KREA_API}/generate/image/${modelPath}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Krea generate error:', res.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Krea API error: ${res.status}` }),
          { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const job = await res.json();
      const result = await pollJob(job.job_id, apiToken);
      return new Response(
        JSON.stringify({ success: true, imageUrl: result.urls?.[0] || null, jobId: job.job_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === GENERATE VIDEO ===
    if (action === 'generate_video') {
      const { prompt, model = 'kling-2.5', width = 1280, height = 720, duration = 5, fps = 24, imageUrl } = body;
      if (!prompt) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing prompt' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const modelPath = VIDEO_MODELS[model] || VIDEO_MODELS['kling-2.5'];
      const payload: any = { prompt, width, height, duration, fps };
      if (imageUrl) payload.imageUrl = imageUrl; // Image-to-video

      console.log(`Krea generate video: model=${modelPath}, duration=${duration}s`);
      const res = await fetch(`${KREA_API}/generate/video/${modelPath}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Krea video error:', res.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Krea video error: ${res.status}` }),
          { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const job = await res.json();
      // Return immediately — frontend polls check_status (avoids edge function timeout)
      console.log(`Krea video job started: jobId=${job.job_id}`);
      return new Response(
        JSON.stringify({ success: true, videoUrl: null, jobId: job.job_id, status: 'pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === UPSCALE IMAGE ===
    if (action === 'upscale') {
      const { imageUrl, mode = 'standard', scaleFactor = 2 } = body;
      if (!imageUrl) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing imageUrl' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const modelPath = UPSCALE_MODELS[mode] || UPSCALE_MODELS.standard;
      console.log(`Krea upscale: mode=${mode}, scaleFactor=${scaleFactor}`);

      const res = await fetch(`${KREA_API}/upscale/image/${modelPath}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, scaleFactor }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Krea upscale error:', res.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Krea upscale error: ${res.status}` }),
          { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const job = await res.json();
      const result = await pollJob(job.job_id, apiToken, 180000);
      return new Response(
        JSON.stringify({ success: true, imageUrl: result.urls?.[0] || null, jobId: job.job_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === CHECK JOB STATUS (async polling from client) ===
    if (action === 'check_status') {
      const { jobId } = body;
      if (!jobId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing jobId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const res = await fetch(`${KREA_API}/jobs/${jobId}`, {
        headers: { 'Authorization': `Bearer ${apiToken}` },
      });

      if (!res.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `Status check failed: ${res.status}` }),
          { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const job = await res.json();
      const completed = !!job.completed_at;
      const urls: string[] = job.result?.urls || [];
      return new Response(
        JSON.stringify({
          success: true,
          status: job.status,
          completed,
          videoUrl: completed && job.status === 'completed' ? (urls[0] || null) : null,
          urls,
          error: job.result?.error || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === LIST MODELS ===
    if (action === 'list_models') {
      return new Response(
        JSON.stringify({
          success: true,
          imageModels: Object.keys(IMAGE_MODELS),
          videoModels: Object.keys(VIDEO_MODELS),
          upscaleModels: Object.keys(UPSCALE_MODELS),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Unknown action. Use: generate, generate_video, upscale, check_status, list_models' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Krea error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
