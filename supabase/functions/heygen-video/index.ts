const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HEYGEN_API = "https://api.heygen.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;
    const HEYGEN_API_KEY = Deno.env.get("HEYGEN_API_KEY");

    if (!HEYGEN_API_KEY) {
      return new Response(
        JSON.stringify({ error: "מפתח HeyGen API לא מוגדר. יש להוסיף אותו בהגדרות." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = {
      "X-Api-Key": HEYGEN_API_KEY,
      "Content-Type": "application/json",
    };

    // ====== Create talking avatar video ======
    if (action === "create_video") {
      const { avatarId, script, voiceId, audioUrl, aspectRatio, avatarStyle } = params;

      const videoInput: any = {
        character: {
          type: "avatar",
          avatar_id: avatarId && avatarId !== "default" ? avatarId : "Abigail_expressive_2024112501",
          avatar_style: avatarStyle || "normal",
        },
        voice: voiceId
          ? { type: "text", input_text: script, voice_id: voiceId, speed: 1.0 }
          : audioUrl
            ? { type: "audio", audio_url: audioUrl }
            : { type: "text", input_text: script, voice_id: "f38a635bee7a4d1f9b0a654a31d050d2", speed: 1.0 },
      };

      const dimension = aspectRatio === "9:16"
        ? { width: 1080, height: 1920 }
        : aspectRatio === "1:1"
          ? { width: 1080, height: 1080 }
          : { width: 1920, height: 1080 };

      const response = await fetch(`${HEYGEN_API}/v2/video/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          video_inputs: [videoInput],
          dimension,
        }),
      });

      const data = await response.json();
      console.log("HeyGen create response:", response.status, JSON.stringify(data).slice(0, 500));
      if (!response.ok || data?.error) {
        const errDetail = data?.error?.message || data?.error?.code || data?.message || (typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error || data));
        console.error("HeyGen create error:", errDetail);
        return new Response(
          JSON.stringify({ error: `שגיאה ביצירת סרטון: ${errDetail}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ videoId: data.data?.video_id, status: "processing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== Create photo avatar video (use own photo) ======
    // FIX: HeyGen v2 API requires uploading the photo first to get a talking_photo_id,
    // then using that ID in the video generation request.
    if (action === "create_photo_avatar_video") {
      const { photoUrl, script, voiceId, audioUrl, aspectRatio } = params;

      if (!photoUrl) {
        return new Response(
          JSON.stringify({ error: "חסר קישור לתמונה" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Upload the photo to HeyGen to get a talking_photo_id
      console.log("HeyGen: Uploading talking photo from URL:", photoUrl.slice(0, 100));
      let talkingPhotoId: string | null = null;

      try {
        const uploadRes = await fetch(`${HEYGEN_API}/v1/talking_photo`, {
          method: "POST",
          headers,
          body: JSON.stringify({ photo_url: photoUrl }),
        });

        const uploadData = await uploadRes.json();
        console.log("HeyGen talking_photo upload response:", uploadRes.status, JSON.stringify(uploadData).slice(0, 300));

        if (uploadRes.ok && uploadData?.data?.talking_photo_id) {
          talkingPhotoId = uploadData.data.talking_photo_id;
        } else if (uploadData?.data?.id) {
          talkingPhotoId = uploadData.data.id;
        } else {
          // Fallback: try the v2 upload endpoint
          const v2UploadRes = await fetch(`${HEYGEN_API}/v2/photo_avatar/talking_photo/upload`, {
            method: "POST",
            headers,
            body: JSON.stringify({ image_url: photoUrl }),
          });
          const v2Data = await v2UploadRes.json();
          console.log("HeyGen v2 talking_photo upload response:", v2UploadRes.status, JSON.stringify(v2Data).slice(0, 300));
          talkingPhotoId = v2Data?.data?.talking_photo_id || v2Data?.data?.id || null;
        }
      } catch (uploadErr) {
        console.error("HeyGen photo upload error:", uploadErr);
      }

      // Step 2: Create the video with talking_photo_id (or fallback to talking_photo_url)
      const voiceConfig = voiceId
        ? { type: "text", input_text: script, voice_id: voiceId, speed: 1.0 }
        : audioUrl
          ? { type: "audio", audio_url: audioUrl }
          : { type: "text", input_text: script, voice_id: "f38a635bee7a4d1f9b0a654a31d050d2", speed: 1.0 };

      const characterConfig: any = talkingPhotoId
        ? { type: "talking_photo", talking_photo_id: talkingPhotoId }
        : { type: "talking_photo", talking_photo_url: photoUrl };

      console.log("HeyGen: Creating video with character config:", JSON.stringify(characterConfig).slice(0, 200));

      const videoInput: any = {
        character: characterConfig,
        voice: voiceConfig,
      };

      const dimension = aspectRatio === "9:16"
        ? { width: 1080, height: 1920 }
        : aspectRatio === "1:1"
          ? { width: 1080, height: 1080 }
          : { width: 1920, height: 1080 };

      const response = await fetch(`${HEYGEN_API}/v2/video/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          video_inputs: [videoInput],
          dimension,
        }),
      });

      const data = await response.json();
      console.log("HeyGen photo avatar video response:", response.status, JSON.stringify(data).slice(0, 500));
      
      if (!response.ok || data?.error) {
        const errDetail = data?.error?.message || data?.error?.code || data?.message || (typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error || data));
        console.error("HeyGen photo avatar error:", errDetail);
        return new Response(
          JSON.stringify({ error: `שגיאה ביצירת סרטון תמונה מדברת: ${errDetail}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ videoId: data.data?.video_id, status: "processing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== Check video status ======
    if (action === "check_status") {
      const { videoId } = params;
      if (!videoId) {
        return new Response(
          JSON.stringify({ error: "חסר videoId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(`${HEYGEN_API}/v1/video_status.get?video_id=${videoId}`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("HeyGen status error:", data);
        return new Response(
          JSON.stringify({ error: `שגיאה בבדיקת סטטוס: ${data.message || response.status}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const status = data.data?.status;
      return new Response(
        JSON.stringify({
          status: status === "completed" ? "done" : status,
          videoUrl: data.data?.video_url || null,
          thumbnailUrl: data.data?.thumbnail_url || null,
          progress: status === "completed" ? 100 : status === "processing" ? 50 : 10,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== List available avatars ======
    if (action === "list_avatars") {
      const response = await fetch(`${HEYGEN_API}/v2/avatars`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });

      const data = await response.json();
      return new Response(
        JSON.stringify({ avatars: data.data?.avatars || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== List available voices ======
    if (action === "list_voices") {
      const response = await fetch(`${HEYGEN_API}/v2/voices`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });

      const data = await response.json();
      return new Response(
        JSON.stringify({ voices: data.data?.voices || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== List templates ======
    if (action === "list_templates") {
      const response = await fetch(`${HEYGEN_API}/v2/templates`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });

      const data = await response.json();
      return new Response(
        JSON.stringify({ templates: data.data?.templates || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== Create video from template ======
    if (action === "create_from_template") {
      const { templateId, variables } = params;
      if (!templateId) {
        return new Response(
          JSON.stringify({ error: "חסר מזהה תבנית" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(`${HEYGEN_API}/v2/template/${templateId}/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ variables: variables || {} }),
      });

      const data = await response.json();
      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `שגיאה ביצירה מתבנית: ${data.message || response.status}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ videoId: data.data?.video_id, status: "processing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== Get remaining quota ======
    if (action === "get_quota") {
      try {
        const response = await fetch(`${HEYGEN_API}/v2/user/remaining_quota`, {
          headers: { "X-Api-Key": HEYGEN_API_KEY },
        });

        if (!response.ok) {
          const text = await response.text();
          console.error("HeyGen quota error:", response.status, text.slice(0, 200));
          return new Response(
            JSON.stringify({ quota: { error: "לא ניתן לבדוק מכסה" } }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ quota: data.data || data || {} }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ quota: { error: "שגיאה בבדיקת מכסה" } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ====== Health check ======
    if (action === "health_check") {
      try {
        const response = await fetch(`${HEYGEN_API}/v2/avatars`, {
          headers: { "X-Api-Key": HEYGEN_API_KEY },
        });
        return new Response(
          JSON.stringify({ ok: response.ok, status: response.status }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "health check failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ error: "פעולה לא מוכרת" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("HeyGen error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
