// src/pages/ShopPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ProductCard from '../components/ProductCard';

const ShopPage = ({ openModal, addToCart }) => {
  const { shopName } = useParams();
  const [shopOwner, setShopOwner] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShopData = async () => {
      setLoading(true);
      try {
        const { data: vendorData, error: vError } = await supabase
          .from('vendors').select('*').eq('shop_name', shopName).single();
        if (vError) throw vError;
        setShopOwner(vendorData);

        const { data: pData, error: pError } = await supabase
          .from('products').select('*').eq('vendor_id', vendorData.id).order('created_at', { ascending: false });
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!shopOwner) return <div className="pt-32 text-center font-black uppercase text-red-500">Boutique introuvable</div>;

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505]">
      {/* HERO SECTION BOUTIQUE */}
      <div className="relative h-[40vh] md:h-[50vh] bg-zinc-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-[#050505] z-10"></div>
        <img 
          src={`https://picsum.photos/1600/900?random=${shopOwner.id}`} 
          className="w-full h-full object-cover opacity-60 grayscale" 
          alt="Cover"
        />
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-6">
          <span className="bg-primary text-black px-4 py-1 text-[10px] font-black uppercase tracking-[0.3em] mb-4 animate-bounce">
            Certified Vendor
          </span>
          <h1 className="text-6xl md:text-9xl font-black italic tracking-tighter uppercase text-white leading-none mb-4">
            {shopOwner.shop_name}
          </h1>
          <div className="flex items-center space-x-6 text-white/70 font-bold uppercase text-[10px] tracking-widest">
            <span><i className="fa-solid fa-box-open text-primary mr-2"></i>{products.length} Items</span>
            <span><i className="fa-solid fa-star text-primary mr-2"></i>Elite Quality</span>
            <span><i className="fa-solid fa-location-dot text-primary mr-2"></i>Douala, CM</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 -mt-10 relative z-30 pb-20">
        {/* BARRE DE FILTRE RAPIDE */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl p-6 mb-12 flex flex-wrap justify-between items-center gap-4 shadow-2xl">
           <p className="text-[11px] font-black uppercase italic tracking-tight">
             Explorez la collection de <span className="text-primary">{shopOwner.full_name}</span>
           </p>
           <div className="flex gap-2">
              <button className="px-4 py-2 bg-primary text-black text-[9px] font-black uppercase rounded-lg">Recent</button>
              <button className="px-4 py-2 bg-zinc-100 dark:bg-black text-[9px] font-black uppercase rounded-lg">Popular</button>
           </div>
        </div>

        {/* GRILLE OPTIMISÉE */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
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