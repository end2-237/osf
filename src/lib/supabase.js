import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // ✅ FIX AbortError: bypass navigator.locks instable
    lock: (name, acquireTimeout, fn) => fn(),
  }
});

// ✅ NOUVEAU: Wake-up ping pour Supabase Free Tier
// Le plan gratuit met le projet en veille après 7 jours d'inactivité
// Ce ping léger le réveille dès le chargement de l'app, avant que l'auth n'essaie de se connecter
export const wakeUpSupabase = async () => {
  try {
    console.log('[SUPABASE] Ping wake-up...');
    await supabase.from('vendors').select('id').limit(1).maybeSingle();
    console.log('[SUPABASE] ✅ Base de données active');
  } catch (err) {
    console.warn('[SUPABASE] Wake-up ping ignoré:', err.message);
  }
};

// Déclencher le ping immédiatement au chargement du module
wakeUpSupabase();

// Compress image to JPEG ≤ 1200px wide at 82% quality before upload
const compressImage = (file) =>
  new Promise((resolve) => {
    const MAX_PX = 1200;
    const QUALITY = 0.82;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(resolve, 'image/jpeg', QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

// Storage helpers
export const uploadProductImage = async (file, vendorId) => {
  const compressed = await compressImage(file);
  const fileName = `${vendorId}/${Date.now()}.jpg`;

  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(fileName, compressed, {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: false
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(data.path);

  return publicUrl;
};

export const deleteProductImage = async (imageUrl) => {
  const path = imageUrl.split('/product-images/')[1];
  if (!path) return;
  
  const { error } = await supabase.storage
    .from('product-images')
    .remove([path]);

  if (error) console.error('Error deleting image:', error);
};