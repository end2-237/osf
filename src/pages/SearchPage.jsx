import React, { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "All",         label: "Tout voir",   icon: "fa-grid-2",              color: "#FF9900",  img: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=400" },
  { key: "Audio Lab",   label: "Audio Lab",   icon: "fa-headphones",          color: "#FF9900",  img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400" },
  { key: "Clothing",    label: "Streetwear",  icon: "fa-shirt",               color: "#a855f7",  img: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=400" },
  { key: "Shoes",       label: "Sneakers",    icon: "fa-shoe-prints",         color: "#f97316",  img: "https://images.unsplash.com/photo-1549298916-f52d724204b4?q=80&w=400" },
  { key: "Tech Lab",    label: "Tech Lab",    icon: "fa-microchip",           color: "#3b82f6",  img: "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=400" },
  { key: "Fragrance",   label: "Parfums",     icon: "fa-spray-can-sparkles",  color: "#ec4899",  img: "https://images.unsplash.com/photo-1590156546721-c62b1cff9295?q=80&w=400" },
  { key: "Accessories", label: "Accessoires", icon: "fa-gem",                 color: "#eab308",  img: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?q=80&w=400" },
  { key: "Femme",       label: "Pour Elle",   icon: "fa-person-dress",        color: "#ec4899",  img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=400" },
];

const TRENDING = [
  "Casque bluetooth", "Sneakers Nike", "Parfum homme", "Robe soirée",
  "iPhone accessoires", "Sac à main", "Montre connectée", "Streetwear Douala",
];

const HERO_SLIDES = [
  {
    tag: "Nouveau Drop",
    title: "AUDIO ELITE X1",
    sub: "Son immersif · Livraison 2h Douala 🇨🇲",
    cta: "Découvrir",
    img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1600",
    accent: "#FF9900",
    cat: "Audio Lab",
  },
  {
    tag: "Flash Deal −30%",
    title: "STREET WEAR",
    sub: "Streetwear élite · Paiement Orange Money",
    cta: "Shop Now",
    img: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=1600",
    accent: "#FFD814",
    cat: "Clothing",
  },
  {
    tag: "Bundle Deal",
    title: "TECH LAB 4K",
    sub: "Immersion VR totale · Technologie de pointe",
    cta: "Explorer",
    img: "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=1600",
    accent: "#FF9900",
    cat: "Tech Lab",
  },
  {
    tag: "Collection Femme",
    title: "STYLE SANS LIMITES",
    sub: "Streetwear, parfums & accessoires pour elle",
    cta: "Découvrir",
    img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1600",
    accent: "#FFD814",
    cat: "Femme",
  },
];

const SORT_OPTIONS = [
  { value: "recent",     label: "Plus récents" },
  { value: "price-asc",  label: "Prix croissant" },
  { value: "price-desc", label: "Prix décroissant" },
  { value: "popular",    label: "Populaires" },
];

const PRICE_RANGES = [
  { label: "Moins de 5 000 F",       min: 0,      max: 5000 },
  { label: "5 000 – 15 000 F",       min: 5000,   max: 15000 },
  { label: "15 000 – 50 000 F",      min: 15000,  max: 50000 },
  { label: "50 000 – 150 000 F",     min: 50000,  max: 150000 },
  { label: "Plus de 150 000 F",      min: 150000, max: Infinity },
];

const MEMBER_DISCOUNT = 0.20;

// ─── SKELETONS ────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden animate-pulse">
    <div className="aspect-square bg-[#EAEDED]" />
    <div className="p-3 space-y-2">
      <div className="h-2 bg-[#EAEDED] rounded w-1/3" />
      <div className="h-3 bg-[#EAEDED] rounded w-4/5" />
      <div className="h-4 bg-[#EAEDED] rounded w-1/2" />
      <div className="h-7 bg-[#EAEDED] rounded mt-1" />
    </div>
  </div>
);

// ─── PRODUCT CARD ─────────────────────────────────────────────────────────────
const ProductCard = ({ product, onView, onAddToCart, isMember, flashIndex }) => {
  const [added, setAdded] = useState(false);

  const vendorHasPromo = product.vendor?.member_discount_enabled ?? false;
  const discountActive = isMember && vendorHasPromo;
  const price          = Number(product.price);
  const memberPrice    = discountActive ? Math.round(price * (1 - MEMBER_DISCOUNT)) : price;
  const flashPct       = flashIndex != null ? Math.floor(10 + (flashIndex * 7) % 30) : null;
  const origFlash      = flashPct ? Math.round(price / (1 - flashPct / 100)) : null;

  const handleAdd = (e) => {
    e.stopPropagation();
    onAddToCart({ ...product, selectedSize: "M", selectedColor: "Black", quantity: 1 });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div
      className="bg-white border border-[#D5D9D9] hover:border-[#FF9900]/60 rounded overflow-hidden group cursor-pointer transition-all hover:shadow-md flex flex-col"
      onClick={() => onView(product)}
    >
      <div className="relative bg-[#EAEDED] aspect-square overflow-hidden flex items-center justify-center p-2">
        <img
          src={product.img}
          alt={product.name}
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
        />
        {flashPct && (
          <div className="absolute top-2 left-2 bg-[#B12704] text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase">
            -{flashPct}%
          </div>
        )}
        {discountActive && !flashPct && (
          <div className="absolute top-2 left-2 bg-[#FF9900] text-[#0F1111] text-[8px] font-black px-2 py-0.5 rounded-full">
            −20% membre
          </div>
        )}
        {product.status === "Épuisé" && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-[10px] font-black uppercase text-[#B12704] border border-[#B12704] px-3 py-1 rounded-full">Épuisé</span>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        <p className="text-[9px] font-black uppercase text-[#565959] tracking-widest mb-0.5">{product.type}</p>
        <p className="text-[11px] font-bold text-[#0F1111] leading-tight truncate mb-1.5 group-hover:text-[#C45500] transition-colors">{product.name}</p>

        {/* Stars placeholder */}
        <div className="flex items-center gap-1 mb-1.5">
          {[1,2,3,4,5].map(s => (
            <i key={s} className="fa-solid fa-star text-[#FF9900] text-[8px]"></i>
          ))}
          <span className="text-[9px] text-[#007185] ml-1">(12)</span>
        </div>

        {flashPct ? (
          <div className="mb-2">
            <p className="text-[#B12704] font-black text-base leading-none">{price.toLocaleString()} F</p>
            <p className="text-[9px] text-[#565959] line-through">{origFlash.toLocaleString()} F</p>
          </div>
        ) : discountActive ? (
          <div className="mb-2">
            <p className="text-[#B12704] font-black text-base leading-none">{memberPrice.toLocaleString()} F</p>
            <p className="text-[9px] text-[#565959] line-through">{price.toLocaleString()} F</p>
          </div>
        ) : (
          <p className="text-[#0F1111] font-black text-base leading-none mb-2">{price.toLocaleString()} F</p>
        )}

        <p className="text-[8px] text-[#007185] font-bold mb-2">
          <i className="fa-solid fa-truck-fast mr-1"></i>Livraison 2h · Douala 🇨🇲
        </p>

        <div className="mt-auto">
          <button
            onClick={handleAdd}
            disabled={product.status === "Épuisé"}
            className={`w-full py-2 rounded text-[9px] font-black uppercase tracking-wider border transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed ${
              added
                ? "bg-[#007600] text-white border-[#007600]"
                : "bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border-[#FCD200]"
            }`}
          >
            <i className={`fa-solid ${added ? "fa-check" : "fa-cart-plus"} mr-1.5`}></i>
            {added ? "Ajouté !" : "Au panier"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── CATEGORY CARD ────────────────────────────────────────────────────────────
const CategoryCard = ({ cat, onClick, active }) => (
  <div
    onClick={onClick}
    className={`relative overflow-hidden rounded cursor-pointer group transition-all border-2 ${
      active ? "border-[#FF9900] shadow-md" : "border-transparent hover:border-[#FF9900]/50"
    }`}
  >
    <div className="aspect-[4/3] overflow-hidden bg-[#EAEDED]">
      <img src={cat.img} alt={cat.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0F1111]/80 via-[#0F1111]/20 to-transparent" />
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-3">
      <div className="flex items-center gap-2">
        <i className={`fa-solid ${cat.icon} text-xs`} style={{ color: cat.color }}></i>
        <p className="font-black text-[11px] text-white uppercase tracking-wide truncate">{cat.label}</p>
      </div>
      {active && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-[#FF9900] rounded-full flex items-center justify-center">
          <i className="fa-solid fa-check text-[#0F1111] text-[8px]"></i>
        </div>
      )}
    </div>
  </div>
);

// ─── FILTER SIDEBAR ───────────────────────────────────────────────────────────
const FilterSidebar = ({ activeCategory, setActiveCategory, activePriceRange, setActivePriceRange, vendors, activeVendors, toggleVendor, memberOnly, setMemberOnly, resultCount, onReset }) => (
  <aside className="w-64 flex-shrink-0 space-y-0">

    {/* RÉSULTATS */}
    <div className="bg-white border border-[#D5D9D9] rounded p-4 mb-3">
      <p className="text-[10px] font-black uppercase text-[#565959] tracking-widest mb-1">Résultats</p>
      <p className="text-2xl font-black text-[#0F1111]">{resultCount}</p>
      <p className="text-[9px] text-[#565959]">produits trouvés</p>
      {(activeCategory !== "All" || activePriceRange !== null || activeVendors.size > 0 || memberOnly) && (
        <button
          onClick={onReset}
          className="mt-3 text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500] hover:underline transition-colors"
        >
          <i className="fa-solid fa-rotate-left mr-1.5"></i>Réinitialiser
        </button>
      )}
    </div>

    {/* CATÉGORIES */}
    <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden mb-3">
      <div className="px-4 py-3 bg-[#232F3E]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#FF9900]">Catégorie</p>
      </div>
      <div className="divide-y divide-[#F0F2F2]">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
              activeCategory === cat.key
                ? "bg-[#FFF8D3]"
                : "hover:bg-[#F7F8F8]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <i className={`fa-solid ${cat.icon} text-xs w-4`} style={{ color: activeCategory === cat.key ? "#FF9900" : "#565959" }}></i>
              <span className={`text-[11px] font-bold ${activeCategory === cat.key ? "text-[#C45500] font-black" : "text-[#0F1111]"}`}>
                {cat.label}
              </span>
            </div>
            {activeCategory === cat.key && <i className="fa-solid fa-chevron-right text-[#FF9900] text-[9px]"></i>}
          </button>
        ))}
      </div>
    </div>

    {/* PRIX */}
    <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden mb-3">
      <div className="px-4 py-3 bg-[#232F3E]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#FF9900]">Prix</p>
      </div>
      <div className="divide-y divide-[#F0F2F2]">
        {PRICE_RANGES.map((range, i) => (
          <button
            key={i}
            onClick={() => setActivePriceRange(activePriceRange === i ? null : i)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              activePriceRange === i ? "bg-[#FFF8D3]" : "hover:bg-[#F7F8F8]"
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              activePriceRange === i ? "border-[#FF9900] bg-[#FF9900]" : "border-[#D5D9D9]"
            }`}>
              {activePriceRange === i && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <span className={`text-[11px] ${activePriceRange === i ? "text-[#C45500] font-black" : "font-bold text-[#0F1111]"}`}>
              {range.label}
            </span>
          </button>
        ))}
      </div>
    </div>

    {/* VENDEURS */}
    {vendors.length > 0 && (
      <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden mb-3">
        <div className="px-4 py-3 bg-[#232F3E]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#FF9900]">Boutique</p>
        </div>
        <div className="divide-y divide-[#F0F2F2] max-h-48 overflow-y-auto">
          {vendors.map(v => (
            <button
              key={v.id}
              onClick={() => toggleVendor(v.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                activeVendors.has(v.id) ? "bg-[#FFF8D3]" : "hover:bg-[#F7F8F8]"
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                activeVendors.has(v.id) ? "border-[#FF9900] bg-[#FF9900]" : "border-[#D5D9D9]"
              }`}>
                {activeVendors.has(v.id) && <i className="fa-solid fa-check text-white text-[7px]"></i>}
              </div>
              <span className={`text-[11px] truncate ${activeVendors.has(v.id) ? "text-[#C45500] font-black" : "font-bold text-[#0F1111]"}`}>
                {v.shop_name}
              </span>
            </button>
          ))}
        </div>
      </div>
    )}

    {/* REMISE MEMBRE */}
    <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden mb-3">
      <div className="px-4 py-3 bg-[#232F3E]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#FF9900]">Offres</p>
      </div>
      <button
        onClick={() => setMemberOnly(!memberOnly)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${memberOnly ? "bg-[#FFF8D3]" : "hover:bg-[#F7F8F8]"}`}
      >
        <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
          memberOnly ? "border-[#FF9900] bg-[#FF9900]" : "border-[#D5D9D9]"
        }`}>
          {memberOnly && <i className="fa-solid fa-check text-white text-[7px]"></i>}
        </div>
        <div>
          <p className={`text-[11px] font-bold ${memberOnly ? "text-[#C45500] font-black" : "text-[#0F1111]"}`}>
            Remise membre −20%
          </p>
          <p className="text-[9px] text-[#565959]">Produits éligibles seulement</p>
        </div>
      </button>
    </div>

    {/* OFS TRUST */}
    <div className="bg-[#131921] border border-[#232F3E] rounded p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900] mb-3">
        <i className="fa-solid fa-shield-check mr-1.5"></i>Achat sécurisé
      </p>
      {[
        { icon: "fa-truck-fast",      text: "Livraison 2h à Douala" },
        { icon: "fa-mobile-screen",   text: "Orange Money · MTN MoMo" },
        { icon: "fa-rotate-left",     text: "Retour sous 7 jours" },
        { icon: "fa-headset",         text: "Support WhatsApp 7j/7" },
      ].map(item => (
        <div key={item.text} className="flex items-center gap-2.5 mb-2">
          <i className={`fa-solid ${item.icon} text-[#FF9900] text-[10px] w-3.5 flex-shrink-0`}></i>
          <span className="text-[10px] text-[#ADBAC7] font-medium">{item.text}</span>
        </div>
      ))}
      <div className="mt-3 pt-3 border-t border-[#232F3E] text-center">
        <span className="text-[9px] font-black uppercase tracking-widest text-[#37475A]">
          OneFreestyle · Douala 🇨🇲
        </span>
      </div>
    </div>
  </aside>
);

// ─── SEARCH HERO ──────────────────────────────────────────────────────────────
const SearchHero = ({ onSearch }) => {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const sl = HERO_SLIDES[slide];

  return (
    <div className="relative overflow-hidden bg-[#131921] rounded mb-6" style={{ minHeight: 240 }}>
      {HERO_SLIDES.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${i === slide ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <img src={s.img} alt={s.title} className="absolute inset-0 w-full h-full object-cover opacity-25" />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-[#131921] via-[#131921]/85 to-transparent" />

      <div className="relative z-10 p-6 md:p-10 flex flex-col justify-between" style={{ minHeight: 240 }}>
        <div>
          <span
            className="inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3 border"
            style={{ color: sl.accent, borderColor: sl.accent + "55", background: sl.accent + "22" }}
          >
            <i className="fa-solid fa-bolt text-[7px]"></i>{sl.tag}
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-white leading-none mb-2">{sl.title}</h2>
          <p className="text-sm text-[#ADBAC7] mb-5 max-w-sm">{sl.sub}</p>
          <button
            onClick={() => onSearch(sl.cat)}
            className="inline-flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-5 py-2.5 rounded border border-[#FCD200] font-black text-[10px] uppercase tracking-widest transition-all active:scale-[0.97]"
          >
            {sl.cta} <i className="fa-solid fa-arrow-right text-[9px]"></i>
          </button>
        </div>
        <div className="flex items-center gap-2.5 mt-5 flex-wrap">
          <span className="text-[9px] text-[#565959]">OneFreestyle 🇨🇲</span>
          <span className="w-1 h-1 rounded-full bg-[#37475A]" />
          <span className="text-[9px] text-[#565959]">Livraison 2h · Douala</span>
          <span className="w-1 h-1 rounded-full bg-[#37475A]" />
          <span className="text-[9px] font-bold" style={{ color: sl.accent }}>Orange Money · MTN MoMo</span>
        </div>
      </div>

      {/* Slide dots */}
      <div className="absolute bottom-5 right-6 flex items-center gap-2 z-20">
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setSlide(i)}
            className="rounded-full transition-all"
            style={{ width: i === slide ? 20 : 6, height: 6, background: i === slide ? sl.accent : "#37475A" }}
          />
        ))}
      </div>
    </div>
  );
};

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
const NoResults = ({ query, onClear }) => (
  <div className="py-16 text-center">
    <div className="w-20 h-20 bg-[#EAEDED] border border-[#D5D9D9] rounded-full flex items-center justify-center mx-auto mb-6">
      <i className="fa-solid fa-magnifying-glass text-[#D5D9D9] text-3xl"></i>
    </div>
    <h2 className="text-xl font-black text-[#0F1111] mb-2">
      Aucun résultat pour <span className="text-[#B12704]">"{query}"</span>
    </h2>
    <p className="text-[#565959] text-sm mb-6 max-w-sm mx-auto">
      Essayez d'autres mots-clés ou parcourez les catégories.
    </p>
    <div className="flex flex-wrap gap-2 justify-center mb-8">
      {TRENDING.slice(0, 4).map(t => (
        <button key={t} onClick={() => onClear(t)}
          className="px-4 py-2 bg-white border border-[#D5D9D9] rounded text-[10px] font-bold text-[#007185] hover:border-[#FF9900] hover:text-[#C45500] transition-all"
        >
          {t}
        </button>
      ))}
    </div>
    <Link to="/store"
      className="inline-flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-6 py-3 rounded border border-[#FCD200] font-black text-[10px] uppercase tracking-widest transition-colors"
    >
      <i className="fa-solid fa-bag-shopping mr-1"></i>
      Explorer tous les produits
    </Link>
  </div>
);

// ═══════════════════════════════
//   MAIN PAGE
// ═══════════════════════════════
const SearchPage = ({ openModal, addToCart }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isMember } = useAuth();

  const [query,          setQuery]          = useState(searchParams.get("q") || "");
  const [products,       setProducts]       = useState([]);
  const [vendors,        setVendors]        = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activePriceRange, setActivePriceRange] = useState(null);
  const [activeVendors,  setActiveVendors]  = useState(new Set());
  const [memberOnly,     setMemberOnly]     = useState(false);
  const [sortBy,         setSortBy]         = useState("recent");
  const [flashDeals,     setFlashDeals]     = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // ── FETCH PRODUCTS ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("products")
      .select("*, vendor:vendors!vendor_id(id, shop_name, member_discount_enabled)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setProducts(data || []);
        setFlashDeals((data || []).slice(0, 8));
        const seen = new Set();
        const uniqueVendors = [];
        (data || []).forEach(p => {
          if (p.vendor && !seen.has(p.vendor.id)) {
            seen.add(p.vendor.id);
            uniqueVendors.push(p.vendor);
          }
        });
        setVendors(uniqueVendors);
      });
  }, []);

  // ── SYNC query depuis URL ─────────────────────────────────────────────────
  useEffect(() => {
    setQuery(searchParams.get("q") || "");
    setActiveCategory("All");
    setActivePriceRange(null);
    setActiveVendors(new Set());
  }, [searchParams]);

  const submitSearch = (q) => {
    const trimmed = String(q ?? "").trim();
    if (!trimmed) return;
    setSearchParams({ q: trimmed });
  };

  const toggleVendor = (id) => {
    setActiveVendors(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const resetFilters = () => {
    setActiveCategory("All");
    setActivePriceRange(null);
    setActiveVendors(new Set());
    setMemberOnly(false);
  };

  // ── FILTERED + SORTED RESULTS ─────────────────────────────────────────────
  const results = useMemo(() => {
    let list = products;

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.type?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    if (activeCategory !== "All") list = list.filter(p => p.type === activeCategory);
    if (activePriceRange !== null) {
      const range = PRICE_RANGES[activePriceRange];
      list = list.filter(p => {
        const price = Number(p.price);
        return price >= range.min && price <= range.max;
      });
    }
    if (activeVendors.size > 0) list = list.filter(p => activeVendors.has(p.vendor?.id));
    if (memberOnly) list = list.filter(p => p.vendor?.member_discount_enabled);

    return [...list].sort((a, b) => {
      if (sortBy === "price-asc")  return Number(a.price) - Number(b.price);
      if (sortBy === "price-desc") return Number(b.price) - Number(a.price);
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [products, query, activeCategory, activePriceRange, activeVendors, memberOnly, sortBy]);

  const isSearching  = !!query.trim();
  const hasFilters   = activeCategory !== "All" || activePriceRange !== null || activeVendors.size > 0 || memberOnly;
  const activeFiltersCount = (activeCategory !== "All" ? 1 : 0) + (activePriceRange !== null ? 1 : 0) + activeVendors.size + (memberOnly ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#EAEDED]">

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-5">

        {/* ═══ NO QUERY: LANDING STATE ═══ */}
        {!isSearching && (
          <>
            {/* ── HERO BANNER ── */}
            <SearchHero onSearch={submitSearch} />

            {/* ── TRENDING ── */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto hide-scrollbar">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#565959] whitespace-nowrap">Tendances :</span>
              {TRENDING.map(t => (
                <button key={t} onClick={() => submitSearch(t)}
                  className="px-3 py-1.5 bg-white border border-[#D5D9D9] hover:border-[#FF9900] hover:text-[#C45500] rounded-full text-[10px] font-bold text-[#0F1111] whitespace-nowrap transition-all flex-shrink-0"
                >
                  <i className="fa-solid fa-magnifying-glass text-[#adb5bd] mr-1.5 text-[9px]"></i>{t}
                </button>
              ))}
            </div>

            {/* ── CATÉGORIES GRID ── */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-black text-[#0F1111]">
                    Rechercher par <span className="text-[#FF9900]">Catégorie</span>
                  </h2>
                  <p className="text-[11px] text-[#565959]">Explorez nos univers produits</p>
                </div>
                <Link to="/store" className="text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500] hover:underline flex items-center gap-1.5">
                  Tout voir <i className="fa-solid fa-arrow-right text-[9px]"></i>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {CATEGORIES.map(cat => (
                  <CategoryCard
                    key={cat.key}
                    cat={cat}
                    active={false}
                    onClick={() => { setActiveCategory(cat.key); submitSearch(cat.label); }}
                  />
                ))}
              </div>
            </div>

            {/* ── FLASH DEALS STRIP ── */}
            <div className="mb-8">
              <div className="bg-[#131921] rounded p-4 md:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#B12704] rounded flex items-center justify-center">
                      <i className="fa-solid fa-bolt text-white text-sm"></i>
                    </div>
                    <div>
                      <h3 className="font-black text-white text-lg leading-none">
                        Flash <span className="text-[#B12704]">Deals</span>
                      </h3>
                      <p className="text-[9px] text-[#ADBAC7] font-bold">Offres à durée limitée</p>
                    </div>
                  </div>
                  <Link to="/store"
                    className="text-[10px] font-black uppercase text-[#007185] hover:text-[#FF9900] flex items-center gap-1.5 transition-colors"
                  >
                    Voir tout <i className="fa-solid fa-arrow-right text-[9px]"></i>
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  {(flashDeals.length === 0 ? Array.from({ length: 8 }) : flashDeals).map((p, i) => {
                    if (!p) return (
                      <div key={i} className="bg-[#232F3E] rounded animate-pulse aspect-square" />
                    );
                    const pct = Math.floor(10 + (i * 7) % 30);
                    const orig = Math.round(Number(p.price) / (1 - pct / 100));
                    return (
                      <div
                        key={p.id}
                        onClick={() => openModal(p)}
                        className="bg-white border border-[#232F3E] hover:border-[#FF9900]/60 rounded overflow-hidden group cursor-pointer transition-all hover:shadow-md"
                      >
                        <div className="relative bg-[#EAEDED] aspect-square flex items-center justify-center p-1.5 overflow-hidden">
                          <img src={p.img} alt={p.name} className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" />
                          <div className="absolute top-1.5 left-1.5 bg-[#B12704] text-white text-[7px] font-black px-1.5 py-0.5 rounded-full">
                            -{pct}%
                          </div>
                        </div>
                        <div className="p-2">
                          <p className="text-[9px] font-bold text-[#565959] truncate">{p.name}</p>
                          <p className="text-[#B12704] font-black text-xs leading-none">{Number(p.price).toLocaleString()} F</p>
                          <p className="text-[8px] text-[#565959] line-through">{orig.toLocaleString()} F</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── PROMO BANNERS ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                { tag: "Flash Deal", title: "Audio Lab", sub: "-25% sur tous les casques", icon: "fa-headphones", accent: "#FF9900", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400" },
                { tag: "New Drop",   title: "Sneakers",  sub: "Éditions limitées arrivées", icon: "fa-shoe-prints", accent: "#FFD814", img: "https://images.unsplash.com/photo-1549298916-f52d724204b4?q=80&w=400" },
                { tag: "Bundle",     title: "Tech Lab",  sub: "2 articles = −15% offerts",  icon: "fa-microchip",  accent: "#FF9900", img: "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=400" },
              ].map(b => (
                <div key={b.title}
                  onClick={() => { setActiveCategory(b.title); submitSearch(b.title); }}
                  className="relative overflow-hidden bg-[#131921] border border-[#232F3E] rounded p-5 flex items-center gap-4 cursor-pointer hover:border-[#FF9900]/50 transition-all group"
                >
                  <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                    <img src={b.img} alt={b.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border mb-1.5 inline-block"
                      style={{ color: b.accent, borderColor: b.accent + "44", background: b.accent + "18" }}>
                      <i className={`fa-solid ${b.icon} mr-1 text-[7px]`}></i>{b.tag}
                    </span>
                    <p className="font-black text-white text-sm">{b.title}</p>
                    <p className="text-[10px] text-[#ADBAC7]">{b.sub}</p>
                  </div>
                  <i className="fa-solid fa-arrow-right text-[#37475A] group-hover:text-[#FF9900] text-sm ml-auto transition-colors"></i>
                </div>
              ))}
            </div>

            {/* ── TOUS LES PRODUITS (preview) ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-[#0F1111]">
                  Populaires <span className="text-[#FF9900]">en ce moment</span>
                </h2>
                <Link to="/store" className="text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500] hover:underline flex items-center gap-1.5">
                  Voir tout le store <i className="fa-solid fa-arrow-right text-[9px]"></i>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {(products.length === 0 ? Array.from({ length: 12 }) : products.slice(0, 12)).map((p, i) =>
                  !p
                    ? <SkeletonCard key={i} />
                    : <ProductCard key={p.id} product={p} onView={openModal} onAddToCart={addToCart} isMember={isMember} />
                )}
              </div>
            </div>
          </>
        )}

        {/* ═══ QUERY STATE: RESULTS ═══ */}
        {isSearching && (
          <>
            {/* RESULTS HEADER */}
            <div className="bg-white border border-[#D5D9D9] rounded p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[11px] text-[#565959] mb-0.5">
                  {results.length > 0 ? (
                    <><span className="font-black text-[#0F1111] text-base">{results.length}</span> résultat{results.length > 1 ? "s" : ""} pour{" "}
                    <span className="text-[#C45500] font-bold">"{query}"</span></>
                  ) : (
                    <>Aucun résultat pour <span className="text-[#B12704] font-bold">"{query}"</span></>
                  )}
                </p>
                {hasFilters && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {activeCategory !== "All" && (
                      <span className="inline-flex items-center gap-1 bg-[#FFF8D3] border border-[#FCD200] text-[#0F1111] text-[9px] font-bold px-2 py-0.5 rounded-full">
                        {activeCategory}
                        <button onClick={() => setActiveCategory("All")} className="ml-0.5 hover:text-[#B12704]"><i className="fa-solid fa-xmark text-[8px]"></i></button>
                      </span>
                    )}
                    {activePriceRange !== null && (
                      <span className="inline-flex items-center gap-1 bg-[#FFF8D3] border border-[#FCD200] text-[#0F1111] text-[9px] font-bold px-2 py-0.5 rounded-full">
                        {PRICE_RANGES[activePriceRange].label}
                        <button onClick={() => setActivePriceRange(null)} className="ml-0.5 hover:text-[#B12704]"><i className="fa-solid fa-xmark text-[8px]"></i></button>
                      </span>
                    )}
                    {memberOnly && (
                      <span className="inline-flex items-center gap-1 bg-[#FFF8D3] border border-[#FCD200] text-[#0F1111] text-[9px] font-bold px-2 py-0.5 rounded-full">
                        Remise membre
                        <button onClick={() => setMemberOnly(false)} className="ml-0.5 hover:text-[#B12704]"><i className="fa-solid fa-xmark text-[8px]"></i></button>
                      </span>
                    )}
                    <button onClick={resetFilters} className="text-[9px] font-black text-[#007185] hover:text-[#C45500] hover:underline">
                      Tout effacer
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* MOBILE FILTERS BUTTON */}
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 bg-[#232F3E] text-white rounded text-[10px] font-black uppercase border border-[#37475A] relative"
                >
                  <i className="fa-solid fa-sliders text-xs"></i>
                  Filtres
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#FF9900] rounded-full text-[#0F1111] text-[8px] font-black flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                {/* SORT */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="appearance-none bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded px-4 py-2.5 pr-8 text-[10px] font-bold text-[#565959] cursor-pointer"
                  >
                    <option value="" disabled>Trier par</option>
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[#adb5bd] text-[9px] pointer-events-none"></i>
                </div>
              </div>
            </div>

            {/* CONTENT: SIDEBAR + GRID */}
            <div className="flex gap-5">

              {/* SIDEBAR (desktop) */}
              <div className="hidden lg:block">
                <FilterSidebar
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                  activePriceRange={activePriceRange}
                  setActivePriceRange={setActivePriceRange}
                  vendors={vendors}
                  activeVendors={activeVendors}
                  toggleVendor={toggleVendor}
                  memberOnly={memberOnly}
                  setMemberOnly={setMemberOnly}
                  resultCount={results.length}
                  onReset={resetFilters}
                />
              </div>

              {/* RESULTS GRID */}
              <div className="flex-1 min-w-0">
                {results.length === 0 ? (
                  <NoResults query={query} onClear={submitSearch} />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {results.map((p, i) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        onView={openModal}
                        onAddToCart={addToCart}
                        isMember={isMember}
                        flashIndex={i < 6 ? i : null}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ MOBILE FILTER DRAWER ═══ */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-[600] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-[#EAEDED] overflow-y-auto">
            <div className="bg-[#131921] px-4 py-3 flex items-center justify-between sticky top-0">
              <p className="font-black text-white text-sm">Filtres</p>
              <button onClick={() => setShowMobileFilters(false)}
                className="w-8 h-8 bg-[#232F3E] rounded flex items-center justify-center">
                <i className="fa-solid fa-xmark text-white text-sm"></i>
              </button>
            </div>
            <div className="p-4">
              <FilterSidebar
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                activePriceRange={activePriceRange}
                setActivePriceRange={setActivePriceRange}
                vendors={vendors}
                activeVendors={activeVendors}
                toggleVendor={toggleVendor}
                memberOnly={memberOnly}
                setMemberOnly={setMemberOnly}
                resultCount={results.length}
                onReset={resetFilters}
              />
            </div>
            <div className="sticky bottom-0 bg-white border-t border-[#D5D9D9] p-4">
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-full bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] py-3 rounded border border-[#FCD200] font-black text-[10px] uppercase tracking-widest"
              >
                Voir {results.length} résultat{results.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default SearchPage;
