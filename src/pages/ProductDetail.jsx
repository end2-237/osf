import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ProductCard from "../components/ProductCard";
import ReviewsSection from "../components/ReviewsSection";
import SponsoredBanner from "../components/SponsoredBanner";
import { useWishlist } from "../hooks/useWishlist";
import { useAuth } from "../context/AuthContext";
import { cjGetProductDetail, mapCjToProduct, isVideoUrl, PRICE_MARGIN } from "../lib/cjApi";

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
      <Link
        to={`/store?type=${encodeURIComponent(product?.type || "")}`}
        className="hover:text-[#C45500] hover:underline"
      >
        {product?.type}
      </Link>
      {product?.subcategory && (
        <>
          <span className="mx-1 text-[#D5D9D9]">›</span>
          <Link
            to={`/store?type=${encodeURIComponent(product.type || "")}&subcat=${encodeURIComponent(product.subcategory)}`}
            className="hover:text-[#C45500] hover:underline"
          >
            {product.subcategory}
          </Link>
        </>
      )}
      <span className="mx-1 text-[#D5D9D9]">›</span>
      <span className="text-[#0F1111] truncate max-w-[300px]">{product?.name}</span>
    </div>
  </div>
);

// ─── IMAGE GALLERY ─────────────────────────────────────────────────────────────
const ImageGallery = ({ images, activeImg, setActiveImg, name, status }) => {
  const [zoomed, setZoomed]   = useState(false);
  const thumbContainerRef     = useRef(null);

  // Auto-scroll thumbnail strip to keep active thumb visible
  useEffect(() => {
    const el = thumbContainerRef.current;
    if (!el) return;
    const btns = el.querySelectorAll("button");
    if (btns[activeImg]) btns[activeImg].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeImg]);

  if (!images || images.length === 0)
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
        <div className="w-full h-full bg-[#131921] flex items-center justify-center relative overflow-hidden">
          {product?.video_thumbnail && (
            <img src={product.video_thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
          )}
          <div className="relative z-10 w-5 h-5 bg-[#FF9900] rounded-full flex items-center justify-center shadow">
            <i className="fa-solid fa-play text-[#0F1111] text-[8px] ml-px" />
          </div>
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
          poster={product?.video_thumbnail || undefined}
          className="w-full h-full object-contain" controls autoPlay muted loop playsInline />
      ) : (
        <img
          src={images[activeImg]}
          alt={name}
          className={`w-full h-full object-contain transition-all duration-500 ${
            zoomed ? "scale-[1.8]" : "group-hover:scale-[1.04]"
          }`}
        />
      )}
      {status && (
        <div className="absolute top-2 left-2 z-10">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase ${
            status === "Nouveau"
              ? "bg-[#007600] text-white"
              : "bg-[#CC0C39] text-white"
          }`}>
            {status}
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
      {/* Desktop: relative wrapper — thumbs absolute left, main image padded right */}
      <div className="hidden sm:block relative">
        <div className={images.length > 1 ? "pl-[68px]" : ""}>
          <MainImage />
        </div>
        {images.length > 1 && (
          <div
            ref={thumbContainerRef}
            className="absolute top-0 left-0 w-[56px] overflow-y-auto hide-scrollbar flex flex-col gap-2"
            style={{ height: "100%" }}
          >
            {images.map((img, i) => <Thumb key={i} img={img} i={i} />)}
          </div>
        )}
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
const parseDeliveryDays = (delayStr) => {
  const s = (delayStr || "").toLowerCase();
  const rangeD = s.match(/(\d+)\s*[–\-]\s*(\d+)\s*jour/);
  if (rangeD) return { min: parseInt(rangeD[1]), max: parseInt(rangeD[2]) };
  const singleD = s.match(/(\d+)\s*jour/);
  if (singleD) { const d = parseInt(singleD[1]); return { min: d, max: d }; }
  const rangeH = s.match(/(\d+)\s*h\s*[–\-]\s*(\d+)\s*h/);
  if (rangeH) { const h = parseInt(rangeH[2]); return { min: 0, max: h >= 24 ? 1 : 0 }; }
  const singleH = s.match(/(\d+)\s*h/);
  if (singleH) { const h = parseInt(singleH[1]); return { min: 0, max: h >= 24 ? 1 : 0 }; }
  return { min: 0, max: 0 };
};

const formatEstimatedDate = (delayStr) => {
  const { min, max } = parseDeliveryDays(delayStr);
  const DAYS  = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  const MONTH = ["jan","fév","mar","avr","mai","juin","juil","août","sep","oct","nov","déc"];
  const fmt   = (d) => {
    const dt = new Date(); dt.setDate(dt.getDate() + d);
    return `${DAYS[dt.getDay()]} ${dt.getDate()} ${MONTH[dt.getMonth()]}`;
  };
  if (max === 0) return "Aujourd'hui";
  if (min === max) return fmt(max);
  if (min === 0) return `Aujourd'hui – ${fmt(max)}`;
  return `${fmt(min)} – ${fmt(max)}`;
};

const DeliveryPanel = ({ price: productPrice, qty, selectedCity, onCityChange, weight, transitaireShipping = 0 }) => {
  const [open, setOpen] = useState(false);
  const deliveryFee  = selectedCity.price;
  const totalOrder   = Number(productPrice) * qty + deliveryFee + transitaireShipping;
  const estimatedDate = formatEstimatedDate(selectedCity.delay);

  // Weight-based shipping hint (CJ products are shipped from China)
  const weightNote = weight > 0
    ? weight < 500  ? "Colis léger · expédié sous 24h"
    : weight < 2000 ? "Colis standard · expédié sous 48h"
    : "Colis lourd · expédié sous 72h"
    : null;

  return (
    <div className="space-y-4">

      {/* ── Supply chain ───────────────────────────────────── */}
      <div className="bg-[#F8F9FA] rounded border border-[#E8EAED] p-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-[#767676] mb-3">
          Parcours de votre commande
        </p>
        <div className="flex items-center gap-0 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {[
            { flag: "🇨🇳", label: "Fournisseur",   sub: "Guangzhou",       active: false },
            { arrow: true,  label: "✈ Transit",      sub: "3 – 7 jours",    flight: true  },
            { flag: "🏭",   label: "OFS Entrepôt",   sub: "Bonamoussadi",   active: false },
            { arrow: true,  label: selectedCity.delay, sub: "",              flight: false },
            { flag: "🇨🇲",  label: selectedCity.city, sub: "Livraison",     active: true  },
          ].map((step, i) => step.arrow ? (
            <div key={i} className="flex flex-col items-center flex-shrink-0 mx-1 gap-0.5">
              <div className="flex items-center gap-0.5">
                <div className="w-4 h-[2px] bg-gradient-to-r from-[#D5D9D9] to-[#FF9900]" />
                <i className={`fa-solid ${step.flight ? "fa-plane" : "fa-truck-fast"} text-[8px] text-[#FF9900]`} />
                <div className="w-4 h-[2px] bg-gradient-to-r from-[#FF9900] to-[#D5D9D9]" />
              </div>
              <span className="text-[8px] text-[#767676] whitespace-nowrap">{step.label}</span>
            </div>
          ) : (
            <div key={i} className="flex flex-col items-center flex-shrink-0 w-[64px]">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base border-2 mb-1 ${
                step.active ? "border-[#FF9900] bg-[#FF9900]/10 shadow-sm" : "border-[#D5D9D9] bg-white"
              }`}>
                <span>{step.flag}</span>
              </div>
              <p className={`text-[8px] font-bold text-center leading-tight truncate w-full px-0.5 ${step.active ? "text-[#0F1111]" : "text-[#565959]"}`}>
                {step.label}
              </p>
              <p className="text-[7.5px] text-[#767676] text-center leading-tight">{step.sub}</p>
            </div>
          ))}
        </div>
        {weightNote && (
          <p className="text-[9px] text-[#565959] mt-2 flex items-center gap-1">
            <i className="fa-solid fa-weight-hanging text-[8px] text-[#767676]" />
            {weightNote}
          </p>
        )}
      </div>

      {/* ── Estimated date highlight ───────────────────────── */}
      <div className="flex items-center gap-3 bg-[#F0FFF4] border border-[#007600]/20 rounded p-3">
        <div className="w-10 h-10 bg-[#007600]/10 rounded-full flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-calendar-check text-[#007600] text-base" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#007600]">Livraison estimée</p>
          <p className="text-sm font-bold text-[#0F1111] truncate">{estimatedDate}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[9px] text-[#767676]">délai</p>
          <p className="text-xs font-bold text-[#0F1111]">{selectedCity.delay}</p>
        </div>
      </div>

      {/* ── City selector ──────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#565959] mb-2">
          Ville de livraison
        </p>
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
                selectedCity.price === 0
                  ? "bg-[#FF9900]/10 text-[#FF9900] border-[#FF9900]/20"
                  : "bg-[#F3F4F4] text-[#565959] border-[#D5D9D9]"
              }`}>
                {selectedCity.price === 0 ? selectedCity.badge : `+${selectedCity.price.toLocaleString()} F`}
              </span>
              <i className={`fa-solid fa-chevron-down text-[#565959] text-xs transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </button>
          {open && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-[#D5D9D9] rounded shadow-xl overflow-y-auto max-h-64">
              {DELIVERY_ZONES.map(zone => (
                <button key={zone.city} onClick={() => { onCityChange(zone); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#F3F4F4] border-b border-[#F3F4F4] last:border-0 transition-colors ${selectedCity.city === zone.city ? "bg-[#FFF8F0]" : ""}`}>
                  <div className="flex items-center gap-3">
                    <i className={`fa-solid ${zone.icon} ${zone.color} text-xs`} />
                    <div className="text-left">
                      <p className="font-bold text-[12px] text-[#0F1111]">{zone.city}</p>
                      <p className="text-[10px] text-[#565959]">{zone.delay} · {formatEstimatedDate(zone.delay)}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                    zone.price === 0 ? "bg-[#FF9900]/10 text-[#FF9900]" : "bg-[#F3F4F4] text-[#565959]"
                  }`}>
                    {zone.price === 0 ? zone.badge : `${zone.price.toLocaleString()} F`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Order summary ──────────────────────────────────── */}
      <div className="border border-[#D5D9D9] rounded overflow-hidden">
        <div className="bg-[#131921] px-4 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900]">Récapitulatif</p>
        </div>
        <div className="px-4 py-3 space-y-2 bg-white">
          <div className="flex justify-between text-sm">
            <span className="text-[#565959]">
              {qty > 1 ? `${qty} articles` : "Article"}
            </span>
            <span className="font-bold">{(Number(productPrice) * qty).toLocaleString()} FCFA</span>
          </div>
          {transitaireShipping > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#565959] flex items-center gap-1">
                <i className="fa-solid fa-plane text-[#007185] text-[9px]" />
                Expédition internationale
              </span>
              <span className="font-bold text-[#007185]">~{transitaireShipping.toLocaleString()} FCFA</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[#565959]">
              {transitaireShipping > 0 ? "Livraison locale →" : "Livraison →"} {selectedCity.city}
            </span>
            <span className={`font-bold ${deliveryFee === 0 ? "text-[#007600]" : ""}`}>
              {deliveryFee === 0 ? "Gratuite 🎁" : `+${deliveryFee.toLocaleString()} FCFA`}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-[#D5D9D9]">
            <span className="font-bold text-sm">Total estimé</span>
            <div className="text-right">
              <span className="font-bold text-xl text-[#B12704]">
                {totalOrder.toLocaleString()}
              </span>
              <span className="text-xs text-[#565959] font-normal ml-1">FCFA</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment chips ──────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {[
          { icon: "fa-mobile-screen-button", label: "Orange Money", color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
          { icon: "fa-mobile-screen-button", label: "MTN MoMo",     color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
          { icon: "fa-money-bill-wave",       label: "Cash/Livraison", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
        ].map(p => (
          <div key={p.label} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[9px] font-bold uppercase ${p.bg}`}>
            <i className={`fa-solid ${p.icon} ${p.color} text-xs`} />
            <span className="text-[#565959]">{p.label}</span>
          </div>
        ))}
      </div>

      {/* ── Diaspora / retour ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-start gap-2 bg-[#FFF8D3] border border-[#FCD200]/40 rounded p-2.5">
          <i className="fa-solid fa-plane text-[#FF9900] text-sm mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[8px] font-black uppercase text-[#C45500] tracking-widest leading-none mb-0.5">Diaspora</p>
            <p className="text-[10px] text-[#565959] leading-tight">
              Livrez un cadeau à vos proches au Cameroun.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-[#F0F7FF] border border-[#007185]/20 rounded p-2.5">
          <i className="fa-solid fa-rotate-left text-[#007185] text-sm mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[8px] font-black uppercase text-[#007185] tracking-widest leading-none mb-0.5">Retours</p>
            <p className="text-[10px] text-[#565959] leading-tight">
              7 jours — Remboursement intégral garanti.
            </p>
          </div>
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
  const [galleryIndex,  setGalleryIndex]  = useState(0);
  const [selectedCity,  setSelectedCity]  = useState(DELIVERY_ZONES[0]);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [shareToast,    setShareToast]    = useState(false);
  const [cartBlockMsg,  setCartBlockMsg]  = useState("");

  const { user, isMember } = useAuth();
  const { isInWishlist, toggle: toggleWishlist } = useWishlist();
  const wishlist  = isInWishlist(product?.id);

  useEffect(() => {
    // Reset UI state for the new product
    setGalleryIndex(0);
    setQty(1);

    // If navigation passed the exact product via state, use it instantly
    const stateProduct = location.state?.product;
    if (stateProduct && String(stateProduct.id) === String(productId)) {
      setProduct(stateProduct);
      setLoading(false);
      return;
    }

    // Otherwise always fetch fresh — covers related-product clicks where
    // product state was non-null (old product) causing the previous bug
    setProduct(null);
    setLoading(true);
    supabase.from("products").select("*").eq("id", productId).single()
      .then(({ data, error }) => {
        if (!error && data) setProduct(data);
        setLoading(false);
      });
  }, [productId]);

  useEffect(() => {
    if (product?.vendor_id) {
      supabase.from("vendors").select("*").eq("id", product.vendor_id).single()
        .then(({ data }) => setVendor(data));
    }
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const stored = (product.colors || []).filter(c => c && c !== "Default");
    let firstColor = stored[0] || "";
    if (!firstColor && Array.isArray(product.variants)) {
      for (const v of product.variants) {
        const raw = v.variantProperty || v.property || "";
        for (const part of raw.split(/[;,]/)) {
          const [k, val] = part.split(":");
          if ((k || "").toLowerCase().replace(/\s/g, "").includes("col") && val?.trim()) {
            firstColor = val.trim(); break;
          }
        }
        if (firstColor) break;
      }
    }
    setColor(firstColor);
    setSize(product.type === "Shoes" ? "40" : "M");
    setQty(Math.max(1, product.min_buy_qty || 1));
  }, [product]);

  useEffect(() => {
    if (!product?.id) return;
    (async () => {
      try { await supabase.rpc("increment_view_count", { product_id: product.id }); }
      catch { try { await supabase.from("products").update({ view_count: (product.view_count || 0) + 1 }).eq("id", product.id); } catch { /* silent */ } }
    })();

    if (product.vendor_id !== null) return;
    // Only skip refresh if we already have full data: images + real colors (not just "Default")
    const hasRealColors  = product.colors?.some(c => c && c !== "Default");
    const hasFullData    = product.images?.length > 1 && hasRealColors;
    if (hasFullData) {
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
        if (fresh.price > 0 && fresh.price > product.price)                          updates.price             = fresh.price;
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
        if (fresh.subcategory)                                                      updates.subcategory       = fresh.subcategory;
        if (fresh.ship_weight_g)                                                    updates.ship_weight_g         = fresh.ship_weight_g;
        if (fresh.length_cm)                                                        updates.length_cm             = fresh.length_cm;
        if (fresh.width_cm)                                                         updates.width_cm              = fresh.width_cm;
        if (fresh.height_cm)                                                        updates.height_cm             = fresh.height_cm;
        if (fresh.pack_l_cm)                                                        updates.pack_l_cm             = fresh.pack_l_cm;
        if (fresh.pack_w_cm)                                                        updates.pack_w_cm             = fresh.pack_w_cm;
        if (fresh.pack_h_cm)                                                        updates.pack_h_cm             = fresh.pack_h_cm;
        if (fresh.sizes?.length > 0)                                                updates.sizes                 = fresh.sizes;
        if (fresh.quantity_prices?.length > 0)                                      updates.quantity_prices       = fresh.quantity_prices;
        if (fresh.brand)                                                             updates.brand                 = fresh.brand;
        if (fresh.sku)                                                               updates.sku                   = fresh.sku;
        if (fresh.min_buy_qty > 1)                                                  updates.min_buy_qty           = fresh.min_buy_qty;
        if (fresh.max_buy_qty)                                                       updates.max_buy_qty           = fresh.max_buy_qty;
        if (fresh.product_unit)                                                      updates.product_unit          = fresh.product_unit;
        if (fresh.sale_num > 0)                                                      updates.sale_num              = fresh.sale_num;
        if (fresh.suggest_price_fcfa)                                                updates.suggest_price_fcfa    = fresh.suggest_price_fcfa;
        if (fresh.suggest_price_usd)                                                 updates.suggest_price_usd     = fresh.suggest_price_usd;
        if (fresh.label_codes)                                                       updates.label_codes           = fresh.label_codes;
        if (fresh.origin_country && fresh.origin_country !== "CN")                   updates.origin_country        = fresh.origin_country;
        if (fresh.express_delivery_days)                                             updates.express_delivery_days = fresh.express_delivery_days;
        if (fresh.delivery_cycle)                                                    updates.delivery_cycle        = fresh.delivery_cycle;
        if (fresh.shipping_fee_usd)                                                  updates.shipping_fee_usd      = fresh.shipping_fee_usd;
        if (fresh.is_on_sale === false)                                              updates.is_on_sale            = false;
        if (fresh.cj_added_at)                                                       updates.cj_added_at           = fresh.cj_added_at;
        if (fresh.variant_key_type)                                                  updates.variant_key_type      = fresh.variant_key_type;
        if (fresh.customs_code)                                                      updates.customs_code          = fresh.customs_code;
        if (fresh.customs_name)                                                      updates.customs_name          = fresh.customs_name;
        if (fresh.rating_avg > 0)                                                    updates.rating_avg            = fresh.rating_avg;
        if (fresh.review_count > 0)                                                  updates.review_count          = fresh.review_count;
        if (fresh.pack_num > 1)                                                      updates.pack_num              = fresh.pack_num;
        if (fresh.multi_package)                                                     updates.multi_package         = fresh.multi_package;
        if (fresh.sale_status)                                                       updates.sale_status           = fresh.sale_status;
        if (fresh.cj_category_path)                                                  updates.cj_category_path      = fresh.cj_category_path;
        if (fresh.video_thumbnail)                                                   updates.video_thumbnail       = fresh.video_thumbnail;
        if (fresh.is_discount_sell)                                                  updates.is_discount_sell      = fresh.is_discount_sell;
        if (fresh.is_customizable)                                                   updates.is_customizable       = fresh.is_customizable;
        if (fresh.light_unit)                                                        updates.light_unit            = fresh.light_unit;
        if (fresh.product_language)                                                  updates.product_language      = fresh.product_language;
        await supabase.from("products").update(updates).eq("id", product.id);
        setProduct(prev => prev ? { ...prev, ...updates } : prev);
      } catch { /* silent */ }
    };
    refreshCjData();
  }, [product?.id]);

  const price       = Number(product?.price) || 0;
  const memberPrice = Math.round(price * (1 - MEMBER_DISCOUNT));
  const ofsPoints   = Math.max(1, Math.floor(price / 500));

  const isCjProduct      = !product?.vendor_id;
  const shippingEstimate = isCjProduct
    ? Math.round(1015 + ((product?.ship_weight_g || product?.weight_g || 200) / 1000) * 10000)
    : 0;

  // Variant-level price and availability (keyed by color name, from raw CJ variant objects)
  const variantMeta = useMemo(() => {
    const priceMap = {};
    const availMap = {};
    const JUNK = /^\d+pcs?$/i;
    const SZ   = /^(xs|s|m|l|xl|xxl|2xl|3xl|4xl|5xl|xxxl|\d{1,3})$/i;
    (Array.isArray(product?.variants) ? product.variants : []).forEach(v => {
      const vKey  = (v.variantKey || "").trim();
      const parts = vKey ? vKey.split("-") : [];
      while (parts.length > 0 && JUNK.test(parts[parts.length - 1].trim())) parts.pop();
      if (parts.length >= 2 && SZ.test(parts[parts.length - 1].trim())) parts.pop();
      const cName = parts.join(" ").trim();
      if (!cName || cName.toLowerCase() === "default") return;
      // variantStatus: 1=available, 0=sold out, null=assume available
      const vStat = v.variantStatus;
      const ok    = vStat == null || Number(vStat) === 1 || vStat === true;
      if (availMap[cName] === undefined) availMap[cName] = ok;
      else if (!ok) availMap[cName] = false;
      // First non-zero variant price per color
      if (!priceMap[cName]) {
        const vp = parseFloat(v.variantSellPrice || v.variantPrice || v.sellPrice || 0);
        if (vp > 0) priceMap[cName] = Math.round(vp * 610 * PRICE_MARGIN);
      }
    });
    return { priceMap, availMap };
  }, [product?.variants]);

  // Quantity price tiers — derived from CJ import or null
  const quantityTiers = Array.isArray(product?.quantity_prices) && product.quantity_prices.length > 1
    ? [...product.quantity_prices].sort((a, b) => a.min - b.min)
    : [];
  const activeTierIdx = quantityTiers.length > 0
    ? quantityTiers.reduce((best, t, i) => qty >= t.min ? i : best, 0)
    : -1;
  // Per-variant price (e.g. XL costs more); falls back to product base price
  const activeBasePrice = variantMeta.priceMap[color] || price;
  const activeTierPrice = activeTierIdx >= 0 ? quantityTiers[activeTierIdx].price_fcfa : activeBasePrice;

  // Buy quantity constraints from CJ
  const minQty = Math.max(1, product?.min_buy_qty || 1);
  const maxQty = product?.max_buy_qty || (product?.stock_qty > 0 && product.stock_qty < 9999 ? product.stock_qty : null);

  const getColorHex = (name) => {
    if (!name) return "#888";
    const EXACT = {
      Black:"#111",black:"#111",Noir:"#111",noir:"#111",
      White:"#f5f5f5",white:"#f5f5f5",Blanc:"#f5f5f5",blanc:"#f5f5f5",
      Red:"#ef4444",red:"#ef4444",Rouge:"#ef4444",rouge:"#ef4444",
      Blue:"#3b82f6",blue:"#3b82f6",Bleu:"#3b82f6",bleu:"#3b82f6",
      Navy:"#1e3a5f",navy:"#1e3a5f",Marine:"#1e3a5f",marine:"#1e3a5f",
      Green:"#16a34a",green:"#16a34a",Vert:"#16a34a",vert:"#16a34a",
      Olive:"#65a30d",olive:"#65a30d",
      Yellow:"#facc15",yellow:"#facc15",Jaune:"#facc15",jaune:"#facc15",
      Orange:"#f97316",orange:"#f97316",
      Pink:"#ec4899",pink:"#ec4899",Rose:"#ec4899",rose:"#ec4899",
      Purple:"#a855f7",purple:"#a855f7",Violet:"#a855f7",violet:"#a855f7",
      Brown:"#92400e",brown:"#92400e",Marron:"#92400e",marron:"#92400e",
      Camel:"#c19a6b",camel:"#c19a6b",Beige:"#d4b896",beige:"#d4b896",
      Gray:"#9ca3af",gray:"#9ca3af",Grey:"#9ca3af",grey:"#9ca3af",
      Gris:"#9ca3af",gris:"#9ca3af",Silver:"#c0c0c0",silver:"#c0c0c0",
      Argent:"#c0c0c0",argent:"#c0c0c0",
      Gold:"#d97706",gold:"#d97706",Or:"#d97706",
      Khaki:"#c3b091",khaki:"#c3b091",Sky:"#38bdf8",sky:"#38bdf8",
      Teal:"#0d9488",teal:"#0d9488",Turquoise:"#0d9488",turquoise:"#0d9488",
      Coral:"#fb7185",coral:"#fb7185",Neon:"#00ff88",neon:"#00ff88",
      Burgundy:"#7f1d1d",burgundy:"#7f1d1d",Slate:"#64748b",slate:"#64748b",
    };
    if (EXACT[name]) return EXACT[name];
    const low = name.toLowerCase();
    // First word of compound color (e.g. "Dark Blue", "Army Green", "Blue-White")
    const first = low.split(/[-\s/]/)[0];
    if (EXACT[first] || EXACT[first.charAt(0).toUpperCase() + first.slice(1)]) {
      return EXACT[first] || EXACT[first.charAt(0).toUpperCase() + first.slice(1)];
    }
    // Keyword scan
    if (low.includes("black") || low.includes("noir") || low.includes("dark"))  return "#1a1a1a";
    if (low.includes("white") || low.includes("blanc") || low.includes("cream") || low.includes("ivory")) return "#f5f5f5";
    if (low.includes("red")   || low.includes("rouge") || low.includes("wine")  || low.includes("crimson")) return "#ef4444";
    if (low.includes("blue")  || low.includes("bleu")  || low.includes("cobalt") || low.includes("indigo"))  return "#3b82f6";
    if (low.includes("navy")  || low.includes("marine"))                                                      return "#1e3a5f";
    if (low.includes("green") || low.includes("vert")  || low.includes("army")  || low.includes("forest"))   return "#16a34a";
    if (low.includes("olive") || low.includes("khaki") || low.includes("kaki"))                               return "#65a30d";
    if (low.includes("yellow")|| low.includes("jaune") || low.includes("lemon"))                             return "#facc15";
    if (low.includes("orange"))                                                                               return "#f97316";
    if (low.includes("pink")  || low.includes("rose")  || low.includes("fuchsia") || low.includes("magenta")) return "#ec4899";
    if (low.includes("purple")|| low.includes("violet")|| low.includes("lavender")|| low.includes("mauve"))  return "#a855f7";
    if (low.includes("brown") || low.includes("marron")|| low.includes("choco")  || low.includes("coffee"))  return "#92400e";
    if (low.includes("camel") || low.includes("beige") || low.includes("sand")   || low.includes("tan"))     return "#c3b091";
    if (low.includes("gray")  || low.includes("grey")  || low.includes("gris")   || low.includes("silver"))  return "#9ca3af";
    if (low.includes("gold")  || low.includes("golden")|| low.includes("doré"))                              return "#d97706";
    if (low.includes("teal")  || low.includes("turquoise") || low.includes("aqua") || low.includes("cyan"))  return "#0d9488";
    return "#888";
  };

  // ── Parse colors and sizes from all available sources ────────────────────────
  const { realColors, realSizes } = useMemo(() => {
    const colSet  = new Set();
    const sizeSet = new Set();

    // 1. Stored `colors` column — skip generic placeholders
    (product?.colors || [])
      .filter(c => c && c !== "Default" && c !== "default")
      .forEach(c => colSet.add(c));

    // 2. Stored `sizes` column (populated at import time by cjApi mapCjToProduct)
    (product?.sizes || []).filter(Boolean).forEach(s => sizeSet.add(s));

    // 3. Re-extract from `variants` JSON with the same improved parser as cjApi.js
    //    (handles "Color:Khaki S 2PCS", no-colon labels, short variantNameEn)
    const COLOR_KW = new Set([
      "black","white","red","blue","green","yellow","orange","purple","pink","gray","grey",
      "brown","navy","beige","gold","silver","rose","violet","coral","turquoise","cream",
      "khaki","camel","olive","maroon","burgundy","cyan","teal","lavender","tan","sand",
      "ivory","charcoal","slate","indigo","mint","lime","multicolor","colorful","multicolour",
      "nude","apricot","champagne","coffee","wine","army","dark","light","bright","pale",
      "noir","blanc","rouge","bleu","vert","jaune","gris","marron","doré","argenté",
    ]);
    const SIZE_RE = /^(xs|s|m|l|xl|xxl|2xl|3xl|4xl|5xl|xxxl|\d{1,3}(gb|tb|ml|g|kg|cm|mm|in)?|\d{2}x\d{2}|\d{2}-\d{2}|eu\d{2}|us\d{1,2}|\d{2,3})$/i;
    const JUNK_RE = /^\d+pcs?$/i;
    const parseWords = (str, cS, sS) => {
      if (!str) return;
      const words = str.split(/[\s\-\/,;|()[\]]+/).filter(w => w.length >= 1);
      if (words.length > 8) return;
      words.forEach(w => {
        const lo = w.toLowerCase();
        if (COLOR_KW.has(lo)) cS.add(w.charAt(0).toUpperCase() + w.slice(1));
        else if (SIZE_RE.test(lo) && !JUNK_RE.test(lo)) sS.add(w.toUpperCase());
      });
    };

    (Array.isArray(product?.variants) ? product.variants : []).forEach(v => {
      const raw = (v.variantProperty || v.property || "").trim();
      if (raw.includes(":")) {
        raw.split(/[;,]/).forEach(prop => {
          const ci = prop.indexOf(":");
          if (ci === -1) return;
          const k   = prop.slice(0, ci).toLowerCase().replace(/\s/g, "");
          const val = prop.slice(ci + 1).trim();
          if (!val) return;
          if (k.includes("col") || k.includes("coul") || k === "colour") {
            const cleaned = val.split(/\s+/)
              .filter(w => !SIZE_RE.test(w.toLowerCase()) && !JUNK_RE.test(w))
              .join(" ").trim();
            colSet.add(cleaned || val);
            val.split(/\s+/).forEach(w => {
              if (SIZE_RE.test(w.toLowerCase()) && !JUNK_RE.test(w)) sizeSet.add(w.toUpperCase());
            });
          } else if (
            k.includes("size") || k.includes("taille") || k.includes("pointure") ||
            k.includes("capacity") || k.includes("storage")
          ) {
            sizeSet.add(val);
          }
        });
      } else if (raw) {
        parseWords(raw, colSet, sizeSet);
      }

      // variantKey: "Color-Size-2PCS" — most reliable when variantProperty is empty/"[]"
      if (!raw.includes(":")) {
        const vKey = (v.variantKey || "").trim();
        if (vKey) {
          const parts = vKey.split("-");
          while (parts.length > 0 && JUNK_RE.test(parts[parts.length - 1].trim())) parts.pop();
          if (parts.length >= 2) {
            const last = parts[parts.length - 1].trim();
            if (SIZE_RE.test(last.toLowerCase())) sizeSet.add(parts.pop().trim().toUpperCase());
          }
          const cName = parts.join(" ").trim();
          if (cName && cName.toLowerCase() !== "default") colSet.add(cName);
        }
      }

      const vName = (v.variantNameEn || v.variantName || "").trim();
      parseWords(vName, colSet, sizeSet);
    });

    return { realColors: [...colSet], realSizes: [...sizeSet] };
  }, [product?.colors, product?.sizes, product?.variants]);

  const isApparel     = product?.type === "Clothing" || product?.type === "Femme";
  const isShoes       = product?.type === "Shoes";
  const isElectronics = product?.type === "Tech Lab" || product?.type === "Audio Lab";
  const isBeauty      = product?.type === "Beauté" || product?.type === "Fragrance";
  const isAccessory   = product?.type === "Accessories";
  const isMaison      = product?.type === "Maison";
  const isSport       = product?.type === "Sport";
  const isBebe        = product?.type === "Bébé & Enfants";
  const isAuto        = product?.type === "Auto";

  const productColors = realColors.map(name => ({ name, hex: getColorHex(name) }));
  // Real sizes from variants; fall back to standard apparel/shoe lists when empty
  const variantSizes  = realSizes.length > 0 ? realSizes
    : isShoes   ? ["40","41","42","43","44","45"]
    : isApparel ? ["XS","S","M","L","XL","XXL"]
    : [];

  // ── Build gallery image list (product images + deduplicated variant images)
  //    and a map: colorName → gallery index for click-to-jump
  const { galleryImages, colorImageMap } = useMemo(() => {
    const imgs = product?.images?.length > 0
      ? [...product.images]
      : product?.img ? [product.img] : [];

    const cMap = {};
    const seenColors = new Set();
    const JUNK = /^\d+pcs?$/i;
    const SZ   = /^(xs|s|m|l|xl|xxl|2xl|3xl|4xl|5xl|xxxl|\d{1,3})$/i;

    (Array.isArray(product?.variants) ? product.variants : []).forEach(v => {
      const vKey = (v.variantKey || "").trim();
      if (!vKey) return;
      const parts = vKey.split("-");
      while (parts.length > 0 && JUNK.test(parts[parts.length - 1].trim())) parts.pop();
      if (parts.length >= 2 && SZ.test(parts[parts.length - 1].trim())) parts.pop();
      const cName = parts.join(" ").trim();
      if (!cName || cName.toLowerCase() === "default" || seenColors.has(cName)) return;
      seenColors.add(cName);
      const varImg = v.variantImage;
      if (!varImg) return;
      let idx = imgs.indexOf(varImg);
      if (idx === -1) { imgs.push(varImg); idx = imgs.length - 1; }
      cMap[cName] = idx;
    });

    return { galleryImages: imgs, colorImageMap: cMap };
  }, [product?.images, product?.img, product?.variants]);

  const ratingVal   = product?.rating_avg  || 4.2;
  const reviewCount = product?.review_count || 0;

  const handleAddToCart = () => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];

    // ── Blocker 2: exact variant matching ─────────────────────────────────────
    // Priority 1 — variantProperty ("Color:Black;Size:M") — most explicit
    // Priority 2 — variantKey segment matching ("Army Green-XL")
    const selectedVariant = variants.find(v => {
      const prop = (v.variantProperty || v.property || "").toLowerCase();
      if (prop.includes(":")) {
        const propMap = {};
        prop.split(/[;,]/).forEach(kv => {
          const ci = kv.indexOf(":");
          if (ci < 0) return;
          propMap[kv.slice(0, ci).replace(/\s/g, "")] = kv.slice(ci + 1).trim();
        });
        const pColor = propMap["color"] || propMap["colour"] || propMap["couleur"] || null;
        const pSize  = propMap["size"]  || propMap["taille"] || propMap["pointure"]  || null;
        if (pColor !== null || pSize !== null) {
          const colorOk = !color || color === "Default" || !pColor
            || pColor.includes(color.toLowerCase()) || color.toLowerCase().includes(pColor);
          const sizeOk  = !size  || size === "Unique" || !pSize
            || pSize === size.toLowerCase();
          return colorOk && sizeOk;
        }
      }
      // Segment-exact fallback — avoids "Red" matching "Dark Red-M"
      const vKey = (v.variantKey || "").toLowerCase();
      const cLow = color.toLowerCase();
      const sLow = (size || "").toLowerCase();
      const colorOk = !color || color === "Default"
        || vKey === cLow
        || vKey.startsWith(cLow + "-");
      const sizeOk  = !size  || size === "Unique"
        || vKey === sLow
        || vKey.endsWith("-" + sLow)
        || vKey.includes("-" + sLow + "-");
      return colorOk && sizeOk;
    });

    // ── Blocker 3: variantStatus check ────────────────────────────────────────
    if (selectedVariant) {
      const vStat = selectedVariant.variantStatus;
      const available = vStat == null || Number(vStat) === 1 || vStat === true;
      if (!available) {
        setCartBlockMsg("Cette variante est épuisée — choisissez une autre option.");
        setTimeout(() => setCartBlockMsg(""), 3000);
        return;
      }
    }

    // Fallback: if no exact variant match, use the first in-stock variant so
    // CJ fulfillment always has a vid to work with.
    const effectiveVariant = selectedVariant || (variants.length > 0
      ? (variants.find(v => { const s = v.variantStatus; return s == null || Number(s) === 1 || s === true; }) || variants[0])
      : null);

    addToCart({
      ...product,
      selectedSize:       isShoes || isApparel ? size : "Unique",
      selectedColor:      color,
      selectedVariantId:  effectiveVariant?.vid || effectiveVariant?.variantId || null,
      selectedVariantSku: effectiveVariant?.variantSku || effectiveVariant?.sku || null,
      quantity:           qty,
      deliveryCity:       selectedCity.city,
      deliveryFee:        selectedCity.price,
      price:              activeTierPrice,
      totalWithDelivery:  activeTierPrice * qty + selectedCity.price,
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

      {/* Sponsored banner — shows a different vendor than the current product's */}
      <SponsoredBanner excludeVendorId={product?.vendor_id} />

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
          <div className="grid grid-cols-1 lg:grid-cols-[55%_1fr] gap-4 mb-4 items-start">

            {/* ── GALLERY (sticky) ── */}
            <div className="lg:sticky lg:top-4">
              <div className="bg-white border border-[#D5D9D9] rounded p-3 sm:p-4 lg:p-6">
                <ImageGallery
                  images={galleryImages}
                  activeImg={galleryIndex}
                  setActiveImg={setGalleryIndex}
                  name={product.name}
                  status={product.status}
                />
              </div>
            </div>

            {/* ── INFO PANEL ── */}
            <div className="bg-white border border-[#D5D9D9] rounded p-4 lg:p-6 flex flex-col min-w-0">

                {/* Brand / vendor */}
                <div className="mb-1 flex items-center gap-2 flex-wrap">
                  {vendor?.shop_name ? (
                    <Link to={`/shop/${vendor.shop_name}`} className="text-sm text-[#007185] hover:text-[#C45500] hover:underline">
                      Boutique : {vendor.shop_name}
                    </Link>
                  ) : (
                    <span className="text-sm text-[#007185]">Sélection <b>OFS Cameroun</b></span>
                  )}
                  {product.brand && (
                    <span className="text-[9px] font-black uppercase tracking-widest bg-[#F3F4F4] border border-[#D5D9D9] px-2 py-0.5 rounded text-[#565959]">
                      {product.brand}
                    </span>
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
                    {product.sale_num > 0 ? `${product.sale_num.toLocaleString()} vendus` : "Tendance"}
                  </span>
                  <span className="text-[#D5D9D9]">|</span>
                  <span className="text-xs bg-[#FF9900]/10 text-[#FF9900] border border-[#FF9900]/25 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                    OFS Certifié
                  </span>
                  {product.is_discount_sell && (
                    <span className="text-xs bg-[#CC0C39] text-white px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                      <i className="fa-solid fa-tag mr-1 text-[9px]" />PROMO
                    </span>
                  )}
                  {product.is_customizable && (
                    <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                      <i className="fa-solid fa-pen-nib mr-1 text-[9px]" />Personnalisable
                    </span>
                  )}
                </div>

                {/* ── KEY SPECS (électronique) ── */}
                {isElectronics && product.features?.length > 0 && (
                  <div className="mt-2 mb-3">
                    <div className="flex flex-wrap gap-1.5">
                      {product.features.slice(0, 5).map((feat, i) => {
                        const sep = feat.indexOf(":");
                        const lbl = sep > 0 ? feat.slice(0, sep).trim() : null;
                        const val = sep > 0 ? feat.slice(sep + 1).trim() : feat.trim();
                        return (
                          <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-[#131921] text-white rounded-full px-3 py-1 flex-shrink-0">
                            {lbl && <span className="text-[#767676] font-normal">{lbl}</span>}
                            <span className="font-bold">{val}</span>
                          </span>
                        );
                      })}
                    </div>
                    {product.sku && (
                      <p className="text-[9px] font-mono text-[#767676] mt-2">
                        Modèle : <span className="text-[#0F1111] font-bold">{product.sku}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* ── KEY INFO (fragrance) ── */}
                {isBeauty && product.features?.length > 0 && (
                  <div className="mt-2 mb-3 flex flex-wrap gap-1.5">
                    {product.features.filter(f => /ml|oz|note|concentration|type|famille/i.test(f)).slice(0, 4).map((feat, i) => {
                      const sep = feat.indexOf(":");
                      const val = sep > 0 ? feat.slice(sep + 1).trim() : feat.trim();
                      const lbl = sep > 0 ? feat.slice(0, sep).trim() : null;
                      return (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-purple-50 border border-purple-200 text-purple-800 rounded-full px-3 py-1">
                          {lbl && <span className="font-normal opacity-70">{lbl}</span>}
                          <span className="font-bold">{val}</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="border-t border-[#D5D9D9] my-4" />

                {/* ── PRICE ── */}
                <div className="mb-4">
                  {/* Suggested retail price (from CJ — displayed only when genuinely higher) */}
                  {product.suggest_price_fcfa > 0 && product.suggest_price_fcfa > activeTierPrice && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-[#565959] line-through">
                        {product.suggest_price_fcfa.toLocaleString()} FCFA
                      </span>
                      <span className="text-[9px] font-bold text-[#007600] bg-[#007600]/10 px-1.5 py-0.5 rounded">
                        Prix de référence fournisseur
                      </span>
                    </div>
                  )}
                  {/* Main price — updates with active quantity tier */}
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-xs text-[#565959] font-bold">Prix :</span>
                    <span className="text-3xl font-bold text-[#0F1111] leading-none">
                      {activeTierPrice.toLocaleString()}
                    </span>
                    <span className="text-base text-[#565959]">FCFA</span>
                    {activeTierIdx > 0 && (
                      <span className="text-[10px] bg-[#007600]/10 text-[#007600] font-bold px-1.5 py-0.5 rounded border border-[#007600]/20">
                        tarif ×{quantityTiers[activeTierIdx].min}+
                      </span>
                    )}
                    {variantMeta.priceMap[color] && variantMeta.priceMap[color] !== price && (
                      <span className="text-[10px] text-[#565959] font-normal">
                        (variante {color})
                      </span>
                    )}
                  </div>

                  {/* Quantity price tiers table */}
                  {quantityTiers.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1.5">
                        <i className="fa-solid fa-tags text-[8px] mr-1" />
                        Tarifs dégressifs
                      </p>
                      <div className="flex gap-1.5 flex-wrap">
                        {quantityTiers.map((tier, i) => (
                          <button key={i} onClick={() => setQty(tier.min)}
                            className={`flex flex-col items-center px-3 py-2 rounded border text-center transition-all cursor-pointer ${
                              activeTierIdx === i
                                ? "bg-[#131921] border-[#131921] text-white shadow-sm"
                                : "bg-[#F3F4F4] border-[#D5D9D9] text-[#0F1111] hover:border-[#FF9900]"
                            }`}>
                            <span className={`text-[8px] font-black uppercase tracking-wide leading-none mb-0.5 ${activeTierIdx === i ? "text-[#FF9900]" : "text-[#767676]"}`}>
                              {tier.max ? `${tier.min}–${tier.max} pcs` : `${tier.min}+ pcs`}
                            </span>
                            <span className="text-[13px] font-bold leading-none">{tier.price_fcfa.toLocaleString()} F</span>
                            <span className={`text-[8px] leading-none mt-0.5 ${activeTierIdx === i ? "text-[#767676]" : "text-[#aaa]"}`}>
                              /unité
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] text-[#565959] mt-1.5">
                        <i className="fa-solid fa-circle-info text-[8px] mr-1" />
                        Cliquez sur un palier pour ajuster la quantité
                      </p>
                    </div>
                  )}

                  {/* Pack size notice */}
                  {product.pack_num > 1 && (
                    <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-[#007600] bg-[#007600]/8 border border-[#007600]/20 rounded px-2.5 py-1.5 w-fit">
                      <i className="fa-solid fa-boxes-stacked text-[9px]" />
                      Vendu par lot de {product.pack_num} unités
                    </div>
                  )}

                  {/* Trust row */}
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="flex items-center gap-1 text-[10px] text-[#565959]">
                      <i className="fa-solid fa-shield-check text-[#007600] text-[9px]" />
                      Prix transparent
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-[#565959]">
                      <i className="fa-solid fa-medal text-[#FF9900] text-[9px]" />
                      Qualité vérifiée OFS
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-[#FF9900] font-bold">
                      <i className="fa-solid fa-star text-[9px]" />
                      +{ofsPoints} pts
                    </span>
                  </div>

                  {/* ── Shipping banner (CJ products only) ── */}
                  {isCjProduct && shippingEstimate > 0 && (
                    <div className="flex items-center gap-3 bg-[#E6F3F5] border border-[#007185]/20 rounded-lg px-3 py-2.5 mb-3">
                      <div className="w-9 h-9 bg-[#007185]/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-plane-arrival text-[#007185] text-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-[#007185] uppercase tracking-wider leading-none mb-0.5">
                          Livré depuis la Chine · 15–20 jours
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-[#565959]">
                            <i className="fa-solid fa-box text-[9px] mr-0.5" />
                            YTO Chine + avion → Douala
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 border-l border-[#007185]/20 pl-3">
                        <p className="text-[8px] text-[#007185] font-black uppercase tracking-wider mb-0.5">Prix livré</p>
                        <p className="text-lg font-black text-[#007185] leading-none">
                          {(activeTierPrice + shippingEstimate).toLocaleString()}
                        </p>
                        <p className="text-[9px] text-[#565959]">FCFA (dont ~{shippingEstimate.toLocaleString()} transport)</p>
                      </div>
                    </div>
                  )}
                  {/* Certification badges (CE, FCC, RoHS…) */}
                  {product.label_codes && (
                    <div className="flex gap-1.5 flex-wrap mb-2">
                      {String(product.label_codes).split(/[,;|/\s]+/).filter(Boolean).map(code => (
                        <span key={code} className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-[#F3F4F4] border border-[#D5D9D9] rounded text-[#565959]">
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* is_on_sale warning */}
                  {product.is_on_sale === false && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-2.5 mb-2">
                      <i className="fa-solid fa-triangle-exclamation text-amber-500 text-sm mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-amber-700">Disponibilité limitée</p>
                        <p className="text-[9px] text-amber-600 leading-tight">
                          Ce produit est temporairement hors vente directe. Contactez-nous pour une commande spéciale.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Gift card CTA */}
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-[#131921] to-[#1a2738] rounded border border-[#2a3a4e]">
                    <div className="w-10 h-10 bg-[#FF9900]/15 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-gift text-[#FF9900] text-base" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] font-black uppercase text-[#FF9900] tracking-widest leading-none mb-0.5">Carte Cadeau</p>
                      <p className="text-sm text-white font-medium leading-tight">Offrir ce produit à un proche</p>
                      <p className="text-[9px] text-[#767676] leading-none mt-0.5">Livraison directe · Message personnalisé</p>
                    </div>
                    <Link to="/gift" state={{ productId: product.id, productName: product.name, price }}
                      className="flex-shrink-0 text-[10px] font-bold text-[#0F1111] bg-[#FFD814] hover:bg-[#F7CA00] px-3 py-2 rounded transition-colors whitespace-nowrap">
                      Obtenir →
                    </Link>
                  </div>
                </div>

                <div className="border-t border-[#D5D9D9] mb-4" />

                {/* ── SUPPLY CHAIN STRIP ── */}
                {(() => {
                  const ORIGIN_INFO = {
                    CN: { flag: "🇨🇳", name: "Chine"      },
                    US: { flag: "🇺🇸", name: "USA"        },
                    TR: { flag: "🇹🇷", name: "Turquie"    },
                    IN: { flag: "🇮🇳", name: "Inde"       },
                    TH: { flag: "🇹🇭", name: "Thaïlande" },
                    VN: { flag: "🇻🇳", name: "Vietnam"    },
                    KR: { flag: "🇰🇷", name: "Corée"      },
                    JP: { flag: "🇯🇵", name: "Japon"      },
                  };
                  const oc     = (product.origin_country || "CN").toUpperCase();
                  const origin = ORIGIN_INFO[oc] || { flag: "🌍", name: oc };
                  const transit = product.delivery_cycle || product.express_delivery_days || "3–7j";
                  return (
                    <div className="mb-4">
                      <div className="flex items-center gap-1.5 text-[10px] overflow-x-auto pb-0.5 flex-wrap" style={{ scrollbarWidth: "none" }}>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          <span>{origin.flag}</span>
                          <span className="font-bold text-[#0F1111]">{origin.name}</span>
                        </span>
                        <i className="fa-solid fa-plane text-[#767676] text-[8px] flex-shrink-0" />
                        <span className="text-[#767676] flex-shrink-0">Transit {transit}</span>
                        {product.light_unit && (
                          <>
                            <span className="text-[#D5D9D9] text-[8px] flex-shrink-0">·</span>
                            <span className="flex items-center gap-0.5 text-[#007185] flex-shrink-0">
                              <i className="fa-solid fa-feather text-[8px]" />Colis léger
                            </span>
                          </>
                        )}
                        <i className="fa-solid fa-arrow-right text-[#D5D9D9] text-[8px] flex-shrink-0" />
                        <span className="flex items-center gap-1 flex-shrink-0">
                          <span>🏭</span>
                          <span className="font-bold text-[#0F1111]">OFS Douala</span>
                        </span>
                        <i className="fa-solid fa-arrow-right text-[#FF9900] text-[8px] flex-shrink-0" />
                        <span className="flex items-center gap-1 flex-shrink-0 text-[#007600] font-bold">
                          <span>🇨🇲</span>
                          <span>{selectedCity.city}</span>
                          <span className="text-[#565959] font-normal">· {selectedCity.delay}</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-[#565959] mt-1.5 flex items-center gap-1">
                        <i className="fa-solid fa-calendar-check text-[#007600] text-[9px]" />
                        <span>Estimé : <b className="text-[#0F1111]">{formatEstimatedDate(selectedCity.delay)}</b></span>
                        <span className="mx-1 text-[#D5D9D9]">·</span>
                        <i className="fa-solid fa-rotate-left text-[9px]" />
                        <span>Retour 7j</span>
                        {product.sku && (
                          <>
                            <span className="mx-1 text-[#D5D9D9]">·</span>
                            <span className="font-mono text-[8px] text-[#aaa]">SKU {product.sku}</span>
                          </>
                        )}
                      </p>
                    </div>
                  );
                })()}

                {/* Stock status */}
                <div className="mb-4">
                  {product.stock_qty === 0 ? (
                    <span className="text-[#CC0C39] font-bold text-sm">
                      <i className="fa-solid fa-circle-xmark mr-1 text-xs" />
                      Rupture de stock
                    </span>
                  ) : product.stock_qty > 0 && product.stock_qty <= 10 ? (
                    <span className="text-[#CC0C39] font-bold text-sm">
                      <i className="fa-solid fa-triangle-exclamation mr-1 text-xs" />
                      Plus que {product.stock_qty} en stock — commandez vite !
                    </span>
                  ) : product.stock_qty < 0 ? (
                    <span className="text-[#007600] font-bold text-sm flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-check text-xs" />
                      Disponible sur commande
                    </span>
                  ) : (
                    <span className="text-[#007600] font-bold text-sm flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-check text-xs" />
                      {isElectronics && product.stock_qty > 10
                        ? `En stock · ${product.stock_qty > 999 ? "999+" : product.stock_qty} unités`
                        : "En stock"}
                    </span>
                  )}
                </div>

                <div className="border-t border-[#D5D9D9] mb-4" />

                {/* ── COLOR ── */}
                {productColors.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-bold mb-2 text-[#0F1111]">
                      {isElectronics ? "Coloris" : isBeauty ? "Contenance" : "Couleur"} : <span className="font-normal text-[#565959]">{color}</span>
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {productColors.map(c => {
                        const available = variantMeta.availMap[c.name] !== false;
                        const hasVPrice = !!variantMeta.priceMap[c.name];
                        return (
                          <button
                            key={c.name}
                            onClick={() => {
                              if (!available) return;
                              setColor(c.name);
                              if (colorImageMap[c.name] !== undefined) setGalleryIndex(colorImageMap[c.name]);
                            }}
                            title={`${c.name}${!available ? " — Épuisé" : hasVPrice ? ` — ${variantMeta.priceMap[c.name].toLocaleString()} F` : ""}`}
                            className={`relative w-8 h-8 rounded-full border-2 transition-all ${
                              !available
                                ? "opacity-35 cursor-not-allowed"
                                : color === c.name
                                ? "border-[#FF9900] scale-110 shadow-[0_0_0_2px_rgba(255,153,0,0.2)] hover:scale-110"
                                : "border-[#D5D9D9] hover:border-[#adb5bd] hover:scale-110"
                            }`}
                            style={{ backgroundColor: c.hex }}
                          >
                            {!available && (
                              <span className="absolute inset-0 flex items-center justify-center rounded-full overflow-hidden">
                                <span className="block w-[110%] h-px bg-red-500/60 rotate-45" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── SIZE ── */}
                {variantSizes.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-[#0F1111]">
                          {(() => {
                          const vkt = (product.variant_key_type || "").toLowerCase();
                          if (isShoes) return "Pointure";
                          if (vkt.includes("size")) return "Taille";
                          if (vkt.includes("storage") || vkt.includes("capacity") || realSizes.some(s => /gb|tb/i.test(s))) return "Capacité";
                          if (isElectronics) return "Version";
                          if (isBeauty) return "Format";
                          if (realSizes.length > 0) return "Variante";
                          return "Taille";
                        })()} :
                        <span className="font-normal text-[#565959] ml-1">{size}</span>
                      </p>
                      {(isApparel || isShoes) && (
                        <button className="text-xs text-[#007185] hover:text-[#C45500] hover:underline">
                          Guide des tailles →
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {variantSizes.map(s => (
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
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-bold">Quantité :</span>
                    <div className="flex items-center border border-[#D5D9D9] rounded overflow-hidden bg-white">
                      <button
                        onClick={() => setQty(Math.max(minQty, qty - 1))}
                        disabled={qty <= minQty}
                        className="w-9 h-9 text-[#565959] hover:bg-[#F3F4F4] font-bold text-lg flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >−</button>
                      <span className="w-10 text-center font-bold text-sm border-x border-[#D5D9D9] h-9 flex items-center justify-center">{qty}</span>
                      <button
                        onClick={() => setQty(maxQty ? Math.min(maxQty, qty + 1) : qty + 1)}
                        disabled={maxQty != null && qty >= maxQty}
                        className="w-9 h-9 text-[#565959] hover:bg-[#F3F4F4] font-bold text-lg flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >+</button>
                    </div>
                    <span className="text-xs text-[#565959]">
                      {product?.product_unit === "pair" ? "paires" : product?.product_unit === "set" ? "lots" : "pcs"}
                    </span>
                    <span className="text-xs text-[#FF9900] font-bold">
                      <i className="fa-solid fa-star text-[9px] mr-0.5" />
                      +{Math.max(1, Math.floor((activeTierPrice * qty) / 500))} pts OFS
                    </span>
                  </div>
                  {minQty > 1 && (
                    <p className="text-[10px] text-[#CC0C39] flex items-center gap-1 mb-1">
                      <i className="fa-solid fa-circle-info text-[9px]" />
                      Commande minimale : {minQty} {product?.product_unit === "pair" ? "paires" : "pcs"}
                      {maxQty && ` · max ${maxQty}`}
                    </p>
                  )}
                  <p className="text-[10px] text-[#565959] flex items-center gap-1.5">
                    <i className="fa-solid fa-calendar-check text-[#007600] text-[9px]" />
                    Livraison estimée : <b className="text-[#0F1111]">{formatEstimatedDate(selectedCity.delay)}</b>
                    {" "}→ {selectedCity.city}
                  </p>
                </div>

                {/* ── CTA ── */}
                <div className="flex flex-col gap-2.5 max-w-sm mb-4">
                  {cartBlockMsg && (
                    <div className="flex items-center gap-2 bg-[#CC0C39]/10 border border-[#CC0C39]/30 rounded px-3 py-2 text-[11px] font-bold text-[#CC0C39]">
                      <i className="fa-solid fa-circle-xmark text-[10px]" />
                      {cartBlockMsg}
                    </div>
                  )}
                  <button onClick={handleAddToCart}
                    className={`w-full py-3 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2 border active:scale-95 ${
                      addedFeedback
                        ? "bg-[#007600] text-white border-[#007600]"
                        : "bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border-[#FCD200] shadow-sm"
                    }`}>
                    <i className={`fa-solid ${addedFeedback ? "fa-check" : "fa-bag-shopping"} text-sm`} />
                    {addedFeedback
                      ? "Ajouté au panier !"
                      : `Ajouter au panier — ${(activeTierPrice * qty + selectedCity.price + shippingEstimate).toLocaleString()} FCFA`}
                  </button>

                  {!isElectronics && (
                    <Link to="/studio" state={{ productId: product.id }}
                      className="w-full py-3 rounded-full font-bold text-sm bg-[#FF9900] hover:bg-[#e68900] text-white text-center flex items-center justify-center gap-2 transition-all">
                      <i className="fa-solid fa-wand-magic-sparkles text-sm" />
                      Personnaliser ce produit
                    </Link>
                  )}

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

                {/* ── COMPATIBILITY (électronique) ── */}
                {isElectronics && (() => {
                  const featStr = (product.features || []).join(" ").toLowerCase() + " " +
                    (product.description || "").toLowerCase();
                  const compat = [
                    (featStr.includes("ios") || featStr.includes("iphone") || featStr.includes("ipad"))
                      && { icon: "fa-brands fa-apple",    label: "iOS / iPhone" },
                    featStr.includes("android")
                      && { icon: "fa-brands fa-android",  label: "Android" },
                    featStr.includes("windows")
                      && { icon: "fa-brands fa-windows",  label: "Windows" },
                    (featStr.includes("macos") || featStr.includes("mac os"))
                      && { icon: "fa-brands fa-apple",    label: "macOS" },
                    featStr.includes("bluetooth")
                      && { icon: "fa-solid fa-bluetooth", label: "Bluetooth" },
                    (featStr.includes("usb-c") || featStr.includes("type-c") || featStr.includes("type c"))
                      && { icon: "fa-solid fa-plug",      label: "USB-C" },
                    (featStr.includes("usb 3") || featStr.includes("usb3"))
                      && { icon: "fa-solid fa-plug",      label: "USB 3.0" },
                    featStr.includes("wi-fi") || featStr.includes("wifi") || featStr.includes("wireless")
                      && { icon: "fa-solid fa-wifi",      label: "Sans-fil" },
                  ].filter(Boolean);
                  if (!compat.length) return null;
                  return (
                    <div className="mb-4 p-3 bg-[#F8F9FA] border border-[#E8EAED] rounded">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#767676] mb-2">
                        <i className="fa-solid fa-circle-check text-[#007600] mr-1 text-[8px]" />
                        Compatibilité
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {compat.map(s => (
                          <span key={s.label} className="flex items-center gap-1.5 text-[10px] font-bold bg-white border border-[#D5D9D9] rounded px-2.5 py-1.5 text-[#0F1111]">
                            <i className={`${s.icon} text-[10px] text-[#565959]`} />
                            {s.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

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
                      { label: "Type de produit",    value: product.type },
                      product.brand                && { label: "Marque",              value: product.brand },
                      product.sku                  && { label: "SKU",                 value: product.sku },
                      product.status               && { label: "Statut",              value: product.status },
                      product.origin_country       && { label: "Origine",             value: ({ CN:"Chine 🇨🇳", US:"USA 🇺🇸", TR:"Turquie 🇹🇷", IN:"Inde 🇮🇳", TH:"Thaïlande 🇹🇭", VN:"Vietnam 🇻🇳", KR:"Corée 🇰🇷" })[product.origin_country.toUpperCase()] || product.origin_country },
                      product.weight_g             && { label: "Poids produit",       value: `${product.weight_g} g` },
                      product.ship_weight_g        && { label: "Poids expédition",    value: `${product.ship_weight_g} g` },
                      (product.length_cm || product.width_cm || product.height_cm) && {
                        label: "Dimensions produit",
                        value: [product.length_cm, product.width_cm, product.height_cm]
                          .filter(Boolean).map(d => `${d} cm`).join(" × ") + " (L×l×H)",
                      },
                      (product.pack_l_cm || product.pack_w_cm || product.pack_h_cm) && {
                        label: "Dimensions emballage",
                        value: [product.pack_l_cm, product.pack_w_cm, product.pack_h_cm]
                          .filter(Boolean).map(d => `${d} cm`).join(" × ") + " (L×l×H)",
                      },
                      product.min_buy_qty > 1      && { label: "Qté minimale",        value: `${product.min_buy_qty} ${product.product_unit === "pair" ? "paires" : "pcs"}` },
                      product.max_buy_qty          && { label: "Qté maximale",         value: `${product.max_buy_qty} pcs` },
                      product.product_unit         && { label: "Unité",               value: product.product_unit },
                      product.sale_num > 0         && { label: "Ventes totales",       value: `${product.sale_num.toLocaleString()} unités vendues` },
                      product.suggest_price_fcfa   && { label: "Prix de référence",    value: `${product.suggest_price_fcfa.toLocaleString()} FCFA` },
                      product.label_codes          && { label: "Certifications",       value: product.label_codes },
                      product.delivery_cycle       && { label: "Délai fabrication",    value: product.delivery_cycle },
                      product.express_delivery_days && { label: "Livraison express",   value: product.express_delivery_days },
                      product.shipping_fee_usd     && { label: "Frais de port CJ",     value: `${product.shipping_fee_usd} USD` },
                      product.cj_category_name     && { label: "Catégorie",            value: product.cj_category_name },
                      product.supplier_name        && { label: "Fournisseur",          value: product.supplier_name },
                      realSizes.length > 0         && { label: "Variantes dispo",      value: realSizes.join(", ") },
                      product.customs_code         && { label: "Code douanier (HS)",   value: `${product.customs_code}${product.customs_name ? ` — ${product.customs_name}` : ""}` },
                      product.pack_num > 1         && { label: "Contenu du lot",        value: `${product.pack_num} unités par lot` },
                      product.multi_package        && { label: "Expédition",            value: "Livraison en plusieurs colis" },
                      product.light_unit           && { label: "Classification colis",  value: "Colis léger — traitement prioritaire" },
                      product.is_discount_sell     && { label: "Offre spéciale",        value: "Prix remisé fournisseur" },
                      product.is_customizable      && { label: "Personnalisation",      value: "Gravure / logo / emballage sur mesure disponible" },
                      product.product_language && product.product_language !== "en" && product.product_language !== "EN"
                                                   && { label: "Fiche origine",         value: `Fiche fournisseur en ${product.product_language === "zh" || product.product_language === "CN" ? "Chinois" : product.product_language}` },
                      { label: "Livraison locale",   value: "Douala · Yaoundé · tout le Cameroun" },
                      { label: "Modes de paiement",  value: "Orange Money · MTN MoMo · Cash" },
                      { label: "Politique retour",   value: "7 jours — Remboursement intégral" },
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
                <DeliveryPanel
                  price={activeTierPrice}
                  qty={qty}
                  selectedCity={selectedCity}
                  onCityChange={setSelectedCity}
                  weight={product.weight_g || product.ship_weight_g}
                  transitaireShipping={shippingEstimate}
                />
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
