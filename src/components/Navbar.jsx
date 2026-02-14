import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ofsLogo from "../assets/ofs.png";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const CATEGORIES = [
  {
    name: "Audio",
    shortName: "Audio",
    icon: "fa-headphones",
    color: "text-primary",
    subs: [
      "Audio Lab",
      "Casques & Écouteurs",
      "Enceintes",
      "AirPods",
      "Wireless",
    ],
  },
  {
    name: "Tech Lab",
    shortName: "Tech",
    icon: "fa-microchip",
    color: "text-blue-400",
    subs: ["VR & AR", "Accessoires", "Gadgets", "Smart Watch", "Cables"],
  },
  {
    name: "Streetwear",
    shortName: "Street",
    icon: "fa-shirt",
    color: "text-purple-400",
    subs: ["T-Shirts", "Hoodies", "Vestes", "Shorts", "Accessoires"],
  },
  {
    name: "Sneakers",
    shortName: "Shoes",
    icon: "fa-shoe-prints",
    color: "text-orange-400",
    subs: ["Baskets", "Running", "Casual", "High-Top", "Limited"],
  },
  {
    name: "Parfums",
    shortName: "Parfum",
    icon: "fa-spray-can-sparkles",
    color: "text-pink-400",
    subs: ["Homme", "Femme", "Unisex", "Travel Size", "Gift Set"],
  },
  {
    name: "Flash Deals",
    shortName: "Deals",
    icon: "fa-bolt",
    color: "text-yellow-400",
    subs: ["Moins de 10K", "Moins de 25K", "Meilleures Ventes", "Nouveautés"],
  },
];

const ADS = [
  { text: "LIVRAISON GRATUITE — 1 MOIS !", color: "text-primary" },
  { text: "AIRPODS PRO 2 : 6.000 FCFA", color: "text-white" },
  { text: "-15% BUNDLE (MIN. 2 ARTICLES)", color: "text-yellow-400" },
  { text: "STUDIO LAB — PERSO TON ÉQUIPEMENT", color: "text-primary" },
];

const Navbar = ({
  isDark,
  toggleTheme,
  cartCount,
  toggleCart,
  toggleVisualSearch,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);

  const prevCartCount = useRef(cartCount);
  const closeTimer = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (cartCount !== prevCartCount.current && cartCount > 0) {
      setCartBump(true);
      setTimeout(() => setCartBump(false), 400);
    }
    prevCartCount.current = cartCount;
  }, [cartCount]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMegaMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      navigate("/store?q=" + encodeURIComponent(searchQuery.trim()));
      setSearchQuery("");
      setMobileMenuOpen(false);
    }
  };

  const handleCategoryHover = (idx) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveCategory(idx);
    setMegaMenuOpen(true);
  };

  const handleMegaLeave = () => {
    closeTimer.current = setTimeout(() => {
      setMegaMenuOpen(false);
      setActiveCategory(null);
    }, 200);
  };

  return (
    <>
      <ScrollToTop />

      {/* TICKER: h-8 mobile (32px) / h-10 desktop (40px) */}
      <div className="fixed top-0 left-0 right-0 z-[120] h-8 md:h-10 bg-black border-b border-white/10 overflow-hidden flex items-center">
        <div className="ofs-ticker flex items-center whitespace-nowrap">
          {[...ADS, ...ADS, ...ADS, ...ADS].map((ad, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-3 px-8 shrink-0"
            >
              <span
                className={
                  "text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] " +
                  ad.color
                }
              >
                {ad.text}
              </span>
              <span className="text-primary/40 font-black">///</span>
            </span>
          ))}
        </div>
      </div>

      {/* NAVBAR: top-8 mobile / top-10 desktop. 2 rows mobile, 1 row desktop */}
      <nav className="fixed left-0 right-0 z-[110] bg-black border-b border-white/5 top-8 md:top-10">
        {/* ROW 1: Logo + [Search desktop] + Actions */}
        <div className="h-12 md:h-16 flex items-center gap-2 md:gap-4 px-3 sm:px-4 md:px-8 max-w-[1600px] mx-auto">
          {/* LOGO */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0 group">
            <img
              src={ofsLogo}
              alt="OFS"
              className="w-7 h-7 md:w-9 md:h-9 flex-shrink-0 drop-shadow-[0_0_8px_rgba(0,255,136,0.35)] group-hover:scale-110 transition-transform"
            />
            <div className="hidden min-[380px]:flex flex-col border-l border-primary/30 pl-2">
              <span className="logo-font font-black text-[10px] sm:text-[11px] md:text-sm leading-none tracking-tighter uppercase text-white whitespace-nowrap">
                OneFree<span className="text-primary italic">Style</span>
              </span>
              <span className="hidden sm:block text-[5px] md:text-[6px] font-black tracking-[0.3em] text-primary uppercase">
                Elite Market
              </span>
            </div>
          </Link>

          {/* SEARCH desktop */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex flex-grow max-w-2xl"
          >
            <div
              className={
                "flex items-center w-full bg-zinc-900 border-2 rounded-xl overflow-hidden transition-all duration-300 " +
                (searchFocused
                  ? "border-primary shadow-[0_0_16px_rgba(0,255,136,0.2)]"
                  : "border-white/10 hover:border-white/20")
              }
            >
              <i className="fa-solid fa-magnifying-glass text-zinc-500 text-sm ml-4 flex-shrink-0"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Rechercher un produit, une marque..."
                className="flex-grow bg-transparent px-3 py-2.5 text-sm font-bold text-white placeholder-zinc-500 outline-none min-w-0"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-zinc-500 hover:text-white pr-2 transition"
                >
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              )}
              <button
                type="button"
                onClick={toggleVisualSearch}
                title="Recherche par image ou description"
                className="border-l border-white/10 px-3 lg:px-4 py-[10px] text-zinc-400 hover:text-primary transition-colors flex-shrink-0 group"
              >
                <i className="fa-solid fa-camera text-sm group-hover:scale-110 transition-transform"></i>
              </button>
              <button
                type="submit"
                className="bg-primary text-black px-4 lg:px-6 py-[10px] font-black text-[9px] lg:text-[10px] uppercase tracking-widest hover:bg-white transition-colors flex-shrink-0 flex items-center gap-1.5 h-full"
              >
                <i className="fa-solid fa-magnifying-glass text-xs lg:hidden"></i>
                <span className="hidden lg:inline">Chercher</span>
              </button>
            </div>
          </form>

          <div className="flex-grow md:hidden" />

          {/* ACTIONS */}
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
            {/* Theme */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 transition-all"
            >
              <i
                className={
                  "fa-solid text-xs " +
                  (isDark ? "fa-sun text-yellow-400" : "fa-moon text-white")
                }
              ></i>
            </button>

            {/* Cart */}
            <button
              onClick={toggleCart}
              className={
                "relative w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all duration-200 " +
                (cartCount > 0
                  ? "bg-primary text-black"
                  : "bg-white/5 text-white border border-white/10 hover:border-primary/50") +
                (cartBump ? " scale-125" : " scale-100")
              }
            >
              <i className="fa-solid fa-bag-shopping text-sm"></i>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-black text-white text-[7px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-primary leading-none">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>

            {/* Vendre */}
            <Link
              to="/admin"
              className="hidden sm:flex items-center gap-1.5 bg-primary text-black px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wide hover:bg-white transition-all whitespace-nowrap"
            >
              <i className="fa-solid fa-bolt text-xs"></i>
              <span>Vendre</span>
            </Link>

            {/* Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:border-primary/40 transition-all"
            >
              <i
                className={
                  "fa-solid text-white text-sm " +
                  (mobileMenuOpen ? "fa-xmark" : "fa-bars")
                }
              ></i>
            </button>
          </div>
        </div>

        {/* ROW 2: Search bar — mobile only */}
        <div className="md:hidden px-3 sm:px-4 pb-2">
          <form
            onSubmit={handleSearch}
            className="flex items-center bg-zinc-900 border border-white/10 rounded-xl overflow-hidden focus-within:border-primary transition-colors"
          >
            <i className="fa-solid fa-magnifying-glass text-zinc-500 text-xs mx-3 flex-shrink-0"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="flex-grow bg-transparent py-2.5 text-[13px] font-bold text-white placeholder-zinc-500 outline-none min-w-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="px-2 text-zinc-500 hover:text-white transition flex-shrink-0"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            )}
            <button
              type="button"
              onClick={toggleVisualSearch}
              className="px-3 text-zinc-500 hover:text-primary transition-colors flex-shrink-0 border-l border-white/10"
            >
              <i className="fa-solid fa-camera text-xs"></i>
            </button>
            <button
              type="submit"
              className="bg-primary text-black px-4 py-2.5 font-black uppercase flex-shrink-0 flex items-center"
            >
              <i className="fa-solid fa-arrow-right text-xs"></i>
            </button>
          </form>
        </div>
      </nav>

      {/* CATEGORIES BAR — top set via CSS: 128px mobile, 104px desktop */}
      <div
        id="ofs-catbar"
        className="fixed left-0 right-0 z-[105] bg-zinc-950 border-b border-white/5"
        onMouseLeave={handleMegaLeave}
      >
        <div className="max-w-[1600px] mx-auto px-3 md:px-8">
          <div className="flex items-center overflow-x-auto hide-scrollbar">
            <button
              onClick={() => navigate("/store")}
              onMouseEnter={() => handleCategoryHover(-1)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 md:px-4 py-2.5 md:py-3 font-black uppercase text-[8px] sm:text-[9px] md:text-[10px] tracking-wide text-white hover:text-primary transition-colors border-r border-white/5 flex-shrink-0"
            >
              <i className="fa-solid fa-grid-2 text-primary text-[10px]"></i>
              <span className="hidden sm:inline">Catégories</span>
            </button>

            {CATEGORIES.map((cat, idx) => (
              <button
                key={cat.name}
                onMouseEnter={() => handleCategoryHover(idx)}
                onClick={() => navigate("/store")}
                className={
                  "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 md:px-4 py-2.5 md:py-3 font-black uppercase text-[8px] sm:text-[9px] md:text-[10px] tracking-wide border-r border-white/5 flex-shrink-0 whitespace-nowrap transition-all " +
                  (activeCategory === idx && megaMenuOpen
                    ? "text-primary bg-white/5"
                    : "text-zinc-400 hover:text-white hover:bg-white/5")
                }
              >
                <i
                  className={
                    "fa-solid " +
                    cat.icon +
                    " " +
                    cat.color +
                    " text-[10px] flex-shrink-0"
                  }
                ></i>
                <span className="sm:hidden">{cat.shortName}</span>
                <span className="hidden sm:inline md:hidden">
                  {cat.shortName}
                </span>
                <span className="hidden md:inline">{cat.name}</span>
              </button>
            ))}

            <Link
              to="/studio"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 md:px-4 py-2.5 md:py-3 font-black uppercase text-[8px] sm:text-[9px] md:text-[10px] tracking-wide text-primary hover:bg-primary/10 transition-all flex-shrink-0 ml-auto whitespace-nowrap"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
              <span className="hidden min-[380px]:inline">Studio</span>
            </Link>
          </div>
        </div>

        {/* MEGA MENU: xl+ desktop only */}
        {megaMenuOpen && activeCategory !== null && activeCategory >= 0 && (
          <div
            className="hidden xl:block absolute left-0 right-0 bg-zinc-950/98 backdrop-blur-xl border-t border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-50"
            onMouseEnter={() => {
              if (closeTimer.current) clearTimeout(closeTimer.current);
            }}
            onMouseLeave={handleMegaLeave}
          >
            <div className="max-w-[1600px] mx-auto px-8 py-8">
              <div className="grid grid-cols-5 gap-8">
                <div className="col-span-1">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <i
                        className={
                          "fa-solid " +
                          CATEGORIES[activeCategory].icon +
                          " text-primary text-xl"
                        }
                      ></i>
                    </div>
                    <div>
                      <h3 className="font-black text-white uppercase text-sm">
                        {CATEGORIES[activeCategory].name}
                      </h3>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                        OneFreestyle Elite
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/store"
                    className="w-full bg-primary text-black text-[10px] font-black uppercase tracking-widest py-3 px-4 rounded-xl flex items-center justify-between hover:bg-white transition-colors"
                  >
                    <span>Voir tout</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </Link>
                </div>
                <div className="col-span-2">
                  <h5 className="text-[9px] font-black uppercase text-primary tracking-[0.4em] mb-4 pb-2 border-b border-white/5">
                    Sous-catégories
                  </h5>
                  <div className="grid grid-cols-2 gap-1">
                    {CATEGORIES[activeCategory].subs.map((sub) => (
                      <Link
                        key={sub}
                        to="/store"
                        className="text-[11px] font-bold text-zinc-400 hover:text-white flex items-center gap-2 group py-1.5"
                      >
                        <span className="w-0 group-hover:w-2 h-px bg-primary transition-all rounded-full flex-shrink-0"></span>
                        <span className="group-hover:translate-x-1 transition-transform">
                          {sub}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 h-full flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase text-primary tracking-widest">
                        Flash Deal
                      </span>
                      <h4 className="text-2xl font-black italic text-white mt-2 leading-tight uppercase">
                        -15%
                        <br />
                        sur 2 articles
                      </h4>
                    </div>
                    <Link
                      to="/store"
                      className="text-[10px] font-black uppercase text-black bg-primary px-4 py-2.5 rounded-xl hover:bg-white transition-colors w-fit"
                    >
                      Profiter
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE DRAWER BACKDROP */}
      <div
        className={
          "xl:hidden fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm transition-opacity duration-300 " +
          (mobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none")
        }
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* MOBILE DRAWER */}
      <div
        className={
          "xl:hidden fixed right-0 top-0 bottom-0 z-[210] bg-zinc-950 border-l border-white/10 flex flex-col shadow-2xl transition-transform duration-300 " +
          (mobileMenuOpen ? "translate-x-0" : "translate-x-full")
        }
        style={{ width: "min(320px, 85vw)" }}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0 bg-black">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2"
          >
            <img src={ofsLogo} alt="OFS" className="w-7 h-7" />
            <span className="logo-font font-black text-[11px] uppercase text-white">
              OneFree<span className="text-primary italic">Style</span>
            </span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10"
          >
            <i className="fa-solid fa-xmark text-white text-sm"></i>
          </button>
        </div>

        {/* BODY */}
        <div className="flex-grow overflow-y-auto py-3 px-3">
          {/* Main links */}
          <div className="space-y-1 mb-4">
            {[
              { to: "/", icon: "fa-house", label: "Accueil" },
              { to: "/store", icon: "fa-bag-shopping", label: "Store" },
              {
                to: "/studio",
                icon: "fa-wand-magic-sparkles",
                label: "Studio Lab",
                accent: true,
              },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={
                  "flex items-center gap-3 px-4 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all " +
                  (link.accent
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-zinc-300 hover:text-white hover:bg-white/5")
                }
              >
                <div
                  className={
                    "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 " +
                    (link.accent ? "bg-primary/20" : "bg-white/5")
                  }
                >
                  <i
                    className={"fa-solid text-xs text-primary " + link.icon}
                  ></i>
                </div>
                <span className="flex-grow">{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="flex-1 h-px bg-white/5"></div>
            <span className="text-[7px] font-black uppercase text-zinc-600 tracking-widest shrink-0">
              Catégories
            </span>
            <div className="flex-1 h-px bg-white/5"></div>
          </div>

          {/* Categories */}
          <div className="space-y-0.5">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                to="/store"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl font-bold text-[10px] uppercase tracking-wide text-zinc-400 hover:text-white hover:bg-white/5 transition-all group"
              >
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <i
                    className={
                      "fa-solid text-[10px] " + cat.icon + " " + cat.color
                    }
                  ></i>
                </div>
                <span className="flex-grow">{cat.name}</span>
                <i className="fa-solid fa-chevron-right text-[7px] text-zinc-700 group-hover:text-zinc-500 transition-colors"></i>
              </Link>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex-shrink-0 border-t border-white/5 p-4 space-y-2 bg-black/50">
          <Link
            to="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 bg-primary text-black p-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest w-full hover:bg-white transition-all active:scale-95"
          >
            <i className="fa-solid fa-bolt text-xs"></i>
            <span>Devenir Vendeur</span>
          </Link>
          <Link
            to="/login"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 border border-white/10 text-zinc-400 p-3 rounded-2xl font-black uppercase text-[9px] tracking-widest w-full hover:border-primary/40 hover:text-white transition-all"
          >
            <i className="fa-solid fa-right-to-bracket text-xs"></i>
            <span>Espace Vendeur</span>
          </Link>
        </div>
      </div>

      {/* SPACER: mobile 168px / desktop 148px */}
      <div className="h-[168px] md:h-[148px]" aria-hidden="true" />

      <style>{`
        @keyframes ofs-ticker { 0% { transform:translateX(0); } 100% { transform:translateX(-50%); } }
        .ofs-ticker { display:inline-flex; animation:ofs-ticker 28s linear infinite; will-change:transform; }

        /* Cat bar top: mobile 128px / desktop 104px */
        #ofs-catbar { top: 128px; }
        @media (min-width:768px) { #ofs-catbar { top: 104px; } }

        .hide-scrollbar::-webkit-scrollbar { display:none; }
        .hide-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }

        .logo-font { font-family:'Syncopate',sans-serif; }
      `}</style>
    </>
  );
};

export default Navbar;
