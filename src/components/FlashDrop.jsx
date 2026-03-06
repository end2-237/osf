import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ─── SLIDES PROMO ─────────────────────────────────────────────────────────────
const SLIDES = [
  {
    tag:     "Nouvelle Collection",
    title:   ["STYLE", "SANS", "LIMITES."],
    sub:     "Mode femme, sneakers, accessoires. Tout ce qui définit ton identité. Disponible maintenant.",
    cta:     "Découvrir la collection",
    ctaLink: "/store",
    img:     "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1000",
    word:    "MODE",
  },
  {
    tag:     "Flash Drop Elite",
    title:   ["THE", "ULTIMATE", "BEAT."],
    sub:     "Immersion totale. Basses sismiques. Design OneFreeStyle. Ne laisse personne dicter ton rythme.",
    cta:     "Réserver l'édition limitée",
    ctaLink: "/store",
    img:     "https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=1000",
    word:    "SOUND",
  },
  {
    tag:     "Offrir & Partager",
    title:   ["LE CADEAU", "PARFAIT", "EXISTE."],
    sub:     "Commandez depuis l'étranger. Livraison à Douala pour vos proches. Simple, rapide, élégant.",
    cta:     "Offrir maintenant",
    ctaLink: "/store",
    img:     "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=1000",
    word:    "GIFT",
  },
];

// ─── CONFIG BADGES ────────────────────────────────────────────────────────────
const RANK_CONFIG = [
  { emoji: "🥇", color: "from-yellow-400/20 to-yellow-400/5", border: "border-yellow-400/40", ring: "ring-1 ring-yellow-400/40", bar: "bg-yellow-400", text: "text-yellow-300", label: "Or" },
  { emoji: "🥈", color: "from-zinc-300/10 to-zinc-300/5",     border: "border-zinc-300/30",   ring: "",                          bar: "bg-zinc-300",   text: "text-zinc-300",   label: "Argent" },
  { emoji: "🥉", color: "from-orange-400/15 to-orange-400/5", border: "border-orange-400/30", ring: "",                          bar: "bg-orange-400", text: "text-orange-300", label: "Bronze" },
  { emoji: "✨", color: "from-pink-400/10 to-pink-400/5",     border: "border-pink-400/20",   ring: "",                          bar: "bg-pink-400",   text: "text-pink-300",   label: "" },
  { emoji: "⚡", color: "from-blue-400/10 to-blue-400/5",     border: "border-blue-400/20",   ring: "",                          bar: "bg-blue-400",   text: "text-blue-300",   label: "" },
];

// ─── CALCUL SCORE OFS ─────────────────────────────────────────────────────────
const getScore = (v) => {
  const s = Math.min((v._salesCount   || 0) / 15,  40);
  const r = ((v._avgRating  || 0) / 5) * 35;
  const p = Math.min((v._productCount || 0) / 3,   15);
  const t = v.member_discount_enabled ? 10 : 0;
  return Math.round(s + r + p + t);
};

// ─── SCORE BAR ────────────────────────────────────────────────────────────────
const ScoreBar = ({ score, barClass }) => (
  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
    <div className={"h-full rounded-full transition-all duration-1000 " + barClass} style={{ width: score + "%" }} />
  </div>
);

// ─── SKELETON ─────────────────────────────────────────────────────────────────
const SkeletonBoutique = () => (
  <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-5 animate-pulse">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-8 rounded-lg bg-zinc-800" />
      <div className="flex-grow space-y-1.5">
        <div className="h-3 bg-zinc-800 rounded w-3/4" />
        <div className="h-2 bg-zinc-800 rounded w-1/2" />
      </div>
    </div>
    <div className="h-1 bg-zinc-800 rounded w-full" />
  </div>
);

// ─── FLASH DROP ───────────────────────────────────────────────────────────────
const FlashDrop = () => {
  const [current,  setCurrent]  = useState(0);
  const [vendors,  setVendors]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  // ── AUTO-SLIDE ────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  // ── FETCH VENDEURS RÉELS ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data: vData } = await supabase
          .from('vendors')
          .select('*')
          .eq('is_active', true);

        if (!vData?.length) { setVendors([]); return; }

        const { data: pData } = await supabase
          .from('products')
          .select('id, vendor_id, type');

        const { data: oData } = await supabase
          .from('orders')
          .select('vendor_id');

        let ratingsData = [];
        try {
          const { data: rData } = await supabase
            .from('boutique_ratings')
            .select('vendor_id, stars');
          ratingsData = rData || [];
        } catch (_) {}

        const enriched = vData.map(v => {
          const vProds   = (pData || []).filter(p => p.vendor_id === v.id);
          const vSales   = (oData || []).filter(o => o.vendor_id === v.id).length;
          const vRatings = ratingsData.filter(r => r.vendor_id === v.id);
          const avgRating = vRatings.length
            ? vRatings.reduce((a, r) => a + r.stars, 0) / vRatings.length
            : 0;
          return {
            ...v,
            _productCount: vProds.length,
            _salesCount:   vSales,
            _avgRating:    Math.round(avgRating * 10) / 10,
            _ratingCount:  vRatings.length,
            _categories:   [...new Set(vProds.map(p => p.type))],
          };
        });

        // Trier par score OFS décroissant, garder top 5
        const sorted = enriched
          .sort((a, b) => getScore(b) - getScore(a))
          .slice(0, 5);

        setVendors(sorted);
      } catch (err) {
        console.error('[FlashDrop] fetch vendors:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchVendors();
  }, []);

  const slide = SLIDES[current];

  return (
    <>
      {/* ══ SECTION 1 : PROMO BAND ══════════════════════════════════════════ */}
      <section className="bg-primary text-black relative overflow-hidden">
        {/* Mot déco BG */}
        <div className="absolute top-0 right-0 h-full flex items-center pointer-events-none select-none overflow-hidden">
          <span key={current} className="text-[clamp(6rem,18vw,16rem)] font-black italic opacity-[0.08] leading-none pr-8 transition-all duration-700">
            {slide.word}
          </span>
        </div>

        <div className="max-w-[1600px] mx-auto px-6 md:px-8 py-12 md:py-16 grid lg:grid-cols-2 items-center gap-8 relative z-10">
          {/* TEXTE */}
          <div key={current} className="animate-slideUp">
            <span className="inline-flex items-center gap-2 font-black uppercase tracking-[0.4em] text-[9px] border-b-2 border-black/30 pb-2 mb-6">
              <i className="fa-solid fa-bolt text-[10px]"></i>
              {slide.tag}
            </span>

            <h2 className="text-[clamp(3rem,8vw,7rem)] font-black italic tracking-tighter leading-[0.9] mb-6">
              {slide.title.map((line, i) => <span key={i} className="block">{line}</span>)}
            </h2>

            <p className="text-base font-semibold max-w-sm mb-8 opacity-80 leading-relaxed">
              {slide.sub}
            </p>

            <div className="flex items-center gap-4 flex-wrap">
              <Link to={slide.ctaLink}
                className="bg-black text-white px-8 py-4 font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-transform rounded-xl flex items-center gap-2"
              >
                <span>{slide.cta}</span>
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </Link>
              <Link to="/store" className="font-black text-[10px] uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity underline underline-offset-4">
                Voir tout le store
              </Link>
            </div>

            {/* DOTS */}
            <div className="flex gap-2 mt-8">
              {SLIDES.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className={"h-1 rounded-full transition-all duration-300 " + (i === current ? "w-8 bg-black" : "w-3 bg-black/30")}
                />
              ))}
            </div>
          </div>

          {/* IMAGE */}
          <div className="hidden lg:block relative">
            <img key={current} src={slide.img} alt={slide.tag}
              className="w-full h-[480px] object-cover rounded-[2rem] shadow-[-20px_20px_0px_rgba(0,0,0,0.15)] transition-all duration-700"
            />
            <div className="absolute -bottom-4 -left-4 bg-black text-white px-5 py-3 rounded-2xl flex items-center gap-3 shadow-2xl">
              <i className="fa-solid fa-fire text-primary text-sm"></i>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">En ce moment</p>
                <p className="text-[11px] font-black text-white">Stock limité</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 2 : TOP BOUTIQUES RÉEL ═════════════════════════════════ */}
      <section className="py-12 px-4 md:px-8 bg-zinc-950 border-b border-white/5">
        <div className="max-w-[1600px] mx-auto">

          {/* HEADER */}
          <div className="flex items-start md:items-center justify-between mb-8 gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <i className="fa-solid fa-trophy text-yellow-400 text-base"></i>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-yellow-400">Challenge du mois</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">
                Meilleures <span className="text-primary italic">Boutiques</span>
              </h2>
              <p className="text-[11px] text-zinc-500 font-medium mt-1">
                Classement en temps réel · Score OFS
              </p>
            </div>

            {/* BOUTON VOIR LE CLASSEMENT COMPLET */}
            <Link
              to="/boutiques"
              className="flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-colors whitespace-nowrap"
            >
              <i className="fa-solid fa-ranking-star text-xs"></i>
              <span>Voir le classement complet</span>
              <i className="fa-solid fa-arrow-right text-[9px]"></i>
            </Link>
          </div>

          {/* CONTENU : skeleton ou données réelles */}
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[0,1,2].map(i => <SkeletonBoutique key={i} />)}
              </div>
              <div className="lg:col-span-2 flex flex-col gap-3">
                {[0,1].map(i => <SkeletonBoutique key={i} />)}
              </div>
            </div>
          ) : vendors.length === 0 ? (
            /* AUCUNE BOUTIQUE */
            <div className="text-center py-12 border border-white/5 rounded-2xl">
              <i className="fa-solid fa-store-slash text-zinc-700 text-3xl mb-3 block"></i>
              <p className="font-black text-white uppercase text-sm">Aucune boutique active pour l'instant</p>
              <Link to="/register" className="mt-4 inline-flex items-center gap-2 bg-primary text-black px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition">
                <i className="fa-solid fa-bolt text-xs"></i>Ouvrir la première boutique
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

              {/* TOP 3 — PODIUM */}
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {vendors.slice(0, 3).map((v, i) => {
                  const cfg   = RANK_CONFIG[i];
                  const score = getScore(v);
                  const cats  = v._categories?.slice(0,2).join(' · ') || '—';
                  return (
                    <div
                      key={v.id}
                      className={"relative bg-gradient-to-br border rounded-2xl p-5 flex flex-col justify-between " + cfg.color + " " + cfg.border + " " + cfg.ring + (i === 0 ? " sm:order-2" : i === 1 ? " sm:order-1" : " sm:order-3")}
                    >
                      {/* RANG */}
                      <div className="flex items-start justify-between mb-4">
                        <span className="text-3xl leading-none">{cfg.emoji}</span>
                        <span className={"text-[8px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full " + (i === 0 ? "bg-yellow-400/20 text-yellow-300" : "bg-white/10 text-zinc-400")}>
                          #{i + 1}
                        </span>
                      </div>

                      {/* INFOS */}
                      <div className="flex-grow">
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className="font-black text-[13px] text-white leading-tight truncate">{v.shop_name}</p>
                          <i className="fa-solid fa-circle-check text-primary text-[9px] flex-shrink-0"></i>
                        </div>
                        <p className="text-[9px] text-zinc-500 font-medium mb-3">
                          par {v.full_name} · {cats}
                        </p>
                        <ScoreBar score={score} barClass={cfg.bar} />
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[8px] text-zinc-500 font-bold">{v._salesCount} ventes</span>
                          <span className={"text-[8px] font-black " + cfg.text}>{score}/100</span>
                        </div>
                      </div>

                      {/* RATING */}
                      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/10">
                        <i className="fa-solid fa-star text-yellow-400 text-[9px]"></i>
                        <span className="text-[11px] font-black text-white">
                          {v._avgRating > 0 ? v._avgRating.toFixed(1) : "—"}
                        </span>
                        <span className="text-[8px] text-zinc-500 font-medium ml-1">
                          {v._ratingCount > 0 ? `(${v._ratingCount} avis)` : "Pas encore noté"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* RANG 4-5 + CTA */}
              <div className="lg:col-span-2 flex flex-col gap-3">
                {vendors.slice(3, 5).map((v, i) => {
                  const cfg   = RANK_CONFIG[i + 3];
                  const score = getScore(v);
                  const cats  = v._categories?.slice(0,2).join(' · ') || '—';
                  return (
                    <div key={v.id}
                      className={"bg-gradient-to-br border rounded-2xl p-4 flex items-center gap-4 " + cfg.color + " " + cfg.border}
                    >
                      <span className="text-xl flex-shrink-0">{cfg.emoji}</span>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="font-black text-[12px] text-white truncate">{v.shop_name}</p>
                          <i className="fa-solid fa-circle-check text-primary text-[8px] flex-shrink-0"></i>
                        </div>
                        <p className="text-[8px] text-zinc-500 font-medium mb-1.5">{cats} · {v._salesCount} ventes</p>
                        <ScoreBar score={score} barClass={cfg.bar} />
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={"font-black text-[13px] " + cfg.text}>{score}</p>
                        <p className="text-[7px] text-zinc-600 uppercase font-bold">pts</p>
                      </div>
                    </div>
                  );
                })}

                {/* CTA BOUTIQUE */}
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/25 rounded-2xl p-5 flex flex-col justify-between flex-grow mt-1">
                  <div>
                    <i className="fa-solid fa-rocket text-primary text-base mb-3 block"></i>
                    <p className="font-black text-[13px] text-white leading-tight mb-1">
                      Ta boutique<br/>dans le top ?
                    </p>
                    <p className="text-[9px] text-zinc-500 font-medium leading-relaxed">
                      Lance-toi. Les meilleures boutiques gagnent visibilité, badges et boosts de vente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <Link to="/register"
                      className="bg-primary text-black text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl hover:bg-white transition-colors flex items-center gap-2"
                    >
                      <i className="fa-solid fa-bolt text-xs"></i>
                      <span>Ouvrir ma boutique</span>
                    </Link>
                    <Link to="/boutiques"
                      className="border border-white/10 text-zinc-400 hover:text-primary hover:border-primary/30 text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
                    >
                      <i className="fa-solid fa-list-ol text-xs"></i>
                      <span>Voir tout</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest text-center mt-6">
            Classement basé sur ventes · notes · catalogue · remise membres · fiabilité
          </p>
        </div>
      </section>
    </>
  );
};

export default FlashDrop;