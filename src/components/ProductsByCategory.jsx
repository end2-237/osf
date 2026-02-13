import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import ofsLogo from '../assets/ofs.png';

const SECTIONS = [
  { key: 'Audio Lab', label: 'Audio Lab', icon: 'fa-headphones', color: 'text-primary', accent: '#00ff88' },
  { key: 'Clothing', label: 'Streetwear', icon: 'fa-shirt', color: 'text-purple-400', accent: '#a855f7' },
  { key: 'Shoes', label: 'Sneakers', icon: 'fa-shoe-prints', color: 'text-orange-400', accent: '#f97316' },
  { key: 'Tech Lab', label: 'Tech Lab', icon: 'fa-microchip', color: 'text-blue-400', accent: '#3b82f6' },
];

const SkeletonCard = () => (
  <div className="animate-pulse flex-shrink-0 w-[180px] md:w-[200px]">
    <div className="aspect-[3/4] bg-zinc-800 rounded-2xl mb-2 relative overflow-hidden">
      <img src={ofsLogo} className="absolute inset-0 m-auto w-10 opacity-10 grayscale" alt="" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
    </div>
    <div className="h-2.5 bg-zinc-800 rounded w-3/4 mb-1.5"></div>
    <div className="h-2 bg-zinc-800 rounded w-1/2"></div>
  </div>
);

const ProductsByCategory = ({ allProducts, loading, openModal, addToCart }) => {
  const scrollRefs = useRef({});

  const scroll = (key, dir) => {
    const el = scrollRefs.current[key];
    if (el) el.scrollBy({ left: dir * 600, behavior: 'smooth' });
  };

  const getProducts = (key) => {
    if (!allProducts) return [];
    return allProducts.filter((p) => p.type === key).slice(0, 10);
  };

  return (
    <div className="bg-white dark:bg-black">
      {SECTIONS.map((section) => {
        const products = getProducts(section.key);
        const hasProducts = loading || products.length > 0;
        if (!hasProducts && !loading) return null;

        return (
          <section key={section.key} className="py-8 px-4 md:px-8 border-b border-zinc-100 dark:border-white/5">
            <div className="max-w-[1600px] mx-auto">

              {/* SECTION HEADER */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${section.accent}15`, border: `1px solid ${section.accent}30` }}
                  >
                    <i className={`fa-solid ${section.icon} text-sm ${section.color}`}></i>
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-base tracking-tight dark:text-white text-zinc-900">
                      {section.label}
                    </h3>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      {loading ? '...' : `${getProducts(section.key).length} produits`}
                    </p>
                  </div>
                  <div className="hidden md:block h-px flex-grow bg-gradient-to-r from-zinc-200 dark:from-white/5 to-transparent w-24 ml-2"></div>
                </div>

                <div className="flex items-center gap-3">
                  {/* SCROLL ARROWS */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => scroll(section.key, -1)}
                      className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/5 flex items-center justify-center hover:border-primary/50 hover:text-primary transition-all dark:text-white text-zinc-500"
                    >
                      <i className="fa-solid fa-chevron-left text-xs"></i>
                    </button>
                    <button
                      onClick={() => scroll(section.key, 1)}
                      className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/5 flex items-center justify-center hover:border-primary/50 hover:text-primary transition-all dark:text-white text-zinc-500"
                    >
                      <i className="fa-solid fa-chevron-right text-xs"></i>
                    </button>
                  </div>
                  <Link
                    to="/store"
                    className="hidden md:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 hover:border-primary/50 hover:text-primary dark:text-zinc-400 text-zinc-500 transition-all"
                  >
                    <span>Voir tout</span>
                    <i className="fa-solid fa-arrow-right text-xs"></i>
                  </Link>
                </div>
              </div>

              {/* HORIZONTAL SCROLL ROW */}
              <div
                ref={(el) => (scrollRefs.current[section.key] = el)}
                className="flex gap-4 overflow-x-auto hide-scrollbar pb-2"
                style={{ scrollSnapType: 'x mandatory' }}
              >
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
                  : products.map((product) => (
                    <div
                      key={product.id}
                      className="flex-shrink-0 w-[180px] md:w-[200px]"
                      style={{ scrollSnapAlign: 'start' }}
                    >
                      <ProductCard
                        product={product}
                        openModal={openModal}
                        addToCart={addToCart}
                      />
                    </div>
                  ))}

                {/* VIEW ALL CARD */}
                {!loading && products.length >= 4 && (
                  <div
                    className="flex-shrink-0 w-[150px] md:w-[160px] flex items-center justify-center"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    <Link
                      to="/store"
                      className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-primary/40 group transition-all h-full w-full justify-center"
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors"
                        style={{ backgroundColor: `${section.accent}10` }}
                      >
                        <i className={`fa-solid ${section.icon} text-xl ${section.color}`}></i>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-center dark:text-zinc-400 text-zinc-500 group-hover:text-primary transition-colors">
                        Voir<br/>Tout
                      </p>
                    </Link>
                  </div>
                )}
              </div>

            </div>
          </section>
        );
      })}
    </div>
  );
};

export default ProductsByCategory;