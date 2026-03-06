import React, { useState, useEffect } from 'react';
import ofsLogo from "../assets/ofs.png";
import { supabase } from '../lib/supabase';

// ─── PARTENAIRES ─────────────────────────────────────────────────────────────
const PARTNERS = [
  { name: "Nike",    icon: "fa-circle-check", color: "text-white" },
  { name: "Samsung", icon: "fa-circle-check", color: "text-blue-400" },
  { name: "Apple",   icon: "fa-circle-check", color: "text-zinc-300" },
  { name: "Adidas",  icon: "fa-circle-check", color: "text-white" },
  { name: "Sony",    icon: "fa-circle-check", color: "text-blue-300" },
  { name: "Zara",    icon: "fa-circle-check", color: "text-pink-300" },
  { name: "JBL",     icon: "fa-circle-check", color: "text-orange-400" },
  { name: "Huawei",  icon: "fa-circle-check", color: "text-red-400" },
];

// ─── CALCUL SCORE OFS ─────────────────────────────────────────────────────────
const getScore = (v) => {
  const s = Math.min((v._salesCount   || 0) / 15, 40);
  const r = ((v._avgRating  || 0) / 5) * 35;
  const p = Math.min((v._productCount || 0) / 3,  15);
  const t = v.member_discount_enabled ? 10 : 0;
  return Math.round(s + r + p + t);
};

// ─── PISTE 1 : Stats (statique) ───────────────────────────────────────────────
const TRACK_1_BASE = [
  { type: "logo" },
  { type: "treasure" },
  { type: "sep" },
  { type: "stat", value: "2 400+", label: "Produits",    icon: "fa-bag-shopping", color: "text-primary" },
  { type: "sep" },
  { type: "stat", value: "320+",   label: "Vendeurs",    icon: "fa-store",        color: "text-blue-400" },
  { type: "sep" },
  { type: "stat", value: "−20%",   label: "Membres",     icon: "fa-crown",        color: "text-yellow-400" },
  { type: "sep" },
  { type: "stat", value: "Douala", label: "Cameroun 🇨🇲", icon: "fa-location-dot", color: "text-orange-400" },
  { type: "sep" },
  { type: "stat", value: "4.9 ★",  label: "Note moy.",   icon: "fa-star",         color: "text-yellow-300" },
  { type: "sep" },
];

// ─── RENDU DES ITEMS ──────────────────────────────────────────────────────────
const Item = ({ item }) => {
  if (item.type === "logo") return (
    <span className="inline-flex items-center gap-2 px-6">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/25 bg-primary/5">
        <img src={ofsLogo} alt="OFS" className="w-3.5 h-3.5 opacity-90" />
        <span className="font-black text-[10px] uppercase tracking-tight text-white/80">
          OFS <span className="text-primary italic">Elite</span>
        </span>
      </span>
    </span>
  );

  if (item.type === "treasure") return (
    <span className="inline-flex items-center gap-2 px-5">
      <span className="inline-flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/30 px-3 py-1 rounded-full">
        <i className="fa-solid fa-trophy text-yellow-400 text-[9px]"></i>
        <span className="text-[9px] font-black uppercase tracking-wide text-yellow-300">Chasse au Trésor</span>
        <span className="text-[8px] font-bold text-yellow-400/60">· Lots chaque semaine</span>
      </span>
    </span>
  );

  if (item.type === "stat") return (
    <span className="inline-flex items-center gap-2 px-5">
      <i className={`fa-solid ${item.icon} ${item.color} text-[10px]`}></i>
      <span className="font-black text-[12px] text-white tracking-tight">{item.value}</span>
      <span className="text-[8px] font-semibold uppercase tracking-widest text-zinc-500">{item.label}</span>
    </span>
  );

  if (item.type === "sep") return (
    <span className="inline-flex items-center px-1">
      <span className="w-px h-3 bg-white/10 inline-block"></span>
    </span>
  );

  if (item.type === "shops-label") return (
    <span className="inline-flex items-center gap-1.5 px-5">
      <i className="fa-solid fa-medal text-yellow-400 text-[9px]"></i>
      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-yellow-400/80">Top Boutiques</span>
      <span className="w-px h-3 bg-white/10 ml-3"></span>
    </span>
  );

  if (item.type === "shop") return (
    <span className="inline-flex items-center gap-3 px-4">
      <span className="inline-flex items-center gap-1.5">
        {/* RANG */}
        {item.rank <= 3 && (
          <span className="text-[10px]">{["🥇","🥈","🥉"][item.rank - 1]}</span>
        )}
        <span className="w-5 h-5 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-store text-[7px] text-zinc-400"></i>
        </span>
        <span className="font-bold text-[11px] text-white/80">{item.name}</span>
        <i className="fa-solid fa-circle-check text-primary text-[8px]"></i>
        {item.cat && <span className="text-[8px] text-zinc-500 font-medium">{item.cat}</span>}
        {item.rating > 0 && (
          <span className="text-[8px] text-yellow-400">{"★".repeat(Math.round(item.rating))}</span>
        )}
        {item.score > 0 && (
          <span className="text-[7px] font-black text-primary/60">{item.score}pts</span>
        )}
      </span>
      <span className="w-px h-3 bg-white/8"></span>
    </span>
  );

  if (item.type === "partners-label") return (
    <span className="inline-flex items-center gap-1.5 px-5">
      <i className="fa-solid fa-handshake text-primary text-[9px]"></i>
      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary/70">Partenaires Officiels</span>
      <span className="w-px h-3 bg-white/10 ml-3"></span>
    </span>
  );

  if (item.type === "partner") return (
    <span className="inline-flex items-center gap-1.5 px-4">
      <i className={`fa-solid ${item.icon} ${item.color} text-[8px]`}></i>
      <span className="font-black text-[11px] text-zinc-300 tracking-wide">{item.name}</span>
    </span>
  );

  return null;
};

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
const Marquee = () => {
  const [topShops, setTopShops] = useState([]);

  useEffect(() => {
    const fetchTopShops = async () => {
      try {
        const { data: vData } = await supabase
          .from('vendors')
          .select('id, shop_name, full_name, member_discount_enabled')
          .eq('is_active', true);

        if (!vData?.length) return;

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
            _categories:   [...new Set(vProds.map(p => p.type))],
          };
        });

        const sorted = enriched
          .sort((a, b) => getScore(b) - getScore(a))
          .slice(0, 6);

        setTopShops(sorted);
      } catch (err) {
        console.error('[Marquee] fetch:', err.message);
      }
    };

    fetchTopShops();
  }, []);

  // Construire les pistes dynamiquement
  const shopItems = topShops.length > 0
    ? topShops.map((v, i) => ({
        type:   "shop",
        name:   v.shop_name,
        cat:    v._categories?.slice(0, 1).join('') || '',
        rating: v._avgRating || 0,
        score:  getScore(v),
        rank:   i + 1,
      }))
    : []; // piste vide si pas encore chargé → pas visible

  const TRACK_1 = [...TRACK_1_BASE, ...TRACK_1_BASE];

  const TRACK_2 = shopItems.length > 0
    ? [{ type: "shops-label" }, ...shopItems, { type: "shops-label" }, ...shopItems]
    : [];

  const TRACK_3 = [
    { type: "partners-label" },
    ...PARTNERS.map(p => ({ type: "partner", ...p })),
    { type: "partners-label" },
    ...PARTNERS.map(p => ({ type: "partner", ...p })),
  ];

  return (
    <section className="ofs-marquee-wrap border-y border-white/[0.06] bg-zinc-950 overflow-hidden select-none">

      {/* Piste 1 — stats, vers la gauche */}
      <div className="flex items-center border-b border-white/[0.04] py-2">
        <div className="ofs-t1 inline-flex items-center whitespace-nowrap">
          {TRACK_1.map((item, i) => <Item key={i} item={item} />)}
        </div>
      </div>

      {/* Piste 2 — vraies boutiques, vers la droite (masquée si vide) */}
      {TRACK_2.length > 0 && (
        <div className="flex items-center border-b border-white/[0.04] py-2">
          <div className="ofs-t2 inline-flex items-center whitespace-nowrap">
            {TRACK_2.map((item, i) => <Item key={i} item={item} />)}
          </div>
        </div>
      )}

      {/* Piste 3 — partenaires, vers la gauche, lent */}
      <div className="flex items-center py-2">
        <div className="ofs-t3 inline-flex items-center whitespace-nowrap">
          {TRACK_3.map((item, i) => <Item key={i} item={item} />)}
        </div>
      </div>

      <style>{`
        @keyframes ofs-ltr { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @keyframes ofs-rtl { from { transform: translateX(0); }   to { transform: translateX(-50%); } }

        .ofs-t1 { animation: ofs-rtl 28s linear infinite; will-change: transform; }
        .ofs-t2 { animation: ofs-ltr 38s linear infinite; will-change: transform; }
        .ofs-t3 { animation: ofs-rtl 50s linear infinite; will-change: transform; }

        .ofs-marquee-wrap {
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 5%, black 95%, transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0%, black 5%, black 95%, transparent 100%);
        }
      `}</style>
    </section>
  );
};

export default Marquee;