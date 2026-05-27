import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { supabase } from "../lib/supabase";
import ofsLogo from "../assets/ofs.png";
import { useAuth } from "../context/AuthContext";

/* ─────────────────── CONSTANTS ─────────────────── */
const CATEGORIES = [
  { key: "All", label: "Tout voir", icon: "fa-grid-2", color: "#00ff88" },
  {
    key: "Audio Lab",
    label: "Audio Lab",
    icon: "fa-headphones",
    color: "#00ff88",
  },
  { 
    key: 'Femme', 
    label: 'Pour Elle', 
    icon: 'fa-person-dress', 
    color: '#ec4899' 
  },
  { key: "Clothing", label: "Streetwear", icon: "fa-shirt", color: "#a855f7" },
  { key: "Shoes", label: "Sneakers", icon: "fa-shoe-prints", color: "#f97316" },
  {
    key: "Tech Lab",
    label: "Tech Lab",
    icon: "fa-microchip",
    color: "#3b82f6",
  },
  {
    key: "Fragrance",
    label: "Parfums",
    icon: "fa-spray-can-sparkles",
    color: "#ec4899",
  },
  {
    key: "Accessories",
    label: "Accessoires",
    icon: "fa-gem",
    color: "#eab308",
  },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Plus récents" },
  { value: "popular", label: "Populaires" },
  { value: "price-asc", label: "Prix croissant" },
  { value: "price-desc", label: "Prix décroissant" },
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
const MarketplaceHero = ({
  totalProducts,
  searchQuery,
  setSearchQuery,
  onSearch,
}) => {
  return (
    <div className="bg-[#232F3E] py-8 md:py-10 px-4 md:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="max-w-2xl">
          <p className="text-[#FF9900] text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <i className="fa-solid fa-store text-sm"></i>
            {totalProducts}+ produits · Douala 🇨🇲
          </p>
          <h1 className="text-2xl md:text-4xl font-black text-white mb-1">
            La Marketplace <span className="text-[#FF9900]">Elite</span> de Douala
          </h1>
          <p className="text-gray-400 text-sm mb-5">
            Audio, Streetwear, Tech & plus — boutiques certifiées, livraison express, paiement sécurisé.
          </p>

          {/* SEARCH BAR — Amazon style */}
          <div className="flex h-11 rounded overflow-hidden ring-2 ring-[#FF9900] shadow-lg">
            <select className="bg-[#F3F4F4] text-[#0F1111] text-[11px] px-2 border-r border-[#CDCDCD] outline-none cursor-pointer flex-shrink-0 font-medium min-w-[60px]">
              <option>Tout</option>
              <option>Audio</option>
              <option>Streetwear</option>
              <option>Sneakers</option>
              <option>Tech</option>
              <option>Parfums</option>
            </select>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="Casque, sneakers, parfum, tech..."
              className="flex-grow bg-white text-[#0F1111] px-4 text-sm outline-none min-w-0"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                className="bg-white px-2 text-gray-400 hover:text-gray-700 transition"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            )}
            <button onClick={onSearch}
              className="bg-[#FF9900] hover:bg-[#E47911] text-[#0F1111] px-5 flex items-center gap-2 transition-colors flex-shrink-0"
            >
              <i className="fa-solid fa-magnifying-glass text-base"></i>
              <span className="hidden md:inline font-bold text-sm">Rechercher</span>
            </button>
          </div>

          {/* QUICK TAGS */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-gray-500">Tendances:</span>
            {["AirPods", "Sneakers", "Casque", "Hoodies"].map((tag) => (
              <button key={tag} onClick={() => setSearchQuery(tag)}
                className="text-xs px-3 py-1 rounded-full bg-white/10 text-gray-300 hover:bg-[#FF9900] hover:text-[#0F1111] transition-all border border-white/20 hover:border-[#FF9900]"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
          {[
            { icon: "fa-store",        val: "5+",   label: "Boutiques Certifiées", color: "text-[#FF9900]"  },
            { icon: "fa-truck-fast",   val: "2h",   label: "Livraison Douala",     color: "text-blue-400"  },
            { icon: "fa-shield-check", val: "100%", label: "Paiement Sécurisé",    color: "text-green-400" },
            { icon: "fa-rotate-left",  val: "7j",   label: "Retour Gratuit",       color: "text-purple-400"},
          ].map((item) => (
            <div key={item.label}
              className="bg-white/5 border border-white/10 rounded p-4 flex items-center gap-3 hover:border-white/20 transition-colors"
            >
              <div className="w-9 h-9 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
                <i className={`fa-solid ${item.icon} ${item.color} text-sm`}></i>
              </div>
              <div>
                <p className={`font-black text-lg leading-none ${item.color}`}>{item.val}</p>
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">{item.label}</p>
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
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 px-4 md:px-8 max-w-[1400px] mx-auto">
    {PROMO_BANNERS.map((b, i) => (
      <Link
        key={i}
        to="/store"
        className="bg-white border border-[#D5D9D9] hover:border-[#FF9900] hover:shadow-md rounded p-4 flex items-center gap-4 group transition-all"
      >
        <div className="flex-1">
          <span
            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded mb-2 inline-block"
            style={{ backgroundColor: `${b.color}15`, color: b.color }}
          >
            {b.tag}
          </span>
          <h3 className="font-bold text-base text-[#0F1111] group-hover:text-[#C45500] transition-colors">
            {b.title}
          </h3>
          <p className="text-[11px] text-[#565959] mt-0.5">{b.sub}</p>
          <p className="text-[#007185] text-xs mt-1.5 group-hover:text-[#C45500] group-hover:underline transition-colors">
            Voir les offres →
          </p>
        </div>
        <div className="w-20 h-20 rounded overflow-hidden flex-shrink-0">
          <img
            src={b.img}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      </Link>
    ))}
  </div>
);

/* ─────────────────── VENDORS SECTION ─────────────────── */
const VendorsSection = ({ vendors, loading, vendorProducts }) => {
  if (!loading && vendors.length === 0) return null;

  return (
    <div className="bg-white border-y border-[#D5D9D9] py-6 px-4 md:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-[#0F1111]">
              Boutiques <span className="text-[#FF9900]">Certifiées</span>
            </h2>
            <p className="text-xs text-[#565959]">Vendeurs vérifiés OneFreestyle</p>
          </div>
          <Link to="/register"
            className="hidden md:flex items-center gap-1.5 text-sm text-[#007185] hover:text-[#C45500] hover:underline transition-colors"
          >
            <span>Devenir vendeur</span>
            <i className="fa-solid fa-arrow-right text-xs"></i>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <VendorSkeleton key={i} />
              ))
            : vendors.map((vendor) => {
                const vProducts = vendorProducts[vendor.id] || [];
                const categories = [...new Set(vProducts.map((p) => p.type))];
                return (
                  <Link
                    key={vendor.id}
                    to={`/shop/${vendor.shop_name}`}
                    className="bg-white border border-[#D5D9D9] rounded p-4 group hover:border-[#FF9900] hover:shadow-md transition-all duration-300"
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
                        <p className="text-[9px] font-bold text-zinc-400 uppercase truncate">
                          {vendor.full_name}
                        </p>
                      </div>
                    </div>

                    {/* PRODUCT PREVIEW */}
                    {vProducts.length > 0 ? (
                      <div className="grid grid-cols-3 gap-1.5 mb-3">
                        {vProducts.slice(0, 3).map((p, i) => (
                          <div
                            key={i}
                            className="aspect-square rounded-lg overflow-hidden bg-zinc-50"
                          >
                            <img
                              src={p.img}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-16 bg-zinc-50 rounded-xl flex items-center justify-center mb-3">
                        <p className="text-[9px] font-bold text-zinc-300 uppercase">
                          Bientôt disponible
                        </p>
                      </div>
                    )}

                    {/* META */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[9px] font-black uppercase text-zinc-400">
                        <span>
                          <i className="fa-solid fa-box text-primary mr-1"></i>
                          {vProducts.length} items
                        </span>
                        <div className="flex items-center gap-0.5">
                          <i className="fa-solid fa-star text-yellow-400 text-[8px]"></i>
                          <span className="text-zinc-500">4.8</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-black uppercase text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Voir{" "}
                        <i className="fa-solid fa-arrow-right text-[8px]"></i>
                      </span>
                    </div>

                    {/* CATEGORIES PILLS */}
                    {categories.length > 0 && (
                      <div className="flex gap-1 mt-3 flex-wrap">
                        {categories.slice(0, 2).map((cat) => (
                          <span
                            key={cat}
                            className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-zinc-50 text-zinc-400 border border-zinc-100"
                          >
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
              })}

          {/* BECOME VENDOR CTA */}
          {!loading && (
            <Link to="/register"
              className="bg-[#FFF8F0] border-2 border-dashed border-[#FEBD69] rounded p-4 flex flex-col items-center justify-center gap-3 group hover:border-[#FF9900] hover:bg-[#FFF0D0] transition-all min-h-[160px]"
            >
              <div className="w-12 h-12 bg-[#FF9900]/10 rounded flex items-center justify-center group-hover:bg-[#FF9900]/20 transition-colors">
                <i className="fa-solid fa-plus text-[#FF9900] text-xl"></i>
              </div>
              <div className="text-center">
                <p className="font-bold text-sm text-[#0F1111] group-hover:text-[#C45500] transition-colors">
                  Ouvre ta boutique
                </p>
                <p className="text-xs text-[#565959] mt-0.5">
                  Rejoindre la marketplace Elite
                </p>
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
    <div className="sticky top-[128px] md:top-[128px] z-30 bg-white border-b border-[#D5D9D9] shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <div
          ref={scrollRef}
          className="flex items-center gap-1 overflow-x-auto hide-scrollbar py-2.5"
        >
          {CATEGORIES.map((cat) => {
            const count =
              cat.key === "All"
                ? Object.values(counts).reduce((a, b) => a + b, 0)
                : counts[cat.key] || 0;
            const isActive = active === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => onChange(cat.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded text-[12px] font-medium whitespace-nowrap transition-all flex-shrink-0 border ${
                  isActive
                    ? "bg-[#232F3E] text-white border-[#232F3E]"
                    : "bg-white text-[#0F1111] border-[#D5D9D9] hover:border-[#FF9900] hover:bg-[#FFF8F0]"
                }`}
              >
                <i
                  className={`fa-solid ${cat.icon} text-xs`}
                  style={{ color: isActive ? "#FF9900" : cat.color }}
                ></i>
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5 ${
                    isActive
                      ? "bg-[#FF9900]/20 text-[#FF9900]"
                      : "bg-[#F3F4F4] text-[#565959]"
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
const SidebarFilters = ({
  maxPrice,
  setMaxPrice,
  priceMax,
  sortBy,
  setSortBy,
  selectedSize,
  setSelectedSize,
  category,
}) => (
  <aside className="w-52 flex-shrink-0 space-y-4">
    {/* SORT */}
    <div className="bg-white border border-[#D5D9D9] rounded p-4">
      <h4 className="text-xs font-bold uppercase text-[#565959] mb-3 flex items-center gap-2">
        <i className="fa-solid fa-sort text-[#FF9900] text-xs"></i>Trier par
      </h4>
      <div className="space-y-0.5">
        {SORT_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => setSortBy(opt.value)}
            className={`w-full text-left text-[12px] px-3 py-2 rounded transition-all ${
              sortBy === opt.value
                ? "bg-[#232F3E] text-[#FF9900] font-bold"
                : "text-[#565959] hover:bg-[#F3F4F4] hover:text-[#0F1111]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>

    {/* PRICE RANGE */}
    <div className="bg-white border border-[#D5D9D9] rounded p-4">
      <h4 className="text-xs font-bold uppercase text-[#565959] mb-3 flex items-center gap-2">
        <i className="fa-solid fa-tag text-[#FF9900] text-xs"></i>Budget Max
      </h4>
      <div className="mb-3">
        <span className="text-lg font-bold text-[#B12704]">
          {Number(maxPrice).toLocaleString()}
        </span>
        <span className="text-xs text-[#565959] ml-1">FCFA</span>
      </div>
      <input
        type="range"
        min="0"
        max={priceMax}
        step="5000"
        value={maxPrice}
        onChange={(e) => setMaxPrice(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: "#FF9900" }}
      />
      <div className="flex justify-between text-[10px] text-[#565959] mt-1">
        <span>0</span>
        <span>{priceMax.toLocaleString()} F</span>
      </div>
    </div>

    {/* SIZE */}
    {(category === "Clothing" ||
      category === "Shoes" ||
      category === "All") && (
      <div className="bg-white border border-[#D5D9D9] rounded p-4">
        <h4 className="text-xs font-bold uppercase text-[#565959] mb-3 flex items-center gap-2">
          <i className="fa-solid fa-ruler text-[#FF9900] text-xs"></i>Taille
        </h4>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            "All",
            ...(category === "Shoes"
              ? ["40", "41", "42", "43", "44"]
              : ["XS", "S", "M", "L", "XL"]),
          ].map((s) => (
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

    {/* INFO CARD */}
    <div className="bg-[#FFF8F0] border border-[#FEBD69]/40 rounded p-4">
      <i className="fa-solid fa-tag text-[#FF9900] text-lg mb-2 block"></i>
      <h4 className="font-bold text-sm text-[#0F1111] mb-1">Bundle Deal</h4>
      <p className="text-xs text-[#565959]">
        −15% automatiquement à partir de 2 articles dans le panier
      </p>
      <div className="mt-3 bg-[#FF9900] text-[#0F1111] text-xs font-bold px-3 py-1.5 rounded inline-flex items-center gap-1.5">
        <i className="fa-solid fa-check text-[10px]"></i>
        Actif sur tous les achats
      </div>
    </div>
  </aside>
);

/* ─────────────────── ACTIVE FILTERS BAR ─────────────────── */
const ActiveFilters = ({ category, search, sortBy, count, onReset }) => {
  const hasFilters = category !== "All" || search;
  return (
    <div className="flex items-center justify-between mb-4 w-full">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-[#0F1111]">
          <span className="text-[#007185] font-bold">{count}</span>
          <span className="text-[#565959] ml-1.5">
            résultats
          </span>
          {category !== "All" && (
            <span className="text-[#565959] ml-1.5">dans {category}</span>
          )}
        </span>
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
const Store = ({ openModal, addToCart }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isMember } = useAuth();

  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorProducts, setVendorProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [vendorsLoading, setVendorsLoading] = useState(true);

  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("recent");
  const [maxPrice, setMaxPrice] = useState(500000);
  const [selectedSize, setSelectedSize] = useState("All");
  const [viewMode, setViewMode] = useState("grid");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setVendorsLoading(true);
      try {
        // Products
        const { data: pData } = await supabase
          .from("products")
          .select("*, vendor:vendors!vendor_id(member_discount_enabled)") // Jointure ajoutée ici
          .order("created_at", { ascending: false });
        setProducts(pData || []);

        // Vendors
        const { data: vData } = await supabase
          .from("vendors")
          .select("*")
          .eq("is_active", true);
        setVendors(vData || []);
        setVendorsLoading(false);

        // Map products to vendors
        if (vData && pData) {
          const map = {};
          vData.forEach((v) => {
            map[v.id] = pData.filter((p) => p.vendor_id === v.id).slice(0, 6);
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

  const priceMax = Math.max(
    ...products.map((p) => Number(p.price || 0)),
    500000
  );

  const categoryCounts = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      counts[p.type] = (counts[p.type] || 0) + 1;
    });
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => category === "All" || p.type === category)
      .filter(
        (p) =>
          !searchQuery ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter((p) => Number(p.price) <= maxPrice)
      .filter((p) => {
        if (selectedSize === "All") return true;
        return p.type === "Clothing" || p.type === "Shoes";
      })
      .sort((a, b) => {
        if (sortBy === "price-asc") return Number(a.price) - Number(b.price);
        if (sortBy === "price-desc") return Number(b.price) - Number(a.price);
        return 0;
      });
  }, [products, category, searchQuery, maxPrice, selectedSize, sortBy]);

  const handleSearch = () => setSearchQuery(searchInput);

  const handleReset = () => {
    setSearchInput("");
    setSearchQuery("");
    setCategory("All");
    setSelectedSize("All");
    setMaxPrice(priceMax);
  };

  return (
    <div className="min-h-screen bg-[#EAEDED] text-[#0F1111]">
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
      <VendorsSection
        vendors={vendors}
        loading={vendorsLoading}
        vendorProducts={vendorProducts}
      />

      {/* ── CATEGORY TABS ── */}
      <CategoryTabs
        active={category}
        onChange={setCategory}
        counts={categoryCounts}
      />

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">
        <div className="flex gap-8">
          {/* SIDEBAR */}
          <div className="hidden lg:block sticky top-[128px] self-start max-h-[calc(100vh-148px)] overflow-y-auto">
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
                  onChange={(e) => setSortBy(e.target.value)}
                  className="lg:hidden appearance-none bg-white border border-[#D5D9D9] rounded px-3 py-2 text-xs text-[#0F1111] outline-none focus:border-[#FF9900] cursor-pointer"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* VIEW TOGGLE */}
                <div className="flex bg-white border border-[#D5D9D9] rounded overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`px-3 py-2 transition-all ${
                      viewMode === "grid"
                        ? "bg-[#232F3E] text-[#FF9900]"
                        : "text-[#565959] hover:text-[#0F1111] hover:bg-[#F3F4F4]"
                    }`}
                  >
                    <i className="fa-solid fa-grid-2 text-xs"></i>
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-2 transition-all ${
                      viewMode === "list"
                        ? "bg-[#232F3E] text-[#FF9900]"
                        : "text-[#565959] hover:text-[#0F1111] hover:bg-[#F3F4F4]"
                    }`}
                  >
                    <i className="fa-solid fa-list text-xs"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* PRODUCTS */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-[#D5D9D9] rounded bg-white">
                <i className="fa-solid fa-box-open text-4xl text-[#D5D9D9] mb-4 block"></i>
                <p className="font-bold text-[#565959] text-lg mb-2">
                  Aucun produit trouvé
                </p>
                <p className="text-[#565959] text-sm mb-6">
                  Essayez de modifier vos filtres
                </p>
                <button onClick={handleReset}
                  className="bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] text-[#0F1111] px-6 py-2.5 rounded font-medium text-sm transition-colors"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-3">
                {filteredProducts.map((product) => {
                  // AJOUTEZ CES DEUX LIGNES ICI
                  const isMemberPrice =
                    isMember &&
                    (product.vendor?.member_discount_enabled ||
                      product.vendor_member_discount_enabled);
                  const displayPrice = isMemberPrice
                    ? Math.round(product.price * 0.8)
                    : product.price;

                  return (
                    <div
                      key={product.id}
                      className="bg-white border border-[#D5D9D9] rounded p-4 flex items-center gap-4 group hover:border-[#FF9900] hover:shadow-md transition-all cursor-pointer"
                      onClick={() => openModal(product)}
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-50">
                        <img
                          src={product.img}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#CC0C39] text-white">
                            {product.status}
                          </span>
                          <span className="text-[10px] text-[#007185]">
                            {product.type}
                          </span>
                        </div>
                        <h3 className="font-medium text-[#0F1111] truncate text-sm group-hover:text-[#C45500] transition-colors">
                          {product.name}
                        </h3>
                        {product.features?.length > 0 && (
                          <p className="text-xs text-[#565959] truncate mt-0.5">
                            {product.features.slice(0, 2).join(" · ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-[#B12704] text-base leading-none">
                            {Number(isMemberPrice ? displayPrice : product.price).toLocaleString()} F
                          </p>
                          {isMemberPrice && (
                            <p className="text-xs text-[#565959] line-through">
                              {Number(product.price).toLocaleString()} F
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart({
                              ...product,
                              price: product.price,
                              selectedSize: "M",
                              selectedColor: "Black",
                              quantity: 1,
                            });
                          }}
                          className="px-3 py-1.5 bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] text-[#0F1111] rounded text-sm font-medium transition-colors"
                        >
                          + Panier
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    openModal={openModal}
                    addToCart={addToCart}
                  />
                ))}
              </div>
            )}

            {/* RESULTS FOOTER */}
            {!loading && filteredProducts.length > 0 && (
              <div className="mt-8 flex items-center justify-center gap-2 text-sm text-[#565959]">
                <i className="fa-solid fa-check-circle text-[#FF9900]"></i>
                <span>Tous les {filteredProducts.length} produits affichés</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM CTA STRIP ── */}
      <div className="bg-zinc-800 py-12 px-4 md:px-8 mt-8">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <span className="text-primary font-black text-[9px] uppercase tracking-[0.4em] block mb-2">
              OneFreestyle Elite
            </span>
            <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white leading-tight">
              Vends tes produits sur
              <br />
              la marketplace <span className="text-primary">#1</span> de Douala
            </h3>
            <p className="text-zinc-500 font-bold text-sm mt-3">
              Dashboard vendeur · Notifications temps réel · Boutique
              personnalisée
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
