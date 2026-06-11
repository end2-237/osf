// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY  = Deno.env.get("RESEND_API_KEY")              || "";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")                || "";
const SUPABASE_SRVKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")   || "";
const FROM_EMAIL      = "OFS Cameroun <noreply@onefreestyle.store>";
const SITE_URL        = "https://www.onefreestyle.store";
const SUPPORT_PHONE   = "237696995879";
const LOGO_URL        = "https://www.onefreestyle.store/logoofs.png";

const ALLOWED_ORIGINS = new Set([
  "https://www.onefreestyle.store",
  "https://onefreestyle.store",
  "http://localhost:5173",
  "http://localhost:4173",
]);

const fmt     = (n: number) => Math.round(n).toLocaleString("fr-FR") + " FCFA";
const fmtDate = (d: string | null) => d
  ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
  : new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

const paymentLabel = (method: string) =>
  method === "orange_money" ? "Orange Money" :
  method === "mtn_momo"    ? "MTN MoMo"     :
  method === "cash"        ? "cash_on_delivery" :
  method || "À la livraison";

// ─── ITEMS TABLE ──────────────────────────────────────────────────────────────
const itemsTable = (items: any[]) => {
  const rows = items.map((item: any) => {
    const subtotal = item.unit_price * item.quantity;
    const variant  = [item.selected_color, item.selected_size].filter(Boolean).join(" · ");
    return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #e0e0e0;vertical-align:top;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            ${item.product_img ? `
            <td style="width:60px;padding-right:14px;vertical-align:top;">
              <img src="${item.product_img}" width="60" height="60"
                style="display:block;border-radius:4px;border:1px solid #e0e0e0;object-fit:cover;" />
            </td>` : ""}
            <td style="vertical-align:top;">
              <div style="font-size:13px;font-weight:600;color:#202124;line-height:1.5;">${item.product_name}</div>
              ${variant ? `<div style="font-size:12px;color:#5f6368;margin-top:2px;">${variant}</div>` : ""}
              <div style="font-size:12px;color:#5f6368;margin-top:1px;">Qté : ${item.quantity}</div>
            </td>
          </tr>
        </table>
      </td>
      <td style="padding:14px 0;border-bottom:1px solid #e0e0e0;text-align:right;vertical-align:top;font-size:13px;color:#202124;white-space:nowrap;">${fmt(subtotal)}</td>
    </tr>`;
  }).join("");

  return `
  <table width="100%" cellpadding="0" cellspacing="0">
    <thead>
      <tr>
        <th style="padding:0 0 10px;text-align:left;font-size:12px;font-weight:700;color:#202124;border-bottom:1px solid #202124;">Description</th>
        <th style="padding:0 0 10px;text-align:right;font-size:12px;font-weight:700;color:#202124;border-bottom:1px solid #202124;">Montant (FCFA)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
};

// ─── RÉCAPITULATIF ────────────────────────────────────────────────────────────
const recap = (order: any) => `
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td colspan="2" style="padding-bottom:8px;font-size:12px;font-weight:700;color:#202124;border-bottom:1px solid #e0e0e0;">Récapitulatif</td></tr>
    <tr>
      <td style="padding:6px 0 0;font-size:12px;color:#5f6368;">Sous-total</td>
      <td style="padding:6px 0 0;text-align:right;font-size:12px;color:#202124;">${fmt(order.total_amount)}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;font-size:12px;color:#5f6368;">TVA</td>
      <td style="padding:4px 0;text-align:right;font-size:12px;color:#202124;">Non applicable</td>
    </tr>
    <tr>
      <td style="padding:4px 0;font-size:12px;color:#5f6368;">Paiement</td>
      <td style="padding:4px 0;text-align:right;font-size:12px;color:#202124;">${paymentLabel(order.payment_method)}</td>
    </tr>
    <tr>
      <td colspan="2"><div style="height:1px;background:#e0e0e0;margin:10px 0;"></div></td>
    </tr>
    <tr>
      <td style="font-size:13px;font-weight:700;color:#202124;">Total FCFA</td>
      <td style="text-align:right;font-size:20px;font-weight:700;color:#202124;white-space:nowrap;">${fmt(order.total_amount)}</td>
    </tr>
  </table>`;

// ─── STATUS LINE ──────────────────────────────────────────────────────────────
const statusLine = (order: any, paid: boolean) => {
  if (paid) return "Paiement Mobile Money confirmé — commande en préparation";
  if (order.payment_method === "orange_money" || order.payment_method === "mtn_momo")
    return "En attente de confirmation du paiement Mobile Money";
  return "Commande enregistrée — paiement à la livraison";
};

// ─── EMAIL PRINCIPAL ─────────────────────────────────────────────────────────
const buildEmail = (order: any, items: any[], name: string, paid = false) => {
  const ref  = order.id.slice(0, 8).toUpperCase();
  const date = fmtDate(order.created_at || null);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Facture #${ref} — OFS</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
<tr><td align="center" style="padding:40px 20px;">
<table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;">

  <!-- EN-TÊTE : Logo + Titre gauche / Adresse droite -->
  <tr>
    <td style="padding-bottom:32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;width:60%;">
            <img src="${LOGO_URL}" height="44" alt="OFS"
              style="display:block;height:44px;max-width:160px;object-fit:contain;" />
            <div style="margin-top:20px;font-size:32px;font-weight:300;color:#202124;letter-spacing:-1px;line-height:1;">Facture</div>
            <div style="margin-top:8px;font-size:12px;color:#5f6368;">Numéro de commande : <span style="font-family:monospace;color:#202124;">#${ref}</span></div>
          </td>
          <td style="vertical-align:top;text-align:right;width:40%;">
            <div style="font-size:13px;font-weight:700;color:#202124;line-height:1.8;">
              Buyticle ETS<br>
              <span style="font-weight:400;font-size:12px;color:#5f6368;">
                OneFreestyle Store<br>
                Bonamoussadi, Douala<br>
                Cameroun<br>
                onefreestyle.store
              </span>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td><div style="height:1px;background:#e0e0e0;"></div></td></tr>

  <!-- FACTURÉ À -->
  <tr>
    <td style="padding:24px 0;">
      <div style="font-size:12px;font-weight:700;color:#202124;margin-bottom:8px;">Facturé à</div>
      <div style="font-size:13px;color:#202124;line-height:1.8;">
        ${name}<br>
        <span style="color:#5f6368;">${order.client_phone || ""}<br>
        ${order.client_address || "Adresse à confirmer"}</span>
      </div>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td><div style="height:1px;background:#e0e0e0;"></div></td></tr>

  <!-- DÉTAILS + TOTAL -->
  <tr>
    <td style="padding:24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <!-- Détails (gauche) -->
          <td style="vertical-align:top;width:50%;padding-right:32px;">
            <div style="font-size:12px;font-weight:700;color:#202124;margin-bottom:12px;">Détails</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#5f6368;padding-bottom:5px;">Numéro de commande</td>
                <td style="font-size:12px;color:#202124;text-align:right;font-family:monospace;padding-bottom:5px;">#${ref}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#5f6368;padding-bottom:5px;">Date</td>
                <td style="font-size:12px;color:#202124;text-align:right;padding-bottom:5px;">${date}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#5f6368;padding-bottom:5px;">Paiement</td>
                <td style="font-size:12px;color:#202124;text-align:right;padding-bottom:5px;">${paymentLabel(order.payment_method)}</td>
              </tr>
            </table>
          </td>
          <!-- Total (droite) -->
          <td style="vertical-align:top;width:50%;padding-left:32px;border-left:1px solid #e0e0e0;">
            <div style="font-size:12px;font-weight:700;color:#202124;margin-bottom:12px;">OFS Payment</div>
            <div style="font-size:12px;color:#5f6368;margin-bottom:4px;">${statusLine(order, paid)}</div>
            <div style="height:1px;background:#e0e0e0;margin:12px 0;"></div>
            <div style="font-size:12px;color:#5f6368;margin-bottom:4px;">Total FCFA</div>
            <div style="font-size:26px;font-weight:700;color:#202124;">${fmt(order.total_amount)}</div>
            <div style="margin-top:16px;">${recap(order)}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td><div style="height:1px;background:#e0e0e0;"></div></td></tr>

  <!-- ARTICLES -->
  <tr><td style="padding:24px 0 0;">${itemsTable(items)}</td></tr>

  <!-- NOTE -->
  <tr>
    <td style="padding:32px 0 24px;font-size:12px;color:#5f6368;line-height:1.7;">
      Une facture détaillée vous sera transmise séparément par notre équipe.
      Pour toute question relative à cette commande, contactez notre support.
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td><div style="height:1px;background:#e0e0e0;"></div></td></tr>

  <!-- CTA -->
  <tr>
    <td style="padding:24px 0;text-align:center;">
      <a href="https://wa.me/${SUPPORT_PHONE}"
        style="display:inline-block;background:#1a73e8;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:4px;font-size:13px;font-weight:500;">
        Contacter le support
      </a>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td><div style="height:1px;background:#e0e0e0;"></div></td></tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:20px 0;font-size:11px;color:#9aa0a6;line-height:1.8;text-align:center;">
      © ${new Date().getFullYear()} OFS — OneFreestyle Store · onefreestyle.store · Douala, Cameroun<br>
      Buyticle ETS · RCCM : CM-DLA-01-2025-A10-01482 · NIU : P070418499910G
    </td>
  </tr>

</table>
</td></tr></table>
</body></html>`;
};

// ─── EMAIL EXPÉDITION ─────────────────────────────────────────────────────────
const buildShippedEmail = (order: any, items: any[], name: string) => {
  const ref  = order.id.slice(0, 8).toUpperCase();
  const date = fmtDate(order.created_at || null);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Commande #${ref} en route — OFS</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
<tr><td align="center" style="padding:40px 20px;">
<table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;">

  <!-- EN-TÊTE -->
  <tr>
    <td style="padding-bottom:32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;width:60%;">
            <img src="${LOGO_URL}" height="44" alt="OFS"
              style="display:block;height:44px;max-width:160px;object-fit:contain;" />
            <div style="margin-top:20px;font-size:32px;font-weight:300;color:#202124;letter-spacing:-1px;line-height:1;">Avis d'expédition</div>
            <div style="margin-top:8px;font-size:12px;color:#5f6368;">Numéro de commande : <span style="font-family:monospace;color:#202124;">#${ref}</span></div>
          </td>
          <td style="vertical-align:top;text-align:right;width:40%;">
            <div style="font-size:13px;font-weight:700;color:#202124;line-height:1.8;">
              Buyticle ETS<br>
              <span style="font-weight:400;font-size:12px;color:#5f6368;">
                OneFreestyle Store<br>
                Bonamoussadi, Douala<br>
                Cameroun<br>
                onefreestyle.store
              </span>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td><div style="height:1px;background:#e0e0e0;"></div></td></tr>

  <!-- STATUT -->
  <tr>
    <td style="padding:20px 0;">
      <div style="font-size:14px;font-weight:600;color:#202124;">Votre commande est en route !</div>
      <div style="font-size:12px;color:#5f6368;margin-top:4px;">
        Livraison à : ${order.client_address || "—"}
      </div>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td><div style="height:1px;background:#e0e0e0;"></div></td></tr>

  <!-- FACTURÉ À + DÉTAILS -->
  <tr>
    <td style="padding:24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;width:50%;padding-right:32px;">
            <div style="font-size:12px;font-weight:700;color:#202124;margin-bottom:8px;">Facturé à</div>
            <div style="font-size:13px;color:#202124;line-height:1.8;">
              ${name}<br>
              <span style="color:#5f6368;">
                ${order.client_phone || ""}<br>
                ${order.client_address || "—"}
              </span>
            </div>
          </td>
          <td style="vertical-align:top;width:50%;padding-left:32px;border-left:1px solid #e0e0e0;">
            <div style="font-size:12px;font-weight:700;color:#202124;margin-bottom:12px;">Détails</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#5f6368;padding-bottom:5px;">Numéro de commande</td>
                <td style="font-size:12px;color:#202124;text-align:right;font-family:monospace;padding-bottom:5px;">#${ref}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#5f6368;padding-bottom:5px;">Date</td>
                <td style="font-size:12px;color:#202124;text-align:right;padding-bottom:5px;">${date}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td><div style="height:1px;background:#e0e0e0;"></div></td></tr>

  <!-- ARTICLES -->
  <tr><td style="padding:24px 0 0;">${itemsTable(items)}</td></tr>

  <!-- TOTAUX -->
  <tr>
    <td style="padding:16px 0 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:50%;"></td>
          <td style="width:50%;">${recap(order)}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td><div style="height:1px;background:#e0e0e0;"></div></td></tr>

  <!-- CTA -->
  <tr>
    <td style="padding:24px 0;text-align:center;">
      <a href="${SITE_URL}/track"
        style="display:inline-block;background:#1a73e8;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:4px;font-size:13px;font-weight:500;margin-right:12px;">
        Suivre ma commande
      </a>
      <a href="https://wa.me/${SUPPORT_PHONE}"
        style="display:inline-block;background:#ffffff;color:#1a73e8;text-decoration:none;padding:10px 24px;border-radius:4px;font-size:13px;font-weight:500;border:1px solid #dadce0;">
        Contacter le support
      </a>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td><div style="height:1px;background:#e0e0e0;"></div></td></tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:20px 0;font-size:11px;color:#9aa0a6;line-height:1.8;text-align:center;">
      © ${new Date().getFullYear()} OFS — OneFreestyle Store · onefreestyle.store · Douala, Cameroun<br>
      Buyticle ETS · RCCM : CM-DLA-01-2025-A10-01482 · NIU : P070418499910G
    </td>
  </tr>

</table>
</td></tr></table>
</body></html>`;
};

// ─── SEND VIA RESEND ─────────────────────────────────────────────────────────
const sendResend = async (to: string, subject: string, html: string) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
};

// ─── HANDLER ─────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin":  ALLOWED_ORIGINS.has(origin) ? origin : "https://www.onefreestyle.store",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const { type, order_id } = await req.json();
    if (!type || !order_id) throw new Error("Missing type or order_id");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SRVKEY);

    const [{ data: order, error: oErr }, { data: items }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", order_id).maybeSingle(),
      supabase.from("order_items").select("*").eq("order_id", order_id),
    ]);

    if (oErr || !order) throw new Error("Order not found");
    if (!order.user_id)  throw new Error("Guest order — no email to send");

    const { data: { user }, error: uErr } = await supabase.auth.admin.getUserById(order.user_id);
    if (uErr || !user?.email) throw new Error("User email not found");

    const email = user.email;
    const name  = order.client_name || user.user_metadata?.full_name || "Client";
    const itms  = items || [];
    const ref   = order.id.slice(0, 8).toUpperCase();

    let subject: string, html: string;
    if (type === "order_confirmation") {
      subject = `Commande reçue #${ref} — OFS / Buyticle ETS`;
      html    = buildEmail(order, itms, name, false);
    } else if (type === "payment_confirmed") {
      subject = `Paiement confirmé #${ref} — OFS / Buyticle ETS`;
      html    = buildEmail({ ...order, status: "paid" }, itms, name, true);
    } else if (type === "shipped") {
      subject = `En route ! Commande #${ref} — OFS Cameroun`;
      html    = buildShippedEmail(order, itms, name);
    } else {
      throw new Error(`Unknown type: ${type}`);
    }

    await sendResend(email, subject, html);
    console.log(`[send-email] ${type} → ${email}`);

    return new Response(JSON.stringify({ ok: true, to: email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[send-email]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
