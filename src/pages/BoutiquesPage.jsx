import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { getVendorDiscountPercent } from "../utils/discountUtils";
import { logError } from "../lib/track";

/* ════════════════════════════════════════════════════════════════════════════
   TOUTES LES BOUTIQUES

   Une place de marché, pas un annuaire. L'ancienne page classait les boutiques
   et s'arrêtait là : on voyait des noms, des scores, des badges — jamais ce
   qu'on pouvait acheter. Or personne n'entre dans une galerie marchande pour
   lire des enseignes.

   Ici chaque boutique arrive avec ses produits : dans sa carte, dans le rayon
   de sa catégorie, dans les bandeaux du haut. Le classement ne disparaît pas —
   il ordonne simplement ce qu'on montre au lieu d'être le sujet.
   ════════════════════════════════════════════════════════════════════════════ */

const ACCENT = "#FF9900", INK = "#0F1111", NAVY = "#131921", MUTED = "#565959", LINE = "#E3E6E6";

const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} F`;

const SORT_OPTIONS = [
  { value: "score",  label: "Classement Buyticle" },
  { value: "rating", label: "Meilleure note" },
  { value: "sales",  label: "Plus vendues" },
  { value: "recent", label: "Nouvelles boutiques" },
];

const BADGE = {
  1: { label: "Or",     bg: "#FFF4D6", fg: "#8A6100", icon: "fa-crown" },
  2: { label: "Argent", bg: "#EDEFEF", fg: "#4A4F4F", icon: "fa-medal" },
  3: { label: "Bronze", bg: "#FBE9DC", fg: "#8A4B1E", icon: "fa-award" },
};

// Le score n'a pas changé de recette : ventes, notes, catalogue, remise membre.
const getScore = (v) => {
  const s = Math.min((v._salesCount   || 0) / 15, 40);
  const r = ((v._avgRating || 0) / 5) * 35;
  const p = Math.min((v._productCount || 0) / 3, 15);
  const t = v.member_discount_enabled ? 10 : 0;
  return Math.round(s + r + p + t);
};

/* ── Étoiles ──────────────────────────────────────────────────────────────── */
const Stars = ({ value = 0, count, size = "text-[10px]" }) => (
  <span className="inline-flex items-center gap-1">
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <i key={s} className={`fa-star ${size} ${s <= Math.round(value) ? "fa-solid" : "fa-regular"}`}
          style={{ color: s <= Math.round(value) ? ACCENT : "#D5D9D9" }} />
      ))}
    </span>
    <span className={`font-bold ${size}`} style={{ color: INK }}>{value > 0 ? value.toFixed(1) : "—"}</span>
    {count !== undefined && <span className="text-[10px]" style={{ color: MUTED }}>({count})</span>}
  </span>
);

const StarInput = ({ value, onChange }) => (
  <div className="flex gap-2">
    {[1, 2, 3, 4, 5].map(s => (
      <button key={s} onClick={() => onChange(s)} className="transition-transform hover:scale-125 active:scale-95">
        <i className={`fa-star text-2xl ${s <= value ? "fa-solid" : "fa-regular"}`}
          style={{ color: s <= value ? ACCENT : "#D5D9D9" }} />
      </button>
    ))}
  </div>
);

/* ── Modale de notation ───────────────────────────────────────────────────── */
const RatingModal = ({ vendor, userRating, onClose, onSubmit }) => {
  const [stars, setStars]     = useState(userRating || 0);
  const [comment, setComment] = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const LABELS = ["", "Décevant 😕", "Passable 😐", "Bien 🙂", "Très bien 😊", "Excellent ! 🔥"];

  const handleSubmit = async () => {
    if (!stars || loading) return;
    setLoading(true);
    await onSubmit({ vendorId: vendor.id, stars, comment });
    setSent(true);
    setTimeout(onClose, 2000);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-7 w-full max-w-md shadow-2xl animate-modalUp">
        {sent ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#E8F5E8" }}>
              <i className="fa-solid fa-check text-2xl" style={{ color: "#007600" }} />
            </div>
            <p className="font-black text-[16px]" style={{ color: INK }}>Note enregistrée</p>
            <p className="text-[13px] mt-1" style={{ color: MUTED }}>Merci pour ta contribution.</p>
          </div>
        ) : (
          <>
            <button onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
              style={{ color: MUTED }}>
              <i className="fa-solid fa-xmark text-sm" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: "#F7F8F8" }}>
                {vendor.logo_url
                  ? <img src={vendor.logo_url} alt="" className="w-full h-full object-cover" />
                  : <i className="fa-solid fa-store" style={{ color: ACCENT }} />}
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-[15px] truncate" style={{ color: INK }}>{vendor.shop_name}</h3>
                {vendor._avgRating > 0 && <Stars value={vendor._avgRating} count={vendor._ratingCount} />}
              </div>
            </div>

            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>Ta note</p>
            <StarInput value={stars} onChange={setStars} />
            {stars > 0 && <p className="text-[12px] font-bold mt-2" style={{ color: ACCENT }}>{LABELS[stars]}</p>}
            {userRating > 0 && (
              <p className="text-[11px] mt-1" style={{ color: MUTED }}>Tu avais noté {userRating}★ — tu peux modifier.</p>
            )}

            <p className="text-[11px] font-bold uppercase tracking-wide mt-5 mb-2" style={{ color: MUTED }}>
              Commentaire (optionnel)
            </p>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
              placeholder="Ton expérience avec cette boutique…"
              className="w-full border rounded-xl p-3 text-[13px] outline-none resize-none focus:border-gray-900"
              style={{ borderColor: LINE }} />

            <button onClick={handleSubmit} disabled={!stars || loading}
              className="w-full mt-4 text-white font-black uppercase text-[11px] tracking-widest py-3.5 rounded-xl disabled:opacity-40"
              style={{ background: INK }}>
              {loading ? "Envoi…" : "Soumettre ma note"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ── Une vignette produit ─────────────────────────────────────────────────── */
const ProductChip = ({ p }) => (
  <Link to={`/product/${p.id}`} className="group block">
    <div className="aspect-square rounded-xl overflow-hidden flex items-center justify-center" style={{ background: "#F7F8F8" }}>
      {p.img
        ? <img src={p.img} alt={p.name} loading="lazy"
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500" />
        : <i className="fa-solid fa-image text-lg" style={{ color: "#D5D9D9" }} />}
    </div>
    <p className="text-[11px] font-semibold mt-1.5 leading-tight line-clamp-2 group-hover:underline" style={{ color: INK }}>
      {p.name}
    </p>
    <p className="text-[11px] font-black" style={{ color: INK }}>{money(p.price)}</p>
  </Link>
);

/* ── Carte produit avec sa note ───────────────────────────────────────────── */
const ProductCardRated = ({ p, shop }) => (
  <Link to={`/product/${p.id}`} className="group bg-white rounded-2xl border overflow-hidden flex flex-col hover:shadow-md transition-shadow"
    style={{ borderColor: LINE }}>
    <div className="aspect-[4/3] flex items-center justify-center relative" style={{ background: "#F7F8F8" }}>
      {p.img
        ? <img src={p.img} alt={p.name} loading="lazy"
            className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500" />
        : <i className="fa-solid fa-image text-2xl" style={{ color: "#D5D9D9" }} />}
      {p._note >= 4.5 && p._avis >= 2 && (
        <span className="absolute top-2 left-2 text-[9px] font-black text-white px-2 py-1 rounded-lg"
          style={{ background: "#0F7B4F" }}>
          Coup de cœur
        </span>
      )}
    </div>
    <div className="p-3 flex-1 flex flex-col">
      {/* La note d'abord : c'est ce qu'on regarde avant le nom quand on ne
          connaît pas la boutique. */}
      {p._avis > 0
        ? <Stars value={p._note} count={p._avis} size="text-[10px]" />
        : <span className="text-[10px]" style={{ color: "#C9CDCD" }}>Pas encore d'avis</span>}
      <p className="text-[12px] font-semibold leading-tight line-clamp-2 mt-1 group-hover:underline" style={{ color: INK }}>
        {p.name}
      </p>
      {shop && <p className="text-[10px] mt-0.5 truncate" style={{ color: MUTED }}>{shop}</p>}
      <p className="text-[14px] font-black mt-auto pt-2" style={{ color: INK }}>{money(p.price)}</p>
    </div>
  </Link>
);

/* ── Ligne produit compacte, pour les colonnes latérales ──────────────────── */
const ProductRow = ({ p }) => (
  <Link to={`/product/${p.id}`} className="flex items-center gap-2.5 py-2.5 group">
    <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
      style={{ background: "#F7F8F8" }}>
      {p.img
        ? <img src={p.img} alt="" loading="lazy" className="w-full h-full object-contain p-1" />
        : <i className="fa-solid fa-image text-[11px]" style={{ color: "#D5D9D9" }} />}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11.5px] font-semibold leading-tight line-clamp-2 group-hover:underline" style={{ color: INK }}>
        {p.name}
      </p>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[12px] font-black" style={{ color: INK }}>{money(p.price)}</span>
        {p._avis > 0 && (
          <span className="text-[10px] flex items-center gap-0.5" style={{ color: MUTED }}>
            <i className="fa-solid fa-star text-[8px]" style={{ color: ACCENT }} />{p._note}
          </span>
        )}
      </div>
    </div>
  </Link>
);

/* ── Un avis client ───────────────────────────────────────────────────────── */
const AvisCard = ({ a, shop }) => (
  <div className="bg-white rounded-2xl border p-4 flex flex-col" style={{ borderColor: LINE }}>
    <Stars value={a.rating} size="text-[11px]" />
    <p className="text-[12.5px] leading-relaxed mt-2 flex-1" style={{ color: INK }}>« {a.text} »</p>
    <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: "#F0F2F2" }}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
        style={{ background: "#FFF4D6", color: "#8A6100" }}>
        {(a.user_name || "C").slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold truncate" style={{ color: INK }}>{a.user_name || "Client Buyticle"}</p>
        {shop && <p className="text-[10px] truncate" style={{ color: MUTED }}>chez {shop}</p>}
      </div>
      {/* Un avis boutique n'existe que sur une commande livrée : il est
          vérifiable par construction, et ça mérite d'être dit. */}
      <span className="ml-auto text-[9px] font-black px-2 py-1 rounded-md flex-shrink-0"
        style={{ background: "#E8F5E8", color: "#0F7B4F" }}>
        <i className="fa-solid fa-circle-check mr-1" />Achat vérifié
      </span>
    </div>
  </div>
);

/* ── La carte d'une boutique — avec ce qu'elle vend ───────────────────────── */
const BoutiqueCard = ({ v, rank, onRate, onVisit, userRated }) => {
  const badge = BADGE[rank];
  const score = getScore(v);
  const vitrine = (v._products || []).slice(0, 4);

  return (
    <div className="bg-white rounded-2xl border overflow-hidden flex flex-col hover:shadow-md transition-shadow"
      style={{ borderColor: LINE }}>

      {/* Bandeau : la couverture, ou à défaut trois produits — jamais un vide. */}
      <div className="relative h-24" style={{ background: "#F7F8F8" }}>
        {v.cover_url ? (
          <img src={v.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : vitrine.length >= 3 ? (
          <div className="grid grid-cols-3 h-full">
            {vitrine.slice(0, 3).map((p, i) => (
              <div key={i} className="overflow-hidden flex items-center justify-center">
                {p.img
                  ? <img src={p.img} alt="" className="w-full h-full object-cover" loading="lazy" />
                  : <i className="fa-solid fa-image" style={{ color: "#D5D9D9" }} />}
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <i className="fa-solid fa-store text-2xl" style={{ color: "#D5D9D9" }} />
          </div>
        )}

        <span className="absolute top-2 left-2 text-[9px] font-black px-2 py-1 rounded-lg flex items-center gap-1"
          style={badge ? { background: badge.bg, color: badge.fg } : { background: "rgba(255,255,255,.9)", color: MUTED }}>
          {badge && <i className={`fa-solid ${badge.icon} text-[8px]`} />}#{rank}
        </span>

        {v._salesCount > 300 && (
          <span className="absolute top-2 right-2 text-[9px] font-black text-white px-2 py-1 rounded-lg" style={{ background: ACCENT }}>
            Populaire
          </span>
        )}
      </div>

      <div className="px-4 pb-4 flex-1 flex flex-col">
        <div className="flex items-end gap-3 -mt-6 mb-3 relative">
          <div className="w-12 h-12 rounded-xl border-2 border-white overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{ background: "#fff" }}>
            {v.logo_url
              ? <img src={v.logo_url} alt={v.shop_name} className="w-full h-full object-cover" />
              : <i className="fa-solid fa-store" style={{ color: ACCENT }} />}
          </div>
          <div className="pb-0.5 min-w-0 flex-1">
            <p className="font-black text-[14px] leading-tight truncate" style={{ color: INK }}>{v.shop_name}</p>
            <Stars value={v._avgRating || 0} count={v._ratingCount} />
            {v._verifiedCount > 0 && (
              <p className="text-[9.5px] font-bold" style={{ color: "#0F7B4F" }}>
                <i className="fa-solid fa-circle-check mr-1" />
                {v._verifiedCount} avis après livraison
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] mb-3 flex-wrap" style={{ color: MUTED }}>
          <span><b style={{ color: INK }}>{v._productCount || 0}</b> produits</span>
          <span>·</span>
          <span><b style={{ color: INK }}>{v._salesCount || 0}</b> ventes</span>
          {v.member_discount_enabled && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-md" style={{ background: "#FFF4D6", color: "#8A6100" }}>
              −{getVendorDiscountPercent(v)}% membres
            </span>
          )}
        </div>

        {/* Ce qu'elle vend, tout de suite. Une enseigne sans vitrine ne dit rien. */}
        {vitrine.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            {vitrine.map(p => (
              <Link key={p.id} to={`/product/${p.id}`} title={p.name}
                className="aspect-square rounded-lg overflow-hidden flex items-center justify-center border hover:border-gray-900 transition-colors"
                style={{ background: "#F7F8F8", borderColor: LINE }}>
                {p.img
                  ? <img src={p.img} alt={p.name} loading="lazy" className="w-full h-full object-contain p-1" />
                  : <i className="fa-solid fa-image text-[10px]" style={{ color: "#D5D9D9" }} />}
              </Link>
            ))}
          </div>
        )}

        {/* Un mot d'un vrai client vaut plus que trois étiquettes de rayon. */}
        {v._avis?.[0] && (
          <p className="text-[11px] italic leading-snug mb-3 pl-2 border-l-2 line-clamp-2"
            style={{ color: MUTED, borderColor: ACCENT }}>
            « {v._avis[0].text} »
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {v._categories?.slice(0, 3).map(c => (
            <span key={c} className="text-[9px] font-semibold px-2 py-0.5 rounded-md" style={{ background: "#F0F2F2", color: MUTED }}>{c}</span>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2">
          <button onClick={() => onVisit(v)}
            className="flex-1 text-white text-[11px] font-bold py-2.5 rounded-xl" style={{ background: INK }}>
            Voir la boutique
          </button>
          <button onClick={() => onRate(v)} title="Noter cette boutique"
            className="w-10 h-10 rounded-xl border flex items-center justify-center"
            style={{ borderColor: userRated ? ACCENT : LINE, color: userRated ? ACCENT : MUTED }}>
            <i className={`fa-star text-[12px] ${userRated ? "fa-solid" : "fa-regular"}`} />
          </button>
        </div>

        {/* Le score reste, mais discret : il ordonne, il n'est plus le sujet. */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: "#F0F2F2" }}>
          <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>Score</span>
          <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "#EDEFEF" }}>
            <div className="h-full rounded-full" style={{ width: `${score}%`, background: badge ? badge.fg : ACCENT }} />
          </div>
          <span className="text-[10px] font-black" style={{ color: INK }}>{score}</span>
        </div>
      </div>
    </div>
  );
};

/* ── Squelette ────────────────────────────────────────────────────────────── */
const Skeleton = () => (
  <div className="bg-white rounded-2xl border overflow-hidden animate-pulse" style={{ borderColor: LINE }}>
    <div className="h-24" style={{ background: "#EDEFEF" }} />
    <div className="p-4 space-y-3">
      <div className="h-3 rounded w-2/3" style={{ background: "#EDEFEF" }} />
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map(i => <div key={i} className="aspect-square rounded-lg" style={{ background: "#F0F2F2" }} />)}
      </div>
      <div className="h-9 rounded-xl" style={{ background: "#EDEFEF" }} />
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   LA PAGE
   ════════════════════════════════════════════════════════════════════════════ */
const BoutiquesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [vendors, setVendors]         = useState([]);
  const [products, setProducts]       = useState([]);
  const [avisBoutique, setAvisBoutique] = useState([]);
  const [avisProduit, setAvisProduit]   = useState([]);
  const [onglet, setOnglet]             = useState("une");   // une | notes | neufs
  const [loading, setLoading]         = useState(true);
  const [userRatings, setUserRatings] = useState({});
  const [search, setSearch]           = useState("");
  const [cat, setCat]                 = useState("Toutes");
  const [sort, setSort]               = useState("score");
  const [ratingTarget, setRatingTarget] = useState(null);
  const [slide, setSlide]             = useState(0);
  const grilleRef                     = useRef(null);

  /* ── Données ────────────────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: vData } = await supabase.from("vendors").select("*").eq("is_active", true);
      if (!vData?.length) { setVendors([]); setProducts([]); return; }

      // On charge nom et prix en plus : la page montre des produits, pas des
      // pastilles de couleur.
      const { data: pData } = await supabase
        .from("products").select("id, vendor_id, type, img, price, name, created_at");
      const { data: oData } = await supabase.rpc("vendor_sales_counts");

      const { data: rData, error: rErr } =
        await supabase.from("boutique_ratings").select("vendor_id, stars, user_id");
      if (rErr) logError(rErr, "boutiques:boutique_ratings");
      const ratingsData = rData || [];

      // Les avis qui comptent vraiment : ceux déposés après une livraison. Un
      // avis boutique est lié à une commande, un avis produit à un achat — on
      // ne peut pas les fabriquer. Les deux sont publics, c'est leur raison
      // d'être.
      //
      // On ne les enveloppe pas dans un try/catch : le client Supabase ne lève
      // pas, il renvoie { data: null, error }. Un catch ne voyait donc jamais
      // rien, et une table absente ou une règle RLS trop stricte se traduisait
      // par une page silencieusement vide — impossible à diagnostiquer depuis
      // le navigateur d'un vendeur. Maintenant l'erreur est journalisée.
      const [{ data: vr, error: vErr }, { data: pr, error: pErr }] = await Promise.all([
        supabase.from("vendor_reviews")
          .select("vendor_id, rating, text, user_name, created_at")
          .order("created_at", { ascending: false }).limit(400),
        supabase.from("reviews")
          .select("product_id, rating, text, user_name, created_at")
          .eq("approved", true)
          .order("created_at", { ascending: false }).limit(600),
      ]);
      if (vErr) logError(vErr, "boutiques:vendor_reviews");
      if (pErr) logError(pErr, "boutiques:reviews");
      const shopReviews = vr || [], prodReviews = pr || [];
      setAvisBoutique(shopReviews);
      setAvisProduit(prodReviews);

      const enriched = vData.map(v => {
        const vProducts = (pData || []).filter(p => p.vendor_id === v.id);
        const vSales    = Number((oData || []).find(o => o.vendor_id === v.id)?.sales || 0);

        // Deux sources de notes : celles laissées librement sur cette page, et
        // celles déposées après une livraison. La moyenne les additionne — une
        // note reste une note — mais on compte à part celles qui sont
        // adossées à une commande, parce que ce sont les seules invérifiables.
        const libres    = ratingsData.filter(r => r.vendor_id === v.id).map(r => r.stars);
        const verifies  = shopReviews.filter(r => r.vendor_id === v.id);
        const toutes    = [...libres, ...verifies.map(r => r.rating)];
        const avg       = toutes.length ? toutes.reduce((a, n) => a + n, 0) / toutes.length : 0;

        return {
          ...v,
          _productCount: vProducts.length,
          _salesCount:   vSales,
          _avgRating:    Math.round(avg * 10) / 10,
          _ratingCount:  toutes.length,
          _verifiedCount: verifies.length,
          _avis:         verifies.filter(r => r.text),      // les commentaires écrits
          _products:     vProducts,
          _categories:   [...new Set(vProducts.map(p => p.type).filter(Boolean))],
        };
      });

      setVendors([...enriched].sort((a, b) => getScore(b) - getScore(a)));
      setProducts(pData || []);

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
      const before   = userRatings[vendorId];
      const newCount = before ? v._ratingCount : v._ratingCount + 1;
      const total    = v._avgRating * v._ratingCount - (before || 0) + stars;
      return { ...v, _avgRating: Math.round((total / newCount) * 10) / 10, _ratingCount: newCount };
    }));
    setUserRatings(prev => ({ ...prev, [vendorId]: stars }));
    if (user) {
      try {
        await supabase.from("boutique_ratings").upsert(
          { vendor_id: vendorId, user_id: user.id, stars, comment },
          { onConflict: "vendor_id,user_id" }
        );
      } catch { /* la notation ne doit pas casser la page */ }
    }
  };

  const visit = (v) => navigate(`/shop/${encodeURIComponent(v.shop_name)}`);

  /* ── Le rayon des catégories, tiré des produits réellement en ligne ─────── */
  const categories = useMemo(() => {
    const m = {};
    products.forEach(p => {
      if (!p.type) return;
      (m[p.type] ||= { name: p.type, produits: [], boutiques: new Set() });
      m[p.type].produits.push(p);
      m[p.type].boutiques.add(p.vendor_id);
    });
    return Object.values(m)
      .map(c => ({ ...c, nb: c.produits.length, nbShops: c.boutiques.size }))
      .sort((a, b) => b.nb - a.nb);
  }, [products]);

  // Note moyenne par produit, tirée des avis d'acheteurs.
  const noteProduit = useMemo(() => {
    const m = {};
    avisProduit.forEach(a => {
      (m[a.product_id] ||= { total: 0, n: 0 });
      m[a.product_id].total += a.rating; m[a.product_id].n += 1;
    });
    Object.values(m).forEach(x => { x.moy = Math.round((x.total / x.n) * 10) / 10; });
    return m;
  }, [avisProduit]);

  const avecNote = useCallback(
    (p) => ({ ...p, _note: noteProduit[p.id]?.moy || 0, _avis: noteProduit[p.id]?.n || 0 }),
    [noteProduit]
  );

  const nomBoutique = useMemo(
    () => Object.fromEntries(vendors.map(v => [v.id, v.shop_name])),
    [vendors]
  );

  /* ── Filtre et tri ──────────────────────────────────────────────────────── */
  const filtered = useMemo(() => vendors
    .filter(v => {
      const okCat = cat === "Toutes" || v._categories?.includes(cat);
      const q = search.trim().toLowerCase();
      const okQ = !q
        || v.shop_name?.toLowerCase().includes(q)
        || v.full_name?.toLowerCase().includes(q)
        || v._products?.some(p => p.name?.toLowerCase().includes(q));   // on cherche aussi dans les produits
      return okCat && okQ;
    })
    .sort((a, b) => {
      if (sort === "rating") return (b._avgRating || 0) - (a._avgRating || 0);
      if (sort === "sales")  return (b._salesCount || 0) - (a._salesCount || 0);
      if (sort === "recent") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      return getScore(b) - getScore(a);
    }), [vendors, cat, search, sort]);

  const rangs = useMemo(
    () => Object.fromEntries([...vendors].sort((a, b) => getScore(b) - getScore(a)).map((v, i) => [v.id, i + 1])),
    [vendors]
  );

  const top3 = vendors.slice(0, 3);

  const nouveautes = useMemo(
    () => [...products].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            .slice(0, 8).map(avecNote),
    [products, avecNote]
  );

  // Mieux notés : une seule étoile d'un seul client ne fait pas une réputation,
  // donc la règle reste deux avis minimum. Mais au démarrage, quand personne
  // n'a encore été noté deux fois, cette règle vide complètement l'onglet — et
  // un onglet vide donne l'impression que les avis ne remontent pas, alors
  // qu'ils existent. Tant qu'il y a moins de trois produits qualifiés, on
  // descend à un avis : le nombre d'avis est affiché à côté des étoiles, le
  // visiteur voit donc lui-même sur quoi la note repose.
  const mieuxNotes = useMemo(() => {
    const classer = (a, b) => b._note - a._note || b._avis - a._avis;
    const notes   = products.map(avecNote);
    const solides = notes.filter(p => p._avis >= 2);
    const retenus = solides.length >= 3 ? solides : notes.filter(p => p._avis >= 1);
    return retenus.sort(classer).slice(0, 8);
  }, [products, avecNote]);

  // À la une : un produit par boutique, pour ne pas donner huit fois la même
  // enseigne. On y met celui qui a des avis plutôt que celui qui sort en
  // premier de la base — sinon un produit noté peut n'apparaître nulle part
  // sur cette page, ce qui est exactement l'inverse du but.
  const alaune = useMemo(() => {
    const out = [];
    vendors.forEach(v => {
      const liste = (v._products || []).map(avecNote);
      if (!liste.length) return;
      const meilleur = [...liste].sort(
        (a, b) => b._avis - a._avis || b._note - a._note
      )[0];
      out.push(meilleur);
    });
    return out.slice(0, 8);
  }, [vendors, avecNote]);

  const ONGLETS = [
    { key: "une",   label: "À la une",     data: alaune },
    { key: "notes", label: "Mieux notés",  data: mieuxNotes },
    { key: "neufs", label: "Nouveautés",   data: nouveautes },
  ];
  const onglet_actif = ONGLETS.find(o => o.key === onglet) || ONGLETS[0];

  // Les commentaires écrits, toutes boutiques : c'est ce qui rassure un
  // visiteur qui ne connaît aucune des enseignes.
  const temoignages = useMemo(
    () => avisBoutique.filter(a => a.text).slice(0, 6),
    [avisBoutique]
  );

  // Les boutiques mises en avant du carrousel : les mieux classées qui ont de
  // quoi remplir une vitrine.
  const vedettes = useMemo(
    () => vendors.filter(v => (v._products?.length || 0) >= 1).slice(0, 4),
    [vendors]
  );

  useEffect(() => {
    if (vedettes.length < 2) return;
    const t = setInterval(() => setSlide(s => (s + 1) % vedettes.length), 6000);
    return () => clearInterval(t);
  }, [vedettes.length]);

  const versGrille = () => grilleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const vedette = vedettes[slide];

  return (
    <div className="min-h-screen" style={{ background: "#F3F4F6" }}>

      {/* Pas de bande de catégories ici : la barre de navigation du site en
          porte déjà une, juste au-dessus. Deux rangées de rayons empilées se
          contrediraient. Le tri par rayon se fait dans la colonne de gauche,
          et sur mobile par le menu déroulant du bandeau. */}

      <div className="max-w-[1500px] mx-auto px-3 md:px-6 py-5 space-y-5">

        {/* ══ RAYONS + VITRINE ════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">

          {/* Colonne des rayons */}
          <aside className="hidden lg:block bg-white rounded-2xl border overflow-hidden self-start" style={{ borderColor: LINE }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: LINE }}>
              <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: INK }}>Rayons</p>
            </div>
            <div className="py-1 max-h-[460px] overflow-y-auto">
              <button onClick={() => { setCat("Toutes"); versGrille(); }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] hover:bg-gray-50"
                style={{ color: cat === "Toutes" ? INK : MUTED, fontWeight: cat === "Toutes" ? 700 : 500 }}>
                Toutes les boutiques
                <span className="text-[10px]" style={{ color: MUTED }}>{vendors.length}</span>
              </button>
              {categories.map((c, i) => (
                <button key={c.name} onClick={() => { setCat(c.name); versGrille(); }}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] hover:bg-gray-50 text-left"
                  style={{ color: cat === c.name ? INK : MUTED, fontWeight: cat === c.name ? 700 : 500 }}>
                  <span className="truncate flex items-center gap-2">
                    {c.name}
                    {i === 0 && <span className="text-[8px] font-black px-1.5 py-0.5 rounded" style={{ background: "#FFF4D6", color: "#8A6100" }}>TOP</span>}
                  </span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: MUTED }}>{c.nb}</span>
                </button>
              ))}
            </div>
            <Link to="/register" className="block px-4 py-3 border-t text-[12px] font-bold hover:bg-gray-50"
              style={{ borderColor: LINE, color: INK }}>
              <i className="fa-solid fa-store mr-2" style={{ color: ACCENT }} />Ouvrir ma boutique
            </Link>
          </aside>

          {/* Vitrine : une boutique en avant, avec ses produits */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
            <div className="relative bg-white rounded-2xl border overflow-hidden min-h-[280px]" style={{ borderColor: LINE }}>
              {loading || !vedette ? (
                <div className="h-full min-h-[280px] animate-pulse" style={{ background: "#EDEFEF" }} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 h-full">
                  <div className="p-6 sm:p-8 flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: ACCENT }}>
                      Boutique à la une
                    </span>
                    <h2 className="text-[26px] sm:text-[30px] font-black leading-none tracking-tight" style={{ color: INK }}>
                      {vedette.shop_name}
                    </h2>
                    <p className="text-[13px] mt-2 line-clamp-2" style={{ color: MUTED }}>
                      {vedette.description || `${vedette._productCount} produits en ligne · ${vedette._salesCount} ventes`}
                    </p>
                    <div className="mt-3"><Stars value={vedette._avgRating || 0} count={vedette._ratingCount} size="text-[12px]" /></div>
                    <button onClick={() => visit(vedette)}
                      className="mt-5 self-start text-white text-[12px] font-bold px-6 py-3 rounded-xl" style={{ background: INK }}>
                      Découvrir la boutique
                    </button>
                  </div>
                  <div className="p-4 sm:p-6 flex items-center justify-center" style={{ background: "#F7F8F8" }}>
                    <div className="grid grid-cols-2 gap-3 w-full max-w-[300px]">
                      {(vedette._products || []).slice(0, 4).map(p => <ProductChip key={p.id} p={p} />)}
                    </div>
                  </div>
                </div>
              )}

              {vedettes.length > 1 && (
                <div className="absolute bottom-3 left-6 flex gap-1.5">
                  {vedettes.map((_, i) => (
                    <button key={i} onClick={() => setSlide(i)} aria-label={`Boutique ${i + 1}`}
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: i === slide ? 18 : 6, background: i === slide ? ACCENT : "#D5D9D9" }} />
                  ))}
                </div>
              )}
            </div>

            {/* Deux cartes empilées : le podium, avec un produit chacune */}
            <div className="grid grid-cols-2 xl:grid-cols-1 gap-5">
              {top3.slice(0, 2).map((v, i) => (
                <button key={v.id} onClick={() => visit(v)}
                  className="bg-white rounded-2xl border p-4 text-left hover:shadow-md transition-shadow flex flex-col"
                  style={{ borderColor: LINE }}>
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md self-start"
                    style={{ background: BADGE[i + 1].bg, color: BADGE[i + 1].fg }}>
                    <i className={`fa-solid ${BADGE[i + 1].icon} mr-1`} />N°{i + 1}
                  </span>
                  <p className="font-black text-[15px] mt-2 leading-tight truncate" style={{ color: INK }}>{v.shop_name}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>
                    {v._productCount} produits · {v._salesCount} ventes
                  </p>
                  <div className="flex-1 flex items-center justify-center mt-2 rounded-xl overflow-hidden" style={{ background: "#F7F8F8", minHeight: 84 }}>
                    {v._products?.[0]?.img
                      ? <img src={v._products[0].img} alt="" loading="lazy" className="w-full h-full object-contain p-2 max-h-[120px]" />
                      : <i className="fa-solid fa-store text-2xl" style={{ color: "#D5D9D9" }} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══ PRODUITS : trois colonnes ═══════════════════════════════════════ */}
        {/* Le rayon central porte les produits, les deux colonnes latérales
            servent ce qu'on ne cherche pas mais qu'on prend : les arrivages
            d'un côté, les mieux notés de l'autre. */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_250px] gap-5">

          {/* Colonne gauche : nouveautés */}
          <aside className="hidden lg:block space-y-5 self-start">
            <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: LINE }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: LINE }}>
                <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: INK }}>Nouveautés</p>
                <span className="h-0.5 w-6 rounded-full" style={{ background: ACCENT }} />
              </div>
              <div className="px-4 divide-y" style={{ borderColor: "#F0F2F2" }}>
                {nouveautes.slice(0, 5).map(p => <ProductRow key={p.id} p={p} />)}
                {nouveautes.length === 0 && (
                  <p className="py-6 text-[11px] text-center" style={{ color: MUTED }}>Aucun produit encore.</p>
                )}
              </div>
            </div>

            {temoignages[0] && (
              <div className="bg-white rounded-2xl border p-4" style={{ borderColor: LINE }}>
                <p className="text-[11px] font-black uppercase tracking-wider mb-2.5" style={{ color: INK }}>
                  Ils ont acheté
                </p>
                <Stars value={temoignages[0].rating} size="text-[11px]" />
                <p className="text-[12px] italic leading-relaxed mt-2" style={{ color: MUTED }}>
                  « {temoignages[0].text} »
                </p>
                <p className="text-[11px] font-bold mt-2" style={{ color: INK }}>
                  {temoignages[0].user_name || "Client Buyticle"}
                </p>
              </div>
            )}
          </aside>

          {/* Colonne centrale : les produits, par onglet */}
          <section className="bg-white rounded-2xl border p-4 sm:p-5" style={{ borderColor: LINE }}>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4 pb-3 border-b" style={{ borderColor: LINE }}>
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded-full" style={{ background: ACCENT }} />
                <h2 className="text-[16px] font-black" style={{ color: INK }}>Les produits du réseau</h2>
              </div>
              <div className="flex items-center gap-1">
                {ONGLETS.map(o => (
                  <button key={o.key} onClick={() => setOnglet(o.key)}
                    className="px-3 py-1.5 rounded-full text-[11.5px] font-bold transition-colors"
                    style={onglet === o.key
                      ? { background: ACCENT, color: INK }
                      : { color: MUTED }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {onglet_actif.data.length === 0 ? (
              <p className="py-14 text-center text-[12px]" style={{ color: MUTED }}>
                {onglet === "notes"
                  ? "Aucun produit n'a encore assez d'avis pour être classé."
                  : "Aucun produit à afficher."}
              </p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {onglet_actif.data.map(p => (
                  <ProductCardRated key={p.id} p={p} shop={nomBoutique[p.vendor_id]} />
                ))}
              </div>
            )}
          </section>

          {/* Colonne droite : services et mieux notés */}
          <aside className="hidden xl:block space-y-5 self-start">
            <div className="bg-white rounded-2xl border p-4 space-y-3" style={{ borderColor: LINE }}>
              {[
                { i: "fa-truck-fast",    t: "Livraison Buyticle", s: "Suivie, avec code de remise" },
                { i: "fa-shield-halved", t: "Paiement protégé",   s: "L'argent est bloqué 48 h" },
                { i: "fa-rotate-left",   t: "Retour possible",    s: "48 h après la livraison" },
                { i: "fa-circle-check",  t: "Avis vérifiés",      s: "Déposés après réception" },
              ].map(x => (
                <div key={x.t} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#FFF4D6", color: "#8A6100" }}>
                    <i className={`fa-solid ${x.i} text-[13px]`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold leading-tight" style={{ color: INK }}>{x.t}</p>
                    <p className="text-[10.5px]" style={{ color: MUTED }}>{x.s}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: LINE }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: LINE }}>
                <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: INK }}>Mieux notés</p>
                <span className="h-0.5 w-6 rounded-full" style={{ background: ACCENT }} />
              </div>
              <div className="px-4 divide-y" style={{ borderColor: "#F0F2F2" }}>
                {mieuxNotes.slice(0, 5).map(p => <ProductRow key={p.id} p={p} />)}
                {mieuxNotes.length === 0 && (
                  <p className="py-6 text-[11px] text-center" style={{ color: MUTED }}>
                    Pas encore assez d'avis.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* ══ TOP RAYONS ══════════════════════════════════════════════════════ */}
        {categories.length > 0 && (
          <section>
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <h2 className="text-[18px] font-black leading-none" style={{ color: INK }}>Top rayons</h2>
                <p className="text-[12px] mt-1" style={{ color: MUTED }}>Chaque rayon avec ce qu'on y trouve, et combien de boutiques le tiennent.</p>
              </div>
              <div className="h-1 w-16 rounded-full flex-shrink-0" style={{ background: ACCENT }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {categories.slice(0, 4).map(c => (
                <div key={c.name} className="bg-white rounded-2xl border p-4 flex gap-3" style={{ borderColor: LINE }}>
                  <div className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: "#F7F8F8" }}>
                    {c.produits[0]?.img
                      ? <img src={c.produits[0].img} alt="" loading="lazy" className="w-full h-full object-contain p-1.5" />
                      : <i className="fa-solid fa-tag" style={{ color: "#D5D9D9" }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-[13px] truncate" style={{ color: INK }}>{c.name}</p>
                    <p className="text-[10px] mb-1.5" style={{ color: MUTED }}>
                      {c.nb} produits · {c.nbShops} boutique{c.nbShops > 1 ? "s" : ""}
                    </p>
                    <ul className="space-y-0.5">
                      {c.produits.slice(0, 3).map(p => (
                        <li key={p.id}>
                          <Link to={`/product/${p.id}`} className="text-[11px] hover:underline block truncate" style={{ color: MUTED }}>
                            <i className="fa-solid fa-chevron-right text-[7px] mr-1.5" style={{ color: ACCENT }} />{p.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => { setCat(c.name); versGrille(); }}
                      className="text-[11px] font-bold mt-1.5 hover:underline" style={{ color: INK }}>
                      Voir les boutiques →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ══ TOUTES LES BOUTIQUES ════════════════════════════════════════════ */}
        <section ref={grilleRef} className="scroll-mt-4">
          <div className="bg-white rounded-2xl border p-4 sm:p-5 mb-4" style={{ borderColor: LINE }}>
            <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
              <div>
                <h2 className="text-[22px] font-black leading-none tracking-tight" style={{ color: INK }}>
                  {cat === "Toutes" ? "Toutes les boutiques" : `Boutiques · ${cat}`}
                </h2>
                <p className="text-[12px] mt-1.5" style={{ color: MUTED }}>
                  {loading ? "Chargement…" : `${filtered.length} boutique${filtered.length > 1 ? "s" : ""} en ligne`}
                  {cat !== "Toutes" && (
                    <button onClick={() => setCat("Toutes")} className="ml-2 font-bold hover:underline" style={{ color: INK }}>
                      · tout afficher
                    </button>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: MUTED }} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Une boutique, un produit…"
                    className="w-56 rounded-xl pl-9 pr-3 py-2.5 text-[12px] outline-none border focus:border-gray-900"
                    style={{ borderColor: LINE }} />
                </div>
                <select value={cat} onChange={e => setCat(e.target.value)}
                  className="lg:hidden bg-white border rounded-xl px-3 py-2.5 text-[12px] font-semibold outline-none cursor-pointer"
                  style={{ borderColor: LINE, color: INK }}>
                  <option value="Toutes">Tous les rayons</option>
                  {categories.map(c => <option key={c.name} value={c.name}>{c.name} ({c.nb})</option>)}
                </select>
                <select value={sort} onChange={e => setSort(e.target.value)}
                  className="bg-white border rounded-xl px-3 py-2.5 text-[12px] font-semibold outline-none cursor-pointer"
                  style={{ borderColor: LINE, color: INK }}>
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => <Skeleton key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <i className="fa-solid fa-store-slash text-4xl mb-3 block" style={{ color: "#E3E6E6" }} />
                <p className="font-bold text-[14px]" style={{ color: INK }}>Aucune boutique ne correspond</p>
                <p className="text-[12px] mt-1" style={{ color: MUTED }}>Change de rayon ou de recherche.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(v => (
                  <BoutiqueCard key={v.id} v={v} rank={rangs[v.id]}
                    onRate={setRatingTarget} onVisit={visit} userRated={!!userRatings[v.id]} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ══ CE QUE DISENT LES CLIENTS ═══════════════════════════════════════ */}
        {/* Un visiteur qui ne connaît aucune de ces enseignes ne se décide pas
            sur un score : il se décide sur ce qu'un autre client a écrit. */}
        {temoignages.length > 0 && (
          <section>
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <h2 className="text-[18px] font-black leading-none" style={{ color: INK }}>Ce que disent les clients</h2>
                <p className="text-[12px] mt-1" style={{ color: MUTED }}>
                  Des avis déposés après réception de la commande — jamais avant.
                </p>
              </div>
              <div className="h-1 w-16 rounded-full flex-shrink-0" style={{ background: ACCENT }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {temoignages.slice(0, 3).map((a, i) => (
                <AvisCard key={i} a={a} shop={nomBoutique[a.vendor_id]} />
              ))}
            </div>
          </section>
        )}

        {/* ══ LE RAYON, PRODUIT PAR PRODUIT ═══════════════════════════════════ */}
        {/* Filtrer par rayon doit montrer le rayon, pas seulement qui le tient. */}
        {cat !== "Toutes" && (() => {
          const duRayon = products.filter(p => p.type === cat).slice(0, 12);
          if (!duRayon.length) return null;
          return (
            <section className="bg-white rounded-2xl border p-4 sm:p-5" style={{ borderColor: LINE }}>
              <div className="flex items-end justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-[18px] font-black leading-none" style={{ color: INK }}>Dans le rayon {cat}</h2>
                  <p className="text-[12px] mt-1" style={{ color: MUTED }}>Ce que les boutiques ci-dessus proposent.</p>
                </div>
                <div className="h-1 w-16 rounded-full flex-shrink-0" style={{ background: ACCENT }} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {duRayon.map(p => <ProductCardRated key={p.id} p={avecNote(p)} shop={nomBoutique[p.vendor_id]} />)}
              </div>
            </section>
          );
        })()}

        {/* ══ APPEL VENDEUR ═══════════════════════════════════════════════════ */}
        <section className="rounded-2xl p-7 sm:p-10 text-center" style={{ background: NAVY }}>
          <h3 className="text-white font-black text-[24px] sm:text-[28px] tracking-tight leading-tight">
            Ta boutique n'est pas encore là ?
          </h3>
          <p className="text-[13px] mt-2 max-w-md mx-auto" style={{ color: "#ADBAC7" }}>
            Ouvre-la en quelques minutes, mets tes produits en vitrine, et vends sans commission.
          </p>
          <Link to="/register"
            className="inline-block mt-5 font-black text-[12px] uppercase tracking-widest px-7 py-3.5 rounded-xl"
            style={{ background: ACCENT, color: INK }}>
            Ouvrir ma boutique
          </Link>
        </section>

        {!user && (
          <div className="bg-white rounded-2xl border p-4 flex items-center gap-4 flex-wrap" style={{ borderColor: LINE }}>
            <i className="fa-solid fa-star text-xl flex-shrink-0" style={{ color: ACCENT }} />
            <div className="flex-1 min-w-[220px]">
              <p className="font-bold text-[13px]" style={{ color: INK }}>Note les boutiques, influence le classement</p>
              <p className="text-[12px]" style={{ color: MUTED }}>Connecte-toi pour laisser une note visible par toute la communauté.</p>
            </div>
            <Link to="/login" className="text-white text-[12px] font-bold px-5 py-2.5 rounded-xl" style={{ background: INK }}>
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
        @keyframes modalUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .animate-modalUp { animation: modalUp .3s cubic-bezier(.2,0,0,1) both; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default BoutiquesPage;
