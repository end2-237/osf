// api/index-products.js
// Génère et stocke les embeddings CLIP pour tous les produits du catalogue
// Appel unique (ou à relancer si de nouveaux produits sont ajoutés)
// PROTÉGÉ par une clé secrète (INDEXING_SECRET dans les env vars Vercel)

import { pipeline, env, RawImage } from '@xenova/transformers';
import { createClient } from '@supabase/supabase-js';

env.allowLocalModels = false;
env.cacheDir = '/tmp/transformers_cache';
env.useBrowserCache = false;

// Singleton modèle
let clipEmbedder = null;
async function getEmbedder() {
  if (!clipEmbedder) {
    clipEmbedder = await pipeline(
      'feature-extraction',
      'Xenova/clip-vit-base-patch32'
    );
  }
  return clipEmbedder;
}

// ── Télécharger une image produit depuis son URL → base64 ──
async function fetchImageBase64(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || 'image/jpeg';
    return { base64: buf.toString('base64'), mimeType: ct };
  } catch (err) {
    throw new Error(`Fetch image failed (${url.slice(0, 60)}...): ${err.message}`);
  }
}

// ── Générer embedding CLIP pour une image ──
async function embedImage(base64, mimeType) {
  const embedder = await getEmbedder();
  const buffer = Buffer.from(base64, 'base64');
  const image = await RawImage.fromBlob(new Blob([buffer], { type: mimeType }));
  const output = await embedder(image, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// ════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Indexing-Secret');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── AUTHENTIFICATION : clé secrète obligatoire ──
  const secret = req.headers['x-indexing-secret'] || req.query.secret;
  const expectedSecret = process.env.INDEXING_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return res.status(401).json({ error: 'Clé secrète invalide ou manquante' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  // Service role requis pour contourner RLS
  );

  // ── GET : Statut de l'indexation ──
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

  // ── POST : Lancer l'indexation ──
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { onlyMissing = true, batchSize = 5 } = req.body || {};

  console.log('[index-products] Démarrage indexation...');
  const startTotal = Date.now();

  // Récupérer les produits à indexer
  let query = supabase.from('products').select('id, name, img');
  if (onlyMissing) {
    query = query.is('embedding', null);  // Seulement ceux sans embedding
  }

  const { data: products, error: fetchError } = await query;
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!products?.length) {
    return res.status(200).json({ message: 'Tous les produits sont déjà indexés ✅', indexed: 0 });
  }

  console.log(`[index-products] ${products.length} produits à indexer (batchSize: ${batchSize})`);

  const results = { success: [], failed: [] };

  // Traitement par batch pour ne pas dépasser le timeout Vercel
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    console.log(`[index-products] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}`);

    await Promise.all(
      batch.map(async (product) => {
        if (!product.img) {
          results.failed.push({ id: product.id, name: product.name, reason: 'Pas d\'image' });
          return;
        }

        try {
          // 1. Télécharger l'image
          const { base64, mimeType } = await fetchImageBase64(product.img);

          // 2. Générer l'embedding CLIP
          const embedding = await embedImage(base64, mimeType);

          // 3. Stocker dans Supabase
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
      })
    );
  }

  const totalMs = Date.now() - startTotal;
  console.log(`[index-products] Terminé: ${results.success.length} OK, ${results.failed.length} échecs — ${totalMs}ms`);

  return res.status(200).json({
    message: `Indexation terminée en ${(totalMs / 1000).toFixed(1)}s`,
    indexed: results.success.length,
    failed: results.failed.length,
    details: {
      success: results.success,
      failed: results.failed,
    },
  });
}

// Timeout étendu nécessaire pour l'indexation en masse
export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' },
  },
};