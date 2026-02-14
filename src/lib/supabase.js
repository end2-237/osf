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

// Storage helpers
export const uploadProductImage = async (file, vendorId) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${vendorId}/${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, {
      cacheControl: '3600',
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