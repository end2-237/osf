// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const MONETBIL_KEY    = Deno.env.get("MONETBIL_SERVICE_KEY")      || "";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")               || "";
const SUPABASE_SRVKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")  || "";

const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/monetbil-webhook`;

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const rawText = await req.text();
    if (!rawText?.trim()) return json({ error: "Corps de requête vide" }, 400);

    let parsed: {
      order_ids?: string[]; subscription_id?: string;
      amount?: number; phone?: string; operator?: string;
    };
    try { parsed = JSON.parse(rawText); }
    catch { return json({ error: "JSON invalide" }, 400); }

    const { order_ids, subscription_id, amount, phone, operator } = parsed;
    if (!amount || !phone || !operator)
      return json({ error: "Paramètres manquants" }, 400);
    if (!order_ids?.length && !subscription_id)
      return json({ error: "Rien à payer : ni commande ni abonnement" }, 400);

    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SRVKEY);

    // Le préfixe dit au webhook quoi régler. Deux flux distincts, une seule
    // porte de paiement.
    const payment_ref = subscription_id
      ? `ABO-${Date.now()}-${rand}`
      : `OFS-${Date.now()}-${rand}`;

    if (subscription_id) {
      // Le montant vient de la base, pas de la page : on ne laisse pas le
      // navigateur décider de ce qu'il paie.
      const { data: sub, error: subErr } = await supabase
        .from("subscription_orders")
        .select("id, amount, status")
        .eq("id", subscription_id).maybeSingle();
      if (subErr) throw new Error(subErr.message);
      if (!sub)   return json({ error: "Demande d'abonnement introuvable" }, 404);
      if (sub.status !== "pending") return json({ error: "Cette demande est déjà réglée" }, 409);
      if (Math.round(sub.amount) !== Math.round(amount))
        return json({ error: "Montant incohérent avec la demande" }, 400);

      const { error: e } = await supabase
        .from("subscription_orders")
        .update({ payment_ref }).eq("id", subscription_id);
      if (e) throw new Error(e.message);
    } else {
      const { error: updateErr } = await supabase
        .from("orders")
        .update({ payment_reference: payment_ref })
        .in("id", order_ids!);
      if (updateErr) throw new Error(updateErr.message);
    }

    // Widget API v2.1 — service_key in URL path, not in body
    const body = new URLSearchParams({
      amount:      String(Math.round(amount)),
      phone,
      phone_lock:  "true",
      operator,
      payment_ref,
      notify_url:  WEBHOOK_URL,
      currency:    "XAF",
    });

    const res = await fetch(`https://api.monetbil.com/widget/v2.1/${MONETBIL_KEY}`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
    });

    const data = await res.json();
    console.log("[MONETBIL RESPONSE]", JSON.stringify(data));

    if (!data.success) return json({ error: data.message || "Erreur Monetbil" });

    return json({ success: true, payment_ref, payment_url: data.payment_url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
