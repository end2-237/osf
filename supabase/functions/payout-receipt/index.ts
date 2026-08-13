// ─────────────────────────────────────────────────────────────────────────────
// REÇU DE VERSEMENT
//
// Émet le reçu d'un retrait vendeur auprès du service de facturation, et
// renvoie l'adresse du PDF. Même raisonnement que pour le reçu d'abonnement :
//
//   1. la clé d'API ne doit pas se promener dans un bundle JavaScript ;
//   2. le montant ne vient pas du client. On relit le versement en base, et on
//      atteste ce qu'il porte — pas ce que la page prétend.
//
// Une différence de fond avec l'abonnement : ici l'argent part de Buyticle vers
// la boutique. Le document n'est donc pas une facture mais un reçu — type
// `recu` côté facturation, avec son propre vocabulaire.
//
// L'appel est idempotent : `external_ref` porte l'identifiant du versement,
// donc un bouton tapé deux fois renvoie le même document.
//
// Variables attendues :
//   BUYFACT_URL       https://buyfacturation-jdbf.vercel.app
//   BUYFACT_API_KEY   la clé partagée
//   BUYTICLE_LOGO_URL facultative — logo de l'en-tête et du filigrane
// ─────────────────────────────────────────────────────────────────────────────
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const BUYFACT_URL  = (Deno.env.get("BUYFACT_URL") || "https://buyfacturation-jdbf.vercel.app").replace(/\/+$/, "");
const BUYFACT_KEY  = Deno.env.get("BUYFACT_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SRV_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOGO_URL     = Deno.env.get("BUYTICLE_LOGO_URL") ||
  "https://alrbokstfwwlvbvghrqr.supabase.co/storage/v1/object/public/vendor-assets/buylogo.png";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MOYENS: Record<string, string> = {
  orange_money: "Orange Money",
  mtn_momo:     "MTN MoMo",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    const { payout_id } = await req.json().catch(() => ({}));
    if (!payout_id) return json({ error: "payout_id manquant" }, 400);

    const supabase = createClient(SUPABASE_URL, SRV_KEY);

    const { data: p, error } = await supabase
      .from("vendor_payouts")
      .select("*, vendor:vendors!vendor_id(shop_name, full_name, email, phone, city)")
      .eq("id", payout_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!p)    return json({ error: "Versement introuvable" }, 404);

    // Un reçu atteste d'un versement. Pas de versement, pas de reçu. Un
    // versement contesté garde le sien : c'est justement la pièce dont on
    // discute.
    if (!["paid", "disputed"].includes(p.status)) {
      return json({ error: "Ce versement n'a pas encore été effectué" }, 409);
    }

    // Déjà émis : on renvoie l'existant plutôt que d'en créer un second.
    if (p.invoice_url) {
      return json({ id: p.invoice_id, number: p.invoice_number, url: p.invoice_url, reused: true });
    }

    const v = p.vendor || {};
    const date = new Date(p.processed_at || p.requested_at || Date.now());
    const number = `BT-VRS-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}-${String(p.id).slice(0, 6).toUpperCase()}`;

    const periode = new Date(p.requested_at || date).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    });

    const payload = {
      type: "recu",
      number,
      date: date.toISOString().slice(0, 10),
      external_ref: `buyticle-payout-${p.id}`,

      platform:     "Buyticle",
      platform_url: "https://buyticle.store",
      // Le moyen employé : c'est par là que le bénéficiaire vérifiera.
      statut:       `${MOYENS[p.method] || p.method} — ${p.phone}`,
      reference:    p.reference || null,

      client_name:    v.shop_name || v.full_name || "Boutique Buyticle",
      client_address: v.city || null,
      client_phone:   p.phone || v.phone || null,
      client_email:   v.email || null,

      items: [{
        description: `Retrait du solde Buyticle — demande du ${periode}`,
        quantity: 1,
        price: Math.round(Number(p.amount) || 0),
      }],

      // Le recours, écrit sur la pièce elle-même : celui qui n'a rien vu
      // arriver ne doit pas avoir à chercher qui prévenir.
      notice:
        "Si ce versement n'est pas arrivé sur le compte indiqué, signale-le depuis " +
        "ton tableau de bord Buyticle (Réglages → Retraits → « Je n'ai pas reçu ce " +
        "virement »). Nous vérifions auprès de l'opérateur avec la référence de " +
        "transaction ci-dessus.",

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

    await supabase.from("vendor_payouts").update({
      invoice_id: invoice.id, invoice_number: invoice.number || number, invoice_url: url,
    }).eq("id", p.id);

    return json({ id: invoice.id, number: invoice.number || number, url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
