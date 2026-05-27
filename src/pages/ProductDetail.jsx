import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ProductCard from "../components/ProductCard";
import ReviewsSection from "../components/ReviewsSection";
import { useWishlist } from "../hooks/useWishlist";
import { useAuth } from "../context/AuthContext";

// ─── VILLES DE LIVRAISON ──────────────────────────────────────────────────────
const DELIVERY_ZONES = [
  { city: "Bonamoussadi", delay: "30min – 1h",  price: 0,      note: "🎁 Promo 1 mois", icon: "fa-bolt",       color: "text-[#FF9900]",  badge: "GRATUIT", promo: true },
  { city: "Douala",       delay: "2h – 4h",     price: 1000,   note: "Express ville",   icon: "fa-bolt",       color: "text-[#FF9900]",  badge: "1 000 F" },
  { city: "Yaoundé",      delay: "24h – 48h",   price: 2500,   note: "J+1 garanti",     icon: "fa-truck-fast", color: "text-blue-400",   badge: "J+1" },
  { city: "Bafoussam",   delay: "24h – 48h",   price: 2500,   note: "Via transport",   icon: "fa-truck",      color: "text-purple-400", badge: "J+1" },
  { city: "Buea",        delay: "24h",          price: 1500,   note: "Région du S.O",   icon: "fa-truck-fast", color: "text-orange-400", badge: "J+1" },
  { city: "Kribi",       delay: "2 – 3 jours", price: 3000,   note: "Via partenaire",  icon: "fa-truck",      color: "text-zinc-400",   badge: "J+2" },
  { city: "Limbe",       delay: "24h",          price: 1500,   note: "Région du S.O",   icon: "fa-truck-fast", color: "text-orange-400", badge: "J+1" },
  { city: "Ngaoundéré",  delay: "3 – 5 jours", price: 4500,   note: "Nord Cameroun",   icon: "fa-truck",      color: "text-red-400",    badge: "J+3" },
  { city: "Garoua",      delay: "3 – 5 jours", price: 4500,   note: "Nord Cameroun",   icon: "fa-truck",      color: "text-red-400",    badge: "J+3" },
  { city: "Maroua",      delay: "4 – 6 jours", price: 5000,   note: "Extrême-Nord",    icon: "fa-truck",      color: "text-red-500",    badge: "J+4" },
  { city: "Bamenda",     delay: "48h",          price: 3000,   note: "N.O Region",      icon: "fa-truck",      color: "text-zinc-400",   badge: "J+2" },
  { city: "Ebolowa",     delay: "2 – 3 jours", price: 3500,   note: "Via partenaire",  icon: "fa-truck",      color: "text-zinc-400",   badge: "J+2" },
  { city: "Diaspora",    delay: "5 – 10 jours",price: 0,      note: "Commande cadeau", icon: "fa-plane",      color: "text-yellow-400", badge: "GIFT" },
];

// ─── PROMO ADS ────────────────────────────────────────────────────────────────
const PROMO_ADS = [
  {
    tag:   "Bundle Deal",
    title: "2 articles = −15%",
    sub:   "Ajoutez un 2ème produit et économisez automatiquement",
    icon:  "fa-percent",
    bg:    "from-[#FF9900]/15 to-[#FF9900]/5",
    border:"border-[#FF9900]/25",
    cta:   "Explorer le store",
    href:  "/store",
    accent:"text-[#FF9900]",
  },
  {
    tag:   "Membre Elite",
    title: "−20% sur tout",
    sub:   "Créez un compte gratuit et débloquez vos prix exclusifs",
    icon:  "fa-crown",
    bg:    "from-yellow-400/15 to-yellow-400/5",
    border:"border-yellow-400/25",
    cta:   "Créer un compte",
    href:  "/register",
    accent:"text-yellow-600",
  },
  {
    tag:   "Studio Lab",
    title: "Personnalise-le",
    sub:   "Grave, imprime, customise. Fais-en une pièce unique.",
    icon:  "fa-wand-magic-sparkles",
    bg:    "from-purple-500/15 to-purple-500/5",
    border:"border-purple-400/25",
    cta:   "Accéder au Studio",
    href:  "/studio",
    accent:"text-purple-600",
  },
];

// ─── BREADCRUMB ────────────────────────────────────────────────────────────────
const Breadcrumb = ({ product }) => (
  <nav className="flex items-center gap-2 text-xs text-[#565959] mb-4">
    <Link to="/" className="hover:text-[#C45500] hover:underline transition-colors">Accueil</Link>
    <i className="fa-solid fa-chevron-right text-[9px]"></i>
    <Link to="/store" className="hover:text-[#C45500] hover:underline transition-colors">Store</Link>
    <i className="fa-solid fa-chevron-right text-[9px]"></i>
    <span className="text-[#007185]">{product?.type}</span>
    <i className="fa-solid fa-chevron-right text-[9px]"></i>
    <span className="text-[#0F1111] truncate max-w-[200px]">{product?.name}</span>
  </nav>
);

// ─── IMAGE GALLERY ────────────────────────────────────────────────────────────
const ImageGallery = ({ product }) => {
  const [activeImg, setActiveImg] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  const images = useMemo(() => {
    if (product?.images?.length > 0) return product.images;
    return product?.img ? [product.img] : [];
  }, [product]);

  if (images.length === 0)
    return (
      <div className="aspect-square bg-white rounded border border-[#D5D9D9] flex items-center justify-center">
        <i className="fa-solid fa-image text-[#D5D9D9] text-4xl"></i>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded bg-white aspect-square cursor-zoom-in group border border-[#D5D9D9]"
        onClick={() => setZoomed(!zoomed)}
      >
        <img
          src={images[activeImg]}
          alt={product?.name}
          className={`w-full h-full object-contain transition-all duration-700 ${zoomed ? "scale-150" : "group-hover:scale-105"}`}
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {product?.status && (
            <span className="bg-[#CC0C39] text-white text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase">
              {product.status}
            </span>
          )}
          {product?.type && (
            <span className="bg-white text-[#565959] text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase border border-[#D5D9D9]">
              {product.type}
            </span>
          )}
        </div>
        <div className="absolute bottom-3 right-3 bg-white/90 text-[#565959] text-[9px] font-bold px-2.5 py-1 rounded border border-[#D5D9D9] opacity-0 group-hover:opacity-100 transition-opacity">
          <i className="fa-solid fa-magnifying-glass-plus mr-1"></i>Zoom
        </div>
        <div className="absolute top-3 right-3 bg-white border border-[#D5D9D9] rounded px-2 py-1.5 z-10 text-center">
          <p className="text-[#FF9900] text-[7px] font-bold uppercase tracking-widest leading-none mb-0.5">OneFreestyle</p>
          <p className="text-[#565959] text-[7px] font-bold uppercase leading-none">Authentic ✓</p>
        </div>
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveImg(i)}
              className={`aspect-square rounded overflow-hidden border-2 transition-all ${activeImg === i ? "border-[#FF9900]" : "border-[#D5D9D9] hover:border-[#adb5bd]"}`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── VIDEO ADS ────────────────────────────────────────────────────────────────
const VIDEO_ADS = [
  {
    src:   "https://alrbokstfwwlvbvghrqr.supabase.co/storage/v1/object/public/product-images/veo.mp4",
    tag:   "Nouvelle Collection",
    title: "Mode Femme Été 2025",
    sub:   "Pièces exclusives · Livraison express Douala",
    cta:   "Voir la collection",
    href:  "/store",
    accent:"#FF9900",
  },
  {
    src:   "https://alrbokstfwwlvbvghrqr.supabase.co/storage/v1/object/public/product-images/ads/veo2.mp4",
    tag:   "Flash Drop Audio",
    title: "The Ultimate Beat",
    sub:   "Casques & enceintes · Stock limité",
    cta:   "Réserver maintenant",
    href:  "/store",
    accent:"#3b82f6",
  },
  {
    src:   "https://videos.pexels.com/video-files/8899504/8899504-sd_640_360_25fps.mp4",
    tag:   "Membre Elite",
    title: "−20% sur tout",
    sub:   "Inscription gratuite · Prix exclusifs immédiats",
    cta:   "Rejoindre l'élite",
    href:  "/register",
    accent:"#FFD814",
  },
  {
    src:   "https://videos.pexels.com/video-files/4068684/4068684-sd_640_360_25fps.mp4",
    tag:   "Studio Lab",
    title: "Fais-en une pièce unique",
    sub:   "Personnalisation laser · Impression UV",
    cta:   "Accéder au Studio",
    href:  "/studio",
    accent:"#a855f7",
  },
];

// ─── VIDEO AD PANEL ───────────────────────────────────────────────────────────
const VideoAdPanel = () => {
  const [current,   setCurrent]   = useState(0);
  const [progress,  setProgress]  = useState(0);
  const [errored,   setErrored]   = useState({});
  const videoRef  = useRef(null);
  const timerRef  = useRef(null);
  const DURATION  = 12000;
  const ad        = VIDEO_ADS[current];

  const goTo = (i) => {
    setProgress(0);
    clearInterval(timerRef.current);
    setCurrent(i);
  };

  const next = () => goTo((current + 1) % VIDEO_ADS.length);

  useEffect(() => {
    setProgress(0);
    if (videoRef.current) { videoRef.current.load(); videoRef.current.play().catch(() => {}); }
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) next();
    }, 80);
    return () => clearInterval(timerRef.current);
  }, [current]);

  const hasError = errored[current];

  return (
    <div className="relative overflow-hidden rounded border border-[#D5D9D9] bg-zinc-900 flex flex-col min-h-[420px]">
      <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur-sm border border-white/10 px-2 py-0.5 rounded-full">
        <span className="text-[7px] font-black uppercase tracking-widest text-zinc-400">Pub · OneFreestyle</span>
      </div>

      <div className="relative flex-grow">
        {!hasError ? (
          <video
            ref={videoRef}
            key={ad.src}
            className="w-full h-full object-cover absolute inset-0"
            autoPlay muted loop playsInline
            onError={() => setErrored(prev => ({ ...prev, [current]: true }))}
          >
            <source src={ad.src} type="video/mp4" />
          </video>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: `radial-gradient(ellipse at center, ${ad.accent}22 0%, #09090b 70%)` }}
          >
            <i className="fa-solid fa-play-circle text-white/20 text-7xl"></i>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />

        <div className="absolute bottom-0 left-0 right-0 z-20 p-5">
          <span className="text-[8px] font-black uppercase tracking-widest mb-1 block" style={{ color: ad.accent }}>
            {ad.tag}
          </span>
          <h4 className="font-black text-xl tracking-tight text-white leading-tight mb-1">
            {ad.title}
          </h4>
          <p className="text-[10px] text-zinc-400 font-bold mb-4 leading-relaxed">{ad.sub}</p>
          <Link to={ad.href}
            className="inline-flex items-center gap-2 px-4 py-2 rounded font-bold text-[10px] uppercase tracking-widest text-black transition-all hover:opacity-90"
            style={{ backgroundColor: ad.accent }}
          >
            <span>{ad.cta}</span>
            <i className="fa-solid fa-arrow-right text-[8px]"></i>
          </Link>
        </div>
      </div>

      <div className="h-[3px] bg-white/10 w-full flex-shrink-0">
        <div className="h-full transition-none rounded-full" style={{ width: progress + "%", backgroundColor: ad.accent }} />
      </div>

      <div className="flex items-center justify-between px-5 py-3 bg-black/60 backdrop-blur-sm flex-shrink-0">
        <div className="flex gap-1.5">
          {VIDEO_ADS.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={"h-1.5 rounded-full transition-all duration-300 " + (i === current ? "w-6 opacity-100" : "w-1.5 opacity-30 bg-white")}
              style={i === current ? { backgroundColor: ad.accent, width: "1.5rem" } : {}}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => goTo((current - 1 + VIDEO_ADS.length) % VIDEO_ADS.length)}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <i className="fa-solid fa-chevron-left text-white text-[8px]"></i>
          </button>
          <button onClick={next}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <i className="fa-solid fa-chevron-right text-white text-[8px]"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── DELIVERY PANEL ───────────────────────────────────────────────────────────
const DeliveryPanel = ({ price: productPrice, qty, selectedCity, onCityChange }) => {
  const [open, setOpen] = useState(false);

  const deliveryFee    = selectedCity.price;
  const totalOrder     = Number(productPrice) * qty + deliveryFee;

  return (
    <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#D5D9D9]">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-truck-fast text-[#FF9900] text-sm"></i>
          <span className="font-bold text-sm text-[#0F1111]">Livraison & Expédition</span>
        </div>
        <span className="text-[9px] font-bold uppercase text-[#FF9900] bg-[#FF9900]/10 px-2 py-0.5 rounded border border-[#FF9900]/20">
          Toutes villes
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* SÉLECTEUR DE VILLE */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-2">Ta ville de livraison</p>
          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="w-full flex items-center justify-between bg-white border border-[#D5D9D9] hover:border-[#FF9900] rounded px-4 py-3 transition-all"
            >
              <div className="flex items-center gap-3">
                <i className={`fa-solid ${selectedCity.icon} ${selectedCity.color} text-sm`}></i>
                <div className="text-left">
                  <p className="font-bold text-[13px] text-[#0F1111]">{selectedCity.city}</p>
                  <p className="text-[10px] text-[#565959]">{selectedCity.note}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={"text-[10px] font-bold uppercase px-2 py-0.5 rounded " + (selectedCity.price === 0 ? "bg-[#FF9900]/10 text-[#FF9900] border border-[#FF9900]/20" : "bg-[#F3F4F4] text-[#565959] border border-[#D5D9D9]")}>
                  {selectedCity.price === 0 ? selectedCity.badge : `+${selectedCity.price.toLocaleString()} F`}
                </span>
                <i className={"fa-solid fa-chevron-down text-[#565959] text-xs transition-transform " + (open ? "rotate-180" : "")}></i>
              </div>
            </button>

            {open && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-[#D5D9D9] rounded shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                {DELIVERY_ZONES.map((zone) => (
                  <button
                    key={zone.city}
                    onClick={() => { onCityChange(zone); setOpen(false); }}
                    className={"w-full flex items-center justify-between px-4 py-3 hover:bg-[#F3F4F4] transition-colors border-b border-[#F3F4F4] last:border-0 " + (selectedCity.city === zone.city ? "bg-[#FFF8F0]" : "")}
                  >
                    <div className="flex items-center gap-3">
                      <i className={`fa-solid ${zone.icon} ${zone.color} text-xs`}></i>
                      <div className="text-left">
                        <p className="font-bold text-[12px] text-[#0F1111]">{zone.city}</p>
                        <p className="text-[10px] text-[#565959]">{zone.delay} · {zone.note}</p>
                      </div>
                    </div>
                    <span className={"text-[9px] font-bold uppercase px-2 py-0.5 rounded " + (zone.price === 0 ? "bg-[#FF9900]/10 text-[#FF9900]" : "bg-[#F3F4F4] text-[#565959]")}>
                      {zone.price === 0 ? zone.badge : `${zone.price.toLocaleString()} FCFA`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* INFOS LIVRAISON CHOISIE */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#F3F4F4] border border-[#D5D9D9] rounded p-3">
            <p className="text-[10px] font-bold uppercase text-[#565959] mb-1 tracking-wide">Délai estimé</p>
            <p className="font-bold text-sm text-[#0F1111]">{selectedCity.delay}</p>
            <p className="text-[10px] text-[#565959] mt-0.5">{selectedCity.note}</p>
          </div>
          <div className="bg-[#F3F4F4] border border-[#D5D9D9] rounded p-3">
            <p className="text-[10px] font-bold uppercase text-[#565959] mb-1 tracking-wide">Frais livraison</p>
            <p className={"font-bold text-sm " + (deliveryFee === 0 ? "text-[#007600]" : "text-[#0F1111]")}>
              {deliveryFee === 0 ? "GRATUIT" : `${deliveryFee.toLocaleString()} FCFA`}
            </p>
            {selectedCity.city === "Douala" && (
              <p className="text-[10px] text-[#CC0C39] font-bold mt-0.5">Express 2h–4h 🔥</p>
            )}
          </div>
        </div>

        {/* EXPÉDITION DEPUIS */}
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded p-3">
          <i className="fa-solid fa-warehouse text-blue-500 text-sm flex-shrink-0"></i>
          <div>
            <p className="text-[10px] font-bold uppercase text-blue-700 tracking-wide">Expédié depuis</p>
            <p className="text-[12px] font-bold text-[#0F1111]">Bonamoussadi, Douala 🇨🇲</p>
            <p className="text-[10px] text-[#565959]">Préparation : 30 min après confirmation</p>
          </div>
        </div>

        {/* RÉCAPITULATIF COMMANDE */}
        <div className="border-t border-[#D5D9D9] pt-4 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#565959] uppercase tracking-wide">Sous-total ({qty}×)</span>
            <span className="font-bold text-[#0F1111]">{(Number(productPrice) * qty).toLocaleString()} FCFA</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#565959] uppercase tracking-wide">Livraison → {selectedCity.city}</span>
            <span className={"font-bold " + (deliveryFee === 0 ? "text-[#007600]" : "text-[#0F1111]")}>
              {deliveryFee === 0 ? "Gratuite" : `+${deliveryFee.toLocaleString()} FCFA`}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[#D5D9D9]">
            <span className="font-bold text-sm text-[#0F1111]">Total estimé</span>
            <span className="font-bold text-xl text-[#B12704]">{totalOrder.toLocaleString()} <span className="text-sm text-[#565959]">FCFA</span></span>
          </div>
        </div>

        {/* PAIEMENTS */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#565959] mb-2">Modes de paiement acceptés</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { icon: "fa-mobile-screen-button", label: "Orange Money", color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
              { icon: "fa-money-bill-wave",       label: "Cash / Livraison", color: "text-emerald-500", bg: "bg-emerald-50 border-emerald-200" },
              { icon: "fa-mobile-screen-button", label: "MTN MoMo", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
            ].map(p => (
              <div key={p.label} className={"flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[9px] font-bold uppercase " + p.bg}>
                <i className={"fa-solid " + p.icon + " " + p.color + " text-xs"}></i>
                <span className="text-[#565959]">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* GARANTIES */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { icon: "fa-shield-check",    label: "Paiement sécurisé",  color: "text-blue-500",   bg: "bg-blue-50 border-blue-100" },
            { icon: "fa-rotate-left",     label: "Retour 7 jours",      color: "text-purple-500", bg: "bg-purple-50 border-purple-100" },
            { icon: "fa-headset",         label: "Support 7j/7",        color: "text-[#FF9900]",  bg: "bg-[#FF9900]/8 border-[#FF9900]/15" },
          ].map(g => (
            <div key={g.label} className={"border rounded p-2.5 text-center " + g.bg}>
              <i className={"fa-solid " + g.icon + " " + g.color + " text-sm mb-1 block"}></i>
              <p className="text-[8px] font-bold uppercase text-[#565959] leading-tight">{g.label}</p>
            </div>
          ))}
        </div>

        {/* DIASPORA NOTE */}
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded p-3">
          <i className="fa-solid fa-plane text-yellow-500 text-sm flex-shrink-0 mt-0.5"></i>
          <div>
            <p className="text-[10px] font-bold uppercase text-yellow-700 tracking-wide">Commande depuis l'étranger ?</p>
            <p className="text-[11px] text-[#565959] mt-0.5 leading-relaxed">
              Envoyez un cadeau à vos proches au Cameroun. Commandez en ligne, livraison directe à Douala et partout au pays.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── SKELETON ─────────────────────────────────────────────────────────────────
const DetailSkeleton = () => (
  <div className="animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-10">
    <div className="aspect-square bg-[#F3F4F4] rounded border border-[#D5D9D9]"></div>
    <div className="space-y-6">
      <div className="h-4 bg-[#F3F4F4] rounded w-1/3"></div>
      <div className="h-10 bg-[#F3F4F4] rounded w-full"></div>
      <div className="h-8 bg-[#F3F4F4] rounded w-1/4"></div>
      <div className="grid grid-cols-5 gap-2">
        {[...Array(5)].map((_,i) => <div key={i} className="h-12 bg-[#F3F4F4] rounded"></div>)}
      </div>
      <div className="h-14 bg-[#F3F4F4] rounded"></div>
    </div>
  </div>
);

// ─── PUB CARD ─────────────────────────────────────────────────────────────────
const PromoAdCard = ({ ad }) => (
  <Link
    to={ad.href}
    className={"relative overflow-hidden rounded border p-5 flex flex-col justify-between bg-gradient-to-br hover:shadow-md transition-all min-h-[160px] group " + ad.bg + " " + ad.border}
  >
    <div>
      <span className={"text-[9px] font-bold uppercase tracking-widest " + ad.accent}>{ad.tag}</span>
      <h4 className={"font-bold text-xl leading-none mt-1 " + ad.accent}>{ad.title}</h4>
      <p className="text-[11px] text-[#565959] font-medium mt-2 leading-relaxed">{ad.sub}</p>
    </div>
    <div className={"inline-flex items-center gap-2 mt-4 text-[10px] font-bold uppercase tracking-widest " + ad.accent}>
      <span>{ad.cta}</span>
      <i className="fa-solid fa-arrow-right text-[9px] group-hover:translate-x-1 transition-transform"></i>
    </div>
    <i className={"fa-solid " + ad.icon + " absolute -bottom-3 -right-3 text-6xl opacity-[0.06]"}></i>
  </Link>
);

// ─── RELATED + SUGGESTIONS SECTION ────────────────────────────────────────────
const SuggestionsSection = ({ currentProduct, openModal, addToCart }) => {
  const [sameType,   setSameType]   = useState([]);
  const [trending,   setTrending]   = useState([]);
  const [sameVendor, setSameVendor] = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!currentProduct) return;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const { data: typeData } = await supabase
          .from("products")
          .select("*, vendor:vendors!vendor_id(member_discount_enabled, shop_name)")
          .eq("type", currentProduct.type)
          .neq("id", currentProduct.id)
          .limit(12);
        setSameType(typeData || []);

        if (currentProduct.vendor_id) {
          const { data: vendorData } = await supabase
            .from("products")
            .select("*, vendor:vendors!vendor_id(member_discount_enabled, shop_name)")
            .eq("vendor_id", currentProduct.vendor_id)
            .neq("id", currentProduct.id)
            .limit(8);
          setSameVendor(vendorData || []);
        }

        const { data: trendData } = await supabase
          .from("products")
          .select("*, vendor:vendors!vendor_id(member_discount_enabled, shop_name)")
          .neq("type", currentProduct.type)
          .neq("id", currentProduct.id)
          .limit(12);
        setTrending(trendData || []);
      } catch (err) {
        console.error("[SuggestionsSection]", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [currentProduct]);

  const SkeletonGrid = ({ count = 6 }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {[...Array(count)].map((_,i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[3/4] bg-[#F3F4F4] rounded mb-2"></div>
          <div className="h-3 bg-[#F3F4F4] rounded w-3/4 mb-1"></div>
          <div className="h-2 bg-[#F3F4F4] rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="mt-12 space-y-12">

      {/* ── MÊME CATÉGORIE ── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-[#FF9900] rounded-full"></div>
            <div>
              <h3 className="text-lg font-bold text-[#0F1111]">
                Plus de <span className="text-[#FF9900]">{currentProduct?.type}</span>
              </h3>
              <p className="text-[10px] text-[#565959] mt-0.5">
                {loading ? "..." : `${sameType.length} produits similaires`}
              </p>
            </div>
          </div>
          <Link to="/store" className="text-sm text-[#007185] hover:text-[#C45500] hover:underline flex items-center gap-1">
            <span>Voir tout</span><i className="fa-solid fa-arrow-right text-xs"></i>
          </Link>
        </div>
        {loading ? <SkeletonGrid count={6} /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {sameType.map(p => (
              <ProductCard key={p.id} product={p} openModal={openModal} addToCart={addToCart} />
            ))}
          </div>
        )}
      </section>

      {/* ── BANDE PROMO ADS ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <i className="fa-solid fa-bolt text-[#FF9900] text-sm"></i>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#565959]">Offres exclusives OneFreestyle</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PROMO_ADS.map(ad => <PromoAdCard key={ad.tag} ad={ad} />)}
        </div>
      </section>

      {/* ── MÊME BOUTIQUE ── */}
      {sameVendor.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-[#007185] rounded-full"></div>
              <div>
                <h3 className="text-lg font-bold text-[#0F1111]">
                  De la même <span className="text-[#007185]">boutique</span>
                </h3>
                <p className="text-[10px] text-[#565959] mt-0.5">
                  {sameVendor.length} autres produits disponibles
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {sameVendor.slice(0, 6).map(p => (
              <ProductCard key={p.id} product={p} openModal={openModal} addToCart={addToCart} />
            ))}
            {sameVendor.length > 6 && currentProduct?.vendor_id && (
              <Link
                to={`/shop/${sameVendor[0]?.vendor?.shop_name || ""}`}
                className="flex flex-col items-center justify-center aspect-[3/4] rounded border-2 border-dashed border-[#D5D9D9] hover:border-[#FF9900] group transition-all"
              >
                <i className="fa-solid fa-store text-[#D5D9D9] group-hover:text-[#FF9900] text-2xl mb-3 transition-colors"></i>
                <p className="text-[10px] font-bold uppercase text-[#565959] group-hover:text-[#FF9900] text-center transition-colors">Voir<br/>tout</p>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ── BANNIÈRE BUNDLE ── */}
      <section className="bg-[#232F3E] text-white rounded overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF9900]/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FFD814]/4 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-[#FF9900] mb-2 block">Bundle Deal Elite</span>
            <h3 className="text-3xl font-bold leading-none mb-2">
              Ajoutez un 2ème article<br/><span className="text-[#FF9900]">et économisez 15%</span>
            </h3>
            <p className="text-[#ADBAC7] text-sm max-w-md">
              Applicable automatiquement dès 2 articles dans votre panier. Aucun code promo requis.
            </p>
          </div>
          <Link to="/store"
            className="flex-shrink-0 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-8 py-4 rounded font-bold uppercase text-[10px] tracking-widest transition-all hover:scale-105 flex items-center gap-2 whitespace-nowrap"
          >
            <i className="fa-solid fa-bag-shopping text-sm"></i>
            <span>Explorer le store</span>
          </Link>
        </div>
      </section>

      {/* ── TRENDING — AUTRES CATÉGORIES ── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-orange-400 rounded-full"></div>
            <div>
              <h3 className="text-lg font-bold text-[#0F1111]">
                Trending <span className="text-orange-500">en ce moment</span>
              </h3>
              <p className="text-[10px] text-[#565959] mt-0.5">
                D'autres catégories · Toujours elite
              </p>
            </div>
          </div>
          <Link to="/store" className="text-sm text-[#007185] hover:text-[#C45500] hover:underline flex items-center gap-1">
            <span>Voir tout</span><i className="fa-solid fa-arrow-right text-xs"></i>
          </Link>
        </div>
        {loading ? <SkeletonGrid count={8} /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {trending.slice(0, 3).map(p => (
              <ProductCard key={p.id} product={p} openModal={openModal} addToCart={addToCart} />
            ))}
            <Link to="/register"
              className="relative overflow-hidden rounded bg-gradient-to-br from-[#FFD814]/20 to-[#FFD814]/5 border border-[#FFD814]/30 flex flex-col justify-between p-4 hover:shadow-md transition-all aspect-[3/4] group"
            >
              <div>
                <i className="fa-solid fa-crown text-[#FF9900] text-xl mb-2 block"></i>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#FF9900]">Membre Elite</p>
                <p className="font-bold text-base leading-tight text-[#0F1111] mt-1">−20%<br/>sur tout</p>
              </div>
              <span className="text-[9px] font-bold uppercase text-[#007185] group-hover:underline">S'inscrire →</span>
            </Link>
            {trending.slice(3, 9).map(p => (
              <ProductCard key={p.id} product={p} openModal={openModal} addToCart={addToCart} />
            ))}
            <Link to="/studio"
              className="relative overflow-hidden rounded bg-gradient-to-br from-purple-500/15 to-purple-500/5 border border-purple-400/25 flex flex-col justify-between p-4 hover:shadow-md transition-all aspect-[3/4] group"
            >
              <div>
                <i className="fa-solid fa-wand-magic-sparkles text-purple-500 text-xl mb-2 block"></i>
                <p className="text-[9px] font-bold uppercase tracking-widest text-purple-600">Studio Lab</p>
                <p className="font-bold text-base leading-tight text-[#0F1111] mt-1">Perso-<br/>nalise-le</p>
              </div>
              <span className="text-[9px] font-bold uppercase text-purple-600 group-hover:underline">Studio →</span>
            </Link>
            {trending.slice(9).map(p => (
              <ProductCard key={p.id} product={p} openModal={openModal} addToCart={addToCart} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
};

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────
const ProductDetail = ({ addToCart, openModal }) => {
  const { productId } = useParams();
  const navigate      = useNavigate();
  const location      = useLocation();

  const [product,       setProduct]       = useState(location.state?.product || null);
  const [vendor,        setVendor]        = useState(null);
  const [loading,       setLoading]       = useState(!location.state?.product);
  const [size,          setSize]          = useState("M");
  const [color,         setColor]         = useState("Black");
  const [qty,           setQty]           = useState(1);
  const [selectedCity,  setSelectedCity]  = useState(DELIVERY_ZONES[0]);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [activeTab,     setActiveTab]     = useState("specs");
  const [shareToast,    setShareToast]    = useState(false);

  const { user }   = useAuth();
  const { isInWishlist, toggle: toggleWishlist } = useWishlist();
  const wishlist   = isInWishlist(product?.id);

  useEffect(() => {
    if (!product) {
      supabase.from("products").select("*").eq("id", productId).single().then(({ data, error }) => {
        if (!error && data) setProduct(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (product?.vendor_id) {
      supabase.from("vendors").select("*").eq("id", product.vendor_id).single().then(({ data }) => setVendor(data));
    }
  }, [product]);

  useEffect(() => {
    if (product) { setSize("M"); setColor("Black"); setQty(1); }
  }, [product]);

  const handleAddToCart = () => {
    const isShoes   = product?.type === "Shoes";
    const isApparel = product?.type === "Clothing";
    const deliveryFee  = selectedCity.price;
    const unitPrice    = Number(product.price);
    const totalOrder   = unitPrice * qty + deliveryFee;
    addToCart({
      ...product,
      selectedSize:      isShoes || isApparel ? size : "Unique",
      selectedColor:     color,
      quantity:          qty,
      deliveryCity:      selectedCity.city,
      deliveryFee,
      totalWithDelivery: totalOrder,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) { navigator.share({ title: product?.name, url }); }
    else { navigator.clipboard.writeText(url); setShareToast(true); setTimeout(() => setShareToast(false), 2000); }
  };

  const isApparel = product?.type === "Clothing";
  const isShoes   = product?.type === "Shoes";

  const COLOR_MAP = {
    Black:"#111",White:"#f5f5f5",Neon:"#00ff88",Red:"#ef4444",Blue:"#3b82f6",Navy:"#1e3a5f",
    Sky:"#38bdf8",Slate:"#64748b",Gray:"#9ca3af",Brown:"#92400e",Beige:"#d4b896",Camel:"#c19a6b",
    Green:"#16a34a",Olive:"#65a30d",Yellow:"#facc15",Orange:"#f97316",Pink:"#ec4899",Purple:"#a855f7",
    Burgundy:"#7f1d1d",Gold:"#d97706",Silver:"#c0c0c0",Khaki:"#c3b091",Teal:"#0d9488",Coral:"#fb7185",
  };
  const productColors = product?.colors?.length
    ? product.colors.map(name => ({ name, hex: COLOR_MAP[name] ?? "#888" }))
    : [{ name:"Black",hex:"#111" },{ name:"White",hex:"#f5f5f5" },{ name:"Neon",hex:"#00ff88" }];

  return (
    <div className="min-h-screen bg-[#EAEDED] text-[#0F1111] pt-[120px] pb-20">
      {shareToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[400] bg-[#232F3E] text-[#FF9900] px-6 py-3 rounded font-bold text-[10px] uppercase tracking-widest shadow-xl">
          <i className="fa-solid fa-check mr-2"></i>Lien copié !
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        {!loading && product && <Breadcrumb product={product} />}

        {loading ? <DetailSkeleton /> : !product ? (
          <div className="text-center py-32">
            <p className="text-3xl font-bold text-[#565959]">Produit introuvable</p>
            <button onClick={() => navigate("/store")}
              className="mt-6 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-8 py-3 rounded font-bold text-sm border border-[#FCD200] transition-all"
            >Retour au Store</button>
          </div>
        ) : (
          <>
            {/* ── MAIN GRID ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12">
              <ImageGallery product={product} />

              <div className="flex flex-col gap-5">
                {/* TAG + NAME */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#FF9900] border border-[#FF9900]/30 bg-[#FF9900]/10 px-2.5 py-1 rounded">
                      {product.type}
                    </span>
                    {vendor?.shop_name && (
                      <Link to={`/shop/${vendor.shop_name}`}
                        className="text-[10px] text-[#007185] hover:text-[#C45500] flex items-center gap-1.5 transition-colors hover:underline"
                      >
                        <div className="w-4 h-4 bg-[#F3F4F4] rounded-full flex items-center justify-center border border-[#D5D9D9]">
                          <i className="fa-solid fa-store text-[#565959] text-[6px]"></i>
                        </div>
                        <span>{vendor.shop_name}</span>
                        <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                      </Link>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold leading-snug text-[#0F1111] mb-2">
                    {product.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex">
                      {[...Array(5)].map((_,i) => (
                        <i key={i} className={`fa-solid fa-star text-xs ${i < 4 ? "text-[#FF9900]" : "text-[#D5D9D9]"}`}></i>
                      ))}
                    </div>
                    <span className="text-sm text-[#007185] hover:text-[#C45500] cursor-pointer">(128)</span>
                    <span className="text-sm text-[#007185]">·</span>
                    <span className="text-xs text-[#CC0C39] font-bold">47 vendus ce mois</span>
                  </div>
                </div>

                {/* PRIX */}
                <div className="py-4 border-y border-[#D5D9D9]">
                  <p className="text-[10px] text-[#565959] mb-1 uppercase tracking-wide">Prix unitaire</p>
                  <div className="flex items-baseline gap-3">
                    <p className="text-3xl font-bold text-[#B12704]">
                      {Number(product.price).toLocaleString()}
                      <span className="text-base ml-1 text-[#565959] font-normal">FCFA</span>
                    </p>
                    <span className="text-sm text-[#565959] line-through">
                      {Math.round(Number(product.price) * 1.15).toLocaleString()} FCFA
                    </span>
                    <span className="text-sm text-[#CC0C39] font-bold">-15%</span>
                  </div>
                  <p className="text-[11px] text-[#007600] mt-1 font-bold">En stock</p>
                </div>

                {/* COULEUR */}
                <div>
                  <p className="text-sm font-bold mb-2 text-[#0F1111]">
                    Couleur: <span className="font-normal">{color}</span>
                  </p>
                  <div className="flex gap-3">
                    {productColors.map(c => (
                      <button key={c.name} onClick={() => setColor(c.name)} title={c.name}
                        className={`w-8 h-8 rounded-full border-2 transition-all duration-300 hover:scale-110 ${color === c.name ? "border-[#FF9900] scale-110 shadow-[0_0_8px_rgba(255,153,0,0.4)]" : "border-[#D5D9D9] hover:border-[#adb5bd]"}`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                {/* TAILLE */}
                {(isApparel || isShoes) && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-[#0F1111]">
                        Taille: <span className="font-normal">{size}</span>
                      </p>
                      <button className="text-xs text-[#007185] hover:text-[#C45500] hover:underline">
                        Guide des tailles →
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(isShoes ? ["40","41","42","43","44","45"] : ["XS","S","M","L","XL","XXL"]).map(s => (
                        <button key={s} onClick={() => setSize(s)}
                          className={`min-w-[52px] h-11 px-3 text-sm font-bold rounded transition-all border-2 ${size === s ? "bg-[#232F3E] text-[#FF9900] border-[#232F3E]" : "border-[#D5D9D9] text-[#0F1111] hover:border-[#adb5bd] bg-white"}`}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* QTÉ + CTA */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-bold text-[#0F1111]">Quantité:</p>
                    <div className="flex items-center bg-white border border-[#D5D9D9] rounded overflow-hidden">
                      <button onClick={() => setQty(Math.max(1, qty-1))} className="w-10 h-10 text-[#565959] hover:text-[#FF9900] hover:bg-[#F3F4F4] transition font-bold text-lg">−</button>
                      <span className="font-bold text-sm px-4 min-w-[40px] text-center text-[#0F1111] border-x border-[#D5D9D9]">{qty}</span>
                      <button onClick={() => setQty(qty+1)} className="w-10 h-10 text-[#565959] hover:text-[#FF9900] hover:bg-[#F3F4F4] transition font-bold text-lg">+</button>
                    </div>
                  </div>

                  <button onClick={handleAddToCart}
                    className={`w-full py-4 rounded font-bold text-sm transition-all duration-300 flex items-center justify-center gap-3 border ${addedFeedback ? "bg-emerald-500 text-white border-emerald-500" : "bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border-[#FCD200] hover:border-[#F0C000] shadow-sm active:scale-95"}`}
                  >
                    <i className={`fa-solid ${addedFeedback ? "fa-check" : "fa-bag-shopping"} text-sm`}></i>
                    <span>
                      {addedFeedback
                        ? "Ajouté au panier !"
                        : `Ajouter au panier — ${(Number(product.price) * qty + selectedCity.price).toLocaleString()} FCFA`}
                    </span>
                  </button>

                  <div className="grid grid-cols-3 gap-2">
                    <Link to="/studio" state={{ productId: product.id }}
                      className="col-span-2 py-3 bg-white border border-[#D5D9D9] hover:border-[#FF9900] rounded font-bold text-sm text-[#565959] hover:text-[#FF9900] transition-all text-center flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles text-[#FF9900] text-xs"></i>Personnaliser
                    </Link>
                    <button
                      onClick={async () => { if (!user) { navigate('/login'); return; } await toggleWishlist(product); }}
                      className={`py-3 rounded border font-bold text-sm transition-all flex items-center justify-center gap-2 ${wishlist ? "bg-red-50 border-red-200 text-red-400" : "bg-white border-[#D5D9D9] hover:border-red-200 text-[#565959] hover:text-red-400"}`}
                    >
                      <i className={`fa-${wishlist ? "solid" : "regular"} fa-heart text-sm`}></i>
                    </button>
                  </div>
                </div>

                {/* SHARE */}
                <button onClick={handleShare}
                  className="flex items-center gap-2 text-xs text-[#007185] hover:text-[#C45500] hover:underline transition-colors self-start"
                >
                  <i className="fa-solid fa-share-nodes"></i><span>Partager ce produit</span>
                </button>
              </div>
            </div>

            {/* ── LIVRAISON + PUB VIDÉO CÔTE À CÔTE ── */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DeliveryPanel
                price={product.price}
                qty={qty}
                selectedCity={selectedCity}
                onCityChange={setSelectedCity}
              />
              <VideoAdPanel />
            </div>

            {/* ── TABS ── */}
            <div className="mt-10 border-t border-[#D5D9D9] pt-8">
              <div className="flex gap-1 mb-6 bg-white p-1 rounded w-fit border border-[#D5D9D9]">
                {[
                  { key:"specs",       label:"Caractéristiques", icon:"fa-list-check" },
                  { key:"description", label:"Description",       icon:"fa-align-left" },
                  { key:"reviews",     label:"Avis (128)",         icon:"fa-star" },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded text-sm font-bold transition-all ${activeTab === tab.key ? "bg-[#232F3E] text-[#FF9900]" : "text-[#565959] hover:text-[#0F1111] hover:bg-[#F3F4F4]"}`}
                  >
                    <i className={`fa-solid ${tab.icon} text-xs`}></i>
                    <span className="hidden md:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {activeTab === "specs" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                  {(product.features?.length > 0 ? product.features : ["Qualité Elite Certifiée","Design OneFreestyle Exclusif","Livraison Express Douala","Retour sous 7 jours"]).map((feat,i) => (
                    <div key={i} className="flex items-center gap-4 bg-white border border-[#D5D9D9] rounded p-4 group hover:border-[#FF9900] hover:shadow-sm transition-all">
                      <div className="w-8 h-8 bg-[#FF9900]/10 rounded flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-bolt text-[#FF9900] text-xs"></i>
                      </div>
                      <span className="text-sm text-[#565959] group-hover:text-[#0F1111] transition-colors">{feat}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "description" && (
                <div className="max-w-2xl space-y-4">
                  <p className="text-[#565959] leading-relaxed text-sm">
                    {product.description ? product.description : (
                      <><span className="text-[#0F1111] font-bold">{product.name}</span> est une pièce sélectionnée par les experts OneFreestyle Elite — conçue pour ceux qui refusent la médiocrité.</>
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    {[
                      { label:"Type",      value:product.type },
                      { label:"Statut",    value:product.status },
                      { label:"Livraison", value:"Douala — 2h" },
                      { label:"Paiement",  value:"OM / Cash" },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between items-center py-3 border-b border-[#D5D9D9] text-sm">
                        <span className="font-bold text-[#565959]">{item.label}</span>
                        <span className="font-bold text-[#0F1111]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "reviews" && <ReviewsSection productId={product.id} />}
            </div>

            {/* ── VENDOR CARD ── */}
            {vendor && (
              <div className="mt-10 border-t border-[#D5D9D9] pt-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1 h-6 bg-[#FF9900] rounded-full"></div>
                  <h3 className="text-lg font-bold text-[#0F1111]">La <span className="text-[#FF9900]">Boutique</span></h3>
                </div>
                <div className="bg-white border border-[#D5D9D9] rounded p-6 hover:border-[#FF9900] hover:shadow-md transition-all group">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    <div className="w-16 h-16 bg-[#FF9900]/10 rounded flex items-center justify-center border border-[#FF9900]/20 flex-shrink-0">
                      <i className="fa-solid fa-store text-[#FF9900] text-xl"></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-bold text-xl text-[#0F1111]">{vendor.shop_name}</h4>
                        <span className="bg-[#FF9900]/10 text-[#FF9900] border border-[#FF9900]/20 text-[9px] font-bold px-2 py-0.5 rounded uppercase">Certifié</span>
                      </div>
                      <p className="text-[#565959] text-sm mb-2">{vendor.full_name} · Douala, Cameroun 🇨🇲</p>
                      <div className="flex items-center gap-4 text-xs text-[#565959]">
                        <span><i className="fa-solid fa-box text-[#FF9900] mr-1"></i>Catalogue disponible</span>
                        <span><i className="fa-solid fa-star text-[#FF9900] mr-1"></i>Elite Vendor</span>
                        <span><i className="fa-solid fa-truck-fast text-blue-400 mr-1"></i>Livraison express</span>
                      </div>
                    </div>
                    <Link to={`/shop/${vendor.shop_name}`}
                      className="flex items-center gap-2 bg-[#FF9900] hover:bg-[#E47911] text-[#0F1111] px-5 py-3 rounded font-bold text-sm transition-all hover:scale-105 flex-shrink-0"
                    >
                      <i className="fa-solid fa-store text-sm"></i><span>Voir la boutique</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ── SUGGESTIONS ENRICHIES ── */}
            <SuggestionsSection currentProduct={product} openModal={openModal} addToCart={addToCart} />
          </>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
