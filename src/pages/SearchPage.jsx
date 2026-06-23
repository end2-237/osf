import React, { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { translateText } from "../lib/translate";

const CATEGORIES = [
  { key: "All",         label: "Tout voir",   icon: "fa-table-cells",         color: "#FF9900" },
  { key: "Audio Lab",   label: "Audio",       icon: "fa-headphones",          color: "#FF9900" },
  { key: "Clothing",    label: "Streetwear",  icon: "fa-shirt",               color: "#a855f7" },
  { key: "Shoes",       label: "Sneakers",    icon: "fa-shoe-prints",         color: "#f97316" },
  { key: "Tech Lab",    label: "Tech",        icon: "fa-microchip",           color: "#3b82f6" },
  { key: "Fragrance",   label: "Parfums",     icon: "fa-spray-can-sparkles",  color: "#ec4899" },
  { key: "Accessories", label: "Accessoires", icon: "fa-gem",                 color: "#eab308" },
  { key: "Femme",       label: "Pour Elle",   icon: "fa-person-dress",        color: "#ec4899" },
];

const TRENDING = [
  "Casque bluetooth", "Sneakers Nike", "Parfum homme", "Robe soirée",
  "iPhone accessoires", "Sac à main", "Montre connectée", "Streetwear Douala",
];

const TOP_BRANDS = [
  { name: "Samsung",   icon: "fa-mobile-screen" },
  { name: "Apple",     icon: "fa-apple", brand: true },
  { name: "Nike",      icon: "fa-shoe-prints" },
  { name: "Sony",      icon: "fa-headphones" },
  { name: "Dior",      icon: "fa-spray-can-sparkles" },
  { name: "Adidas",    icon: "fa-shirt" },
];

const FEATURE_BANNERS = [
  {
    tag: "Nouveau Drop",
    title: "Audio Elite X1",
    sub: "Son immersif. Livraison express Douala.",
    cta: "Découvrir",
    cat: "Audio Lab",
    img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=900",
  },
  {
    tag: "Flash −30%",
    title: "Streetwear Élite",
    sub: "Collections limitées arrivées.",
    cta: "Shop Now",
    cat: "Clothing",
    img: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=900",
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

const SkeletonCard = () => (
  <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden animate-pulse">
    <div className="aspect-square bg-[#EAEDED]" />
    <div className="p-2.5 space-y-2">
      <div className="h-2 bg-[#EAEDED] rounded w-1/3" />
      <div className="h-3 bg-[#EAEDED] rounded w-4/5" />
      <div className="h-4 bg-[#EAEDED] rounded w-1/2" />
    </div>
  </div>
);

const ProductCard = ({ product, onView, onAddToCart, isMember, flashIndex }) => {
  const [added, setAdded] = useState(false);
  const isCj = !product.vendor_id;

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
          <div className="absolute top-2 left-2 bg-[#B12704] text-white text-[8px] font-black px-2 py-0.5 uppercase">
            -{flashPct}%
          </div>
        )}
        {discountActive && !flashPct && (
          <div className="absolute top-2 left-2 bg-[#FF9900] text-[#0F1111] text-[8px] font-black px-2 py-0.5">
            −20% membre
          </div>
        )}
        {product.status === "Épuisé" && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-[10px] font-black uppercase text-[#B12704] border border-[#B12704] px-3 py-1">Épuisé</span>
          </div>
        )}
        <button
          onClick={handleAdd}
          disabled={product.status === "Épuisé"}
          className={`absolute bottom-2 right-2 w-8 h-8 rounded flex items-center justify-center transition-all md:opacity-0 md:translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 active:scale-90 disabled:opacity-30 ${
            added ? "bg-[#007600] text-white" : "bg-white border border-[#D5D9D9] text-[#0F1111] hover:bg-[#FFD814] hover:border-[#FCD200]"
          }`}
        >
          <i className={`fa-solid ${added ? "fa-check" : "fa-plus"} text-xs`}></i>
        </button>
      </div>

      <div className="p-2.5 flex flex-col flex-1">
        <p className="text-[9px] font-black uppercase text-[#565959] tracking-widest mb-0.5">{product.type}</p>
        <p className="text-[11px] font-bold text-[#0F1111] leading-tight truncate mb-1 group-hover:text-[#C45500] transition-colors">{product.name}</p>

        <div className="flex items-center gap-0.5 mb-1.5">
          {[1,2,3,4,5].map(s => (
            <i key={s} className="fa-solid fa-star text-[#FF9900] text-[8px]"></i>
          ))}
          <span className="text-[9px] text-[#007185] ml-1">(12)</span>
        </div>

        <div className="mt-auto">
          {flashPct ? (
            <div className="mb-1.5">
              <p className="text-[#B12704] font-black text-base leading-none">{price.toLocaleString()} F</p>
              <p className="text-[9px] text-[#565959] line-through">{origFlash.toLocaleString()} F</p>
            </div>
          ) : discountActive ? (
            <div className="mb-1.5">
              <p className="text-[#B12704] font-black text-base leading-none">{memberPrice.toLocaleString()} F</p>
              <p className="text-[9px] text-[#565959] line-through">{price.toLocaleString()} F</p>
            </div>
          ) : (
            <p className="text-[#0F1111] font-black text-base leading-none mb-1.5">{price.toLocaleString()} F</p>
          )}

          {!isCj && (
            <p className="text-[8px] text-[#007185] font-bold">
              <i className="fa-solid fa-truck-fast mr-1"></i>Livraison 2h · Douala
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const CategoryPill = ({ cat, onClick, active }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1.5 group flex-shrink-0"
  >
    <div className={`w-14 h-14 md:w-16 md:h-16 rounded flex items-center justify-center transition-all ${
      active
        ? "bg-[#FF9900] border-2 border-[#FF9900]"
        : "bg-white border border-[#D5D9D9] group-hover:border-[#FF9900]/50"
    }`}>
      <i className={`fa-solid ${cat.icon} text-lg md:text-xl`} style={{ color: active ? "#fff" : cat.color }}></i>
    </div>
    <span className={`text-[10px] font-bold ${active ? "text-[#C45500]" : "text-[#0F1111]"}`}>
      {cat.label}
    </span>
  </button>
);

const FilterSidebar = ({ activeCategory, setActiveCategory, activePriceRange, setActivePriceRange, vendors, activeVendors, toggleVendor, memberOnly, setMemberOnly, resultCount, onReset }) => {
  const hasFilters = activeCategory !== "All" || activePriceRange !== null || activeVendors.size > 0 || memberOnly;
  return (
    <aside className="w-60 flex-shrink-0 space-y-0">

      <div className="bg-white border border-[#D5D9D9] rounded p-3 mb-2">
        <div className="flex items-center justify-between">
          <p className="font-black text-[#0F1111] text-sm">Filtres</p>
          {hasFilters && (
            <button onClick={onReset} className="text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500] hover:underline">
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden mb-2">
        <div className="px-3 py-2 bg-[#F0F2F2] border-b border-[#D5D9D9]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#565959]">Catégorie</p>
        </div>
        <div className="divide-y divide-[#F0F2F2]">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                activeCategory === cat.key ? "bg-[#FFF8D3]" : "hover:bg-[#F7F8F8]"
              }`}
            >
              <i className={`fa-solid ${cat.icon} text-xs w-4`} style={{ color: activeCategory === cat.key ? "#FF9900" : "#565959" }}></i>
              <span className={`text-[11px] font-bold ${activeCategory === cat.key ? "text-[#C45500] font-black" : "text-[#0F1111]"}`}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden mb-2">
        <div className="px-3 py-2 bg-[#F0F2F2] border-b border-[#D5D9D9]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#565959]">Prix</p>
        </div>
        <div className="divide-y divide-[#F0F2F2]">
          {PRICE_RANGES.map((range, i) => (
            <button
              key={i}
              onClick={() => setActivePriceRange(activePriceRange === i ? null : i)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
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

      {vendors.length > 0 && (
        <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden mb-2">
          <div className="px-3 py-2 bg-[#F0F2F2] border-b border-[#D5D9D9]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#565959]">Boutique</p>
          </div>
          <div className="divide-y divide-[#F0F2F2] max-h-44 overflow-y-auto">
            {vendors.map(v => (
              <button
                key={v.id}
                onClick={() => toggleVendor(v.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
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

      <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden mb-2">
        <div className="px-3 py-2 bg-[#F0F2F2] border-b border-[#D5D9D9]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#565959]">Offres</p>
        </div>
        <button
          onClick={() => setMemberOnly(!memberOnly)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${memberOnly ? "bg-[#FFF8D3]" : "hover:bg-[#F7F8F8]"}`}
        >
          <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
            memberOnly ? "border-[#FF9900] bg-[#FF9900]" : "border-[#D5D9D9]"
          }`}>
            {memberOnly && <i className="fa-solid fa-check text-white text-[7px]"></i>}
          </div>
          <div>
            <p className={`text-[11px] font-bold ${memberOnly ? "text-[#C45500] font-black" : "text-[#0F1111]"}`}>Remise membre −20%</p>
            <p className="text-[9px] text-[#565959]">Produits éligibles</p>
          </div>
        </button>
      </div>

      <div className="bg-white border border-[#D5D9D9] rounded p-3">
        {[
          { icon: "fa-truck-fast",    text: "Livraison 2h à Douala" },
          { icon: "fa-mobile-screen", text: "Orange Money · MTN MoMo" },
          { icon: "fa-rotate-left",   text: "Retour sous 7 jours" },
          { icon: "fa-headset",       text: "Support WhatsApp 7j/7" },
        ].map(item => (
          <div key={item.text} className="flex items-center gap-2 mb-1.5 last:mb-0">
            <i className={`fa-solid ${item.icon} text-[#FF9900] text-[10px] w-3.5 flex-shrink-0`}></i>
            <span className="text-[10px] text-[#565959] font-medium">{item.text}</span>
          </div>
        ))}
      </div>
    </aside>
  );
};

const NoResults = ({ query, onClear }) => (
  <div className="py-12 text-center">
    <div className="w-16 h-16 bg-[#EAEDED] border border-[#D5D9D9] rounded flex items-center justify-center mx-auto mb-4">
      <i className="fa-solid fa-magnifying-glass text-[#D5D9D9] text-2xl"></i>
    </div>
    <h2 className="text-lg font-black text-[#0F1111] mb-1">
      Aucun résultat pour <span className="text-[#B12704]">"{query}"</span>
    </h2>
    <p className="text-[#565959] text-sm mb-4 max-w-sm mx-auto">
      Essayez d'autres mots-clés ou parcourez les catégories.
    </p>
    <div className="flex flex-wrap gap-2 justify-center mb-6">
      {TRENDING.slice(0, 4).map(t => (
        <button key={t} onClick={() => onClear(t)}
          className="px-3 py-1.5 bg-white border border-[#D5D9D9] rounded text-[10px] font-bold text-[#007185] hover:border-[#FF9900] hover:text-[#C45500] transition-all"
        >
          {t}
        </button>
      ))}
    </div>
    <Link to="/store"
      className="inline-flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-5 py-2.5 rounded border border-[#FCD200] font-black text-[10px] uppercase tracking-widest transition-colors"
    >
      <i className="fa-solid fa-bag-shopping"></i>
      Explorer tous les produits
    </Link>
  </div>
);

const SearchPage = ({ openModal, addToCart }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isMember } = useAuth();

  const { lang }                            = useLang();
  const [query,          setQuery]          = useState(searchParams.get("q") || "");
  const [searchQuery,    setSearchQuery]    = useState(searchParams.get("q") || "");
  const [products,       setProducts]       = useState([]);
  const [vendors,        setVendors]        = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activePriceRange, setActivePriceRange] = useState(null);
  const [activeVendors,  setActiveVendors]  = useState(new Set());
  const [memberOnly,     setMemberOnly]     = useState(false);
  const [sortBy,         setSortBy]         = useState("recent");
  const [flashDeals,     setFlashDeals]     = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("products")
      .select("*, vendor:vendors!vendor_id(id, shop_name, member_discount_enabled)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setProducts(data || []);
        setFlashDeals((data || []).slice(0, 6));
        const seen = new Set();
        const uniqueVendors = [];
        (data || []).forEach(p => {
          if (p.vendor && !seen.has(p.vendor.id)) {
            seen.add(p.vendor.id);
            uniqueVendors.push(p.vendor);
          }
        });
        setVendors(uniqueVendors);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
    setActiveCategory(searchParams.get("cat") || "All");
    setActivePriceRange(null);
    setActiveVendors(new Set());
  }, [searchParams]);

  useEffect(() => {
    const raw = query.trim();
    if (!raw || lang !== "fr") { setSearchQuery(raw); return; }
    translateText(raw, "fr", "en").then(t => setSearchQuery(t));
  }, [query, lang]);

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

  const results = useMemo(() => {
    let list = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
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
        const pr = Number(p.price);
        return pr >= range.min && pr <= range.max;
      });
    }
    if (activeVendors.size > 0) list = list.filter(p => activeVendors.has(p.vendor?.id));
    if (memberOnly) list = list.filter(p => p.vendor?.member_discount_enabled);
    return [...list].sort((a, b) => {
      if (sortBy === "price-asc")  return Number(a.price) - Number(b.price);
      if (sortBy === "price-desc") return Number(b.price) - Number(a.price);
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [products, searchQuery, activeCategory, activePriceRange, activeVendors, memberOnly, sortBy]);

  const isSearching  = !!query.trim() || !!searchParams.get("cat");
  const hasFilters   = activeCategory !== "All" || activePriceRange !== null || activeVendors.size > 0 || memberOnly;
  const activeFiltersCount = (activeCategory !== "All" ? 1 : 0) + (activePriceRange !== null ? 1 : 0) + activeVendors.size + (memberOnly ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      <div className="max-w-[1500px] mx-auto px-2 md:px-3 py-2">

        {!isSearching && (
          <>
            {/* TOP BRANDS */}
            <div className="bg-white border border-[#D5D9D9] rounded p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-black text-[#0F1111]">Top Marques</p>
                <Link to="/store" className="text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500] hover:underline">Voir tout</Link>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                {TOP_BRANDS.map(b => (
                  <button
                    key={b.name}
                    onClick={() => submitSearch(b.name)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-[#D5D9D9] hover:border-[#FF9900] rounded text-[11px] font-bold text-[#0F1111] whitespace-nowrap transition-all flex-shrink-0"
                  >
                    <i className={`${b.brand ? "fa-brands" : "fa-solid"} ${b.icon} text-[#565959] text-sm`}></i>
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* CATEGORIES */}
            <div className="bg-white border border-[#D5D9D9] rounded p-3 mb-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-black text-[#0F1111]">Parcourir par catégorie</p>
                  <p className="text-[10px] text-[#565959]">Explorez nos univers produits</p>
                </div>
                <Link to="/store" className="text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500] hover:underline flex items-center gap-1">
                  Tout voir <i className="fa-solid fa-arrow-right text-[8px]"></i>
                </Link>
              </div>
              <div className="flex items-start gap-3 md:gap-4 overflow-x-auto hide-scrollbar pb-1">
                {CATEGORIES.filter(c => c.key !== "All").map(cat => (
                  <CategoryPill
                    key={cat.key}
                    cat={cat}
                    active={false}
                    onClick={() => { setActiveCategory(cat.key); submitSearch(cat.label); }}
                  />
                ))}
              </div>
            </div>

            {/* FEATURE BANNERS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              {FEATURE_BANNERS.map(b => (
                <div
                  key={b.title}
                  onClick={() => { setActiveCategory(b.cat); submitSearch(b.cat); }}
                  className="relative overflow-hidden bg-[#131921] border border-[#232F3E] rounded flex items-center cursor-pointer group"
                  style={{ minHeight: 140 }}
                >
                  <div className="relative z-10 p-4 md:p-5 flex-1">
                    <span className="inline-block text-[8px] font-black uppercase tracking-widest text-[#FF9900] bg-[#FF9900]/15 px-2 py-0.5 border border-[#FF9900]/30 mb-2">
                      {b.tag}
                    </span>
                    <h3 className="text-lg md:text-xl font-black text-white mb-1">{b.title}</h3>
                    <p className="text-[11px] text-[#ADBAC7] mb-3 max-w-[180px]">{b.sub}</p>
                    <span className="inline-flex items-center gap-1.5 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest transition-colors">
                      {b.cta} <i className="fa-solid fa-arrow-right text-[8px]"></i>
                    </span>
                  </div>
                  <div className="relative z-0 w-32 md:w-40 h-full flex-shrink-0 self-stretch">
                    <img src={b.img} alt={b.title} className="w-full h-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#131921] to-transparent" />
                  </div>
                </div>
              ))}
            </div>

            {/* FLASH DEALS */}
            <div className="bg-white border border-[#D5D9D9] rounded p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-[#B12704] rounded flex items-center justify-center">
                    <i className="fa-solid fa-bolt text-white text-xs"></i>
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#0F1111] leading-none">Flash Deals</p>
                    <p className="text-[9px] text-[#565959]">Offres à durée limitée</p>
                  </div>
                </div>
                <Link to="/store" className="text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500] hover:underline flex items-center gap-1">
                  Voir tout <i className="fa-solid fa-arrow-right text-[8px]"></i>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {(flashDeals.length === 0 ? Array.from({ length: 6 }) : flashDeals).map((p, i) =>
                  !p
                    ? <SkeletonCard key={i} />
                    : <ProductCard key={p.id} product={p} onView={openModal} onAddToCart={addToCart} isMember={isMember} flashIndex={i} />
                )}
              </div>
            </div>

            {/* POPULAIRES */}
            <div className="bg-white border border-[#D5D9D9] rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-black text-[#0F1111]">Populaires en ce moment</p>
                <Link to="/store" className="text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500] hover:underline flex items-center gap-1">
                  Voir le store <i className="fa-solid fa-arrow-right text-[8px]"></i>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {(products.length === 0 ? Array.from({ length: 12 }) : products.slice(0, 12)).map((p, i) =>
                  !p
                    ? <SkeletonCard key={i} />
                    : <ProductCard key={p.id} product={p} onView={openModal} onAddToCart={addToCart} isMember={isMember} />
                )}
              </div>
            </div>
          </>
        )}

        {isSearching && (
          <>
            {/* RESULTS HEADER */}
            <div className="bg-white border border-[#D5D9D9] rounded p-3 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-sm font-black text-[#0F1111]">
                  {query.trim() ? (
                    <>Résultats pour <span className="text-[#C45500]">"{query}"</span></>
                  ) : activeCategory !== "All" ? (
                    CATEGORIES.find(c => c.key === activeCategory)?.label || activeCategory
                  ) : "Tous les produits"}
                </p>
                <p className="text-[10px] text-[#565959]">
                  {loading ? "Chargement…" : `${results.length} produit${results.length !== 1 ? "s" : ""} trouvé${results.length !== 1 ? "s" : ""}`}
                </p>
                {hasFilters && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    {activeCategory !== "All" && (
                      <span className="inline-flex items-center gap-1 bg-[#FFF8D3] border border-[#FCD200] text-[#0F1111] text-[9px] font-bold px-2 py-0.5">
                        {CATEGORIES.find(c => c.key === activeCategory)?.label || activeCategory}
                        <button onClick={() => setActiveCategory("All")} className="ml-0.5 hover:text-[#B12704]"><i className="fa-solid fa-xmark text-[8px]"></i></button>
                      </span>
                    )}
                    {activePriceRange !== null && (
                      <span className="inline-flex items-center gap-1 bg-[#FFF8D3] border border-[#FCD200] text-[#0F1111] text-[9px] font-bold px-2 py-0.5">
                        {PRICE_RANGES[activePriceRange].label}
                        <button onClick={() => setActivePriceRange(null)} className="ml-0.5 hover:text-[#B12704]"><i className="fa-solid fa-xmark text-[8px]"></i></button>
                      </span>
                    )}
                    {memberOnly && (
                      <span className="inline-flex items-center gap-1 bg-[#FFF8D3] border border-[#FCD200] text-[#0F1111] text-[9px] font-bold px-2 py-0.5">
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="lg:hidden flex items-center gap-1.5 px-3 py-2 bg-[#232F3E] text-white rounded text-[10px] font-black uppercase border border-[#37475A] relative"
                >
                  <i className="fa-solid fa-sliders text-xs"></i>
                  Filtres
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#FF9900] rounded-full text-[#0F1111] text-[8px] font-black flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="appearance-none bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded px-3 py-2 pr-7 text-[10px] font-bold text-[#565959] cursor-pointer"
                  >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-2.5 top-1/2 -translate-y-1/2 text-[#adb5bd] text-[8px] pointer-events-none"></i>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="hidden lg:block sticky top-[128px] self-start max-h-[calc(100vh-148px)] overflow-y-auto">
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

              <div className="flex-1 min-w-0">
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                ) : results.length === 0 ? (
                  <NoResults query={query} onClear={submitSearch} />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
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

      {showMobileFilters && (
        <div className="fixed inset-0 z-[600] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-[#EAEDED] overflow-y-auto">
            <div className="bg-[#131921] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
              <p className="font-black text-white text-sm">Filtres</p>
              <button onClick={() => setShowMobileFilters(false)}
                className="w-8 h-8 bg-[#232F3E] rounded flex items-center justify-center">
                <i className="fa-solid fa-xmark text-white text-sm"></i>
              </button>
            </div>
            <div className="p-2">
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
            <div className="sticky bottom-0 bg-white border-t border-[#D5D9D9] p-3">
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-full bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] py-2.5 rounded border border-[#FCD200] font-black text-[10px] uppercase tracking-widest"
              >
                Voir {results.length} résultat{results.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
