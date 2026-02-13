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
    // ✅ FIX AbortError: bypass navigator.locks qui est instable dans certains navigateurs
    // Cela désactive le verrou natif du browser et évite le crash "signal is aborted without reason"
    lock: (name, acquireTimeout, fn) => fn(),
  }
});

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