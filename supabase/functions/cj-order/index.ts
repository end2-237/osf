// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CJ_BASE     = "https://developers.cjdropshipping.com/api2.0/v1";
const CJ_TOKEN    = Deno.env.get("CJ_ACCESS_TOKEN")          || "";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")              || "";
const SUPABASE_SRVKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
    if (!rawText?.trim()) return json({ error: "Corps vide" }, 400);

    let parsed: { order_id?: string };
    try { parsed = JSON.parse(rawText); }
    catch { return json({ error: "JSON invalide" }, 400); }

    const { order_id } = parsed;
    if (!order_id) return json({ error: "order_id requis" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SRVKEY);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) return json({ error: "Commande introuvable" }, 404);
    if (order.status !== "paid") return json({ error: "La commande n'est pas payée" }, 400);
    if (order.cj_order_status === "sent") return json({ error: "Déjà envoyé à CJ" }, 400);

    const { data: items, error: itemsErr } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order_id);

    if (itemsErr) return json({ error: itemsErr.message }, 500);

    const cjItems = (items || []).filter((i: Record<string, unknown>) => i.selected_variant_id);
    if (cjItems.length === 0)
      return json({ error: "Aucun produit CJ avec variant_id dans cette commande" }, 400);

    const cjBody = {
      orderNumber:      order.payment_reference || `OFS-${order.id.slice(0, 8).toUpperCase()}`,
      shippingZip:      "",
      shippingCountry:  "CM",
      shippingProvince: "",
      shippingCity:     order.delivery_city || order.client_address || "",
      shippingAddress:  order.client_address || "",
      shippingAddress2: "",
      shippingName:     order.client_name  || "",
      shippingPhone:    order.client_phone || "",
      houseNumber:      "",
      products: cjItems.map((i: Record<string, unknown>) => ({
        vid:      i.selected_variant_id as string,
        quantity: i.quantity as number,
      })),
    };

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

    await supabase
      .from("orders")
      .update({
        cj_order_id:     cjOrderId,
        cj_order_status: "sent",
        fulfilled_at:    new Date().toISOString(),
      })
      .eq("id", order_id);

    console.log("[CJ ORDER] Envoyé →", cjOrderId);
    return json({ success: true, cj_order_id: cjOrderId });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CJ ORDER]", msg);
    return json({ error: msg }, 500);
  }
});
