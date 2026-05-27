import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ─── SLIDES PROMO ─────────────────────────────────────────────────────────────
const SLIDES = [
  {
    tag:     "Nouvelle Collection",
    tagIcon: "fa-sparkles",
    title:   "STYLE SANS LIMITES",
    sub:     "Mode femme, sneakers, accessoires. Tout ce qui définit ton identité.",
    cta:     "Découvrir la collection",
    ctaLink: "/store",
    img:     "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1000",
    word:    "MODE",
  },
  {
    tag:     "Flash Drop Elite",
    tagIcon: "fa-bolt",
    title:   "THE ULTIMATE BEAT",
    sub:     "Basses sismiques. Design OneFreestyle. Stock ultra-limité.",
    cta:     "Réserver l'édition",
    ctaLink: "/store",
    img:     "https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=1000",
    word:    "SOUND",
  },
  {
    tag:     "Diaspora 🇨🇲",
    tagIcon: "fa-plane",
    title:   "LE CADEAU PARFAIT EXISTE",
    sub:     "Commandez depuis l'étranger. Livraison à Douala pour vos proches.",
    cta:     "Offrir maintenant",
    ctaLink: "/store",
    img:     "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=1000",
    word:    "GIFT",
  },
];

// ─── RANK CONFIG ──────────────────────────────────────────────────────────────
const RANK_CONFIG = [
  { emoji: "🥇", label: "Or",     accent: "#FF9900", accentBg: "rgba(255,153,0,0.12)", border: "border-[#FF9900]/40" },
  { emoji: "🥈", label: "Argent", accent: "#ADBAC7", accentBg: "rgba(173,186,199,0.1)", border: "border-[#ADBAC7]/30" },
  { emoji: "🥉", label: "Bronze", accent: "#c97c4a", accentBg: "rgba(201,124,74,0.1)", border: "border-[#c97c4a]/30" },
  { emoji: "✦",  label: "",       accent: "#565959", accentBg: "rgba(86,89,89,0.06)",  border: "border-[#D5D9D9]" },
  { emoji: "✦",  label: "",       accent: "#565959", accentBg: "rgba(86,89,89,0.06)",  border: "border-[#D5D9D9]" },
];

const getScore = (v) => {
  const s = Math.min((v._salesCount   || 0) / 15,  40);
  const r = ((v._avgRating  || 0) / 5) * 35;
  const p = Math.min((v._productCount || 0) / 3,   15);
  const t = v.member_discount_enabled ? 10 : 0;
  return Math.round(s + r + p + t);
};

// ─── SKELETON ─────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white border border-[#D5D9D9] rounded p-4 animate-pulse">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-8 rounded bg-[#EAEDED]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-[#EAEDED] rounded w-3/4" />
        <div className="h-2 bg-[#EAEDED] rounded w-1/2" />
      </div>
    </div>
    <div className="h-1.5 bg-[#EAEDED] rounded w-full" />
  </div>
);

// ─── SCORE BAR ────────────────────────────────────────────────────────────────
const ScoreBar = ({ score, color }) => (
  <div className="w-full h-1.5 bg-[#EAEDED] rounded-full overflow-hidden">
    <div className="h-full rounded-full transition-all duration-1000" style={{ width: score + '%', background: color }} />
  </div>
);

// ─── FLASH DROP ───────────────────────────────────────────────────────────────
const FlashDrop = () => {
  const [current, setCurrent] = useState(0);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data: vData } = await supabase.from('vendors').select('*').eq('is_active', true);
        if (!vData?.length) { setVendors([]); return; }

        const { data: pData } = await supabase.from('products').select('id, vendor_id, type');
        const { data: oData } = await supabase.from('orders').select('vendor_id');

        let ratingsData = [];
        try {
          const { data: rData } = await supabase.from('boutique_ratings').select('vendor_id, stars');
          ratingsData = rData || [];
        } catch (_) {}

        const enriched = vData.map(v => {
          const vProds   = (pData || []).filter(p => p.vendor_id === v.id);
          const vSales   = (oData || []).filter(o => o.vendor_id === v.id).length;
          const vRatings = ratingsData.filter(r => r.vendor_id === v.id);
          const avgRating = vRatings.length
            ? vRatings.reduce((a, r) => a + r.stars, 0) / vRatings.length : 0;
          return {
            ...v,
            _productCount: vProds.length,
            _salesCount:   vSales,
            _avgRating:    Math.round(avgRating * 10) / 10,
            _ratingCount:  vRatings.length,
            _categories:   [...new Set(vProds.map(p => p.type))],
          };
        });

        setVendors(enriched.sort((a, b) => getScore(b) - getScore(a)).slice(0, 5));
      } catch (err) {
        console.error('[FlashDrop] fetch:', err.message);
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
      <section className="bg-[#131921] relative overflow-hidden">
        {/* Mot déco BG */}
        <div className="absolute top-0 right-0 h-full flex items-center pointer-events-none select-none overflow-hidden">
          <span key={current} className="text-[clamp(5rem,16vw,14rem)] font-black italic opacity-[0.04] leading-none pr-8 text-white transition-all duration-700">
            {slide.word}
          </span>
        </div>
        {/* Orange accent line top */}
        <div className="h-1 w-full bg-[#FF9900]" />

        <div className="max-w-[1600px] mx-auto px-6 md:px-8 py-12 md:py-16 grid lg:grid-cols-2 items-center gap-8 relative z-10">
          {/* TEXTE */}
          <div key={current} className="animate-slideUp">
            <span className="inline-flex items-center gap-2 text-[#FF9900] font-black uppercase tracking-[0.35em] text-[9px] border border-[#FF9900]/30 bg-[#FF9900]/10 rounded-full px-3 py-1.5 mb-5">
              <i className={`fa-solid ${slide.tagIcon} text-[8px]`}></i>
              {slide.tag}
            </span>

            <h2 className="text-[clamp(2.4rem,7vw,6rem)] font-black italic tracking-tighter leading-[0.9] text-white mb-5">
              <span className="text-[#FF9900]">{slide.title.split(' ')[0]}</span>{' '}
              <span className="block">{slide.title.split(' ').slice(1).join(' ')}</span>
            </h2>

            <p className="text-[#ADBAC7] text-sm font-semibold max-w-sm mb-8 leading-relaxed">
              {slide.sub}
            </p>

            <div className="flex items-center gap-4 flex-wrap">
              <Link to={slide.ctaLink}
                className="bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-7 py-3.5 font-black uppercase text-[10px] tracking-widest transition-colors rounded border border-[#FCD200] flex items-center gap-2 shadow-sm active:scale-[0.98]"
              >
                <span>{slide.cta}</span>
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </Link>
              <Link to="/store" className="text-[#007185] text-[10px] font-black uppercase tracking-widest hover:text-[#FF9900] hover:underline transition-colors">
                Voir tout le store
              </Link>
            </div>

            {/* DOTS */}
            <div className="flex gap-2 mt-8">
              {SLIDES.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className={"h-1 rounded-full transition-all duration-300 " + (i === current ? "w-8 bg-[#FF9900]" : "w-3 bg-white/20 hover:bg-white/40")}
                />
              ))}
            </div>
          </div>

          {/* IMAGE */}
          <div className="hidden lg:block relative">
            <img key={current} src={slide.img} alt={slide.tag}
              className="w-full h-[460px] object-cover rounded shadow-[0_24px_48px_rgba(0,0,0,0.5)] transition-all duration-700"
              style={{ borderBottom: '3px solid #FF9900' }}
            />
            {/* Stock badge */}
            <div className="absolute -bottom-4 -left-4 bg-[#FFD814] border border-[#FCD200] px-5 py-3 rounded flex items-center gap-3 shadow-xl">
              <i className="fa-solid fa-fire text-[#0F1111] text-sm"></i>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-[#0F1111]/60">En ce moment</p>
                <p className="text-[11px] font-black text-[#0F1111]">Stock limité</p>
              </div>
            </div>
          </div>
        </div>

        {/* TRUST STRIP */}
        <div className="border-t border-[#232F3E] bg-[#232F3E]/50">
          <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-6 overflow-x-auto">
            {[
              { icon: "fa-truck-fast",   text: "Livraison 2h · Douala" },
              { icon: "fa-shield-check", text: "Paiement sécurisé" },
              { icon: "fa-rotate-left",  text: "Retour 7 jours" },
              { icon: "fa-headset",      text: "Support 7j/7" },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-2 text-[#ADBAC7] text-[10px] font-bold whitespace-nowrap">
                <i className={`fa-solid ${item.icon} text-[#FF9900] text-xs`}></i>
                {item.text}
              </div>
            ))}
            <div className="ml-auto flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-[#37475A]">
              OneFreestyle · Douala, Cameroun 🇨🇲
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 2 : TOP BOUTIQUES ═══════════════════════════════════════ */}
      <section className="py-10 px-4 md:px-8 bg-[#EAEDED]">
        <div className="max-w-[1600px] mx-auto">

          {/* HEADER */}
          <div className="flex items-start md:items-center justify-between mb-6 gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <i className="fa-solid fa-trophy text-[#FF9900] text-sm"></i>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#FF9900]">Challenge du mois</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-[#0F1111]">
                Meilleures <span className="text-[#FF9900] italic">Boutiques</span>
              </h2>
              <p className="text-[11px] text-[#565959] font-medium mt-0.5">
                Classement en temps réel · Score OFS
              </p>
            </div>

            <Link to="/boutiques"
              className="flex items-center gap-2 bg-[#131921] text-[#FF9900] border border-[#232F3E] px-5 py-2.5 rounded text-[10px] font-black uppercase tracking-widest hover:bg-[#232F3E] transition-colors whitespace-nowrap"
            >
              <i className="fa-solid fa-ranking-star text-xs"></i>
              <span>Classement complet</span>
              <i className="fa-solid fa-arrow-right text-[9px]"></i>
            </Link>
          </div>

          {/* CONTENU */}
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[0,1,2].map(i => <SkeletonCard key={i} />)}
              </div>
              <div className="lg:col-span-2 flex flex-col gap-3">
                {[0,1].map(i => <SkeletonCard key={i} />)}
              </div>
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-14 bg-white border border-[#D5D9D9] rounded">
              <i className="fa-solid fa-store-slash text-[#D5D9D9] text-4xl mb-3 block"></i>
              <p className="font-black text-[#0F1111] uppercase text-sm mb-4">Aucune boutique active</p>
              <Link to="/register"
                className="inline-flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-6 py-2.5 rounded border border-[#FCD200] font-black text-[9px] uppercase tracking-widest transition-colors"
              >
                <i className="fa-solid fa-bolt text-xs"></i>
                Ouvrir la première boutique
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

              {/* TOP 3 — PODIUM */}
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {vendors.slice(0, 3).map((v, i) => {
                  const cfg   = RANK_CONFIG[i];
                  const score = getScore(v);
                  const cats  = v._categories?.slice(0, 2).join(' · ') || '—';
                  const isGold = i === 0;
                  return (
                    <div key={v.id}
                      className={`relative bg-white border rounded p-5 flex flex-col justify-between shadow-sm ${cfg.border} ${isGold ? 'ring-1 ring-[#FF9900]/40' : ''} ${isGold ? 'sm:order-2' : i === 1 ? 'sm:order-1' : 'sm:order-3'}`}
                    >
                      {/* top accent bar */}
                      {isGold && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#FF9900] rounded-t" />}

                      <div className="flex items-start justify-between mb-3">
                        <span className="text-2xl leading-none">{cfg.emoji}</span>
                        <span className="text-[8px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border"
                          style={{ background: cfg.accentBg, color: cfg.accent, borderColor: cfg.accent + '44' }}>
                          #{i + 1}
                        </span>
                      </div>

                      <div className="flex-grow">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="font-black text-[13px] text-[#0F1111] leading-tight truncate">{v.shop_name}</p>
                          <i className="fa-solid fa-circle-check text-[#007185] text-[9px] flex-shrink-0"></i>
                        </div>
                        <p className="text-[9px] text-[#565959] font-medium mb-3">
                          par {v.full_name} · {cats}
                        </p>
                        <ScoreBar score={score} color={cfg.accent} />
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[8px] text-[#565959] font-bold">{v._salesCount} ventes</span>
                          <span className="text-[8px] font-black" style={{ color: cfg.accent }}>{score}/100</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-[#D5D9D9]">
                        <i className="fa-solid fa-star text-[#FF9900] text-[9px]"></i>
                        <span className="text-[11px] font-black text-[#0F1111]">
                          {v._avgRating > 0 ? v._avgRating.toFixed(1) : '—'}
                        </span>
                        <span className="text-[8px] text-[#565959] font-medium ml-1">
                          {v._ratingCount > 0 ? `(${v._ratingCount} avis)` : 'Pas encore noté'}
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
                  const cats  = v._categories?.slice(0, 2).join(' · ') || '—';
                  return (
                    <div key={v.id}
                      className={`bg-white border ${cfg.border} rounded p-4 flex items-center gap-4 shadow-sm`}
                    >
                      <span className="text-xl flex-shrink-0">{cfg.emoji}</span>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="font-black text-[12px] text-[#0F1111] truncate">{v.shop_name}</p>
                          <i className="fa-solid fa-circle-check text-[#007185] text-[8px] flex-shrink-0"></i>
                        </div>
                        <p className="text-[8px] text-[#565959] font-medium mb-1.5">{cats} · {v._salesCount} ventes</p>
                        <ScoreBar score={score} color={cfg.accent} />
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-black text-[13px]" style={{ color: cfg.accent }}>{score}</p>
                        <p className="text-[7px] text-[#565959] uppercase font-bold">pts</p>
                      </div>
                    </div>
                  );
                })}

                {/* CTA BOUTIQUE */}
                <div className="bg-[#131921] border border-[#232F3E] rounded p-5 flex flex-col justify-between flex-grow">
                  <div>
                    <div className="w-9 h-9 bg-[#FF9900]/15 border border-[#FF9900]/30 rounded flex items-center justify-center mb-3">
                      <i className="fa-solid fa-rocket text-[#FF9900] text-sm"></i>
                    </div>
                    <p className="font-black text-[13px] text-white leading-tight mb-1">
                      Ta boutique<br/>dans le top ?
                    </p>
                    <p className="text-[9px] text-[#ADBAC7] font-medium leading-relaxed">
                      Les meilleures boutiques gagnent visibilité, badges et boosts de vente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <Link to="/register"
                      className="bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded border border-[#FCD200] transition-colors flex items-center gap-2"
                    >
                      <i className="fa-solid fa-bolt text-xs"></i>
                      <span>Ouvrir ma boutique</span>
                    </Link>
                    <Link to="/boutiques"
                      className="border border-[#37475A] text-[#ADBAC7] hover:text-[#FF9900] hover:border-[#FF9900]/40 text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded transition-all flex items-center gap-2"
                    >
                      <i className="fa-solid fa-list-ol text-xs"></i>
                      <span>Voir tout</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          <p className="text-[9px] text-[#565959] font-bold uppercase tracking-widest text-center mt-5">
            Classement basé sur ventes · notes · catalogue · remise membres · fiabilité
          </p>
        </div>
      </section>
    </>
  );
};

export default FlashDrop;
