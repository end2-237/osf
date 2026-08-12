// ─────────────────────────────────────────────────────────────────────────────
// REÇU D'ABONNEMENT
//
// Émet la facture d'abonnement auprès du service de facturation, et renvoie
// l'adresse du PDF. Deux raisons de passer par une fonction edge plutôt que
// d'appeler l'API depuis le navigateur :
//
//   1. la clé d'API ne doit pas se promener dans un bundle JavaScript ;
//   2. le montant ne doit pas venir du client. On relit la demande en base,
//      et on facture ce qu'elle porte — pas ce que la page prétend.
//
// L'appel est idempotent côté facturation : `external_ref` porte l'identifiant
// de la demande, donc un bouton tapé deux fois renvoie le même document.
//
// Variables attendues :
//   BUYFACT_URL      https://buyfacturation-jdbf.vercel.app
//   BUYFACT_API_KEY  la clé partagée (facultative tant qu'elle n'est pas posée
//                    côté facturation)
// ─────────────────────────────────────────────────────────────────────────────
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const BUYFACT_URL  = (Deno.env.get("BUYFACT_URL") || "https://buyfacturation-jdbf.vercel.app").replace(/\/+$/, "");
const BUYFACT_KEY  = Deno.env.get("BUYFACT_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SRV_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    const { subscription_id } = await req.json().catch(() => ({}));
    if (!subscription_id) return json({ error: "subscription_id manquant" }, 400);

    const supabase = createClient(SUPABASE_URL, SRV_KEY);

    const { data: sub, error } = await supabase
      .from("subscription_orders")
      .select("*, vendor:vendors!vendor_id(shop_name, full_name, email, phone, city)")
      .eq("id", subscription_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sub)  return json({ error: "Demande introuvable" }, 404);

    // Un reçu atteste d'un paiement. Pas de paiement, pas de reçu.
    if (sub.status !== "paid") {
      return json({ error: "Cette demande n'est pas encore payée" }, 409);
    }

    // Déjà émise : on renvoie l'existante plutôt que d'en créer une seconde.
    if (sub.invoice_url) {
      return json({ id: sub.invoice_id, number: sub.invoice_number, url: sub.invoice_url, reused: true });
    }

    const v = sub.vendor || {};
    const date = new Date(sub.settled_at || Date.now());
    const number = `BT-ABO-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}-${String(sub.id).slice(0, 6).toUpperCase()}`;

    const payload = {
      type: "abonnement",
      number,
      date: date.toISOString().slice(0, 10),
      external_ref: `buyticle-sub-${sub.id}`,

      platform:     "Buyticle",
      platform_url: "https://buyticle.store",
      statut:       `Forfait ${sub.to_plan}`,

      client_name:    v.shop_name || v.full_name || "Boutique Buyticle",
      client_address: v.city || null,
      client_phone:   v.phone || null,
      client_email:   v.email || null,

      items: [{
        description: `Abonnement Buyticle — forfait ${sub.to_plan}` +
                     (sub.months > 1 ? ` (${sub.months} mois)` : " (1 mois)"),
        quantity: 1,
        price: sub.amount,
      }],

      status: "paid",
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (BUYFACT_KEY) headers["x-api-key"] = BUYFACT_KEY;

    const res = await fetch(`${BUYFACT_URL}/api/invoices`, {
      method: "POST", headers, body: JSON.stringify(payload),
    });

    const invoice = await res.json().catch(() => null);
    if (!res.ok || !invoice?.id) {
      return json({ error: invoice?.error || `Facturation indisponible (HTTP ${res.status})` }, 502);
    }

    const url = `${BUYFACT_URL}/api/invoices/${invoice.id}/download`;

    await supabase.from("subscription_orders").update({
      invoice_id: invoice.id, invoice_number: invoice.number || number, invoice_url: url,
    }).eq("id", sub.id);

    return json({ id: invoice.id, number: invoice.number || number, url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
