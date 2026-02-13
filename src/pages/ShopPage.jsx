import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ProductCard from '../components/ProductCard';
import ofsLogo from "../assets/ofs.png"; // ✅ Import du logo pour le filigrane

// ✅ Sous-composant pour l'effet Shimmer (Squelette de chargement)
const ProductSkeleton = () => (
  <div className="animate-pulse">
    <div className="aspect-[3/4] overflow-hidden bg-zinc-200 dark:bg-zinc-900 rounded-[1.5rem] md:rounded-[2rem] mb-3 relative flex items-center justify-center">
      <img 
        src={ofsLogo} 
        alt="" 
        className="w-16 h-auto opacity-10 grayscale brightness-0 dark:brightness-100" 
      />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
    </div>
    <div className="px-1 space-y-2">
      <div className="h-3 bg-zinc-200 dark:bg-zinc-900 rounded-full w-3/4"></div>
      <div className="flex justify-between items-center">
        <div className="h-2 bg-zinc-200 dark:bg-zinc-900 rounded-full w-1/3"></div>
        <div className="h-3 bg-zinc-200 dark:bg-zinc-900 rounded-full w-1/4"></div>
      </div>
    </div>
  </div>
);

const ShopPage = ({ openModal, addToCart }) => {
  const { shopName } = useParams();
  const [searchParams] = useSearchParams();
  const [shopOwner, setShopOwner] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const autoModalDone = useRef(false);

  useEffect(() => {
    const fetchShopData = async () => {
      setLoading(true);
      try {
        const { data: vendorData, error: vError } = await supabase
          .from('vendors').select('*').eq('shop_name', shopName).single();
        if (vError) throw vError;
        setShopOwner(vendorData);

        const { data: pData, error: pError } = await supabase
          .from('products').select('*').eq('vendor_id', vendorData.id)
          .order('created_at', { ascending: false });
        if (pError) throw pError;
        setProducts(pData || []);
      } catch (err) {
        console.error('Erreur boutique:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchShopData();
    autoModalDone.current = false;
  }, [shopName]);

  useEffect(() => {
    if (!loading && products.length > 0 && !autoModalDone.current) {
      const productId = searchParams.get('product');
      if (productId) {
        const found = products.find(p => p.id === productId);
        if (found) {
          autoModalDone.current = true;
          setTimeout(() => openModal(found), 300);
        }
      }
    }
  }, [loading, products, searchParams, openModal]);

  // ✅ Suppression du "if (loading) return black screen" pour permettre l'affichage du squelette dans le layout
  if (!loading && !shopOwner) return (
    <div className="pt-32 text-center font-black uppercase text-red-500">
      Boutique introuvable
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505]">

      {/* ===== HERO SECTION ===== */}
      <div className="relative h-[40vh] md:h-[55vh] bg-zinc-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-zinc-900 dark:to-[#050505] z-10"></div>
        {shopOwner && (
          <img
            src={`https://picsum.photos/1600/900?random=${shopOwner.id}`}
            className="w-full h-full object-cover opacity-60 grayscale"
            alt="Cover"
          />
        )}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-6">
          <span className="bg-primary text-black px-4 py-1 text-[10px] font-black uppercase tracking-[0.3em] mb-4 animate-bounce">
            Certified Vendor
          </span>
          <h1 className="text-6xl md:text-9xl font-black italic tracking-tighter uppercase text-white leading-none mb-4">
            {loading ? "Chargement..." : shopOwner?.shop_name}
          </h1>
          {!loading && (
            <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-white/70 font-bold uppercase text-[10px] tracking-widest">
              <span><i className="fa-solid fa-box-open text-primary mr-2"></i>{products.length} Items</span>
              <span><i className="fa-solid fa-star text-primary mr-2"></i>Elite Quality</span>
              <span><i className="fa-solid fa-location-dot text-primary mr-2"></i>Douala, CM</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== CONTENU ===== */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 -mt-10 md:-mt-16 relative z-30 pb-20">

        {/* BARRE FILTRE / INFO */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl p-4 md:p-6 mb-8 md:mb-12 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-6">
            <p className="text-[11px] font-black uppercase italic tracking-tight text-zinc-800 dark:text-white">
              {loading ? "Initialisation de la collection..." : (
                <>Explorez la collection de <span className="text-primary">{shopOwner?.full_name}</span></>
              )}
            </p>
            <div className="flex gap-2 shrink-0">
              <button className="px-4 py-2 bg-primary text-black text-[9px] font-black uppercase rounded-lg">Recent</button>
              <button className="px-4 py-2 bg-zinc-100 dark:bg-black text-zinc-600 dark:text-white text-[9px] font-black uppercase rounded-lg">Popular</button>
            </div>
          </div>
        </div>

        {/* GRILLE PRODUITS AVEC SKELETONS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5 lg:gap-6 items-start">
          {loading ? (
            // ✅ Affiche 10 squelettes pendant le chargement
            Array.from({ length: 10 }).map((_, i) => <ProductSkeleton key={i} />)
          ) : products.length === 0 ? (
            <div className="col-span-full py-32 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-900 rounded-3xl">
              <p className="text-xl font-black italic uppercase opacity-30">Aucun produit disponible</p>
            </div>
          ) : (
            products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                openModal={openModal}
                addToCart={addToCart}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopPage;