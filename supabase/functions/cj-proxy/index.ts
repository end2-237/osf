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

    // ── /debug-video: diagnose what CJ returns for a video URL ──────────────────
    if (path === "/debug-video") {
      const params = query ? JSON.parse(query) : {};
      const videoUrl: string = params.url || "";
      if (!videoUrl) {
        return new Response(JSON.stringify({ error: "missing url" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const results: Record<string, unknown>[] = [];
      for (const [label, hdrs] of [
        ["no-auth",         {}],
        ["CJ-Access-Token", { "CJ-Access-Token": CJ_TOKEN }],
        ["Bearer",          { "Authorization": `Bearer ${CJ_TOKEN}` }],
      ] as [string, Record<string, string>][]) {
        try {
          const r = await fetch(videoUrl, {
            method: "HEAD", headers: hdrs,
            signal: AbortSignal.timeout(6000),
          });
          results.push({
            auth: label, status: r.status, ok: r.ok,
            contentType: r.headers.get("Content-Type"),
            contentLength: r.headers.get("Content-Length"),
            finalUrl: r.url,
          });
        } catch (e) { results.push({ auth: label, error: String(e) }); }
      }
      return new Response(JSON.stringify(results, null, 2), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── /stream-video: proxy CJ authenticated video with Range support ──────────
    // CJ videos at download-only-api require CJ-Access-Token. We forward the
    // request server-side so the browser can play via a plain src= URL.
    if (path === "/stream-video") {
      const params = query ? JSON.parse(query) : {};
      const videoUrl: string = params.url || "";
      if (!videoUrl || !videoUrl.includes("cjdropshipping.com")) {
        return new Response("invalid url", { status: 400, headers: cors });
      }
      const fetchHeaders: Record<string, string> = { "CJ-Access-Token": CJ_TOKEN };
      // Forward Range header so video seeking works in the browser
      const rangeHeader = req.headers.get("Range");
      if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

      const r = await fetch(videoUrl, { headers: fetchHeaders });

      const resHeaders = new Headers(cors);
      resHeaders.set("Content-Type", r.headers.get("Content-Type") || "video/mp4");
      const cl = r.headers.get("Content-Length");
      if (cl) resHeaders.set("Content-Length", cl);
      const cr = r.headers.get("Content-Range");
      if (cr) resHeaders.set("Content-Range", cr);
      resHeaders.set("Accept-Ranges", "bytes");
      resHeaders.set("Cache-Control", "public, max-age=86400");

      return new Response(r.body, { status: r.status, headers: resHeaders });
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
