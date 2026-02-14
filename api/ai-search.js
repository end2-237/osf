// api/ai-search.js — ESM (compatible "type": "module")
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY manquante' });
  }

  try {
    const { type, prompt, imageBase64, imageMimeType, productImageUrls, userImageBase64, userImageMimeType } = req.body;

    let parts = [];

    // ── MODE COMPARE: Comparaison visuelle intuitive (humaine) ──
    if (type === 'compare') {
      const urls = (productImageUrls || []).slice(0, 10); // Augmenté à 10 pour plus de choix

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
          // api/ai-search.js (Mode Compare)
text: `Tu es un expert en authentification de produits pour une marketplace de luxe.
IMAGE RÉFÉRENCE : [L'image fournie par l'utilisateur]
CANDIDATS : [Les images du catalogue]

VOTRE ANALYSE DOIT ÊTRE INFAILLIBLE :
1. ANALYSE DES FORMES (MORPHOLOGIE) : Compare les proportions exactes. Un régime de bananes et une main de bananes partagent la même signature cellulaire/visuelle.
2. SIGNATURES UNIQUES : Identifie les logos, les ports de charge, les coutures ou les motifs. 
3. ÉLIMINATION DES FAUX POSITIFS : Ne te laisse pas tromper par la couleur. Un produit noir et un produit blanc de même forme sont plus proches qu'un produit noir d'une autre forme.
4. RÉSISTANCE AU FLOU : Si l'image de référence est floue, utilise la silhouette comme empreinte digitale.

RÈGLE D'OR : Le produit identique ou le concept le plus proche (ex: partie pour le tout) DOIT être l'index 0.

RETOURNE UNIQUEMENT CE JSON :
{
  "rankedIndices": [indices classés],
  "topMatch": index du gagnant,
  "confidenceScore": "high | medium | low",
  "reasoning": "Preuve technique du match (ex: 'La disposition des capteurs sur l'image floue correspond exactement au modèle X du catalogue.')"
}`},
        // Image de référence (L'input de l'utilisateur)
        { inline_data: { mime_type: userImageMimeType || 'image/jpeg', data: userImageBase64 } },
        { text: `--- CATALOGUE PRODUITS À COMPARER ---` },
        ...validProducts.flatMap(p => [
          { text: `Produit Index ${p.index}:` },
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
            generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
          }),
        }
      );

      if (!response.ok) return res.status(response.status).json({ error: await response.text() });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return res.status(200).json({ text });
    }

    // ── MODE IMAGE: Identification sémantique ──
    if (type === 'image' && imageBase64) {
      parts = [
        {
          text: `Analyse cette image comme un humain. Même si elle est floue, identifie l'objet. 
Exemple: Si tu vois une forme jaune allongée, dis que c'est une banane.
${prompt}` // Le prompt passé contient les instructions de formatage JSON
        },
        { inline_data: { mime_type: imageMimeType || 'image/jpeg', data: imageBase64 } },
      ];
    } else {
      parts = [{ text: prompt }];
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
        }),
      }
    );

    if (!response.ok) return res.status(response.status).json({ error: await response.text() });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return res.status(200).json({ text });

  } catch (err) {
    console.error('[ai-search] Erreur:', err.message);
    return res.status(500).json({ error: err.message });
  }
}