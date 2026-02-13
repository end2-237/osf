import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ofsLogo from '../assets/ofs.png'; 

// ✅ COMPOSANT UTILITAIRE POUR REMONTER EN HAUT DE PAGE
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const Navbar = ({ isDark, toggleTheme, cartCount, toggleCart }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const prevCartCount = useRef(cartCount);
  const location = useLocation();

  const ads = [
    { text: "LIVRAISON GRATUITE SUR TOUTES LES COMMANDES — PENDANT 1 MOIS !", img: "https://images.unsplash.com/photo-1586769852044-692d6e671f6c?w=100&h=100&auto=format&fit=crop", color: "text-primary" },
    { text: "NEW DROP: NIKE AIR MAX ELITE X", img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&auto=format&fit=crop", color: "text-white" },
    { text: "OFFRE BUNDLE: -15% SUR LE PANIER (MIN. 2 ARTICLES)", img: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&h=100&auto=format&fit=crop", color: "text-yellow-400" },
    { text: "STUDIO LAB: PERSONNALISE TON ÉQUIPEMENT MAINTENANT", img: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=100&h=100&auto=format&fit=crop", color: "text-primary" },
  ];

  const navLinks = [
    { path: '/', label: 'Home', icon: 'fa-house' },
    { path: '/store', label: 'Store', icon: 'fa-bag-shopping', badge: 'HOT' },
    { path: '/studio', label: 'Studio Lab', icon: 'fa-wand-magic-sparkles', accent: true },
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

  // Fermer le menu mobile lors d'un changement de page
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <ScrollToTop /> {/* ✅ Active le retour en haut auto */}
      
      {/* ── AGRO-TICKER ── */}
      <div className="fixed top-0 w-full z-[120] bg-black text-white overflow-hidden h-10 md:h-12 flex items-center border-b border-white/10">
        <div className="flex animate-marquee whitespace-nowrap items-center py-2">
          {[...ads, ...ads].map((ad, i) => (
            <div key={i} className="flex items-center mx-6 md:mx-12 space-x-4 group cursor-pointer">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg overflow-hidden border-2 border-primary/50 group-hover:border-primary transition-all duration-500 scale-110">
                <img src={ad.img} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.25em] text-white">
                {ad.text}
              </span>
              <span className="text-primary font-black px-4 italic opacity-50">///</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN NAVBAR ── */}
      <nav
        className={`fixed top-10 md:top-12 w-full z-[110] transition-all duration-700 ease-in-out ${scrolled ? 'h-16' : 'h-20'}`}
        style={{
          background: scrolled ? (isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.98)') : 'transparent',
          backdropFilter: scrolled ? 'blur(30px)' : 'none',
        }}
      >
        <div className="max-w-[1600px] mx-auto px-4 md:px-10 h-full flex items-center justify-between">
          
          {/* LOGO */}
          <Link to="/" className="relative group flex items-center space-x-3 md:space-x-4">
            <div className={`transition-all duration-500 ${scrolled ? 'w-8 md:w-10' : 'w-10 md:w-14'}`}>
              <img src={ofsLogo} alt="Logo" className="w-full h-auto drop-shadow-[0_0_10px_rgba(0,255,136,0.3)] group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col border-l-2 border-primary/30 pl-3 md:pl-4">
              <span className={`logo-font font-black text-sm md:text-xl leading-none tracking-tighter uppercase ${isDark ? 'text-white' : 'text-black'}`}>
                OneFree<span className="text-primary italic">Style</span>
              </span>
              <span className="hidden xs:block text-[6px] md:text-[8px] font-black tracking-[0.5em] text-primary uppercase">Elite Arsenal</span>
            </div>
          </Link>

          {/* DESKTOP MENU */}
          <div className="hidden lg:flex items-center space-x-2 bg-zinc-100 dark:bg-white/5 p-1.5 rounded-2xl border border-black/5 dark:border-white/5">
            {navLinks.map(({ path, label, icon, badge }) => (
              <Link key={path} to={path} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 transition-all duration-500 ${isActive(path) ? 'bg-primary text-black shadow-[0_10px_30px_rgba(0,255,136,0.4)]' : 'text-zinc-500 hover:text-primary'}`}>
                <i className={`fa-solid ${icon} ${isActive(path) ? 'animate-pulse' : ''}`}></i>
                <span>{label}</span>
              </Link>
            ))}
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-1.5 md:gap-4">
            <button onClick={toggleTheme} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/5 transition-all">
              <i className={`fa-solid ${isDark ? 'fa-sun text-yellow-400' : 'fa-moon'} text-xs md:text-sm`}></i>
            </button>

            <button onClick={toggleCart} className={`relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl transition-all ${cartCount > 0 ? 'bg-primary text-black' : 'bg-zinc-100 dark:bg-white/5'} ${cartBump ? 'scale-125' : ''}`}>
              <i className="fa-solid fa-bag-shopping text-sm md:text-lg"></i>
              {cartCount > 0 && <span className="absolute -top-1 -right-1 bg-black text-white text-[8px] font-black w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full border-2 border-primary">{cartCount}</span>}
            </button>

            {/* Menu Burger Mobile */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/5">
              <i className={`fa-solid ${mobileMenuOpen ? 'fa-xmark' : 'fa-bars-staggered'} text-sm`}></i>
            </button>

            <Link to="/admin" className="hidden sm:flex items-center space-x-2 bg-black dark:bg-white text-white dark:text-black px-4 md:px-6 py-3 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all">
              <i className="fa-solid fa-bolt text-primary dark:text-black"></i>
              <span>Vendre</span>
            </Link>
          </div>
        </div>

        {/* ── MENU MOBILE DÉROULANT ── */}
        <div className={`lg:hidden absolute top-full left-0 w-full bg-white dark:bg-zinc-950 transition-all duration-500 border-t border-black/5 dark:border-white/5 overflow-hidden ${mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-6 space-y-4">
            {navLinks.map(({ path, label, icon }) => (
              <Link key={path} to={path} className={`flex items-center space-x-4 p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest ${isActive(path) ? 'bg-primary/20 text-primary' : 'text-zinc-500'}`}>
                <i className={`fa-solid ${icon}`}></i>
                <span>{label}</span>
              </Link>
            ))}
            <Link to="/admin" className="flex items-center justify-center space-x-2 bg-black dark:bg-white text-white dark:text-black p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest">
              <i className="fa-solid fa-bolt text-primary"></i>
              <span>Vendre sur Elite</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* SPACER */}
      <div className={`${scrolled ? 'h-24 md:h-28' : 'h-28 md:h-32'}`} />

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: flex; animation: marquee 30s linear infinite; }
        @media (max-width: 480px) { .xs\\:block { display: block; } }
      `}</style>
    </>
  );
};

export default Navbar;