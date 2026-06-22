import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// ─── CONFIG TIERS ─────────────────────────────────────────────────────────────
const TIERS = {
  bronze:   { key:"bronze",   label:"Bronze",  pts:0,    next:500,   icon:"fa-medal",  hex:"#c97c4a", light:"bg-orange-50",   ring:"ring-orange-200",   badge:"bg-orange-100 text-orange-700",   bar:"bg-orange-400"   },
  silver:   { key:"silver",   label:"Argent",  pts:500,  next:2000,  icon:"fa-medal",  hex:"#8b9ab0", light:"bg-slate-50",    ring:"ring-slate-200",    badge:"bg-slate-100 text-slate-600",     bar:"bg-slate-400"    },
  gold:     { key:"gold",     label:"Or",      pts:2000, next:5000,  icon:"fa-crown",  hex:"#d4a017", light:"bg-yellow-50",   ring:"ring-yellow-200",   badge:"bg-yellow-100 text-yellow-700",   bar:"bg-yellow-400"   },
  platinum: { key:"platinum", label:"Platine", pts:5000, next:null,  icon:"fa-gem",    hex:"#00d97e", light:"bg-emerald-50",  ring:"ring-emerald-200",  badge:"bg-emerald-100 text-emerald-700", bar:"bg-emerald-400"  },
};
const getTier = (p) => p >= 5000 ? "platinum" : p >= 2000 ? "gold" : p >= 500 ? "silver" : "bronze";

// ─── UTILITAIRE SYNC POINTS ──────────────────────────────────────────────────
/**
 * Synchronise les commandes livrées → loyalty_transactions → loyalty_points
 * Retourne les points TOTAUX à jour.
 */
const syncAndGetPoints = async (userId) => {
  // 1. Commandes livrées
  const { data: delivered } = await supabase
    .from("orders")
    .select("id, total_amount")
    .eq("user_id", userId)
    .eq("status", "delivered");

  if (delivered?.length) {
    // 2. Transactions d'achat déjà enregistrées
    const { data: existingTxs } = await supabase
      .from("loyalty_transactions")
      .select("reference_id")
      .eq("user_id", userId)
      .eq("type", "purchase");

    const existingRefs = new Set((existingTxs || []).map((t) => t.reference_id));
    const newTxs = [];

    for (const order of delivered) {
      if (!existingRefs.has(order.id)) {
        const pts = Math.floor(Number(order.total_amount || 0) / 100);
        if (pts > 0) {
          newTxs.push({
            user_id:      userId,
            type:         "purchase",
            points:       pts,
            reference_id: order.id,
            description:  `Achat #${order.id.slice(-8).toUpperCase()}`,
          });
        }
      }
    }

    if (newTxs.length > 0) {
      await supabase.from("loyalty_transactions").insert(newTxs);
    }
  }

  // 3. Recalculer le total depuis toutes les transactions
  const { data: allTxs } = await supabase
    .from("loyalty_transactions")
    .select("points")
    .eq("user_id", userId);

  const total = Math.max(0, (allTxs || []).reduce((sum, t) => sum + (t.points || 0), 0));

  // 4. Mettre à jour loyalty_points dans profiles
  await supabase
    .from("profiles")
    .update({ loyalty_points: total })
    .eq("id", userId);

  return total;
};

// ─── COMMENT GAGNER ───────────────────────────────────────────────────────────
const EARN_ACTIONS = [
  { icon:"fa-bag-shopping",   label:"Chaque achat",          pts:"+1 pt / 100 F",  desc:"Sur tous vos achats validés",                color:"text-emerald-600" },
  { icon:"fa-star",           label:"Laisser un avis",        pts:"+50 pts",        desc:"Après réception de votre commande",           color:"text-yellow-500"  },
  { icon:"fa-user-plus",      label:"Parrainer un ami",       pts:"+200 pts",       desc:"Quand votre filleul passe sa 1ʳᵉ commande",   color:"text-blue-500"    },
  { icon:"fa-share-nodes",    label:"Partager un produit",    pts:"+10 pts",        desc:"Via WhatsApp, Instagram ou TikTok",           color:"text-pink-500"    },
  { icon:"fa-calendar-check", label:"Connexion quotidienne",  pts:"+5 pts/jour",    desc:"Revenez chaque jour sur l'appli",             color:"text-purple-500"  },
  { icon:"fa-gift",           label:"Anniversaire",           pts:"+100 pts",       desc:"Cadeau automatique le jour J",                color:"text-red-500"     },
  { icon:"fa-pen-to-square",  label:"Compléter son profil",   pts:"+30 pts",        desc:"Photo, bio, réseaux — profil 100%",           color:"text-cyan-500"    },
  { icon:"fa-crown",          label:"Atteindre un palier",    pts:"+500 pts",       desc:"Bonus à chaque nouveau niveau",               color:"text-amber-500"   },
];

// ─── CATALOGUE RÉCOMPENSES ────────────────────────────────────────────────────
const REWARDS_CATALOG = [
  { id:"r1", icon:"fa-truck-fast",         label:"Livraison offerte",         pts:300,  desc:"1 livraison gratuite à Douala",              available:true  },
  { id:"r2", icon:"fa-percent",            label:"−5% sur votre commande",    pts:500,  desc:"Applicable sur tout le store",               available:true  },
  { id:"r3", icon:"fa-tag",               label:"−10% sur votre commande",   pts:900,  desc:"Cumulable avec le prix membre",              available:true  },
  { id:"r4", icon:"fa-bolt",              label:"Accès Flash Drop en avance", pts:150, desc:"24h avant le grand public",                  available:true  },
  { id:"r5", icon:"fa-box-open",          label:"Produit surprise",          pts:1200, desc:"Sélectionné selon vos catégories favorites", available:false },
  { id:"r6", icon:"fa-crown",             label:"Upgrade membre 1 mois",     pts:2000, desc:"Niveau supérieur pendant 30 jours",          available:false },
  { id:"r7", icon:"fa-headphones",        label:"Écoute prioritaire",        pts:400,  desc:"Accès early aux nouvelles sorties Audio Lab", available:true  },
  { id:"r8", icon:"fa-envelope-open-text",label:"Bon d'achat 2 000 F",       pts:2500, desc:"Valable 60 jours sur le store",              available:false },
];

// ─── AVANTAGES PAR TIER ───────────────────────────────────────────────────────
const TIER_BENEFITS = [
  { label:"Prix membre −20%",           bronze:false, silver:true,  gold:true,  platinum:true  },
  { label:"Livraison prioritaire",       bronze:false, silver:false, gold:true,  platinum:true  },
  { label:"Accès Flash Drop 24h avant",  bronze:false, silver:true,  gold:true,  platinum:true  },
  { label:"Support client dédié",        bronze:false, silver:false, gold:false, platinum:true  },
  { label:"Récompenses x2 (bonus)",      bronze:false, silver:false, gold:true,  platinum:true  },
  { label:"Invitation ventes privées",   bronze:false, silver:false, gold:false, platinum:true  },
  { label:"Retours gratuits",            bronze:false, silver:false, gold:true,  platinum:true  },
  { label:"Badge profil exclusif",       bronze:false, silver:true,  gold:true,  platinum:true  },
];

// ─── COMPOSANTS UTILITAIRES ───────────────────────────────────────────────────
const Check = ({ ok }) => ok
  ? <i className="fa-solid fa-check text-emerald-500 text-xs"></i>
  : <i className="fa-solid fa-minus text-zinc-300 dark:text-zinc-600 text-xs"></i>;

const SectionLabel = ({ children }) => (
  <p className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-400 dark:text-zinc-500 mb-4">{children}</p>
);

const SectionTitle = ({ children }) => (
  <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tight text-zinc-900 dark:text-white leading-tight mb-2">
    {children}
  </h2>
);

// ─── HERO FIDÉLITÉ ────────────────────────────────────────────────────────────
const RewardsHero = ({ profile, loading, pts }) => {
  const tierKey = getTier(pts);
  const tier    = TIERS[tierKey];
  const nextTier= Object.values(TIERS).find((t) => t.pts > pts);
  const pct     = nextTier
    ? Math.min(((pts - tier.pts) / (nextTier.pts - tier.pts)) * 100, 100)
    : 100;
  const toNext  = nextTier ? nextTier.pts - pts : 0;

  if (loading) return <div className="bg-zinc-100 dark:bg-zinc-900 rounded-3xl h-56 animate-pulse" />;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 shadow-sm">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full opacity-[0.04]"
          style={{ background: `radial-gradient(circle, ${tier.hex}, transparent)` }} />
        <div className="absolute right-8 bottom-8 text-[9rem] font-black italic opacity-[0.03] text-zinc-900 dark:text-white select-none leading-none">
          {tier.label.toUpperCase()}
        </div>
      </div>

      <div className="relative z-10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">

          {/* Tier + nom */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center ${tier.light} dark:bg-white/5 ring-2 ${tier.ring} dark:ring-white/10`}>
              <i className={`fa-solid ${tier.icon} text-2xl md:text-3xl`} style={{ color: tier.hex }}></i>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-0.5">Statut actuel</p>
              <p className="text-2xl md:text-3xl font-black italic uppercase tracking-tight" style={{ color: tier.hex }}>
                {tier.label}
              </p>
              <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                {profile?.full_name ? `${profile.full_name} · ` : ""}Membre OFS Elite
              </p>
            </div>
          </div>

          <div className="hidden md:block w-px h-16 bg-zinc-100 dark:bg-white/5 flex-shrink-0" />

          {/* Points + progression */}
          <div className="flex-grow">
            <div className="flex items-end gap-2 mb-2">
              <span className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white leading-none">
                {pts.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-zinc-400 mb-1 pb-0.5">pts</span>
            </div>

            {nextTier ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-zinc-400">
                    Progression vers <span className="font-black" style={{ color: nextTier.hex }}>{nextTier.label}</span>
                  </p>
                  <p className="text-[9px] font-black text-zinc-500">
                    {toNext.toLocaleString()} pts restants
                  </p>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${tier.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[8px] font-black text-zinc-400">{tier.pts.toLocaleString()} pts</span>
                  <span className="text-[8px] font-black text-zinc-400">{nextTier.pts.toLocaleString()} pts</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 mt-2">
                <i className="fa-solid fa-gem text-emerald-500 text-sm"></i>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Niveau maximum atteint
                </p>
              </div>
            )}
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <Link to="/store"
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-white transition-all px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              <i className="fa-solid fa-bag-shopping text-xs"></i>
              <span>Gagner des pts</span>
            </Link>
            <Link to="/profile?tab=referral"
              className="inline-flex items-center gap-2 border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:border-emerald-300 hover:text-emerald-600 dark:hover:border-emerald-500/40 dark:hover:text-emerald-400 transition-all px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              <i className="fa-solid fa-user-plus text-xs"></i>
              <span>Parrainer</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── COMMENT GAGNER ───────────────────────────────────────────────────────────
const HowToEarn = () => (
  <section>
    <SectionLabel>Programme de fidélité</SectionLabel>
    <SectionTitle>Gagnez des points<br />à chaque action.</SectionTitle>
    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed mb-8 max-w-lg">
      Chaque interaction avec OneFreestyle Elite vous rapporte des points. Accumulez-les et échangez-les contre des récompenses exclusives.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {EARN_ACTIONS.map((a) => (
        <div key={a.label}
          className="group bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl p-5 hover:border-zinc-300 dark:hover:border-white/15 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <i className={`fa-solid ${a.icon} ${a.color} text-sm`}></i>
            </div>
            <span className="inline-flex items-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
              {a.pts}
            </span>
          </div>
          <p className="text-sm font-black text-zinc-800 dark:text-zinc-100 leading-tight mb-1 uppercase tracking-tight">{a.label}</p>
          <p className="text-[10px] font-medium text-zinc-400 leading-relaxed">{a.desc}</p>
        </div>
      ))}
    </div>
  </section>
);

// ─── CATALOGUE RÉCOMPENSES ────────────────────────────────────────────────────
const RewardsCatalog = ({ userPts, loading, userId }) => {
  const [redeeming, setRedeeming] = useState(null);
  const [toasted,   setToasted]   = useState(null);

  const handleRedeem = async (reward) => {
    if (!reward.available || userPts < reward.pts) return;
    setRedeeming(reward.id);

    // Créer la transaction de rachat
    await supabase.from("loyalty_transactions").insert({
      user_id:     userId,
      type:        "redeem",
      points:      -reward.pts,                  // points négatifs = dépense
      description: `Échange : ${reward.label}`,
    });

    // Mettre à jour le total de points
    await supabase
      .from("profiles")
      .update({ loyalty_points: Math.max(0, userPts - reward.pts) })
      .eq("id", userId);

    setRedeeming(null);
    setToasted(reward.id);
    setTimeout(() => setToasted(null), 3500);
  };

  return (
    <section>
      <SectionLabel>Catalogue</SectionLabel>
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <SectionTitle>Échangez vos<br />points.</SectionTitle>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-lg">
            Utilisez vos points pour obtenir des avantages concrets : réductions, livraisons offertes, accès exclusifs et plus.
          </p>
        </div>
        <div className="flex-shrink-0 hidden md:block text-right">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Votre solde</p>
          <p className="text-3xl font-black text-zinc-900 dark:text-white">
            {loading ? "—" : userPts.toLocaleString()}
            <span className="text-sm font-bold text-zinc-400 ml-1">pts</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {REWARDS_CATALOG.map((r) => {
          const canAfford = userPts >= r.pts;
          const locked    = !r.available;
          const isDone    = toasted === r.id;

          return (
            <div
              key={r.id}
              className={`relative rounded-2xl border bg-white dark:bg-zinc-900 flex flex-col transition-all duration-200
                ${locked    ? "border-zinc-100 dark:border-white/5 opacity-60"
                : canAfford ? "border-zinc-200 dark:border-white/10 hover:border-emerald-300 dark:hover:border-emerald-500/30 hover:shadow-md"
                :              "border-zinc-100 dark:border-white/5"}`}
            >
              {isDone && (
                <div className="absolute inset-0 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-300 dark:border-emerald-500/40 flex flex-col items-center justify-center z-10">
                  <i className="fa-solid fa-circle-check text-emerald-500 text-3xl mb-2"></i>
                  <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase">Réclamé !</p>
                  <p className="text-[9px] text-emerald-600/70 mt-1">Consultez vos notifications</p>
                </div>
              )}

              <div className="p-5 flex-grow">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${locked ? "bg-zinc-100 dark:bg-zinc-800" : "bg-emerald-50 dark:bg-emerald-500/10"}`}>
                    <i className={`fa-solid ${r.icon} text-sm ${locked ? "text-zinc-400" : "text-emerald-600 dark:text-emerald-400"}`}></i>
                  </div>
                  {locked && (
                    <span className="text-[8px] font-black uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">
                      Bientôt
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-tight leading-snug mb-1.5">{r.label}</p>
                <p className="text-[9px] font-medium text-zinc-400 leading-relaxed">{r.desc}</p>
              </div>

              <div className="border-t border-zinc-50 dark:border-white/5 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-coins text-amber-400 text-[10px]"></i>
                  <span className="text-sm font-black text-zinc-700 dark:text-zinc-200">
                    {r.pts.toLocaleString()}
                    <span className="text-[9px] font-bold text-zinc-400 ml-1">pts</span>
                  </span>
                </div>
                {!locked && (
                  <button
                    onClick={() => handleRedeem(r)}
                    disabled={!canAfford || !!redeeming}
                    className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${
                      canAfford
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                    }`}
                  >
                    {redeeming === r.id
                      ? <i className="fa-solid fa-spinner fa-spin text-[9px]"></i>
                      : canAfford
                        ? "Échanger"
                        : `−${(r.pts - userPts).toLocaleString()} pts`
                    }
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ─── TABLEAU TIERS ────────────────────────────────────────────────────────────
const TiersTable = ({ userPts }) => {
  const currentTierKey = getTier(userPts);
  return (
    <section>
      <SectionLabel>Niveaux</SectionLabel>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <SectionTitle>Quatre niveaux,<br />quatre univers.</SectionTitle>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-lg">
            Plus vous êtes actif, plus vos avantages sont exclusifs.
          </p>
        </div>
      </div>

      {/* Cartes mobile */}
      <div className="grid grid-cols-2 md:hidden gap-3 mb-6">
        {Object.values(TIERS).map((t) => (
          <div
            key={t.key}
            className={`rounded-2xl p-4 border-2 transition-all ${
              currentTierKey === t.key
                ? `${t.ring} ${t.light} dark:bg-white/5`
                : "border-zinc-100 dark:border-white/5 bg-white dark:bg-zinc-900"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <i className={`fa-solid ${t.icon} text-sm`} style={{ color: t.hex }}></i>
              <span className="text-xs font-black uppercase" style={{ color: t.hex }}>{t.label}</span>
              {currentTierKey === t.key && (
                <span className="ml-auto text-[7px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full uppercase">Vous</span>
              )}
            </div>
            <p className="text-[9px] font-bold text-zinc-500">{t.pts.toLocaleString()} pts</p>
          </div>
        ))}
      </div>

      {/* Tableau desktop */}
      <div className="hidden md:block rounded-2xl border border-zinc-100 dark:border-white/5 overflow-hidden bg-white dark:bg-zinc-900">
        <div className="grid grid-cols-5 border-b border-zinc-100 dark:border-white/5">
          <div className="p-4 col-span-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Avantage</span>
          </div>
          {Object.values(TIERS).map((t) => (
            <div
              key={t.key}
              className={`p-4 text-center border-l border-zinc-100 dark:border-white/5 ${currentTierKey === t.key ? `${t.light} dark:bg-white/3` : ""}`}
            >
              <i className={`fa-solid ${t.icon} text-sm mb-1 block`} style={{ color: t.hex }}></i>
              <p className="text-xs font-black uppercase" style={{ color: t.hex }}>{t.label}</p>
              <p className="text-[8px] font-bold text-zinc-400 mt-0.5">{t.pts >= 1000 ? (t.pts / 1000) + "K" : t.pts} pts</p>
              {currentTierKey === t.key && (
                <span className="inline-block mt-1 text-[7px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full uppercase">
                  Votre niveau
                </span>
              )}
            </div>
          ))}
        </div>
        {TIER_BENEFITS.map((b, i) => (
          <div
            key={b.label}
            className={`grid grid-cols-5 ${i < TIER_BENEFITS.length - 1 ? "border-b border-zinc-50 dark:border-white/3" : ""}`}
          >
            <div className="p-4 flex items-center">
              <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{b.label}</span>
            </div>
            {["bronze","silver","gold","platinum"].map((k) => (
              <div
                key={k}
                className={`p-4 flex items-center justify-center border-l border-zinc-50 dark:border-white/3 ${currentTierKey === k ? `${TIERS[k].light} dark:bg-white/2` : ""}`}
              >
                <Check ok={b[k]} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

// ─── HISTORIQUE DES POINTS ────────────────────────────────────────────────────
const TX_TYPES = {
  purchase:   { label:"Achat",          icon:"fa-bag-shopping",   color:"text-emerald-600" },
  review:     { label:"Avis",           icon:"fa-star",           color:"text-yellow-500"  },
  referral:   { label:"Parrainage",     icon:"fa-user-plus",      color:"text-blue-500"    },
  share:      { label:"Partage",        icon:"fa-share-nodes",    color:"text-pink-500"    },
  bonus:      { label:"Bonus",          icon:"fa-gift",           color:"text-red-500"     },
  daily:      { label:"Connexion",      icon:"fa-calendar-check", color:"text-purple-500"  },
  redeem:     { label:"Échange",        icon:"fa-coins",          color:"text-amber-500"   },
  tier_bonus: { label:"Palier atteint", icon:"fa-crown",          color:"text-amber-500"   },
};

const PointsHistory = ({ userId, loading: parentLoading, currentPts }) => {
  const [txs,     setTxs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("loyalty_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => { setTxs(data || []); setLoading(false); });
  }, [userId]);

  const displayed = showAll ? txs : txs.slice(0, 5);

  // Calcul du total depuis les transactions (source de vérité)
  const totalFromTxs = txs.reduce((sum, t) => sum + (t.points || 0), 0);
  const earnedTxs    = txs.filter((t) => t.points > 0);
  const spentTxs     = txs.filter((t) => t.points < 0);

  return (
    <section>
      <SectionLabel>Activité</SectionLabel>
      <SectionTitle>Historique<br />des points.</SectionTitle>

      {/* Résumé */}
      {!loading && txs.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label:"Total gagné",   value:`+${earnedTxs.reduce((s, t) => s + t.points, 0).toLocaleString()}`, color:"text-emerald-600 dark:text-emerald-400", bg:"bg-emerald-50 dark:bg-emerald-500/8" },
            { label:"Total dépensé", value:`${spentTxs.reduce((s, t) => s + t.points, 0).toLocaleString()}`,   color:"text-red-500", bg:"bg-red-50 dark:bg-red-500/8"           },
            { label:"Solde actuel",  value:(currentPts || totalFromTxs).toLocaleString(),                      color:"text-zinc-900 dark:text-white", bg:"bg-zinc-100 dark:bg-zinc-800" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {(loading || parentLoading) ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-zinc-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : txs.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl p-10 text-center">
          <i className="fa-solid fa-coins text-zinc-200 dark:text-zinc-700 text-4xl mb-3 block"></i>
          <p className="text-sm font-black text-zinc-400 uppercase tracking-wider">Aucune transaction pour l'instant</p>
          <p className="text-xs font-medium text-zinc-400 mt-1">Passez votre première commande pour commencer</p>
          <Link to="/store"
            className="inline-flex items-center gap-2 mt-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-white transition-all"
          >
            <i className="fa-solid fa-bag-shopping text-xs"></i> Explorer le store
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl overflow-hidden divide-y divide-zinc-50 dark:divide-white/3">
            {displayed.map((tx) => {
              const type   = TX_TYPES[tx.type] || TX_TYPES.bonus;
              const isEarn = tx.points > 0;
              const date   = new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
              return (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-white/2 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <i className={`fa-solid ${type.icon} ${type.color} text-sm`}></i>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{tx.description || type.label}</p>
                    <p className="text-[9px] font-medium text-zinc-400">{date}</p>
                  </div>
                  <span className={`text-sm font-black flex-shrink-0 ${isEarn ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                    {isEarn ? "+" : ""}{tx.points.toLocaleString()} pts
                  </span>
                </div>
              );
            })}
          </div>
          {txs.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-3 w-full text-center text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 py-3 border border-zinc-100 dark:border-white/5 rounded-xl transition-colors"
            >
              {showAll ? "Voir moins" : `Voir tout (${txs.length} transactions)`}
            </button>
          )}
        </>
      )}
    </section>
  );
};

// ─── PARRAINAGE ───────────────────────────────────────────────────────────────
const ReferralSection = ({ profile, userId }) => {
  const [copied,       setCopied]       = useState(false);
  const [commissions,  setCommissions]  = useState([]);
  const [buyerProfiles,setBuyerProfiles]= useState({});
  const code   = profile?.referral_code || "—";
  const refUrl = `${window.location.origin}/ref/${code}`;

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("affiliate_commissions")
      .select("id, created_at, buyer_user_id")
      .eq("referrer_user_id", userId)
      .order("created_at", { ascending: false })
      .then(async ({ data: comms }) => {
        setCommissions(comms || []);
        const buyerIds = [...new Set((comms || []).map(c => c.buyer_user_id).filter(Boolean))];
        if (buyerIds.length) {
          const { data: profs } = await supabase
            .from("profiles").select("id, full_name, avatar_url").in("id", buyerIds);
          const map = {};
          (profs || []).forEach(p => { map[p.id] = p; });
          setBuyerProfiles(map);
        }
      });
  }, [userId]);

  const uniqueBuyers = [...new Set(commissions.map(c => c.buyer_user_id).filter(Boolean))];
  const filleulCount = uniqueBuyers.length;

  const handleCopy = (val) => {
    navigator.clipboard.writeText(val).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const PALIERS = [
    { n: 1,  pts: 200,  label: "1ᵉʳ ami"  },
    { n: 5,  pts: 1500, label: "5 amis"   },
    { n: 10, pts: 4000, label: "10 amis"  },
  ];

  return (
    <section>
      <SectionLabel>Parrainage</SectionLabel>
      <SectionTitle>Invitez vos proches,<br />gagnez plus.</SectionTitle>
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed mb-8 max-w-lg">
        Pour chaque ami qui crée un compte et passe sa première commande, vous gagnez{" "}
        <strong className="text-zinc-700 dark:text-zinc-300">200 points</strong> et lui offrez un avantage de bienvenue.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Partage */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl p-6 space-y-4">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Votre code</p>

          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4">
            <span className="flex-grow font-black text-xl tracking-[0.2em] text-zinc-900 dark:text-white font-mono">
              {code}
            </span>
            <button
              onClick={() => handleCopy(code)}
              className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"} text-xs`}></i>
              {copied ? "Copié" : "Code"}
            </button>
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Lien de parrainage</p>
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3">
              <p className="flex-grow text-[10px] font-medium text-zinc-500 truncate">{refUrl}</p>
              <button
                onClick={() => handleCopy(refUrl)}
                className="flex-shrink-0 text-[9px] font-black uppercase text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <i className={`fa-solid ${copied ? "fa-check" : "fa-link"} text-xs`}></i>
              </button>
            </div>
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Partager sur</p>
            <div className="flex gap-2">
              {[
                { icon: "fa-brands fa-whatsapp", label: "WhatsApp",  href: `https://wa.me/?text=Rejoins%20OFS%20Elite%20avec%20mon%20code%20${code}%20%3A%20${encodeURIComponent(refUrl)}`, color: "hover:text-green-500" },
                { icon: "fa-brands fa-instagram",label: "Instagram",  href: "#", color: "hover:text-pink-500"                                           },
                { icon: "fa-brands fa-tiktok",   label: "TikTok",    href: "#", color: "hover:text-zinc-900 dark:hover:text-white"                      },
              ].map((n) => (
                <a
                  key={n.label} href={n.href} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center gap-2 flex-1 justify-center py-2.5 rounded-xl border border-zinc-100 dark:border-white/8 text-zinc-400 ${n.color} hover:border-zinc-200 dark:hover:border-white/15 transition-all text-[10px] font-black uppercase tracking-widest`}
                >
                  <i className={`${n.icon} text-sm`}></i>
                  <span className="hidden sm:inline">{n.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Paliers + filleuls */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4">Paliers de parrainage</p>
            <div className="space-y-3">
              {PALIERS.map((p) => {
                const done = filleulCount >= p.n;
                return (
                  <div
                    key={p.n}
                    className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                      done ? "bg-emerald-50 dark:bg-emerald-500/8 border border-emerald-100 dark:border-emerald-500/20" : "bg-zinc-50 dark:bg-zinc-800"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${done ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-zinc-100 dark:bg-zinc-700"}`}>
                      <i className={`fa-solid fa-user-group text-xs ${done ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}></i>
                    </div>
                    <div className="flex-grow">
                      <p className={`text-[11px] font-black uppercase ${done ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-700 dark:text-zinc-300"}`}>{p.label}</p>
                      <p className="text-[9px] font-bold text-zinc-400">+{p.pts.toLocaleString()} pts de bonus</p>
                    </div>
                    {done
                      ? <i className="fa-solid fa-circle-check text-emerald-500 text-sm flex-shrink-0"></i>
                      : <span className="text-[8px] font-black text-zinc-400">{p.n - filleulCount} restants</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Mes filleuls</p>
              <span className="text-[10px] font-black text-zinc-500">{filleulCount} inscrits</span>
            </div>
            {filleulCount === 0 ? (
              <p className="text-[10px] font-medium text-zinc-400 text-center py-4">
                Aucun filleul pour l'instant — partagez votre lien !
              </p>
            ) : (
              <div className="space-y-2">
                {uniqueBuyers.slice(0, 5).map((buyerId) => {
                  const prof = buyerProfiles[buyerId];
                  return (
                    <div key={buyerId} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {prof?.avatar_url
                          ? <img src={prof.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <span className="text-xs font-black text-zinc-500">{(prof?.full_name || "?")[0].toUpperCase()}</span>
                        }
                      </div>
                      <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 flex-grow">{prof?.full_name || "Membre OFS"}</p>
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">+200 pts</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q:"Mes points expirent-ils ?",               a:"Non. Vos points n'expirent jamais tant que votre compte est actif sur OneFreestyle Elite."             },
  { q:"Comment voir mon historique complet ?",   a:"Dans la section Historique de cette page, ou dans votre profil > onglet Récompenses."                 },
  { q:"Puis-je cumuler récompenses et promos ?", a:"Oui. Les récompenses sont cumulables avec le prix membre (−20%) et les bundles (−15%)."               },
  { q:"Combien de temps pour recevoir mes pts ?",a:"Les achats sont crédités automatiquement dès que la commande passe au statut Livrée."                  },
  { q:"Mon parrainage n'est pas comptabilisé ?", a:"Votre filleul doit utiliser votre code à l'inscription ET passer sa première commande validée."        },
  { q:"Comment fonctionnent les échanges ?",     a:"Cliquez Échanger dans le catalogue. Les points sont débités immédiatement et la récompense activée."   },
];

const FAQSection = () => {
  const [open, setOpen] = useState(null);
  return (
    <section>
      <SectionLabel>Questions fréquentes</SectionLabel>
      <SectionTitle>Tout ce que<br />vous devez savoir.</SectionTitle>
      <div className="mt-8 space-y-2 max-w-2xl">
        {FAQ_ITEMS.map((f, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{f.q}</span>
              <i className={`fa-solid fa-chevron-down text-zinc-400 text-xs transition-transform flex-shrink-0 ml-4 ${open === i ? "rotate-180" : ""}`}></i>
            </button>
            {open === i && (
              <div className="px-5 pb-4 border-t border-zinc-50 dark:border-white/5 pt-3">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">{f.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────
const SECTIONS = [
  { key:"overview",  label:"Aperçu",      icon:"fa-house"              },
  { key:"earn",      label:"Gagner",      icon:"fa-coins"              },
  { key:"catalog",   label:"Récompenses", icon:"fa-gift"               },
  { key:"tiers",     label:"Niveaux",     icon:"fa-crown"              },
  { key:"history",   label:"Historique",  icon:"fa-clock-rotate-left"  },
  { key:"referral",  label:"Parrainer",   icon:"fa-user-plus"          },
  { key:"faq",       label:"FAQ",         icon:"fa-circle-question"    },
];

const OFSRewardsPage = () => {
  const { user }                = useAuth();
  const navigate                = useNavigate();
  const [profile,  setProfile]  = useState(null);
  const [pts,      setPts]      = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [activeTab,setActiveTab]= useState("overview");
  const sectionRefs             = useRef({});

  useEffect(() => {
    if (!user) { navigate("/login", { state: { from: "/rewards" } }); return; }

    (async () => {
      setLoading(true);
      try {
        // 1. Charger le profil
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, loyalty_points, referral_code")
          .eq("id", user.id)
          .single();

        setProfile(profileData);

        // 2. Sync + recalcul des points depuis les commandes livrées
        const totalPts = await syncAndGetPoints(user.id);
        setPts(totalPts);
      } catch (e) {
        console.error("RewardsPage load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActiveTab(e.target.dataset.section); }),
      { rootMargin: "-30% 0px -60% 0px" }
    );
    Object.values(sectionRefs.current).forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (key) => {
    const el = sectionRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">

      {/* ── HEADER ── */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-white/5">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 md:py-10">
          <div className="flex items-center gap-3 mb-2">
            <Link to="/profile" className="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors flex items-center gap-1.5">
              <i className="fa-solid fa-chevron-left text-[8px]"></i> Profil
            </Link>
            <span className="text-zinc-200 dark:text-zinc-700">/</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Récompenses</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
                OFS <span className="text-emerald-500">Rewards</span>
              </h1>
              <p className="text-sm font-medium text-zinc-400 mt-1">Programme de fidélité OneFreestyle Elite</p>
            </div>
            {!loading && (
              <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-white/5 rounded-2xl px-5 py-3">
                <i className="fa-solid fa-coins text-amber-400 text-lg"></i>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Solde actuel</p>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white leading-tight">
                    {pts.toLocaleString()} <span className="text-sm font-bold text-zinc-400">pts</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="max-w-[1200px] mx-auto px-4 md:px-8">
          <div className="flex overflow-x-auto hide-scrollbar gap-1 pb-0">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => scrollTo(s.key)}
                className={`flex items-center gap-1.5 px-3 py-3 text-[9px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${
                  activeTab === s.key
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                <i className={`fa-solid ${s.icon} text-[10px]`}></i>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENU ── */}
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-10 space-y-16">

        <div data-section="overview" ref={(el) => (sectionRefs.current.overview = el)}>
          <RewardsHero profile={profile} loading={loading} pts={pts} />
        </div>

        <div data-section="earn" ref={(el) => (sectionRefs.current.earn = el)}>
          <HowToEarn />
        </div>

        <div data-section="catalog" ref={(el) => (sectionRefs.current.catalog = el)}>
          <RewardsCatalog userPts={pts} loading={loading} userId={user?.id} />
        </div>

        <div data-section="tiers" ref={(el) => (sectionRefs.current.tiers = el)}>
          <TiersTable userPts={pts} />
        </div>

        <div data-section="history" ref={(el) => (sectionRefs.current.history = el)}>
          <PointsHistory userId={user?.id} loading={loading} currentPts={pts} />
        </div>

        <div data-section="referral" ref={(el) => (sectionRefs.current.referral = el)}>
          <ReferralSection profile={profile} userId={user?.id} />
        </div>

        <div data-section="faq" ref={(el) => (sectionRefs.current.faq = el)}>
          <FAQSection />
        </div>
      </div>

    </div>
  );
};

export default OFSRewardsPage;