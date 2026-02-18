import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import HeroBanners from "../components/HeroBanners";
import CategoryGrid from "../components/CategoryGrid";
import ProductsByCategory from "../components/ProductsByCategory";
import FlashDrop from "../components/FlashDrop";
import Marquee from "../components/Marquee";
import { supabase } from "../lib/supabase";

// FLASH DEALS SECTION
const FlashDeals = ({ products, loading, openModal, addToCart }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 5, m: 47, s: 30 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        let { h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 23; m = 59; s = 59; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const deals = (products || []).slice(0, 6);

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <section className="py-8 px-4 md:px-8 bg-zinc-950 border-y border-white/5">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-bolt text-primary text-xl"></i>
              <h2 className="text-xl font-black uppercase tracking-tighter text-white">
                Flash <span className="text-primary italic">Deals</span>
              </h2>
            </div>
            {/* COUNTDOWN */}
            <div className="flex items-center gap-1.5 bg-black border border-white/10 rounded-xl px-4 py-2">
              {[pad(timeLeft.h), pad(timeLeft.m), pad(timeLeft.s)].map((val, i) => (
                <React.Fragment key={i}>
                  <span className="text-primary font-black text-sm font-mono">{val}</span>
                  {i < 2 && <span className="text-zinc-600 font-black text-sm">:</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <Link to="/store" className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 hover:underline decoration-primary underline-offset-4">
            <span>Toutes les promos</span>
            <i className="fa-solid fa-arrow-right text-xs"></i>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {(loading ? Array.from({ length: 6 }) : deals).map((product, i) => (
            <div
              key={product?.id || i}
              onClick={() => product && openModal(product)}
              className="bg-black border border-white/5 rounded-2xl overflow-hidden group cursor-pointer hover:border-primary/30 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.1)]"
            >
              <div className="relative aspect-square overflow-hidden bg-zinc-900">
                {loading ? (
                  <div className="w-full h-full bg-zinc-800 animate-pulse"></div>
                ) : (
                  <>
                    <img
                      src={product.img}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute top-2 left-2 bg-primary text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase">
                      -{Math.floor(10 + Math.random() * 30)}%
                    </div>
                  </>
                )}
              </div>
              <div className="p-3">
                {loading ? (
                  <>
                    <div className="h-2.5 bg-zinc-800 rounded w-3/4 mb-1.5 animate-pulse"></div>
                    <div className="h-3 bg-zinc-800 rounded w-1/2 animate-pulse"></div>
                  </>
                ) : (
                  <>
                    <p className="text-zinc-300 font-black text-[10px] uppercase italic truncate mb-1">{product.name}</p>
                    <p className="text-primary font-black text-sm">{Number(product.price).toLocaleString()} F</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// VENDORS SECTION
const VendorsSection = () => (
  <section className="py-8 px-4 md:px-8 bg-white dark:bg-black">
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-primary rounded-full"></div>
          <h2 className="text-xl font-black uppercase tracking-tighter dark:text-white text-zinc-900">
            Boutiques <span className="text-primary italic">Certifiées</span>
          </h2>
        </div>
        <Link to="/register" className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 hover:underline decoration-primary underline-offset-4">
          <span>Devenir vendeur</span>
          <i className="fa-solid fa-arrow-right text-xs"></i>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* BECOME VENDOR CTA */}
        <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-2xl p-8 flex flex-col justify-between min-h-[180px]">
          <div>
            <i className="fa-solid fa-store text-primary text-2xl mb-4"></i>
            <h3 className="font-black text-lg uppercase italic dark:text-white text-zinc-900 leading-tight">
              Ouvre ta<br/>boutique Elite
            </h3>
          </div>
          <Link
            to="/register"
            className="bg-primary text-black text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl hover:bg-white transition-colors w-fit mt-4 flex items-center gap-2"
          >
            <span>S'inscrire</span>
            <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>

        {/* INFO CARDS */}
        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-users text-blue-400"></i>
            </div>
            <div>
              <p className="font-black uppercase text-xs dark:text-white text-zinc-900">Communauté Active</p>
              <p className="text-[9px] text-zinc-500 font-bold">Vendeurs certifiés sur Douala</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              { val: '5', label: 'Vendeurs Max' },
              { val: '500+', label: 'Produits' },
              { val: '100+', label: 'Commandes' },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 bg-white dark:bg-black rounded-xl">
                <p className="font-black text-primary text-lg leading-none">{s.val}</p>
                <p className="text-[8px] font-bold uppercase text-zinc-500 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl p-6">
          <h4 className="font-black uppercase text-xs dark:text-white text-zinc-900 mb-4">Avantages vendeur</h4>
          <div className="space-y-3">
            {[
              { icon: 'fa-shop', text: 'Boutique personnalisée' },
              { icon: 'fa-bell', text: 'Notifications commandes temps réel' },
              { icon: 'fa-chart-line', text: 'Dashboard analytics intégré' },
              { icon: 'fa-share-nodes', text: 'Partage réseaux sociaux' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-[11px] font-bold text-zinc-500">
                <i className={`fa-solid ${item.icon} text-primary text-xs w-4`}></i>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ── MAIN HOME COMPONENT ──
const Home = ({ openModal, addToCart }) => {
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getItems() {
      setLoading(true);
      try {
        const { data: pData } = await supabase
          .from('products')
          .select('*, vendor:vendors!vendor_id(member_discount_enabled)')
          .order('created_at', { ascending: false });
        setProductsList(pData || []);
      } catch (error) {
        console.error("Erreur:", error.message);
      } finally {
        setLoading(false);
      }
    }
    getItems();
  }, []);

  return (
    <div className="bg-white dark:bg-black">

      {/* 1. HERO BANNERS (iziway style) */}
      <HeroBanners />

      {/* 2. TICKER / MARQUEE */}
      <Marquee />

      {/* 3. CATEGORY GRID */}
      <CategoryGrid />

      {/* 4. FLASH DEALS */}
      <FlashDeals
        products={productsList}
        loading={loading}
        openModal={openModal}
        addToCart={addToCart}
      />

      {/* 5. PRODUCTS BY CATEGORY (iziway horizontal rows) */}
      <ProductsByCategory
        allProducts={productsList}
        loading={loading}
        openModal={openModal}
        addToCart={addToCart}
      />

      {/* 6. BRAND PROMO BAND */}
      <FlashDrop />

      {/* 7. VENDORS SECTION */}
      <VendorsSection />
    </div>
  );
};

export default Home;