import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SponsoredBanner from "../components/SponsoredBanner";
import ProductCard from "../components/ProductCard";
import { supabase } from "../lib/supabase";
import ofsLogo from "../assets/ofs.png";
import { useAuth } from "../context/AuthContext";

/* ─────────────────── CONSTANTS ─────────────────── */
const SUBCATEGORIES = {
  "Audio Lab":       ["Casques", "Enceintes", "Écouteurs", "Microphones"],
  "Tech Lab":        ["Smartphones", "TV & Vidéo", "Tablettes", "Informatique", "Gaming", "Photo & Vidéo", "Câbles & Chargeurs", "Électroménager", "Objets Connectés", "Maison Connectée"],
  "Clothing":        ["Hoodies & Sweats", "T-Shirts & Polos", "Chemises", "Pantalons & Jeans", "Vestes & Manteaux", "Shorts", "Costumes & Survêtements", "Sous-vêtements"],
  "Shoes":           ["Sneakers", "Bottes", "Sandales", "Mocassins", "Talons"],
  "Femme":           ["Robes & Jupes", "Tops & Blouses", "Lingerie", "Manteaux", "Combinaisons"],
  "Beauté":          ["Parfums", "Soins Visage", "Soins Cheveux", "Maquillage", "Corps & Bain"],
  "Accessories":     ["Montres", "Bijoux", "Sacs à main", "Lunettes", "Portefeuilles", "Ceintures", "Chapeaux"],
  "Maison":          ["Cuisine", "Décoration", "Literie", "Éclairage", "Rangement"],
  "Sport":           ["Fitness", "Vêtements Sport", "Cyclisme", "Natation", "Camping"],
  "Bébé & Enfants":  ["Jouets", "Vêtements Enfant", "Nurserie", "Scolaire"],
  "Auto":            ["Intérieur Auto", "Extérieur Auto", "Moto & Scooter", "Entretien"],
};

const CATEGORIES = [
  { key: "All",            label: "Tout voir",   icon: "fa-grid-2",             color: "#00ff88" },
  { key: "Audio Lab",      label: "Audio Lab",   icon: "fa-headphones",         color: "#00ff88" },
  { key: "Tech Lab",       label: "Tech Lab",    icon: "fa-microchip",          color: "#3b82f6" },
  { key: "Femme",          label: "Pour Elle",   icon: "fa-person-dress",       color: "#ec4899" },
  { key: "Clothing",       label: "Pour Lui",    icon: "fa-shirt",              color: "#a855f7" },
  { key: "Shoes",          label: "Sneakers",    icon: "fa-shoe-prints",        color: "#f97316" },
  { key: "Beauté",         label: "Beauté",      icon: "fa-spray-can-sparkles", color: "#f472b6" },
  { key: "Accessories",    label: "Accessoires", icon: "fa-gem",                color: "#eab308" },
  { key: "Maison",         label: "Maison",      icon: "fa-house",              color: "#14b8a6" },
  { key: "Sport",          label: "Sport",       icon: "fa-dumbbell",           color: "#f97316" },
  { key: "Bébé & Enfants", label: "Enfants",     icon: "fa-baby",               color: "#fb923c" },
  { key: "Auto",           label: "Auto",        icon: "fa-car",                color: "#64748b" },
];

const SORT_OPTIONS = [
  { value: "recommended", label: "Recommandés"     },
  { value: "popular",     label: "Populaires"      },
  { value: "recent",      label: "Plus récents"    },
  { value: "price-asc",   label: "Prix croissant"  },
  { value: "price-desc",  label: "Prix décroissant"},
];

// "All" view: hide "recent" (meaningless when mixing categories without canonical date)
const SORT_OPTIONS_ALL = SORT_OPTIONS.filter(o => o.value !== "recent");

// Category keys (no "All") used for parallel fetch
const CAT_KEYS = ["Audio Lab", "Tech Lab", "Clothing", "Shoes", "Femme", "Beauté", "Accessories", "Maison", "Sport", "Bébé & Enfants", "Auto"];
const ALL_PER_CAT = Math.ceil(48 / CAT_KEYS.length); // ~4-5 per category

// Editorial section breaks injected every N products in the grid
const EDITORIAL_SECTIONS = [
  {
    id: "coup-de-coeur",
    tag: "COUP DE CŒUR",
    title: "Sélection de la semaine",
    color: "#FF9900",
    items: [
      { cat: "Audio Lab",  sub: "Casques",   label: "Casques & Son",    img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80" },
      { cat: "Tech Lab",   sub: null,        label: "Tech & Gadgets",   img: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=400&q=80" },
      { cat: "Shoes",      sub: "Sneakers",  label: "Sneakers",         img: "https://images.unsplash.com/photo-1549298916-f52d724204b4?w=400&q=80" },
      { cat: "Accessories",sub: "Montres",   label: "Montres & Bijoux", img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80" },
    ],
  },
  {
    id: "tendances",
    tag: "TENDANCES",
    title: "Les plus commandés",
    color: "#3b82f6",
    items: [
      { cat: "Clothing",  sub: null,                label: "Mode Homme",  img: "https://images.unsplash.com/photo-1614680376408-81e91ffe3db7?w=400&q=80" },
      { cat: "Femme",     sub: null,               label: "Mode Femme",  img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&q=80" },
      { cat: "Beauté",    sub: "Parfums",           label: "Parfums",     img: "https://images.unsplash.com/photo-1541643600914-78b084683702?w=400&q=80" },
      { cat: "Tech Lab",  sub: "Gaming",            label: "Gaming",      img: "https://images.unsplash.com/photo-1593118247619-e2d6f056869e?w=400&q=80" },
    ],
  },
  {
    id: "bundle-deal",
    tag: "−15% BUNDLE",
    title: "Dès 2 articles dans le panier",
    color: "#a855f7",
    items: [
      { cat: "Audio Lab",  sub: "Enceintes",  label: "Enceintes",       img: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80" },
      { cat: "Accessories",sub: "Sacs à main",       label: "Sacs & Bagages",  img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80" },
      { cat: "Shoes",      sub: null,               label: "Chaussures",      img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80" },
      { cat: "Clothing",   sub: "Vestes & Manteaux",label: "Vestes",          img: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&q=80" },
    ],
  },
];

const PROMO_BANNERS = [
  {
    tag: "FLASH DEAL",
    title: "Audio Lab",
    sub: "-25% sur tous les casques",
    color: "#00ff88",
    img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600",
    bg: "from-emerald-50 to-white",
  },
  {
    tag: "NEW DROP",
    title: "Sneakers",
    sub: "Éditions limitées arrivées",
    color: "#f97316",
    img: "https://images.unsplash.com/photo-1549298916-f52d724204b4?q=80&w=1113&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    bg: "from-orange-50 to-white",
  },
  {
    tag: "BUNDLE",
    title: "Tech Lab",
    sub: "2 articles = -15%",
    color: "#3b82f6",
    img: "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=600",
    bg: "from-blue-50 to-white",
  },
];

/* ─────────────────── SKELETON ─────────────────── */
const ProductSkeleton = () => (
  <div className="animate-pulse bg-white border border-[#D5D9D9] rounded overflow-hidden">
    <div className="aspect-square bg-[#F3F4F4] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
    </div>
    <div className="p-3 space-y-2">
      <div className="h-2.5 bg-[#F3F4F4] rounded w-1/3"></div>
      <div className="h-3 bg-[#F3F4F4] rounded w-3/4"></div>
      <div className="h-2 bg-[#F3F4F4] rounded w-1/2"></div>
      <div className="h-4 bg-[#F3F4F4] rounded w-1/3"></div>
      <div className="h-7 bg-[#F3F4F4] rounded w-full"></div>
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
const MarketplaceHero = ({ totalProducts, searchQuery, setSearchQuery, onSearch }) => (
  <div className="relative bg-[#08090b] overflow-hidden" style={{ height: "248px" }}>

    {/* ── Video commercial background ── */}
    <video
      autoPlay muted loop playsInline
      className="absolute inset-0 w-full h-full object-cover"
      style={{ opacity: 0.52 }}
      poster="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600&q=60"
    >
      <source src="https://videos.pexels.com/video-files/3571264/3571264-hd_1920_1080_30fps.mp4" type="video/mp4" />
      <source src="https://videos.pexels.com/video-files/4763824/4763824-hd_1280_720_25fps.mp4"  type="video/mp4" />
    </video>

    {/* ── Cinematic vignette ── */}
    <div className="absolute inset-0 pointer-events-none" style={{
      background: "linear-gradient(to right, #08090b 0%, #08090b 30%, rgba(8,9,11,0.65) 60%, rgba(8,9,11,0.15) 100%)"
    }} />
    <div className="absolute inset-0 pointer-events-none" style={{
      background: "linear-gradient(to top, #08090b 0%, transparent 55%)"
    }} />
    {/* Ambient glow */}
    <div className="absolute bottom-0 left-24 w-72 h-28 bg-[#FF9900]/10 blur-3xl rounded-full pointer-events-none" />

    {/* ── OFS watermark ── */}
    <div className="absolute top-0 right-0 h-full flex items-center pr-6 select-none pointer-events-none">
      <span className="text-white/[0.04] font-black text-[100px] tracking-[-4px] leading-none">OFS</span>
    </div>

    {/* ── Content ── */}
    <div className="relative z-10 h-full flex items-center px-3 md:px-4">
      <div className="max-w-[1400px] mx-auto w-full">
        <div className="max-w-lg">

          {/* Live pill */}
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 bg-[#FF9900] text-[#0F1111] text-[8.5px] font-black px-2 py-[3px] uppercase tracking-[0.15em] shadow-lg rounded-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F1111] animate-pulse"></span>
              OFS CM · LIVE
            </span>
            <span className="text-white/30 text-[10px] font-medium tracking-wide">
              {totalProducts}+ références · Douala 🇨🇲
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-black text-white leading-[1.05] tracking-tight mb-1.5" style={{ fontSize: "clamp(22px,3vw,32px)" }}>
            La Marketplace{" "}
            <span className="text-[#FF9900]" style={{ textShadow: "0 0 28px rgba(255,153,0,0.45)" }}>
              Elite
            </span>
            {" "}de Douala
          </h1>
          <p className="text-[#6b7280] text-[11px] mb-3 leading-relaxed">
            Audio · Streetwear · Tech · Parfums &mdash; boutiques certifiées, livraison express.
          </p>

          {/* Search bar — compact h-9 */}
          <div className="flex h-9 rounded overflow-hidden shadow-2xl ring-1 ring-[#FF9900]/35 max-w-md mb-2.5">
            <select className="bg-[#F3F4F4] text-[#0F1111] text-[10px] px-2 border-r border-[#CDCDCD] outline-none cursor-pointer flex-shrink-0 font-bold">
              <option>Tout</option>
              <option>Audio</option>
              <option>Mode</option>
              <option>Sneakers</option>
              <option>Tech</option>
              <option>Parfums</option>
            </select>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="Casque, sneakers, parfum…"
              className="flex-grow bg-white text-[#0F1111] px-3 text-[12px] outline-none min-w-0"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="bg-white px-2 text-gray-400 hover:text-gray-700 transition">
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            )}
            <button onClick={onSearch}
              className="bg-[#FF9900] hover:bg-[#E47911] text-[#0F1111] px-4 flex items-center gap-1.5 transition-colors flex-shrink-0 font-bold text-[11px]"
            >
              <i className="fa-solid fa-magnifying-glass text-[11px]"></i>
              <span className="hidden sm:inline">Chercher</span>
            </button>
          </div>

          {/* Trending tags — one line */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] text-[#4b5563] font-bold uppercase tracking-widest mr-0.5">Tendances</span>
            {["AirPods", "Sneakers", "Casque", "Hoodies", "Parfum"].map((tag) => (
              <button key={tag} onClick={() => setSearchQuery(tag)}
                className="text-[10px] px-2 py-0.5 rounded-sm bg-white/6 text-[#9ca3af] hover:bg-[#FF9900] hover:text-[#0F1111] transition-all border border-white/8 hover:border-[#FF9900]"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ─────────────────── TRUST STRIP (below hero) ─────────────────── */
const TrustStrip = () => (
  <div className="bg-[#131921] border-b border-[#1f2d3d]">
    <div className="max-w-[1400px] mx-auto flex items-center overflow-x-auto"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
      {[
        { icon: "fa-store",            text: "5+ boutiques",     sub: "certifiées OFS",   color: "#FF9900" },
        { icon: "fa-truck-fast",       text: "Livraison 2h",     sub: "Douala express",   color: "#60a5fa" },
        { icon: "fa-shield-check",     text: "Paiement sécurisé",sub: "Orange · MTN · Cash", color: "#4ade80" },
        { icon: "fa-rotate-left",      text: "Retour 7 jours",   sub: "sans question",    color: "#c084fc" },
        { icon: "fa-crown",            text: "Membre Elite",     sub: "−20% immédiat",    color: "#fbbf24" },
      ].map((b, i) => (
        <div key={i} className="flex items-center gap-2 px-4 py-2.5 border-r border-[#1f2d3d] flex-shrink-0 hover:bg-white/4 transition-colors cursor-default">
          <i className={`fa-solid ${b.icon} text-[11px] flex-shrink-0`} style={{ color: b.color }}></i>
          <div className="leading-tight">
            <span className="text-[10px] font-bold text-white">{b.text}</span>
            <span className="text-[10px] text-[#4b5563] ml-1">{b.sub}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ─────────────────── PROMO BANNERS STRIP ─────────────────── */
const PromoBanners = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-2 px-2 md:px-3 max-w-[1400px] mx-auto">
    {PROMO_BANNERS.map((b, i) => (
      <Link key={i} to="/store"
        className="bg-white border border-[#D5D9D9] hover:border-[#FF9900] hover:shadow-md rounded p-4 flex items-center gap-4 group transition-all"
      >
        <div className="flex-1">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded mb-2 inline-block"
            style={{ backgroundColor: `${b.color}15`, color: b.color }}
          >
            {b.tag}
          </span>
          <h3 className="font-bold text-base text-[#0F1111] group-hover:text-[#C45500] transition-colors">{b.title}</h3>
          <p className="text-[11px] text-[#565959] mt-0.5">{b.sub}</p>
          <p className="text-[#007185] text-xs mt-1.5 group-hover:text-[#C45500] group-hover:underline transition-colors">
            Voir les offres →
          </p>
        </div>
        <div className="w-20 h-20 rounded overflow-hidden flex-shrink-0">
          <img src={b.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      </Link>
    ))}
  </div>
);

/* ─────────────────── VENDORS SECTION ─────────────────── */
const VendorsSection = ({ vendors, loading, vendorProducts }) => {
  if (!loading && vendors.length === 0) return null;
  return (
    <div className="bg-white border-b border-[#D5D9D9] py-2 px-2 md:px-3">
      <div className="max-w-[1400px] mx-auto flex items-center gap-2 overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>

        {/* Label */}
        <span className="text-[10px] font-bold uppercase text-[#565959] whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 pr-1 border-r border-[#E8E8E8]">
          <i className="fa-solid fa-store text-[#FF9900] text-[11px]"></i>
          Boutiques
        </span>

        {/* Vendor pills */}
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse flex-shrink-0 flex items-center gap-2 bg-[#F3F4F4] rounded-full px-3 py-1.5 w-28 h-7" />
            ))
          : vendors.map((vendor) => {
              const vProducts = vendorProducts[vendor.id] || [];
              const thumb = vProducts[0]?.img;
              return (
                <Link key={vendor.id} to={`/shop/${vendor.shop_name}`}
                  className="flex-shrink-0 flex items-center gap-2 border border-[#D5D9D9] rounded-full pl-0.5 pr-3 py-0.5 hover:border-[#FF9900] hover:bg-[#FFF8F0] transition-all group"
                >
                  {/* Mini product thumbnail or icon */}
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-[#F3F4F4] flex-shrink-0 flex items-center justify-center">
                    {thumb
                      ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                      : <i className="fa-solid fa-store text-primary text-[8px]"></i>
                    }
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-tight text-[#0F1111] group-hover:text-[#C45500] transition-colors whitespace-nowrap">
                    {vendor.shop_name}
                  </span>
                  <i className="fa-solid fa-circle-check text-[#FF9900] text-[10px]"></i>
                  <span className="text-[10px] text-[#767676]">{vProducts.length}</span>
                </Link>
              );
            })
        }

        {/* CTA pill */}
        {!loading && (
          <Link to="/register"
            className="flex-shrink-0 flex items-center gap-1.5 border border-dashed border-[#FEBD69] rounded-full px-3 py-1 hover:border-[#FF9900] hover:bg-[#FFF8F0] transition-all text-[11px] font-medium text-[#C45500] whitespace-nowrap"
          >
            <i className="fa-solid fa-plus text-[10px]"></i>
            Ouvrir ma boutique
          </Link>
        )}
      </div>
    </div>
  );
};

/* ─────────────────── CATEGORY TABS ─────────────────── */
const CategoryTabs = ({ active, onChange, counts }) => {
  const scrollRef = useRef(null);
  return (
    <div className="sticky top-[128px] md:top-[128px] z-30 bg-white border-b border-[#D5D9D9] shadow-sm">
      <div className="max-w-[1400px] mx-auto px-2 md:px-3">
        <div ref={scrollRef} className="flex items-center gap-1 overflow-x-auto py-1.5">
          {CATEGORIES.map((cat) => {
            const count = cat.key === "All"
              ? Object.values(counts).reduce((a, b) => a + b, 0)
              : counts[cat.key] || 0;
            const isActive = active === cat.key;
            return (
              <button key={cat.key} onClick={() => onChange(cat.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded text-[12px] font-medium whitespace-nowrap transition-all flex-shrink-0 border ${
                  isActive
                    ? "bg-[#232F3E] text-white border-[#232F3E]"
                    : "bg-white text-[#0F1111] border-[#D5D9D9] hover:border-[#FF9900] hover:bg-[#FFF8F0]"
                }`}
              >
                <i className={`fa-solid ${cat.icon} text-xs`} style={{ color: isActive ? "#FF9900" : cat.color }}></i>
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5 ${
                  isActive ? "bg-[#FF9900]/20 text-[#FF9900]" : "bg-[#F3F4F4] text-[#565959]"
                }`}>
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

/* ─────────────────── SUBCATEGORY PILLS ─────────────────── */
const SubcategoryPills = ({ category, active, onChange }) => {
  const subs = SUBCATEGORIES[category];
  if (!subs) return null;
  return (
    <div className="bg-[#F3F4F4] border-b border-[#D5D9D9]">
      <div className="max-w-[1400px] mx-auto px-2 md:px-3">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="text-[10px] text-[#565959] font-bold uppercase whitespace-nowrap flex-shrink-0">
            <i className="fa-solid fa-filter text-[#FF9900] mr-1"></i>Sous-cat :
          </span>
          <button onClick={() => onChange(null)}
            className={`flex-shrink-0 text-[11px] px-3 py-1 rounded-full border transition-all ${
              !active ? "bg-[#232F3E] text-white border-[#232F3E]" : "bg-white border-[#D5D9D9] text-[#565959] hover:border-[#FF9900]"
            }`}
          >
            Tout
          </button>
          {subs.map(sub => (
            <button key={sub} onClick={() => onChange(active === sub ? null : sub)}
              className={`flex-shrink-0 text-[11px] px-3 py-1 rounded-full border transition-all ${
                active === sub
                  ? "bg-[#FF9900] text-[#0F1111] border-[#FF9900] font-bold"
                  : "bg-white border-[#D5D9D9] text-[#565959] hover:border-[#FF9900] hover:text-[#0F1111]"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────── SUBCATEGORY BROWSE (All view) — horizontal scroll strip ─────────────────── */
const SubcategoryBrowse = ({ onSubcategorySelect }) => {
  const scrollRef = useRef(null);
  const allSubs = Object.entries(SUBCATEGORIES).flatMap(([cat, subs]) =>
    subs.map(sub => ({ cat, sub }))
  );
  const scroll = (dir) =>
    scrollRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

  return (
    <div className="flex items-center gap-1.5 mb-2 bg-white border border-[#D5D9D9] rounded px-2 py-1.5">
      <button onClick={() => scroll(-1)}
        className="flex-shrink-0 w-7 h-7 border border-[#D5D9D9] rounded flex items-center justify-center text-[#565959] hover:border-[#FF9900] hover:text-[#FF9900] transition-colors"
      >
        <i className="fa-solid fa-chevron-left text-[10px]"></i>
      </button>

      <div ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto flex-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {allSubs.map(({ cat, sub }) => (
          <button key={`${cat}:${sub}`}
            onClick={() => onSubcategorySelect(cat, sub)}
            className="flex-shrink-0 text-[12px] px-3 py-1.5 border border-[#D5D9D9] rounded-sm whitespace-nowrap text-[#0F1111] hover:border-[#FF9900] hover:text-[#C45500] hover:bg-[#FFF8F0] transition-all"
          >
            {sub}
          </button>
        ))}
      </div>

      <button onClick={() => scroll(1)}
        className="flex-shrink-0 w-7 h-7 border border-[#D5D9D9] rounded flex items-center justify-center text-[#565959] hover:border-[#FF9900] hover:text-[#FF9900] transition-colors"
      >
        <i className="fa-solid fa-chevron-right text-[10px]"></i>
      </button>
    </div>
  );
};

/* ─────────────────── EDITORIAL SECTION BREAK ─────────────────── */
const SectionBreak = ({ section, onNavigate }) => (
  <div className="border border-[#D5D9D9] rounded overflow-hidden bg-white my-2">
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#F0F0F0]">
      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded"
        style={{ backgroundColor: `${section.color}18`, color: section.color }}>
        {section.tag}
      </span>
      <span className="font-bold text-[13px] text-[#0F1111]">{section.title}</span>
    </div>
    <div className="grid grid-cols-4 divide-x divide-[#F0F0F0]">
      {section.items.map((item, i) => (
        <button key={i} onClick={() => onNavigate(item.cat, item.sub)}
          className="flex flex-col group hover:bg-[#FAFAFA] transition-colors text-left">
          <div className="aspect-video overflow-hidden">
            <img src={item.img} alt={item.label}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
          <div className="px-3 py-2">
            <p className="text-[12px] font-medium text-[#0F1111] group-hover:text-[#C45500] transition-colors leading-tight">
              {item.label}
            </p>
            <p className="text-[11px] text-[#007185] group-hover:underline mt-0.5">Voir les offres</p>
          </div>
        </button>
      ))}
    </div>
  </div>
);

/* ─────────────────── SIDEBAR FILTERS ─────────────────── */
const SidebarFilters = ({
  maxPrice, setMaxPrice, priceMax,
  sortBy, setSortBy,
  selectedSize, setSelectedSize,
  category, subcategory,
  sortOptions, categoryCounts,
  onCategorySelect, onSetSubcategory,
}) => {
  const totalAll = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  return (
    <aside className="w-44 flex-shrink-0 space-y-0 bg-white border border-[#D5D9D9] rounded overflow-hidden divide-y divide-[#F0F0F0]">

      {/* DEPARTMENT */}
      <div className="p-3">
        <h4 className="font-bold text-[13px] text-[#0F1111] mb-2">Département</h4>

        {/* All */}
        <label className="flex items-center gap-2 py-1 cursor-pointer">
          <input type="radio" name="dept" checked={category === "All"} onChange={() => onCategorySelect("All")}
            className="accent-[#FF9900] cursor-pointer" />
          <span className={`text-[13px] flex-1 ${category === "All" ? "font-bold text-[#0F1111]" : "text-[#007185] hover:text-[#C45500] hover:underline"}`}>
            Tout voir
          </span>
          <span className="text-[11px] text-[#767676]">{totalAll}</span>
        </label>

        {/* Each category + nested subcategories */}
        {CATEGORIES.filter(c => c.key !== "All").map(cat => (
          <div key={cat.key}>
            <label className="flex items-center gap-2 py-1 cursor-pointer">
              <input type="radio" name="dept" checked={category === cat.key} onChange={() => onCategorySelect(cat.key)}
                className="accent-[#FF9900] cursor-pointer" />
              <span className={`text-[13px] flex-1 ${category === cat.key ? "font-bold text-[#0F1111]" : "text-[#007185] hover:text-[#C45500] hover:underline"}`}>
                {cat.label}
              </span>
              <span className="text-[11px] text-[#767676]">{categoryCounts[cat.key] || 0}</span>
            </label>

            {/* Subcategories shown when this category is active */}
            {category === cat.key && SUBCATEGORIES[cat.key] && (
              <div className="ml-5 mt-0.5 mb-1 space-y-0 border-l-2 pl-3" style={{ borderColor: `${cat.color}40` }}>
                <label className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input type="radio" name="subcat" checked={!subcategory} onChange={() => onSetSubcategory(null)}
                    className="accent-[#FF9900] cursor-pointer" />
                  <span className={`text-[12px] ${!subcategory ? "font-bold text-[#0F1111]" : "text-[#007185] hover:underline"}`}>Tout</span>
                </label>
                {SUBCATEGORIES[cat.key].map(sub => (
                  <label key={sub} className="flex items-center gap-2 py-0.5 cursor-pointer">
                    <input type="radio" name="subcat" checked={subcategory === sub} onChange={() => onSetSubcategory(sub)}
                      className="accent-[#FF9900] cursor-pointer" />
                    <span className={`text-[12px] ${subcategory === sub ? "font-bold text-[#0F1111]" : "text-[#007185] hover:underline"}`}>
                      {sub}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* SORT */}
      <div className="p-3">
        <h4 className="font-bold text-[13px] text-[#0F1111] mb-1">Trier par</h4>
        {sortOptions.map(opt => (
          <label key={opt.value} className="flex items-center gap-1.5 py-0.5 cursor-pointer">
            <input type="radio" name="sort" checked={sortBy === opt.value} onChange={() => setSortBy(opt.value)}
              className="accent-[#FF9900] cursor-pointer" />
            <span className={`text-[13px] ${sortBy === opt.value ? "font-bold text-[#0F1111]" : "text-[#007185] hover:text-[#C45500] hover:underline"}`}>
              {opt.label}
            </span>
          </label>
        ))}
      </div>

      {/* PRICE RANGE */}
      <div className="p-3">
        <h4 className="font-bold text-[13px] text-[#0F1111] mb-2">Budget Max</h4>
        <div className="mb-2">
          <span className="text-base font-bold text-[#B12704]">{Number(maxPrice).toLocaleString()}</span>
          <span className="text-xs text-[#565959] ml-1">FCFA</span>
        </div>
        <input type="range" min="0" max={priceMax} step="5000" value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full cursor-pointer" style={{ accentColor: "#FF9900" }} />
        <div className="flex justify-between text-[10px] text-[#767676] mt-1">
          <span>0</span>
          <span>{priceMax.toLocaleString()} F</span>
        </div>
      </div>

      {/* SIZE — clothing/shoes/femme only, not electronics */}
      {(category === "Clothing" || category === "Shoes" || category === "Femme") && (
        <div className="p-3">
          <h4 className="font-bold text-[13px] text-[#0F1111] mb-3">
            {category === "Shoes" ? "Pointure" : "Taille"}
          </h4>
          <div className="grid grid-cols-3 gap-1.5">
            {["All", ...(category === "Shoes" ? ["40","41","42","43","44"] : ["XS","S","M","L","XL"])].map((s) => (
              <button key={s} onClick={() => setSelectedSize(s)}
                className={`py-1.5 text-xs rounded border transition-all ${
                  selectedSize === s
                    ? "bg-[#232F3E] text-[#FF9900] border-[#232F3E]"
                    : "border-[#D5D9D9] text-[#565959] hover:border-[#FF9900] hover:text-[#0F1111]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* BUNDLE PROMO */}
      <div className="p-3 bg-[#FFFBF0]">
        <p className="text-[10px] font-black uppercase text-[#C45500] mb-1 flex items-center gap-1.5">
          <i className="fa-solid fa-tag text-[#FF9900]"></i>Bundle Deal
        </p>
        <p className="text-[11px] text-[#565959]">−15% automatiquement dès 2 articles dans le panier</p>
      </div>
    </aside>
  );
};

/* ─────────────────── ACTIVE FILTERS BAR ─────────────────── */
const ActiveFilters = ({ category, subcategory, search, sortBy, count, onReset }) => {
  const hasFilters = category !== "All" || search || subcategory;
  return (
    <div className="flex items-center justify-between mb-2 w-full">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-[#0F1111]">
          <span className="text-[#007185] font-bold">{count}</span>
          <span className="text-[#565959] ml-1.5">résultats</span>
          {category !== "All" && <span className="text-[#565959] ml-1.5">dans {category}</span>}
        </span>
        {subcategory && (
          <span className="text-xs px-2.5 py-1 rounded bg-[#FF9900]/15 text-[#C45500] border border-[#FF9900]/30 flex items-center gap-1.5">
            <i className="fa-solid fa-tag text-[10px]"></i>
            {subcategory}
          </span>
        )}
        {search && (
          <span className="text-xs px-2.5 py-1 rounded bg-[#FEBD69]/20 text-[#C45500] border border-[#FEBD69]/40 flex items-center gap-1.5">
            <i className="fa-solid fa-magnifying-glass text-[10px]"></i>
            {search}
          </span>
        )}
        {hasFilters && (
          <button onClick={onReset}
            className="text-xs text-[#007185] hover:text-[#C45500] hover:underline flex items-center gap-1 transition-colors"
          >
            <i className="fa-solid fa-xmark text-[10px]"></i> Effacer les filtres
          </button>
        )}
      </div>
      <div className="hidden md:flex items-center gap-1.5 text-xs text-[#565959]">
        <i className="fa-solid fa-location-dot text-[#FF9900] text-xs"></i>
        Douala, Cameroun
      </div>
    </div>
  );
};

/* ─────────────────── MAIN STORE PAGE ─────────────────── */
const PAGE_SIZE      = 48;
const STORE_SESS_KEY = 'ofs_store_scroll_v1';

const Store = ({ openModal, addToCart }) => {
  const [searchParams] = useSearchParams();
  const { isMember }   = useAuth();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [products,       setProducts]       = useState([]);
  const [vendors,        setVendors]        = useState([]);
  const [vendorProducts, setVendorProducts] = useState({});
  const [orderCounts,    setOrderCounts]    = useState({});
  const [categoryCounts, setCategoryCounts] = useState({});
  const [priceMax,       setPriceMax]       = useState(500000);

  // ── Pagination / loading ──────────────────────────────────────────────────
  const [loading,        setLoading]        = useState(true);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [hasMore,        setHasMore]        = useState(false);
  const [totalCount,     setTotalCount]     = useState(0);
  const [currentPage,    setCurrentPage]    = useState(0);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchInput,  setSearchInput]  = useState(searchParams.get("q") || "");
  const [searchQuery,  setSearchQuery]  = useState(searchParams.get("q") || "");
  const [category,     setCategory]     = useState("All");
  const [subcategory,  setSubcategory]  = useState(null);
  const [sortBy,       setSortBy]       = useState("recommended");
  const [maxPrice,     setMaxPrice]     = useState(null);
  const [selectedSize, setSelectedSize] = useState("All");
  const [viewMode,     setViewMode]     = useState("grid");

  const loadMoreRef       = useRef(null);
  const fetchPageRef      = useRef(null);
  const categoryCountsRef = useRef({});
  const skipFetchRef      = useRef(false);   // prevents re-fetch after session restore
  const stateRef          = useRef(null);    // latest state snapshot for unmount save
  const pendingScroll     = useRef(null);    // scroll Y to restore after render

  // Sync latest values into stateRef on every render (read at unmount)
  stateRef.current = { products, currentPage, hasMore, category, subcategory, searchQuery, sortBy, maxPrice, selectedSize, orderCounts };

  // Keep categoryCountsRef in sync so fetchPage can read latest counts without it as a dep
  useEffect(() => { categoryCountsRef.current = categoryCounts; }, [categoryCounts]);

  // ── Sync URL params → filters on first render ──────────────────────────────
  useEffect(() => {
    const t = searchParams.get("type");
    const s = searchParams.get("subcat");
    if (t) { setCategory(t); if (s) setSubcategory(s); }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session restore: retour depuis une fiche produit ────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE_SESS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      sessionStorage.removeItem(STORE_SESS_KEY);
      if (!saved || Date.now() - saved.ts > 600_000 || !saved.products?.length) return;

      skipFetchRef.current = true;
      setProducts(saved.products);
      setCurrentPage(saved.page    || 0);
      setHasMore(saved.hasMore     ?? false);
      setOrderCounts(saved.orderCounts || {});
      setLoading(false);
      if (saved.category    != null) setCategory(saved.category);
      if (saved.subcategory != null) setSubcategory(saved.subcategory);
      if (saved.searchQuery)         { setSearchQuery(saved.searchQuery); setSearchInput(saved.searchQuery); }
      if (saved.sortBy)              setSortBy(saved.sortBy);
      if (saved.maxPrice)            setMaxPrice(saved.maxPrice);
      if (saved.selectedSize)        setSelectedSize(saved.selectedSize);
      pendingScroll.current = saved.scrollY || 0;
    } catch { /* données session malformées */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch one page ─────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (pageNum, reset = false) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      let items      = [];
      let pageCounts = {};

      // "All" mixed view: parallel per-category queries ensure true diversity
      const isAllMixed = category === "All" && !searchQuery && !subcategory
                         && sortBy !== "price-asc" && sortBy !== "price-desc";

      if (isAllMixed) {
        const from = pageNum * ALL_PER_CAT;

        const catResults = await Promise.all(
          CAT_KEYS.map(async (cat) => {
            let q = supabase
              .from("products")
              .select("*, vendor:vendors!vendor_id(member_discount_enabled)")
              .eq("type", cat)
              .order("created_at", { ascending: false })
              .range(from, from + ALL_PER_CAT - 1);
            if (maxPrice !== null) q = q.lte("price", maxPrice);
            const { data } = await q;
            return data || [];
          })
        );

        // Fetch order counts for all fetched items
        const allItems = catResults.flat();
        if (allItems.length > 0) {
          const { data: oi } = await supabase
            .from("order_items")
            .select("product_id")
            .in("product_id", allItems.map(p => p.id));
          oi?.forEach(({ product_id }) => {
            pageCounts[product_id] = (pageCounts[product_id] || 0) + 1;
          });
        }

        // For "popular" / "recommended": score & sort within each category before interleaving
        if (sortBy === "popular") {
          catResults.forEach(arr => arr.sort((a, b) => (pageCounts[b.id] || 0) - (pageCounts[a.id] || 0)));
        } else if (sortBy === "recommended") {
          const score = p =>
            (pageCounts[p.id] || 0) * 10 + (p.img ? 5 : 0) +
            (Number(p.price) > 0 ? 3 : 0) + ((p.description?.length || 0) > 10 ? 1 : 0);
          catResults.forEach(arr => arr.sort((a, b) => score(b) - score(a)));
        }

        // Round-robin interleave: Cat[0][0], Cat[1][0], ..., Cat[0][1], Cat[1][1], ...
        const maxLen = Math.max(...catResults.map(r => r.length), 0);
        for (let i = 0; i < maxLen; i++) {
          for (const arr of catResults) {
            if (i < arr.length) items.push(arr[i]);
          }
        }

        const anyFull = catResults.some(r => r.length === ALL_PER_CAT);
        setHasMore(anyFull);

        // totalCount from metadata (fast — no extra query on each page flip)
        const catTotal = Object.values(categoryCountsRef.current).reduce((a, b) => a + b, 0);
        if (catTotal > 0) setTotalCount(catTotal);

      } else {
        // ── Standard single-query path ──────────────────────────────────────
        let q = supabase
          .from("products")
          .select("*, vendor:vendors!vendor_id(member_discount_enabled)", { count: "exact" });

        if (category !== "All") q = q.eq("type", category);
        if (subcategory)        q = q.eq("subcategory", subcategory);
        if (searchQuery)        q = q.ilike("name", `%${searchQuery}%`);
        if (maxPrice !== null)  q = q.lte("price", maxPrice);

        if (sortBy === "price-asc")       q = q.order("price", { ascending: true });
        else if (sortBy === "price-desc") q = q.order("price", { ascending: false });
        else                              q = q.order("created_at", { ascending: false });

        const from = pageNum * PAGE_SIZE;
        const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
        if (error) throw error;

        items = data || [];

        if (items.length > 0) {
          const { data: oi } = await supabase
            .from("order_items")
            .select("product_id")
            .in("product_id", items.map(p => p.id));
          oi?.forEach(({ product_id }) => {
            pageCounts[product_id] = (pageCounts[product_id] || 0) + 1;
          });
        }

        // Client-sort for recommended / popular on this page
        if (sortBy === "popular") {
          items = [...items].sort((a, b) => (pageCounts[b.id] || 0) - (pageCounts[a.id] || 0));
        } else if (sortBy === "recommended") {
          const score = p =>
            (pageCounts[p.id] || 0) * 10 + (p.img ? 5 : 0) +
            (Number(p.price) > 0 ? 3 : 0) + ((p.description?.length || 0) > 10 ? 1 : 0);
          items = [...items].sort((a, b) => score(b) - score(a));
        }

        setHasMore(from + PAGE_SIZE < (count || 0));
        setTotalCount(count || 0);
      }

      setProducts(prev => reset ? items : [...prev, ...items]);
      setOrderCounts(prev => ({ ...prev, ...pageCounts }));
      setCurrentPage(pageNum);
    } catch (err) {
      console.error("[Store]", err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [category, subcategory, searchQuery, sortBy, maxPrice]);

  useEffect(() => { fetchPageRef.current = fetchPage; }, [fetchPage]);

  // ── Metadata init: lightweight queries, no product rows ──────────────────
  useEffect(() => {
    const init = async () => {
      // Use count-only queries per type to avoid the 1000-row Supabase default limit
      const TYPES = ["Audio Lab","Tech Lab","Femme","Clothing","Shoes","Beauté","Accessories","Maison","Sport","Bébé & Enfants","Auto"];
      const [countResults, { data: maxPData }, { data: vData }] = await Promise.all([
        Promise.all(TYPES.map(t =>
          supabase.from("products").select("*", { count: "exact", head: true }).eq("type", t)
            .then(({ count }) => ({ type: t, count: count || 0 }))
        )),
        supabase.from("products").select("price").order("price", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("vendors").select("*").eq("is_active", true),
      ]);

      const counts = {};
      countResults.forEach(({ type, count }) => { if (count > 0) counts[type] = count; });
      setCategoryCounts(counts);
      if (maxPData?.price) setPriceMax(maxPData.price);

      setVendors(vData || []);
      setVendorsLoading(false);

      if (vData?.length) {
        const map = {};
        await Promise.all(vData.slice(0, 8).map(async v => {
          const { data: vp } = await supabase
            .from("products").select("id, img, type").eq("vendor_id", v.id).limit(3);
          map[v.id] = vp || [];
        }));
        setVendorProducts(map);
      }
    };
    init();
  }, []);

  // Re-fetch from page 0 when any filter changes (skip after session restore)
  useEffect(() => {
    if (skipFetchRef.current) { skipFetchRef.current = false; return; }
    fetchPage(0, true);
  }, [fetchPage]);

  // ── Infinite scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading && !loadingMore)
          fetchPageRef.current?.(currentPage + 1, false);
      },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, currentPage]);

  // ── Restaurer le scroll après la session restore ────────────────────────
  useEffect(() => {
    if (pendingScroll.current === null || products.length === 0) return;
    const y = pendingScroll.current;
    pendingScroll.current = null;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [products.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sauvegarder l'état au démontage (navigation vers fiche produit) ──────
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      if (!s?.products?.length) return;
      try {
        sessionStorage.setItem(STORE_SESS_KEY, JSON.stringify({
          ...s, scrollY: window.scrollY, ts: Date.now(),
        }));
      } catch { /* quota dépassé, on ignore */ }
    };
  }, []);

  const handleSearch         = () => setSearchQuery(searchInput);
  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setSubcategory(null);
    // "recent" makes no sense when mixing all categories
    if (cat === "All" && sortBy === "recent") setSortBy("recommended");
  };
  const handleSubcategorySelect = (cat, sub) => {
    setCategory(cat);
    setSubcategory(sub);
  };
  const handleReset = () => {
    setSearchInput(""); setSearchQuery(""); setCategory("All");
    setSubcategory(null); setSelectedSize("All"); setMaxPrice(null);
    setSortBy("recommended");
  };

  const visibleProducts = useMemo(
    () => selectedSize === "All" ? products : products.filter(p => p.type === "Clothing" || p.type === "Shoes"),
    [products, selectedSize]
  );

  const sliderValue    = maxPrice ?? priceMax;
  const activeSortOpts = category === "All" ? SORT_OPTIONS_ALL : SORT_OPTIONS;

  return (
    <div className="min-h-screen bg-[#EAEDED] text-[#0F1111]">

      {/* ── HERO ── */}
      <MarketplaceHero
        totalProducts={totalCount || Object.values(categoryCounts).reduce((a, b) => a + b, 0)}
        searchQuery={searchInput}
        setSearchQuery={setSearchInput}
        onSearch={handleSearch}
      />
      <TrustStrip />

      {/* ── SPONSORED ── */}
      <SponsoredBanner />

      {/* ── PROMO BANNERS ── */}
      <PromoBanners />

      {/* ── VENDORS ── */}
      <VendorsSection vendors={vendors} loading={vendorsLoading} vendorProducts={vendorProducts} />

      {/* ── CATEGORY TABS ── */}
      <CategoryTabs active={category} onChange={handleCategoryChange} counts={categoryCounts} />

      {/* ── SUBCATEGORY PILLS (specific category only) ── */}
      <SubcategoryPills category={category} active={subcategory} onChange={setSubcategory} />

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-[1400px] mx-auto px-2 md:px-3 py-2">
        <div className="flex gap-3">

          {/* SIDEBAR */}
          <div className="hidden lg:block sticky top-[128px] self-start max-h-[calc(100vh-148px)] overflow-y-auto">
            <SidebarFilters
              maxPrice={sliderValue}
              setMaxPrice={setMaxPrice}
              priceMax={priceMax}
              sortBy={sortBy}
              setSortBy={setSortBy}
              selectedSize={selectedSize}
              setSelectedSize={setSelectedSize}
              category={category}
              subcategory={subcategory}
              sortOptions={activeSortOpts}
              categoryCounts={categoryCounts}
              onCategorySelect={handleCategoryChange}
              onSetSubcategory={setSubcategory}
            />
          </div>

          {/* PRODUCTS AREA */}
          <div className="flex-1 min-w-0">

            {/* TOOLBAR */}
            <div className="flex items-center justify-between mb-2 gap-4">
              <ActiveFilters
                category={category}
                subcategory={subcategory}
                search={searchQuery}
                sortBy={sortBy}
                count={totalCount}
                onReset={handleReset}
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="lg:hidden appearance-none bg-white border border-[#D5D9D9] rounded px-3 py-2 text-xs text-[#0F1111] outline-none focus:border-[#FF9900] cursor-pointer"
                >
                  {activeSortOpts.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <div className="flex bg-white border border-[#D5D9D9] rounded overflow-hidden">
                  {["grid", "list"].map(m => (
                    <button key={m} onClick={() => setViewMode(m)}
                      className={`px-3 py-2 transition-all ${viewMode === m ? "bg-[#232F3E] text-[#FF9900]" : "text-[#565959] hover:text-[#0F1111] hover:bg-[#F3F4F4]"}`}
                    >
                      <i className={`fa-solid ${m === "grid" ? "fa-grid-2" : "fa-list"} text-xs`}></i>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SUBCATEGORY BROWSE GRID — visible in "All" when no active subcategory/search */}
            {category === "All" && !subcategory && !searchQuery && !loading && (
              <SubcategoryBrowse
                onSubcategorySelect={handleSubcategorySelect}
              />
            )}

            {/* PRODUCTS */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
                {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-[#D5D9D9] rounded bg-white">
                <i className="fa-solid fa-box-open text-4xl text-[#D5D9D9] mb-4 block"></i>
                <p className="font-bold text-[#565959] text-lg mb-2">Aucun produit trouvé</p>
                <p className="text-[#565959] text-sm mb-6">Essayez de modifier vos filtres</p>
                <button onClick={handleReset}
                  className="bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] text-[#0F1111] px-6 py-2.5 rounded font-medium text-sm transition-colors"
                >Réinitialiser les filtres</button>
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-3">
                {visibleProducts.map(product => {
                  const isMemberPrice = isMember && (product.vendor?.member_discount_enabled || product.vendor_member_discount_enabled);
                  const displayPrice  = isMemberPrice ? Math.round(product.price * 0.8) : product.price;
                  return (
                    <div key={product.id}
                      className="bg-white border border-[#D5D9D9] rounded p-4 flex items-center gap-4 group hover:border-[#FF9900] hover:shadow-md transition-all cursor-pointer"
                      onClick={() => openModal(product)}
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-50">
                        <img src={product.img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#CC0C39] text-white">{product.status}</span>
                          <span className="text-[10px] text-[#007185]">{product.type}</span>
                          {product.subcategory && (
                            <span className="text-[10px] text-[#565959] border border-[#D5D9D9] px-1.5 py-0.5 rounded">{product.subcategory}</span>
                          )}
                        </div>
                        <h3 className="font-medium text-[#0F1111] truncate text-sm group-hover:text-[#C45500] transition-colors">{product.name}</h3>
                        {product.features?.length > 0 && (
                          <p className="text-xs text-[#565959] truncate mt-0.5">{product.features.slice(0, 2).join(" · ")}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-[#B12704] text-base leading-none">
                            {Number(isMemberPrice ? displayPrice : product.price).toLocaleString()} F
                          </p>
                          {isMemberPrice && <p className="text-xs text-[#565959] line-through">{Number(product.price).toLocaleString()} F</p>}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); addToCart({ ...product, selectedSize: "M", selectedColor: "Black", quantity: 1 }); }}
                          className="px-3 py-1.5 bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] text-[#0F1111] rounded text-sm font-medium transition-colors"
                        >+ Panier</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {visibleProducts.map((product, idx) => (
                  <React.Fragment key={product.id}>
                    {idx > 0 && idx % 24 === 0 && (
                      <div className="col-span-full">
                        <SectionBreak
                          section={EDITORIAL_SECTIONS[(idx / 24 - 1) % EDITORIAL_SECTIONS.length]}
                          onNavigate={handleSubcategorySelect}
                        />
                      </div>
                    )}
                    <ProductCard product={product} openModal={openModal} addToCart={addToCart} />
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* INFINITE SCROLL SENTINEL */}
            <div ref={loadMoreRef} className="mt-4">
              {loadingMore && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
                  {Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)}
                </div>
              )}
              {!hasMore && !loading && visibleProducts.length > 0 && (
                <div className="mt-8 flex items-center justify-center gap-2 text-sm text-[#565959]">
                  <i className="fa-solid fa-check-circle text-[#FF9900]"></i>
                  <span>Tous les {totalCount} produits affichés</span>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── BOTTOM CTA STRIP ── */}
      <div className="bg-zinc-800 py-12 px-4 md:px-8 mt-8">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <span className="text-primary font-black text-[9px] uppercase tracking-[0.4em] block mb-2">OneFreestyle Elite</span>
            <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white leading-tight">
              Vends tes produits sur<br />la marketplace <span className="text-primary">#1</span> de Douala
            </h3>
            <p className="text-zinc-500 font-bold text-sm mt-3">Dashboard vendeur · Notifications temps réel · Boutique personnalisée</p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3">
            <Link to="/register" className="flex items-center justify-center gap-2 bg-primary text-black px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all hover:scale-105">
              <i className="fa-solid fa-store"></i><span>Ouvrir ma boutique</span>
            </Link>
            <Link to="/login" className="flex items-center justify-center gap-2 bg-white/10 border border-white/15 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-primary/50 hover:text-primary transition-all">
              <i className="fa-solid fa-right-to-bracket"></i><span>Espace vendeur</span>
            </Link>
          </div>
        </div>
      </div>

      <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
    </div>
  );
};

export default Store;
