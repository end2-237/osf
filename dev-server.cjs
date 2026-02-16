// dev-server.cjs — Proxy local pour Gemini en développement
// Lance avec : node dev-server.cjs

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Charge .env ──
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const [k, ...v] = line.split("=");
    if (k?.trim() && v.length) process.env[k.trim()] = v.join("=").trim();
  }
}

const PORT = 3001;
const KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${KEY}`;

// ── Télécharge une image URL → base64 ──
function fetchImageBase64(url) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log(`  ⏱  Timeout: ${url.slice(0, 60)}`);
      resolve(null);
    }, 7000);

    const protocol = url.startsWith("https") ? https : http;
    protocol
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          clearTimeout(timeout);
          console.log(`  ❌ HTTP ${res.statusCode}: ${url.slice(0, 60)}`);
          return resolve(null);
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          clearTimeout(timeout);
          const buf = Buffer.concat(chunks);
          const ct = res.headers["content-type"] || "image/jpeg";
          resolve({ b64: buf.toString("base64"), ct });
        });
        res.on("error", () => { clearTimeout(timeout); resolve(null); });
      })
      .on("error", () => { clearTimeout(timeout); resolve(null); });
  });
}

// ── Appel Gemini ──
function callGemini(body, temp = 0.1, maxTokens = 600) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      contents: [{ parts: body }],
      generationConfig: { temperature: temp, maxOutputTokens: maxTokens },
    });

    const urlObj = new URL(GEMINI_URL);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) return reject(new Error(JSON.stringify(parsed.error)));
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
            resolve({ text });
          } catch (e) {
            reject(new Error("Parse Gemini: " + e.message));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ── Serveur ──
http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") { res.writeHead(200); return res.end(); }
    if (req.url !== "/api/ai-search" || req.method !== "POST") {
      res.writeHead(404); return res.end(JSON.stringify({ error: "Not found" }));
    }
    if (!KEY) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "GEMINI_API_KEY manquante dans .env" }));
    }

    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const {
          type,
          prompt,
          imageBase64,
          imageMimeType,
          userImageBase64,
          userImageMimeType,
          productImageUrls,
          comparePrompt,
        } = JSON.parse(body);

        // ════════════════════════════════
        // COMPARE — comparaison visuelle
        // ════════════════════════════════
        if (type === "compare") {
          const urls = (productImageUrls ?? []).slice(0, 8);
          console.log(`\n[compare] Téléchargement de ${urls.length} images produit…`);

          const images = await Promise.all(
            urls.map(async (url, i) => {
              const result = await fetchImageBase64(url);
              if (result) console.log(`  ✅ [${i}] OK`);
              else console.log(`  ❌ [${i}] Échec`);
              return result ? { ...result, i, ok: true } : { i, ok: false };
            })
          );

          const valid = images.filter((x) => x.ok);
          console.log(`[compare] ${valid.length}/${urls.length} images OK\n`);

          if (!valid.length) {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(
              JSON.stringify({
                text: JSON.stringify({
                  rankedIndices: urls.map((_, i) => i),
                  bestMatch: 0,
                  reason: "Comparaison impossible — images non accessibles",
                }),
              })
            );
          }

          const cmpPrompt =
            comparePrompt ||
            `Compare l'IMAGE DE RÉFÉRENCE avec les ${valid.length} IMAGES PRODUIT numérotées de 0 à ${valid.length - 1}.
Classe-les du plus similaire au moins similaire.
Critères: même produit > même catégorie > même couleur.
Réponds UNIQUEMENT avec ce JSON:
{"rankedIndices":[indices classés],"bestMatch":meilleur_index,"reason":"une phrase en français"}`;

          const parts = [
            { text: cmpPrompt },
            { text: "=== IMAGE DE RÉFÉRENCE ===" },
            { inline_data: { mime_type: userImageMimeType || "image/jpeg", data: userImageBase64 } },
            { text: "=== IMAGES PRODUITS ===" },
            ...valid.flatMap(({ i, b64, ct }) => [
              { text: `Produit ${i}:` },
              { inline_data: { mime_type: ct, data: b64 } },
            ]),
          ];

          const result = await callGemini(parts, 0.05, 400);
          console.log("[compare] Réponse:", result.text?.slice(0, 200));
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify(result));
        }

        // ════════════════════════════════
        // IMAGE — identification visuelle
        // ════════════════════════════════
        if (type === "image" && imageBase64) {
          const parts = [
            { text: prompt },
            { inline_data: { mime_type: imageMimeType || "image/jpeg", data: imageBase64 } },
          ];
          const result = await callGemini(parts, 0.1, 400);
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify(result));
        }

        // ════════════════════════════════
        // TEXT — analyse description
        // ════════════════════════════════
        const parts = [{ text: prompt }];
        const result = await callGemini(parts, 0.2, 400);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        console.error("[dev-server] Erreur:", e.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  })
  .listen(PORT, () => {
    console.log(`\n✅ Dev proxy → http://localhost:${PORT}/api/ai-search`);
    console.log(`   GEMINI_API_KEY: ${KEY ? "✅ trouvée" : "❌ MANQUANTE"}`);
    console.log(`   Modes: image · text · compare\n`);
  });
