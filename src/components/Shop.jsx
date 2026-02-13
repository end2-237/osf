import React from "react";
import ProductCard from "./ProductCard";
import ofsLogo from "../assets/ofs.png";

// Composant Squelette avec effet Shimmer
const ProductSkeleton = () => (
  <div className="animate-pulse">
    <div className="aspect-[3/4] overflow-hidden bg-zinc-200 dark:bg-zinc-900 rounded-[1.5rem] md:rounded-[2rem] mb-3 relative flex items-center justify-center">
      {/* Logo Filigrane */}
      <img 
        src={ofsLogo} 
        alt="" 
        className="w-16 h-auto opacity-10 grayscale brightness-0 dark:brightness-100" 
      />
      {/* Effet de balayage Shimmer */}
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

const Shop = ({ openModal, addToCart, products, loading }) => {
  return (
    <section id="shop" className="py-24 px-4 md:px-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-[1600px] mx-auto text-center">
        <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-20 italic">
          Elite <span className="text-primary underline decoration-black dark:decoration-white">Collection</span>
        </h2>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 md:gap-x-8 gap-y-6 md:gap-y-16">
          {loading ? (
            // Affiche 8 squelettes pendant le chargement
            Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
          ) : products && products.length === 0 ? (
            <div className="col-span-full py-20 text-center font-bold text-zinc-400 text-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-900 rounded-[3rem]">
              Aucun produit trouvé
            </div>
          ) : (
            products.map((product) => (
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
    </section>
  );
};

export default Shop;