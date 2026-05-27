import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import HeroBanners from "../components/HeroBanners";
import CategoryGrid from "../components/CategoryGrid";
import ProductsByCategory from "../components/ProductsByCategory";
import FlashDrop from "../components/FlashDrop";
import Marquee from "../components/Marquee";
import { supabase } from "../lib/supabase";

// ─── ADS CONFIG ───────────────────────────────────────────────────────────────
const FULLSCREEN_ADS = [
  {
    id:     "ad_concert",
    img:    "https://alrbokstfwwlvbvghrqr.supabase.co/storage/v1/object/public/product-images/ads/Gemini_Generated_Image_4mbl2c4mbl2c4mbl.png",
    tag:    "Événement Royal",
    tagIcon:"fa-crown",
    title:  "CONCERT NPBJ STAR",
    sub:    "Le concert légendaire. Célébrez la royauté en direct à Douala.",
    cta:    "Réserver un Pass VVIP",
    href:   "https://wa.me/237695507127",
    badge:  "Pass VVIP",
    accent: "#FF9900",
    external: true,
  },
  {
    id:     "ad_audio",
    img:    "https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=1600",
    tag:    "Flash Drop",
    tagIcon:"fa-bolt",
    title:  "THE ULTIMATE BEAT",
    sub:    "Basses sismiques. Design exclusif OneFreestyle. Stock ultra-limité — avant rupture.",
    cta:    "Voir le produit",
    href:   "/store",
    badge:  "Stock limité",
    accent: "#FFD814",
    external: false,
  },
  {
    id:     "ad_member",
    img:    "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1600",
    tag:    "Offre Membre Elite",
    tagIcon:"fa-star",
    title:  "−20% SUR TOUT",
    sub:    "Inscription gratuite. Prix exclusifs immédiats. Des milliers de produits à prix réduit.",
    cta:    "Rejoindre l'élite",
    href:   "/register",
    badge:  "Gratuit",
    accent: "#FF9900",
    external: false,
  },
  {
    id:     "ad_gift",
    img:    "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=1600",
    tag:    "Diaspora 🇨🇲",
    tagIcon:"fa-plane",
    title:  "LE CADEAU PARFAIT EXISTE",
    sub:    "Commandez depuis l'étranger. Livraison directe à Douala pour vos proches.",
    cta:    "Offrir maintenant",
    href:   "/store",
    badge:  "Livraison incluse",
    accent: "#FFD814",
    external: false,
  },
];

const SESSION_KEY = "ofs_ads_shown";
const SHOW_DELAY  = 4000;
const AD_DURATION = 8000;

// ─── FULLSCREEN AD MODAL ──────────────────────────────────────────────────────
const FullscreenAd = ({ ad, adIndex, total, onClose, onNext, isLast }) => {
  const navigate              = useNavigate();
  const [closing, setClosing] = useState(false);
  const [progress, setProg]   = useState(0);
  const [timeLeft, setTime]   = useState(Math.ceil(AD_DURATION / 1000));
  const canClose              = adIndex >= 1;

  const closingRef = useRef(false);
  const isLastRef  = useRef(isLast);
  const onNextRef  = useRef(onNext);
  const onCloseRef = useRef(onClose);
  useEffect(() => { isLastRef.current  = isLast;  }, [isLast]);
  useEffect(() => { onNextRef.current  = onNext;  }, [onNext]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    setProg(0);
    setTime(Math.ceil(AD_DURATION / 1000));
    closingRef.current = false;
    setClosing(false);
    const start = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct  = Math.min((elapsed / AD_DURATION) * 100, 100);
      const secs = Math.max(0, Math.ceil((AD_DURATION - elapsed) / 1000));
      setProg(pct);
      setTime(secs);
      if (pct >= 100) {
        clearInterval(iv);
        if (closingRef.current) return;
        closingRef.current = true;
        setClosing(true);
        setTimeout(() => {
          if (isLastRef.current) onCloseRef.current();
          else onNextRef.current();
        }, 300);
      }
    }, 80);
    return () => clearInterval(iv);
  }, [ad]);

  const dismiss = () => {
    if (closingRef.current || !canClose) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(onCloseRef.current, 280);
  };
  const goNext = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(onNextRef.current, 280);
  };
  const handleCta = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const href = ad.href;
    setTimeout(() => {
      onCloseRef.current();
      if (ad.external) window.open(href, "_blank", "noopener");
      else navigate(href);
    }, 280);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
      animation: closing ? "adOut 0.28s ease forwards" : "adIn 0.35s cubic-bezier(0.2,0,0,1) both",
    }}>
      {/* ── CARD ── */}
      <div style={{
        position: "relative", width: "min(92vw, 860px)", maxHeight: "90dvh",
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        display: "flex", flexDirection: "column",
        background: "#0F1111",
      }}>
        {/* PROGRESS BAR */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <div style={{ height: "100%", width: progress + "%", background: ad.accent, transition: "none", borderRadius: 9999 }} />
        </div>

        {/* IMAGE */}
        <div style={{ position: "relative", flex: "0 0 auto" }}>
          <img src={ad.img} alt={ad.title}
            style={{ width: "100%", height: "clamp(200px, 38vh, 320px)", objectFit: "cover", objectPosition: "center 20%", display: "block" }}
          />
          {/* dark gradient overlay on image */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(15,17,17,0.85) 100%)" }} />

          {/* TOP BAR inside image */}
          <div style={{ position: "absolute", top: 14, left: 16, right: 16, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 }}>
            {/* Series dots */}
            <div style={{ display: "flex", gap: 5 }}>
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} style={{
                  height: 3, borderRadius: 9999, transition: "all 0.35s",
                  width: i === adIndex ? 24 : 8,
                  background: i < adIndex ? ad.accent : i === adIndex ? ad.accent : "rgba(255,255,255,0.25)",
                }} />
              ))}
            </div>
            {/* Close or countdown */}
            {canClose ? (
              <button onClick={dismiss} style={{
                width: 36, height: 36, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.25)",
                background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}>
                <i className="fa-solid fa-xmark" style={{ color: "white", fontSize: 13 }}></i>
              </button>
            ) : (
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
                border: "1px solid rgba(255,255,255,0.12)", padding: "5px 12px", borderRadius: 9999,
              }}>
                <span style={{ color: ad.accent, fontWeight: 900, fontSize: 12, fontFamily: "monospace" }}>{timeLeft}s</span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  PUB {adIndex + 1}/{total}
                </span>
              </div>
            )}
          </div>

          {/* Badge on image bottom-left */}
          <div style={{ position: "absolute", bottom: 14, left: 16, display: "flex", gap: 8, alignItems: "center", zIndex: 5 }}>
            <span style={{
              fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.14em",
              padding: "5px 10px", borderRadius: 9999,
              border: `1px solid ${ad.accent}60`, color: ad.accent, background: `${ad.accent}18`,
            }}>
              <i className={`fa-solid ${ad.tagIcon} mr-1`} style={{ fontSize: 7 }}></i>
              {ad.tag}
            </span>
            <span style={{
              fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em",
              padding: "5px 10px", borderRadius: 9999,
              background: "white", color: "#0F1111",
            }}>
              {ad.badge}
            </span>
          </div>
        </div>

        {/* ── TEXT + CTA PANEL ── */}
        <div style={{ padding: "20px 24px 24px", background: "#0F1111", flexShrink: 0 }}>
          {/* OFS branding strip */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 3, height: 18, background: "#FF9900", borderRadius: 9999 }} />
            <span style={{ fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: "#FF9900" }}>
              OneFreestyle · Douala, Cameroun 🇨🇲
            </span>
            <span style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", marginLeft: "auto" }}>
              Publicité
            </span>
          </div>

          <h2 style={{
            fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.05,
            color: "white", fontSize: "clamp(1.4rem, 4vw, 2rem)",
            margin: "0 0 10px 0",
          }}>
            <span style={{ color: ad.accent }}>{ad.title.split(" ")[0]}</span>{" "}
            {ad.title.split(" ").slice(1).join(" ")}
          </h2>

          <p style={{ color: "rgba(200,200,200,0.8)", fontSize: "clamp(0.78rem, 1.8vw, 0.9rem)", lineHeight: 1.6, marginBottom: 20, maxWidth: 520 }}>
            {ad.sub}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={handleCta} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 24px", borderRadius: 8, border: "none", cursor: "pointer",
              fontWeight: 900, fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)",
              textTransform: "uppercase", letterSpacing: "0.1em",
              background: ad.accent, color: "#0F1111",
              boxShadow: `0 4px 20px ${ad.accent}55`,
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = `0 6px 28px ${ad.accent}77`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)";    e.currentTarget.style.boxShadow = `0 4px 20px ${ad.accent}55`; }}
            >
              {ad.cta}
              <i className={`fa-solid ${ad.external ? "fa-arrow-up-right-from-square" : "fa-arrow-right"}`} style={{ fontSize: 10 }}></i>
            </button>

            {!isLast ? (
              <button onClick={goNext} style={{
                display: "flex", alignItems: "center", gap: 7, background: "none", border: "1px solid rgba(255,255,255,0.15)",
                padding: "11px 18px", borderRadius: 8, cursor: "pointer",
                color: "rgba(255,255,255,0.5)", fontWeight: 800, fontSize: "clamp(0.62rem,1.4vw,0.7rem)",
                textTransform: "uppercase", letterSpacing: "0.1em", transition: "border-color 0.2s, color 0.2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
              >
                Pub suivante
                <i className="fa-solid fa-chevron-right" style={{ fontSize: 9 }}></i>
              </button>
            ) : canClose ? (
              <button onClick={dismiss} style={{
                display: "flex", alignItems: "center", gap: 7, background: "none", border: "1px solid rgba(255,255,255,0.15)",
                padding: "11px 18px", borderRadius: 8, cursor: "pointer",
                color: "rgba(255,255,255,0.5)", fontWeight: 800, fontSize: "clamp(0.62rem,1.4vw,0.7rem)",
                textTransform: "uppercase", letterSpacing: "0.1em",
              }}>
                <i className="fa-solid fa-xmark" style={{ fontSize: 10 }}></i>
                Fermer
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes adIn  { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes adOut { from { opacity:1; transform:scale(1) translateY(0); }       to { opacity:0; transform:scale(0.97) translateY(4px); } }
      `}</style>
    </div>
  );
};

// ─── AD MANAGER HOOK — une seule fois par session ──────────────────────────────
const useAdManager = () => {
  const [adIndex, setAdIndex] = useState(null);

  const startSeries = () => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    setAdIndex(0);
  };

  const close = () => setAdIndex(null);
  const next  = () => setAdIndex(prev => {
    const n = (prev ?? 0) + 1;
    return n < FULLSCREEN_ADS.length ? n : null;
  });

  useEffect(() => {
    const t = setTimeout(startSeries, SHOW_DELAY);
    return () => clearTimeout(t);
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
      {currentAd && (
        <FullscreenAd
          ad={currentAd}
          adIndex={adIndex}
          total={FULLSCREEN_ADS.length}
          onClose={close}
          onNext={next}
          isLast={isLast}
        />
      )}

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