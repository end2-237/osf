import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const useWishlist = () => {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [loading, setLoading] = useState(false);

  // Charger les IDs en wishlist au login
  useEffect(() => {
    if (!user) { setWishlistIds(new Set()); return; }
    const fetch = async () => {
      const { data } = await supabase
        .from('wishlists')
        .select('product_id')
        .eq('user_id', user.id);
      if (data) setWishlistIds(new Set(data.map(d => d.product_id)));
    };
    fetch();
  }, [user]);

  const isInWishlist = useCallback(
    (productId) => wishlistIds.has(productId),
    [wishlistIds]
  );

  const toggle = useCallback(async (product) => {
    if (!user) return false; // non connecté
    const inList = wishlistIds.has(product.id);
    setLoading(true);

    if (inList) {
      await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', product.id);
      setWishlistIds(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    } else {
      await supabase
        .from('wishlists')
        .insert({ user_id: user.id, product_id: product.id });
      setWishlistIds(prev => new Set([...prev, product.id]));
    }

    setLoading(false);
    return !inList; // true = ajouté, false = retiré
  }, [user, wishlistIds]);

  return { wishlistIds, isInWishlist, toggle, loading };
};