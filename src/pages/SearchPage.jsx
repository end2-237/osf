import React, { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { translateText } from "../lib/translate";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
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
    sub: "Son immersif. Livraison 2h Douala.",
    cta: "Découvrir",
    cat: "Audio Lab",
    img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=900",
    bg: "#F0F4F8",
  },
  {
    tag: "Flash −30%",
    title: "Streetwear Élite",
    sub: "Collections limitées arrivées.",
    cta: "Shop Now",
    cat: "Clothing",
    img: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=900",
    bg: "#FBF1F1",
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

// ─── SKELETON ─────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white border border-gray-100 rounded-xl overflow-hidden animate-pulse">
    <div className="aspect-square bg-gray-100" />
    <div className="p-3 space-y-2">
      <div className="h-2 bg-gray-100 rounded w-1/3" />
      <div className="h-3 bg-gray-100 rounded w-4/5" />
      <div className="h-4 bg-gray-100 rounded w-1/2" />
    </div>
  </div>
);

// ─── PRODUCT CARD (clean NextPick style) ──────────────────────────────────────
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
      className="bg-white border border-gray-100 hover:border-gray-200 rounded-xl overflow-hidden group cursor-pointer transition-all hover:shadow-lg hover:shadow-gray-200/50 flex flex-col"
      onClick={() => onView(product)}
    >
      <div className="relative bg-[#F7F8FA] aspect-square overflow-hidden flex items-center justify-center p-4">
        <img
          src={product.img}
          alt={product.name}
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
        />
        {flashPct && (
          <div className="absolute top-3 left-3 bg-[#EF4444] text-white text-[10px] font-bold px-2 py-1 rounded-md">
            -{flashPct}%
          </div>
        )}
        {discountActive && !flashPct && (
          <div className="absolute top-3 left-3 bg-[#FF9900] text-white text-[10px] font-bold px-2 py-1 rounded-md">
            −20%
          </div>
        )}
        {product.status === "Épuisé" && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-[11px] font-bold uppercase text-gray-500 border border-gray-300 px-3 py-1 rounded-full">Épuisé</span>
          </div>
        )}
        {/* Quick add — appears on hover */}
        <button
          onClick={handleAdd}
          disabled={product.status === "Épuisé"}
          className={`absolute bottom-3 right-3 w-10 h-10 rounded-full shadow-md flex items-center justify-center transition-all md:opacity-0 md:translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 active:scale-90 disabled:opacity-30 ${
            added ? "bg-[#16A34A] text-white" : "bg-white text-gray-900 hover:bg-[#FF9900] hover:text-white"
          }`}
        >
          <i className={`fa-solid ${added ? "fa-check" : "fa-plus"} text-sm`}></i>
        </button>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <p className="text-[10px] font-semibold uppercase text-gray-400 tracking-wide mb-1">{product.type}</p>
        <p className="text-[13px] font-semibold text-gray-900 leading-snug line-clamp-2 mb-2 min-h-[34px] group-hover:text-[#FF9900] transition-colors">{product.name}</p>

        <div className="flex items-center gap-1 mb-2.5">
          {[1,2,3,4,5].map(s => (
            <i key={s} className="fa-solid fa-star text-[#FBBF24] text-[10px]"></i>
          ))}
          <span className="text-[10px] text-gray-400 ml-1">(12)</span>
        </div>

        <div className="mt-auto flex items-end justify-between">
          {flashPct ? (
            <div>
              <p className="text-gray-900 font-bold text-lg leading-none">{price.toLocaleString()} F</p>
              <p className="text-[11px] text-gray-400 line-through">{origFlash.toLocaleString()} F</p>
            </div>
          ) : discountActive ? (
            <div>
              <p className="text-gray-900 font-bold text-lg leading-none">{memberPrice.toLocaleString()} F</p>
              <p className="text-[11px] text-gray-400 line-through">{price.toLocaleString()} F</p>
            </div>
          ) : (
            <p className="text-gray-900 font-bold text-lg leading-none">{price.toLocaleString()} F</p>
          )}
          <span className="text-[10px] text-[#16A34A] font-semibold flex items-center gap-1">
            <i className="fa-solid fa-truck-fast"></i>2h
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── CATEGORY PILL (icon circle, clean) ───────────────────────────────────────
const CategoryPill = ({ cat, onClick, active }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2.5 group flex-shrink-0"
  >
    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center transition-all ${
      active
        ? "bg-[#FF9900] shadow-lg shadow-orange-200"
        : "bg-white border border-gray-100 group-hover:border-[#FF9900]/40 group-hover:shadow-md"
    }`}>
      <i className={`fa-solid ${cat.icon} text-xl md:text-2xl`} style={{ color: active ? "#fff" : cat.color }}></i>
    </div>
    <span className={`text-[11px] md:text-xs font-semibold ${active ? "text-[#FF9900]" : "text-gray-700"}`}>
      {cat.label}
    </span>
  </button>
);

// ─── FILTER SIDEBAR (clean) ───────────────────────────────────────────────────
const FilterSidebar = ({ activeCategory, setActiveCategory, activePriceRange, setActivePriceRange, vendors, activeVendors, toggleVendor, memberOnly, setMemberOnly, resultCount, onReset }) => {
  const hasFilters = activeCategory !== "All" || activePriceRange !== null || activeVendors.size > 0 || memberOnly;
  return (
    <aside className="w-60 flex-shrink-0 space-y-5">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-sliders text-gray-400 text-sm"></i>
          <h3 className="font-bold text-gray-900 text-sm">Filtres</h3>
        </div>
        {hasFilters && (
          <button onClick={onReset} className="text-[11px] font-semibold text-[#FF9900] hover:underline">
            Réinitialiser
          </button>
        )}
      </div>

      {/* CATÉGORIES */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Catégorie</p>
        <div className="space-y-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                activeCategory === cat.key ? "bg-[#FFF7EC] text-[#FF9900]" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <i className={`fa-solid ${cat.icon} text-sm w-4`} style={{ color: activeCategory === cat.key ? "#FF9900" : cat.color }}></i>
              <span className="text-[13px] font-medium">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* PRIX */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Prix</p>
        <div className="space-y-1">
          {PRICE_RANGES.map((range, i) => (
            <button
              key={i}
              onClick={() => setActivePriceRange(activePriceRange === i ? null : i)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                activePriceRange === i ? "bg-[#FFF7EC]" : "hover:bg-gray-50"
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                activePriceRange === i ? "border-[#FF9900] bg-[#FF9900]" : "border-gray-300"
              }`}>
                {activePriceRange === i && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className={`text-[13px] ${activePriceRange === i ? "text-[#FF9900] font-semibold" : "text-gray-700"}`}>
                {range.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* VENDEURS */}
      {vendors.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Boutique</p>
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {vendors.map(v => (
              <button
                key={v.id}
                onClick={() => toggleVendor(v.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeVendors.has(v.id) ? "bg-[#FFF7EC]" : "hover:bg-gray-50"
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  activeVendors.has(v.id) ? "border-[#FF9900] bg-[#FF9900]" : "border-gray-300"
                }`}>
                  {activeVendors.has(v.id) && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                </div>
                <span className={`text-[13px] truncate ${activeVendors.has(v.id) ? "text-[#FF9900] font-semibold" : "text-gray-700"}`}>
                  {v.shop_name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* OFFRES */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Offres</p>
        <button
          onClick={() => setMemberOnly(!memberOnly)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${memberOnly ? "bg-[#FFF7EC]" : "hover:bg-gray-50"}`}
        >
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
            memberOnly ? "border-[#FF9900] bg-[#FF9900]" : "border-gray-300"
          }`}>
            {memberOnly && <i className="fa-solid fa-check text-white text-[8px]"></i>}
          </div>
          <div>
            <p className={`text-[13px] font-medium ${memberOnly ? "text-[#FF9900]" : "text-gray-700"}`}>Remise membre −20%</p>
            <p className="text-[11px] text-gray-400">Produits éligibles</p>
          </div>
        </button>
      </div>

      {/* TRUST */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
        {[
          { icon: "fa-truck-fast",    text: "Livraison 2h à Douala" },
          { icon: "fa-mobile-screen", text: "Orange Money · MTN MoMo" },
          { icon: "fa-rotate-left",   text: "Retour sous 7 jours" },
          { icon: "fa-headset",       text: "Support WhatsApp 7j/7" },
        ].map(item => (
          <div key={item.text} className="flex items-center gap-2.5">
            <i className={`fa-solid ${item.icon} text-[#FF9900] text-xs w-4 flex-shrink-0`}></i>
            <span className="text-[12px] text-gray-600 font-medium">{item.text}</span>
          </div>
        ))}
      </div>
    </aside>
  );
};

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
const NoResults = ({ query, onClear }) => (
  <div className="py-20 text-center">
    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
      <i className="fa-solid fa-magnifying-glass text-gray-300 text-3xl"></i>
    </div>
    <h2 className="text-xl font-bold text-gray-900 mb-2">
      Aucun résultat pour <span className="text-[#FF9900]">"{query}"</span>
    </h2>
    <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
      Essayez d'autres mots-clés ou parcourez les catégories.
    </p>
    <div className="flex flex-wrap gap-2 justify-center mb-8">
      {TRENDING.slice(0, 4).map(t => (
        <button key={t} onClick={() => onClear(t)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-full text-[12px] font-semibold text-gray-700 hover:border-[#FF9900] hover:text-[#FF9900] transition-all"
        >
          {t}
        </button>
      ))}
    </div>
    <Link to="/store"
      className="inline-flex items-center gap-2 bg-[#FF9900] hover:bg-[#e88a00] text-white px-6 py-3 rounded-full font-bold text-[13px] transition-colors"
    >
      <i className="fa-solid fa-bag-shopping"></i>
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

  // ── FETCH PRODUCTS ────────────────────────────────────────────────────────
  useEffect(() => {
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
      });
  }, []);

  // ── SYNC query + cat depuis URL ───────────────────────────────────────────
  useEffect(() => {
    setQuery(searchParams.get("q") || "");
    setActiveCategory(searchParams.get("cat") || "All");
    setActivePriceRange(null);
    setActiveVendors(new Set());
  }, [searchParams]);

  // ── Translate search query FR → EN when French mode is ON ─────────────────
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

  // ── FILTERED + SORTED RESULTS ─────────────────────────────────────────────
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
  }, [products, searchQuery, activeCategory, activePriceRange, activeVendors, memberOnly, sortBy]);

  const isSearching  = !!query.trim() || !!searchParams.get("cat");
  const hasFilters   = activeCategory !== "All" || activePriceRange !== null || activeVendors.size > 0 || memberOnly;
  const activeFiltersCount = (activeCategory !== "All" ? 1 : 0) + (activePriceRange !== null ? 1 : 0) + activeVendors.size + (memberOnly ? 1 : 0);

  return (
    <div className="min-h-screen bg-white">

      <div className="max-w-[1500px] mx-auto px-4 md:px-8 py-6">

        {/* ═══ NO QUERY: LANDING STATE ═══ */}
        {!isSearching && (
          <>
            {/* ── TOP BRANDS BAR ── */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900">Top Marques</h2>
                <Link to="/store" className="text-[12px] font-semibold text-[#FF9900] hover:underline">Voir tout</Link>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-1">
                {TOP_BRANDS.map(b => (
                  <button
                    key={b.name}
                    onClick={() => submitSearch(b.name)}
                    className="flex items-center gap-2.5 px-5 py-3 bg-white border border-gray-100 rounded-xl hover:border-[#FF9900]/40 hover:shadow-md transition-all flex-shrink-0"
                  >
                    <i className={`${b.brand ? "fa-brands" : "fa-solid"} ${b.icon} text-gray-700 text-lg`}></i>
                    <span className="text-[13px] font-bold text-gray-800">{b.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── SHOP BY CATEGORY ── */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Parcourir par catégorie</h2>
                  <p className="text-[12px] text-gray-400">Explorez nos univers produits</p>
                </div>
                <Link to="/store" className="text-[12px] font-semibold text-[#FF9900] hover:underline flex items-center gap-1.5">
                  Tout voir <i className="fa-solid fa-arrow-right text-[10px]"></i>
                </Link>
              </div>
              <div className="flex items-start gap-5 md:gap-7 overflow-x-auto hide-scrollbar pb-2">
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

            {/* ── FEATURE BANNERS ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
              {FEATURE_BANNERS.map(b => (
                <div
                  key={b.title}
                  onClick={() => { setActiveCategory(b.cat); submitSearch(b.cat); }}
                  className="relative overflow-hidden rounded-2xl flex items-center cursor-pointer group min-h-[180px]"
                  style={{ background: b.bg }}
                >
                  <div className="relative z-10 p-7 flex-1">
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-[#FF9900] bg-white px-2.5 py-1 rounded-full mb-3 shadow-sm">
                      {b.tag}
                    </span>
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-1.5">{b.title}</h3>
                    <p className="text-[13px] text-gray-500 mb-4 max-w-[200px]">{b.sub}</p>
                    <span className="inline-flex items-center gap-2 bg-gray-900 group-hover:bg-[#FF9900] text-white px-5 py-2.5 rounded-full font-bold text-[12px] transition-colors">
                      {b.cta} <i className="fa-solid fa-arrow-right text-[10px]"></i>
                    </span>
                  </div>
                  <div className="relative z-0 w-36 md:w-48 h-full flex-shrink-0 self-stretch">
                    <img src={b.img} alt={b.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                </div>
              ))}
            </div>

            {/* ── FLASH DEALS ── */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#FEF2F2] rounded-xl flex items-center justify-center">
                    <i className="fa-solid fa-bolt text-[#EF4444] text-base"></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 leading-none mb-1">Flash Deals</h2>
                    <p className="text-[12px] text-gray-400">Offres à durée limitée</p>
                  </div>
                </div>
                <Link to="/store" className="text-[12px] font-semibold text-[#FF9900] hover:underline flex items-center gap-1.5">
                  Voir tout <i className="fa-solid fa-arrow-right text-[10px]"></i>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {(flashDeals.length === 0 ? Array.from({ length: 6 }) : flashDeals).map((p, i) =>
                  !p
                    ? <SkeletonCard key={i} />
                    : <ProductCard key={p.id} product={p} onView={openModal} onAddToCart={addToCart} isMember={isMember} flashIndex={i} />
                )}
              </div>
            </div>

            {/* ── POPULAIRES ── */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Populaires en ce moment</h2>
                <Link to="/store" className="text-[12px] font-semibold text-[#FF9900] hover:underline flex items-center gap-1.5">
                  Voir le store <i className="fa-solid fa-arrow-right text-[10px]"></i>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-5 border-b border-gray-100">
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {query.trim() ? (
                    <>Résultats pour <span className="text-[#FF9900]">"{query}"</span></>
                  ) : activeCategory !== "All" ? (
                    CATEGORIES.find(c => c.key === activeCategory)?.label || activeCategory
                  ) : "Tous les produits"}
                </h1>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  {results.length} produit{results.length !== 1 ? "s" : ""} trouvé{results.length !== 1 ? "s" : ""}
                </p>
                {hasFilters && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                    {activeCategory !== "All" && (
                      <span className="inline-flex items-center gap-1.5 bg-[#FFF7EC] text-[#FF9900] text-[11px] font-semibold px-2.5 py-1 rounded-full">
                        {CATEGORIES.find(c => c.key === activeCategory)?.label || activeCategory}
                        <button onClick={() => setActiveCategory("All")} className="hover:text-[#e88a00]"><i className="fa-solid fa-xmark text-[10px]"></i></button>
                      </span>
                    )}
                    {activePriceRange !== null && (
                      <span className="inline-flex items-center gap-1.5 bg-[#FFF7EC] text-[#FF9900] text-[11px] font-semibold px-2.5 py-1 rounded-full">
                        {PRICE_RANGES[activePriceRange].label}
                        <button onClick={() => setActivePriceRange(null)} className="hover:text-[#e88a00]"><i className="fa-solid fa-xmark text-[10px]"></i></button>
                      </span>
                    )}
                    {memberOnly && (
                      <span className="inline-flex items-center gap-1.5 bg-[#FFF7EC] text-[#FF9900] text-[11px] font-semibold px-2.5 py-1 rounded-full">
                        Remise membre
                        <button onClick={() => setMemberOnly(false)} className="hover:text-[#e88a00]"><i className="fa-solid fa-xmark text-[10px]"></i></button>
                      </span>
                    )}
                    <button onClick={resetFilters} className="text-[11px] font-semibold text-gray-400 hover:text-[#FF9900]">
                      Tout effacer
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-full text-[12px] font-semibold relative"
                >
                  <i className="fa-solid fa-sliders text-xs"></i>
                  Filtres
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#FF9900] rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="appearance-none bg-white border border-gray-200 focus:border-[#FF9900] focus:outline-none rounded-full px-4 py-2.5 pr-9 text-[12px] font-semibold text-gray-700 cursor-pointer"
                  >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none"></i>
                </div>
              </div>
            </div>

            {/* CONTENT: SIDEBAR + GRID */}
            <div className="flex gap-8">

              {/* SIDEBAR (desktop) */}
              <div className="hidden lg:block sticky top-[128px] self-start max-h-[calc(100vh-148px)] overflow-y-auto pr-2">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white overflow-y-auto">
            <div className="bg-white px-5 py-4 flex items-center justify-between sticky top-0 border-b border-gray-100 z-10">
              <p className="font-bold text-gray-900 text-base">Filtres</p>
              <button onClick={() => setShowMobileFilters(false)}
                className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100">
                <i className="fa-solid fa-xmark text-gray-600 text-sm"></i>
              </button>
            </div>
            <div className="p-5">
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
            <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-full bg-[#FF9900] hover:bg-[#e88a00] text-white py-3 rounded-full font-bold text-[13px]"
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
