import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, data } = await req.json();

    // ===== BRANDS =====
    if (action === "list_brands") {
      const { data: brands, error } = await supabase
        .from("brands")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return new Response(JSON.stringify({ brands }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "save_brand") {
      const { data: brand, error } = await supabase
        .from("brands")
        .upsert(data, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ brand }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete_brand") {
      const { error } = await supabase.from("brands").delete().eq("id", data.id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== SCRIPTS =====
    if (action === "list_scripts") {
      const { data: scripts, error } = await supabase
        .from("scripts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ scripts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "save_script") {
      const { data: script, error } = await supabase
        .from("scripts")
        .upsert(data, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ script }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete_script") {
      const { error } = await supabase.from("scripts").delete().eq("id", data.id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== BULK IMPORT =====
    if (action === "import_brands") {
      const brands = data.brands || [];
      for (const b of brands) {
        await supabase.from("brands").upsert({
          id: b.id,
          name: b.name,
          logo: b.logo || null,
          colors: b.colors || [],
          tone: b.tone || '',
          target_audience: b.targetAudience || b.target_audience || '',
          industry: b.industry || '',
          departments: b.departments || [],
        }, { onConflict: "id" });
      }
      return new Response(JSON.stringify({ ok: true, count: brands.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "import_scripts") {
      const scripts = data.scripts || [];
      for (const s of scripts) {
        await supabase.from("scripts").upsert({
          id: s.id,
          name: s.name,
          content: s.content || '',
        }, { onConflict: "id" });
      }
      return new Response(JSON.stringify({ ok: true, count: scripts.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
