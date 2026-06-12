import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useJsonLd } from "../hooks/useJsonLd";
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

  const R    = 16;
  const CIRC = 2 * Math.PI * R;
  const firstWord = ad.title.split(" ")[0];
  const restTitle = ad.title.split(" ").slice(1).join(" ");

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center p-3 md:p-6"
      style={{
        background: "radial-gradient(120% 120% at 50% 0%, rgba(20,22,28,0.86) 0%, rgba(0,0,0,0.9) 100%)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        animation: closing ? "adOut 0.28s ease forwards" : "adIn 0.45s cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      {/* ── CARD ── */}
      <div
        className="relative w-full max-w-[940px] flex flex-col md:flex-row rounded-2xl overflow-hidden bg-[#0F1111]"
        style={{ maxHeight: "94dvh", boxShadow: "0 40px 120px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.06)" }}
      >
        {/* ── STORY PROGRESS BARS (top, full width) ── */}
        <div className="absolute top-0 left-0 right-0 z-30 flex gap-1.5 px-3.5 pt-3">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: i < adIndex ? "100%" : i === adIndex ? progress + "%" : "0%",
                  background: ad.accent,
                  transition: i === adIndex ? "none" : "width 0.3s",
                }}
              />
            </div>
          ))}
        </div>

        {/* ── IMAGE SIDE ── */}
        <div className="relative flex-shrink-0 md:w-[44%] h-[195px] md:h-auto md:min-h-[472px] bg-black overflow-hidden">
          <img
            src={ad.img}
            alt={ad.title}
            className="w-full h-full object-cover"
            style={{ objectPosition: "center 25%", animation: "adKenBurns 9s ease-out both" }}
          />
          {/* blend gradient: bottom on mobile, right on desktop */}
          <div className="absolute inset-0 md:hidden" style={{ background: "linear-gradient(to bottom, rgba(15,17,17,0) 35%, rgba(15,17,17,0.95) 100%)" }} />
          <div className="absolute inset-0 hidden md:block" style={{ background: "linear-gradient(to right, rgba(15,17,17,0) 55%, rgba(15,17,17,0.98) 100%)" }} />

          {/* tag + badge over image, bottom-left */}
          <div className="absolute bottom-3.5 left-4 right-4 flex flex-wrap items-center gap-2 z-10">
            <span
              className="inline-flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-full backdrop-blur-md"
              style={{ border: `1px solid ${ad.accent}70`, color: ad.accent, background: `${ad.accent}1f` }}
            >
              <i className={`fa-solid ${ad.tagIcon}`} style={{ fontSize: 8 }} />
              {ad.tag}
            </span>
            <span className="inline-flex items-center text-[8.5px] font-black uppercase tracking-[0.1em] px-2.5 py-1.5 rounded-full bg-white text-[#0F1111] shadow-sm">
              {ad.badge}
            </span>
          </div>
        </div>

        {/* ── CONTENT SIDE ── */}
        <div className="relative flex-1 flex flex-col p-6 md:p-8 pt-6 md:pt-9 overflow-y-auto">

          {/* top row: OFS brand + countdown/close */}
          <div className="flex items-start justify-between mb-5 md:mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FF9900] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#FF9900]/30">
                <i className="fa-solid fa-bolt text-[#0F1111] text-sm" />
              </div>
              <div className="leading-none">
                <p className="text-[12px] font-black text-white tracking-tight leading-none">
                  OneFree<span className="text-[#FF9900]">Style</span>
                </p>
                <p className="text-[8px] font-bold text-white/40 uppercase tracking-[0.16em] mt-1">
                  Douala 🇨🇲 · Sélection Elite
                </p>
              </div>
            </div>

            {/* countdown ring → close button */}
            {canClose ? (
              <button
                onClick={dismiss}
                aria-label="Fermer"
                className="w-9 h-9 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <i className="fa-solid fa-xmark text-white text-sm" />
              </button>
            ) : (
              <div className="relative w-9 h-9 flex items-center justify-center flex-shrink-0" title="Publicité">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2.5" />
                  <circle
                    cx="18" cy="18" r={R} fill="none" stroke={ad.accent} strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress / 100)}
                    style={{ transition: "stroke-dashoffset 0.1s linear" }}
                  />
                </svg>
                <span className="text-[11px] font-black text-white tabular-nums">{timeLeft}</span>
              </div>
            )}
          </div>

          {/* PUB label */}
          <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-white/25 mb-3">
            Publicité · {adIndex + 1}/{total}
          </span>

          {/* headline */}
          <h2
            className="font-black text-white tracking-tight mb-3"
            style={{ lineHeight: 1.04, fontSize: "clamp(1.6rem, 4.6vw, 2.4rem)" }}
          >
            <span style={{ color: ad.accent }}>{firstWord}</span>{restTitle ? " " + restTitle : ""}
          </h2>

          {/* sub */}
          <p
            className="text-white/65 leading-relaxed mb-6 max-w-[440px]"
            style={{ fontSize: "clamp(0.82rem, 1.8vw, 0.95rem)" }}
          >
            {ad.sub}
          </p>

          {/* trust row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-7">
            {[
              { icon: "fa-shield-halved", label: "Paiement sécurisé" },
              { icon: "fa-truck-fast",    label: "Livraison Douala" },
              { icon: "fa-headset",       label: "Support 7j/7" },
            ].map((t) => (
              <span key={t.label} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-white/55">
                <i className={`fa-solid ${t.icon} text-[#FF9900]`} style={{ fontSize: 10 }} />
                {t.label}
              </span>
            ))}
          </div>

          {/* CTA row — pinned to bottom */}
          <div className="mt-auto flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCta}
              className="group/cta inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-black uppercase tracking-wider text-[#0F1111] transition-transform active:scale-95 hover:scale-[1.03]"
              style={{ background: ad.accent, fontSize: "clamp(0.7rem, 1.6vw, 0.8rem)", boxShadow: `0 8px 30px ${ad.accent}55` }}
            >
              {ad.cta}
              <i className={`fa-solid ${ad.external ? "fa-arrow-up-right-from-square" : "fa-arrow-right"} group-hover/cta:translate-x-0.5 transition-transform`} style={{ fontSize: 11 }} />
            </button>

            {(!isLast || canClose) && (
              <button
                onClick={!isLast ? goNext : dismiss}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-white/45 hover:text-white/85 font-bold uppercase tracking-wider transition-colors"
                style={{ fontSize: "clamp(0.64rem, 1.4vw, 0.72rem)" }}
              >
                {!isLast ? "Passer" : "Fermer"}
                <i className={`fa-solid ${!isLast ? "fa-chevron-right" : "fa-xmark"}`} style={{ fontSize: 9 }} />
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes adIn  { from { opacity:0; transform:scale(0.95) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes adOut { from { opacity:1; transform:scale(1) translateY(0); }        to { opacity:0; transform:scale(0.97) translateY(6px); } }
        @keyframes adKenBurns { from { transform:scale(1.12); } to { transform:scale(1); } }
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
const FlashDeals = ({ products, loading, openModal, addToCart }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 5, m: 47, s: 30 });
  const [addedId,  setAddedId]  = useState(null);

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

  const handleAdd = (e, product) => {
    e.stopPropagation();
    addToCart({ ...product, selectedSize: "M", selectedColor: "Black", quantity: 1 });
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 2000);
  };

  return (
    <section className="bg-white border-y border-[#D5D9D9] py-8 px-4 md:px-8">
      <div className="max-w-[1600px] mx-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#B12704] rounded flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-bolt text-white text-sm"></i>
              </div>
              <h2 className="text-xl font-black text-[#0F1111]">
                Flash <span className="text-[#B12704]">Deals</span>
              </h2>
            </div>
            {/* COUNTDOWN */}
            <div className="flex items-center gap-1 bg-[#0F1111] rounded px-3 py-1.5">
              <span className="text-[9px] font-bold text-[#ADBAC7] mr-1.5 hidden sm:inline">Se termine dans</span>
              {[pad(timeLeft.h), pad(timeLeft.m), pad(timeLeft.s)].map((val, i) => (
                <React.Fragment key={i}>
                  <span className="text-[#FF9900] font-black text-sm font-mono leading-none">{val}</span>
                  {i < 2 && <span className="text-[#37475A] font-black text-sm">:</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <Link to="/store" className="text-[10px] font-black uppercase tracking-widest text-[#007185] flex items-center gap-2 hover:text-[#C45500] hover:underline transition-colors whitespace-nowrap">
            <span>Toutes les promos</span>
            <i className="fa-solid fa-arrow-right text-xs"></i>
          </Link>
        </div>

        <div className="h-px bg-[#D5D9D9] mb-5" />

        {/* CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(loading ? Array.from({ length: 6 }) : deals).map((product, i) => {
            const pct           = Math.floor(10 + (i * 7) % 30);
            const price         = product ? Number(product.price) : 0;
            const originalPrice = Math.round(price / (1 - pct / 100));
            const isAdded       = addedId === product?.id;

            return (
              <div
                key={product?.id || i}
                onClick={() => product && openModal(product)}
                className="bg-white border border-[#D5D9D9] hover:border-[#FF9900]/60 rounded group cursor-pointer transition-all duration-200 hover:shadow-md overflow-hidden flex flex-col"
              >
                {/* IMAGE */}
                <div className="relative bg-[#EAEDED] aspect-square overflow-hidden flex items-center justify-center p-2">
                  {loading ? (
                    <div className="w-full h-full bg-[#D5D9D9] animate-pulse rounded" />
                  ) : (
                    <>
                      <img
                        src={product.img}
                        alt={product.name}
                        className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute top-2 left-2 bg-[#B12704] text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase">
                        -{pct}%
                      </div>
                    </>
                  )}
                </div>

                {/* INFO */}
                <div className="p-3 flex flex-col flex-1">
                  {loading ? (
                    <div className="space-y-2">
                      <div className="h-2.5 bg-[#EAEDED] rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-[#EAEDED] rounded w-1/2 animate-pulse" />
                      <div className="h-7 bg-[#EAEDED] rounded animate-pulse mt-2" />
                    </div>
                  ) : (
                    <>
                      <p className="text-[10px] font-bold text-[#565959] truncate mb-1.5">{product.name}</p>
                      <div className="mb-2">
                        <p className="text-[#B12704] font-black text-base leading-none">{price.toLocaleString()} F</p>
                        <p className="text-[9px] text-[#565959] line-through mt-0.5">{originalPrice.toLocaleString()} F</p>
                      </div>
                      <div className="mt-auto">
                        <p className="text-[8px] text-[#007185] font-bold mb-2">
                          <i className="fa-solid fa-truck-fast mr-1"></i>Livraison 2h · Douala 🇨🇲
                        </p>
                        <button
                          onClick={(e) => handleAdd(e, product)}
                          className={`w-full py-2 rounded text-[9px] font-black uppercase tracking-wider border transition-all active:scale-[0.97] ${
                            isAdded
                              ? "bg-[#007600] text-white border-[#007600]"
                              : "bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border-[#FCD200]"
                          }`}
                        >
                          <i className={`fa-solid ${isAdded ? "fa-check" : "fa-cart-plus"} mr-1.5`}></i>
                          {isAdded ? "Ajouté !" : "Au panier"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
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
const HOME_JSONLD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "OFS Cameroun",
    "alternateName": "OneFreestyle Store",
    "url": "https://www.onefreestyle.store",
    "logo": "https://www.onefreestyle.store/logoofs.png",
    "description": "Boutique en ligne au Cameroun — mode, tech, beauté, maison. Livraison express Douala, Yaoundé et toutes les régions.",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Bonamoussadi",
      "addressLocality": "Douala",
      "addressRegion": "Littoral",
      "addressCountry": "CM",
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+237696995879",
      "contactType": "customer service",
      "availableLanguage": ["French"],
    },
    "legalName": "Buyticle ETS",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "OFS Cameroun",
    "url": "https://www.onefreestyle.store",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://www.onefreestyle.store/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  },
];

const Home = ({ openModal, addToCart }) => {
  const [productsList, setProductsList] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const { currentAd, adIndex, close, next, isLast } = useAdManager();

  useJsonLd(HOME_JSONLD);

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