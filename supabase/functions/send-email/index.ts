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
  method === "cash"        ? "Paiement à la livraison" :
  method || "À la livraison";

// ─── ITEMS TABLE ──────────────────────────────────────────────────────────────
const itemsTable = (items: any[]) => {
  const rows = items.map((item: any) => {
    const subtotal = item.unit_price * item.quantity;
    const variantLine = [item.selected_color, item.selected_size].filter(Boolean).join(" · ");
    return `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #e8e8e8;vertical-align:top;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            ${item.product_img ? `
            <td style="width:64px;padding-right:16px;vertical-align:top;">
              <img src="${item.product_img}" width="64" height="64"
                style="display:block;border-radius:6px;border:1px solid #e8e8e8;object-fit:cover;" />
            </td>` : ""}
            <td style="vertical-align:top;">
              <div style="font-size:13px;font-weight:600;color:#1a1a1a;line-height:1.5;">${item.product_name}</div>
              ${variantLine ? `<div style="font-size:11px;color:#888;margin-top:3px;">${variantLine}</div>` : ""}
              <div style="font-size:11px;color:#888;margin-top:2px;">Qté : ${item.quantity}</div>
            </td>
          </tr>
        </table>
      </td>
      <td style="padding:16px 0 16px 16px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;font-size:13px;color:#1a1a1a;white-space:nowrap;font-weight:600;">${fmt(subtotal)}</td>
    </tr>`;
  }).join("");

  return `
  <table width="100%" cellpadding="0" cellspacing="0">
    <thead>
      <tr style="border-bottom:2px solid #1a1a1a;">
        <th style="padding:10px 0;text-align:left;font-size:11px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1px;">Description</th>
        <th style="padding:10px 0 10px 16px;text-align:right;font-size:11px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1px;">Montant (FCFA)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
};

// ─── TOTALS BLOCK ─────────────────────────────────────────────────────────────
const totalsBlock = (order: any) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
    <tr>
      <td style="padding:6px 0;font-size:12px;color:#666;">Sous-total</td>
      <td style="padding:6px 0;text-align:right;font-size:12px;color:#333;">${fmt(order.total_amount)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:12px;color:#666;">TVA</td>
      <td style="padding:6px 0;text-align:right;font-size:12px;color:#333;">Non applicable</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:12px;color:#666;">Paiement</td>
      <td style="padding:6px 0;text-align:right;font-size:12px;color:#333;">${paymentLabel(order.payment_method)}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:4px 0;">
        <div style="height:2px;background:#1a1a1a;margin:8px 0;"></div>
      </td>
    </tr>
    <tr>
      <td style="padding:4px 0;font-size:14px;font-weight:700;color:#1a1a1a;">Total FCFA</td>
      <td style="padding:4px 0;text-align:right;font-size:22px;font-weight:900;color:#1a1a1a;white-space:nowrap;">${fmt(order.total_amount)}</td>
    </tr>
  </table>`;

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const statusBadge = (order: any, paid: boolean) => {
  if (paid) return `<span style="display:inline-block;background:#d4edda;color:#155724;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;">✅ Paiement confirmé</span>`;
  if (order.payment_method === "orange_money" || order.payment_method === "mtn_momo")
    return `<span style="display:inline-block;background:#fff3cd;color:#856404;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;">⏳ En attente paiement Mobile Money</span>`;
  return `<span style="display:inline-block;background:#e8f4fd;color:#0c5460;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;">🛍️ Commande enregistrée · paiement à la livraison</span>`;
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
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;">

  <!-- Barre top orange -->
  <tr><td style="background:#FF9900;height:5px;font-size:0;">&nbsp;</td></tr>

  <!-- EN-TÊTE : Logo gauche / Adresse droite -->
  <tr>
    <td style="padding:36px 40px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">
            <img src="${LOGO_URL}" height="48" alt="OFS"
              style="display:block;height:48px;max-width:180px;object-fit:contain;" />
            <div style="margin-top:16px;font-size:28px;font-weight:300;color:#1a1a1a;letter-spacing:-0.5px;">Facture</div>
            <div style="margin-top:6px;font-size:13px;color:#666;">Numéro de commande : <strong style="color:#1a1a1a;font-family:monospace;">#${ref}</strong></div>
          </td>
          <td style="vertical-align:top;text-align:right;">
            <div style="font-size:13px;font-weight:700;color:#1a1a1a;">Buyticle ETS</div>
            <div style="font-size:12px;color:#666;line-height:2;margin-top:4px;">
              OneFreestyle Store<br>
              Bonamoussadi, Douala<br>
              Cameroun<br>
              onefreestyle.store
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e8e8e8;"></div></td></tr>

  <!-- FACTURÉ À -->
  <tr>
    <td style="padding:24px 40px;">
      <div style="font-size:11px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Facturé à</div>
      <div style="font-size:13px;color:#333;line-height:1.9;">
        <strong style="color:#1a1a1a;">${name}</strong><br>
        ${order.client_phone || ""}<br>
        ${order.client_address || "Adresse à confirmer"}
      </div>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e8e8e8;"></div></td></tr>

  <!-- DÉTAILS + STATUT/TOTAL -->
  <tr>
    <td style="padding:24px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <!-- Détails (gauche) -->
          <td style="width:55%;vertical-align:top;padding-right:24px;">
            <div style="font-size:11px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Détails</div>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-size:12px;color:#666;padding-bottom:6px;">Numéro de commande</td>
                <td style="font-size:12px;color:#1a1a1a;text-align:right;font-family:monospace;font-weight:600;padding-bottom:6px;">#${ref}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#666;padding-bottom:6px;">Date</td>
                <td style="font-size:12px;color:#1a1a1a;text-align:right;padding-bottom:6px;">${date}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#666;padding-bottom:6px;">Paiement</td>
                <td style="font-size:12px;color:#1a1a1a;text-align:right;padding-bottom:6px;">${paymentLabel(order.payment_method)}</td>
              </tr>
            </table>
          </td>
          <!-- Total (droite) -->
          <td style="width:45%;vertical-align:top;padding-left:24px;border-left:1px solid #e8e8e8;">
            <div style="font-size:11px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">OFS Payment</div>
            <div style="margin-bottom:12px;">${statusBadge(order, paid)}</div>
            <div style="height:1px;background:#e8e8e8;margin:12px 0;"></div>
            <div style="font-size:12px;color:#666;margin-bottom:4px;">Total FCFA</div>
            <div style="font-size:24px;font-weight:900;color:#1a1a1a;">${fmt(order.total_amount)}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e8e8e8;"></div></td></tr>

  <!-- ARTICLES -->
  <tr>
    <td style="padding:24px 40px 0;">
      ${itemsTable(items)}
    </td>
  </tr>

  <!-- TOTAUX -->
  <tr>
    <td style="padding:8px 40px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:55%;"></td>
          <td style="width:45%;padding-left:16px;">
            ${totalsBlock(order)}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e8e8e8;"></div></td></tr>

  <!-- NOTE -->
  <tr>
    <td style="padding:20px 40px;font-size:11px;color:#999;line-height:1.8;">
      Une facture détaillée vous sera transmise séparément par notre équipe.
      Pour toute question relative à cette commande, contactez notre support.
    </td>
  </tr>

  <!-- CTA SUPPORT -->
  <tr>
    <td style="padding:0 40px 32px;text-align:center;">
      <a href="https://wa.me/${SUPPORT_PHONE}"
        style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:4px;font-weight:700;font-size:13px;">
        Contacter le support
      </a>
    </td>
  </tr>

  <!-- SÉPARATEUR -->
  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e8e8e8;"></div></td></tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:20px 40px;text-align:center;font-size:11px;color:#aaa;line-height:1.8;">
      © ${new Date().getFullYear()} OFS — OneFreestyle Store · onefreestyle.store · Douala, Cameroun<br>
      Buyticle ETS · RCCM : CM-DLA-01-2025-A10-01482 · NIU : P070418499910G
    </td>
  </tr>

  <!-- Barre bas orange -->
  <tr><td style="background:#FF9900;height:4px;font-size:0;">&nbsp;</td></tr>

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
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;">

  <tr><td style="background:#FF9900;height:5px;font-size:0;">&nbsp;</td></tr>

  <!-- EN-TÊTE -->
  <tr>
    <td style="padding:36px 40px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">
            <img src="${LOGO_URL}" height="48" alt="OFS"
              style="display:block;height:48px;max-width:180px;object-fit:contain;" />
            <div style="margin-top:16px;font-size:28px;font-weight:300;color:#1a1a1a;letter-spacing:-0.5px;">Avis d'expédition</div>
            <div style="margin-top:6px;font-size:13px;color:#666;">Numéro de commande : <strong style="color:#1a1a1a;font-family:monospace;">#${ref}</strong></div>
          </td>
          <td style="vertical-align:top;text-align:right;">
            <div style="font-size:13px;font-weight:700;color:#1a1a1a;">Buyticle ETS</div>
            <div style="font-size:12px;color:#666;line-height:2;margin-top:4px;">
              OneFreestyle Store<br>
              Bonamoussadi, Douala<br>
              Cameroun<br>
              onefreestyle.store
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- STATUT -->
  <tr>
    <td style="padding:0 40px 24px;">
      <div style="background:#d4edda;border-radius:6px;padding:16px 20px;">
        <div style="font-size:16px;font-weight:700;color:#155724;">🚚 Votre commande est en route !</div>
        <div style="font-size:12px;color:#155724;margin-top:4px;">
          Livraison à : <strong>${order.client_address || "—"}</strong>
        </div>
      </div>
    </td>
  </tr>

  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e8e8e8;"></div></td></tr>

  <!-- FACTURÉ À + DÉTAILS -->
  <tr>
    <td style="padding:24px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:50%;vertical-align:top;padding-right:24px;">
            <div style="font-size:11px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Facturé à</div>
            <div style="font-size:13px;color:#333;line-height:1.9;">
              <strong style="color:#1a1a1a;">${name}</strong><br>
              ${order.client_phone || ""}<br>
              ${order.client_address || "—"}
            </div>
          </td>
          <td style="width:50%;vertical-align:top;padding-left:24px;border-left:1px solid #e8e8e8;">
            <div style="font-size:11px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Détails</div>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-size:12px;color:#666;padding-bottom:6px;">Commande</td>
                <td style="font-size:12px;color:#1a1a1a;text-align:right;font-family:monospace;font-weight:600;padding-bottom:6px;">#${ref}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#666;padding-bottom:6px;">Date</td>
                <td style="font-size:12px;color:#1a1a1a;text-align:right;padding-bottom:6px;">${date}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e8e8e8;"></div></td></tr>

  <!-- ARTICLES -->
  <tr>
    <td style="padding:24px 40px 0;">
      ${itemsTable(items)}
    </td>
  </tr>

  <!-- TOTAUX -->
  <tr>
    <td style="padding:8px 40px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:55%;"></td>
          <td style="width:45%;padding-left:16px;">
            ${totalsBlock(order)}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e8e8e8;"></div></td></tr>

  <!-- CTA -->
  <tr>
    <td style="padding:28px 40px;text-align:center;">
      <a href="${SITE_URL}/track"
        style="display:inline-block;background:#FF9900;color:#1a1a1a;text-decoration:none;padding:12px 28px;border-radius:4px;font-weight:700;font-size:13px;margin-right:12px;">
        📦 Suivre ma commande
      </a>
      <a href="https://wa.me/${SUPPORT_PHONE}"
        style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:4px;font-weight:700;font-size:13px;">
        Contacter le support
      </a>
    </td>
  </tr>

  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e8e8e8;"></div></td></tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:20px 40px;text-align:center;font-size:11px;color:#aaa;line-height:1.8;">
      © ${new Date().getFullYear()} OFS — OneFreestyle Store · onefreestyle.store · Douala, Cameroun<br>
      Buyticle ETS · RCCM : CM-DLA-01-2025-A10-01482 · NIU : P070418499910G
    </td>
  </tr>

  <tr><td style="background:#FF9900;height:4px;font-size:0;">&nbsp;</td></tr>

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
