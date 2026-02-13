import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ofsLogo from '../assets/ofs.png';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const CATEGORIES = [
  {
    name: 'Téléphones & Audio',
    icon: 'fa-headphones',
    color: 'text-primary',
    subs: ['Audio Lab', 'Casques & Écouteurs', 'Enceintes', 'AirPods', 'Wireless'],
  },
  {
    name: 'Tech Lab',
    icon: 'fa-microchip',
    color: 'text-blue-400',
    subs: ['VR & AR', 'Accessoires', 'Gadgets', 'Smart Watch', 'Cables'],
  },
  {
    name: 'Streetwear',
    icon: 'fa-shirt',
    color: 'text-purple-400',
    subs: ['T-Shirts', 'Hoodies', 'Vestes', 'Shorts', 'Accessoires'],
  },
  {
    name: 'Sneakers',
    icon: 'fa-shoe-prints',
    color: 'text-orange-400',
    subs: ['Baskets', 'Running', 'Casual', 'High-Top', 'Limited'],
  },
  {
    name: 'Parfums Elite',
    icon: 'fa-spray-can-sparkles',
    color: 'text-pink-400',
    subs: ['Homme', 'Femme', 'Unisex', 'Travel Size', 'Gift Set'],
  },
  {
    name: 'Flash Deals',
    icon: 'fa-bolt',
    color: 'text-yellow-400',
    subs: ['Moins de 10K', 'Moins de 25K', 'Meilleures Ventes', 'Nouveautés', 'Éditions Limitées'],
  },
];

const Navbar = ({ isDark, toggleTheme, cartCount, toggleCart }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const megaRef = useRef(null);
  const prevCartCount = useRef(cartCount);
  const location = useLocation();
  const navigate = useNavigate();
  const closeTimer = useRef(null);

  const ads = [
    { text: "LIVRAISON GRATUITE SUR TOUTES LES COMMANDES — PENDANT 1 MOIS !", img: "https://plus.unsplash.com/premium_photo-1681487829842-2aeff98f8b63?q=80&w=870&auto=format&fit=crop", color: "text-primary" },
    { text: "SUPER PROMO: AIRPODS PRO 2 6000 FCFA", img: "https://alrbokstfwwlvbvghrqr.supabase.co/storage/v1/object/public/product-images/7af44857-1793-4e5f-8af2-55a367cac991/AirPods-Pro-2-Semi-Original-White.jpg", color: "text-white" },
    { text: "OFFRE BUNDLE: -15% SUR LE PANIER (MIN. 2 ARTICLES)", img: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&h=100&auto=format&fit=crop", color: "text-yellow-400" },
    { text: "STUDIO LAB: PERSONNALISE TON ÉQUIPEMENT MAINTENANT", img: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=100&h=100&auto=format&fit=crop", color: "text-primary" },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (cartCount !== prevCartCount.current && cartCount > 0) {
      setCartBump(true);
      setTimeout(() => setCartBump(false), 400);
    }
    prevCartCount.current = cartCount;
  }, [cartCount]);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/store?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
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

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <ScrollToTop />

      {/* ── PROMO TICKER ── */}
      <div className="fixed top-0 w-full z-[120] bg-black text-white overflow-hidden h-10 flex items-center border-b border-white/10">
        <div className="flex animate-marquee whitespace-nowrap items-center">
          {[...ads, ...ads].map((ad, i) => (
            <div key={i} className="flex items-center mx-10 space-x-3 group cursor-pointer">
              <div className="w-6 h-6 rounded-md overflow-hidden border border-primary/50 group-hover:border-primary transition-all">
                <img src={ad.img} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{ad.text}</span>
              <span className="text-primary font-black px-3 italic opacity-50">///</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN NAVBAR ── */}
      <nav
        className={`fixed top-10 w-full z-[110] transition-all duration-500 ${scrolled ? 'h-16' : 'h-18'} bg-black border-b border-white/5`}
        style={{ backdropFilter: 'blur(30px)' }}
      >
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-full flex items-center gap-4 md:gap-6">

          {/* LOGO */}
          <Link to="/" className="flex items-center space-x-3 flex-shrink-0 group">
            <div className="w-9 h-9 flex-shrink-0">
              <img src={ofsLogo} alt="Logo" className="w-full h-auto drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] group-hover:scale-110 transition-transform" />
            </div>
            <div className="hidden sm:flex flex-col border-l border-primary/30 pl-3">
              <span className="logo-font font-black text-sm leading-none tracking-tighter uppercase text-white">
                OneFree<span className="text-primary italic">Style</span>
              </span>
              <span className="text-[7px] font-black tracking-[0.4em] text-primary uppercase">Elite Market</span>
            </div>
          </Link>

          {/* ── SEARCH BAR (iziway style) ── */}
          <form onSubmit={handleSearch} className="flex-grow max-w-2xl relative group">
            <div className={`flex items-center bg-zinc-900 border-2 rounded-2xl overflow-hidden transition-all duration-300 ${searchFocused ? 'border-primary shadow-[0_0_20px_rgba(0,255,136,0.2)]' : 'border-white/10 hover:border-white/20'}`}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Rechercher un produit, une marque..."
                className="flex-grow bg-transparent px-5 py-3 text-sm font-bold text-white placeholder-zinc-500 outline-none"
              />
              <button
                type="submit"
                className="bg-primary text-black px-6 py-3 font-black text-xs uppercase tracking-widest hover:bg-white transition-colors flex-shrink-0 flex items-center gap-2"
              >
                <i className="fa-solid fa-magnifying-glass text-sm"></i>
                <span className="hidden md:inline">Chercher</span>
              </button>
            </div>
          </form>

          {/* ACTIONS */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={toggleTheme} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 transition-all">
              <i className={`fa-solid ${isDark ? 'fa-sun text-yellow-400' : 'fa-moon text-white'} text-xs`}></i>
            </button>

            <button onClick={toggleCart} className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all ${cartCount > 0 ? 'bg-primary text-black' : 'bg-white/5 text-white border border-white/10 hover:border-primary/50'} ${cartBump ? 'scale-125' : ''}`}>
              <i className="fa-solid fa-bag-shopping text-sm"></i>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-black text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-primary">{cartCount}</span>
              )}
            </button>

            <Link to="/admin" className="hidden sm:flex items-center gap-2 bg-primary text-black px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-white transition-all">
              <i className="fa-solid fa-bolt"></i>
              <span>Vendre</span>
            </Link>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10">
              <i className={`fa-solid ${mobileMenuOpen ? 'fa-xmark' : 'fa-bars'} text-white text-sm`}></i>
            </button>
          </div>
        </div>
      </nav>

      {/* ── CATEGORIES BAR (iziway style) ── */}
      <div
        className="fixed z-[105] w-full bg-zinc-950 border-b border-white/5 overflow-visible"
        style={{ top: scrolled ? '74px' : '82px', transition: 'top 0.5s' }}
        onMouseLeave={handleMegaLeave}
      >
        <div className="max-w-[1600px] mx-auto px-4 md:px-8">
          <div className="flex items-center gap-0 overflow-x-auto hide-scrollbar">

            {/* ALL CATEGORIES */}
            <button
              className="flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap text-white hover:text-primary transition-colors border-r border-white/5 flex-shrink-0"
              onMouseEnter={() => handleCategoryHover(-1)}
            >
              <i className="fa-solid fa-grid-2 text-primary"></i>
              <span className="hidden md:inline">Toutes Catégories</span>
              <span className="md:hidden">Catégories</span>
            </button>

            {CATEGORIES.map((cat, idx) => (
              <button
                key={cat.name}
                onMouseEnter={() => handleCategoryHover(idx)}
                onClick={() => navigate('/store')}
                className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border-r border-white/5 flex-shrink-0 ${activeCategory === idx && megaMenuOpen ? 'text-primary bg-white/5' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
              >
                <i className={`fa-solid ${cat.icon} ${cat.color} text-xs`}></i>
                <span className="hidden md:inline">{cat.name}</span>
              </button>
            ))}

            {/* STUDIO LAB */}
            <Link
              to="/studio"
              className="flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-primary hover:bg-primary/10 transition-all flex-shrink-0 ml-auto"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
              <span>Studio Lab</span>
            </Link>
          </div>
        </div>

        {/* ── MEGA MENU ── */}
        {megaMenuOpen && activeCategory !== null && activeCategory >= 0 && (
          <div
            className="absolute left-0 right-0 bg-zinc-950/98 backdrop-blur-xl border-t border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-50"
            onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); }}
            onMouseLeave={handleMegaLeave}
          >
            <div className="max-w-[1600px] mx-auto px-8 py-8">
              <div className="grid grid-cols-5 gap-8">
                {/* ACTIVE CATEGORY HEADER */}
                <div className="col-span-1">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <i className={`fa-solid ${CATEGORIES[activeCategory].icon} text-primary text-xl`}></i>
                    </div>
                    <div>
                      <h3 className="font-black text-white uppercase text-sm tracking-tight">{CATEGORIES[activeCategory].name}</h3>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">OneFreestyle Elite</p>
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

                {/* SUB-CATEGORIES */}
                <div className="col-span-2">
                  <h5 className="text-[9px] font-black uppercase text-primary tracking-[0.4em] mb-4 pb-2 border-b border-white/5">Sous-catégories</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES[activeCategory].subs.map((sub) => (
                      <Link
                        key={sub}
                        to="/store"
                        className="text-[11px] font-bold text-zinc-400 hover:text-white flex items-center gap-2 group py-1.5"
                      >
                        <span className="w-0 group-hover:w-2 h-px bg-primary transition-all duration-300 rounded-full"></span>
                        <span className="group-hover:translate-x-1 transition-transform">{sub}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* PROMO BLOCK */}
                <div className="col-span-2">
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 h-full flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase text-primary tracking-widest">Flash Deal</span>
                      <h4 className="text-2xl font-black italic text-white mt-2 leading-tight uppercase">-15%<br/>sur 2 articles</h4>
                    </div>
                    <Link to="/store" className="text-[10px] font-black uppercase tracking-widest text-black bg-primary px-4 py-2.5 rounded-xl hover:bg-white transition-colors w-fit">
                      Profiter
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE MENU ── */}
      <div className={`fixed z-[104] left-0 right-0 bg-zinc-950 border-b border-white/5 transition-all duration-500 overflow-hidden lg:hidden ${mobileMenuOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'}`}
        style={{ top: scrolled ? '74px' : '82px' }}>
        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <Link to="/" className="flex items-center gap-4 p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white hover:bg-white/5 transition">
            <i className="fa-solid fa-house text-primary"></i><span>Accueil</span>
          </Link>
          <Link to="/store" className="flex items-center gap-4 p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white hover:bg-white/5 transition">
            <i className="fa-solid fa-bag-shopping text-primary"></i><span>Store</span>
          </Link>
          <Link to="/studio" className="flex items-center gap-4 p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-primary bg-primary/10 transition">
            <i className="fa-solid fa-wand-magic-sparkles"></i><span>Studio Lab</span>
          </Link>
          <div className="pt-2 border-t border-white/5">
            {CATEGORIES.map((cat) => (
              <Link key={cat.name} to="/store" className="flex items-center gap-3 p-3 rounded-xl font-bold text-[10px] uppercase tracking-wider text-zinc-400 hover:text-white transition">
                <i className={`fa-solid ${cat.icon} ${cat.color} text-xs`}></i>
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
          <Link to="/admin" className="flex items-center justify-center gap-2 bg-primary text-black p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">
            <i className="fa-solid fa-bolt"></i><span>Devenir Vendeur</span>
          </Link>
        </div>
      </div>

      {/* SPACER */}
      <div className="h-[116px] md:h-[120px]" />

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: flex; animation: marquee 35s linear infinite; }
        .h-18 { height: 4.5rem; }
      `}</style>
    </>
  );
};

export default Navbar;