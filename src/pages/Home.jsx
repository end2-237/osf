import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import HeroBanners from "../components/HeroBanners";
import CategoryGrid from "../components/CategoryGrid";
import ProductsByCategory from "../components/ProductsByCategory";
import FlashDrop from "../components/FlashDrop";
import Marquee from "../components/Marquee";
import { supabase } from "../lib/supabase";

// ─── ADS FULLSCREEN CONFIG ────────────────────────────────────────────────────
const FULLSCREEN_ADS = [
  {
    id:      "ad_concert",
    type:    "image",
    img:     "https://alrbokstfwwlvbvghrqr.supabase.co/storage/v1/object/public/product-images/ads/Gemini_Generated_Image_4mbl2c4mbl2c4mbl.png",
    tag:     "👑 Événement Royal",
    title:   ["CONCERT", "NPBJ", "STAR"],
    sub:     "Le concert légendaire - Célébrez la royauté.",
    cta:     "Réserver maintenant",
    href:    "https://wa.me/237695507127",
    badge:   "Pass VVIP Disponible",
    accent:  "#DAA520",
    dark:    true,
  },
  {
    id:      "ad_audio",
    type:    "image",
    img:     "https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=1600",
    tag:     "⚡ Flash Drop",
    title:   ["THE", "ULTIMATE", "BEAT."],
    sub:     "Basses sismiques. Design OneFreestyle. Stock ultra-limité — commande avant rupture.",
    cta:     "Réserver maintenant",
    href:    "/store",
    badge:   "Stock limité",
    accent:  "#3b82f6",
    dark:    true,
  },
  {
    id:      "ad_member",
    type:    "gradient",
    gradient:"from-yellow-400/90 to-orange-500/90",
    img:     "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1600",
    tag:     "👑 Membres Elite",
    title:   ["−20%", "SUR", "TOUT."],
    sub:     "Inscription gratuite. Prix exclusifs immédiats. Des milliers de produits à prix réduit.",
    cta:     "Rejoindre l'élite",
    href:    "/register",
    badge:   "Gratuit",
    accent:  "#facc15",
    dark:    false,
  },
  {
    id:      "ad_gift",
    type:    "image",
    img:     "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=1600",
    tag:     "✈️ Diaspora",
    title:   ["LE CADEAU", "PARFAIT", "EXISTE."],
    sub:     "Commandez depuis l'étranger. Livraison directe à Douala pour vos proches.",
    cta:     "Offrir maintenant",
    href:    "/store",
    badge:   "Livraison incluse",
    accent:  "#a855f7",
    dark:    true,
  },
];

// ─── FULLSCREEN AD MODAL ──────────────────────────────────────────────────────
const FullscreenAd = ({ ad, adIndex, onClose, onNext, isLast }) => {
  const navigate                = useNavigate();
  const [closing,  setClosing]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(9);
  const canClose   = adIndex >= 1;
  const AUTO_CLOSE = 9000;

  // Refs pour éviter les stale closures dans le timer
  const closingRef = useRef(false);
  const isLastRef  = useRef(isLast);
  const onNextRef  = useRef(onNext);
  const onCloseRef = useRef(onClose);
  useEffect(() => { isLastRef.current  = isLast;  }, [isLast]);
  useEffect(() => { onNextRef.current  = onNext;  }, [onNext]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Bloquer le scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Timer progression + auto-avance
  useEffect(() => {
    setProgress(0);
    setTimeLeft(Math.ceil(AUTO_CLOSE / 1000));
    closingRef.current = false;
    setClosing(false);

    const start = Date.now();
    const prog = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct     = Math.min((elapsed / AUTO_CLOSE) * 100, 100);
      const secs    = Math.max(0, Math.ceil((AUTO_CLOSE - elapsed) / 1000));
      setProgress(pct);
      setTimeLeft(secs);
      if (pct >= 100) {
        clearInterval(prog);
        if (closingRef.current) return;
        closingRef.current = true;
        setClosing(true);
        // avancer ou fermer selon position dans la série
        setTimeout(() => {
          if (isLastRef.current) onCloseRef.current();
          else onNextRef.current();
        }, 300);
      }
    }, 80);
    return () => clearInterval(prog);
  }, [ad]);

  const handleClose = () => {
    if (closingRef.current || !canClose) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(onCloseRef.current, 300);
  };
  const handleNext = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(onNextRef.current, 300);
  };
  const handleCta = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const href = ad.href;
    setTimeout(() => { onCloseRef.current(); navigate(href); }, 300);
  };

  return (
    <div
      style={{
        position:   "fixed",
        inset:      0,
        zIndex:     9000,
        width:      "100dvw",
        height:     "100dvh",
        overflow:   "hidden",
        animation:  closing
          ? "fsOut 0.3s ease forwards"
          : "fsIn 0.4s cubic-bezier(0.2,0,0,1) both",
      }}
    >
      {/* IMAGE FOND ABSOLU */}
      <img src={ad.img} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center top" }} />

      {/* OVERLAY COULEUR optionnel */}
      {ad.type === "gradient" && (
        <div className={`absolute inset-0 bg-gradient-to-br ${ad.gradient}`} style={{ mixBlendMode:"multiply" }} />
      )}

      {/* GRADIENT SOMBRE */}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,0.93) 0%, rgba(0,0,0,0.22) 55%, rgba(0,0,0,0.18) 100%)" }} />

      {/* ── BARRE PROGRESSION ── */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:"rgba(255,255,255,0.12)", zIndex:10 }}>
        <div style={{ height:"100%", borderRadius:9999, width: progress + "%", backgroundColor: ad.accent, transition:"none" }} />
      </div>

      {/* ── TOP BAR ── */}
      <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:20, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1.25rem 1.25rem 0" }}>
        {/* DOTS SÉRIE */}
        <div style={{ display:"flex", gap:6 }}>
          {FULLSCREEN_ADS.map((_, i) => (
            <div key={i} style={{
              height: 3,
              borderRadius: 9999,
              transition: "width 0.4s, background-color 0.4s",
              width:  i < adIndex ? 20 : i === adIndex ? 28 : 8,
              backgroundColor: i <= adIndex ? ad.accent : "rgba(255,255,255,0.25)",
            }} />
          ))}
        </div>

        {/* CLOSE ou TIMER */}
        {canClose ? (
          <button onClick={handleClose}
            style={{ width:40, height:40, borderRadius:"50%", background:"rgba(0,0,0,0.6)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"transform 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <i className="fa-solid fa-xmark" style={{ color:"white", fontSize:14 }}></i>
          </button>
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(6px)", border:"1px solid rgba(255,255,255,0.12)", padding:"6px 14px", borderRadius:9999 }}>
            <span style={{ color: ad.accent, fontWeight:900, fontSize:13, fontFamily:"monospace" }}>{timeLeft}s</span>
            <span style={{ color:"rgba(255,255,255,0.35)", fontWeight:900, fontSize:9, textTransform:"uppercase", letterSpacing:"0.12em" }}>
              · pub {adIndex + 1}/{FULLSCREEN_ADS.length}
            </span>
          </div>
        )}
      </div>

      {/* BADGE TAG */}
      <div style={{ position:"absolute", top:"4.5rem", left:"1.25rem", zIndex:20 }}>
        <span style={{ fontSize:9, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.14em", padding:"6px 12px", borderRadius:9999, border:`1px solid ${ad.accent}55`, color:ad.accent, background:`${ad.accent}18` }}>
          {ad.tag}
        </span>
      </div>

      {/* BADGE PROMO */}
      <div style={{ position:"absolute", top:"6.8rem", left:"1.25rem", zIndex:20 }}>
        <span style={{ fontSize:9, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.12em", background:"white", color:"#111", padding:"4px 10px", borderRadius:9999 }}>
          {ad.badge}
        </span>
      </div>

      {/* ── CONTENU BAS ── */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, zIndex:20, padding:"0 1.5rem clamp(1.5rem, 4vh, 3rem)" }}>
        {/* TITRE */}
        <h2 style={{ fontWeight:900, fontStyle:"italic", letterSpacing:"-0.04em", lineHeight:0.9, color:"white", fontSize:"clamp(2.6rem, 7.5vw, 4.6rem)", margin:"0 0 1rem 0" }}>
          {ad.title.map((line, i) => (
            <span key={i} style={{ display:"block", color: i === 0 ? ad.accent : "white" }}>{line}</span>
          ))}
        </h2>

        <p style={{ color:"rgba(210,210,210,0.9)", fontWeight:600, lineHeight:1.6, marginBottom:"1.5rem", maxWidth:420, fontSize:"clamp(0.8rem, 2vw, 1rem)" }}>
          {ad.sub}
        </p>

        <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
          <button onClick={handleCta}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 28px", borderRadius:14, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.12em", fontSize:"clamp(0.6rem,1.5vw,0.72rem)", backgroundColor:ad.accent, color:ad.dark?"#000":"#fff", border:"none", cursor:"pointer", transition:"transform 0.2s", boxShadow:"0 8px 32px rgba(0,0,0,0.4)" }}
            onMouseEnter={e => e.currentTarget.style.transform="scale(1.05)"}
            onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}
          >
            <span>{ad.cta}</span>
            <i className="fa-solid fa-arrow-right" style={{ fontSize:11 }}></i>
          </button>

          {!isLast ? (
            <button onClick={handleNext}
              style={{ display:"flex", alignItems:"center", gap:8, background:"none", border:"none", color:"rgba(255,255,255,0.5)", fontWeight:900, textTransform:"uppercase", letterSpacing:"0.12em", fontSize:"clamp(0.6rem,1.5vw,0.7rem)", cursor:"pointer" }}
            >
              <span>Pub suivante</span>
              <i className="fa-solid fa-chevron-right" style={{ fontSize:9 }}></i>
            </button>
          ) : canClose ? (
            <button onClick={handleClose}
              style={{ display:"flex", alignItems:"center", gap:8, background:"none", border:"none", color:"rgba(255,255,255,0.5)", fontWeight:900, textTransform:"uppercase", letterSpacing:"0.12em", fontSize:"clamp(0.6rem,1.5vw,0.7rem)", cursor:"pointer" }}
            >
              <i className="fa-solid fa-xmark" style={{ fontSize:10 }}></i>
              <span>Fermer</span>
            </button>
          ) : null}
        </div>

        <p style={{ fontSize:7, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.3em", color:"rgba(255,255,255,0.15)", marginTop:20 }}>
          OneFreestyle Elite · Publicité · Douala, Cameroun
        </p>
      </div>

      <style>{`
        @keyframes fsIn  { from { opacity:0; transform:scale(1.03); } to { opacity:1; transform:scale(1); } }
        @keyframes fsOut { from { opacity:1; transform:scale(1); }   to { opacity:0; transform:scale(0.98); } }
      `}</style>
    </div>
  );
};

// ─── AD MANAGER HOOK ──────────────────────────────────────────────────────────
const SERIES_DELAY = 8000;
const REPEAT_DELAY = 25 * 60 * 1000;

const useAdManager = () => {
  const [adIndex,  setAdIndex]  = useState(null);
  const lastSeries = useRef(0);

  const startSeries = () => {
    if (Date.now() - lastSeries.current < REPEAT_DELAY) return;
    lastSeries.current = Date.now();
    setAdIndex(0);
  };

  const close  = () => setAdIndex(null);
  const next   = () => setAdIndex(prev => {
    const n = (prev ?? 0) + 1;
    return n < FULLSCREEN_ADS.length ? n : null;
  });

  useEffect(() => {
    const t = setTimeout(startSeries, SERIES_DELAY);
    const r = setInterval(startSeries, REPEAT_DELAY);
    return () => { clearTimeout(t); clearInterval(r); };
  }, []);

  const currentAd = adIndex !== null ? FULLSCREEN_ADS[adIndex] : null;
  const isLast    = adIndex === FULLSCREEN_ADS.length - 1;

  return { currentAd, adIndex: adIndex ?? 0, close, next, isLast };
};

// ─── FLASH DEALS ──────────────────────────────────────────────────────────────
const FlashDeals = ({ products, loading, openModal }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 5, m: 47, s: 30 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        let { h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 23; m = 59; s = 59; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const deals = (products || []).slice(0, 6);
  const pad   = (n) => String(n).padStart(2, "0");

  return (
    <section className="py-8 px-4 md:px-8 bg-zinc-950 border-y border-white/5">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-bolt text-primary text-xl"></i>
              <h2 className="text-xl font-black uppercase tracking-tighter text-white">
                Flash <span className="text-primary italic">Deals</span>
              </h2>
            </div>
            <div className="flex items-center gap-1.5 bg-black border border-white/10 rounded-xl px-4 py-2">
              {[pad(timeLeft.h), pad(timeLeft.m), pad(timeLeft.s)].map((val, i) => (
                <React.Fragment key={i}>
                  <span className="text-primary font-black text-sm font-mono">{val}</span>
                  {i < 2 && <span className="text-zinc-600 font-black text-sm">:</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <Link to="/store" className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 hover:underline decoration-primary underline-offset-4">
            <span>Toutes les promos</span>
            <i className="fa-solid fa-arrow-right text-xs"></i>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {(loading ? Array.from({ length: 6 }) : deals).map((product, i) => (
            <div
              key={product?.id || i}
              onClick={() => product && openModal(product)}
              className="bg-black border border-white/5 rounded-2xl overflow-hidden group cursor-pointer hover:border-primary/30 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.1)]"
            >
              <div className="relative aspect-square overflow-hidden bg-zinc-900">
                {loading ? (
                  <div className="w-full h-full bg-zinc-800 animate-pulse" />
                ) : (
                  <>
                    <img src={product.img} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute top-2 left-2 bg-primary text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase">
                      -{Math.floor(10 + (i * 7) % 30)}%
                    </div>
                  </>
                )}
              </div>
              <div className="p-3">
                {loading ? (
                  <>
                    <div className="h-2.5 bg-zinc-800 rounded w-3/4 mb-1.5 animate-pulse" />
                    <div className="h-3 bg-zinc-800 rounded w-1/2 animate-pulse" />
                  </>
                ) : (
                  <>
                    <p className="text-zinc-300 font-black text-[10px] uppercase italic truncate mb-1">{product.name}</p>
                    <p className="text-primary font-black text-sm">{Number(product.price).toLocaleString()} F</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── VENDORS SECTION ──────────────────────────────────────────────────────────
const VendorsSection = () => (
  <section className="py-8 px-4 md:px-8 bg-white dark:bg-black">
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-primary rounded-full"></div>
          <h2 className="text-xl font-black uppercase tracking-tighter dark:text-white text-zinc-900">
            Boutiques <span className="text-primary italic">Certifiées</span>
          </h2>
        </div>
        <Link to="/register" className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 hover:underline decoration-primary underline-offset-4">
          <span>Devenir vendeur</span>
          <i className="fa-solid fa-arrow-right text-xs"></i>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-2xl p-8 flex flex-col justify-between min-h-[180px]">
          <div>
            <i className="fa-solid fa-store text-primary text-2xl mb-4"></i>
            <h3 className="font-black text-lg uppercase italic dark:text-white text-zinc-900 leading-tight">
              Ouvre ta<br/>boutique Elite
            </h3>
          </div>
          <Link to="/register"
            className="bg-primary text-black text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl hover:bg-white transition-colors w-fit mt-4 flex items-center gap-2"
          >
            <span>S'inscrire</span>
            <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-users text-blue-400"></i>
            </div>
            <div>
              <p className="font-black uppercase text-xs dark:text-white text-zinc-900">Communauté Active</p>
              <p className="text-[9px] text-zinc-500 font-bold">Vendeurs certifiés sur Douala</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              { val: "5",    label: "Vendeurs Max" },
              { val: "500+", label: "Produits" },
              { val: "100+", label: "Commandes" },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 bg-white dark:bg-black rounded-xl">
                <p className="font-black text-primary text-lg leading-none">{s.val}</p>
                <p className="text-[8px] font-bold uppercase text-zinc-500 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl p-6">
          <h4 className="font-black uppercase text-xs dark:text-white text-zinc-900 mb-4">Avantages vendeur</h4>
          <div className="space-y-3">
            {[
              { icon: "fa-shop",        text: "Boutique personnalisée" },
              { icon: "fa-bell",        text: "Notifications commandes temps réel" },
              { icon: "fa-chart-line",  text: "Dashboard analytics intégré" },
              { icon: "fa-share-nodes", text: "Partage réseaux sociaux" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-[11px] font-bold text-zinc-500">
                <i className={`fa-solid ${item.icon} text-primary text-xs w-4`}></i>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ─── HOME ─────────────────────────────────────────────────────────────────────
const Home = ({ openModal, addToCart }) => {
  const [productsList, setProductsList] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const { currentAd, adIndex, close, next, isLast } = useAdManager();

  useEffect(() => {
    const getItems = async () => {
      setLoading(true);
      try {
        const { data: pData } = await supabase
          .from("products")
          .select("*, vendor:vendors!vendor_id(member_discount_enabled)")
          .order("created_at", { ascending: false });
        setProductsList(pData || []);
      } catch (err) {
        console.error("Erreur:", err.message);
      } finally {
        setLoading(false);
      }
    };
    getItems();
  }, []);

  return (
    <div className="bg-white dark:bg-black">

      {/* ── FULLSCREEN AD (portal-like, z-9000) ── */}
      {currentAd && <FullscreenAd ad={currentAd} adIndex={adIndex} onClose={close} onNext={next} isLast={isLast} />}

      {/* 1. HERO */}
      <HeroBanners />

      {/* 2. MARQUEE */}
      <Marquee />

      {/* 3. CATÉGORIES */}
      <CategoryGrid />

      {/* 4. FLASH DEALS */}
      <FlashDeals
        products={productsList}
        loading={loading}
        openModal={openModal}
        addToCart={addToCart}
      />

      {/* 5. PRODUITS PAR CATÉGORIE */}
      <ProductsByCategory
        allProducts={productsList}
        loading={loading}
        openModal={openModal}
        addToCart={addToCart}
      />

      {/* 6. FLASH DROP + TOP BOUTIQUES */}
      <FlashDrop />

      {/* 7. VENDEURS */}
      <VendorsSection />
    </div>
  );
};

export default Home;