import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ProductCard from '../components/ProductCard';
import Navbar from '../components/Navbar';

const ShopPage = ({ openModal, addToCart }) => {
  const { shopName } = useParams();
  const [shopOwner, setShopOwner] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShopData = async () => {
      setLoading(true);
      try {
        // 1. Trouver le vendeur par son nom de boutique
        const { data: vendorData, error: vError } = await supabase
          .from('vendors')
          .select('*')
          .eq('shop_name', shopName)
          .single();

        if (vError) throw vError;
        setShopOwner(vendorData);

        // 2. Charger ses produits
        const { data: pData, error: pError } = await supabase
          .from('products')
          .select('*')
          .eq('vendor_id', vendorData.id)
          .order('created_at', { ascending: false });

        if (pError) throw pError;
        setProducts(pData || []);
      } catch (err) {
        console.error("Erreur boutique:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchShopData();
  }, [shopName]);

  if (loading) return <div className="pt-32 text-center font-black uppercase italic">Chargement de l'univers...</div>;
  if (!shopOwner) return <div className="pt-32 text-center font-black uppercase italic text-red-500">Boutique introuvable</div>;

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Navbar />
      <div className="pt-32 pb-20 px-6 max-w-[1600px] mx-auto">
        <div className="mb-16 border-b border-zinc-100 dark:border-zinc-800 pb-10">
          <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-none mb-4">
            {shopOwner.shop_name}
          </h1>
          <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.3em]">
            Curated by {shopOwner.full_name} // {products.length} Assets
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              openModal={openModal} 
              addToCart={addToCart} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShopPage;