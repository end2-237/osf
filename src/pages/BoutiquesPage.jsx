import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const CATS = ["Toutes", "Audio Lab", "Mode Femme", "Sneakers", "Parfums", "Tech Lab", "Streetwear", "Accessories"];
const SORT_OPTIONS = [
  { value: "score",  label: "Classement OFS" },
  { value: "rating", label: "Meilleure note" },
  { value: "sales",  label: "Plus vendus" },
  { value: "recent", label: "Récents" },
];

const BADGE = {
  1: { label: "Or",     grad: "from-yellow-400/20 to-yellow-400/5", border: "border-yellow-400/40", text: "text-yellow-300", bar: "bg-yellow-400",  icon: "fa-crown",  ring: "shadow-[0_0_24px_rgba(250,204,21,0.15)]" },
  2: { label: "Argent", grad: "from-zinc-300/15 to-zinc-300/5",     border: "border-zinc-300/30",   text: "text-zinc-300",   bar: "bg-zinc-300",    icon: "fa-medal",  ring: "" },
  3: { label: "Bronze", grad: "from-orange-400/15 to-orange-400/5", border: "border-orange-400/30", text: "text-orange-300", bar: "bg-orange-400",  icon: "fa-award",  ring: "" },
};

// ─── CALCUL SCORE OFS ─────────────────────────────────────────────────────────
const getScore = (v) => {
  const s = Math.min((v._salesCount   || 0) / 15,  40);
  const r = ((v._avgRating  || 0) / 5) * 35;
  const p = Math.min((v._productCount || 0) / 3,   15);
  const t = v.member_discount_enabled ? 10 : 0;
  return Math.round(s + r + p + t);
};

// ─── SCORE BAR ────────────────────────────────────────────────────────────────
const ScoreBar = ({ score, rank }) => (
  <div className="flex items-center gap-2">
    <div className="flex-grow h-[3px] bg-white/8 rounded-full overflow-hidden">
      <div
        className={"h-full rounded-full transition-all duration-1000 " + ((BADGE[rank]?.bar) || "bg-primary")}
        style={{ width: `${score}%` }}
      />
    </div>
    <span className={"text-[9px] font-black w-5 text-right " + ((BADGE[rank]?.text) || "text-primary")}>
      {score}
    </span>
  </div>
);

// ─── ÉTOILES ──────────────────────────────────────────────────────────────────
const Stars = ({ value = 0, count, size = "text-[9px]" }) => (
  <div className="flex items-center gap-1">
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <i key={s} className={"fa-star " + size + " " + (s <= Math.round(value) ? "fa-solid text-yellow-400" : "fa-regular text-zinc-700")} />
      ))}
    </div>
    <span className={"font-black text-white " + size}>{value > 0 ? value.toFixed(1) : "—"}</span>
    {count !== undefined && <span className="text-[8px] text-zinc-600">({count})</span>}
  </div>
);

// ─── ÉTOILES CLIQUABLES ───────────────────────────────────────────────────────
const StarInput = ({ value, onChange }) => (
  <div className="flex gap-2">
    {[1,2,3,4,5].map(s => (
      <button key={s} onClick={() => onChange(s)} className="transition-transform hover:scale-125 active:scale-95">
        <i className={"fa-star text-2xl " + (s <= value ? "fa-solid text-yellow-400" : "fa-regular text-zinc-600")} />
      </button>
    ))}
  </div>
);

// ─── MODAL NOTATION ───────────────────────────────────────────────────────────
const RatingModal = ({ vendor, userRating, onClose, onSubmit }) => {
  const [stars,   setStars]   = useState(userRating || 0);
  const [comment, setComment] = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const LABELS = ["", "Décevant 😕", "Passable 😐", "Bien 🙂", "Très bien 😊", "Excellent ! 🔥"];

  const handleSubmit = async () => {
    if (!stars || loading) return;
    setLoading(true);
    await onSubmit({ vendorId: vendor.id, stars, comment });
    setSent(true);
    setTimeout(onClose, 2200);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-zinc-950 border border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-modalUp">
        {sent ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-primary/10 border border-primary/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-check text-primary text-2xl" />
            </div>
            <p className="font-black text-white uppercase tracking-tight text-lg">Note enregistrée !</p>
            <p className="text-zinc-500 text-sm mt-1">Merci pour ta contribution</p>
          </div>
        ) : (
          <>
            <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-white transition">
              <i className="fa-solid fa-xmark text-sm" />
            </button>

            <div className="flex items-center gap-4 mb-7">
              <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-store text-primary text-xl" />
              </div>
              <div>
                <h3 className="font-black uppercase text-white text-base tracking-tighter leading-none">{vendor.shop_name}</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">par {vendor.full_name}</p>
                {vendor._avgRating > 0 && <Stars value={vendor._avgRating} count={vendor._ratingCount} />}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">Ta note</p>
              <StarInput value={stars} onChange={setStars} />
              {stars > 0 && <p className="text-[11px] font-black text-primary mt-2">{LABELS[stars]}</p>}
              {userRating > 0 && <p className="text-[9px] text-zinc-600 mt-1">Tu avais déjà noté {userRating}★ — tu peux modifier</p>}
            </div>

            <div className="mb-6">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Commentaire (optionnel)</p>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Ton expérience avec cette boutique..."
                rows={3}
                className="w-full bg-zinc-900 border border-white/8 rounded-2xl p-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-primary/40 resize-none transition-colors"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!stars || loading}
              className="w-full bg-primary text-black font-black uppercase text-[10px] tracking-widest py-4 rounded-2xl hover:bg-white transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading
                ? <><i className="fa-solid fa-circle-notch animate-spin text-xs" /> Envoi...</>
                : <><i className="fa-solid fa-star text-xs" /> Soumettre ma note</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── SKELETON ─────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-zinc-900 border border-white/5 rounded-[2rem] overflow-hidden animate-pulse">
    <div className="h-28 bg-zinc-800" />
    <div className="p-4 space-y-3">
      <div className="flex gap-3 -mt-5">
        <div className="w-11 h-11 rounded-xl bg-zinc-700 border-2 border-zinc-900 flex-shrink-0" />
        <div className="pt-2 flex-grow space-y-1.5">
          <div className="h-3 bg-zinc-700 rounded w-2/3" />
          <div className="h-2 bg-zinc-800 rounded w-1/2" />
        </div>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded w-full" />
      <div className="grid grid-cols-3 gap-1.5">
        {[0,1,2].map(i => <div key={i} className="h-10 bg-zinc-800 rounded-xl" />)}
      </div>
    </div>
  </div>
);

// ─── CARTE GRID ───────────────────────────────────────────────────────────────
const BoutiqueCardGrid = ({ v, rank, onRate, onVisit, userRated }) => {
  const badge   = BADGE[rank] || null;
  const score   = getScore(v);
  const preview = v._products?.slice(0,3) || [];

  return (
    <div className={"bg-zinc-900 border rounded-[2rem] overflow-hidden transition-all group flex flex-col " + (badge ? "border-white/10 hover:border-white/20 " + (badge.ring || "") : "border-white/5 hover:border-white/10")}>

      <div className="relative h-28 bg-zinc-800 overflow-hidden">
        {preview.length >= 3 ? (
          <div className="grid grid-cols-3 h-full">
            {preview.map((p,i) => (
              <div key={i} className="overflow-hidden">
                <img src={p.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
            <i className="fa-solid fa-store text-3xl text-zinc-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/10 to-transparent" />

        {badge ? (
          <div className={"absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full border text-[8px] font-black bg-gradient-to-r " + badge.grad + " " + badge.border + " " + badge.text}>
            <i className={"fa-solid " + badge.icon + " text-[7px]"} />
            #{rank} · {badge.label}
          </div>
        ) : (
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-[8px] font-black text-zinc-400">
            #{rank}
          </div>
        )}

        {v._salesCount > 300 && (
          <span className="absolute top-3 right-3 text-[7px] font-black bg-orange-500/90 text-white px-2 py-0.5 rounded-full uppercase">🔥 Trending</span>
        )}
      </div>

      <div className="px-4 pb-4 flex-grow flex flex-col">
        <div className="flex items-end gap-3 -mt-5 mb-3 relative z-10">
          <div className="w-11 h-11 bg-primary/10 border-2 border-zinc-900 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-store text-primary text-sm" />
          </div>
          <div className="pb-0.5 min-w-0">
            <p className="font-black text-[12px] text-white uppercase tracking-tighter leading-tight truncate">{v.shop_name}</p>
            <p className="text-[8px] text-zinc-500">par {v.full_name}</p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[7px] font-black uppercase tracking-widest text-zinc-600">Score OFS</span>
            <span className={"text-[8px] font-black " + ((BADGE[rank]?.text) || "text-primary")}>{score}/100</span>
          </div>
          <ScoreBar score={score} rank={rank} />
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {[
            { icon: "fa-bag-shopping", val: v._salesCount  || 0, label: "ventes" },
            { icon: "fa-box",          val: v._productCount|| 0, label: "produits" },
            { icon: "fa-star",         val: v._avgRating > 0 ? v._avgRating.toFixed(1) : "—", label: "note" },
          ].map((s,i) => (
            <div key={i} className="bg-zinc-950 rounded-xl p-2 text-center">
              <i className={"fa-solid " + s.icon + " text-primary text-[7px] mb-0.5 block"} />
              <p className="font-black text-[10px] text-white leading-none">{s.val}</p>
              <p className="text-[6px] uppercase text-zinc-600 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap mb-3">
          {v._categories?.slice(0,2).map(cat => (
            <span key={cat} className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-white/5">{cat}</span>
          ))}
          {v.member_discount_enabled && (
            <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">−20% membres</span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-2">
          <button
            onClick={() => onVisit(v)}
            className="flex-grow bg-white/5 border border-white/8 text-zinc-300 hover:bg-primary hover:text-black hover:border-primary font-black text-[8px] uppercase tracking-wide py-2 rounded-xl transition-all"
          >
            <i className="fa-solid fa-store mr-1 text-[7px]" />Visiter
          </button>
          <button
            onClick={() => onRate(v)}
            className={"border font-black text-[8px] uppercase py-2 px-3 rounded-xl transition-all " + (userRated ? "border-yellow-400/40 text-yellow-400 bg-yellow-400/5" : "border-white/8 text-zinc-500 hover:border-primary/40 hover:text-primary")}
          >
            <i className={"fa-star text-[7px] " + (userRated ? "fa-solid text-yellow-400" : "fa-regular")} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── LIGNE LIST ───────────────────────────────────────────────────────────────
const BoutiqueRowList = ({ v, rank, onRate, onVisit, userRated }) => {
  const score = getScore(v);
  const rc    = BADGE[rank]?.text || "text-zinc-500";
  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl px-5 py-4 flex items-center gap-4 hover:border-white/10 transition-all">
      <div className={"w-8 text-center flex-shrink-0 font-black text-lg " + rc}>#{rank}</div>
      <div className="w-11 h-11 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
        <i className="fa-solid fa-store text-primary text-sm" />
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-black text-[12px] text-white uppercase tracking-tighter truncate">{v.shop_name}</p>
          {v._salesCount > 300 && <span className="text-[6px] font-black bg-orange-500/20 text-orange-400 border border-orange-400/25 px-1.5 py-0.5 rounded-full flex-shrink-0">🔥</span>}
          {v.member_discount_enabled && <span className="text-[6px] font-black bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full flex-shrink-0">−20%</span>}
        </div>
        <p className="text-[8px] text-zinc-500">{v._categories?.slice(0,2).join(" · ") || v.full_name} · {v._productCount || 0} produits</p>
        <div className="mt-1.5 w-36"><ScoreBar score={score} rank={rank} /></div>
      </div>
      <div className="hidden md:block"><Stars value={v._avgRating || 0} count={v._ratingCount} /></div>
      <div className="hidden lg:block text-center flex-shrink-0">
        <p className="font-black text-[12px] text-white">{v._salesCount || 0}</p>
        <p className="text-[7px] uppercase text-zinc-600">ventes</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => onVisit(v)} className="border border-white/8 text-zinc-400 hover:border-primary/40 hover:text-primary px-3 py-2 rounded-xl text-[8px] font-black uppercase transition-all">
          <i className="fa-solid fa-store mr-1 text-[7px]" />Visiter
        </button>
        <button onClick={() => onRate(v)} className={"border font-black text-[8px] uppercase py-2 px-3 rounded-xl transition-all " + (userRated ? "border-yellow-400/40 text-yellow-400 bg-yellow-400/5" : "border-white/8 text-zinc-500 hover:border-primary/40 hover:text-primary")}>
          <i className={"fa-star text-[7px] " + (userRated ? "fa-solid text-yellow-400" : "fa-regular")} />
        </button>
      </div>
    </div>
  );
};

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────
const BoutiquesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [vendors,     setVendors]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [userRatings, setUserRatings] = useState({});
  const [search,       setSearch]       = useState("");
  const [cat,          setCat]          = useState("Toutes");
  const [sort,         setSort]         = useState("score");
  const [viewMode,     setViewMode]     = useState("grid");
  const [ratingTarget, setRatingTarget] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: vData } = await supabase.from("vendors").select("*").eq("is_active", true);
      if (!vData?.length) { setVendors([]); return; }

      const { data: pData } = await supabase.from("products").select("id, vendor_id, type, img, price");
      const { data: oData } = await supabase.from("orders").select("vendor_id, status");

      let ratingsData = [];
      try {
        const { data: rData } = await supabase.from("boutique_ratings").select("vendor_id, stars, user_id");
        ratingsData = rData || [];
      } catch (_) {}

      const enriched = vData.map(v => {
        const vProducts = (pData  || []).filter(p => p.vendor_id === v.id);
        const vSales    = (oData  || []).filter(o => o.vendor_id === v.id).length;
        const vRatings  = ratingsData.filter(r => r.vendor_id === v.id);
        const avgRating = vRatings.length ? vRatings.reduce((a,r) => a + r.stars, 0) / vRatings.length : 0;
        return {
          ...v,
          _productCount: vProducts.length,
          _salesCount:   vSales,
          _avgRating:    Math.round(avgRating * 10) / 10,
          _ratingCount:  vRatings.length,
          _products:     vProducts.slice(0,3),
          _categories:   [...new Set(vProducts.map(p => p.type))],
        };
      });

      setVendors([...enriched].sort((a,b) => getScore(b) - getScore(a)));

      if (user) {
        const mine = {};
        ratingsData.filter(r => r.user_id === user.id).forEach(r => { mine[r.vendor_id] = r.stars; });
        setUserRatings(mine);
      }
    } catch (err) {
      console.error("[BoutiquesPage]", err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmitRating = async ({ vendorId, stars, comment }) => {
    setVendors(prev => prev.map(v => {
      if (v.id !== vendorId) return v;
      const prev_stars = userRatings[vendorId];
      const newCount   = prev_stars ? v._ratingCount : v._ratingCount + 1;
      const total      = v._avgRating * v._ratingCount - (prev_stars || 0) + stars;
      return { ...v, _avgRating: Math.round((total / newCount) * 10) / 10, _ratingCount: newCount };
    }));
    setUserRatings(prev => ({ ...prev, [vendorId]: stars }));
    if (user) {
      try {
        await supabase.from("boutique_ratings").upsert(
          { vendor_id: vendorId, user_id: user.id, stars, comment },
          { onConflict: "vendor_id,user_id" }
        );
      } catch (_) {}
    }
  };

  const filtered = vendors
    .filter(v => {
      const matchCat = cat === "Toutes" || v._categories?.includes(cat);
      const matchQ   = !search || v.shop_name.toLowerCase().includes(search.toLowerCase()) || v.full_name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchQ;
    })
    .sort((a,b) => {
      if (sort === "rating") return (b._avgRating || 0) - (a._avgRating || 0);
      if (sort === "sales")  return (b._salesCount || 0) - (a._salesCount || 0);
      if (sort === "recent") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      return getScore(b) - getScore(a);
    });

  const top3  = [...vendors].sort((a,b) => getScore(b) - getScore(a)).slice(0,3);
  const podium = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <div className="bg-black min-h-screen">

      {/* ══ HERO PODIUM ══════════════════════════════════════════════════════ */}
      <section className="relative bg-zinc-950 border-b border-white/5 overflow-hidden pt-[148px]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/4 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-yellow-400/4 rounded-full blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: "linear-gradient(rgba(0,255,136,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,1) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        <div className="max-w-[1600px] mx-auto px-4 md:px-8 pt-10 pb-10 relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-yellow-400/8 border border-yellow-400/20 rounded-full px-4 py-1.5 mb-4">
              <i className="fa-solid fa-trophy text-yellow-400 text-xs" />
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-yellow-300">Classement Live · mis à jour en temps réel</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-white leading-none">
              Top <span className="text-primary italic">Boutiques</span> Elite
            </h1>
            <p className="text-zinc-500 text-sm mt-3 font-bold">
              {loading ? "..." : `${vendors.length} boutique${vendors.length > 1 ? "s" : ""} certifiée${vendors.length > 1 ? "s" : ""}`}
              {" · "}Classées par ventes, notes &amp; fiabilité
            </p>
          </div>

          {!loading && top3.length >= 2 && (
            <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
              {podium.map((v, i) => {
                const isCenter = i === 1;
                const rank     = isCenter ? 1 : i === 0 ? 2 : 3;
                const b        = BADGE[rank];
                const score    = getScore(v);
                const heights  = ["h-20","h-28","h-16"];
                const emoji    = ["🥈","🥇","🥉"][i];
                return (
                  <div key={v.id} className={"flex flex-col items-center " + (isCenter ? "order-2 -mt-4" : i === 0 ? "order-1 mt-5" : "order-3 mt-8")}>
                    {isCenter && (
                      <span className="text-[7px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-3 py-0.5 rounded-full mb-1.5">✦ N°1 ce mois</span>
                    )}
                    <div
                      onClick={() => navigate(`/shop/${v.shop_name}`)}
                      className={"w-full bg-gradient-to-br border rounded-2xl p-4 text-center cursor-pointer hover:scale-[1.02] transition-transform " + b.grad + " " + b.border}
                    >
                      <div className="text-xl mb-1">{emoji}</div>
                      <div className="w-9 h-9 mx-auto mb-1.5 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center">
                        <i className="fa-solid fa-store text-primary text-sm" />
                      </div>
                      <p className={"font-black text-[10px] text-white leading-tight truncate " + b.text}>{v.shop_name}</p>
                      <p className="text-[7px] text-zinc-500 mt-0.5">{v._salesCount} ventes</p>
                      <Stars value={v._avgRating} size="text-[7px]" />
                      <div className="mt-1.5"><ScoreBar score={score} rank={rank} /></div>
                    </div>
                    <div className={"w-full " + heights[i] + " rounded-b-2xl flex items-center justify-center " + (rank===1 ? "bg-yellow-400/6 border-x border-b border-yellow-400/12" : rank===2 ? "bg-zinc-300/4 border-x border-b border-zinc-300/8" : "bg-orange-400/4 border-x border-b border-orange-400/8")}>
                      <span className={"font-black text-4xl " + (rank===1 ? "text-yellow-400/10" : "text-white/4")}>{rank}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ══ FILTRES STICKY ════════════════════════════════════════════════════ */}
      <div className="sticky top-[148px] z-50 bg-black/96 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-zinc-900 border border-white/8 rounded-xl px-3 py-2 gap-2 flex-grow max-w-xs focus-within:border-primary/40 transition-colors">
            <i className="fa-solid fa-magnifying-glass text-zinc-500 text-xs flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nom de boutique..."
              className="bg-transparent text-sm text-white placeholder-zinc-600 outline-none w-full font-bold"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-zinc-500 hover:text-white flex-shrink-0 transition">
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
            {CATS.map(c => (
              <button key={c} onClick={() => setCat(c)}
                className={"px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wide whitespace-nowrap transition-all flex-shrink-0 " + (cat === c ? "bg-primary text-black" : "bg-zinc-900 border border-white/8 text-zinc-400 hover:text-white hover:border-white/15")}
              >{c}</button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="bg-zinc-900 border border-white/8 text-zinc-300 text-[9px] font-black uppercase rounded-xl px-3 py-2 outline-none cursor-pointer hover:border-white/15 transition"
            >
              {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <div className="flex items-center bg-zinc-900 border border-white/8 rounded-xl overflow-hidden">
              {["grid","list"].map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={"w-8 h-8 flex items-center justify-center transition-colors " + (viewMode === v ? "bg-primary text-black" : "text-zinc-500 hover:text-white")}
                >
                  <i className={"fa-solid text-xs " + (v === "grid" ? "fa-table-cells" : "fa-list")} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 md:px-8 pb-2">
          <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">
            {loading ? "Chargement..." : `${filtered.length} boutique${filtered.length > 1 ? "s" : ""}`}
            {cat !== "Toutes" && <span className="text-primary ml-1">· {cat}</span>}
            {search && <span className="text-zinc-500 ml-1">· "{search}"</span>}
          </span>
        </div>
      </div>

      {/* ══ LISTE ══════════════════════════════════════════════════════════════ */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-8">

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_,i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 border border-white/5 rounded-[3rem]">
            <i className="fa-solid fa-store-slash text-zinc-700 text-5xl mb-4 block" />
            <p className="font-black italic text-white uppercase text-xl tracking-tight">Aucune boutique trouvée</p>
            <p className="text-zinc-600 text-sm mt-2">Essaie un autre filtre ou une autre recherche</p>
            <button onClick={() => { setSearch(""); setCat("Toutes"); }}
              className="mt-5 bg-primary text-black px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition"
            >Réinitialiser</button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(v => {
              const globalRank = vendors.findIndex(x => x.id === v.id) + 1;
              return <BoutiqueCardGrid key={v.id} v={v} rank={globalRank} onRate={() => setRatingTarget(v)} onVisit={() => navigate(`/shop/${v.shop_name}`)} userRated={!!userRatings[v.id]} />;
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(v => {
              const globalRank = vendors.findIndex(x => x.id === v.id) + 1;
              return <BoutiqueRowList key={v.id} v={v} rank={globalRank} onRate={() => setRatingTarget(v)} onVisit={() => navigate(`/shop/${v.shop_name}`)} userRated={!!userRatings[v.id]} />;
            })}
          </div>
        )}

        {!loading && vendors.length > 0 && (
          <p className="mt-8 text-center text-[8px] font-black uppercase tracking-widest text-zinc-700">
            Classement basé sur : ventes · notes communauté · catalogue · remise membres · fiabilité
          </p>
        )}

        {/* CTA VENDEUR */}
        <div className="mt-12 bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/20 rounded-[3rem] p-8 md:p-14 text-center">
          <i className="fa-solid fa-rocket text-primary text-3xl mb-4 block" />
          <h3 className="font-black text-3xl uppercase italic tracking-tighter text-white mb-2">Ta boutique n'est pas encore là ?</h3>
          <p className="text-zinc-500 text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Rejoins les meilleures boutiques Elite. Construis ta réputation, monte dans le classement et gagne en visibilité.
          </p>
          <Link to="/register"
            className="inline-flex items-center gap-2 bg-primary text-black font-black uppercase text-[9px] tracking-widest px-8 py-4 rounded-2xl hover:bg-white transition-all hover:scale-105"
          >
            <i className="fa-solid fa-bolt text-xs" />Ouvrir ma boutique Elite
          </Link>
        </div>

        {!user && (
          <div className="mt-6 bg-zinc-950 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
            <i className="fa-solid fa-star text-primary text-xl flex-shrink-0" />
            <div className="flex-grow">
              <p className="font-black text-white text-[11px] uppercase">Note les boutiques, influence le classement</p>
              <p className="text-zinc-500 text-[10px] mt-0.5">Connecte-toi pour laisser une note visible par toute la communauté.</p>
            </div>
            <Link to="/login" className="flex-shrink-0 bg-primary text-black px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition">
              Se connecter
            </Link>
          </div>
        )}
      </div>

      {ratingTarget && (
        <RatingModal
          vendor={ratingTarget}
          userRating={userRatings[ratingTarget.id]}
          onClose={() => setRatingTarget(null)}
          onSubmit={handleSubmitRating}
        />
      )}

      <style>{`
        @keyframes modalUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .animate-modalUp { animation: modalUp 0.35s cubic-bezier(0.2,0,0,1) both; }
      `}</style>
    </div>
  );
};

export default BoutiquesPage;