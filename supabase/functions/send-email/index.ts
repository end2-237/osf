// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY  = Deno.env.get("RESEND_API_KEY")              || "";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")                || "";
const SUPABASE_SRVKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")   || "";
const FROM_EMAIL      = "OFS Cameroun <noreply@onefreestyle.store>";
const SITE_URL        = "https://www.onefreestyle.store";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR") + " FCFA";

const paymentLabel = (method: string) =>
  method === "orange_money" ? "Orange Money"
  : method === "mtn_momo"  ? "MTN MoMo"
  : method === "cash"      ? "Paiement à la livraison"
  : method || "À la livraison";

// ─── HTML WRAPPER ────────────────────────────────────────────────────────────
const wrap = (content: string) => `
<!DOCTYPE html><html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <tr>
    <td style="background:#131921;padding:24px 32px;text-align:center;">
      <h1 style="margin:0;color:#FF9900;font-size:32px;font-weight:900;letter-spacing:3px;">OFS</h1>
      <p style="margin:4px 0 0;color:#adb5bd;font-size:11px;letter-spacing:1.5px;">ONEFREESTYLE STORE · CAMEROUN</p>
    </td>
  </tr>
  <tr><td style="padding:32px;">${content}</td></tr>
  <tr>
    <td style="background:#f8f9fa;padding:20px 32px;text-align:center;border-top:1px solid #e9ecef;">
      <p style="margin:0;color:#6c757d;font-size:12px;">© 2026 OFS Cameroun · <a href="${SITE_URL}" style="color:#FF9900;text-decoration:none;">onefreestyle.store</a></p>
      <p style="margin:6px 0 0;color:#adb5bd;font-size:11px;">Douala, Cameroun 🇨🇲</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body></html>`;

// ─── ITEMS TABLE ─────────────────────────────────────────────────────────────
const itemsTable = (items: any[]) => {
  const rows = items.map((item: any) => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:10px 6px;width:68px;vertical-align:top;">
        ${item.product_img ? `<img src="${item.product_img}" width="56" height="56" style="object-fit:cover;border-radius:4px;display:block;" />` : ""}
      </td>
      <td style="padding:10px 6px;vertical-align:top;">
        <div style="font-weight:bold;color:#0F1111;font-size:13px;line-height:1.4;">${item.product_name}</div>
        ${item.selected_color ? `<div style="color:#565959;font-size:11px;margin-top:3px;">Couleur : ${item.selected_color}</div>` : ""}
        ${item.selected_size  ? `<div style="color:#565959;font-size:11px;">Taille : ${item.selected_size}</div>` : ""}
        <div style="color:#565959;font-size:11px;">Qté : ${item.quantity}</div>
      </td>
      <td style="padding:10px 6px;text-align:right;vertical-align:top;font-weight:bold;color:#0F1111;white-space:nowrap;font-size:13px;">
        ${fmt(item.unit_price * item.quantity)}
      </td>
    </tr>`).join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin:20px 0;">
    <thead><tr style="background:#f8f9fa;">
      <th style="padding:10px 6px;text-align:left;font-size:11px;color:#565959;" colspan="2">ARTICLES</th>
      <th style="padding:10px 6px;text-align:right;font-size:11px;color:#565959;">PRIX</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
};

// ─── TEMPLATES ───────────────────────────────────────────────────────────────
const tplConfirmation = (order: any, items: any[], name: string, paid = false) => wrap(`
  <h2 style="margin:0 0 8px;color:#0F1111;font-size:22px;">${paid ? "✅ Paiement confirmé !" : "🛍️ Commande reçue !"}</h2>
  <p style="margin:0 0 24px;color:#565959;font-size:14px;line-height:1.6;">
    Bonjour <strong>${name}</strong>,
    ${paid
      ? "votre paiement Mobile Money a bien été reçu. Votre commande est en cours de préparation."
      : order.payment_method === "orange_money" || order.payment_method === "mtn_momo"
      ? "votre commande a été enregistrée. En attente de confirmation du paiement Mobile Money."
      : "votre commande a bien été enregistrée. Nous vous contacterons rapidement pour confirmer la livraison."}
  </p>

  <div style="background:#f8f9fa;border-radius:6px;padding:16px;margin-bottom:8px;">
    <p style="margin:0;font-size:12px;color:#565959;">Référence commande</p>
    <p style="margin:4px 0 0;font-size:20px;font-weight:900;color:#0F1111;font-family:monospace;letter-spacing:2px;">#${order.id.slice(0, 8).toUpperCase()}</p>
  </div>

  ${itemsTable(items)}

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:5px 0;color:#565959;font-size:13px;">Livraison à</td>
      <td style="padding:5px 0;text-align:right;font-size:13px;font-weight:bold;color:#0F1111;">${order.client_address || "À confirmer"}</td>
    </tr>
    <tr>
      <td style="padding:5px 0;color:#565959;font-size:13px;">Paiement</td>
      <td style="padding:5px 0;text-align:right;font-size:13px;font-weight:bold;color:#0F1111;">${paymentLabel(order.payment_method)}</td>
    </tr>
    <tr style="border-top:2px solid #0F1111;">
      <td style="padding:12px 0 0;font-size:15px;font-weight:bold;color:#0F1111;">Total</td>
      <td style="padding:12px 0 0;text-align:right;font-size:22px;font-weight:900;color:#FF9900;">${fmt(order.total_amount)}</td>
    </tr>
  </table>

  <p style="margin:28px 0 8px;color:#565959;font-size:13px;">Des questions ? Contactez-nous sur WhatsApp :</p>
  <a href="https://wa.me/237000000000" style="display:inline-block;background:#25D366;color:white;text-decoration:none;padding:13px 28px;border-radius:6px;font-weight:bold;font-size:14px;">
    📱 Contacter le support
  </a>
`);

const tplShipped = (order: any, items: any[], name: string) => wrap(`
  <h2 style="margin:0 0 8px;color:#0F1111;font-size:22px;">🚚 Votre commande est en route !</h2>
  <p style="margin:0 0 24px;color:#565959;font-size:14px;line-height:1.6;">
    Bonjour <strong>${name}</strong>, votre commande est en cours de livraison. Vous serez contacté(e) à l'arrivée.
  </p>

  <div style="background:#f8f9fa;border-radius:6px;padding:16px;margin-bottom:8px;">
    <p style="margin:0;font-size:12px;color:#565959;">Référence commande</p>
    <p style="margin:4px 0 0;font-size:20px;font-weight:900;color:#0F1111;font-family:monospace;letter-spacing:2px;">#${order.id.slice(0, 8).toUpperCase()}</p>
    <p style="margin:6px 0 0;font-size:13px;color:#565959;">Livraison à : <strong style="color:#0F1111;">${order.client_address || "—"}</strong></p>
  </div>

  ${itemsTable(items)}

  <p style="margin:24px 0 8px;color:#565959;font-size:13px;">Suivez votre commande :</p>
  <a href="${SITE_URL}/track" style="display:inline-block;background:#FF9900;color:#0F1111;text-decoration:none;padding:13px 28px;border-radius:6px;font-weight:bold;font-size:14px;">
    📦 Suivre ma commande
  </a>
`);

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

    let subject: string, html: string;
    if (type === "order_confirmation") {
      subject = `✅ Commande reçue #${order.id.slice(0, 8).toUpperCase()} — OFS Cameroun`;
      html    = tplConfirmation(order, itms, name, false);
    } else if (type === "payment_confirmed") {
      subject = `💚 Paiement confirmé #${order.id.slice(0, 8).toUpperCase()} — OFS Cameroun`;
      html    = tplConfirmation(order, itms, name, true);
    } else if (type === "shipped") {
      subject = `🚚 En route ! Commande #${order.id.slice(0, 8).toUpperCase()} — OFS`;
      html    = tplShipped(order, itms, name);
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
