// ══════════════════════════════════════════════════════════
//  BUBBLE PUSH NOTIFICATION EDGE FUNCTION
//  Deploy: supabase functions deploy send-push
//  Set secrets:
//    supabase secrets set VAPID_PRIVATE_KEY=kXFIJS2P0dxb5A_htHd0G76f_OtHbGxmBDuQMgiN54g
//    supabase secrets set VAPID_PUBLIC_KEY=BH1bjuFEH_rjDqiwRgT59P55QHttJfEUhOWnIqMobE_YbFS6sQUYajtlFlTJ0dkm1drf0Y-zRUBYaW0WwopzOdA
//    supabase secrets set VAPID_SUBJECT=mailto:michaelatsorensen@gmail.com
// ══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Web Push for Deno
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:michaelatsorensen@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  try {
    // CORS
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const { type, user_id, title, body, data } = await req.json();

    // Validate
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400 });
    }

    // Get push subscription for user
    const { data: sub, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id)
      .single();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "No push subscription", detail: subErr?.message }), { status: 404 });
    }

    // Build push subscription object
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    // Send notification
    const payload = JSON.stringify({
      title: title || "Bubble",
      body: body || "Du har en ny notifikation",
      tag: type || "general",
      data: data || {},
    });

    await webpush.sendNotification(pushSubscription, payload);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("Push error:", err);

    // If subscription expired, clean up
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — delete it
      const { user_id } = await req.json().catch(() => ({}));
      if (user_id) {
        await supabase.from("push_subscriptions").delete().eq("user_id", user_id);
      }
      return new Response(JSON.stringify({ error: "Subscription expired, cleaned up" }), { status: 410 });
    }

    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
