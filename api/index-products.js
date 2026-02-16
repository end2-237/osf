// api/index-products.js
import { pipeline, env, RawImage } from '@xenova/transformers';
import { createClient } from '@supabase/supabase-js';

env.allowLocalModels = false;
env.cacheDir = '/tmp/transformers_cache';
env.useBrowserCache = false;

let clipEmbedder = null;
async function getEmbedder() {
  if (!clipEmbedder) {
    console.log('[CLIP] Chargement modèle...');
    clipEmbedder = await pipeline(
      'feature-extraction',
      'Xenova/clip-vit-base-patch32'
    );
    console.log('[CLIP] ✅ Prêt');
  }
  return clipEmbedder;
}

// ── RawImage.fromURL fonctionne en Node.js, contrairement à fromBlob ──
async function embedFromURL(url) {
  const embedder = await getEmbedder();
  const image = await RawImage.fromURL(url);
  const output = await embedder(image, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Indexing-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const secret = req.headers['x-indexing-secret'] || req.query.secret;
  if (!secret || secret !== process.env.INDEXING_SECRET) {
    return res.status(401).json({ error: 'Clé secrète invalide' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── GET : Statut ──
  if (req.method === 'GET') {
    const { count: total } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    const { count: indexed } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    return res.status(200).json({
      total: total ?? 0,
      indexed: indexed ?? 0,
      remaining: (total ?? 0) - (indexed ?? 0),
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { onlyMissing = true, batchSize = 3 } = req.body || {};
  const startTotal = Date.now();

  let query = supabase.from('products').select('id, name, img');
  if (onlyMissing) query = query.is('embedding', null);

  const { data: products, error: fetchError } = await query;
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!products?.length) {
    return res.status(200).json({ message: 'Tous les produits sont déjà indexés ✅', indexed: 0 });
  }

  console.log(`[index-products] ${products.length} produits à indexer`);
  const results = { success: [], failed: [] };

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    console.log(`[index-products] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}`);

    // Séquentiel pour limiter la RAM
    for (const product of batch) {
      if (!product.img) {
        results.failed.push({ id: product.id, name: product.name, reason: "Pas d'image" });
        continue;
      }
      try {
        const embedding = await embedFromURL(product.img);
        const { error: updateError } = await supabase
          .from('products')
          .update({ embedding })
          .eq('id', product.id);
        if (updateError) throw new Error(updateError.message);
        results.success.push({ id: product.id, name: product.name });
        console.log(`  ✅ ${product.name}`);
      } catch (err) {
        results.failed.push({ id: product.id, name: product.name, reason: err.message });
        console.error(`  ❌ ${product.name}: ${err.message}`);
      }
    }
  }

  const totalMs = Date.now() - startTotal;
  return res.status(200).json({
    message: `Indexation terminée en ${(totalMs / 1000).toFixed(1)}s`,
    indexed: results.success.length,
    failed: results.failed.length,
    details: { success: results.success, failed: results.failed },
  });
}

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};