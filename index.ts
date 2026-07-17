// ══════════════════════════════════════════════════════════
//  BUBBLE PUSH NOTIFICATION EDGE FUNCTION  · v4 (pilot-hardening)
//  Deploy (skridt 2, MED flag stadig):
//    supabase functions deploy send-push --no-verify-jwt --project-ref pfxcsjjxvdtpsfltexka
//  Deploy (skridt 3, UDEN flag — haandhaever JWT):
//    supabase functions deploy send-push --project-ref pfxcsjjxvdtpsfltexka
//
//  Secrets (uaendret + én ny):
//    supabase secrets set VAPID_PRIVATE_KEY=...
//    supabase secrets set VAPID_PUBLIC_KEY=...
//    supabase secrets set VAPID_SUBJECT=mailto:michaelatsorensen@gmail.com
//    supabase secrets set PUSH_TRIGGER_SECRET=<lang-tilfaeldig-streng>   <- NY
//
//  TILLIDSMODEL (v4):
//   - Kald MED korrekt x-push-trigger-header (DB-triggere): fuld tillid. Maa sende
//     egen title/body — det er server-ejet data brugeren har ret til at se. Dette
//     bevarer de personlige beskeder ("Maria sendte en besked").
//   - Kald MED gyldigt JWT men UDEN secret (frontend-brugere): begraenset tillid.
//     Kun faste servergenererede typer (join_request/approved/checkin). Kan IKKE
//     injicere fri tekst.
//   - Kald uden nogen af delene: afvist.
//
//  Observability (push_events) uaendret fra v2.
// ══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:michaelatsorensen@gmail.com";
const PUSH_TRIGGER_SECRET = Deno.env.get("PUSH_TRIGGER_SECRET") || "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Faste servergenererede typer for FRONTEND-kald (begraenset tillid).
const FRONTEND_TYPES: Record<string, { title: string; body: string }> = {
  join_request: { title: "Bubble", body: "Nogen vil gerne vaere med i din boble" },
  approved:     { title: "Bubble", body: "Du er blevet medlem af en boble" },
  checkin:      { title: "Bubble", body: "Du er checket ind i et event" },
};

// Typer som triggere (fuld tillid) maa sende med egen tekst.
const TRIGGER_TYPES = new Set(["new_message", "bubble_invite", "contact_saved"]);

async function logPushEvent(row: {
  event_type?: string | null;
  recipient_user_id?: string | null;
  source?: string | null;
  status: string;
  sent_count?: number | null;
  error?: string | null;
}) {
  try {
    await admin.from("push_events").insert({
      event_type: row.event_type ?? null,
      recipient_user_id: row.recipient_user_id ?? null,
      source: row.source ?? "unknown",
      status: row.status,
      sent_count: row.sent_count ?? null,
      error: row.error ?? null,
    });
  } catch (logErr) {
    console.error("push_events log error:", (logErr as any)?.message);
  }
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-push-trigger",
  };

  let evType: string | null = null;
  let evUser: string | null = null;
  let evSource: string | null = null;

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const body = await req.json();
    const { type, user_id, title, body: msgBody, data } = body;
    evType = type ?? null;
    evUser = user_id ?? null;

    if (!user_id) {
      await logPushEvent({ event_type: evType, recipient_user_id: null, source: "unknown", status: "invalid", error: "user_id required" });
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: corsHeaders });
    }
    if (!type) {
      await logPushEvent({ event_type: evType, recipient_user_id: evUser, source: "unknown", status: "invalid", error: "type required" });
      return new Response(JSON.stringify({ error: "type required" }), { status: 400, headers: corsHeaders });
    }

    // -- Bestem afsenderens tillidsniveau --
    const triggerHeader = req.headers.get("x-push-trigger") || "";
    const isTrigger = PUSH_TRIGGER_SECRET.length > 0 && triggerHeader === PUSH_TRIGGER_SECRET;

    let pushTitle: string;
    let pushBody: string;

    if (isTrigger) {
      // FULD TILLID: DB-trigger. Maa sende egen tekst for kendte trigger-typer.
      evSource = "trigger";
      if (!TRIGGER_TYPES.has(type)) {
        await logPushEvent({ event_type: evType, recipient_user_id: evUser, source: evSource, status: "invalid", error: "unknown trigger type" });
        return new Response(JSON.stringify({ error: "unknown trigger type" }), { status: 400, headers: corsHeaders });
      }
      pushTitle = title || "Bubble";
      pushBody = msgBody || "Du har en ny notifikation";
    } else {
      // BEGRAENSET TILLID: frontend-bruger. Kraev gyldigt JWT + fast servertype.
      evSource = "frontend";
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      if (!jwt) {
        await logPushEvent({ event_type: evType, recipient_user_id: evUser, source: evSource, status: "unauthorized", error: "missing bearer token" });
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: "Bearer " + jwt } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) {
        await logPushEvent({ event_type: evType, recipient_user_id: evUser, source: evSource, status: "unauthorized", error: userErr?.message ?? "invalid token" });
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const fixed = FRONTEND_TYPES[type];
      if (!fixed) {
        await logPushEvent({ event_type: evType, recipient_user_id: evUser, source: evSource, status: "forbidden", error: "frontend may not send this type" });
        return new Response(JSON.stringify({ error: "forbidden type" }), { status: 403, headers: corsHeaders });
      }
      pushTitle = fixed.title;
      pushBody = fixed.body;
    }

    // -- Byg payload --
    const payload = JSON.stringify({
      title: pushTitle,
      body: pushBody,
      tag: type,
      data: data && typeof data === "object" ? data : {},
    });

    // -- Hent modtagerens subscriptions (service role) --
    const { data: subs, error: subErr } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (subErr || !subs || subs.length === 0) {
      await logPushEvent({ event_type: evType, recipient_user_id: evUser, source: evSource, status: "no_subscription", sent_count: 0, error: subErr?.message ?? null });
      return new Response(JSON.stringify({ error: "No push subscription", detail: subErr?.message }), { status: 404, headers: corsHeaders });
    }

    let sent = 0;
    const expired: string[] = [];
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

    if (expired.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", expired);
    }

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