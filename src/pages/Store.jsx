import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { supabase } from '../lib/supabase';
import ofsLogo from '../assets/ofs.png';

/* ─────────────────── CONSTANTS ─────────────────── */
const CATEGORIES = [
  { key: 'All', label: 'Tout voir', icon: 'fa-grid-2', color: '#00ff88' },
  { key: 'Audio Lab', label: 'Audio Lab', icon: 'fa-headphones', color: '#00ff88' },
  { key: 'Clothing', label: 'Streetwear', icon: 'fa-shirt', color: '#a855f7' },
  { key: 'Shoes', label: 'Sneakers', icon: 'fa-shoe-prints', color: '#f97316' },
  { key: 'Tech Lab', label: 'Tech Lab', icon: 'fa-microchip', color: '#3b82f6' },
  { key: 'Fragrance', label: 'Parfums', icon: 'fa-spray-can-sparkles', color: '#ec4899' },
  { key: 'Accessories', label: 'Accessoires', icon: 'fa-gem', color: '#eab308' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Plus récents' },
  { value: 'popular', label: 'Populaires' },
  { value: 'price-asc', label: 'Prix croissant' },
  { value: 'price-desc', label: 'Prix décroissant' },
];

const PROMO_BANNERS = [
  {
    tag: 'FLASH DEAL',
    title: 'Audio Lab',
    sub: '-25% sur tous les casques',
    color: '#00ff88',
    img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600',
    bg: 'from-emerald-50 to-white',
  },
  {
    tag: 'NEW DROP',
    title: 'Sneakers',
    sub: 'Éditions limitées arrivées',
    color: '#f97316',
    img: 'https://images.unsplash.com/photo-1552066344-24632e509633?q=80&w=600',
    bg: 'from-orange-50 to-white',
  },
  {
    tag: 'BUNDLE',
    title: 'Tech Lab',
    sub: '2 articles = -15%',
    color: '#3b82f6',
    img: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=600',
    bg: 'from-blue-50 to-white',
  },
];

/* ─────────────────── SKELETON ─────────────────── */
const ProductSkeleton = () => (
  <div className="animate-pulse">
    <div className="aspect-[3/4] overflow-hidden bg-zinc-100 rounded-2xl mb-3 relative flex items-center justify-center">
      <img src={ofsLogo} alt="" className="w-10 opacity-10 grayscale" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-200/60 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
    </div>
    <div className="space-y-1.5">
      <div className="h-2.5 bg-zinc-100 rounded w-3/4"></div>
      <div className="flex justify-between">
        <div className="h-2 bg-zinc-100 rounded w-1/3"></div>
        <div className="h-2.5 bg-zinc-100 rounded w-1/4"></div>
      </div>
    </div>
  </div>
);

const VendorSkeleton = () => (
  <div className="animate-pulse bg-white border border-zinc-100 rounded-2xl p-5">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-12 h-12 bg-zinc-100 rounded-xl"></div>
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-zinc-100 rounded w-2/3"></div>
        <div className="h-2 bg-zinc-100 rounded w-1/2"></div>
      </div>
    </div>
    <div className="h-16 bg-zinc-50 rounded-xl"></div>
  </div>
);

/* ─────────────────── HERO BANNER ─────────────────── */
const MarketplaceHero = ({ totalProducts, searchQuery, setSearchQuery, onSearch }) => {
  const [focused, setFocused] = useState(false);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-zinc-700 via-zinc-600 to-zinc-700 py-14 md:py-20 px-4 md:px-8">
      {/* DECORATIVE GRID */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,255,136,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />
      {/* GLOW BLOBS */}
      <div className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px]"></div>
      <div className="absolute -bottom-10 left-1/3 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[80px]"></div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        <div className="max-w-2xl">
          {/* BADGE */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
            <span className="text-primary text-[9px] font-black uppercase tracking-[0.4em]">
              {totalProducts}+ produits disponibles · Douala 🇨🇲
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter leading-none text-white mb-3 uppercase">
            La Marketplace<br/>
            <span className="text-primary">Elite</span> de Douala
          </h1>
          <p className="text-zinc-400 font-bold text-sm mb-8 max-w-lg">
            Audio, Streetwear, Tech & plus — boutiques certifiées, livraison express, paiement sécurisé.
          </p>

          {/* SEARCH BAR */}
          <div className={`flex items-center bg-white rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${focused ? 'ring-4 ring-primary/30 shadow-[0_0_30px_rgba(0,255,136,0.15)]' : ''}`}>
            <div className="flex items-center flex-1 px-5 py-1">
              <i className="fa-solid fa-magnifying-glass text-zinc-400 text-sm mr-3"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => e.key === 'Enter' && onSearch()}
                placeholder="Casque, sneakers, parfum, tech..."
                className="flex-1 bg-transparent py-4 text-sm font-bold text-zinc-900 placeholder-zinc-400 outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-zinc-400 hover:text-zinc-700 transition">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>
            <button
              onClick={onSearch}
              className="bg-primary text-black px-8 py-[21px] font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-primary transition-all flex items-center gap-2 flex-shrink-0"
            >
              <span className="hidden md:inline">Rechercher</span>
              <i className="fa-solid fa-arrow-right text-sm"></i>
            </button>
          </div>

          {/* QUICK TAGS */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Tendances:</span>
            {['AirPods', 'Sneakers', 'Casque', 'Hoodies'].map(tag => (
              <button
                key={tag}
                onClick={() => { setSearchQuery(tag); }}
                className="text-[9px] font-black uppercase px-3 py-1.5 rounded-full bg-white/15 text-zinc-200 hover:bg-primary hover:text-black transition-all border border-white/20 hover:border-primary"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-12">
          {[
            { icon: 'fa-store', val: '5+', label: 'Boutiques Certifiées', color: 'text-primary' },
            { icon: 'fa-truck-fast', val: '2h', label: 'Livraison Douala', color: 'text-blue-400' },
            { icon: 'fa-shield-check', val: '100%', label: 'Paiement Sécurisé', color: 'text-emerald-400' },
            { icon: 'fa-rotate-left', val: '7j', label: 'Retour Gratuit', color: 'text-purple-400' },
          ].map(item => (
            <div key={item.label} className="bg-white/10 border border-white/15 rounded-2xl p-4 flex items-center gap-3 hover:border-white/25 transition-colors backdrop-blur-sm">
              <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className={`fa-solid ${item.icon} ${item.color} text-sm`}></i>
              </div>
              <div>
                <p className={`font-black text-lg leading-none ${item.color}`}>{item.val}</p>
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────── PROMO BANNERS STRIP ─────────────────── */
const PromoBanners = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 px-4 md:px-8 max-w-[1400px] mx-auto">
    {PROMO_BANNERS.map((b, i) => (
      <Link
        key={i}
        to="/store"
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${b.bg} border border-zinc-100 p-5 flex items-center gap-4 group hover:shadow-lg transition-all hover:-translate-y-0.5`}
      >
        <div className="flex-1">
          <span
            className="text-[9px] font-black uppercase tracking-[0.4em] px-2.5 py-1 rounded-full mb-2 inline-block"
            style={{ backgroundColor: `${b.color}15`, color: b.color, border: `1px solid ${b.color}30` }}
          >
            {b.tag}
          </span>
          <h3 className="font-black text-xl uppercase italic tracking-tighter text-zinc-900 leading-none">{b.title}</h3>
          <p className="text-[10px] font-bold text-zinc-500 mt-1">{b.sub}</p>
        </div>
        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 relative">
          <img src={b.img} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        </div>
        <i className="fa-solid fa-arrow-right absolute top-4 right-4 text-xs text-zinc-300 group-hover:text-zinc-600 group-hover:translate-x-1 transition-all"></i>
      </Link>
    ))}
  </div>
);

/* ─────────────────── VENDORS SECTION ─────────────────── */
const VendorsSection = ({ vendors, loading, vendorProducts }) => {
  if (!loading && vendors.length === 0) return null;

  return (
    <div className="bg-zinc-50 border-y border-zinc-100 py-8 px-4 md:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-primary rounded-full"></div>
            <div>
              <h2 className="text-base font-black uppercase tracking-tighter text-zinc-900">
                Boutiques <span className="text-primary italic">Certifiées</span>
              </h2>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Vendeurs vérifiés OneFreestyle</p>
            </div>
          </div>
          <Link to="/register" className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:underline decoration-primary underline-offset-4">
            <span>Devenir vendeur</span>
            <i className="fa-solid fa-arrow-right text-xs"></i>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <VendorSkeleton key={i} />)
          ) : (
            vendors.map(vendor => {
              const vProducts = vendorProducts[vendor.id] || [];
              const categories = [...new Set(vProducts.map(p => p.type))];
              return (
                <Link
                  key={vendor.id}
                  to={`/shop/${vendor.shop_name}`}
                  className="bg-white border border-zinc-100 rounded-2xl p-5 group hover:border-primary/30 hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3 mb-4">
                    {/* AVATAR */}
                    <div className="w-12 h-12 bg-gradient-to-br from-primary/15 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20 flex-shrink-0 group-hover:border-primary/40 transition-colors">
                      <i className="fa-solid fa-store text-primary"></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="font-black uppercase italic tracking-tighter text-zinc-900 truncate text-sm group-hover:text-primary transition-colors">
                          {vendor.shop_name}
                        </h3>
                        <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                          <i className="fa-solid fa-check text-black text-[7px]"></i>
                        </div>
                      </div>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase truncate">{vendor.full_name}</p>
                    </div>
                  </div>

                  {/* PRODUCT PREVIEW */}
                  {vProducts.length > 0 ? (
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {vProducts.slice(0, 3).map((p, i) => (
                        <div key={i} className="aspect-square rounded-lg overflow-hidden bg-zinc-50">
                          <img src={p.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-16 bg-zinc-50 rounded-xl flex items-center justify-center mb-3">
                      <p className="text-[9px] font-bold text-zinc-300 uppercase">Bientôt disponible</p>
                    </div>
                  )}

                  {/* META */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[9px] font-black uppercase text-zinc-400">
                      <span><i className="fa-solid fa-box text-primary mr-1"></i>{vProducts.length} items</span>
                      <div className="flex items-center gap-0.5">
                        <i className="fa-solid fa-star text-yellow-400 text-[8px]"></i>
                        <span className="text-zinc-500">4.8</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Voir <i className="fa-solid fa-arrow-right text-[8px]"></i>
                    </span>
                  </div>

                  {/* CATEGORIES PILLS */}
                  {categories.length > 0 && (
                    <div className="flex gap-1 mt-3 flex-wrap">
                      {categories.slice(0, 2).map(cat => (
                        <span key={cat} className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-zinc-50 text-zinc-400 border border-zinc-100">
                          {cat}
                        </span>
                      ))}
                      {categories.length > 2 && (
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-zinc-50 text-zinc-400 border border-zinc-100">
                          +{categories.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })
          )}

          {/* BECOME VENDOR CTA */}
          {!loading && (
            <Link
              to="/register"
              className="bg-gradient-to-br from-primary/8 to-primary/3 border-2 border-dashed border-primary/25 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 group hover:border-primary/50 hover:bg-primary/10 transition-all min-h-[180px]"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <i className="fa-solid fa-plus text-primary text-xl"></i>
              </div>
              <div className="text-center">
                <p className="font-black text-sm uppercase italic tracking-tighter text-zinc-900">Ouvre ta boutique</p>
                <p className="text-[9px] font-bold text-zinc-400 mt-0.5">Rejoindre la marketplace Elite</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────── CATEGORY TABS ─────────────────── */
const CategoryTabs = ({ active, onChange, counts }) => {
  const scrollRef = useRef(null);

  return (
    <div className="sticky top-[114px] z-30 bg-white border-b border-zinc-100 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <div
          ref={scrollRef}
          className="flex items-center gap-1 overflow-x-auto hide-scrollbar py-3"
        >
          {CATEGORIES.map(cat => {
            const count = cat.key === 'All' ? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[cat.key] || 0);
            const isActive = active === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => onChange(cat.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 border ${
                  isActive
                    ? 'bg-zinc-700 text-white border-zinc-700 shadow-md'
                    : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                <i
                  className={`fa-solid ${cat.icon} text-xs`}
                  style={{ color: isActive ? '#00ff88' : cat.color }}
                ></i>
                <span>{cat.label}</span>
                <span
                  className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${
                    isActive ? 'bg-primary/20 text-primary' : 'bg-zinc-100 text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────── SIDEBAR FILTERS ─────────────────── */
const SidebarFilters = ({ maxPrice, setMaxPrice, priceMax, sortBy, setSortBy, selectedSize, setSelectedSize, category }) => (
  <aside className="w-56 flex-shrink-0 space-y-6">

    {/* SORT */}
    <div className="bg-white border border-zinc-100 rounded-2xl p-5">
      <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-3 flex items-center gap-2">
        <i className="fa-solid fa-sort text-primary text-xs"></i>Trier par
      </h4>
      <div className="space-y-1">
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSortBy(opt.value)}
            className={`w-full text-left text-[11px] font-bold uppercase px-3 py-2 rounded-xl transition-all ${
              sortBy === opt.value
                ? 'bg-zinc-700 text-primary'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>

    {/* PRICE RANGE */}
    <div className="bg-white border border-zinc-100 rounded-2xl p-5">
      <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-3 flex items-center gap-2">
        <i className="fa-solid fa-tag text-primary text-xs"></i>Budget Max
      </h4>
      <div className="mb-3">
        <span className="text-xl font-black italic text-zinc-900 tracking-tighter">{Number(maxPrice).toLocaleString()}</span>
        <span className="text-[10px] font-bold text-zinc-400 ml-1">FCFA</span>
      </div>
      <input
        type="range"
        min="0"
        max={priceMax}
        step="5000"
        value={maxPrice}
        onChange={e => setMaxPrice(Number(e.target.value))}
        className="w-full accent-primary cursor-pointer"
        style={{ accentColor: '#00ff88' }}
      />
      <div className="flex justify-between text-[8px] font-bold text-zinc-400 mt-1">
        <span>0</span><span>{priceMax.toLocaleString()} F</span>
      </div>
    </div>

    {/* SIZE */}
    {(category === 'Clothing' || category === 'Shoes' || category === 'All') && (
      <div className="bg-white border border-zinc-100 rounded-2xl p-5">
        <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-3 flex items-center gap-2">
          <i className="fa-solid fa-ruler text-primary text-xs"></i>Taille
        </h4>
        <div className="grid grid-cols-3 gap-1.5">
          {['All', ...(category === 'Shoes' ? ['40','41','42','43','44'] : ['XS','S','M','L','XL'])].map(s => (
            <button
              key={s}
              onClick={() => setSelectedSize(s)}
              className={`py-2 text-[9px] font-black rounded-lg border transition-all ${
                selectedSize === s
                  ? 'bg-zinc-700 text-primary border-zinc-700'
                  : 'border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    )}

    {/* INFO CARD */}
    <div className="bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/15 rounded-2xl p-5">
      <i className="fa-solid fa-bolt text-primary text-lg mb-3 block"></i>
      <h4 className="font-black text-sm uppercase italic tracking-tighter text-zinc-900 leading-tight mb-1">
        Bundle Deal
      </h4>
      <p className="text-[10px] font-bold text-zinc-500 leading-relaxed">
        -15% automatiquement à partir de 2 articles dans le panier
      </p>
      <div className="mt-3 bg-primary text-black text-[9px] font-black uppercase px-3 py-2 rounded-xl inline-flex items-center gap-1.5">
        <i className="fa-solid fa-check text-[8px]"></i>
        Actif sur tous les achats
      </div>
    </div>
  </aside>
);

/* ─────────────────── ACTIVE FILTERS BAR ─────────────────── */
const ActiveFilters = ({ category, search, sortBy, count, onReset }) => {
  const hasFilters = category !== 'All' || search;
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-black text-zinc-900">
          <span className="text-primary">{count}</span>
          <span className="text-zinc-400 font-bold ml-1.5 text-xs">produits</span>
          {category !== 'All' && <span className="text-zinc-400 font-bold ml-1.5 text-xs">dans {category}</span>}
        </span>
        {search && (
          <span className="text-[9px] font-black uppercase px-3 py-1.5 rounded-full bg-zinc-800 text-primary border border-zinc-700 flex items-center gap-1.5">
            <i className="fa-solid fa-magnifying-glass text-[8px]"></i>
            {search}
          </span>
        )}
        {hasFilters && (
          <button
            onClick={onReset}
            className="text-[9px] font-black uppercase text-red-400 hover:text-red-600 flex items-center gap-1 border border-red-200 hover:border-red-300 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-xmark"></i> Effacer
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 text-[9px] font-black uppercase text-zinc-400">
        <i className="fa-solid fa-location-dot text-primary text-xs"></i>
        Douala, Cameroun
      </div>
    </div>
  );
};

/* ─────────────────── MAIN STORE PAGE ─────────────────── */
const Store = ({ openModal, addToCart }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorProducts, setVendorProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [vendorsLoading, setVendorsLoading] = useState(true);

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('recent');
  const [maxPrice, setMaxPrice] = useState(500000);
  const [selectedSize, setSelectedSize] = useState('All');
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setVendorsLoading(true);
      try {
        // Products
        const { data: pData } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });
        setProducts(pData || []);

        // Vendors
        const { data: vData } = await supabase
          .from('vendors')
          .select('*')
          .eq('is_active', true);
        setVendors(vData || []);
        setVendorsLoading(false);

        // Map products to vendors
        if (vData && pData) {
          const map = {};
          vData.forEach(v => {
            map[v.id] = pData.filter(p => p.vendor_id === v.id).slice(0, 6);
          });
          setVendorProducts(map);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const priceMax = Math.max(...products.map(p => Number(p.price || 0)), 500000);

  const categoryCounts = useMemo(() => {
    const counts = {};
    products.forEach(p => {
      counts[p.type] = (counts[p.type] || 0) + 1;
    });
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => category === 'All' || p.type === category)
      .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter(p => Number(p.price) <= maxPrice)
      .filter(p => {
        if (selectedSize === 'All') return true;
        return p.type === 'Clothing' || p.type === 'Shoes';
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return Number(a.price) - Number(b.price);
        if (sortBy === 'price-desc') return Number(b.price) - Number(a.price);
        return 0;
      });
  }, [products, category, searchQuery, maxPrice, selectedSize, sortBy]);

  const handleSearch = () => setSearchQuery(searchInput);

  const handleReset = () => {
    setSearchInput('');
    setSearchQuery('');
    setCategory('All');
    setSelectedSize('All');
    setMaxPrice(priceMax);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">

      {/* ── HERO ── */}
      <MarketplaceHero
        totalProducts={products.length}
        searchQuery={searchInput}
        setSearchQuery={setSearchInput}
        onSearch={handleSearch}
      />

      {/* ── PROMO BANNERS ── */}
      <PromoBanners />

      {/* ── VENDORS ── */}
      <VendorsSection vendors={vendors} loading={vendorsLoading} vendorProducts={vendorProducts} />

      {/* ── CATEGORY TABS ── */}
      <CategoryTabs active={category} onChange={setCategory} counts={categoryCounts} />

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8">
        <div className="flex gap-8">

          {/* SIDEBAR */}
          <div className="hidden lg:block">
            <SidebarFilters
              maxPrice={maxPrice}
              setMaxPrice={setMaxPrice}
              priceMax={priceMax}
              sortBy={sortBy}
              setSortBy={setSortBy}
              selectedSize={selectedSize}
              setSelectedSize={setSelectedSize}
              category={category}
            />
          </div>

          {/* PRODUCTS AREA */}
          <div className="flex-1 min-w-0">
            {/* TOOLBAR */}
            <div className="flex items-center justify-between mb-5 gap-4">
              <ActiveFilters
                category={category}
                search={searchQuery}
                sortBy={sortBy}
                count={filteredProducts.length}
                onReset={handleReset}
              />

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* MOBILE SORT */}
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="lg:hidden appearance-none bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase text-zinc-600 outline-none focus:border-primary cursor-pointer"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {/* VIEW TOGGLE */}
                <div className="flex bg-white border border-zinc-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-2.5 transition-all ${viewMode === 'grid' ? 'bg-zinc-700 text-primary' : 'text-zinc-400 hover:text-zinc-700'}`}
                  >
                    <i className="fa-solid fa-grid-2 text-xs"></i>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2.5 transition-all ${viewMode === 'list' ? 'bg-zinc-700 text-primary' : 'text-zinc-400 hover:text-zinc-700'}`}
                  >
                    <i className="fa-solid fa-list text-xs"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* PRODUCTS */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-32 text-center border-2 border-dashed border-zinc-200 rounded-3xl bg-white">
                <i className="fa-solid fa-box-open text-4xl text-zinc-300 mb-4 block"></i>
                <p className="font-black italic uppercase text-zinc-400 text-lg mb-2">Aucun produit trouvé</p>
                <p className="text-zinc-400 text-sm font-bold mb-6">Essayez de modifier vos filtres</p>
                <button
                  onClick={handleReset}
                  className="bg-zinc-700 text-primary px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-3">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="bg-white border border-zinc-100 rounded-2xl p-4 flex items-center gap-4 group hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => openModal(product)}
                  >
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-50">
                      <img src={product.img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{product.status}</span>
                        <span className="text-[8px] font-black uppercase text-zinc-400">{product.type}</span>
                      </div>
                      <h3 className="font-black uppercase italic tracking-tighter text-zinc-900 truncate text-sm group-hover:text-primary transition-colors">{product.name}</h3>
                      {product.features?.length > 0 && (
                        <p className="text-[9px] text-zinc-400 font-bold truncate mt-0.5">{product.features.slice(0,2).join(' · ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-black italic text-primary text-lg leading-none">{Number(product.price).toLocaleString()}</p>
                        <p className="text-[8px] font-bold text-zinc-400">FCFA</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); addToCart({ ...product, selectedSize: 'M', selectedColor: 'Black', quantity: 1 }); }}
                        className="w-10 h-10 bg-zinc-700 text-primary rounded-xl flex items-center justify-center font-black hover:bg-primary hover:text-black transition-all hover:scale-110"
                      >
                        <i className="fa-solid fa-plus text-sm"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    openModal={openModal}
                    addToCart={addToCart}
                  />
                ))}
              </div>
            )}

            {/* PAGINATION PLACEHOLDER */}
            {!loading && filteredProducts.length > 0 && (
              <div className="mt-12 flex items-center justify-center gap-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-400">
                  <i className="fa-solid fa-check-circle text-primary"></i>
                  <span>Tous les {filteredProducts.length} produits affichés</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM CTA STRIP ── */}
      <div className="bg-zinc-800 py-12 px-4 md:px-8 mt-8">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <span className="text-primary font-black text-[9px] uppercase tracking-[0.4em] block mb-2">OneFreestyle Elite</span>
            <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white leading-tight">
              Vends tes produits sur<br/>
              la marketplace <span className="text-primary">#1</span> de Douala
            </h3>
            <p className="text-zinc-500 font-bold text-sm mt-3">
              Dashboard vendeur · Notifications temps réel · Boutique personnalisée
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3">
            <Link
              to="/register"
              className="flex items-center justify-center gap-2 bg-primary text-black px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all hover:scale-105"
            >
              <i className="fa-solid fa-store"></i>
              <span>Ouvrir ma boutique</span>
            </Link>
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 bg-white/10 border border-white/15 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-primary/50 hover:text-primary transition-all"
            >
              <i className="fa-solid fa-right-to-bracket"></i>
              <span>Espace vendeur</span>
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  );
};

export default Store;