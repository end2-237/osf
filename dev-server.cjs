// dev-server.cjs — .cjs pour éviter le conflit "type: module"
// Lance avec : node dev-server.cjs

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Charger .env.local
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  }
}

const PORT = 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Télécharger une image depuis une URL → base64
function fetchImageAsBase64(url) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 6000);
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        clearTimeout(timeout);
        const buf = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || 'image/jpeg';
        resolve({ b64: buf.toString('base64'), ct });
      });
      res.on('error', () => { clearTimeout(timeout); resolve(null); });
    }).on('error', () => { clearTimeout(timeout); resolve(null); });
  });
}

// Appeler Gemini
function callGeminiAPI(body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const urlObj = new URL(GEMINI_URL);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (geminiRes) => {
      let data = '';
      geminiRes.on('data', c => data += c);
      geminiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          resolve({ text });
        } catch (e) {
          reject(new Error('Erreur parsing Gemini: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }
  if (req.url !== '/api/ai-search' || req.method !== 'POST') {
    res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' }));
  }
  if (!GEMINI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'GEMINI_API_KEY manquante dans .env.local' }));
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { type, prompt, imageBase64, imageMimeType, productImageUrls, userImageBase64, userImageMimeType } = JSON.parse(body);

      let parts = [];

      // ── MODE COMPARE ──
      if (type === 'compare') {
        const urls = (productImageUrls || []).slice(0, 8);
        console.log(`  [compare] Téléchargement de ${urls.length} images produits...`);

        const productImages = await Promise.all(
          urls.map(async (url, i) => {
            const result = await fetchImageAsBase64(url);
            if (result) console.log(`  ✅ Produit ${i} OK`);
            else console.log(`  ❌ Produit ${i} échec`);
            return result ? { ...result, index: i, ok: true } : { index: i, ok: false };
          })
        );

        const validProducts = productImages.filter(p => p.ok);
        console.log(`  [compare] ${validProducts.length}/${urls.length} images récupérées`);

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
          { inline_data: { mime_type: userImageMimeType || 'image/jpeg', data: userImageBase64 } },
          { text: '--- PRODUCT IMAGES TO COMPARE ---' },
          ...validProducts.flatMap(p => [
            { text: `Product index ${p.index}:` },
            { inline_data: { mime_type: p.ct, data: p.b64 } },
          ]),
        ];

        const result = await callGeminiAPI({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 400 },
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result));
      }

      // ── MODE IMAGE / TEXT ──
      if (type === 'image' && imageBase64) {
        parts = [
          { inline_data: { mime_type: imageMimeType || 'image/jpeg', data: imageBase64 } },
          { text: prompt },
        ];
      } else {
        parts = [{ text: prompt }];
      }

      const result = await callGeminiAPI({
        contents: [{ parts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));

    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n✅ Dev proxy actif → http://localhost:${PORT}/api/ai-search`);
  console.log(`   GEMINI_API_KEY : ${GEMINI_API_KEY ? '✅ trouvée' : '❌ MANQUANTE — ajoute-la dans .env.local'}`);
  console.log(`   Modes supportés : image · text · compare (visuel)\n`);
});
