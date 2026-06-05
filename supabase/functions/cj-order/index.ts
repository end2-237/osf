// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CJ_BASE         = "https://developers.cjdropshipping.com/api2.0/v1";
const CJ_TOKEN        = Deno.env.get("CJ_ACCESS_TOKEN")           || "";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")              || "";
const SUPABASE_SRVKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Variant = Record<string, unknown>;

interface TransitaireConfig {
  name?:            string;
  address_china?:   string;
  city_china?:      string;
  phone_china?:     string;
  wechat?:          string;
  phone_cm?:        string;
  rate_fcfa_per_kg?: number;
  notes?:           string;
}

/** Find the best matching CJ variant vid from a product's variants array. */
function resolveVid(variants: Variant[], selectedColor: string, selectedSize: string): string {
  const sc = selectedColor.toLowerCase();
  const ss = selectedSize.toLowerCase();
  const isUnique = !ss || ss === "unique";

  let matched: Variant | undefined;

  if (sc || !isUnique) {
    matched = variants.find(v => {
      const prop = ((v.variantProperty || v.property || "") as string).toLowerCase();
      const key  = ((v.variantKey || "") as string).toLowerCase();
      const colorOk = !sc || sc === "default" || prop.includes(sc) || key.includes(sc) || key.startsWith(sc);
      const sizeOk  = isUnique || prop.includes(ss) || key.endsWith("-" + ss) || key.includes("-" + ss + "-");
      return colorOk && sizeOk;
    });
  }

  // Fallback: first in-stock variant, then any first variant
  if (!matched) {
    matched = variants.find(v => {
      const s = v.variantStatus;
      return s == null || Number(s) === 1 || s === true;
    }) || variants[0];
  }

  return (matched?.vid || matched?.variantId || "") as string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const rawText = await req.text();
    if (!rawText?.trim()) return json({ error: "Corps vide" }, 400);

    let parsed: { order_id?: string; use_transitaire?: boolean; transitaire?: TransitaireConfig };
    try { parsed = JSON.parse(rawText); }
    catch { return json({ error: "JSON invalide" }, 400); }

    const { order_id, use_transitaire, transitaire } = parsed;
    if (!order_id) return json({ error: "order_id requis" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SRVKEY);

    // ── Fetch order ──────────────────────────────────────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) return json({ error: "Commande introuvable" }, 404);
    if (order.status !== "paid")           return json({ error: "La commande n'est pas payée" }, 400);
    if (order.cj_order_status === "sent")  return json({ error: "Déjà envoyé à CJ" }, 400);

    // ── Fetch order items ────────────────────────────────────────────────────
    const { data: items, error: itemsErr } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order_id);

    if (itemsErr) return json({ error: itemsErr.message }, 500);
    if (!items?.length) return json({ error: "Aucun article dans cette commande" }, 400);

    // ── Resolve variant IDs ──────────────────────────────────────────────────
    const resolvedProducts: Array<{ vid: string; quantity: number }> = [];
    const skipped: string[] = [];

    for (const item of items) {
      let vid = (item.selected_variant_id as string) || "";

      if (!vid) {
        const cjPid = (item.cj_product_id as string) || "";
        const prodId = (item.product_id   as string) || "";

        let q = supabase.from("products").select("variants, cj_product_id, vendor_id");
        if (cjPid)       q = q.eq("cj_product_id", cjPid);
        else if (prodId) q = q.eq("id", prodId);
        else { skipped.push(item.product_name as string); continue; }

        const { data: prod } = await q.maybeSingle();

        if (!prod || prod.vendor_id !== null) { skipped.push(item.product_name as string); continue; }

        const vArr: Variant[] = Array.isArray(prod.variants) ? prod.variants : [];
        if (!vArr.length) { skipped.push(item.product_name as string); continue; }

        vid = resolveVid(
          vArr,
          (item.selected_color as string) || "",
          (item.selected_size  as string) || ""
        );
      }

      if (!vid) { skipped.push(item.product_name as string); continue; }
      resolvedProducts.push({ vid, quantity: item.quantity as number });
    }

    if (skipped.length) console.warn("[CJ ORDER] Articles ignorés:", skipped.join(", "));
    if (!resolvedProducts.length)
      return json({ error: "Aucun produit CJ avec variant résolvable. Articles: " + (skipped.join(", ") || "vide") }, 400);

    // ── Build shipping config (DHL direct vs Transitaire) ────────────────────
    let shippingConfig: Record<string, string>;
    let remarkText = "";

    if (use_transitaire && transitaire?.address_china) {
      // Ship to transitaire warehouse in China
      const tr = transitaire;
      shippingConfig = {
        shippingCountry:      "CN",
        shippingCountryCode:  "CN",
        shippingProvince:     "",
        shippingCity:         tr.city_china || "Guangzhou",
        shippingCounty:       "",
        shippingAddress:      tr.address_china || "",
        shippingAddress2:     "",
        shippingCustomerName: tr.name || "OFS Transitaire",
        shippingPhone:        tr.phone_china || "",
        shippingZip:          "",
      };
      // Put client info in remark so the transitaire knows the final destination
      remarkText = `CLIENT: ${order.client_name} / ${order.client_phone} / ${order.client_address}${order.delivery_city ? " / " + order.delivery_city : ""} / Cameroun`;
    } else {
      // Ship directly to client in Cameroon via DHL
      shippingConfig = {
        shippingCountry:      "CM",
        shippingCountryCode:  "CM",
        shippingProvince:     "",
        shippingCity:         order.delivery_city || order.client_address || "",
        shippingCounty:       "",
        shippingAddress:      order.client_address || "",
        shippingAddress2:     "",
        shippingCustomerName: order.client_name  || "",
        shippingPhone:        order.client_phone || "",
        shippingZip:          "00237",
      };
    }

    // ── Build CJ payload ─────────────────────────────────────────────────────
    const cjBody = {
      orderNumber:   order.payment_reference || `OFS-${order.id.slice(0, 8).toUpperCase()}`,
      fromCountryCode: "CN",
      logisticName:  use_transitaire ? "YTO" : "CJPacket",
      platform:      "shopify",
      orderFlow:     1,
      ...shippingConfig,
      houseNumber:   "",
      email:         "",
      taxId:         "",
      consigneeID:   "",
      payType:       "",
      shopAmount:    "",
      iossType:      "",
      iossNumber:    "",
      remark:        remarkText,
      products: resolvedProducts.map((p, i) => ({
        ...p,
        storeLineItemId: `${order.id.slice(0, 8)}-${i}`,
      })),
    };

    console.log("[CJ ORDER] Mode:", use_transitaire ? "transitaire" : "dhl_direct");
    console.log("[CJ ORDER] Payload:", JSON.stringify(cjBody));

    const cjRes = await fetch(`${CJ_BASE}/shopping/order/createOrderV2`, {
      method:  "POST",
      headers: {
        "CJ-Access-Token": CJ_TOKEN,
        "Content-Type":    "application/json",
      },
      body: JSON.stringify(cjBody),
    });

    const cjData = await cjRes.json();
    console.log("[CJ ORDER] Response:", JSON.stringify(cjData));

    if (cjData.code !== 200 || !cjData.data) {
      await supabase
        .from("orders")
        .update({ cj_order_status: "error" })
        .eq("id", order_id);
      return json({ error: cjData.message || "Erreur API CJ", cj_response: cjData }, 400);
    }

    const cjOrderId: string =
      cjData.data.orderId   ||
      cjData.data.orderNum  ||
      cjData.data.cjOrderId ||
      "";

    // ── Update order in DB ────────────────────────────────────────────────────
    const dbUpdate: Record<string, unknown> = {
      cj_order_id:     cjOrderId,
      cj_order_status: "sent",
      fulfilled_at:    new Date().toISOString(),
    };

    if (use_transitaire) {
      dbUpdate.status        = "sent_to_cj";
      dbUpdate.shipping_mode = "transitaire";
    } else {
      dbUpdate.shipping_mode = "dhl_direct";
    }

    await supabase
      .from("orders")
      .update(dbUpdate)
      .eq("id", order_id);

    const mode = use_transitaire ? "transitaire" : "dhl_direct";
    console.log("[CJ ORDER] Envoyé →", cjOrderId, `mode=${mode}`, `(${skipped.length} articles non-CJ ignorés)`);
    return json({ success: true, cj_order_id: cjOrderId, skipped, mode });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CJ ORDER]", msg);
    return json({ error: msg }, 500);
  }
});
