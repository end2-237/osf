import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ofsLogo from "../assets/ofs.png";
import { useAuth } from "../context/AuthContext";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const CATEGORIES = [
  { name: "Audio Lab",   catKey: "Audio Lab",      icon: "fa-headphones",         isNew: false },
  { name: "Tech Lab",    catKey: "Tech Lab",        icon: "fa-microchip",          isNew: false },
  { name: "Mode Femme",  catKey: "Femme",           icon: "fa-person-dress",       isNew: false },
  { name: "Mode Homme",  catKey: "Clothing",        icon: "fa-shirt",              isNew: false },
  { name: "Sneakers",    catKey: "Shoes",           icon: "fa-shoe-prints",        isNew: false },
  { name: "Beauté",      catKey: "Beauté",          icon: "fa-spray-can-sparkles", isNew: false },
  { name: "Accessoires", catKey: "Accessories",     icon: "fa-gem",                isNew: false },
  { name: "Maison",      catKey: "Maison",          icon: "fa-house",              isNew: true  },
  { name: "Sport",       catKey: "Sport",           icon: "fa-dumbbell",           isNew: true  },
  { name: "Flash Deals", catKey: null,              icon: "fa-bolt",               isNew: false },
];

const ProfileDropdown = ({ user, profile, signOut }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const name = profile?.full_name || user?.email?.split("@")[0] || "Mon compte";
  const firstName = name.split(" ")[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex flex-col items-start text-[#1a1a1a] border border-transparent hover:border-[#C8BDB3] hover:bg-[#F5F0EA] rounded px-2 py-1 transition-all"
      >
        <span className="text-[11px] text-[#7a6f66] leading-none mb-0.5">Bonjour, {firstName}</span>
        <span className="text-[13px] font-bold leading-none flex items-center gap-1">
          Compte &amp; Listes
          <i className={`fa-solid fa-caret-down text-[10px] transition-transform ${open ? "rotate-180" : ""}`}></i>
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-[#D5D9D9] rounded shadow-2xl z-50">
          <div className="px-4 py-3 border-b border-[#EAEDED]">
            <p className="font-bold text-sm text-[#0F1111] truncate">{name}</p>
            <p className="text-xs text-[#565959] truncate mt-0.5">{user?.email}</p>
          </div>
          <div className="py-1">
            {[
              { to: "/profile",              icon: "fa-user",           label: "Mon profil"          },
              { to: "/track",                icon: "fa-location-dot",   label: "Suivre ma commande" },
              { to: "/profile?tab=orders",   icon: "fa-box",            label: "Mes commandes"       },
              { to: "/profile?tab=wishlist", icon: "fa-heart",          label: "Mes favoris"         },
              { to: "/profile?tab=referral", icon: "fa-user-plus",      label: "Parrainage"          },
              ...(["emansoga@gmail.com","nsogadavid01@gmail.com"].includes(user?.email) ? [{ to: "/super-admin", icon: "fa-shield-halved", label: "Super Admin" }] : []),
            ].map(l => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#0F1111] hover:bg-[#F5F0EA] transition-colors"
              >
                <i className={`fa-solid ${l.icon} text-[#FF9900] w-4 text-sm`}></i>
                <span>{l.label}</span>
              </Link>
            ))}
          </div>
          <div className="border-t border-[#EAEDED] p-2">
            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <i className="fa-solid fa-right-from-bracket w-4"></i>
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Navbar = ({ isDark, toggleTheme, cartCount, toggleCart, toggleVisualSearch }) => {
  const { user, isMember, signOut } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [cartBump,       setCartBump]       = useState(false);
  const [profile,        setProfile]        = useState(null);

  const [suggestions,      setSuggestions]      = useState([]);
  const [showSugg,         setShowSugg]         = useState(false);

  const prevCartCount      = useRef(cartCount);
  const searchContainerRef = useRef(null);
  const debounceT          = useRef(null);
  const location      = useLocation();
  const navigate      = useNavigate();
  const [searchParams]  = useSearchParams();

  useEffect(() => {
    if (location.pathname === "/search") {
      setSearchQuery(searchParams.get("q") || "");
    }
  }, [location.pathname, searchParams]);

  const handleSignOut = async () => {
    try { await signOut(); } catch (e) { console.warn(e); }
    navigate("/");
  };

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    import("../lib/supabase").then(({ supabase }) => {
      supabase.from("profiles").select("full_name,avatar_url").eq("id", user.id).maybeSingle()
        .then(({ data }) => { if (data) setProfile(data); });
    });
  }, [user]);

  useEffect(() => {
    if (cartCount !== prevCartCount.current && cartCount > 0) {
      setCartBump(true);
      setTimeout(() => setCartBump(false), 400);
    }
    prevCartCount.current = cartCount;
  }, [cartCount]);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSugg(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (debounceT.current) clearTimeout(debounceT.current);
    const q = searchQuery.trim();
    if (q.length < 2) { setSuggestions([]); setShowSugg(false); return; }
    debounceT.current = setTimeout(() => {
      import("../lib/supabase").then(({ supabase }) => {
        supabase
          .from("products")
          .select("id, name, type, price, img")
          .ilike("name", `%${q}%`)
          .limit(6)
          .then(({ data }) => {
            setSuggestions(data || []);
            setShowSugg((data?.length ?? 0) > 0);
          });
      });
    }, 250);
    return () => clearTimeout(debounceT.current);
  }, [searchQuery]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      setShowSugg(false);
      navigate("/search?q=" + encodeURIComponent(searchQuery.trim()));
      setMobileMenuOpen(false);
    }
  };

  const initial = (profile?.full_name || user?.email || "?")[0].toUpperCase();

  return (
    <>
      <ScrollToTop />

      {/* ── PROMO STRIP ── */}
      <div className="fixed top-0 left-0 right-0 z-[125] h-8 bg-[#FF9900] flex items-center justify-center">
        <p className="text-[11px] text-[#1a1a1a] text-center font-medium">
          <span className="font-black">Livraison gratuite</span>
          {" · "}Paiement sécurisé{" · "}
          <Link to="/register" className="font-black hover:underline underline-offset-2">
            Rejoignez l'Elite −20%
          </Link>
        </p>
      </div>

      {/* ── MAIN NAV ── */}
      <nav className="fixed left-0 right-0 z-[110] bg-white border-b border-[#E8E1D9] shadow-sm top-8">
        <div className="h-12 md:h-14 flex items-center gap-2 md:gap-3 px-3 md:px-6 max-w-[1600px] mx-auto">

          {/* LOGO */}
          <Link to="/"
            className="flex items-center gap-2 flex-shrink-0 border border-transparent hover:border-[#C8BDB3] hover:bg-[#F5F0EA] rounded px-2 py-1 transition-all"
          >
            <img src={ofsLogo} alt="OFS" className="w-7 h-7 md:w-8 md:h-8 flex-shrink-0" />
            <div className="hidden sm:flex flex-col leading-none">
              <span className="logo-font font-black text-[10px] md:text-[11px] text-[#1a1a1a] whitespace-nowrap">
                OneFree<span className="text-[#FF9900]">Style</span>
              </span>
              <span className="text-[8px] text-[#9a8f86] font-medium">Elite Market</span>
            </div>
          </Link>

          {/* DELIVER TO (desktop) */}
          <div className="hidden lg:flex flex-col leading-none border border-transparent hover:border-[#C8BDB3] hover:bg-[#F5F0EA] rounded px-2 py-1 transition-all cursor-pointer flex-shrink-0">
            <span className="text-[11px] text-[#7a6f66] flex items-center gap-1">
              <i className="fa-solid fa-location-dot text-[#FF9900] text-[10px]"></i> Livrer à
            </span>
            <span className="text-[13px] font-bold text-[#1a1a1a]">Douala 🇨🇲</span>
          </div>

          {/* SEARCH — desktop */}
          <div ref={searchContainerRef} className="relative hidden md:flex flex-grow max-w-3xl">
            <form onSubmit={handleSearch} className="flex w-full">
              <div className="flex w-full h-10 rounded-lg overflow-hidden border border-[#D5CDC4] focus-within:border-[#FF9900] focus-within:ring-2 focus-within:ring-[#FF9900]/20 transition-all bg-white">
                <select
                  className="bg-[#F5F0EA] text-[#1a1a1a] text-[11px] px-2 border-r border-[#D5CDC4] outline-none cursor-pointer flex-shrink-0 font-medium min-w-[60px]"
                >
                  <option>Tout</option>
                  {CATEGORIES.map(c => <option key={c.name}>{c.name}</option>)}
                </select>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setShowSugg(true); }}
                  onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                  placeholder="Rechercher produits, marques..."
                  className="flex-grow bg-white text-[#0F1111] px-3 text-sm outline-none min-w-0"
                />
                <button type="button" onClick={toggleVisualSearch}
                  className="bg-white px-2.5 border-l border-[#D5CDC4] text-[#9a8f86] hover:text-[#FF9900] transition-colors flex-shrink-0"
                >
                  <i className="fa-solid fa-camera text-sm"></i>
                </button>
                <button type="submit"
                  className="bg-[#FF9900] hover:bg-[#E47911] text-[#0F1111] px-4 flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <i className="fa-solid fa-magnifying-glass text-lg"></i>
                </button>
              </div>
            </form>

            {/* SUGGESTIONS */}
            {showSugg && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#D5D9D9] rounded-lg shadow-2xl z-[150] overflow-hidden">
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={() => { setShowSugg(false); navigate(`/search?q=${encodeURIComponent(s.name)}`); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-[#F5F0EA] transition-colors text-left"
                  >
                    <div className="w-9 h-9 bg-[#F5F0EA] rounded overflow-hidden flex-shrink-0">
                      {s.img && <img src={s.img} alt={s.name} className="w-full h-full object-contain" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-[#0F1111] truncate">{s.name}</p>
                      <p className="text-[9px] text-[#565959]">{s.type} · {Number(s.price).toLocaleString()} F</p>
                    </div>
                    <i className="fa-solid fa-arrow-up-left text-[#C8BDB3] text-[10px] flex-shrink-0"></i>
                  </button>
                ))}
                <div className="px-4 py-2.5 border-t border-[#F0EBE5] bg-[#FAF7F4]">
                  <button
                    type="button"
                    onMouseDown={() => { setShowSugg(false); navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`); }}
                    className="text-[10px] font-black text-[#FF9900] hover:text-[#E47911] flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-magnifying-glass text-[9px]"></i>
                    Voir tous les résultats pour "{searchQuery}"
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-grow md:hidden" />

          {/* RIGHT ACTIONS */}
          <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">

            {/* MEMBER BADGE */}
            {isMember && (
              <span className="hidden lg:flex items-center gap-1 bg-[#FF9900]/15 border border-[#FF9900]/30 text-[#CC7700] px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap">
                <i className="fa-solid fa-crown text-[9px]"></i>Elite −20%
              </span>
            )}

            {/* ACCOUNT */}
            <div className="hidden sm:block">
              {user ? (
                <ProfileDropdown user={user} profile={profile} signOut={handleSignOut} />
              ) : (
                <Link to="/login"
                  className="flex flex-col items-start text-[#1a1a1a] border border-transparent hover:border-[#C8BDB3] hover:bg-[#F5F0EA] rounded px-2 py-1 transition-all"
                >
                  <span className="text-[11px] text-[#7a6f66] leading-none mb-0.5">Bonjour, connectez-vous</span>
                  <span className="text-[13px] font-bold leading-none flex items-center gap-1">
                    Compte &amp; Listes <i className="fa-solid fa-caret-down text-[10px]"></i>
                  </span>
                </Link>
              )}
            </div>

            {/* RETURNS / ORDERS */}
            <Link to="/profile?tab=orders"
              className="hidden lg:flex flex-col items-start text-[#1a1a1a] border border-transparent hover:border-[#C8BDB3] hover:bg-[#F5F0EA] rounded px-2 py-1 transition-all"
            >
              <span className="text-[11px] text-[#7a6f66] leading-none mb-0.5">Retours</span>
              <span className="text-[13px] font-bold leading-none">&amp; Commandes</span>
            </Link>

            {/* WISHLIST */}
            {user && (
              <Link to="/wishlist"
                className="hidden sm:flex text-[#1a1a1a] border border-transparent hover:border-[#C8BDB3] hover:bg-[#F5F0EA] rounded p-2 transition-all"
              >
                <i className="fa-regular fa-heart text-xl"></i>
              </Link>
            )}

            {/* THEME TOGGLE */}
            <button onClick={toggleTheme}
              className="hidden md:flex text-[#1a1a1a] border border-transparent hover:border-[#C8BDB3] hover:bg-[#F5F0EA] rounded p-2 transition-all"
            >
              <i className={`fa-solid text-base ${isDark ? "fa-sun text-[#FF9900]" : "fa-moon text-[#5f5752]"}`}></i>
            </button>

            {/* CART */}
            <button onClick={toggleCart}
              className={`relative flex items-end gap-1 text-[#1a1a1a] border border-transparent hover:border-[#C8BDB3] hover:bg-[#F5F0EA] rounded px-2 py-1 transition-all ${cartBump ? "scale-110" : "scale-100"}`}
            >
              <div className="relative">
                <i className="fa-solid fa-cart-shopping text-2xl md:text-[26px] text-[#1a1a1a]"></i>
                {cartCount > 0 && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#FF9900] text-[#0F1111] text-[11px] font-black min-w-[20px] h-5 flex items-center justify-center rounded-full leading-none px-1">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </div>
              <span className="hidden md:block text-[13px] font-bold mb-0.5">Panier</span>
            </button>

            {/* SELL */}
            <Link to="/admin"
              className="hidden md:flex items-center gap-1.5 bg-[#FF9900] hover:bg-[#E47911] text-[#0F1111] px-3 py-2 rounded-lg text-[12px] font-bold transition-colors whitespace-nowrap flex-shrink-0 shadow-sm"
            >
              <i className="fa-solid fa-store text-xs"></i>
              <span>Vendre</span>
            </Link>

            {/* HAMBURGER */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden text-[#1a1a1a] border border-transparent hover:border-[#C8BDB3] hover:bg-[#F5F0EA] rounded p-2 transition-all"
            >
              <i className={`fa-solid text-lg ${mobileMenuOpen ? "fa-xmark" : "fa-bars"}`}></i>
            </button>
          </div>
        </div>

        {/* MOBILE SEARCH ROW */}
        <div className="md:hidden px-3 pb-2">
          <form onSubmit={handleSearch}
            className="flex h-10 rounded-lg overflow-hidden border border-[#D5CDC4] focus-within:border-[#FF9900] focus-within:ring-2 focus-within:ring-[#FF9900]/20 transition-all"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher des produits..."
              className="flex-grow bg-white text-[#0F1111] px-3 text-sm outline-none min-w-0"
            />
            <button type="button" onClick={toggleVisualSearch}
              className="bg-white px-2.5 border-l border-[#D5CDC4] text-[#9a8f86] hover:text-[#FF9900] transition-colors flex-shrink-0"
            >
              <i className="fa-solid fa-camera text-sm"></i>
            </button>
            <button type="submit"
              className="bg-[#FF9900] hover:bg-[#E47911] text-[#0F1111] px-4 transition-colors flex-shrink-0"
            >
              <i className="fa-solid fa-magnifying-glass text-base"></i>
            </button>
          </form>
        </div>
      </nav>

      {/* ── CATEGORY BAR ── */}
      <div id="amz-catbar" className="fixed left-0 right-0 z-[105] bg-[#F2EDE8] border-t border-[#E8E1D9] border-b border-b-[#E0D8D1]">
        <div className="max-w-[1600px] mx-auto px-3 md:px-6">
          <div className="flex items-center overflow-x-auto hide-scrollbar h-10 gap-0.5">

            {/* ALL */}
            <button onClick={() => navigate("/store")}
              className="flex items-center gap-1.5 text-[#2D2A27] text-[13px] font-bold hover:bg-[#EAE3DB] px-3 h-8 rounded-md transition-colors flex-shrink-0"
            >
              <i className="fa-solid fa-bars text-[11px] text-[#FF9900]"></i>
              <span>Tout</span>
            </button>

            {/* CATEGORIES */}
            {CATEGORIES.map(cat => (
              <button key={cat.name}
                onClick={() => navigate(cat.catKey ? `/search?cat=${encodeURIComponent(cat.catKey)}` : "/search")}
                className="flex items-center gap-1.5 text-[#2D2A27] text-[13px] hover:bg-[#EAE3DB] px-3 h-8 rounded-md transition-colors flex-shrink-0 whitespace-nowrap"
              >
                {cat.name === "Flash Deals" ? (
                  <span className="text-[#E47911] font-black flex items-center gap-1">
                    <i className="fa-solid fa-bolt text-[10px]"></i>
                    {cat.name}
                  </span>
                ) : (
                  <span className="font-medium">
                    {cat.name}
                    {cat.isNew && (
                      <span className="ml-1.5 text-[9px] bg-pink-500 text-white px-1.5 py-0.5 rounded font-bold">NEW</span>
                    )}
                  </span>
                )}
              </button>
            ))}

            <div className="flex-grow min-w-2" />

            {/* BOUTIQUES */}
            <Link to="/boutiques"
              className="flex items-center gap-1 text-[#2D2A27] text-[13px] hover:bg-[#EAE3DB] px-3 h-8 rounded-md transition-colors flex-shrink-0 whitespace-nowrap font-medium"
            >
              <i className="fa-solid fa-store text-[11px] text-[#9a8f86]"></i>
              <span className="hidden sm:inline">Boutiques</span>
            </Link>

            {/* STUDIO */}
            <Link to="/studio"
              className="flex items-center gap-1.5 text-[#E47911] text-[13px] font-bold hover:bg-[#EAE3DB] px-3 h-8 rounded-md transition-colors flex-shrink-0 whitespace-nowrap"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-[11px]"></i>
              <span className="hidden sm:inline">Studio Lab</span>
            </Link>
          </div>
        </div>
      </div>

      {/* MOBILE BACKDROP */}
      <div
        className={`xl:hidden fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* MOBILE DRAWER */}
      <div
        className={`xl:hidden fixed left-0 top-0 bottom-0 z-[210] bg-white border-r border-[#E8E1D9] flex flex-col shadow-2xl transition-transform duration-300 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: "min(300px, 85vw)" }}
      >
        {/* DRAWER HEADER */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#F2EDE8] border-b border-[#E8E1D9] flex-shrink-0">
          <div className="flex items-center gap-2">
            {user ? (
              <div className="w-8 h-8 rounded-full bg-[#FF9900] flex items-center justify-center overflow-hidden">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[#0F1111] font-black text-sm">{initial}</span>
                }
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#E8E1D9] flex items-center justify-center">
                <i className="fa-solid fa-user text-[#9a8f86] text-sm"></i>
              </div>
            )}
            <span className="text-[#1a1a1a] font-bold text-sm">
              {user
                ? (profile?.full_name || user?.email?.split("@")[0] || "Mon compte")
                : "Bonjour, identifiez-vous"}
            </span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="text-[#5f5752] p-1 hover:text-[#FF9900] transition-colors">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* DRAWER BODY */}
        <div className="flex-grow overflow-y-auto bg-white">

          {isMember && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FFF8D3] border-b border-[#FF9900]/20">
              <i className="fa-solid fa-crown text-[#FF9900] text-xs"></i>
              <span className="text-xs font-bold text-[#CC7700]">Membre Elite — −20% sur tout</span>
            </div>
          )}

          {!user && (
            <div className="px-4 py-3 border-b border-[#E8E1D9]">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] py-2 rounded text-sm font-bold mb-2 transition-colors"
              >
                Se connecter
              </Link>
              <Link to="/register" onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center border border-[#D5CDC4] text-[#1a1a1a] py-2 rounded text-sm transition-colors hover:bg-[#F5F0EA]"
              >
                Créer un compte
              </Link>
            </div>
          )}

          {/* NAV LINKS */}
          <div className="py-2 border-b border-[#E8E1D9]">
            <p className="text-[#FF9900] text-[10px] font-black uppercase tracking-wider px-4 py-1.5">Menu principal</p>
            {[
              { to: "/",      icon: "fa-house",               label: "Accueil"     },
              { to: "/store", icon: "fa-bag-shopping",         label: "Store"       },
              { to: "/studio",icon: "fa-wand-magic-sparkles",  label: "Studio Lab"  },
              ...(user ? [
                { to: "/profile",           icon: "fa-user",          label: "Mon profil"   },
                { to: "/track",             icon: "fa-location-dot",  label: "Suivi commande" },
                { to: "/profile?tab=orders",icon: "fa-box",           label: "Commandes"      },
                { to: "/wishlist",          icon: "fa-heart",         label: "Wishlist"        },
                ...(["emansoga@gmail.com","nsogadavid01@gmail.com"].includes(user?.email) ? [{ to: "/super-admin", icon: "fa-shield-halved", label: "Super Admin" }] : []),
              ] : []),
            ].map(link => (
              <Link key={link.to} to={link.to} onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-[#1a1a1a] hover:bg-[#F5F0EA] transition-colors text-sm"
              >
                <i className={`fa-solid ${link.icon} text-[#FF9900] w-4`}></i>
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          {/* CATEGORIES */}
          <div className="py-2 border-b border-[#E8E1D9]">
            <p className="text-[#FF9900] text-[10px] font-black uppercase tracking-wider px-4 py-1.5">Catégories</p>
            {CATEGORIES.map(cat => (
              <Link key={cat.name} to={cat.catKey ? `/search?cat=${encodeURIComponent(cat.catKey)}` : "/search"} onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-[#1a1a1a] hover:bg-[#F5F0EA] transition-colors text-sm"
              >
                <i className={`fa-solid ${cat.icon} text-[#FF9900] w-4`}></i>
                <span>{cat.name}</span>
                {cat.isNew && (
                  <span className="ml-1 text-[9px] bg-pink-500 text-white px-1.5 py-0.5 rounded font-bold">NEW</span>
                )}
              </Link>
            ))}
          </div>

          {/* THEME */}
          <div className="py-2">
            <button onClick={toggleTheme}
              className="flex items-center gap-3 px-4 py-3 text-[#1a1a1a] hover:bg-[#F5F0EA] transition-colors text-sm w-full"
            >
              <i className={`fa-solid ${isDark ? "fa-sun text-[#FF9900]" : "fa-moon text-[#5f5752]"} w-4`}></i>
              <span>{isDark ? "Mode clair" : "Mode sombre"}</span>
            </button>
          </div>
        </div>

        {/* DRAWER FOOTER */}
        <div className="flex-shrink-0 border-t border-[#E8E1D9] p-4 space-y-2 bg-[#FAF7F4]">
          <Link to="/admin" onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 bg-[#FF9900] hover:bg-[#E47911] text-[#0F1111] p-3 rounded-lg font-bold text-sm w-full transition-colors shadow-sm"
          >
            <i className="fa-solid fa-store text-xs"></i>
            <span>Devenir Vendeur</span>
          </Link>
          {user ? (
            <button onClick={() => { setMobileMenuOpen(false); handleSignOut(); }}
              className="flex items-center justify-center gap-2 border border-[#D5CDC4] text-[#7a6f66] p-2.5 rounded-lg text-sm w-full hover:border-red-300 hover:text-red-500 transition-all"
            >
              <i className="fa-solid fa-right-from-bracket text-xs"></i>
              <span>Se déconnecter</span>
            </button>
          ) : (
            <Link to="/rewards" onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 border border-[#FF9900]/30 text-[#CC7700] p-2.5 rounded-lg text-sm w-full hover:border-[#FF9900] hover:bg-[#FFF8D3] transition-all"
            >
              <i className="fa-solid fa-crown text-xs"></i>
              <span>Programme fidélité</span>
            </Link>
          )}
        </div>
      </div>

      {/* SPACER */}
      <div className="h-[166px] md:h-[128px]" aria-hidden="true" />

      <style>{`
        #amz-catbar { top: 126px; }
        @media (min-width: 768px) { #amz-catbar { top: 88px; } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .logo-font { font-family: 'Syncopate', sans-serif; }
      `}</style>
    </>
  );
};

export default Navbar;
