// api/ai-search.js — Backend Gemini Vision pour recherche visuelle produit
// ESM (compatible "type": "module")

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return res.status(500).json({ error: "GEMINI_API_KEY manquante" });

  const GEMINI_FLASH = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${KEY}`;

  // ── Appel Gemini générique ──
  const gemini = async (parts, temp = 0.1, maxTokens = 600) => {
    const r = await fetch(GEMINI_FLASH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: temp, maxOutputTokens: maxTokens },
      }),
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  };

  // ── Téléchargement image produit → base64 ──
  const fetchImg = async (url) => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      const buf = await r.arrayBuffer();
      return {
        b64: Buffer.from(buf).toString("base64"),
        ct: r.headers.get("content-type") || "image/jpeg",
      };
    } catch {
      return null;
    }
  };

  try {
    const {
      type,
      prompt,
      imageBase64,
      imageMimeType,
      userImageBase64,
      userImageMimeType,
      productImageUrls,
      comparePrompt, // prompt de comparaison custom envoyé par le frontend
    } = req.body;

    // ════════════════════════════════════════════════
    // MODE COMPARE — Comparaison visuelle directe
    // ════════════════════════════════════════════════
    if (type === "compare") {
      const urls = (productImageUrls ?? []).slice(0, 8);
      console.log(`[compare] Téléchargement de ${urls.length} images…`);

      // Téléchargement parallèle
      const downloaded = await Promise.all(
        urls.map(async (url, i) => {
          const img = await fetchImg(url);
          console.log(`  [${i}] ${img ? "✅" : "❌"} ${url.slice(0, 60)}`);
          return img ? { ...img, i, ok: true } : { i, ok: false };
        })
      );

      const valid = downloaded.filter((x) => x.ok);
      console.log(`[compare] ${valid.length}/${urls.length} images récupérées`);

      if (!valid.length) {
        // Aucune image téléchargée → retourne ordre naturel
        return res.status(200).json({
          text: JSON.stringify({
            rankedIndices: urls.map((_, i) => i),
            bestMatch: 0,
            reason: "Comparaison impossible (images non accessibles)",
          }),
        });
      }

      // Prompt de comparaison (custom du frontend ou défaut)
      const cmpPrompt =
        comparePrompt ||
        `Compare l'IMAGE DE RÉFÉRENCE avec les ${valid.length} IMAGES PRODUIT numérotées de 0 à ${valid.length - 1}.
Classe-les du plus similaire au moins similaire à la référence.
Critères : même produit > même catégorie > même couleur > même style.
Réponds UNIQUEMENT avec ce JSON :
{"rankedIndices":[indices classés],"bestMatch":meilleur_index,"reason":"une phrase en français"}`;

      const parts = [
        { text: cmpPrompt },
        { text: "=== IMAGE DE RÉFÉRENCE (produit recherché) ===" },
        { inline_data: { mime_type: userImageMimeType || "image/jpeg", data: userImageBase64 } },
        { text: "=== IMAGES PRODUITS DU CATALOGUE ===" },
        ...valid.flatMap(({ i, b64, ct }) => [
          { text: `Produit ${i}:` },
          { inline_data: { mime_type: ct, data: b64 } },
        ]),
      ];

      const text = await gemini(parts, 0.05, 400);
      console.log("[compare] Réponse Gemini:", text.slice(0, 300));
      return res.status(200).json({ text });
    }

    // ════════════════════════════════════════════════
    // MODE IMAGE — Identification visuelle
    // ════════════════════════════════════════════════
    if (type === "image" && imageBase64) {
      const parts = [
        { text: prompt },
        { inline_data: { mime_type: imageMimeType || "image/jpeg", data: imageBase64 } },
      ];
      const text = await gemini(parts, 0.1, 400);
      console.log("[image] Réponse Gemini:", text.slice(0, 200));
      return res.status(200).json({ text });
    }

    // ════════════════════════════════════════════════
    // MODE TEXT — Analyse description
    // ════════════════════════════════════════════════
    const parts = [{ text: prompt }];
    const text = await gemini(parts, 0.2, 400);
    return res.status(200).json({ text });
  } catch (e) {
    console.error("[ai-search] Erreur:", e.message);
    return res.status(500).json({ error: e.message });
  }
}