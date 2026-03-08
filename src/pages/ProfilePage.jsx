import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const TABS = [
  { key:"overview",       label:"Accueil",      icon:"fa-house"              },
  { key:"orders",         label:"Commandes",    icon:"fa-bag-shopping"       },
  { key:"wishlist",       label:"Favoris",      icon:"fa-heart"              },
  { key:"addresses",      label:"Adresses",     icon:"fa-location-dot"       },
  { key:"reviews",        label:"Avis",         icon:"fa-star"               },
  { key:"referral",       label:"Parrainage",   icon:"fa-user-plus"          },
  { key:"notifications",  label:"Notifications",icon:"fa-bell"               },
  { key:"security",       label:"Sécurité",     icon:"fa-shield-halved"      },
  { key:"settings",       label:"Mon Profil",   icon:"fa-pen-to-square"      },
];

const ORDER_STATUS = {
  pending:   { label:"En attente", color:"text-yellow-400", bg:"bg-yellow-400/10", border:"border-yellow-400/20", icon:"fa-clock"        },
  confirmed: { label:"Confirmée",  color:"text-blue-400",   bg:"bg-blue-400/10",   border:"border-blue-400/20",   icon:"fa-circle-check" },
  shipped:   { label:"Expédiée",   color:"text-purple-400", bg:"bg-purple-400/10", border:"border-purple-400/20", icon:"fa-truck"        },
  delivered: { label:"Livrée",     color:"text-primary",    bg:"bg-primary/10",    border:"border-primary/20",    icon:"fa-box-open"     },
  cancelled: { label:"Annulée",    color:"text-red-400",    bg:"bg-red-400/10",    border:"border-red-400/20",    icon:"fa-xmark"        },
};

const TIER_CONFIG = {
  bronze:   { label:"Bronze",  color:"text-orange-400", bg:"from-orange-400/20 to-orange-400/5", icon:"fa-medal", min:0,    max:500   },
  silver:   { label:"Argent",  color:"text-zinc-300",   bg:"from-zinc-300/20 to-zinc-300/5",     icon:"fa-medal", min:500,  max:2000  },
  gold:     { label:"Or",      color:"text-yellow-400", bg:"from-yellow-400/20 to-yellow-400/5", icon:"fa-crown", min:2000, max:5000  },
  platinum: { label:"Platine", color:"text-primary",    bg:"from-primary/20 to-primary/5",       icon:"fa-gem",   min:5000, max:99999 },
};
const getTier = (pts) => pts >= 5000 ? "platinum" : pts >= 2000 ? "gold" : pts >= 500 ? "silver" : "bronze";

// ─── UTILITAIRE : GÉNÉRATION CODE PARRAINAGE ──────────────────────────────────
const generateReferralCode = (userId) =>
  "OFS-" + userId.replace(/-/g, "").slice(0, 6).toUpperCase();

// ─── UTILITAIRE : SYNC POINTS DEPUIS COMMANDES ───────────────────────────────
/**
 * Compare les commandes livrées avec les transactions existantes.
 * Crée les transactions manquantes et met à jour loyalty_points.
 * Retourne le nb de nouveaux points crédités.
 */
const syncOrderPoints = async (userId, deliveredOrders) => {
  if (!deliveredOrders.length) return 0;

  // Récup des transactions déjà enregistrées pour ce user (type purchase)
  const { data: existingTxs } = await supabase
    .from("loyalty_transactions")
    .select("reference_id")
    .eq("user_id", userId)
    .eq("type", "purchase");

  const existingRefs = new Set((existingTxs || []).map((t) => t.reference_id));

  const newTxs = [];
  let newPts = 0;

  for (const order of deliveredOrders) {
    if (!existingRefs.has(order.id)) {
      const pts = Math.floor(Number(order.total_amount || 0) / 100);
      if (pts > 0) {
        newPts += pts;
        newTxs.push({
          user_id:      userId,
          type:         "purchase",
          points:       pts,
          reference_id: order.id,
          description:  `Achat #${order.id.slice(-8).toUpperCase()} — ${Number(order.total_amount).toLocaleString()} F`,
        });
      }
    }
  }

  if (!newTxs.length) return 0;

  // Insérer les nouvelles transactions
  await supabase.from("loyalty_transactions").insert(newTxs);

  // Recalculer le total depuis toutes les transactions (plus fiable que +=)
  const { data: allTxs } = await supabase
    .from("loyalty_transactions")
    .select("points")
    .eq("user_id", userId);

  const total = (allTxs || []).reduce((sum, t) => sum + (t.points || 0), 0);
  await supabase
    .from("profiles")
    .update({ loyalty_points: Math.max(0, total) })
    .eq("id", userId);

  return newPts;
};

// ─── COMPOSANTS PARTAGÉS ──────────────────────────────────────────────────────
const Avatar = ({ url, name, size = 20, onClick }) => (
  <div
    onClick={onClick}
    className={`relative rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 ${onClick ? "cursor-pointer" : ""}`}
    style={{ width: size * 4, height: size * 4 }}
  >
    {url ? (
      <img src={url} alt={name} className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full flex items-center justify-center">
        <span className="font-black text-primary" style={{ fontSize: size * 1.4 }}>
          {(name || "?")[0].toUpperCase()}
        </span>
      </div>
    )}
    {onClick && (
      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
        <i className="fa-solid fa-camera text-white text-lg"></i>
      </div>
    )}
  </div>
);

const Stat = ({ icon, value, label, color = "text-primary" }) => (
  <div className="bg-zinc-950 border border-white/5 rounded-2xl p-4 text-center hover:border-primary/20 transition-colors">
    <i className={`fa-solid ${icon} ${color} text-sm mb-2 block`}></i>
    <p className={`font-black text-xl ${color}`}>{value}</p>
    <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">{label}</p>
  </div>
);

const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles = {
    success: "bg-primary/15 border-primary/40 text-primary",
    error:   "bg-red-500/15 border-red-500/40 text-red-400",
    info:    "bg-blue-500/15 border-blue-500/40 text-blue-400",
  };
  const icons  = { success: "fa-circle-check", error: "fa-triangle-exclamation", info: "fa-circle-info" };

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 border rounded-2xl px-5 py-3.5 shadow-2xl ${styles[type]}`}>
      <i className={`fa-solid ${icons[type]} text-sm`}></i>
      <span className="font-black text-[11px] uppercase tracking-widest whitespace-nowrap">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
        <i className="fa-solid fa-xmark text-xs"></i>
      </button>
    </div>
  );
};

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
const Overview = ({ profile, orders, wishlist, reviews, setTab, loyaltyPoints }) => {
  const pts     = loyaltyPoints ?? (profile?.loyalty_points || 0);
  const tier    = getTier(pts);
  const cfg     = TIER_CONFIG[tier];
  const pct     = Math.min(((pts - cfg.min) / (cfg.max - cfg.min)) * 100, 100);
  const recent  = (orders || []).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Carte tier / points */}
      <div className={`bg-gradient-to-br ${cfg.bg} border border-white/10 rounded-3xl p-6 relative overflow-hidden`}>
        <div className="absolute -right-8 -top-8 opacity-[0.06]">
          <i className={`fa-solid ${cfg.icon} text-[10rem] ${cfg.color}`}></i>
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-1">Statut membre</p>
              <div className="flex items-center gap-2">
                <i className={`fa-solid ${cfg.icon} ${cfg.color} text-xl`}></i>
                <span className={`font-black text-2xl uppercase italic ${cfg.color}`}>{cfg.label}</span>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-black text-3xl ${cfg.color}`}>{pts.toLocaleString()}</p>
              <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">points OFS</p>
            </div>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${cfg.color.replace("text-", "bg-")}`}
              style={{ width: pct + "%" }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[8px] font-bold text-zinc-500">{pts.toLocaleString()} pts</span>
            <span className="text-[8px] font-bold text-zinc-500">
              {cfg.max < 99999 ? `${cfg.max.toLocaleString()} pts pour le niveau suivant` : "Niveau max 🎉"}
            </span>
          </div>
          <div className="mt-4 flex gap-2">
            <Link
              to="/rewards"
              className="flex items-center gap-2 bg-white/10 hover:bg-primary/20 border border-white/10 hover:border-primary/30 text-white hover:text-primary px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
            >
              <i className="fa-solid fa-gift text-xs"></i> OFS Rewards
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon="fa-bag-shopping" value={orders?.length || 0}  label="Commandes" color="text-primary"   />
        <Stat icon="fa-heart"        value={wishlist?.length || 0} label="Favoris"   color="text-red-400"  />
        <Stat icon="fa-star"         value={reviews?.length || 0}  label="Avis"      color="text-yellow-400"/>
        <Stat icon="fa-crown"        value="−20%"                  label="Réduction" color="text-yellow-300"/>
      </div>

      {/* Commandes récentes */}
      {recent.length > 0 && (
        <div className="bg-zinc-950 border border-white/5 rounded-3xl overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-white/5">
            <span className="font-black text-sm uppercase tracking-tight text-white">Commandes récentes</span>
            <button onClick={() => setTab("orders")} className="text-[9px] font-black uppercase text-primary hover:underline">
              Voir tout →
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {recent.map((o) => {
              const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
              return (
                <div key={o.id} className="flex items-center gap-4 p-4 hover:bg-white/2 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${st.bg} border ${st.border} flex-shrink-0`}>
                    <i className={`fa-solid ${st.icon} ${st.color} text-xs`}></i>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-black text-[11px] text-white truncate">#{o.id?.slice(-8).toUpperCase()}</p>
                    <p className="text-[9px] text-zinc-500 font-bold">{new Date(o.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-[11px] text-white">{Number(o.total_amount || 0).toLocaleString()} F</p>
                    <span className={`text-[8px] font-black uppercase ${st.color}`}>{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liens rapides */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: "fa-location-dot",  label: "Mes adresses",  tab: "addresses",     color: "text-orange-400", bg: "bg-orange-400/8 border-orange-400/15"   },
          { icon: "fa-user-plus",     label: "Parrainer",     tab: "referral",      color: "text-blue-400",   bg: "bg-blue-400/8 border-blue-400/15"       },
          { icon: "fa-bell",          label: "Notifications", tab: "notifications", color: "text-purple-400", bg: "bg-purple-400/8 border-purple-400/15"   },
          { icon: "fa-shield-halved", label: "Sécurité",      tab: "security",      color: "text-primary",    bg: "bg-primary/8 border-primary/15"         },
        ].map((l) => (
          <button
            key={l.tab}
            onClick={() => setTab(l.tab)}
            className={`flex items-center gap-3 p-4 rounded-2xl border text-left hover:scale-[1.02] transition-transform ${l.bg}`}
          >
            <i className={`fa-solid ${l.icon} ${l.color} text-base`}></i>
            <span className="font-black text-[11px] uppercase tracking-wide text-white">{l.label}</span>
            <i className="fa-solid fa-chevron-right text-zinc-600 text-[9px] ml-auto"></i>
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── COMMANDES ────────────────────────────────────────────────────────────────
const Orders = ({ orders, loading }) => {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[["all","Toutes"],["pending","En attente"],["delivered","Livrées"],["cancelled","Annulées"]].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
              filter === k ? "bg-primary text-black border-primary" : "border-white/10 text-zinc-400 hover:border-white/20"
            }`}
          >{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-zinc-900 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-white/5 rounded-3xl">
          <i className="fa-solid fa-bag-shopping text-zinc-700 text-4xl mb-3 block"></i>
          <p className="font-black text-white uppercase text-sm">Aucune commande</p>
          <Link to="/store" className="mt-3 inline-flex items-center gap-2 bg-primary text-black px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition">Explorer →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const st    = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
            const items = o.items || [];
            const pts   = Math.floor(Number(o.total_amount || 0) / 100);
            return (
              <div key={o.id} className="bg-zinc-950 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full border ${st.bg} ${st.border} ${st.color}`}>
                      <i className={`fa-solid ${st.icon} mr-1`}></i>{st.label}
                    </span>
                    <span className="text-[9px] font-black text-zinc-400 uppercase">#{o.id?.slice(-8).toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {o.status === "delivered" && pts > 0 && (
                      <span className="text-[8px] font-black text-amber-400 flex items-center gap-1">
                        <i className="fa-solid fa-coins text-xs"></i>+{pts} pts
                      </span>
                    )}
                    <span className="text-[9px] text-zinc-500 font-bold">{new Date(o.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>

                <div className="px-5 py-4">
                  {items.slice(0, 2).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 mb-2 last:mb-0">
                      <div className="w-10 h-10 bg-zinc-800 rounded-xl overflow-hidden flex-shrink-0">
                        {(item.product_img || item.img) && (
                          <img src={item.product_img || item.img} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="font-black text-[10px] text-white truncate">{item.product_name || item.name}</p>
                        <p className="text-[8px] text-zinc-500">Qté: {item.quantity}</p>
                      </div>
                      <p className="font-black text-[11px] text-white flex-shrink-0">{Number(item.unit_price || 0).toLocaleString()} F</p>
                    </div>
                  ))}
                  {items.length > 2 && <p className="text-[8px] text-zinc-500 font-bold mt-1">+{items.length - 2} autre(s)</p>}
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 bg-white/[0.02]">
                  <div>
                    <p className="text-[8px] text-zinc-500 font-bold uppercase">Total</p>
                    <p className="font-black text-primary text-base">{Number(o.total_amount || 0).toLocaleString()} <span className="text-xs text-zinc-400">FCFA</span></p>
                  </div>
                  <div className="flex gap-2">
                    {o.status === "delivered" && (
                      <button className="flex items-center gap-1.5 border border-yellow-400/30 text-yellow-400 px-3 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-yellow-400/10 transition">
                        <i className="fa-solid fa-star"></i> Avis
                      </button>
                    )}
                    <button className="flex items-center gap-1.5 border border-white/10 text-zinc-400 px-3 py-2 rounded-xl text-[8px] font-black uppercase hover:border-primary/30 hover:text-primary transition">
                      <i className="fa-solid fa-eye"></i> Détails
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── WISHLIST ─────────────────────────────────────────────────────────────────
const WishlistTab = ({ items, loading, onRemove, addToCart }) => (
  <div className="space-y-4">
    {loading ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="aspect-[3/4] bg-zinc-900 rounded-2xl animate-pulse" />)}
      </div>
    ) : !items?.length ? (
      <div className="text-center py-16 border border-white/5 rounded-3xl">
        <i className="fa-regular fa-heart text-zinc-700 text-5xl mb-3 block"></i>
        <p className="font-black text-white uppercase text-sm">Aucun favori</p>
        <Link to="/store" className="mt-3 inline-flex items-center gap-2 bg-primary text-black px-6 py-2.5 rounded-xl font-black text-[9px] uppercase hover:bg-white transition">Explorer →</Link>
      </div>
    ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-zinc-950 border border-white/5 rounded-2xl overflow-hidden group hover:border-primary/20 transition-all">
            <div className="relative aspect-square overflow-hidden bg-zinc-900">
              {item.product?.img && (
                <img src={item.product.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              )}
              <button
                onClick={() => onRemove(item.id)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
              >
                <i className="fa-solid fa-xmark text-white text-[9px]"></i>
              </button>
            </div>
            <div className="p-3">
              <p className="font-black text-[10px] text-white truncate mb-1">{item.product?.name}</p>
              <p className="font-black text-primary text-sm mb-2">{Number(item.product?.price || 0).toLocaleString()} F</p>
              <button
                onClick={() => addToCart(item.product)}
                className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-black border border-primary/20 hover:border-primary rounded-xl py-2 text-[8px] font-black uppercase tracking-widest transition-all"
              >
                <i className="fa-solid fa-bag-shopping mr-1"></i>Ajouter
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─── ADRESSES ─────────────────────────────────────────────────────────────────
const EMPTY_ADDR = { label: "Maison", full_name: "", phone: "", city: "Douala", neighborhood: "", street: "", extra: "", is_default: false };

const Addresses = ({ addresses, onSave, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(EMPTY_ADDR);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);

  const handleSave = async () => {
    if (!form.full_name?.trim()) { setError("Le nom complet est requis."); return; }
    if (!form.phone?.trim())     { setError("Le téléphone est requis."); return; }
    if (!form.street?.trim() && !form.neighborhood?.trim()) { setError("Renseignez la rue ou le quartier."); return; }
    setError(""); setSaving(true);
    try {
      await onSave(form);
      setForm(EMPTY_ADDR); setShowForm(false);
      setSuccess(true); setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{addresses?.length || 0} adresse(s)</p>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          className="flex items-center gap-2 bg-primary text-black px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition"
        >
          <i className={`fa-solid ${showForm ? "fa-xmark" : "fa-plus"} text-xs`}></i>
          {showForm ? "Annuler" : "Ajouter"}
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
          <i className="fa-solid fa-circle-check text-primary"></i>
          <span className="text-[10px] font-black uppercase text-primary tracking-widest">Adresse enregistrée !</span>
        </div>
      )}

      {showForm && (
        <div className="bg-zinc-950 border border-primary/20 rounded-2xl p-5 space-y-4">
          <p className="font-black text-sm uppercase tracking-tight text-white">Nouvelle adresse</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5">
              <i className="fa-solid fa-triangle-exclamation text-red-400 text-xs"></i>
              <span className="text-[9px] font-bold text-red-400">{error}</span>
            </div>
          )}

          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Libellé</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {["Maison", "Bureau", "Famille", "Autre"].map((l) => (
                <button key={l} type="button" onClick={() => set("label", l)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition ${
                    form.label === l ? "bg-primary text-black border-primary" : "border-white/10 text-zinc-400 hover:border-white/20"
                  }`}
                >{l}</button>
              ))}
            </div>
            <input
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="Libellé personnalisé..."
              className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[{ k: "full_name", label: "Nom complet *", type: "text", ph: "Nom de la personne" },
              { k: "phone",     label: "Téléphone *",   type: "tel",  ph: "+237 6XX XXX XXX"   }].map((f) => (
              <div key={f.k}>
                <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">{f.label}</label>
                <input
                  type={f.type} value={form[f.k]}
                  onChange={(e) => set(f.k, e.target.value)}
                  placeholder={f.ph}
                  className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[{ k: "city", label: "Ville", ph: "Douala" }, { k: "neighborhood", label: "Quartier", ph: "Bonamoussadi, Akwa..." }].map((f) => (
              <div key={f.k}>
                <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">{f.label}</label>
                <input
                  value={form[f.k]} onChange={(e) => set(f.k, e.target.value)} placeholder={f.ph}
                  className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Rue / Avenue *</label>
            <input
              value={form.street} onChange={(e) => set("street", e.target.value)}
              placeholder="Ex: Rue Njo Njo, Avenue Kennedy..."
              className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Infos supplémentaires</label>
            <input
              value={form.extra} onChange={(e) => set("extra", e.target.value)}
              placeholder="Bâtiment, étage, code d'entrée..."
              className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 bg-zinc-900/50 rounded-xl border border-white/5 hover:border-primary/20 transition">
            <input
              type="checkbox" checked={form.is_default}
              onChange={(e) => set("is_default", e.target.checked)}
              className="accent-primary w-4 h-4"
            />
            <div>
              <span className="text-[10px] font-black text-white uppercase tracking-wide">Adresse par défaut</span>
              <p className="text-[8px] text-zinc-500 font-bold mt-0.5">Pré-sélectionnée à chaque commande</p>
            </div>
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-primary text-black px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition disabled:opacity-50"
            >
              {saving ? <><i className="fa-solid fa-spinner fa-spin text-xs"></i>Enregistrement...</> : <><i className="fa-solid fa-check text-xs"></i>Enregistrer</>}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_ADDR); setError(""); }}
              className="border border-white/10 text-zinc-400 px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:border-white/20 transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {!addresses?.length && !showForm ? (
        <div className="text-center py-16 border border-white/5 rounded-3xl">
          <i className="fa-solid fa-location-dot text-zinc-700 text-4xl mb-3 block"></i>
          <p className="font-black text-white uppercase text-sm">Aucune adresse</p>
          <p className="text-[10px] text-zinc-500 mt-1 font-bold">Ajoutez une adresse pour un checkout plus rapide</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(addresses || []).map((a) => (
            <div
              key={a.id}
              className={`bg-zinc-950 border rounded-2xl p-5 relative hover:border-white/10 transition-colors ${a.is_default ? "border-primary/30" : "border-white/5"}`}
            >
              {a.is_default && (
                <span className="absolute top-3 right-3 text-[7px] font-black uppercase bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded-full">Défaut</span>
              )}
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-location-dot text-primary text-xs"></i>
                <span className="font-black text-[12px] text-white uppercase">{a.label || "Adresse"}</span>
              </div>
              <p className="text-[11px] font-bold text-zinc-300">{a.full_name}</p>
              <p className="text-[10px] text-zinc-500 font-bold">{a.phone}</p>
              <p className="text-[10px] text-zinc-400 font-bold mt-1">{[a.street, a.neighborhood, a.city].filter(Boolean).join(", ")}</p>
              {a.extra && <p className="text-[9px] text-zinc-600 italic mt-1">{a.extra}</p>}
              <button
                onClick={() => onDelete(a.id)}
                className="mt-4 text-[8px] font-black uppercase text-zinc-400 hover:text-red-400 transition border border-white/8 hover:border-red-400/30 px-3 py-1.5 rounded-lg"
              >
                <i className="fa-solid fa-trash mr-1"></i>Supprimer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── AVIS ─────────────────────────────────────────────────────────────────────
const ReviewsTab = ({ reviews }) => (
  <div className="space-y-3">
    {!reviews?.length ? (
      <div className="text-center py-12 border border-white/5 rounded-3xl">
        <i className="fa-solid fa-star text-zinc-700 text-4xl mb-3 block"></i>
        <p className="font-black text-white uppercase text-sm">Aucun avis publié</p>
      </div>
    ) : (
      reviews.map((r) => (
        <div key={r.id} className="bg-zinc-950 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-black text-[12px] text-white">{r.product?.name || "Produit"}</p>
              <p className="text-[9px] text-zinc-500">{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
            </div>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <i key={i} className={`fa-solid fa-star text-xs ${i < r.stars ? "text-yellow-400" : "text-zinc-700"}`}></i>
              ))}
            </div>
          </div>
          {r.comment && <p className="text-[11px] text-zinc-400 font-bold leading-relaxed">{r.comment}</p>}
        </div>
      ))
    )}
  </div>
);

// ─── PARRAINAGE ───────────────────────────────────────────────────────────────
const Referral = ({ profile, userId, onToast }) => {
  const [copied,    setCopied]    = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Code parrainage depuis le profil (garanti d'exister car auto-généré au chargement)
  const code   = profile?.referral_code || "—";
  const refUrl = `${window.location.origin}/register?ref=${code}`;

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("referrals")
      .select("id, created_at, referred:profiles!referred_id(full_name, avatar_url)")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setReferrals(data || []); setLoading(false); });
  }, [userId]);

  const handleCopy = (val, label = "Copié !") => {
    navigator.clipboard.writeText(val).then(() => {
      setCopied(true);
      onToast?.(label, "success");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const PALIERS = [
    { n: 1,  pts: 200,  label: "1ᵉʳ ami"  },
    { n: 5,  pts: 1500, label: "5 amis"   },
    { n: 10, pts: 4000, label: "10 amis"  },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-400/20 rounded-3xl p-7 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(circle, #3b82f6 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />
        <i className="fa-solid fa-user-plus text-blue-400 text-3xl mb-4 block relative z-10"></i>
        <h3 className="font-black text-2xl italic tracking-tighter text-white mb-2 relative z-10">
          Parraine. Gagne. <span className="text-blue-400">Repeat.</span>
        </h3>
        <p className="text-zinc-400 font-bold text-sm mb-6 relative z-10">
          Gagne <span className="text-primary font-black">200 pts</span> par ami parrainé · Bonus aux paliers
        </p>

        {/* Code parrainage — affiché automatiquement, pas de champ de saisie */}
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl p-4 max-w-sm mx-auto relative z-10 mb-3">
          <div className="flex-grow text-left">
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Votre code</p>
            <span className="font-black text-primary text-lg font-mono tracking-[0.2em]">{code}</span>
          </div>
          <button
            onClick={() => handleCopy(code, "Code copié !")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex-shrink-0 ${
              copied ? "bg-primary text-black" : "bg-blue-500/20 border border-blue-400/30 text-blue-300 hover:bg-blue-500/30"
            }`}
          >
            <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"} text-xs`}></i>
            {copied ? "Copié !" : "Copier"}
          </button>
        </div>

        {/* Lien complet */}
        <div className="flex items-center gap-2 bg-black/20 border border-white/8 rounded-xl p-3 max-w-sm mx-auto relative z-10">
          <p className="flex-grow text-[9px] font-medium text-zinc-400 truncate text-left">{refUrl}</p>
          <button
            onClick={() => handleCopy(refUrl, "Lien copié !")}
            className="flex-shrink-0 text-[9px] font-black uppercase text-zinc-400 hover:text-primary transition-colors px-2"
          >
            <i className={`fa-solid ${copied ? "fa-check" : "fa-link"} text-xs`}></i>
          </button>
        </div>

        {/* Partage réseaux */}
        <div className="flex gap-2 justify-center mt-4 relative z-10">
          {[
            { icon: "fa-brands fa-whatsapp", label: "WhatsApp", href: `https://wa.me/?text=Rejoins%20OFS%20Elite%20avec%20mon%20code%20${code}%20%3A%20${encodeURIComponent(refUrl)}`, color: "hover:text-green-500 hover:border-green-500/30" },
            { icon: "fa-brands fa-instagram", label: "Instagram", href: "#", color: "hover:text-pink-500 hover:border-pink-500/30" },
            { icon: "fa-brands fa-tiktok",    label: "TikTok",    href: "#", color: "hover:text-white hover:border-white/30"         },
          ].map((n) => (
            <a
              key={n.label} href={n.href} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-2 flex-1 justify-center py-2.5 rounded-xl border border-white/8 text-zinc-400 ${n.color} transition-all text-[10px] font-black uppercase tracking-widest max-w-[110px]`}
            >
              <i className={`${n.icon} text-sm`}></i>
              <span className="hidden sm:inline">{n.label}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Paliers */}
        <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4">Paliers de parrainage</p>
          <div className="space-y-3">
            {PALIERS.map((p) => {
              const done = referrals.length >= p.n;
              return (
                <div
                  key={p.n}
                  className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                    done ? "bg-emerald-500/8 border border-emerald-500/20" : "bg-zinc-900"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${done ? "bg-emerald-500/20" : "bg-zinc-800"}`}>
                    <i className={`fa-solid fa-user-group text-xs ${done ? "text-emerald-400" : "text-zinc-400"}`}></i>
                  </div>
                  <div className="flex-grow">
                    <p className={`text-[11px] font-black uppercase ${done ? "text-emerald-300" : "text-zinc-300"}`}>{p.label}</p>
                    <p className="text-[9px] font-bold text-zinc-500">+{p.pts.toLocaleString()} pts de bonus</p>
                  </div>
                  {done
                    ? <i className="fa-solid fa-circle-check text-emerald-500 text-sm flex-shrink-0"></i>
                    : <span className="text-[8px] font-black text-zinc-400">{p.n - referrals.length} restants</span>
                  }
                </div>
              );
            })}
          </div>
        </div>

        {/* Filleuls */}
        <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Mes filleuls</p>
            <span className="text-[10px] font-black text-zinc-500">{referrals.length} inscrits</span>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-zinc-900 rounded-xl animate-pulse" />)}</div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-6">
              <i className="fa-solid fa-user-group text-zinc-700 text-2xl mb-2 block"></i>
              <p className="text-[10px] font-medium text-zinc-500">Partagez votre lien pour commencer !</p>
            </div>
          ) : (
            <div className="space-y-2">
              {referrals.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-1">
                  <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {r.referred?.avatar_url
                      ? <img src={r.referred.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs font-black text-zinc-400">{(r.referred?.full_name || "?")[0].toUpperCase()}</span>
                    }
                  </div>
                  <p className="text-xs font-bold text-zinc-300 flex-grow">{r.referred?.full_name || "Membre OFS"}</p>
                  <span className="text-[9px] font-black text-emerald-400">+200 pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
const NotificationsTab = ({ prefs, onSave }) => {
  const [p,    setP]    = useState(prefs || { order_updates: true, promotions: true, new_products: true, price_drops: true, reviews: true, newsletter: false, sms: false, push: true });
  const [saved, setSaved] = useState(false);

  const handle = async () => {
    await onSave(p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const Toggle = ({ k, label, sub }) => (
    <div className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0">
      <div>
        <p className="font-black text-[12px] text-white">{label}</p>
        {sub && <p className="text-[9px] text-zinc-500 font-bold mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={() => setP((prev) => ({ ...prev, [k]: !prev[k] }))}
        className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${p[k] ? "bg-primary" : "bg-zinc-700"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${p[k] ? "left-6" : "left-0.5"}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-4">Notifications email</p>
        <Toggle k="order_updates" label="Mises à jour commandes"  sub="Confirmation, expédition, livraison" />
        <Toggle k="promotions"    label="Promotions & Flash Deals" sub="Offres exclusives et ventes flash" />
        <Toggle k="new_products"  label="Nouveaux produits"        sub="Alertes nouvelles arrivées" />
        <Toggle k="price_drops"   label="Baisse de prix"           sub="Sur vos articles en favoris" />
        <Toggle k="reviews"       label="Avis & feedback"          sub="Demandes d'avis après achat" />
        <Toggle k="newsletter"    label="Newsletter OFS"           sub="Actualités et tendances" />
      </div>
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-4">Autres canaux</p>
        <Toggle k="sms"  label="SMS"                sub="Mises à jour livraison par SMS" />
        <Toggle k="push" label="Notifications push" sub="Alertes instantanées navigateur" />
      </div>
      <button
        onClick={handle}
        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${
          saved ? "bg-emerald-500 text-white" : "bg-primary text-black hover:bg-white"
        }`}
      >
        <i className={`fa-solid ${saved ? "fa-check" : "fa-floppy-disk"}`}></i>
        {saved ? "Préférences enregistrées !" : "Enregistrer les préférences"}
      </button>
    </div>
  );
};

// ─── SÉCURITÉ ─────────────────────────────────────────────────────────────────
const Security = ({ user, onToast }) => {
  const [pw,      setPw]      = useState({ current: "", next: "", confirm: "" });
  const [msg,     setMsg]     = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePw = async () => {
    setMsg(null);
    if (!pw.current.trim()) { setMsg({ type: "error", text: "Veuillez saisir votre mot de passe actuel." }); return; }
    if (pw.next.length < 8) { setMsg({ type: "error", text: "Le nouveau mot de passe doit faire min. 8 caractères." }); return; }
    if (pw.next !== pw.confirm) { setMsg({ type: "error", text: "Les mots de passe ne correspondent pas." }); return; }

    setLoading(true);
    try {
      // Vérifier le mot de passe actuel via re-signin
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email:    user.email,
        password: pw.current,
      });
      if (signInError) { setMsg({ type: "error", text: "Mot de passe actuel incorrect." }); setLoading(false); return; }

      // Mettre à jour le mot de passe
      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw error;

      setMsg({ type: "ok", text: "Mot de passe mis à jour avec succès !" });
      setPw({ current: "", next: "", confirm: "" });
      onToast?.("Mot de passe mis à jour !", "success");
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Une erreur est survenue." });
    } finally {
      setLoading(false);
    }
  };

  const [delConfirm, setDelConfirm] = useState(false);
  const [delLoading, setDelLoading] = useState(false);

  const handleDelete = async () => {
    setDelLoading(true);
    try {
      await supabase.auth.admin?.deleteUser(user.id); // nécessite service role côté serveur
      await supabase.auth.signOut();
    } catch (e) {
      setMsg({ type: "error", text: "La suppression doit être effectuée via le support OFS." });
    } finally {
      setDelLoading(false);
      setDelConfirm(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Changer le mot de passe */}
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
        <p className="font-black text-sm uppercase tracking-tight text-white mb-1 flex items-center gap-2">
          <i className="fa-solid fa-lock text-primary"></i>Changer le mot de passe
        </p>
        <p className="text-[9px] text-zinc-500 font-bold mb-5">Connecté en tant que <span className="text-zinc-300">{user?.email}</span></p>

        <div className="space-y-3">
          {[
            { k: "current", label: "Mot de passe actuel",    ph: "Votre mot de passe actuel"    },
            { k: "next",    label: "Nouveau mot de passe",   ph: "Min. 8 caractères"             },
            { k: "confirm", label: "Confirmer le nouveau",   ph: "Répétez le nouveau mot de passe" },
          ].map((f) => (
            <div key={f.k}>
              <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">{f.label}</label>
              <input
                type="password" value={pw[f.k]}
                onChange={(e) => setPw((p) => ({ ...p, [f.k]: e.target.value }))}
                placeholder={f.ph}
                onKeyDown={(e) => e.key === "Enter" && handlePw()}
                className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"
              />
            </div>
          ))}
        </div>

        {/* Indicateur de force du password */}
        {pw.next && (
          <div className="mt-3 space-y-1">
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Force du mot de passe</p>
            <div className="flex gap-1">
              {[8, 12, 16].map((len, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-full transition-all ${
                    pw.next.length >= len
                      ? i === 0 ? "bg-red-500" : i === 1 ? "bg-yellow-400" : "bg-primary"
                      : "bg-zinc-800"
                  }`}
                />
              ))}
            </div>
            <p className="text-[8px] text-zinc-500">
              {pw.next.length < 8 ? "Trop court" : pw.next.length < 12 ? "Faible" : pw.next.length < 16 ? "Moyen" : "Fort"}
            </p>
          </div>
        )}

        {msg && (
          <div className={`flex items-center gap-2 mt-4 p-3 rounded-xl text-[10px] font-bold border ${
            msg.type === "ok"
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-red-500/10 text-red-400 border-red-400/20"
          }`}>
            <i className={`fa-solid ${msg.type === "ok" ? "fa-check" : "fa-triangle-exclamation"}`}></i>
            {msg.text}
          </div>
        )}

        <button
          onClick={handlePw} disabled={loading}
          className="mt-4 w-full bg-primary text-black py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-shield-check"></i>}
          Mettre à jour le mot de passe
        </button>
      </div>

      {/* Sessions actives */}
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
        <p className="font-black text-sm uppercase tracking-tight text-white mb-4 flex items-center gap-2">
          <i className="fa-solid fa-mobile-screen text-blue-400"></i>Session active
        </p>
        <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-globe text-zinc-400 text-sm"></i>
            <div>
              <p className="text-[11px] font-black text-white">Navigateur web</p>
              <p className="text-[9px] text-zinc-500">{user?.email}</p>
            </div>
          </div>
          <span className="text-[8px] font-black text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-full uppercase">Actif</span>
        </div>
      </div>

      {/* Zone de danger */}
      <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-5">
        <p className="font-black text-sm uppercase tracking-tight text-red-400 mb-1 flex items-center gap-2">
          <i className="fa-solid fa-triangle-exclamation"></i>Zone de danger
        </p>
        <p className="text-[10px] text-zinc-500 font-bold mb-4">Ces actions sont irréversibles. Procédez avec précaution.</p>

        {!delConfirm ? (
          <button
            onClick={() => setDelConfirm(true)}
            className="border border-red-500/30 text-red-400 px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-500/10 transition"
          >
            <i className="fa-solid fa-trash-can mr-2"></i>Supprimer mon compte
          </button>
        ) : (
          <div className="space-y-3 bg-red-500/10 border border-red-500/25 rounded-xl p-4">
            <p className="text-[10px] font-black text-red-300 uppercase">Êtes-vous sûr ? Cette action est irréversible.</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete} disabled={delLoading}
                className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-600 transition disabled:opacity-50"
              >
                {delLoading ? <i className="fa-solid fa-spinner fa-spin text-xs"></i> : <i className="fa-solid fa-trash-can text-xs"></i>}
                Oui, supprimer
              </button>
              <button
                onClick={() => setDelConfirm(false)}
                className="border border-white/10 text-zinc-400 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:border-white/20 transition"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── PARAMÈTRES / PROFIL ──────────────────────────────────────────────────────
const Settings = ({ profile, user, onSave, onToast }) => {
  const [form,    setForm]    = useState({
    full_name: profile?.full_name || "",
    phone:     profile?.phone     || "",
    bio:       profile?.bio       || "",
    city:      profile?.city      || "Douala",
    birthday:  profile?.birthday  || "",
    gender:    profile?.gender    || "",
    instagram: profile?.instagram || "",
    whatsapp:  profile?.whatsapp  || "",
  });
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [avatar,       setAvatar]       = useState(null);
  const [avatarPreview,setAvatarPreview]= useState(null);
  const [uploadPct,    setUploadPct]    = useState(0);
  const [error,        setError]        = useState("");
  const fileRef = useRef(null);

  // Sync form si profile change (ex: rechargement)
  useEffect(() => {
    setForm({
      full_name: profile?.full_name || "",
      phone:     profile?.phone     || "",
      bio:       profile?.bio       || "",
      city:      profile?.city      || "Douala",
      birthday:  profile?.birthday  || "",
      gender:    profile?.gender    || "",
      instagram: profile?.instagram || "",
      whatsapp:  profile?.whatsapp  || "",
    });
  }, [profile?.id]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Photo trop lourde (max 2 MB)."); return; }
    setError("");
    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.full_name?.trim()) { setError("Le nom complet est requis."); return; }
    setError(""); setSaving(true);

    try {
      const updates = { ...form };

      // Upload avatar si sélectionné
      if (avatar) {
        const ext  = avatar.name.split(".").pop();
        const path = `avatars/${user.id}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("profiles")
          .upload(path, avatar, { upsert: true });

        if (upErr) throw upErr;

        const { data: { publicUrl } } = supabase.storage.from("profiles").getPublicUrl(path);
        updates.avatar_url = publicUrl + `?t=${Date.now()}`; // cache bust
      }

      await onSave(updates);
      setSaved(true);
      onToast?.("Profil mis à jour !", "success");
      setTimeout(() => setSaved(false), 2500);

      // Reset avatar state
      setAvatar(null);
      setAvatarPreview(null);
    } catch (e) {
      setError(e.message || "Erreur lors de la sauvegarde.");
      onToast?.(e.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const currentAvatar = avatarPreview || profile?.avatar_url;

  return (
    <div className="space-y-5">
      {/* Photo de profil */}
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
        <p className="font-black text-sm uppercase tracking-tight text-white mb-4 flex items-center gap-2">
          <i className="fa-solid fa-user-circle text-primary"></i>Photo de profil
        </p>
        <div className="flex items-center gap-5">
          <div
            onClick={() => fileRef.current?.click()}
            className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 cursor-pointer flex-shrink-0 group"
          >
            {currentAvatar ? (
              <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-black text-primary text-2xl">{(form.full_name || "?")[0].toUpperCase()}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <i className="fa-solid fa-camera text-white text-lg"></i>
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          <div>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 border border-primary/30 text-primary px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-primary/10 transition mb-2"
            >
              <i className="fa-solid fa-upload text-xs"></i>
              {avatar ? "Changer la sélection" : "Changer la photo"}
            </button>
            <p className="text-[8px] text-zinc-600 font-bold">JPG, PNG, WebP · Max 2 MB</p>
            {avatar && (
              <p className="text-[8px] text-primary font-bold mt-1">
                <i className="fa-solid fa-check mr-1"></i>{avatar.name} sélectionné
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Infos personnelles */}
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 space-y-4">
        <p className="font-black text-sm uppercase tracking-tight text-white flex items-center gap-2">
          <i className="fa-solid fa-id-card text-primary"></i>Informations personnelles
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { k: "full_name", label: "Nom complet *", type: "text", ph: "Votre nom complet"    },
            { k: "phone",     label: "Téléphone",     type: "tel",  ph: "+237 6XX XXX XXX"      },
            { k: "city",      label: "Ville",         type: "text", ph: "Douala"                },
            { k: "birthday",  label: "Date de naissance", type: "date", ph: ""                  },
          ].map((f) => (
            <div key={f.k}>
              <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">{f.label}</label>
              <input
                type={f.type} value={form[f.k]}
                onChange={(e) => set(f.k, e.target.value)}
                placeholder={f.ph}
                className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"
              />
            </div>
          ))}

          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Genre</label>
            <select
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
              className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold focus:border-primary/40 focus:outline-none transition"
            >
              <option value="">Non précisé</option>
              <option value="H">Homme</option>
              <option value="F">Femme</option>
              <option value="autre">Autre</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Bio</label>
          <textarea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            rows={3}
            placeholder="Quelques mots sur vous..."
            className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition resize-none"
          />
        </div>
      </div>

      {/* Réseaux sociaux */}
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 space-y-3">
        <p className="font-black text-sm uppercase tracking-tight text-white flex items-center gap-2">
          <i className="fa-solid fa-share-nodes text-primary"></i>Réseaux sociaux
        </p>
        {[
          { k: "instagram", icon: "fa-brands fa-instagram", label: "Instagram", ph: "@votre_handle", color: "text-pink-400" },
          { k: "whatsapp",  icon: "fa-brands fa-whatsapp",  label: "WhatsApp",  ph: "+237 6XX XXX XXX", color: "text-green-400" },
        ].map((f) => (
          <div key={f.k} className="flex items-center gap-3">
            <i className={`${f.icon} ${f.color} text-base w-5 flex-shrink-0`}></i>
            <input
              value={form[f.k]}
              onChange={(e) => set(f.k, e.target.value)}
              placeholder={f.ph}
              className="flex-grow bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"
            />
          </div>
        ))}
      </div>

      {/* Email (lecture seule) */}
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
        <p className="font-black text-sm uppercase tracking-tight text-white flex items-center gap-2 mb-3">
          <i className="fa-solid fa-envelope text-primary"></i>Email
        </p>
        <div className="flex items-center gap-3 bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-3">
          <span className="text-[11px] font-bold text-zinc-400 flex-grow">{user?.email}</span>
          <span className="text-[7px] font-black uppercase text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">Vérifié</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
          <i className="fa-solid fa-triangle-exclamation text-red-400 text-xs"></i>
          <span className="text-[9px] font-bold text-red-400">{error}</span>
        </div>
      )}

      <button
        onClick={handleSave} disabled={saving}
        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${
          saved ? "bg-emerald-500 text-white" : "bg-primary text-black hover:bg-white"
        } disabled:opacity-60`}
      >
        {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className={`fa-solid ${saved ? "fa-check" : "fa-floppy-disk"}`}></i>}
        {saving ? "Enregistrement..." : saved ? "Profil mis à jour !" : "Enregistrer les modifications"}
      </button>
    </div>
  );
};

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────
const ProfilePage = ({ addToCart }) => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab,           setTab]           = useState(searchParams.get("tab") || "overview");
  const [profile,       setProfile]       = useState(null);
  const [orders,        setOrders]        = useState([]);
  const [wishlist,      setWishlist]      = useState([]);
  const [reviews,       setReviews]       = useState([]);
  const [addresses,     setAddresses]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [mobileNav,     setMobileNav]     = useState(false);
  const [toast,         setToast]         = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  // Redirect si non authentifié
  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { state: { from: "/profile" } });
  }, [user, authLoading]);

  // Chargement initial
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [pR, oR, wR, rR, aR] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from("orders").select("*,items:order_items(*)").eq("user_id", user.id).order("created_at", { ascending: false }),
          supabase.from("wishlists").select("*,product:products(*)").eq("user_id", user.id),
          supabase.from("reviews").select("*,product:products(name,img)").eq("user_id", user.id).order("created_at", { ascending: false }),
          supabase.from("user_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }),
        ]);

        let profileData = pR.data || {};

        // ── Auto-générer le code de parrainage si absent ──────────────────────
        if (!profileData.referral_code) {
          const code = generateReferralCode(user.id);
          await supabase.from("profiles").update({ referral_code: code }).eq("id", user.id);
          profileData = { ...profileData, referral_code: code };
        }

        setProfile(profileData);
        setOrders(oR.data || []);
        setWishlist(wR.data || []);
        setReviews(rR.data || []);
        setAddresses(aR.data || []);

        // ── Sync points depuis commandes livrées ──────────────────────────────
        const delivered = (oR.data || []).filter((o) => o.status === "delivered");
        const newPts    = await syncOrderPoints(user.id, delivered);

        // Rafraîchir les points depuis le profil mis à jour
        const { data: freshProfile } = await supabase
          .from("profiles")
          .select("loyalty_points")
          .eq("id", user.id)
          .single();

        const totalPts = freshProfile?.loyalty_points || profileData.loyalty_points || 0;
        setLoyaltyPoints(totalPts);

        if (newPts > 0) {
          showToast(`+${newPts} pts OFS crédités pour vos achats !`, "info");
        }
      } catch (e) {
        console.error("ProfilePage load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const saveProfile = async (data) => {
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...data, updated_at: new Date().toISOString() });
    if (error) throw error;
    setProfile((p) => ({ ...p, ...data }));
  };

  const saveAddress = async (data) => {
    const { data: res, error } = await supabase
      .from("user_addresses")
      .insert({ user_id: user.id, ...data })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (res.is_default) {
      await supabase.from("user_addresses").update({ is_default: false }).eq("user_id", user.id).neq("id", res.id);
      setAddresses((prev) => [res, ...prev.map((a) => ({ ...a, is_default: false }))]);
    } else {
      setAddresses((prev) => [...prev, res]);
    }
  };

  const deleteAddress = async (id) => {
    const { error } = await supabase.from("user_addresses").delete().eq("id", id);
    if (!error) setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  const removeWishlist = async (id) => {
    await supabase.from("wishlists").delete().eq("id", id);
    setWishlist((prev) => prev.filter((w) => w.id !== id));
  };

  const saveNotifPrefs = async (prefs) => {
    await supabase.from("profiles").upsert({ id: user.id, notification_prefs: prefs });
    showToast("Préférences enregistrées !", "success");
  };

  // ── Loading / Guard ────────────────────────────────────────────────────────
  if (authLoading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <i className="fa-solid fa-spinner fa-spin text-primary text-3xl"></i>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Chargement...</p>
      </div>
    </div>
  );
  if (!user) return null;

  const tier      = getTier(loyaltyPoints || profile?.loyalty_points || 0);
  const tierCfg   = TIER_CONFIG[tier];
  const activeTab = TABS.find((t) => t.key === tab);

  const CONTENT = {
    overview:      <Overview profile={profile} orders={orders} wishlist={wishlist} reviews={reviews} setTab={setTab} loyaltyPoints={loyaltyPoints} />,
    orders:        <Orders orders={orders} loading={loading} />,
    wishlist:      <WishlistTab items={wishlist} loading={loading} onRemove={removeWishlist} addToCart={addToCart} />,
    addresses:     <Addresses addresses={addresses} onSave={saveAddress} onDelete={deleteAddress} />,
    reviews:       <ReviewsTab reviews={reviews} />,
    referral:      <Referral profile={profile} userId={user?.id} onToast={showToast} />,
    notifications: <NotificationsTab prefs={profile?.notification_prefs} onSave={saveNotifPrefs} />,
    security:      <Security user={user} onToast={showToast} />,
    settings:      <Settings profile={profile} user={user} onSave={saveProfile} onToast={showToast} />,
  };

  return (
    <div className="min-h-screen bg-black text-white pt-[148px] pb-20">
      {/* Toast global */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="max-w-[1400px] mx-auto px-4 md:px-8">

        {/* ── HEADER PROFIL ── */}
        <div className="bg-zinc-950 border border-white/5 rounded-3xl overflow-hidden mb-6">
          <div className="h-28 bg-gradient-to-r from-primary/20 via-blue-500/10 to-purple-500/15 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{ backgroundImage: "linear-gradient(rgba(0,217,126,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,217,126,1) 1px,transparent 1px)", backgroundSize: "40px 40px" }}
            />
          </div>
          <div className="px-6 pb-5 -mt-10 flex flex-col sm:flex-row sm:items-end gap-4">
            <Avatar
              url={profile?.avatar_url}
              name={profile?.full_name || user?.email}
              size={20}
              onClick={() => setTab("settings")}
            />
            <div className="flex-grow min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-black text-xl uppercase italic tracking-tighter text-white leading-none">
                  {profile?.full_name || user?.email?.split("@")[0]}
                </h1>
                <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full border ${tierCfg.color} bg-gradient-to-br ${tierCfg.bg}`}>
                  <i className={`fa-solid ${tierCfg.icon} mr-1`}></i>{tierCfg.label}
                </span>
                {/* Points badge */}
                <span className="text-[8px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <i className="fa-solid fa-coins text-[8px]"></i>
                  {(loyaltyPoints || profile?.loyalty_points || 0).toLocaleString()} pts
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-bold mt-1">{user?.email}</p>
              {profile?.bio && <p className="text-[11px] text-zinc-400 mt-1 font-bold italic">"{profile.bio}"</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link
                to="/rewards"
                className="flex items-center gap-2 border border-primary/30 text-primary hover:bg-primary/10 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition"
              >
                <i className="fa-solid fa-gift text-xs"></i>
                <span className="hidden sm:inline">Rewards</span>
              </Link>
              <button
                onClick={() => setTab("settings")}
                className="flex items-center gap-2 border border-white/10 text-zinc-400 hover:text-primary hover:border-primary/30 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition"
              >
                <i className="fa-solid fa-pen-to-square text-xs"></i>
                <span className="hidden sm:inline">Modifier</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition"
              >
                <i className="fa-solid fa-right-from-bracket text-xs"></i>
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* ── SIDEBAR ── */}
          <aside className="hidden lg:flex flex-col gap-1 w-52 flex-shrink-0">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-left transition-all ${
                  tab === t.key ? "bg-primary text-black" : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <i className={`fa-solid ${t.icon} text-xs w-4`}></i>
                <span>{t.label}</span>
                {t.key === "orders" && orders.filter((o) => o.status === "pending").length > 0 && (
                  <span className="ml-auto bg-primary/20 text-primary text-[7px] font-black rounded-full px-1.5 py-0.5">
                    {orders.filter((o) => o.status === "pending").length}
                  </span>
                )}
              </button>
            ))}
            <div className="mt-3 pt-3 border-t border-white/5">
              <Link to="/store"     className="flex items-center gap-3 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-zinc-500 hover:text-primary transition"><i className="fa-solid fa-bag-shopping text-xs w-4"></i><span>Store</span></Link>
              <Link to="/rewards"   className="flex items-center gap-3 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-zinc-500 hover:text-primary transition"><i className="fa-solid fa-gift text-xs w-4"></i><span>OFS Rewards</span></Link>
              <Link to="/boutiques" className="flex items-center gap-3 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-zinc-500 hover:text-primary transition"><i className="fa-solid fa-store text-xs w-4"></i><span>Boutiques</span></Link>
            </div>
          </aside>

          {/* ── CONTENU ── */}
          <div className="flex-grow min-w-0">
            {/* Nav mobile */}
            <div className="lg:hidden mb-4">
              <button
                onClick={() => setMobileNav(!mobileNav)}
                className="w-full flex items-center justify-between bg-zinc-950 border border-white/8 rounded-2xl px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <i className={`fa-solid ${activeTab?.icon} text-primary text-sm`}></i>
                  <span className="font-black text-[11px] uppercase tracking-widest text-white">{activeTab?.label}</span>
                </div>
                <i className={`fa-solid fa-chevron-down text-zinc-400 text-xs transition-transform ${mobileNav ? "rotate-180" : ""}`}></i>
              </button>
              {mobileNav && (
                <div className="bg-zinc-950 border border-white/8 rounded-2xl mt-1 overflow-hidden">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => { setTab(t.key); setMobileNav(false); }}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left border-b border-white/5 last:border-0 font-black text-[10px] uppercase tracking-widest transition ${
                        tab === t.key ? "text-primary bg-primary/5" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <i className={`fa-solid ${t.icon} text-xs w-4`}></i>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Titre de section */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-7 bg-primary rounded-full"></div>
              <h2 className="font-black text-lg uppercase tracking-tighter text-white">{activeTab?.label}</h2>
            </div>

            {/* Contenu */}
            {loading && !["settings", "security", "notifications", "addresses", "referral"].includes(tab)
              ? <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-zinc-900 rounded-2xl animate-pulse" />)}</div>
              : CONTENT[tab]
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;