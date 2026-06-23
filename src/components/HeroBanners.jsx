import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const SLIDES = [
  {
    tag:   "Nouveau Drop",
    title: "AUDIO ELITE X1",
    sub:   "Son immersif. Design exclusif. La sélection premium Buyticle.",
    cta:   "Découvrir",
    img:   "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1600",
    accent:"#FF9900",
    href:  "/store",
  },
  {
    tag:   "Flash Deal −30%",
    title: "STREET WEAR",
    sub:   "Streetwear élite. Livraison express à Douala en 2 heures.",
    cta:   "Shop Now",
    img:   "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=1600",
    accent:"#FFD27A",
    href:  "/store",
  },
  {
    tag:   "Bundle Deal",
    title: "TECH LAB 4K",
    sub:   "Immersion VR totale. Technologie de pointe à prix juste.",
    cta:   "Explorer",
    img:   "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=1600",
    accent:"#9EE7DC",
    href:  "/store",
  },
  {
    tag:   "Collection Femme",
    title: "STYLE SANS LIMITES",
    sub:   "Streetwear, parfums & accessoires pour elle.",
    cta:   "Découvrir",
    img:   "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1600",
    accent:"#FFB84D",
    href:  "/store",
  },
];

const HeroBanners = () => {
  const [active,    setActive]    = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setActive((prev) => (prev + 1) % SLIDES.length);
        setAnimating(false);
      }, 400);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  const goTo = (idx) => {
    if (idx === active) return;
    setAnimating(true);
    setTimeout(() => { setActive(idx); setAnimating(false); }, 300);
  };

  const slide = SLIDES[active];

  return (
    <section className="w-full relative overflow-hidden bg-[#131921]">

      {/* FULL-BLEED IMMERSIVE BANNER */}
      <div className="relative w-full" style={{ height: "clamp(400px, 68vh, 640px)" }}>
        {SLIDES.map((s, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-700 ${idx === active ? "opacity-100 z-10" : "opacity-0 z-0"}`}
          >
            <img
              src={s.img}
              alt={s.title}
              className="w-full h-full object-cover"
              style={{ objectPosition: "center 30%", animation: idx === active ? "heroKenBurns 7s ease-out both" : "none" }}
            />
            {/* dark gradient overlay — left→right for desktop legibility */}
            <div className="absolute inset-0 hidden md:block" style={{ background: "linear-gradient(90deg, rgba(19,25,33,0.92) 0%, rgba(19,25,33,0.72) 42%, rgba(19,25,33,0.15) 100%)" }} />
            {/* bottom→top overlay for mobile */}
            <div className="absolute inset-0 md:hidden" style={{ background: "linear-gradient(to top, rgba(19,25,33,0.94) 8%, rgba(19,25,33,0.55) 45%, rgba(19,25,33,0.2) 100%)" }} />
          </div>
        ))}

        {/* SPONSORED LABEL */}
        <span className="absolute top-4 right-5 z-30 text-[9px] font-semibold text-white/50 uppercase tracking-widest">
          Sponsorisé
        </span>

        {/* CONTENT */}
        <div className="absolute inset-0 z-30 flex flex-col justify-center">
          <div className="max-w-[1600px] w-full mx-auto px-6 md:px-16">
            <div className={`max-w-lg transition-all duration-500 ${animating ? "opacity-0 translate-y-3" : "opacity-100 translate-y-0"}`}>
              <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.18em] mb-2.5" style={{ color: slide.accent }}>
                {slide.tag}
              </p>
              <h2 className="font-black text-white leading-[1.03] mb-3" style={{ fontSize: "clamp(2.1rem, 6vw, 4.2rem)" }}>
                {slide.title}
              </h2>
              <p className="text-white/70 mb-7 max-w-md leading-relaxed" style={{ fontSize: "clamp(0.85rem, 1.8vw, 1.05rem)" }}>
                {slide.sub}
              </p>
              <Link
                to={slide.href}
                className="inline-flex items-center gap-2.5 bg-[#FF9900] hover:bg-[#FFB800] text-[#0F1111] px-7 py-3.5 font-black uppercase tracking-wider transition-colors w-fit text-[12px] md:text-[13px]"
              >
                {slide.cta}
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </Link>
            </div>
          </div>
        </div>

        {/* ARROWS — square */}
        <button
          onClick={() => goTo((active - 1 + SLIDES.length) % SLIDES.length)}
          aria-label="Précédent"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-40 w-10 h-20 bg-black/25 hover:bg-black/45 backdrop-blur-sm flex items-center justify-center transition-colors"
        >
          <i className="fa-solid fa-chevron-left text-white text-sm"></i>
        </button>
        <button
          onClick={() => goTo((active + 1) % SLIDES.length)}
          aria-label="Suivant"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-40 w-10 h-20 bg-black/25 hover:bg-black/45 backdrop-blur-sm flex items-center justify-center transition-colors"
        >
          <i className="fa-solid fa-chevron-right text-white text-sm"></i>
        </button>

        {/* PROGRESS SEGMENTS — square, aligned with content */}
        <div className="absolute bottom-0 left-0 right-0 z-40">
          <div className="max-w-[1600px] mx-auto px-6 md:px-16 pb-6">
            <div className="flex items-center gap-1.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-1 transition-all ${i === active ? "w-8 bg-[#FF9900]" : "w-4 bg-white/35 hover:bg-white/60"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TRUST BADGES BAR */}
      <div className="bg-white border-b border-[#D5D9D9]">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#D5D9D9]">
            {[
              { icon: "fa-truck-fast",     label: "Livraison Express",  sub: "Douala en 2h",            color: "text-[#FF9900]"  },
              { icon: "fa-shield-halved",   label: "Paiement Sécurisé",  sub: "Orange Money / Cash",     color: "text-green-600"  },
              { icon: "fa-rotate-left",    label: "Retour Facile",      sub: "7 jours sans questions",  color: "text-blue-600"   },
              { icon: "fa-headset",        label: "Support 7j/7",       sub: "Réponse en 1h",           color: "text-purple-600" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3">
                <i className={`fa-solid ${item.icon} ${item.color} text-lg flex-shrink-0`}></i>
                <div>
                  <p className="font-bold text-[#0F1111] text-[12px]">{item.label}</p>
                  <p className="text-[#565959] text-[11px]">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes heroKenBurns { from { transform: scale(1.08); } to { transform: scale(1); } }
      `}</style>
    </section>
  );
};

export default HeroBanners;
