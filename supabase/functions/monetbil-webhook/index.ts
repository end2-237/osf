// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const MONETBIL_SECRET = Deno.env.get("MONETBIL_SERVICE_SECRET")   || "";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")               || "";
const SUPABASE_SRVKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")  || "";

const SUCCESS_STATUSES  = new Set(["success", "successfull", "successful", "1"]);
const CANCELLED_STATUSES = new Set(["cancelled", "cancel", "canceled", "failed", "expired", "0", "2"]);

async function hmacSha1Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: Request) => {
  // Always return 200 to prevent Monetbil retries
  const ok = () => new Response("OK", { status: 200 });

  try {
    const ct = req.headers.get("content-type") || "";
    let payment_ref = "", status = "", transaction_id = "", sign = "";

    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form     = await req.formData();
      payment_ref    = (form.get("payment_ref")    as string) || "";
      status         = (form.get("status")         as string) || "";
      transaction_id = (form.get("transaction_id") as string) || "";
      sign           = (form.get("sign")           as string) || "";
    } else {
      try {
        const b        = await req.json();
        payment_ref    = b.payment_ref    || "";
        status         = b.status         || "";
        transaction_id = b.transaction_id || "";
        sign           = b.sign           || "";
      } catch { return ok(); }
    }

    if (!payment_ref || !status) return ok();

    // Verify HMAC-SHA1 signature
    const expected = await hmacSha1Hex(MONETBIL_SECRET, payment_ref + status.toLowerCase());
    if (!sign || sign !== expected) {
      console.warn("[MONETBIL] signature mismatch — ignored");
      return ok();
    }

    const statusLow  = status.toLowerCase();
    const isSuccess  = SUCCESS_STATUSES.has(statusLow);
    const isCancelled = CANCELLED_STATUSES.has(statusLow);
    const newStatus  = isSuccess ? "paid" : isCancelled ? "cancelled" : "payment_failed";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SRVKEY);

    // Fetch order IDs before update (needed for email trigger)
    const { data: matchingOrders } = await supabase
      .from("orders")
      .select("id, user_id")
      .eq("payment_reference", payment_ref);

    await supabase
      .from("orders")
      .update({
        status:         newStatus,
        monetbil_tx_id: transaction_id || null,
        paid_at:        isSuccess ? new Date().toISOString() : null,
      })
      .eq("payment_reference", payment_ref);

    // Send confirmation email for paid orders (non-blocking)
    if (isSuccess && matchingOrders) {
      for (const o of matchingOrders) {
        if (o.user_id) {
          fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              "Authorization": `Bearer ${SUPABASE_SRVKEY}`,
              "apikey":        SUPABASE_SRVKEY,
            },
            body: JSON.stringify({ type: "payment_confirmed", order_id: o.id }),
          }).catch(() => {});
        }
      }
    }

    console.log("[MONETBIL WEBHOOK]", payment_ref, "→", newStatus);

  } catch (err) {
    console.error("[MONETBIL WEBHOOK]", err);
  }

  return ok();
});
