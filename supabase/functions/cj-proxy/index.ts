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
    const path  = url.searchParams.get("path");
    const query = url.searchParams.get("params");
    const body  = url.searchParams.get("body");

    if (!path) {
      return new Response(JSON.stringify({ error: "missing path" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── /probe: server-side URL probe — HEAD-tests a list of candidate URLs ────
    // Runs server-side so there are no browser CORS restrictions.
    if (path === "/probe") {
      const params = query ? JSON.parse(query) : {};
      const urls: string[] = Array.isArray(params.urls) ? params.urls : [];
      for (const testUrl of urls) {
        try {
          const r = await fetch(testUrl, {
            method: "HEAD",
            signal: AbortSignal.timeout(5000),
          });
          if (r.ok) {
            return new Response(JSON.stringify({ url: testUrl }), {
              status: 200,
              headers: { ...cors, "Content-Type": "application/json" },
            });
          }
        } catch { /* try next */ }
      }
      return new Response(JSON.stringify({ url: null }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── /resolve-video: follow CJ download-only URL with auth ─────────────────
    // CJ's queryVideosByProductId returns protected URLs. A server-side HEAD
    // request with the CJ token may redirect to the actual public CDN URL.
    if (path === "/resolve-video") {
      const params = query ? JSON.parse(query) : {};
      const videoUrl: string = params.url || "";
      if (!videoUrl) {
        return new Response(JSON.stringify({ url: null }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      try {
        const r = await fetch(videoUrl, {
          method: "HEAD",
          headers: { "CJ-Access-Token": CJ_TOKEN },
          signal: AbortSignal.timeout(8000),
          // redirect: "follow" is the default — Deno follows Location headers
        });
        return new Response(
          JSON.stringify({ url: r.url, ok: r.ok, status: r.status }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
      } catch {
        return new Response(JSON.stringify({ url: null }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // ── Forward to CJ API ─────────────────────────────────────────────────────
    const target = new URL(`${CJ_BASE}${path}`);

    let cjRes: Response;

    if (body) {
      // POST request — body is JSON string, sent as-is
      cjRes = await fetch(target.toString(), {
        method: "POST",
        headers: {
          "CJ-Access-Token": CJ_TOKEN,
          "Content-Type":    "application/json",
        },
        body,
      });
    } else {
      // GET request — params go into query string
      if (query) {
        const params = JSON.parse(query);
        Object.entries(params).forEach(([k, v]) => {
          if (v !== "" && v !== null && v !== undefined) {
            target.searchParams.set(k, String(v));
          }
        });
      }
      cjRes = await fetch(target.toString(), {
        headers: {
          "CJ-Access-Token": CJ_TOKEN,
          "Content-Type":    "application/json",
        },
      });
    }

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
