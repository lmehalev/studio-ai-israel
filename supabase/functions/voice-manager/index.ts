import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabase();
    const { action, ...payload } = await req.json();

    // === VOICES CRUD ===
    if (action === "list") {
      const { data, error } = await supabase
        .from("voices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ voices: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      const { name, audio_url, type } = payload;
      if (!name || !audio_url) {
        return new Response(JSON.stringify({ error: "שם וקובץ אודיו נדרשים" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("voices")
        .insert({ name, audio_url, type: type || "recorded" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ voice: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_provider_voice_id") {
      const { id, provider_voice_id } = payload;
      if (!id || !provider_voice_id) {
        return new Response(JSON.stringify({ error: "מזהה קול ו-provider_voice_id נדרשים" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Use raw PostgREST call to avoid schema cache issues with new columns
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const patchRes = await fetch(
        `${supabaseUrl}/rest/v1/voices?id=eq.${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
            "Prefer": "return=representation",
          },
          body: JSON.stringify({ provider_voice_id }),
        }
      );
      if (!patchRes.ok) {
        const errText = await patchRes.text();
        console.error("update_provider_voice_id error:", patchRes.status, errText);
        throw new Error(`שגיאה בעדכון provider_voice_id: ${patchRes.status}`);
      }
      const updated = await patchRes.json();
      return new Response(JSON.stringify({ voice: updated?.[0] || { id, provider_voice_id } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { id } = payload;
      if (!id) {
        return new Response(JSON.stringify({ error: "מזהה קול נדרש" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("voices").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === VOICE GENERATIONS CRUD ===
    if (action === "list_generations") {
      const { data, error } = await supabase
        .from("voice_generations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ generations: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_generation") {
      const { title, script, voice_id, voice_name, provider, audio_url, duration_seconds } = payload;
      if (!title || !script || !audio_url) {
        return new Response(JSON.stringify({ error: "כותרת, תסריט וקובץ אודיו נדרשים" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("voice_generations")
        .insert({
          title,
          script,
          voice_id: voice_id || null,
          voice_name: voice_name || '',
          provider: provider || 'ElevenLabs',
          audio_url,
          duration_seconds: duration_seconds || null,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ generation: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_generation") {
      const { id } = payload;
      if (!id) {
        return new Response(JSON.stringify({ error: "מזהה נדרש" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("voice_generations").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "פעולה לא מוכרת" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-manager error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה בניהול קולות" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
