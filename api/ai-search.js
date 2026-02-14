// api/ai-search.js — ESM (compatible "type": "module")
// Supporte 3 modes: "image" (analyse), "text" (description), "compare" (comparaison visuelle)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY manquante dans les variables env' });
  }

  try {
    const { type, prompt, imageBase64, imageMimeType, productImageUrls, userImageBase64, userImageMimeType } = req.body;

    let parts = [];

    // ── MODE COMPARE: comparaison visuelle image vs images produits ──
    if (type === 'compare') {
      const urls = (productImageUrls || []).slice(0, 8); // max 8 produits

      // Télécharger les images produits côté serveur (pas de CORS)
      const productImages = await Promise.all(
        urls.map(async (url, i) => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);
            const r = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            const buf = await r.arrayBuffer();
            const b64 = Buffer.from(buf).toString('base64');
            const ct = r.headers.get('content-type') || 'image/jpeg';
            return { b64, ct, index: i, ok: true };
          } catch {
            return { index: i, ok: false };
          }
        })
      );

      const validProducts = productImages.filter(p => p.ok);

      parts = [
        {
          text: `You are a visual similarity expert for an e-commerce store. 
Compare the REFERENCE IMAGE (first image) with each of the ${validProducts.length} PRODUCT IMAGES below.
Rank the products from most to least visually similar to the reference.
Consider: overall style, category, shape, colors, design language.

Return ONLY this JSON (no markdown):
{
  "rankedIndices": [index of most similar, second most similar, ...all indices],
  "topMatch": index of single best match,
  "reasoning": "one sentence in French explaining the best match"
}`
        },
        // Image de référence (uploadée par l'utilisateur)
        { inline_data: { mime_type: userImageMimeType || 'image/jpeg', data: userImageBase64 } },
        { text: `--- PRODUCT IMAGES TO COMPARE ---` },
        // Images des produits
        ...validProducts.flatMap(p => [
          { text: `Product index ${p.index}:` },
          { inline_data: { mime_type: p.ct, data: p.b64 } },
        ]),
      ];

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 400 },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: err });
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return res.status(200).json({ text });
    }

    // ── MODE IMAGE: analyse simple ──
    if (type === 'image' && imageBase64) {
      parts = [
        { inline_data: { mime_type: imageMimeType || 'image/jpeg', data: imageBase64 } },
        { text: prompt },
      ];
    } else {
      // ── MODE TEXT ──
      parts = [{ text: prompt }];
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return res.status(200).json({ text });

  } catch (err) {
    console.error('[ai-search] Erreur:', err.message);
    return res.status(500).json({ error: err.message });
  }
}