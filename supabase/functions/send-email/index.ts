// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY  = Deno.env.get("RESEND_API_KEY")            || "";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")              || "";
const SUPABASE_SRVKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FROM_EMAIL      = "OFS Cameroun <noreply@onefreestyle.store>";
const SITE_URL        = "https://www.onefreestyle.store";
const SUPPORT_PHONE   = "237696995879";

const ALLOWED_ORIGINS = new Set([
  "https://www.onefreestyle.store",
  "https://onefreestyle.store",
  "http://localhost:5173",
  "http://localhost:4173",
]);

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin":  ALLOWED_ORIGINS.has(origin) ? origin : "https://www.onefreestyle.store",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
});

const fmt     = (n: number) => Math.round(n).toLocaleString("fr-FR") + " FCFA";
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

const paymentLabel = (method: string) =>
  method === "orange_money" ? "Orange Money" :
  method === "mtn_momo"    ? "MTN MoMo"     :
  method === "cash"        ? "Paiement à la livraison" :
  method || "À la livraison";

// ─── MASTER TEMPLATE ─────────────────────────────────────────────────────────
const wrap = (content: string, ref: string, date: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>OFS — Confirmation de commande</title>
</head>
<body style="margin:0;padding:0;background:#ECECEC;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ECECEC;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;">

  <!-- ══ BANDE SUPÉRIEURE COULEUR ══ -->
  <tr>
    <td style="background:#FF9900;height:6px;font-size:0;">&nbsp;</td>
  </tr>

  <!-- ══ EN-TÊTE SOCIÉTÉ ══ -->
  <tr>
    <td style="background:#131921;padding:28px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <!-- Colonne gauche : identité société mère -->
          <td style="vertical-align:top;">
            <div style="color:#FF9900;font-size:22px;font-weight:900;letter-spacing:3px;line-height:1;">BUYTICLE</div>
            <div style="color:#adb5bd;font-size:9px;letter-spacing:2px;margin-top:2px;">ENTREPRISE INDIVIDUELLE (ETS)</div>
            <div style="margin-top:12px;color:#6c757d;font-size:10px;line-height:1.8;">
              Bonamoussadi, Douala — Cameroun<br>
              Tél : (+237) 696 99 58 79<br>
              RCCM : CM-DLA-01-2025-A10-01482<br>
              NIU : P070418499910G
            </div>
          </td>
          <!-- Colonne droite : plateforme OFS -->
          <td style="vertical-align:top;text-align:right;">
            <div style="display:inline-block;background:#FF9900;border-radius:4px;padding:6px 14px;">
              <div style="color:#131921;font-size:20px;font-weight:900;letter-spacing:4px;line-height:1;">OFS</div>
              <div style="color:#131921;font-size:7px;letter-spacing:1.5px;font-weight:700;margin-top:1px;">ONEFREESTYLE STORE</div>
            </div>
            <div style="color:#adb5bd;font-size:9px;margin-top:8px;">onefreestyle.store</div>
            <div style="color:#6c757d;font-size:9px;margin-top:2px;">Une plateforme Buyticle ETS</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ══ BANDEAU TITRE COMMANDE ══ -->
  <tr>
    <td style="background:#1a2332;padding:14px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px;">CONFIRMATION DE COMMANDE</div>
          </td>
          <td style="text-align:right;">
            <span style="background:#FF9900;color:#131921;font-size:11px;font-weight:900;padding:4px 10px;border-radius:3px;letter-spacing:1px;font-family:monospace;">#${ref}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ══ BLOC INFOS COMMANDE / CLIENT ══ -->
  <tr>
    <td style="padding:28px 36px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:50%;vertical-align:top;padding-right:20px;">
            <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#FF9900;margin-bottom:8px;border-bottom:1px solid #FF9900;padding-bottom:4px;">ÉMETTEUR</div>
            <div style="font-size:12px;color:#333;line-height:1.8;">
              <strong style="color:#131921;">Buyticle ETS</strong><br>
              Plateforme OFS — OneFreestyle Store<br>
              Bonamoussadi, Douala<br>
              (+237) 696 99 58 79
            </div>
          </td>
          <td style="width:50%;vertical-align:top;padding-left:20px;border-left:1px solid #f0f0f0;">
            <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#FF9900;margin-bottom:8px;border-bottom:1px solid #FF9900;padding-bottom:4px;">FACTURÉ À</div>
            <div style="font-size:12px;color:#333;line-height:1.8;" id="client-block">
              ${content}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ══ SÉPARATEUR ══ -->
  <tr><td style="padding:20px 36px 0;"><div style="height:1px;background:#e9ecef;"></div></td></tr>

  <!-- Date ligne -->
  <tr>
    <td style="padding:10px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:11px;color:#888;">Date de commande</td>
          <td style="text-align:right;font-size:11px;color:#333;font-weight:600;">${date}</td>
        </tr>
      </table>
    </td>
  </tr>

  <tr><td style="padding:0 36px;"><div style="height:1px;background:#e9ecef;"></div></td></tr>

</table>
</td></tr></table>
</body></html>`;

// ─── ITEMS TABLE — style facture ─────────────────────────────────────────────
const itemsTable = (items: any[]) => {
  const rows = items.map((item: any) => {
    const subtotal = item.unit_price * item.quantity;
    return `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            ${item.product_img ? `<td style="width:50px;padding-right:10px;vertical-align:top;"><img src="${item.product_img}" width="44" height="44" style="object-fit:cover;border-radius:3px;display:block;border:1px solid #eee;" /></td>` : ""}
            <td style="vertical-align:top;">
              <div style="font-size:12px;font-weight:700;color:#131921;line-height:1.4;">${item.product_name}</div>
              ${item.selected_color ? `<div style="font-size:10px;color:#888;margin-top:2px;">Couleur : ${item.selected_color}</div>` : ""}
              ${item.selected_size  ? `<div style="font-size:10px;color:#888;">Taille : ${item.selected_size}</div>` : ""}
            </td>
          </tr>
        </table>
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;font-size:12px;color:#555;">${item.quantity}</td>
      <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;text-align:right;vertical-align:middle;font-size:12px;color:#555;white-space:nowrap;">${fmt(item.unit_price)}</td>
      <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;text-align:right;vertical-align:middle;font-size:12px;font-weight:700;color:#131921;white-space:nowrap;">${fmt(subtotal)}</td>
    </tr>`;
  }).join("");

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0;border-top:2px solid #131921;">
    <thead>
      <tr style="background:#131921;">
        <th style="padding:10px 8px;text-align:left;font-size:9px;color:#FF9900;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">DÉSIGNATION</th>
        <th style="padding:10px 8px;text-align:center;font-size:9px;color:#FF9900;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">QTÉ</th>
        <th style="padding:10px 8px;text-align:right;font-size:9px;color:#FF9900;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">PRIX UNIT.</th>
        <th style="padding:10px 8px;text-align:right;font-size:9px;color:#FF9900;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">MONTANT</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
};

// ─── TOTAUX — style facture ───────────────────────────────────────────────────
const totalsBlock = (order: any) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e9ecef;">
    <tr>
      <td style="padding:8px 8px 4px;font-size:11px;color:#888;">Sous-total</td>
      <td style="padding:8px 8px 4px;text-align:right;font-size:11px;color:#555;">${fmt(order.total_amount)}</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;font-size:11px;color:#888;">TVA</td>
      <td style="padding:4px 8px;text-align:right;font-size:11px;color:#555;">Non applicable</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;font-size:11px;color:#888;">Mode de paiement</td>
      <td style="padding:4px 8px;text-align:right;font-size:11px;color:#555;">${paymentLabel(order.payment_method)}</td>
    </tr>
    <tr style="background:#131921;">
      <td style="padding:12px 8px;font-size:13px;font-weight:900;color:#FF9900;letter-spacing:1px;">NET À PAYER</td>
      <td style="padding:12px 8px;text-align:right;font-size:18px;font-weight:900;color:#FF9900;white-space:nowrap;">${fmt(order.total_amount)}</td>
    </tr>
  </table>`;

// ─── FOOTER DOCUMENT ─────────────────────────────────────────────────────────
const docFooter = (note: string) => `
  <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fff;">
    <!-- Note légale -->
    <tr>
      <td style="padding:20px 36px;background:#f8f9fa;border-top:1px solid #e9ecef;border-bottom:1px solid #e9ecef;">
        <div style="font-size:9px;color:#888;line-height:1.7;">
          ${note}
        </div>
      </td>
    </tr>
    <!-- CTA WhatsApp -->
    <tr>
      <td style="padding:24px 36px;text-align:center;">
        <div style="font-size:12px;color:#555;margin-bottom:14px;">Des questions sur votre commande ?</div>
        <a href="https://wa.me/${SUPPORT_PHONE}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:4px;font-weight:700;font-size:13px;letter-spacing:0.5px;">
          📱 Contacter le support WhatsApp
        </a>
        <div style="margin-top:14px;font-size:10px;color:#aaa;">Tél : (+237) 696 99 58 79</div>
      </td>
    </tr>
    <!-- Merci -->
    <tr>
      <td style="padding:0 36px 8px;text-align:center;">
        <div style="font-size:12px;color:#555;font-style:italic;">Merci pour votre confiance. L'équipe OFS vous souhaite une excellente expérience !</div>
      </td>
    </tr>
    <!-- Pied légal -->
    <tr>
      <td style="background:#131921;padding:16px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:9px;color:#6c757d;line-height:1.8;">
              <strong style="color:#FF9900;">Buyticle ETS</strong> — Entreprise Individuelle<br>
              Bonamoussadi, Douala, Cameroun · RCCM : CM-DLA-01-2025-A10-01482 · NIU : P070418499910G
            </td>
            <td style="text-align:right;vertical-align:middle;">
              <div style="color:#FF9900;font-size:14px;font-weight:900;letter-spacing:2px;">OFS</div>
              <div style="color:#6c757d;font-size:8px;letter-spacing:1px;">onefreestyle.store</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Bande bas -->
    <tr>
      <td style="background:#FF9900;height:4px;font-size:0;">&nbsp;</td>
    </tr>
  </table>`;

// ─── EMAIL PRINCIPAL ─────────────────────────────────────────────────────────
const buildEmail = (order: any, items: any[], name: string, paid = false) => {
  const ref  = order.id.slice(0, 8).toUpperCase();
  const date = fmtDate(order.created_at || null);

  const clientBlock = `
    <strong style="color:#131921;font-size:13px;">${name}</strong><br>
    <span style="font-size:11px;">${order.client_phone || ""}</span><br>
    <span style="font-size:11px;">${order.client_address || "À confirmer"}</span>`;

  const statusBanner = paid
    ? `<tr><td style="background:#d4edda;padding:12px 36px;border-left:4px solid #28a745;"><span style="font-size:13px;color:#155724;font-weight:700;">✅ Paiement Mobile Money confirmé — commande en préparation</span></td></tr>`
    : order.payment_method === "orange_money" || order.payment_method === "mtn_momo"
    ? `<tr><td style="background:#fff3cd;padding:12px 36px;border-left:4px solid #FF9900;"><span style="font-size:13px;color:#856404;font-weight:700;">⏳ En attente de confirmation du paiement Mobile Money</span></td></tr>`
    : `<tr><td style="background:#d1ecf1;padding:12px 36px;border-left:4px solid #17a2b8;"><span style="font-size:13px;color:#0c5460;font-weight:700;">🛍️ Commande enregistrée — paiement à la livraison</span></td></tr>`;

  const note = `TVA non applicable — régime simplifié d'imposition (Buyticle ETS).
    Merci de conserver ce document comme preuve de votre commande.
    Le retrait ou la livraison sera confirmé(e) par téléphone ou WhatsApp sous 24h.`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Commande #${ref} — OFS Cameroun</title>
</head>
<body style="margin:0;padding:0;background:#ECECEC;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ECECEC;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;">

  <!-- Bande top -->
  <tr><td style="background:#FF9900;height:5px;font-size:0;">&nbsp;</td></tr>

  <!-- En-tête -->
  <tr>
    <td style="background:#131921;padding:28px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">
            <div style="color:#FF9900;font-size:21px;font-weight:900;letter-spacing:3px;line-height:1;">BUYTICLE</div>
            <div style="color:#8892a0;font-size:9px;letter-spacing:2px;margin-top:3px;">ENTREPRISE INDIVIDUELLE (ETS)</div>
            <div style="margin-top:14px;color:#6c757d;font-size:10px;line-height:2;">
              Bonamoussadi, Douala — Cameroun<br>
              Tél : (+237) 696 99 58 79<br>
              RCCM : CM-DLA-01-2025-A10-01482<br>
              NIU : P070418499910G
            </div>
          </td>
          <td style="vertical-align:top;text-align:right;">
            <div>
              <div style="display:inline-block;background:#FF9900;border-radius:4px;padding:8px 16px;">
                <div style="color:#131921;font-size:22px;font-weight:900;letter-spacing:4px;line-height:1;">OFS</div>
                <div style="color:#131921;font-size:7px;letter-spacing:1.5px;font-weight:700;margin-top:2px;text-align:center;">ONEFREESTYLE STORE</div>
              </div>
            </div>
            <div style="color:#adb5bd;font-size:9px;margin-top:10px;">onefreestyle.store</div>
            <div style="color:#6c757d;font-size:9px;margin-top:3px;">Une plateforme Buyticle ETS</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Bandeau titre -->
  <tr>
    <td style="background:#1a2332;padding:13px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Confirmation de commande</td>
          <td style="text-align:right;">
            <span style="background:#FF9900;color:#131921;font-size:11px;font-weight:900;padding:4px 12px;border-radius:3px;letter-spacing:1px;font-family:monospace;">#${ref}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Statut -->
  ${statusBanner}

  <!-- Émetteur / Client -->
  <tr>
    <td style="padding:24px 36px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:48%;vertical-align:top;padding-right:16px;">
            <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#FF9900;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid #FF9900;">ÉMETTEUR</div>
            <div style="font-size:11px;color:#444;line-height:1.9;">
              <strong style="color:#131921;font-size:12px;">Buyticle ETS</strong><br>
              Plateforme OFS<br>
              Bonamoussadi, Douala<br>
              (+237) 696 99 58 79
            </div>
          </td>
          <td style="width:4%;"></td>
          <td style="width:48%;vertical-align:top;padding-left:16px;border-left:2px solid #f0f0f0;">
            <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:#FF9900;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid #FF9900;">FACTURÉ À</div>
            <div style="font-size:11px;color:#444;line-height:1.9;">
              <strong style="color:#131921;font-size:12px;">${name}</strong><br>
              ${order.client_phone || ""}<br>
              ${order.client_address || "Adresse à confirmer"}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Date -->
  <tr>
    <td style="padding:16px 36px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:10px;color:#888;">Date de commande</td>
          <td style="text-align:right;font-size:10px;color:#555;font-weight:600;">${date}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Séparateur -->
  <tr><td style="padding:16px 36px 0;"><div style="height:1px;background:#e0e0e0;"></div></td></tr>

  <!-- Tableau articles -->
  <tr>
    <td style="padding:0 36px;">
      ${itemsTable(items)}
    </td>
  </tr>

  <!-- Totaux -->
  <tr>
    <td style="padding:0 36px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:55%;"></td>
          <td style="width:45%;">
            ${totalsBlock(order)}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Note légale -->
  <tr>
    <td style="padding:0 36px 0;background:#f8f9fa;border-top:1px solid #e9ecef;border-bottom:1px solid #e9ecef;">
      <div style="padding:16px 0;font-size:9px;color:#999;line-height:1.8;">
        TVA non applicable — régime simplifié d'imposition (Buyticle ETS).
        Merci de conserver ce document comme preuve de votre commande.
        La livraison sera confirmée par téléphone ou WhatsApp sous 24h.
      </div>
    </td>
  </tr>

  <!-- CTA + Merci -->
  <tr>
    <td style="padding:28px 36px;text-align:center;">
      <div style="font-size:13px;color:#555;margin-bottom:16px;">Des questions sur votre commande ?</div>
      <a href="https://wa.me/${SUPPORT_PHONE}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:4px;font-weight:700;font-size:13px;">
        📱 Contacter le support WhatsApp
      </a>
      <div style="margin-top:20px;font-size:11px;color:#888;font-style:italic;">
        Merci pour votre confiance. L'équipe OFS vous souhaite une excellente expérience !
      </div>
    </td>
  </tr>

  <!-- Footer légal -->
  <tr>
    <td style="background:#131921;padding:18px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-size:9px;color:#6c757d;line-height:1.9;">
              <strong style="color:#FF9900;">Buyticle ETS</strong> — Entreprise Individuelle<br>
              Bonamoussadi, Douala, Cameroun<br>
              RCCM : CM-DLA-01-2025-A10-01482 · NIU : P070418499910G
            </div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <div style="color:#FF9900;font-size:18px;font-weight:900;letter-spacing:3px;">OFS</div>
            <div style="color:#6c757d;font-size:8px;letter-spacing:1px;margin-top:2px;">onefreestyle.store</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Bande bas -->
  <tr><td style="background:#FF9900;height:4px;font-size:0;">&nbsp;</td></tr>

</table>
</td></tr></table>
</body></html>`;
};

// ─── EMAIL EXPÉDITION ─────────────────────────────────────────────────────────
const buildShippedEmail = (order: any, items: any[], name: string) => {
  const ref  = order.id.slice(0, 8).toUpperCase();
  const date = fmtDate(order.created_at || null);

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Commande #${ref} en route — OFS</title>
</head>
<body style="margin:0;padding:0;background:#ECECEC;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ECECEC;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;">

  <tr><td style="background:#FF9900;height:5px;font-size:0;">&nbsp;</td></tr>

  <tr>
    <td style="background:#131921;padding:28px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">
            <div style="color:#FF9900;font-size:21px;font-weight:900;letter-spacing:3px;">BUYTICLE</div>
            <div style="color:#8892a0;font-size:9px;letter-spacing:2px;margin-top:3px;">ENTREPRISE INDIVIDUELLE (ETS)</div>
            <div style="margin-top:14px;color:#6c757d;font-size:10px;line-height:2;">
              Bonamoussadi, Douala — Cameroun<br>
              Tél : (+237) 696 99 58 79
            </div>
          </td>
          <td style="vertical-align:top;text-align:right;">
            <div style="display:inline-block;background:#FF9900;border-radius:4px;padding:8px 16px;">
              <div style="color:#131921;font-size:22px;font-weight:900;letter-spacing:4px;">OFS</div>
              <div style="color:#131921;font-size:7px;letter-spacing:1.5px;font-weight:700;margin-top:2px;text-align:center;">ONEFREESTYLE STORE</div>
            </div>
            <div style="color:#6c757d;font-size:9px;margin-top:10px;">Une plateforme Buyticle ETS</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="background:#1a2332;padding:13px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1.5px;">AVIS D'EXPÉDITION</td>
          <td style="text-align:right;">
            <span style="background:#FF9900;color:#131921;font-size:11px;font-weight:900;padding:4px 12px;border-radius:3px;font-family:monospace;">#${ref}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Statut expédition -->
  <tr><td style="background:#d4edda;padding:14px 36px;border-left:4px solid #28a745;">
    <span style="font-size:14px;color:#155724;font-weight:700;">🚚 Votre commande est en route !</span>
  </td></tr>

  <!-- Message -->
  <tr>
    <td style="padding:28px 36px;">
      <p style="margin:0 0 10px;font-size:14px;color:#333;">Bonjour <strong>${name}</strong>,</p>
      <p style="margin:0;font-size:13px;color:#555;line-height:1.7;">
        Votre commande est en cours de livraison. Notre livreur vous contactera à son arrivée.
        La livraison se fera à l'adresse : <strong style="color:#131921;">${order.client_address || "—"}</strong>
      </p>
    </td>
  </tr>

  <!-- Tableau articles -->
  <tr><td style="padding:0 36px;">${itemsTable(items)}</td></tr>

  <!-- Totaux -->
  <tr>
    <td style="padding:0 36px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:55%;"></td>
          <td style="width:45%;">${totalsBlock(order)}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA Suivi -->
  <tr>
    <td style="padding:20px 36px 28px;text-align:center;">
      <a href="${SITE_URL}/track" style="display:inline-block;background:#FF9900;color:#131921;text-decoration:none;padding:13px 32px;border-radius:4px;font-weight:700;font-size:13px;">
        📦 Suivre ma commande
      </a>
      <div style="margin-top:16px;">
        <a href="https://wa.me/${SUPPORT_PHONE}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 24px;border-radius:4px;font-weight:600;font-size:12px;">
          📱 Contacter le support
        </a>
      </div>
      <div style="margin-top:16px;font-size:11px;color:#888;font-style:italic;">
        Merci pour votre confiance. L'équipe OFS vous souhaite une excellente expérience !
      </div>
    </td>
  </tr>

  <!-- Footer légal -->
  <tr>
    <td style="background:#131921;padding:18px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-size:9px;color:#6c757d;line-height:1.9;">
              <strong style="color:#FF9900;">Buyticle ETS</strong> — Entreprise Individuelle<br>
              Bonamoussadi, Douala, Cameroun<br>
              RCCM : CM-DLA-01-2025-A10-01482 · NIU : P070418499910G
            </div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <div style="color:#FF9900;font-size:18px;font-weight:900;letter-spacing:3px;">OFS</div>
            <div style="color:#6c757d;font-size:8px;letter-spacing:1px;margin-top:2px;">onefreestyle.store</div>
          </td>
        </tr>
      </table>
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
  const ch = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: ch });

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
      subject = `🛍️ Commande reçue #${ref} — OFS / Buyticle ETS`;
      html    = buildEmail(order, itms, name, false);
    } else if (type === "payment_confirmed") {
      subject = `✅ Paiement confirmé #${ref} — OFS / Buyticle ETS`;
      html    = buildEmail({ ...order, status: "paid" }, itms, name, true);
    } else if (type === "shipped") {
      subject = `🚚 En route ! Commande #${ref} — OFS Cameroun`;
      html    = buildShippedEmail(order, itms, name);
    } else {
      throw new Error(`Unknown type: ${type}`);
    }

    await sendResend(email, subject, html);
    console.log(`[send-email] ${type} → ${email}`);

    return new Response(JSON.stringify({ ok: true, to: email }), {
      headers: { ...ch, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[send-email]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...ch, "Content-Type": "application/json" },
    });
  }
});
