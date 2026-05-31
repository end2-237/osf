// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const CJ_TOKEN = Deno.env.get("CJ_ACCESS_TOKEN") || "";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const url   = new URL(req.url);
    const path  = url.searchParams.get("path");   // e.g. /product/list
    const query = url.searchParams.get("params"); // JSON-encoded params object

    if (!path) {
      return new Response(JSON.stringify({ error: "missing path" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const target = new URL(`${CJ_BASE}${path}`);
    if (query) {
      const params = JSON.parse(query);
      Object.entries(params).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) {
          target.searchParams.set(k, String(v));
        }
      });
    }

    const cjRes = await fetch(target.toString(), {
      headers: {
        "CJ-Access-Token": CJ_TOKEN,
        "Content-Type":    "application/json",
      },
    });

    const data = await cjRes.json();

    return new Response(JSON.stringify(data), {
      status: cjRes.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
