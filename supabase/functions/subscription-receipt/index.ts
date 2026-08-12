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
// Le logo qui habille le reçu — en-tête et filigrane. Même image que partout
// ailleurs sur Buyticle (voir src/lib/brand.js) ; se change ici sans toucher au
// service de facturation.
const LOGO_URL     = Deno.env.get("BUYTICLE_LOGO_URL") ||
  "https://alrbokstfwwlvbvghrqr.supabase.co/storage/v1/object/public/vendor-assets/buylogo.png";
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

    // La période couverte, telle qu'elle apparaîtra sur le reçu.
    const months = Math.max(Number(sub.months) || 1, 1);
    const fin = new Date(date);
    fin.setMonth(fin.getMonth() + months);
    const jour = (d: Date) => d.toISOString().slice(0, 10);

    const REGLEMENT: Record<string, string> = {
      agency:   "Paiement en agence",
      monetbil: "Mobile money",
    };

    // Le total du reçu est calculé par le service de facturation à partir de la
    // ligne : quantité × prix unitaire. On ne détaille par mois que si ça
    // retombe exactement sur la somme réglée — un reçu dont le total diffère du
    // versement est pire qu'un reçu peu détaillé.
    const total    = Math.round(Number(sub.amount) || 0);
    const unitaire = Math.round(total / months);
    const detaille = months > 1 && unitaire * months === total;

    const payload = {
      type: "abonnement",
      number,
      date: jour(date),
      external_ref: `buyticle-sub-${sub.id}`,

      platform:     "Buyticle",
      platform_url: "https://buyticle.store",
      // L'API insère ce corps tel quel dans sa table : chaque clé doit être une
      // colonne existante. Le mode de règlement n'en est pas une, il se loge
      // donc dans le statut, qui est justement là pour ça.
      statut: `Forfait ${sub.to_plan}`
              + (REGLEMENT[sub.method] ? ` · ${REGLEMENT[sub.method]}` : ""),

      // Période couverte : un abonnement se lit d'abord par ses dates.
      trial_start: jour(date),
      trial_end:   jour(fin),

      client_name:    v.shop_name || v.full_name || "Boutique Buyticle",
      client_address: v.city || null,
      client_phone:   v.phone || null,
      client_email:   v.email || null,

      items: [{
        description: `Abonnement Buyticle — forfait ${sub.to_plan}` +
                     (months > 1 ? ` (${months} mois)` : " (1 mois)"),
        quantity: detaille ? months : 1,
        price:    detaille ? unitaire : total,
      }],

      // L'émetteur, c'est nous — avec notre logo en en-tête et en filigrane.
      seller: {
        name:     "BUYTICLE ETS",
        tagline:  "Entreprise Individuelle (ETS)",
        address:  "Bonamoussadi, Douala — Cameroun",
        phone:    "(+237) 696 99 58 79",
        rccm:     "CM-DLA-01-2025-A10-01482",
        niu:      "P070418499910G",
        logo_url: LOGO_URL,
      },
      style: { watermark_url: LOGO_URL },

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
