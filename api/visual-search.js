// api/visual-search.js
// Recherche visuelle par vecteurs CLIP + pgvector
// Stack : Vercel Serverless + Transformers.js + Supabase

import { pipeline, env, RawImage } from '@xenova/transformers';
import { createClient } from '@supabase/supabase-js';

// ── Config Transformers.js pour Vercel ──
// On désactive la recherche locale : modèle chargé depuis HuggingFace Hub
env.allowLocalModels = false;
// Cache dans /tmp (persiste entre les invocations sur la même instance Vercel)
env.cacheDir = '/tmp/transformers_cache';
// Désactive le cache browser (on est en Node.js)
env.useBrowserCache = false;

// ── Singleton : le modèle est chargé une seule fois par instance ──
// Évite le re-téléchargement à chaque requête (warm instance)
let clipEmbedder = null;

async function getEmbedder() {
  if (!clipEmbedder) {
    console.log('[CLIP] Chargement du modèle Xenova/clip-vit-base-patch32...');
    clipEmbedder = await pipeline(
      'feature-extraction',
      'Xenova/clip-vit-base-patch32',
      { revision: 'main' }
    );
    console.log('[CLIP] ✅ Modèle prêt');
  }
  return clipEmbedder;
}

// ── Supabase (server-side, pas de restriction RLS sur les embeddings) ──
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Variables Supabase manquantes (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  return createClient(url, key);
}

// ── Convertir base64 → RawImage exploitable par CLIP ──
async function base64ToRawImage(base64, mimeType = 'image/jpeg') {
  const buffer = Buffer.from(base64, 'base64');
  // Transformers.js accepte un Uint8Array + mime type
  return await RawImage.fromBlob(new Blob([buffer], { type: mimeType }));
}

// ── Générer l'embedding CLIP d'une image ──
async function generateImageEmbedding(base64, mimeType) {
  const embedder = await getEmbedder();
  const image = await base64ToRawImage(base64, mimeType);
  
  const output = await embedder(image, {
    pooling: 'mean',
    normalize: true,   // Normalisation L2 indispensable pour cosine similarity
  });

  return Array.from(output.data);
}

// ════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();

  try {
    const { imageBase64, imageMimeType, threshold = 0.5, limit = 8 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 requis' });
    }

    // ── ÉTAPE 1 : Générer l'embedding de l'image utilisateur ──
    console.log('[visual-search] Génération embedding...');
    const queryEmbedding = await generateImageEmbedding(
      imageBase64,
      imageMimeType || 'image/jpeg'
    );
    const embeddingTime = Date.now() - startTime;
    console.log(`[visual-search] ✅ Embedding généré en ${embeddingTime}ms (dim: ${queryEmbedding.length})`);

    // ── ÉTAPE 2 : Recherche cosinus dans Supabase (pgvector) ──
    console.log('[visual-search] Recherche pgvector...');
    const supabase = getSupabase();

    const { data: matches, error } = await supabase.rpc('search_products_by_image', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) throw new Error(`Supabase RPC error: ${error.message}`);

    const totalTime = Date.now() - startTime;
    console.log(`[visual-search] ✅ ${matches?.length || 0} résultats en ${totalTime}ms total`);

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
    console.error('[visual-search] ❌ Erreur:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── Config Vercel : mémoire et timeout nécessaires pour CLIP ──
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',  // Images base64 peuvent être volumineuses
    },
  },
};