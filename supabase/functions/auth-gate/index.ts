const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    const validUser = Deno.env.get('GATE_USERNAME');
    const validPass = Deno.env.get('GATE_PASSWORD');

    if (!validUser || !validPass) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (username === validUser && password === validPass) {
      // Create a simple token: base64 of timestamp + random
      const token = btoa(`${Date.now()}-${crypto.randomUUID()}`);
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      return new Response(JSON.stringify({ token, expiresAt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
