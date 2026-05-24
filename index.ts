// ══════════════════════════════════════════════════════════
//  BUBBLE PUSH NOTIFICATION EDGE FUNCTION  · v2 (ADR-006 trin 2)
//  Deploy: supabase functions deploy send-push
//  Set secrets:
//    supabase secrets set VAPID_PRIVATE_KEY=...
//    supabase secrets set VAPID_PUBLIC_KEY=...
//    supabase secrets set VAPID_SUBJECT=mailto:michaelatsorensen@gmail.com
//
//  CHANGE vs v1: tilføjet push_events observability-logning + 'source'-felt.
//  Dispatch-adfærd er UÆNDRET — kun synlighed tilføjet (ADR-006: synlighed før kompleksitet).
//  Logning er best-effort: en fejl i logning må ALDRIG bryde push-afsendelse.
// ══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:michaelatsorensen@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Observability: best-effort log til push_events. Må aldrig kaste. ──
async function logPushEvent(row: {
  event_type?: string | null;
  recipient_user_id?: string | null;
  source?: string | null;
  status: string;
  sent_count?: number | null;
  error?: string | null;
}) {
  try {
    await supabase.from("push_events").insert({
      event_type: row.event_type ?? null,
      recipient_user_id: row.recipient_user_id ?? null,
      source: row.source ?? "unknown",
      status: row.status,
      sent_count: row.sent_count ?? null,
      error: row.error ?? null,
    });
  } catch (logErr) {
    // Logning er diagnostik — en fejl her må ikke påvirke push-flowet.
    console.error("push_events log error:", (logErr as any)?.message);
  }
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  };

  // Holdes uden for try så vi kan logge i catch
  let evType: string | null = null;
  let evUser: string | null = null;
  let evSource: string | null = null;

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const body = await req.json();
    // 'source' er nyt (ADR-006): 'trigger' | 'frontend' | 'edge'. Default 'unknown'.
    const { type, user_id, title, body: msgBody, data, source } = body;
    evType = type ?? null;
    evUser = user_id ?? null;
    evSource = source ?? "unknown";

    // Validate
    if (!user_id) {
      await logPushEvent({ event_type: evType, recipient_user_id: null, source: evSource, status: "invalid", error: "user_id required" });
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: corsHeaders });
    }

    // Get ALL push subscriptions for user (multi-device support)
    const { data: subs, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (subErr || !subs || subs.length === 0) {
      await logPushEvent({ event_type: evType, recipient_user_id: evUser, source: evSource, status: "no_subscription", sent_count: 0, error: subErr?.message ?? null });
      return new Response(JSON.stringify({ error: "No push subscription", detail: subErr?.message }), { status: 404, headers: corsHeaders });
    }

    // Send notification to all devices
    const payload = JSON.stringify({
      title: title || "Bubble",
      body: msgBody || "Du har en ny notifikation",
      tag: type || "general",
      data: data || {},
    });

    let sent = 0;
    let expired: string[] = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }, payload);
        sent++;
      } catch (pushErr: any) {
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          expired.push(sub.id);
        } else {
          console.error("Push send error:", pushErr.message);
        }
      }
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expired);
    }

    // Observability: sent hvis mindst én enhed fik den, ellers failed
    await logPushEvent({
      event_type: evType,
      recipient_user_id: evUser,
      source: evSource,
      status: sent > 0 ? "sent" : "failed",
      sent_count: sent,
      error: sent === 0 ? "all devices failed or expired" : null,
    });

    return new Response(JSON.stringify({ success: true, sent, expired: expired.length }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Push error:", err);
    await logPushEvent({ event_type: evType, recipient_user_id: evUser, source: evSource, status: "failed", error: (err as any)?.message ?? "unknown error" });
    return new Response(JSON.stringify({ error: (err as any).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
