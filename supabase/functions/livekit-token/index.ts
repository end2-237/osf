// ════════════════════════════════════════════════════════════════════════════
// LIVEKIT TOKEN — signe un jeton d'accès WebRTC pour un live.
//   • publish=true  → réservé à l'hôte du show (live_shows.host_user_id)
//   • publish=false → n'importe qui peut regarder (identité invité)
// Secrets requis (supabase secrets set) :
//   LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL (wss://…)
// ════════════════════════════════════════════════════════════════════════════
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// @ts-ignore
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.9.7";

const LK_KEY    = Deno.env.get("LIVEKIT_API_KEY")           || "";
const LK_SECRET = Deno.env.get("LIVEKIT_API_SECRET")        || "";
const LK_URL    = Deno.env.get("LIVEKIT_URL")               || "";
const SB_URL    = Deno.env.get("SUPABASE_URL")              || "";
const SB_SRVKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALLOWED = new Set([
  "https://www.onefreestyle.store",
  "https://onefreestyle.store",
  "https://buyticle.com",
  "https://www.buyticle.com",
  "http://localhost:5173",
  "http://localhost:4173",
]);

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const headers = { ...cors(origin), "Content-Type": "application/json" };

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers });

  try {
    if (!LK_KEY || !LK_SECRET || !LK_URL) {
      return new Response(JSON.stringify({ error: "LiveKit non configuré" }), { status: 500, headers });
    }

    const { room, publish } = await req.json();
    if (!room) return new Response(JSON.stringify({ error: "room requis" }), { status: 400, headers });

    const supabase = createClient(SB_URL, SB_SRVKEY);

    // Identifie l'appelant (facultatif pour un viewer, requis pour publier)
    let userId: string | null = null;
    let userName = "invité";
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    if (jwt) {
      const { data } = await supabase.auth.getUser(jwt);
      if (data?.user) {
        userId = data.user.id;
        userName = (data.user.user_metadata?.display_name as string)
          || data.user.email?.split("@")[0] || "membre";
      }
    }

    let canPublish = false;
    if (publish) {
      if (!userId) return new Response(JSON.stringify({ error: "Connexion requise pour diffuser" }), { status: 401, headers });
      const { data: show } = await supabase
        .from("live_shows").select("host_user_id").eq("id", room).maybeSingle();
      if (!show || show.host_user_id !== userId) {
        return new Response(JSON.stringify({ error: "Seul l'hôte peut diffuser ce live" }), { status: 403, headers });
      }
      canPublish = true;
    }

    const identity = userId || `guest-${crypto.randomUUID().slice(0, 8)}`;
    const at = new AccessToken(LK_KEY, LK_SECRET, { identity, name: userName, ttl: "3h" });
    at.addGrant({
      roomJoin: true,
      room,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });
    const token = await at.toJwt();

    return new Response(JSON.stringify({ token, url: LK_URL, identity }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers });
  }
});
