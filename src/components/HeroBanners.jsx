import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const SLIDES = [
  {
    tag: 'Nouveau Drop',
    title: 'AUDIO<br/>ELITE X1',
    sub: 'Son immersif. Design exclusif. OneFreestyle.',
    cta: 'Découvrir',
    img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1200',
    accent: '#00ff88',
    href: '/store',
  },
  {
    tag: 'Flash Deal -30%',
    title: 'STREET<br/>WEAR',
    sub: 'Streetwear élite. Livraison express Douala.',
    cta: 'Shop Now',
    img: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=1200',
    accent: '#a855f7',
    href: '/store',
  },
  {
    tag: 'Bundle Deal',
    title: 'TECH<br/>LAB 4K',
    sub: 'Immersion VR totale. Technologie de pointe.',
    cta: 'Explorer',
    img: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=1200',
    accent: '#3b82f6',
    href: '/store',
  },
];

const HeroBanners = () => {
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setActive((prev) => (prev + 1) % SLIDES.length);
        setAnimating(false);
      }, 400);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goTo = (idx) => {
    if (idx === active) return;
    setAnimating(true);
    setTimeout(() => { setActive(idx); setAnimating(false); }, 300);
  };

  const slide = SLIDES[active];

  return (
    <section className="w-full">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── MAIN BANNER ── */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-2xl h-[280px] md:h-[380px] group cursor-pointer" onClick={() => window.location.href = slide.href}>
            {/* BG IMAGE */}
            <img
              src={slide.img}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${animating ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
            />
            {/* OVERLAY */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent z-10"></div>

            {/* CONTENT */}
            <div className={`absolute inset-0 z-20 p-8 md:p-12 flex flex-col justify-between transition-all duration-500 ${animating ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
              <div>
                <span
                  className="inline-block text-[10px] font-black uppercase tracking-[0.4em] px-3 py-1.5 rounded-full mb-4 border"
                  style={{ color: slide.accent, borderColor: `${slide.accent}40`, backgroundColor: `${slide.accent}10` }}
                >
                  {slide.tag}
                </span>
                <h2
                  className="text-5xl md:text-7xl font-black italic leading-none tracking-tighter text-white"
                  dangerouslySetInnerHTML={{ __html: slide.title }}
                />
              </div>
              <div>
                <p className="text-zinc-300 text-sm font-bold mb-6 max-w-xs">{slide.sub}</p>
                <Link
                  to={slide.href}
                  className="inline-flex items-center gap-3 px-8 py-3.5 font-black uppercase text-[10px] tracking-widest transition-all hover:scale-105 rounded-xl"
                  style={{ backgroundColor: slide.accent, color: '#000' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>{slide.cta}</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </Link>
              </div>
            </div>

            {/* DOTS */}
            <div className="absolute bottom-4 right-4 z-30 flex gap-2">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); goTo(i); }}
                  className={`rounded-full transition-all duration-300 ${i === active ? 'w-6 h-2 bg-primary' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`}
                />
              ))}
            </div>
          </div>

          {/* ── SIDE BANNERS ── */}
          <div className="flex flex-row lg:flex-col gap-4">
            {/* SIDE BANNER 1 */}
            <Link to="/store" className="flex-1 relative overflow-hidden rounded-2xl h-[132px] md:h-[180px] group">
              <img
                src="https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?q=80&w=600"
                alt=""
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-4 z-10">
                <span className="text-[9px] font-black uppercase tracking-widest text-primary block mb-1">Audio Lab</span>
                <p className="text-white font-black text-sm uppercase italic leading-tight">AirPods<br/>Pro 2</p>
              </div>
              <div className="absolute top-3 right-3 bg-primary text-black text-[8px] font-black px-2 py-1 rounded-full uppercase z-10">
                -25%
              </div>
            </Link>

            {/* SIDE BANNER 2 */}
            <Link to="/store" className="flex-1 relative overflow-hidden rounded-2xl h-[132px] md:h-[180px] group bg-zinc-900 border border-white/5">
              <img
                src="https://images.unsplash.com/photo-1552066344-24632e509633?q=80&w=600"
                alt=""
                className="absolute right-0 bottom-0 w-4/5 h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
              />
              <div className="relative z-10 p-4">
                <span className="text-[9px] font-black uppercase tracking-widest text-orange-400 block mb-1">New Drop</span>
                <p className="text-white font-black text-sm uppercase italic leading-tight">Sneakers<br/>Limited</p>
                <p className="text-primary font-black text-xs mt-2">Dès 45.000 F</p>
              </div>
            </Link>
          </div>
        </div>

        {/* ── QUICK STATS BAR ── */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: 'fa-truck-fast', label: 'Livraison Express', sub: 'Douala en 2h', color: 'text-primary' },
            { icon: 'fa-shield-check', label: 'Paiement Sécurisé', sub: 'Orange Money / Cash', color: 'text-blue-400' },
            { icon: 'fa-rotate-left', label: 'Retour Facile', sub: '7 jours', color: 'text-purple-400' },
            { icon: 'fa-headset', label: 'Support Elite', sub: '7j/7 disponible', color: 'text-yellow-400' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 bg-zinc-900 border border-white/5 rounded-xl p-3 hover:border-white/10 transition-colors">
              <div className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className={`fa-solid ${item.icon} ${item.color} text-sm`}></i>
              </div>
              <div>
                <p className="text-white font-black text-[10px] uppercase">{item.label}</p>
                <p className="text-zinc-500 text-[9px] font-bold">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroBanners;