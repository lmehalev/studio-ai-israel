const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KREA_API = 'https://api.krea.ai';

// Available models for different use cases
const IMAGE_MODELS = {
  flux: 'bfl/flux-1-dev',           // Fast, versatile
  'nano-banana-pro': 'google/nano-banana-pro', // Superior typography & photorealism
  'seedream-4': 'bytedance/seedream-4',   // High quality photorealism
  'chatgpt-image': 'openai/chatgpt-image', // Best prompt adherence
};

const UPSCALE_MODELS = {
  standard: 'topaz/standard',   // Clean upscaling
  bloom: 'topaz/bloom',         // Stylized detail
  generative: 'topaz/generative', // Add new detail
};

async function pollJob(jobId: string, apiToken: string, maxWaitMs = 120000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${KREA_API}/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });
    if (!res.ok) {
      throw new Error(`Job poll failed: ${res.status}`);
    }
    const job = await res.json();

    if (job.completed_at) {
      if (job.status === 'completed') {
        return job.result;
      } else {
        throw new Error(`Job ${job.status}: ${job.result?.error || 'Unknown error'}`);
      }
    }

    // Wait 3 seconds between polls
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

      const modelPath = IMAGE_MODELS[model as keyof typeof IMAGE_MODELS] || IMAGE_MODELS.flux;

      const payload: any = { prompt, width, height };
      if (steps) payload.steps = steps;
      if (imageUrls && imageUrls.length > 0) payload.imageUrls = imageUrls;

      console.log(`Krea generate: model=${modelPath}, prompt=${prompt.slice(0, 80)}...`);

      const res = await fetch(`${KREA_API}/generate/image/${modelPath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
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
      const jobId = job.job_id;

      // Poll for result
      const result = await pollJob(jobId, apiToken);
      const imageUrl = result.urls?.[0] || null;

      return new Response(
        JSON.stringify({ success: true, imageUrl, jobId }),
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

      const modelPath = UPSCALE_MODELS[mode as keyof typeof UPSCALE_MODELS] || UPSCALE_MODELS.standard;

      console.log(`Krea upscale: mode=${mode}, scaleFactor=${scaleFactor}`);

      const res = await fetch(`${KREA_API}/upscale/image/${modelPath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          scaleFactor,
        }),
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
      const jobId = job.job_id;

      // Poll for result (upscale can take longer)
      const result = await pollJob(jobId, apiToken, 180000);
      const upscaledUrl = result.urls?.[0] || null;

      return new Response(
        JSON.stringify({ success: true, imageUrl: upscaledUrl, jobId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === CHECK JOB STATUS ===
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
      return new Response(
        JSON.stringify({
          success: true,
          status: job.status,
          completed: !!job.completed_at,
          imageUrl: job.result?.urls?.[0] || null,
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
          upscaleModels: Object.keys(UPSCALE_MODELS),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Unknown action. Use: generate, upscale, check_status, list_models' }),
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
