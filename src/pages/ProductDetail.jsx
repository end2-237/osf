import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ProductCard from "../components/ProductCard";
import ReviewsSection from "../components/ReviewsSection";
import { useWishlist } from "../hooks/useWishlist";
import { useAuth } from "../context/AuthContext";
import { cjGetProductDetail, mapCjToProduct, isVideoUrl } from "../lib/cjApi";

const MEMBER_DISCOUNT = 0.2;

// ─── DELIVERY ZONES ───────────────────────────────────────────────────────────
const DELIVERY_ZONES = [
  { city: "Bonamoussadi", delay: "30min – 1h",   price: 0,    note: "🎁 Promo 1 mois", icon: "fa-bolt",       color: "text-[#FF9900]",  badge: "GRATUIT", promo: true },
  { city: "Douala",       delay: "2h – 4h",      price: 1000, note: "Express ville",   icon: "fa-bolt",       color: "text-[#FF9900]",  badge: "1 000 F" },
  { city: "Yaoundé",      delay: "24h – 48h",    price: 2500, note: "J+1 garanti",     icon: "fa-truck-fast", color: "text-blue-400",   badge: "J+1" },
  { city: "Bafoussam",    delay: "24h – 48h",    price: 2500, note: "Via transport",   icon: "fa-truck",      color: "text-purple-400", badge: "J+1" },
  { city: "Buea",         delay: "24h",           price: 1500, note: "Région du S.O",  icon: "fa-truck-fast", color: "text-orange-400", badge: "J+1" },
  { city: "Kribi",        delay: "2 – 3 jours",  price: 3000, note: "Via partenaire",  icon: "fa-truck",      color: "text-zinc-400",   badge: "J+2" },
  { city: "Limbe",        delay: "24h",           price: 1500, note: "Région du S.O",  icon: "fa-truck-fast", color: "text-orange-400", badge: "J+1" },
  { city: "Ngaoundéré",   delay: "3 – 5 jours",  price: 4500, note: "Nord Cameroun",  icon: "fa-truck",      color: "text-red-400",    badge: "J+3" },
  { city: "Garoua",       delay: "3 – 5 jours",  price: 4500, note: "Nord Cameroun",  icon: "fa-truck",      color: "text-red-400",    badge: "J+3" },
  { city: "Maroua",       delay: "4 – 6 jours",  price: 5000, note: "Extrême-Nord",   icon: "fa-truck",      color: "text-red-500",    badge: "J+4" },
  { city: "Bamenda",      delay: "48h",           price: 3000, note: "N.O Region",     icon: "fa-truck",      color: "text-zinc-400",   badge: "J+2" },
  { city: "Ebolowa",      delay: "2 – 3 jours",  price: 3500, note: "Via partenaire",  icon: "fa-truck",      color: "text-zinc-400",   badge: "J+2" },
  { city: "Diaspora",     delay: "5 – 10 jours", price: 0,    note: "Commande cadeau", icon: "fa-plane",      color: "text-yellow-400", badge: "GIFT" },
];

// ─── VIDEO ADS ────────────────────────────────────────────────────────────────
const VIDEO_ADS = [
  { src: "https://alrbokstfwwlvbvghrqr.supabase.co/storage/v1/object/public/product-images/veo.mp4",       tag: "Nouvelle Collection", title: "Mode Femme Été 2025",       sub: "Pièces exclusives · Livraison express Douala",    cta: "Voir la collection",    href: "/store",    accent: "#FF9900" },
  { src: "https://alrbokstfwwlvbvghrqr.supabase.co/storage/v1/object/public/product-images/ads/veo2.mp4",  tag: "Flash Drop Audio",     title: "The Ultimate Beat",          sub: "Casques & enceintes · Stock limité",              cta: "Réserver maintenant",   href: "/store",    accent: "#3b82f6" },
  { src: "https://alrbokstfwwlvbvghrqr.supabase.co/storage/v1/object/public/product-images/veo.mp4",       tag: "Membre Elite",         title: "−20% sur tout",              sub: "Inscription gratuite · Prix exclusifs immédiats", cta: "Rejoindre l'élite",     href: "/register", accent: "#FFD814" },
  { src: "https://alrbokstfwwlvbvghrqr.supabase.co/storage/v1/object/public/product-images/ads/veo2.mp4",  tag: "Studio Lab",           title: "Fais-en une pièce unique",   sub: "Personnalisation laser · Impression UV",          cta: "Accéder au Studio",     href: "/studio",   accent: "#a855f7" },
];

// ─── PROMO ADS ────────────────────────────────────────────────────────────────
const PROMO_ADS = [
  { tag: "Bundle Deal",  title: "2 articles = −5%",   sub: "Membre : −5% · Non-membre : −2% dès 2 articles dans le panier", icon: "fa-percent",            bg: "from-[#FF9900]/15 to-[#FF9900]/5", border: "border-[#FF9900]/25", cta: "Explorer le store",   href: "/store",    accent: "text-[#FF9900]"  },
  { tag: "Membre Elite", title: "−20% sur tout",      sub: "Créez un compte gratuit et débloquez vos prix exclusifs",        icon: "fa-crown",              bg: "from-yellow-400/15 to-yellow-400/5", border: "border-yellow-400/25", cta: "Créer un compte",  href: "/register", accent: "text-yellow-600" },
  { tag: "Studio Lab",   title: "Personnalise-le",    sub: "Grave, imprime, customise. Fais-en une pièce unique.",           icon: "fa-wand-magic-sparkles", bg: "from-purple-500/15 to-purple-500/5", border: "border-purple-400/25", cta: "Accéder au Studio", href: "/studio",  accent: "text-purple-600" },
];

// ─── OFS SEAL ─────────────────────────────────────────────────────────────────
const OFSSeal = ({ size = 64 }) => (
  <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
    <svg viewBox="0 0 64 64" className="absolute inset-0 w-full h-full" style={{ opacity: 0.95 }}>
      <defs>
        <path id="sealRing2" d="M 32,32 m -22,0 a 22,22 0 1,1 44,0 a 22,22 0 1,1 -44,0" fill="none" />
      </defs>
      <text fontSize="5.8" fontWeight="900" fill="#FF9900" fontFamily="monospace" letterSpacing="2.2">
        <textPath href="#sealRing2">OFS CAMEROUN • AUTHENTIC •</textPath>
      </text>
    </svg>
    <div className="rounded-full flex items-center justify-center border-2 border-[#FF9900]"
      style={{ width: size * 0.6, height: size * 0.6, backgroundColor: "#131921" }}>
      <div className="text-center">
        <div className="text-[#FF9900] font-black leading-none" style={{ fontSize: size * 0.14 }}>OFS</div>
        <i className="fa-solid fa-check text-[#FFD814]" style={{ fontSize: size * 0.1 }}></i>
      </div>
    </div>
  </div>
);

// ─── STAR RATING ──────────────────────────────────────────────────────────────
const StarRating = ({ rating = 4.2, count = null }) => {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex text-[#FF9900] text-sm">
        {Array(full).fill(0).map((_, i) => <i key={`f${i}`} className="fa-solid fa-star" />)}
        {half && <i className="fa-solid fa-star-half-stroke" />}
        {Array(empty).fill(0).map((_, i) => <i key={`e${i}`} className="fa-regular fa-star" />)}
      </div>
      <span className="text-sm font-medium text-[#FF9900]">{rating.toFixed(1)}</span>
      {count !== null && (
        <span className="text-sm text-[#007185] hover:text-[#C45500] underline cursor-pointer">{count.toLocaleString()} avis</span>
      )}
    </div>
  );
};

// ─── BREADCRUMB ────────────────────────────────────────────────────────────────
const Breadcrumb = ({ product }) => (
  <div className="bg-white border-b border-[#D5D9D9]">
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-2 flex items-center gap-1 text-xs text-[#565959] flex-wrap">
      <Link to="/" className="hover:text-[#C45500] hover:underline">Accueil</Link>
      <span className="mx-1 text-[#D5D9D9]">›</span>
      <Link to="/store" className="hover:text-[#C45500] hover:underline">Store</Link>
      <span className="mx-1 text-[#D5D9D9]">›</span>
      <Link to={`/store?type=${encodeURIComponent(product?.type || "")}`} className="hover:text-[#C45500] hover:underline">
        {product?.type}
      </Link>
      <span className="mx-1 text-[#D5D9D9]">›</span>
      <span className="text-[#0F1111] truncate max-w-[300px]">{product?.name}</span>
    </div>
  </div>
);

// ─── IMAGE GALLERY ─────────────────────────────────────────────────────────────
const ImageGallery = ({ product }) => {
  const [activeImg, setActiveImg] = useState(0);
  const [zoomed, setZoomed]       = useState(false);

  const images = useMemo(() => {
    if (product?.images?.length > 0) return product.images;
    return product?.img ? [product.img] : [];
  }, [product]);

  if (images.length === 0)
    return (
      <div className="aspect-square bg-[#F3F4F4] rounded border border-[#D5D9D9] flex items-center justify-center">
        <i className="fa-solid fa-image text-[#D5D9D9] text-5xl" />
      </div>
    );

  const Thumb = ({ img, i, size = "w-[56px] h-[56px]" }) => (
    <button
      key={i}
      onMouseEnter={() => setActiveImg(i)}
      onClick={() => setActiveImg(i)}
      className={`${size} rounded overflow-hidden border-2 flex-shrink-0 transition-all ${
        activeImg === i ? "border-[#FF9900]" : "border-[#D5D9D9] hover:border-[#FF9900]"
      }`}
    >
      {isVideoUrl(img) ? (
        <div className="w-full h-full bg-[#131921] flex items-center justify-center">
          <i className="fa-solid fa-play text-[#FF9900] text-xs" />
        </div>
      ) : (
        <img src={img} alt="" className="w-full h-full object-cover" />
      )}
    </button>
  );

  const MainImage = () => (
    <div
      className={`relative w-full bg-white border border-[#D5D9D9] rounded overflow-hidden group ${
        isVideoUrl(images[activeImg]) ? "cursor-default" : zoomed ? "cursor-zoom-out" : "cursor-zoom-in"
      }`}
      style={{ aspectRatio: "1/1" }}
      onClick={() => { if (!isVideoUrl(images[activeImg])) setZoomed(z => !z); }}
    >
      {isVideoUrl(images[activeImg]) ? (
        <video key={images[activeImg]} src={images[activeImg]}
          className="w-full h-full object-contain" controls autoPlay muted loop playsInline />
      ) : (
        <img
          src={images[activeImg]}
          alt={product?.name}
          className={`w-full h-full object-contain transition-all duration-500 ${
            zoomed ? "scale-[1.8]" : "group-hover:scale-[1.04]"
          }`}
        />
      )}
      {product?.status && product.status !== "Nouveau" && (
        <div className="absolute top-2 left-2 z-10">
          <span className="bg-[#CC0C39] text-white text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase">
            {product.status}
          </span>
        </div>
      )}
      <div className="absolute top-2 right-2 z-10 opacity-60 hover:opacity-100 transition-opacity">
        <OFSSeal size={44} />
      </div>
      {!isVideoUrl(images[activeImg]) && !zoomed && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[9px] px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          <i className="fa-solid fa-magnifying-glass-plus mr-1" />
          Survolez pour zoomer
        </div>
      )}
      {images.length > 1 && (
        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
          {activeImg + 1}/{images.length}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Desktop: vertical thumbs left + main image */}
      <div className="hidden sm:flex gap-3">
        {images.length > 1 && (
          <div className="flex flex-col gap-2 flex-shrink-0 max-h-[500px] overflow-y-auto hide-scrollbar">
            {images.map((img, i) => <Thumb key={i} img={img} i={i} />)}
          </div>
        )}
        <div className="flex-grow"><MainImage /></div>
      </div>

      {/* Mobile: main image + horizontal thumbs below */}
      <div className="sm:hidden">
        <MainImage />
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar mt-2 pb-1">
            {images.map((img, i) => <Thumb key={i} img={img} i={i} size="w-14 h-14" />)}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── VIDEO AD PANEL ───────────────────────────────────────────────────────────
const VideoAdPanel = () => {
  const [current,  setCurrent]  = useState(0);
  const [progress, setProgress] = useState(0);
  const [errored,  setErrored]  = useState({});
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const DURATION = 12000;
  const ad = VIDEO_ADS[current];

  const goTo = (i) => { setProgress(0); clearInterval(timerRef.current); setCurrent(i); };
  const next  = () => goTo((current + 1) % VIDEO_ADS.length);

  useEffect(() => {
    setProgress(0);
    if (videoRef.current) { videoRef.current.load(); videoRef.current.play().catch(() => {}); }
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) next();
    }, 80);
    return () => clearInterval(timerRef.current);
  }, [current]);

  return (
    <div className="rounded border border-[#D5D9D9] overflow-hidden flex flex-col bg-[#0a0a0a]" style={{ minHeight: 380 }}>
      <div className="bg-[#131921] border-b border-[#232F3E] px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF9900] animate-pulse" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#FF9900]">OFS Live · Publicité</span>
        </div>
        <span className="text-[8px] text-[#565959] font-bold uppercase">OneFreestyle Studio</span>
      </div>
      <div className="relative flex-grow">
        {!errored[current] ? (
          <video ref={videoRef} key={ad.src} className="w-full h-full object-cover absolute inset-0"
            autoPlay muted loop playsInline onError={() => setErrored(p => ({ ...p, [current]: true }))}>
            <source src={ad.src} type="video/mp4" />
          </video>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: `radial-gradient(ellipse at center, ${ad.accent}22 0%, #09090b 70%)` }}>
            <i className="fa-solid fa-play-circle text-white/20 text-7xl" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
        <div className="absolute bottom-0 left-0 right-0 z-20 p-5">
          <span className="text-[8px] font-black uppercase tracking-widest mb-1 block" style={{ color: ad.accent }}>{ad.tag}</span>
          <h4 className="font-black text-xl text-white leading-tight mb-1">{ad.title}</h4>
          <p className="text-[10px] text-zinc-400 font-bold mb-4">{ad.sub}</p>
          <Link to={ad.href} className="inline-flex items-center gap-2 px-4 py-2 rounded font-bold text-[10px] uppercase tracking-widest text-[#0F1111]"
            style={{ backgroundColor: ad.accent }}>
            <span>{ad.cta}</span>
            <i className="fa-solid fa-arrow-right text-[8px]" />
          </Link>
        </div>
      </div>
      <div className="h-[3px] bg-white/10 flex-shrink-0">
        <div className="h-full rounded-full transition-none" style={{ width: progress + "%", backgroundColor: ad.accent }} />
      </div>
      <div className="flex items-center justify-between px-5 py-3 bg-[#131921] flex-shrink-0">
        <div className="flex gap-1.5">
          {VIDEO_ADS.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={"h-1.5 rounded-full transition-all duration-300 " + (i === current ? "w-6" : "w-1.5 opacity-30 bg-white")}
              style={i === current ? { backgroundColor: ad.accent, width: "1.5rem" } : {}} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => goTo((current - 1 + VIDEO_ADS.length) % VIDEO_ADS.length)}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <i className="fa-solid fa-chevron-left text-white text-[8px]" />
          </button>
          <button onClick={next} className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <i className="fa-solid fa-chevron-right text-white text-[8px]" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── DELIVERY PANEL ───────────────────────────────────────────────────────────
const DeliveryPanel = ({ price: productPrice, qty, selectedCity, onCityChange }) => {
  const [open, setOpen] = useState(false);
  const deliveryFee = selectedCity.price;
  const totalOrder  = Number(productPrice) * qty + deliveryFee;

  return (
    <div className="space-y-4">
      {/* City selector */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#565959] mb-2">Choisir ta ville</p>
        <div className="relative">
          <button onClick={() => setOpen(!open)}
            className="w-full flex items-center justify-between bg-white border border-[#D5D9D9] hover:border-[#FF9900] rounded px-4 py-3 transition-all">
            <div className="flex items-center gap-3">
              <i className={`fa-solid ${selectedCity.icon} ${selectedCity.color} text-sm`} />
              <div className="text-left">
                <p className="font-bold text-[13px] text-[#0F1111]">{selectedCity.city}</p>
                <p className="text-[10px] text-[#565959]">{selectedCity.delay} · {selectedCity.note}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                selectedCity.price === 0 ? "bg-[#FF9900]/10 text-[#FF9900] border-[#FF9900]/20" : "bg-[#F3F4F4] text-[#565959] border-[#D5D9D9]"
              }`}>
                {selectedCity.price === 0 ? selectedCity.badge : `+${selectedCity.price.toLocaleString()} F`}
              </span>
              <i className={`fa-solid fa-chevron-down text-[#565959] text-xs transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </button>
          {open && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-[#D5D9D9] rounded shadow-xl overflow-y-auto max-h-60">
              {DELIVERY_ZONES.map(zone => (
                <button key={zone.city} onClick={() => { onCityChange(zone); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#F3F4F4] border-b border-[#F3F4F4] last:border-0 transition-colors ${selectedCity.city === zone.city ? "bg-[#FFF8F0]" : ""}`}>
                  <div className="flex items-center gap-3">
                    <i className={`fa-solid ${zone.icon} ${zone.color} text-xs`} />
                    <div className="text-left">
                      <p className="font-bold text-[12px] text-[#0F1111]">{zone.city}</p>
                      <p className="text-[10px] text-[#565959]">{zone.delay} · {zone.note}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${zone.price === 0 ? "bg-[#FF9900]/10 text-[#FF9900]" : "bg-[#F3F4F4] text-[#565959]"}`}>
                    {zone.price === 0 ? zone.badge : `${zone.price.toLocaleString()} FCFA`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Délai", value: selectedCity.delay, icon: "fa-clock" },
          { label: "Livraison", value: deliveryFee === 0 ? "Gratuite 🎁" : `${deliveryFee.toLocaleString()} FCFA`, icon: "fa-truck-fast", green: deliveryFee === 0 },
          { label: "Retours", value: "7 jours", icon: "fa-rotate-left" },
          { label: "Paiement", value: "À la livraison", icon: "fa-money-bill-wave" },
        ].map(item => (
          <div key={item.label} className="bg-[#F3F4F4] border border-[#D5D9D9] rounded p-3 text-center">
            <i className={`fa-solid ${item.icon} text-[#FF9900] text-xs mb-1.5 block`} />
            <p className="text-[9px] font-black uppercase text-[#565959] mb-0.5">{item.label}</p>
            <p className={`text-xs font-bold ${item.green ? "text-[#007600]" : "text-[#0F1111]"}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Order summary */}
      <div className="border border-[#D5D9D9] rounded overflow-hidden">
        <div className="bg-[#F3F4F4] px-4 py-2 border-b border-[#D5D9D9]">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#565959]">Récapitulatif de commande</p>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#565959]">Sous-total ({qty}×)</span>
            <span className="font-bold">{(Number(productPrice) * qty).toLocaleString()} FCFA</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#565959]">Livraison → {selectedCity.city}</span>
            <span className={`font-bold ${deliveryFee === 0 ? "text-[#007600]" : ""}`}>
              {deliveryFee === 0 ? "Gratuite" : `+${deliveryFee.toLocaleString()} FCFA`}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-[#D5D9D9]">
            <span className="font-bold text-sm">Total estimé</span>
            <span className="font-bold text-xl text-[#B12704]">
              {totalOrder.toLocaleString()} <span className="text-sm text-[#565959] font-normal">FCFA</span>
            </span>
          </div>
        </div>
      </div>

      {/* Payment chips */}
      <div className="flex gap-2 flex-wrap">
        {[
          { icon: "fa-mobile-screen-button", label: "Orange Money", color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
          { icon: "fa-mobile-screen-button", label: "MTN MoMo",     color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
          { icon: "fa-money-bill-wave",       label: "Cash",         color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
        ].map(p => (
          <div key={p.label} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[9px] font-bold uppercase ${p.bg}`}>
            <i className={`fa-solid ${p.icon} ${p.color} text-xs`} />
            <span className="text-[#565959]">{p.label}</span>
          </div>
        ))}
      </div>

      {/* Diaspora note */}
      <div className="flex items-start gap-3 bg-[#FFF8D3] border border-[#FCD200]/40 rounded p-3">
        <i className="fa-solid fa-plane text-[#FF9900] text-sm mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-[9px] font-black uppercase text-[#C45500] tracking-widest">Commande depuis l'étranger ?</p>
          <p className="text-[11px] text-[#565959] mt-0.5 leading-relaxed">
            Envoyez un cadeau à vos proches au Cameroun. Livraison directe à Douala et partout au pays.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── SKELETON ──────────────────────────────────────────────────────────────────
const DetailSkeleton = () => (
  <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-4">
    <div className="animate-pulse bg-white border border-[#D5D9D9] rounded p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="flex gap-3">
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => <div key={i} className="w-14 h-14 bg-[#F3F4F4] rounded" />)}
          </div>
          <div className="flex-grow aspect-square bg-[#F3F4F4] rounded" />
        </div>
        <div className="space-y-4">
          <div className="h-3 bg-[#F3F4F4] rounded w-1/4" />
          <div className="h-7 bg-[#F3F4F4] rounded w-full" />
          <div className="h-5 bg-[#F3F4F4] rounded w-1/3" />
          <div className="h-px bg-[#D5D9D9]" />
          <div className="h-10 bg-[#F3F4F4] rounded w-1/2" />
          <div className="h-16 bg-[#F3F4F4] rounded" />
          <div className="h-px bg-[#D5D9D9]" />
          <div className="flex gap-2">
            {[...Array(6)].map((_, i) => <div key={i} className="w-10 h-10 bg-[#F3F4F4] rounded" />)}
          </div>
          <div className="h-12 bg-[#FFD814]/30 rounded-full" />
        </div>
      </div>
    </div>
  </div>
);

// ─── PROMO AD CARD ─────────────────────────────────────────────────────────────
const PromoAdCard = ({ ad }) => (
  <Link to={ad.href}
    className={`relative overflow-hidden rounded border p-5 flex flex-col justify-between bg-gradient-to-br hover:shadow-md transition-all min-h-[160px] group ${ad.bg} ${ad.border}`}>
    <div>
      <span className={`text-[9px] font-black uppercase tracking-widest ${ad.accent}`}>{ad.tag}</span>
      <h4 className={`font-bold text-xl leading-none mt-1 ${ad.accent}`}>{ad.title}</h4>
      <p className="text-[11px] text-[#565959] font-medium mt-2 leading-relaxed">{ad.sub}</p>
    </div>
    <div className={`inline-flex items-center gap-2 mt-4 text-[10px] font-bold uppercase tracking-widest ${ad.accent}`}>
      <span>{ad.cta}</span>
      <i className="fa-solid fa-arrow-right text-[9px] group-hover:translate-x-1 transition-transform" />
    </div>
    <i className={`fa-solid ${ad.icon} absolute -bottom-3 -right-3 text-6xl opacity-[0.06]`} />
  </Link>
);

// ─── SUGGESTIONS ───────────────────────────────────────────────────────────────
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
        const [{ data: typeData }, { data: trendData }] = await Promise.all([
          supabase.from("products").select("*, vendor:vendors!vendor_id(member_discount_enabled, shop_name)")
            .eq("type", currentProduct.type).neq("id", currentProduct.id).limit(12),
          supabase.from("products").select("*, vendor:vendors!vendor_id(member_discount_enabled, shop_name)")
            .neq("type", currentProduct.type).neq("id", currentProduct.id).limit(12),
        ]);
        setSameType(typeData || []);
        setTrending(trendData || []);
        if (currentProduct.vendor_id) {
          const { data: vData } = await supabase.from("products")
            .select("*, vendor:vendors!vendor_id(member_discount_enabled, shop_name)")
            .eq("vendor_id", currentProduct.vendor_id).neq("id", currentProduct.id).limit(8);
          setSameVendor(vData || []);
        }
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
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[3/4] bg-[#F3F4F4] rounded mb-2" />
          <div className="h-3 bg-[#F3F4F4] rounded w-3/4 mb-1" />
          <div className="h-2 bg-[#F3F4F4] rounded w-1/2" />
        </div>
      ))}
    </div>
  );

  const SectionHeader = ({ accent, title, sub, link }) => (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: accent }} />
        <div>
          <h3 className="text-lg font-bold text-[#0F1111]">{title}</h3>
          {sub && <p className="text-[10px] text-[#565959] mt-0.5">{sub}</p>}
        </div>
      </div>
      {link && (
        <Link to={link} className="text-sm text-[#007185] hover:text-[#C45500] hover:underline flex items-center gap-1">
          <span>Voir tout</span><i className="fa-solid fa-arrow-right text-xs" />
        </Link>
      )}
    </div>
  );

  return (
    <div className="mt-8 space-y-10">
      <section>
        <SectionHeader accent="#FF9900"
          title={<>Plus de <span className="text-[#FF9900]">{currentProduct?.type}</span></>}
          sub={loading ? "..." : `${sameType.length} produits similaires`}
          link="/store" />
        {loading ? <SkeletonGrid count={6} /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {sameType.map(p => <ProductCard key={p.id} product={p} openModal={openModal} addToCart={addToCart} />)}
          </div>
        )}
      </section>

      {sameVendor.length > 0 && (
        <section>
          <SectionHeader accent="#007185"
            title={<>De la même <span className="text-[#007185]">boutique</span></>}
            sub={`${sameVendor.length} autres produits`} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {sameVendor.slice(0, 6).map(p => <ProductCard key={p.id} product={p} openModal={openModal} addToCart={addToCart} />)}
          </div>
        </section>
      )}

      <section>
        <SectionHeader accent="#FF9900"
          title={<>Trending <span className="text-[#FF9900]">en ce moment</span></>}
          sub="D'autres catégories · Toujours elite" link="/store" />
        {loading ? <SkeletonGrid count={6} /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {trending.map(p => <ProductCard key={p.id} product={p} openModal={openModal} addToCart={addToCart} />)}
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
  const [shareToast,    setShareToast]    = useState(false);

  const { user }  = useAuth();
  const { isInWishlist, toggle: toggleWishlist } = useWishlist();
  const wishlist  = isInWishlist(product?.id);

  useEffect(() => {
    if (!product) {
      supabase.from("products").select("*").eq("id", productId).single()
        .then(({ data, error }) => { if (!error && data) setProduct(data); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (product?.vendor_id) {
      supabase.from("vendors").select("*").eq("id", product.vendor_id).single()
        .then(({ data }) => setVendor(data));
    }
  }, [product]);

  useEffect(() => {
    if (product) { setSize("M"); setColor("Black"); setQty(1); }
  }, [product]);

  useEffect(() => {
    if (!product?.id) return;
    (async () => {
      try { await supabase.rpc("increment_view_count", { product_id: product.id }); }
      catch { try { await supabase.from("products").update({ view_count: (product.view_count || 0) + 1 }).eq("id", product.id); } catch { /* silent */ } }
    })();

    if (product.vendor_id !== null) return;
    const hasMultipleImages = product.images?.length > 1;
    if (hasMultipleImages) {
      const updatedAt = product.updated_at ? new Date(product.updated_at) : new Date(0);
      if (Date.now() - updatedAt.getTime() < 6 * 60 * 60 * 1000) return;
    }

    const refreshCjData = async () => {
      try {
        const { cjListProducts, cjGetProductDetail, mapCjToProduct } = await import("../lib/cjApi");
        let fullData = null;
        const knownPid = product.cj_product_id;
        if (knownPid) {
          fullData = await cjGetProductDetail(knownPid);
        } else {
          const result = await cjListProducts(1, 5, product.name, "");
          const match = result?.list?.find(p =>
            (p.productNameEn || p.productName || "").toLowerCase() === (product.name || "").toLowerCase()
          );
          if (!match) return;
          const cjPid = match.pid || match.productId || match.cjProductId;
          fullData = cjPid ? await cjGetProductDetail(cjPid) : match;
        }
        if (!fullData) return;
        const fresh = mapCjToProduct(fullData);
        const updates = { updated_at: new Date().toISOString() };
        if (fresh.cj_product_id)                                                    updates.cj_product_id    = fresh.cj_product_id;
        if (fresh.price > 0 && fresh.price !== product.price)                       updates.price             = fresh.price;
        if (fresh.price_usd)                                                        updates.price_usd         = fresh.price_usd;
        if (fresh.img)                                                              updates.img               = fresh.img;
        if (fresh.images?.length > (product.images?.length || 0))                  updates.images            = fresh.images;
        if (fresh.description?.length > (product.description?.length || 0))        updates.description       = fresh.description;
        if (fresh.features?.length > 0)                                             updates.features          = fresh.features;
        if (fresh.colors?.length > 0 && fresh.colors[0] !== "Default")             updates.colors            = fresh.colors;
        if (fresh.variants)                                                         updates.variants          = fresh.variants;
        if (fresh.stock_qty !== -1)                                                 updates.stock_qty         = fresh.stock_qty;
        if (fresh.weight_g)                                                         updates.weight_g          = fresh.weight_g;
        if (fresh.cj_category_id)                                                   updates.cj_category_id   = fresh.cj_category_id;
        if (fresh.cj_category_name)                                                 updates.cj_category_name = fresh.cj_category_name;
        if (fresh.status && fresh.status !== "Nouveau")                             updates.status            = fresh.status;
        await supabase.from("products").update(updates).eq("id", product.id);
        setProduct(prev => prev ? { ...prev, ...updates } : prev);
      } catch { /* silent */ }
    };
    refreshCjData();
  }, [product?.id]);

  const price      = Number(product?.price) || 0;
  const listPrice  = Math.round(price * 1.15);
  const savings    = listPrice - price;
  const memberPrice = Math.round(price * (1 - MEMBER_DISCOUNT));
  const ofsPoints  = Math.max(1, Math.floor(price / 500));

  const COLOR_MAP = {
    Black:"#111",White:"#f5f5f5",Neon:"#00ff88",Red:"#ef4444",Blue:"#3b82f6",Navy:"#1e3a5f",
    Sky:"#38bdf8",Slate:"#64748b",Gray:"#9ca3af",Brown:"#92400e",Beige:"#d4b896",Camel:"#c19a6b",
    Green:"#16a34a",Olive:"#65a30d",Yellow:"#facc15",Orange:"#f97316",Pink:"#ec4899",Purple:"#a855f7",
    Burgundy:"#7f1d1d",Gold:"#d97706",Silver:"#c0c0c0",Khaki:"#c3b091",Teal:"#0d9488",Coral:"#fb7185",
  };
  const productColors = product?.colors?.length
    ? product.colors.map(name => ({ name, hex: COLOR_MAP[name] ?? "#888" }))
    : [{ name: "Black", hex: "#111" }, { name: "White", hex: "#f5f5f5" }, { name: "Neon", hex: "#00ff88" }];

  const isApparel = product?.type === "Clothing";
  const isShoes   = product?.type === "Shoes";

  const ratingVal   = 3.8 + ((product?.id?.charCodeAt(0) || 65) % 12) * 0.1;
  const reviewCount = 10  + ((product?.id?.charCodeAt(0) || 65) % 200);

  const handleAddToCart = () => {
    addToCart({
      ...product,
      selectedSize:      isShoes || isApparel ? size : "Unique",
      selectedColor:     color,
      quantity:          qty,
      deliveryCity:      selectedCity.city,
      deliveryFee:       selectedCity.price,
      totalWithDelivery: price * qty + selectedCity.price,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: product?.name, url });
    else { navigator.clipboard.writeText(url); setShareToast(true); setTimeout(() => setShareToast(false), 2500); }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#EAEDED] text-[#0F1111]">

      {shareToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[400] bg-[#131921] text-[#FF9900] px-6 py-3 rounded font-black text-[10px] uppercase tracking-widest shadow-2xl border border-[#232F3E] flex items-center gap-2">
          <i className="fa-solid fa-check text-[#FFD814]" /> Lien copié !
        </div>
      )}

      {!loading && product && <Breadcrumb product={product} />}

      {loading ? (
        <DetailSkeleton />
      ) : !product ? (
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 text-center py-32">
          <div className="w-20 h-20 bg-[#F3F4F4] rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-box-open text-[#D5D9D9] text-3xl" />
          </div>
          <p className="text-2xl font-bold text-[#565959] mb-2">Produit introuvable</p>
          <p className="text-sm text-[#565959] mb-8">Ce produit n'existe pas ou a été retiré du catalogue.</p>
          <button onClick={() => navigate("/store")}
            className="bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-8 py-3 rounded font-bold text-sm border border-[#FCD200]">
            Retour au Store
          </button>
        </div>
      ) : (
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-4 pb-20">

          {/* ══ MAIN PRODUCT SECTION ══ */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[520px_1fr] gap-4 mb-4 items-start">

            {/* ── GALLERY (sticky) ── */}
            <div className="lg:sticky lg:top-4">
              <div className="bg-white border border-[#D5D9D9] rounded p-3 sm:p-4 lg:p-6">
                <ImageGallery product={product} />
              </div>
            </div>

            {/* ── INFO PANEL ── */}
            <div className="bg-white border border-[#D5D9D9] rounded p-4 lg:p-6 flex flex-col min-w-0">

                {/* Brand / vendor */}
                <div className="mb-1">
                  {vendor?.shop_name ? (
                    <Link to={`/shop/${vendor.shop_name}`} className="text-sm text-[#007185] hover:text-[#C45500] hover:underline">
                      Boutique : {vendor.shop_name}
                    </Link>
                  ) : (
                    <span className="text-sm text-[#007185]">Sélection <b>OFS Cameroun</b></span>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-xl md:text-2xl font-medium text-[#0F1111] leading-snug mb-3">
                  {product.name}
                </h1>

                {/* Rating + sold */}
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <StarRating rating={ratingVal} count={reviewCount} />
                  <span className="text-[#D5D9D9]">|</span>
                  <span className="text-sm font-bold text-[#CC0C39]">
                    <i className="fa-solid fa-fire text-xs mr-1" />
                    47 vendus ce mois
                  </span>
                  <span className="text-[#D5D9D9]">|</span>
                  <span className="text-xs bg-[#FF9900]/10 text-[#FF9900] border border-[#FF9900]/25 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                    OFS Certifié
                  </span>
                </div>

                <div className="border-t border-[#D5D9D9] my-4" />

                {/* ── PRICE ── */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs text-[#565959] font-bold">Prix :</span>
                    <span className="text-3xl font-medium text-[#B12704] leading-none">
                      {price.toLocaleString()}
                    </span>
                    <span className="text-base text-[#565959]">FCFA</span>
                    <span className="text-xs bg-[#CC0C39] text-white font-bold px-1.5 py-0.5 rounded-sm ml-1">−15%</span>
                  </div>
                  <p className="text-sm text-[#565959] mb-0.5">
                    Prix conseillé : <span className="line-through">{listPrice.toLocaleString()} FCFA</span>
                    {"  "}
                    <span className="text-[#007600] font-medium">
                      Vous économisez {savings.toLocaleString()} FCFA
                    </span>
                  </p>

                  {/* Member price box */}
                  <div className="flex items-center gap-2 mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                    <i className="fa-solid fa-crown text-[#FF9900]" />
                    <span className="text-sm text-[#565959]">
                      Prix membre :{" "}
                      <span className="font-bold text-[#007600]">{memberPrice.toLocaleString()} FCFA</span>
                      {" "}<span className="text-[#CC0C39] font-bold">(−20%)</span>
                    </span>
                    {!user && (
                      <Link to="/register" className="ml-auto text-xs text-[#007185] hover:text-[#C45500] hover:underline font-bold whitespace-nowrap">
                        S'inscrire →
                      </Link>
                    )}
                  </div>
                </div>

                <div className="border-t border-[#D5D9D9] mb-4" />

                {/* ── QUICK DELIVERY INFO ── */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-start gap-2 text-sm">
                    <i className="fa-solid fa-truck-fast text-[#007185] w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="font-bold text-[#007600]">Livraison GRATUITE</span>
                      {" "}à Bonamoussadi ·{" "}
                      <span className="text-[#565959]">30 min – 1h</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#565959]">
                    <i className="fa-solid fa-warehouse w-4 text-xs flex-shrink-0" />
                    <span>Expédié depuis <b className="text-[#0F1111]">Bonamoussadi, Douala 🇨🇲</b></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#565959]">
                    <i className="fa-solid fa-rotate-left w-4 text-xs flex-shrink-0" />
                    <span>Retour sous <b className="text-[#0F1111]">7 jours</b> — Remboursement garanti</span>
                  </div>
                </div>

                {/* Stock status */}
                <div className="mb-4">
                  {product.stock_qty === 0 ? (
                    <span className="text-[#CC0C39] font-bold text-sm">Rupture de stock</span>
                  ) : product.stock_qty > 0 && product.stock_qty <= 10 ? (
                    <span className="text-[#CC0C39] font-bold text-sm">
                      <i className="fa-solid fa-triangle-exclamation mr-1 text-xs" />
                      Plus que {product.stock_qty} en stock — commandez vite !
                    </span>
                  ) : (
                    <span className="text-[#007600] font-bold text-sm flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-check text-xs" />
                      En stock
                    </span>
                  )}
                </div>

                <div className="border-t border-[#D5D9D9] mb-4" />

                {/* ── COLOR ── */}
                <div className="mb-4">
                  <p className="text-sm font-bold mb-2 text-[#0F1111]">
                    Couleur : <span className="font-normal text-[#565959]">{color}</span>
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {productColors.map(c => (
                      <button key={c.name} onClick={() => setColor(c.name)} title={c.name}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          color === c.name
                            ? "border-[#FF9900] scale-110 shadow-[0_0_0_2px_rgba(255,153,0,0.2)]"
                            : "border-[#D5D9D9] hover:border-[#adb5bd]"
                        }`}
                        style={{ backgroundColor: c.hex }} />
                    ))}
                  </div>
                </div>

                {/* ── SIZE ── */}
                {(isApparel || isShoes) && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-[#0F1111]">
                        Taille : <span className="font-normal text-[#565959]">{size}</span>
                      </p>
                      <button className="text-xs text-[#007185] hover:text-[#C45500] hover:underline">
                        Guide des tailles →
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(isShoes ? ["40","41","42","43","44","45"] : ["XS","S","M","L","XL","XXL"]).map(s => (
                        <button key={s} onClick={() => setSize(s)}
                          className={`min-w-[44px] h-9 px-2 text-sm font-medium rounded border transition-all ${
                            size === s
                              ? "bg-[#232F3E] text-[#FF9900] border-[#232F3E]"
                              : "border-[#D5D9D9] text-[#0F1111] hover:border-[#FF9900] bg-white"
                          }`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── QUANTITY ── */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-sm font-bold">Quantité :</span>
                  <div className="flex items-center border border-[#D5D9D9] rounded overflow-hidden bg-white">
                    <button onClick={() => setQty(Math.max(1, qty - 1))}
                      className="w-9 h-9 text-[#565959] hover:bg-[#F3F4F4] font-bold text-lg flex items-center justify-center transition">−</button>
                    <span className="w-10 text-center font-bold text-sm border-x border-[#D5D9D9] h-9 flex items-center justify-center">{qty}</span>
                    <button onClick={() => setQty(qty + 1)}
                      className="w-9 h-9 text-[#565959] hover:bg-[#F3F4F4] font-bold text-lg flex items-center justify-center transition">+</button>
                  </div>
                  {qty >= 2 && (
                    <span className="text-xs font-bold text-[#007600] bg-[#E8F5E8] px-2 py-1 rounded border border-[#007600]/20">
                      Bundle −{user ? 5 : 2}% ✓
                    </span>
                  )}
                </div>

                {/* ── CTA ── */}
                <div className="flex flex-col gap-2.5 max-w-sm mb-5">
                  <button onClick={handleAddToCart}
                    className={`w-full py-3 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2 border active:scale-95 ${
                      addedFeedback
                        ? "bg-[#007600] text-white border-[#007600]"
                        : "bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border-[#FCD200] shadow-sm"
                    }`}>
                    <i className={`fa-solid ${addedFeedback ? "fa-check" : "fa-bag-shopping"} text-sm`} />
                    {addedFeedback
                      ? "Ajouté au panier !"
                      : `Ajouter au panier — ${(price * qty + selectedCity.price).toLocaleString()} FCFA`}
                  </button>

                  <Link to="/studio" state={{ productId: product.id }}
                    className="w-full py-3 rounded-full font-bold text-sm bg-[#FF9900] hover:bg-[#e68900] text-white text-center flex items-center justify-center gap-2 transition-all">
                    <i className="fa-solid fa-wand-magic-sparkles text-sm" />
                    Personnaliser ce produit
                  </Link>

                  <button
                    onClick={async () => { if (!user) { navigate("/login"); return; } await toggleWishlist(product); }}
                    className={`w-full py-2.5 rounded-full font-bold text-sm border transition-all flex items-center justify-center gap-2 ${
                      wishlist
                        ? "bg-red-50 border-red-200 text-red-500"
                        : "bg-white border-[#D5D9D9] hover:border-red-200 text-[#565959] hover:text-red-400"
                    }`}>
                    <i className={`fa-${wishlist ? "solid" : "regular"} fa-heart`} />
                    {wishlist ? "Retirer de la liste d'envies" : "Ajouter à la liste d'envies"}
                  </button>
                </div>

                <div className="border-t border-[#D5D9D9] mb-4" />

                {/* ── SECONDARY INFO ── */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-[#565959]">
                    <i className="fa-solid fa-store w-4 text-xs text-[#565959]" />
                    <span>Vendu par <b className="text-[#0F1111]">{vendor?.shop_name || "OFS Cameroun"}</b></span>
                  </div>
                  <div className="flex items-center gap-2 text-[#565959]">
                    <i className="fa-solid fa-shield-check w-4 text-xs text-[#007185]" />
                    <span>Paiement sécurisé · <b className="text-[#0F1111]">Orange Money · MTN MoMo · Cash</b></span>
                  </div>
                  <div className="flex items-center gap-2 text-[#565959]">
                    <i className="fa-solid fa-star w-4 text-xs text-[#FF9900]" />
                    <span>Points OFS : <b className="text-[#FF9900]">+{ofsPoints} pts</b> crédités après achat</span>
                  </div>
                  <button onClick={handleShare}
                    className="flex items-center gap-1.5 text-[#007185] hover:text-[#C45500] hover:underline transition-colors mt-1">
                    <i className="fa-solid fa-share-nodes text-xs" />
                    <span className="text-sm">Partager ce produit</span>
                  </button>
                </div>
            </div>{/* end info panel */}
          </div>{/* end grid */}

          {/* ══ BELOW FOLD ══ */}
          <div className="space-y-4">

            {/* About this item */}
            {product.features?.length > 0 && (
              <div className="bg-white border border-[#D5D9D9] rounded">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#D5D9D9]">
                  <h2 className="text-base sm:text-lg font-bold text-[#0F1111]">À propos de ce produit</h2>
                </div>
                <div className="px-4 sm:px-6 py-4 sm:py-5">
                  <ul className="space-y-2.5">
                    {product.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-[#0F1111]">
                        <i className="fa-solid fa-circle text-[4px] text-[#0F1111] mt-2 flex-shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Product description */}
            {product.description && (
              <div className="bg-white border border-[#D5D9D9] rounded">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#D5D9D9]">
                  <h2 className="text-base sm:text-lg font-bold text-[#0F1111]">Description du produit</h2>
                </div>
                <div className="px-4 sm:px-6 py-4 sm:py-5">
                  <div
                    className="cj-description text-sm text-[#565959] leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                </div>
              </div>
            )}

            {/* Technical details */}
            <div className="bg-white border border-[#D5D9D9] rounded">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#D5D9D9]">
                <h2 className="text-base sm:text-lg font-bold text-[#0F1111]">Informations techniques</h2>
              </div>
              <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {[
                      { label: "Type de produit",  value: product.type },
                      { label: "Statut",            value: product.status },
                      product.weight_g         && { label: "Poids",          value: `${product.weight_g} g` },
                      product.cj_category_name && { label: "Catégorie",      value: product.cj_category_name },
                      product.supplier_name    && { label: "Fournisseur",    value: product.supplier_name },
                      { label: "Livraison",         value: "Douala — 2h express" },
                      { label: "Modes de paiement", value: "Orange Money · MTN MoMo · Cash" },
                      { label: "Politique retour",  value: "7 jours — Remboursement intégral" },
                    ].filter(Boolean).map((row, i) => (
                      <tr key={row.label} className={i % 2 === 0 ? "bg-[#F3F4F4]" : "bg-white"}>
                        <td className="py-2.5 px-3 sm:px-4 font-bold text-[#0F1111] w-[40%] border border-[#D5D9D9] align-top">{row.label}</td>
                        <td className="py-2.5 px-3 sm:px-4 text-[#565959] border border-[#D5D9D9]">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Delivery panel */}
            <div className="bg-white border border-[#D5D9D9] rounded">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#D5D9D9] flex items-center gap-3">
                <i className="fa-solid fa-truck-fast text-[#FF9900]" />
                <h2 className="text-base sm:text-lg font-bold text-[#0F1111]">Livraison & Expédition</h2>
                <span className="ml-auto text-[10px] font-bold text-[#FF9900] bg-[#FF9900]/10 px-2 py-0.5 rounded border border-[#FF9900]/20 uppercase tracking-wide whitespace-nowrap">
                  🇨🇲 Cameroun
                </span>
              </div>
              <div className="px-4 sm:px-6 py-4 sm:py-5">
                <DeliveryPanel price={product.price} qty={qty} selectedCity={selectedCity} onCityChange={setSelectedCity} />
              </div>
            </div>

            {/* Vendor card */}
            {vendor && (
              <div className="bg-white border border-[#D5D9D9] rounded">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#D5D9D9] flex items-center gap-2">
                  <i className="fa-solid fa-store text-[#FF9900]" />
                  <h2 className="text-base sm:text-lg font-bold text-[#0F1111]">La Boutique</h2>
                </div>
                <div className="px-4 sm:px-6 py-4 sm:py-5">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
                    <div className="w-14 h-14 bg-[#131921] rounded flex items-center justify-center border-2 border-[#FF9900]/30 flex-shrink-0 relative">
                      <i className="fa-solid fa-store text-[#FF9900] text-xl" />
                      <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-[#007600] rounded-full flex items-center justify-center border-2 border-white">
                        <i className="fa-solid fa-check text-white text-[7px]" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-bold text-lg text-[#0F1111]">{vendor.shop_name}</h4>
                        <span className="bg-[#FF9900]/10 text-[#FF9900] border border-[#FF9900]/20 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">OFS Certifié</span>
                      </div>
                      <p className="text-[#565959] text-sm mb-2">{vendor.full_name} · Douala, Cameroun 🇨🇲</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#565959]">
                        <span className="flex items-center gap-1.5"><i className="fa-solid fa-box text-[#FF9900]" />Catalogue</span>
                        <span className="flex items-center gap-1.5"><i className="fa-solid fa-star text-[#FF9900]" />Elite Vendor</span>
                        <span className="flex items-center gap-1.5"><i className="fa-solid fa-truck-fast text-[#007185]" />Express</span>
                      </div>
                    </div>
                    <Link to={`/shop/${vendor.shop_name}`}
                      className="flex items-center gap-2 bg-[#232F3E] hover:bg-[#131921] text-[#FF9900] px-4 py-2.5 rounded font-bold text-sm transition-all border border-[#FF9900]/30 flex-shrink-0 self-start md:self-center">
                      <i className="fa-solid fa-store" />
                      <span>Voir la boutique</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Video ad */}
            <VideoAdPanel />

            {/* Reviews */}
            <div className="bg-white border border-[#D5D9D9] rounded">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#D5D9D9] flex items-center gap-2">
                <i className="fa-solid fa-star text-[#FF9900]" />
                <h2 className="text-base sm:text-lg font-bold text-[#0F1111]">Avis clients</h2>
                <span className="text-sm text-[#565959]">({reviewCount})</span>
              </div>
              <div className="px-4 sm:px-6 py-4 sm:py-5">
                <ReviewsSection productId={product.id} />
              </div>
            </div>

            {/* Promo ads */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PROMO_ADS.map(ad => <PromoAdCard key={ad.tag} ad={ad} />)}
            </div>

            {/* Suggestions */}
            <SuggestionsSection currentProduct={product} openModal={openModal} addToCart={addToCart} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
