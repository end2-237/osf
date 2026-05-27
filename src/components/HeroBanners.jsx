import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const SLIDES = [
  {
    tag:  "Nouveau Drop",
    title: "AUDIO ELITE X1",
    sub:  "Son immersif. Design exclusif. OneFreestyle.",
    cta:  "Découvrir",
    img:  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1600",
    href: "/store",
  },
  {
    tag:  "Flash Deal −30%",
    title: "STREET WEAR",
    sub:  "Streetwear élite. Livraison express Douala.",
    cta:  "Shop Now",
    img:  "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=1600",
    href: "/store",
  },
  {
    tag:  "Bundle Deal",
    title: "TECH LAB 4K",
    sub:  "Immersion VR totale. Technologie de pointe.",
    cta:  "Explorer",
    img:  "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=1600",
    href: "/store",
  },
  {
    tag:  "Collection Femme",
    title: "STYLE SANS LIMITES",
    sub:  "Streetwear, parfums & accessoires pour elle.",
    cta:  "Découvrir",
    img:  "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1600",
    href: "/store",
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
    <section className="w-full relative overflow-hidden bg-[#EAEDED]">

      {/* FULL-WIDTH BANNER — Amazon style */}
      <div className="relative w-full" style={{ maxHeight: 500 }}>
        {SLIDES.map((s, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-700 ${idx === active ? "opacity-100 z-10" : "opacity-0 z-0"}`}
          >
            <img
              src={s.img}
              alt={s.title}
              className="w-full h-full object-cover"
              style={{ maxHeight: 500 }}
            />
          </div>
        ))}

        {/* Aspect spacer */}
        <div className="relative z-0" style={{ paddingTop: "min(500px, 36vw)" }} />

        {/* Left gradient fade — Amazon signature effect */}
        <div className="absolute left-0 top-0 bottom-0 w-20 md:w-40 bg-gradient-to-r from-[#EAEDED] to-transparent z-20 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 md:w-40 bg-gradient-to-l from-[#EAEDED] to-transparent z-20 pointer-events-none" />

        {/* TEXT OVERLAY */}
        <div
          className={`absolute inset-0 z-30 flex flex-col justify-center pl-8 md:pl-16 transition-all duration-500 ${animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}
        >
          <span className="text-[#FF9900] text-xs font-bold uppercase tracking-wider mb-1">
            {slide.tag}
          </span>
          <h2 className="text-2xl md:text-5xl font-black text-white leading-tight mb-2 drop-shadow-lg max-w-xs md:max-w-lg">
            {slide.title}
          </h2>
          <p className="text-gray-200 text-sm mb-4 max-w-xs drop-shadow">{slide.sub}</p>
          <Link
            to={slide.href}
            className="inline-flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-5 py-2.5 rounded font-bold text-sm transition-colors shadow w-fit"
          >
            {slide.cta}
            <i className="fa-solid fa-arrow-right text-xs"></i>
          </Link>
        </div>

        {/* ARROW LEFT */}
        <button
          onClick={() => goTo((active - 1 + SLIDES.length) % SLIDES.length)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-40 w-10 h-16 bg-white/90 hover:bg-white shadow-md rounded flex items-center justify-center transition-all hover:shadow-lg"
        >
          <i className="fa-solid fa-chevron-left text-gray-700 text-sm"></i>
        </button>

        {/* ARROW RIGHT */}
        <button
          onClick={() => goTo((active + 1) % SLIDES.length)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-40 w-10 h-16 bg-white/90 hover:bg-white shadow-md rounded flex items-center justify-center transition-all hover:shadow-lg"
        >
          <i className="fa-solid fa-chevron-right text-gray-700 text-sm"></i>
        </button>

        {/* DOTS */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${i === active ? "w-5 h-2.5 bg-[#FF9900]" : "w-2.5 h-2.5 bg-white/60 hover:bg-white"}`}
            />
          ))}
        </div>
      </div>

      {/* TRUST BADGES BAR */}
      <div className="bg-white border-b border-[#D5D9D9]">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#D5D9D9]">
            {[
              { icon: "fa-truck-fast",     label: "Livraison Express",  sub: "Douala en 2h",            color: "text-[#FF9900]"  },
              { icon: "fa-shield-check",   label: "Paiement Sécurisé",  sub: "Orange Money / Cash",     color: "text-green-600"  },
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

    </section>
  );
};

export default HeroBanners;
