// api/visual-search.js
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

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Variables Supabase manquantes');
  return createClient(url, key);
}

// ── base64 → RawImage via data URL (fonctionne en Node.js) ──
async function base64ToEmbedding(base64, mimeType) {
  const embedder = await getEmbedder();
  // Passe une data URL — RawImage.fromURL gère aussi les data URLs
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const image = await RawImage.fromURL(dataUrl);
  const output = await embedder(image, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();

  try {
    const { imageBase64, imageMimeType, threshold = 0.45, limit = 8 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 requis' });

    console.log('[visual-search] Génération embedding...');
    const queryEmbedding = await base64ToEmbedding(
      imageBase64,
      imageMimeType || 'image/jpeg'
    );
    const embeddingTime = Date.now() - startTime;
    console.log(`[visual-search] ✅ ${embeddingTime}ms — dim: ${queryEmbedding.length}`);

    const supabase = getSupabase();
    const { data: matches, error } = await supabase.rpc('search_products_by_image', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) throw new Error(`Supabase RPC: ${error.message}`);

    const totalTime = Date.now() - startTime;
    console.log(`[visual-search] ✅ ${matches?.length || 0} résultats — ${totalTime}ms total`);

    return res.status(200).json({
      results: matches || [],
      meta: {
        count: matches?.length || 0,
        threshold,
        embeddingMs: embeddingTime,
        totalMs: totalTime,
        model: 'Xenova/clip-vit-base-patch32',
      },
    });
  } catch (err) {
    console.error('[visual-search] ❌', err.message);
    return res.status(500).json({ error: err.message });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};