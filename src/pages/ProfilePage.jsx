import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "overview",      label: "Accueil",       icon: "fa-house"          },
  { key: "orders",        label: "Commandes",     icon: "fa-bag-shopping"   },
  { key: "wishlist",      label: "Favoris",       icon: "fa-heart"          },
  { key: "addresses",     label: "Adresses",      icon: "fa-location-dot"   },
  { key: "reviews",       label: "Mes avis",      icon: "fa-star"           },
  { key: "referral",      label: "Parrainage",    icon: "fa-user-plus"      },
  { key: "notifications", label: "Notifications", icon: "fa-bell"           },
  { key: "security",      label: "Sécurité",      icon: "fa-shield-halved"  },
  { key: "settings",      label: "Mon profil",    icon: "fa-pen-to-square"  },
];

const ORDER_STATUS = {
  pending:   { label: "En attente", color: "text-[#FF9900]", bg: "bg-[#FFF3CD]", border: "border-[#FCD200]/60", icon: "fa-clock"        },
  confirmed: { label: "Confirmée",  color: "text-[#007185]", bg: "bg-[#E6F3F5]", border: "border-[#007185]/40", icon: "fa-circle-check" },
  shipped:   { label: "Expédiée",   color: "text-[#565959]", bg: "bg-[#EAEDED]", border: "border-[#D5D9D9]",   icon: "fa-truck"        },
  delivered: { label: "Livrée",     color: "text-[#007600]", bg: "bg-[#E8F5E8]", border: "border-[#007600]/40", icon: "fa-box-open"    },
  cancelled: { label: "Annulée",    color: "text-[#B12704]", bg: "bg-[#FEE7E5]", border: "border-[#B12704]/40", icon: "fa-xmark"       },
};

const TIER_CONFIG = {
  bronze:   { label: "Bronze",  color: "#c97c4a", icon: "fa-medal", min: 0,    max: 500   },
  silver:   { label: "Argent",  color: "#ADBAC7", icon: "fa-medal", min: 500,  max: 2000  },
  gold:     { label: "Or",      color: "#FF9900", icon: "fa-crown", min: 2000, max: 5000  },
  platinum: { label: "Platine", color: "#FFD814", icon: "fa-gem",   min: 5000, max: 99999 },
};
const getTier = (pts) => pts >= 5000 ? "platinum" : pts >= 2000 ? "gold" : pts >= 500 ? "silver" : "bronze";

const generateReferralCode = (userId) =>
  "OFS-" + userId.replace(/-/g, "").slice(0, 6).toUpperCase();

const syncOrderPoints = async (userId, deliveredOrders) => {
  if (!deliveredOrders.length) return 0;
  const { data: existingTxs } = await supabase
    .from("loyalty_transactions").select("reference_id")
    .eq("user_id", userId).eq("type", "purchase");
  const existingRefs = new Set((existingTxs || []).map((t) => t.reference_id));
  const newTxs = [];
  let newPts = 0;
  for (const order of deliveredOrders) {
    if (!existingRefs.has(order.id)) {
      const pts = Math.floor(Number(order.total_amount || 0) / 100);
      if (pts > 0) {
        newPts += pts;
        newTxs.push({ user_id: userId, type: "purchase", points: pts, reference_id: order.id,
          description: `Achat #${order.id.slice(-8).toUpperCase()} — ${Number(order.total_amount).toLocaleString()} F` });
      }
    }
  }
  if (!newTxs.length) return 0;
  await supabase.from("loyalty_transactions").insert(newTxs);
  const { data: allTxs } = await supabase.from("loyalty_transactions").select("points").eq("user_id", userId);
  const total = (allTxs || []).reduce((sum, t) => sum + (t.points || 0), 0);
  await supabase.from("profiles").update({ loyalty_points: Math.max(0, total) }).eq("id", userId);
  return newPts;
};

// ─── SHARED ────────────────────────────────────────────────────────────────────
const AmzCard = ({ children, className = "" }) => (
  <div className={`bg-white border border-[#D5D9D9] rounded overflow-hidden ${className}`}>{children}</div>
);

const AmzCardHeader = ({ title, icon, action }) => (
  <div className="bg-[#232F3E] px-4 py-3 flex items-center justify-between">
    <p className="text-[10px] font-black uppercase tracking-widest text-[#FF9900] flex items-center gap-2">
      {icon && <i className={`fa-solid ${icon} text-[9px]`}></i>}{title}
    </p>
    {action}
  </div>
);

const AmzInput = ({ label, className = "", ...props }) => (
  <div className={className}>
    {label && <label className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1.5 block">{label}</label>}
    <input
      className="w-full bg-white border border-[#D5D9D9] rounded px-3 py-2.5 text-sm text-[#0F1111] focus:border-[#FF9900] focus:outline-none transition-colors placeholder-[#adb5bd]"
      {...props}
    />
  </div>
);

const AmzSelect = ({ label, children, ...props }) => (
  <div>
    {label && <label className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1.5 block">{label}</label>}
    <select
      className="w-full bg-white border border-[#D5D9D9] rounded px-3 py-2.5 text-sm text-[#0F1111] focus:border-[#FF9900] focus:outline-none transition-colors"
      {...props}
    >{children}</select>
  </div>
);

const PrimaryBtn = ({ children, className = "", ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] font-black text-[10px] uppercase tracking-widest rounded px-4 py-2.5 transition-colors disabled:opacity-50 ${className}`}
    {...props}
  >{children}</button>
);

const SecondaryBtn = ({ children, className = "", ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 border border-[#D5D9D9] text-[#0F1111] hover:bg-[#EAEDED] font-black text-[10px] uppercase tracking-widest rounded px-4 py-2.5 transition-colors ${className}`}
    {...props}
  >{children}</button>
);

const Avatar = ({ url, name, size = 20, onClick }) => (
  <div
    onClick={onClick}
    className={`relative rounded overflow-hidden flex-shrink-0 border-2 border-[#FF9900] bg-[#232F3E] ${onClick ? "cursor-pointer" : ""}`}
    style={{ width: size * 4, height: size * 4 }}
  >
    {url
      ? <img src={url} alt={name} className="w-full h-full object-cover" />
      : <div className="w-full h-full flex items-center justify-center">
          <span className="font-black text-[#FF9900]" style={{ fontSize: size * 1.4 }}>
            {(name || "?")[0].toUpperCase()}
          </span>
        </div>
    }
    {onClick && (
      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
        <i className="fa-solid fa-camera text-white text-lg"></i>
      </div>
    )}
  </div>
);

const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const icons = { success: "fa-circle-check", error: "fa-triangle-exclamation", info: "fa-circle-info" };
  const colors = { success: "text-[#007600]", error: "text-[#B12704]", info: "text-[#007185]" };
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 bg-[#0F1111] border border-[#232F3E] rounded shadow-2xl px-5 py-3.5">
      <i className={`fa-solid ${icons[type]} ${colors[type]} text-sm`}></i>
      <span className="font-black text-[11px] uppercase tracking-widest text-white whitespace-nowrap">{message}</span>
      <button onClick={onClose} className="ml-2 text-[#565959] hover:text-white transition-colors">
        <i className="fa-solid fa-xmark text-xs"></i>
      </button>
    </div>
  );
};

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
const Overview = ({ profile, orders, wishlist, reviews, setTab, loyaltyPoints }) => {
  const pts    = loyaltyPoints ?? (profile?.loyalty_points || 0);
  const tier   = getTier(pts);
  const cfg    = TIER_CONFIG[tier];
  const pct    = Math.min(((pts - cfg.min) / (cfg.max - cfg.min)) * 100, 100);
  const recent = (orders || []).slice(0, 3);

  return (
    <div className="space-y-4">
      {/* TIER CARD */}
      <AmzCard>
        <div className="bg-[#131921] p-5 relative overflow-hidden">
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10">
            <i className={`fa-solid ${cfg.icon} text-[80px]`} style={{ color: cfg.color }}></i>
          </div>
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#ADBAC7] mb-1">Statut membre</p>
              <div className="flex items-center gap-2">
                <i className={`fa-solid ${cfg.icon} text-xl`} style={{ color: cfg.color }}></i>
                <span className="font-black text-2xl text-white uppercase">{cfg.label}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-black text-3xl text-white">{pts.toLocaleString()}</p>
              <p className="text-[9px] font-black uppercase text-[#ADBAC7] tracking-widest">points OFS</p>
            </div>
          </div>
          <div className="relative z-10 mt-4">
            <div className="h-2 bg-[#232F3E] rounded-full overflow-hidden mb-1.5">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: pct + "%", background: cfg.color }} />
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-[#ADBAC7]">{pts.toLocaleString()} pts</span>
              <span className="text-[9px] text-[#ADBAC7]">
                {cfg.max < 99999 ? `${cfg.max.toLocaleString()} pts pour le prochain niveau` : "Niveau maximum 🎉"}
              </span>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#D5D9D9] bg-[#F7F8F8]">
          <Link to="/rewards"
            className="inline-flex items-center gap-2 text-[#007185] hover:text-[#C45500] text-[10px] font-black uppercase hover:underline"
          >
            <i className="fa-solid fa-gift text-[9px]"></i>OFS Rewards →
          </Link>
        </div>
      </AmzCard>

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: "fa-bag-shopping", value: orders?.length || 0,   label: "Commandes",  color: "#FF9900"  },
          { icon: "fa-heart",        value: wishlist?.length || 0,  label: "Favoris",    color: "#B12704"  },
          { icon: "fa-star",         value: reviews?.length || 0,   label: "Avis",       color: "#FF9900"  },
          { icon: "fa-crown",        value: "−20%",                 label: "Réduction",  color: "#FFD814"  },
        ].map(s => (
          <AmzCard key={s.label} className="p-4 text-center hover:border-[#FF9900]/40 transition-colors">
            <i className={`fa-solid ${s.icon} text-sm mb-2 block`} style={{ color: s.color }}></i>
            <p className="font-black text-xl text-[#0F1111]">{s.value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-[#565959] mt-0.5">{s.label}</p>
          </AmzCard>
        ))}
      </div>

      {/* RECENT ORDERS */}
      {recent.length > 0 && (
        <AmzCard>
          <AmzCardHeader title="Commandes récentes" icon="fa-bag-shopping"
            action={
              <button onClick={() => setTab("orders")}
                className="text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500] hover:underline">
                Voir tout →
              </button>
            }
          />
          <div className="divide-y divide-[#F0F2F2]">
            {recent.map(o => {
              const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
              return (
                <div key={o.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[#F7F8F8] transition-colors">
                  <div className={`w-9 h-9 rounded flex items-center justify-center border flex-shrink-0 ${st.bg} ${st.border}`}>
                    <i className={`fa-solid ${st.icon} text-xs ${st.color}`}></i>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-black text-[11px] text-[#0F1111] truncate">#{o.id?.slice(-8).toUpperCase()}</p>
                    <p className="text-[9px] text-[#565959] font-bold">{new Date(o.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-[11px] text-[#B12704]">{Number(o.total_amount || 0).toLocaleString()} F</p>
                    <span className={`text-[8px] font-black uppercase ${st.color}`}>{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </AmzCard>
      )}

      {/* QUICK LINKS */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: "fa-location-dot",  label: "Mes adresses",  tab: "addresses",     color: "#FF9900"  },
          { icon: "fa-user-plus",     label: "Parrainer",     tab: "referral",      color: "#007185"  },
          { icon: "fa-bell",          label: "Notifications", tab: "notifications", color: "#232F3E"  },
          { icon: "fa-shield-halved", label: "Sécurité",      tab: "security",      color: "#565959"  },
        ].map(l => (
          <button key={l.tab} onClick={() => setTab(l.tab)}
            className="bg-white border border-[#D5D9D9] hover:border-[#FF9900]/50 rounded p-4 flex items-center gap-3 text-left transition-all group"
          >
            <i className={`fa-solid ${l.icon} text-base`} style={{ color: l.color }}></i>
            <span className="font-black text-[11px] uppercase text-[#0F1111] group-hover:text-[#C45500] transition-colors">{l.label}</span>
            <i className="fa-solid fa-chevron-right text-[#D5D9D9] text-[9px] ml-auto group-hover:text-[#FF9900] transition-colors"></i>
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── ORDERS ───────────────────────────────────────────────────────────────────
const Orders = ({ orders, loading }) => {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[["all","Toutes"],["pending","En attente"],["delivered","Livrées"],["cancelled","Annulées"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest border transition-all ${
              filter === k
                ? "bg-[#232F3E] text-[#FF9900] border-[#232F3E]"
                : "bg-white border-[#D5D9D9] text-[#565959] hover:border-[#FF9900]/50"
            }`}
          >{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-white border border-[#D5D9D9] rounded animate-pulse" />
        ))}</div>
      ) : filtered.length === 0 ? (
        <AmzCard className="text-center py-16 px-4">
          <i className="fa-solid fa-bag-shopping text-[#D5D9D9] text-4xl mb-3 block"></i>
          <p className="font-black text-[#0F1111] uppercase text-sm">Aucune commande</p>
          <Link to="/store"
            className="mt-4 inline-flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] px-6 py-2.5 rounded font-black text-[9px] uppercase tracking-widest transition-colors"
          >Explorer le store →</Link>
        </AmzCard>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => {
            const st    = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
            const items = o.items || [];
            const pts   = Math.floor(Number(o.total_amount || 0) / 100);
            return (
              <AmzCard key={o.id}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#F7F8F8] border-b border-[#D5D9D9]">
                  <div className="flex items-center gap-3">
                    <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded border ${st.bg} ${st.border} ${st.color}`}>
                      <i className={`fa-solid ${st.icon} mr-1`}></i>{st.label}
                    </span>
                    <span className="text-[9px] font-black text-[#565959] uppercase">#{o.id?.slice(-8).toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {o.status === "delivered" && pts > 0 && (
                      <span className="text-[8px] font-black text-[#FF9900] flex items-center gap-1">
                        <i className="fa-solid fa-coins text-[9px]"></i>+{pts} pts
                      </span>
                    )}
                    <span className="text-[9px] text-[#565959] font-bold">{new Date(o.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="px-4 py-3">
                  {items.slice(0, 2).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 mb-2 last:mb-0">
                      <div className="w-10 h-10 bg-[#EAEDED] rounded overflow-hidden flex-shrink-0">
                        {(item.product_img || item.img) && (
                          <img src={item.product_img || item.img} alt="" className="w-full h-full object-contain" />
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="font-black text-[10px] text-[#0F1111] truncate">{item.product_name || item.name}</p>
                        <p className="text-[9px] text-[#565959]">Qté: {item.quantity}</p>
                      </div>
                      <p className="font-black text-[11px] text-[#B12704] flex-shrink-0">{Number(item.unit_price || 0).toLocaleString()} F</p>
                    </div>
                  ))}
                  {items.length > 2 && <p className="text-[9px] text-[#565959] font-bold mt-1">+{items.length - 2} autre(s)</p>}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#D5D9D9] bg-[#F7F8F8]">
                  <div>
                    <p className="text-[9px] text-[#565959] font-bold uppercase">Total commande</p>
                    <p className="font-black text-[#B12704] text-base">{Number(o.total_amount || 0).toLocaleString()} <span className="text-xs text-[#565959]">FCFA</span></p>
                  </div>
                  <div className="flex gap-2">
                    {o.status === "delivered" && (
                      <button className="flex items-center gap-1.5 border border-[#FF9900]/40 text-[#FF9900] px-3 py-2 rounded text-[8px] font-black uppercase hover:bg-[#FF9900]/5 transition-colors">
                        <i className="fa-solid fa-star text-[9px]"></i>Avis
                      </button>
                    )}
                    <button className="flex items-center gap-1.5 border border-[#D5D9D9] text-[#565959] px-3 py-2 rounded text-[8px] font-black uppercase hover:border-[#FF9900]/50 hover:text-[#C45500] transition-colors">
                      <i className="fa-solid fa-eye text-[9px]"></i>Détails
                    </button>
                  </div>
                </div>
              </AmzCard>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── WISHLIST TAB ─────────────────────────────────────────────────────────────
const WishlistTab = ({ items, loading, onRemove, addToCart }) => (
  <div className="space-y-4">
    {loading ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="aspect-[3/4] bg-[#EAEDED] rounded animate-pulse" />)}
      </div>
    ) : !items?.length ? (
      <AmzCard className="text-center py-16 px-4">
        <i className="fa-regular fa-heart text-[#D5D9D9] text-5xl mb-3 block"></i>
        <p className="font-black text-[#0F1111] uppercase text-sm">Aucun favori</p>
        <Link to="/store"
          className="mt-4 inline-flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] px-6 py-2.5 rounded font-black text-[9px] uppercase tracking-widest transition-colors"
        >Explorer →</Link>
      </AmzCard>
    ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map(item => (
          <AmzCard key={item.id} className="group hover:border-[#FF9900]/60 hover:shadow-md transition-all">
            <div className="relative aspect-square overflow-hidden bg-[#EAEDED]">
              {item.product?.img && (
                <img src={item.product.img} alt="" className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105" />
              )}
              <button onClick={() => onRemove(item.id)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white border border-[#D5D9D9] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:border-[#B12704] hover:text-[#B12704] text-[#565959]"
              >
                <i className="fa-solid fa-xmark text-[9px]"></i>
              </button>
            </div>
            <div className="p-3">
              <p className="font-black text-[10px] text-[#0F1111] truncate mb-1">{item.product?.name}</p>
              <p className="font-black text-[#B12704] text-sm mb-2">{Number(item.product?.price || 0).toLocaleString()} F</p>
              <p className="text-[8px] text-[#007185] font-bold mb-2"><i className="fa-solid fa-truck-fast mr-1"></i>Livraison 2h · Douala 🇨🇲</p>
              <button onClick={() => addToCart?.(item.product)}
                className="w-full bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] rounded py-2 text-[8px] font-black uppercase tracking-widest transition-colors"
              >
                <i className="fa-solid fa-cart-plus mr-1"></i>Au panier
              </button>
            </div>
          </AmzCard>
        ))}
      </div>
    )}
  </div>
);

// ─── ADDRESSES ────────────────────────────────────────────────────────────────
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
    } catch (e) { setError(e.message || "Erreur."); } finally { setSaving(false); }
  };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#565959]">{addresses?.length || 0} adresse(s)</p>
        <PrimaryBtn onClick={() => { setShowForm(!showForm); setError(""); }}>
          <i className={`fa-solid ${showForm ? "fa-xmark" : "fa-plus"} text-xs`}></i>
          {showForm ? "Annuler" : "Ajouter"}
        </PrimaryBtn>
      </div>

      {success && (
        <div className="flex items-center gap-3 bg-[#E8F5E8] border border-[#007600]/30 rounded px-4 py-3">
          <i className="fa-solid fa-circle-check text-[#007600]"></i>
          <span className="text-[10px] font-black uppercase text-[#007600] tracking-widest">Adresse enregistrée !</span>
        </div>
      )}

      {showForm && (
        <AmzCard>
          <AmzCardHeader title="Nouvelle adresse" icon="fa-location-dot" />
          <div className="p-4 space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-[#FEE7E5] border border-[#B12704]/30 rounded px-3 py-2.5">
                <i className="fa-solid fa-triangle-exclamation text-[#B12704] text-xs"></i>
                <span className="text-[9px] font-bold text-[#B12704]">{error}</span>
              </div>
            )}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-2">Libellé</p>
              <div className="flex gap-2 flex-wrap mb-2">
                {["Maison","Bureau","Famille","Autre"].map(l => (
                  <button key={l} type="button" onClick={() => set("label", l)}
                    className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest border transition-all ${
                      form.label === l ? "bg-[#232F3E] text-[#FF9900] border-[#232F3E]" : "bg-white border-[#D5D9D9] text-[#565959] hover:border-[#FF9900]/50"
                    }`}
                  >{l}</button>
                ))}
              </div>
              <input value={form.label} onChange={e => set("label", e.target.value)} placeholder="Libellé personnalisé..."
                className="w-full bg-white border border-[#D5D9D9] rounded px-3 py-2.5 text-sm text-[#0F1111] focus:border-[#FF9900] focus:outline-none transition-colors placeholder-[#adb5bd]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AmzInput label="Nom complet *" value={form.full_name} onChange={e => set("full_name", e.target.value)} placeholder="Nom de la personne" />
              <AmzInput label="Téléphone *" type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+237 6XX XXX XXX" />
              <AmzInput label="Ville" value={form.city} onChange={e => set("city", e.target.value)} placeholder="Douala" />
              <AmzInput label="Quartier" value={form.neighborhood} onChange={e => set("neighborhood", e.target.value)} placeholder="Bonamoussadi, Akwa..." />
            </div>
            <AmzInput label="Rue / Avenue *" value={form.street} onChange={e => set("street", e.target.value)} placeholder="Ex: Rue Njo Njo, Avenue Kennedy..." />
            <AmzInput label="Infos supplémentaires" value={form.extra} onChange={e => set("extra", e.target.value)} placeholder="Bâtiment, étage, code d'entrée..." />
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-[#F7F8F8] border border-[#D5D9D9] rounded hover:border-[#FF9900]/50 transition-colors">
              <input type="checkbox" checked={form.is_default} onChange={e => set("is_default", e.target.checked)} className="accent-[#FF9900] w-4 h-4" />
              <div>
                <span className="text-[10px] font-black text-[#0F1111] uppercase">Adresse par défaut</span>
                <p className="text-[9px] text-[#565959] font-bold">Pré-sélectionnée à chaque commande</p>
              </div>
            </label>
            <div className="flex gap-2">
              <PrimaryBtn onClick={handleSave} disabled={saving}>
                {saving ? <><i className="fa-solid fa-spinner fa-spin text-xs"></i>Enregistrement...</> : <><i className="fa-solid fa-check text-xs"></i>Enregistrer</>}
              </PrimaryBtn>
              <SecondaryBtn onClick={() => { setShowForm(false); setForm(EMPTY_ADDR); setError(""); }}>Annuler</SecondaryBtn>
            </div>
          </div>
        </AmzCard>
      )}

      {!addresses?.length && !showForm ? (
        <AmzCard className="text-center py-14 px-4">
          <i className="fa-solid fa-location-dot text-[#D5D9D9] text-4xl mb-3 block"></i>
          <p className="font-black text-[#0F1111] uppercase text-sm">Aucune adresse</p>
          <p className="text-[10px] text-[#565959] mt-1">Ajoutez une adresse pour un checkout plus rapide</p>
        </AmzCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(addresses || []).map(a => (
            <AmzCard key={a.id} className={`relative ${a.is_default ? "border-[#FF9900]/50" : ""}`}>
              {a.is_default && (
                <span className="absolute top-3 right-3 text-[7px] font-black uppercase bg-[#FFF3CD] text-[#FF9900] border border-[#FCD200]/60 px-2 py-0.5 rounded-full">Défaut</span>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fa-solid fa-location-dot text-[#FF9900] text-xs"></i>
                  <span className="font-black text-[12px] text-[#0F1111] uppercase">{a.label || "Adresse"}</span>
                </div>
                <p className="text-[11px] font-bold text-[#0F1111]">{a.full_name}</p>
                <p className="text-[10px] text-[#565959] font-bold">{a.phone}</p>
                <p className="text-[10px] text-[#565959] mt-1">{[a.street, a.neighborhood, a.city].filter(Boolean).join(", ")}</p>
                {a.extra && <p className="text-[9px] text-[#ADBAC7] italic mt-1">{a.extra}</p>}
                <button onClick={() => onDelete(a.id)}
                  className="mt-3 text-[9px] font-black uppercase text-[#565959] hover:text-[#B12704] transition-colors border border-[#D5D9D9] hover:border-[#B12704]/30 px-3 py-1.5 rounded"
                >
                  <i className="fa-solid fa-trash mr-1"></i>Supprimer
                </button>
              </div>
            </AmzCard>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── REVIEWS ──────────────────────────────────────────────────────────────────
const ReviewsTab = ({ reviews }) => (
  <div className="space-y-3">
    {!reviews?.length ? (
      <AmzCard className="text-center py-14 px-4">
        <i className="fa-solid fa-star text-[#D5D9D9] text-4xl mb-3 block"></i>
        <p className="font-black text-[#0F1111] uppercase text-sm">Aucun avis publié</p>
      </AmzCard>
    ) : reviews.map(r => (
      <AmzCard key={r.id}>
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-black text-[12px] text-[#0F1111]">{r.product?.name || "Produit"}</p>
              <p className="text-[9px] text-[#565959]">{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
            </div>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <i key={i} className={`fa-solid fa-star text-xs ${i < r.stars ? "text-[#FF9900]" : "text-[#D5D9D9]"}`}></i>
              ))}
            </div>
          </div>
          {r.comment && <p className="text-[11px] text-[#565959] leading-relaxed">{r.comment}</p>}
        </div>
      </AmzCard>
    ))}
  </div>
);

// ─── REFERRAL ─────────────────────────────────────────────────────────────────
const Referral = ({ profile, userId, onToast }) => {
  const [copied,      setCopied]      = useState(false);
  const [referrals,   setReferrals]   = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const code   = profile?.referral_code || "—";
  const refUrl = `${window.location.origin}/ref/${code}`;

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      supabase.from("referrals")
        .select("id, created_at, referred:profiles!referred_id(full_name, avatar_url)")
        .eq("referrer_id", userId).order("created_at", { ascending: false }),
      supabase.from("affiliate_commissions")
        .select("id, created_at, order_amount, commission_amount, status")
        .eq("referrer_user_id", userId).order("created_at", { ascending: false }),
    ]).then(([{ data: refs }, { data: comms }]) => {
      setReferrals(refs || []);
      setCommissions(comms || []);
      setLoading(false);
    });
  }, [userId]);

  const handleCopy = (val, label = "Copié !") => {
    navigator.clipboard.writeText(val).then(() => {
      setCopied(true); onToast?.(label, "success"); setTimeout(() => setCopied(false), 2000);
    });
  };

  const PALIERS = [
    { n: 1,  pts: 200,  label: "1ᵉʳ ami"  },
    { n: 5,  pts: 1500, label: "5 amis"   },
    { n: 10, pts: 4000, label: "10 amis"  },
  ];

  return (
    <div className="space-y-4">
      {/* Hero */}
      <AmzCard>
        <div className="bg-[#131921] p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #FF9900 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <i className="fa-solid fa-user-plus text-[#FF9900] text-3xl mb-3 block relative z-10"></i>
          <h3 className="font-black text-2xl text-white mb-1 relative z-10">Parraine. Gagne.</h3>
          <p className="text-[#ADBAC7] text-sm mb-5 relative z-10">
            Gagne <span className="text-[#FF9900] font-black">200 pts</span> par ami parrainé · Bonus aux paliers
          </p>
          {/* Code */}
          <div className="flex items-center gap-3 bg-[#232F3E] border border-[#37475A] rounded p-4 max-w-sm mx-auto relative z-10 mb-3">
            <div className="flex-grow text-left">
              <p className="text-[8px] font-black uppercase tracking-widest text-[#ADBAC7] mb-0.5">Votre code</p>
              <span className="font-black text-[#FF9900] text-lg font-mono tracking-[0.2em]">{code}</span>
            </div>
            <button onClick={() => handleCopy(code, "Code copié !")}
              className={`flex items-center gap-2 px-4 py-2 rounded font-black text-[9px] uppercase tracking-widest transition-all flex-shrink-0 ${
                copied ? "bg-[#007600] text-white" : "bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200]"
              }`}
            >
              <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"} text-xs`}></i>{copied ? "Copié !" : "Copier"}
            </button>
          </div>
          {/* Full URL */}
          <div className="flex items-center gap-2 bg-[#232F3E] border border-[#37475A] rounded px-3 py-2 max-w-sm mx-auto relative z-10">
            <p className="flex-grow text-[9px] text-[#ADBAC7] truncate text-left">{refUrl}</p>
            <button onClick={() => handleCopy(refUrl, "Lien copié !")}
              className="flex-shrink-0 text-[#565959] hover:text-[#FF9900] transition-colors px-2"
            >
              <i className={`fa-solid ${copied ? "fa-check" : "fa-link"} text-xs`}></i>
            </button>
          </div>
          {/* Share */}
          <div className="flex gap-2 justify-center mt-4 relative z-10">
            {[
              { icon: "fa-brands fa-whatsapp", label: "WhatsApp", href: `https://wa.me/?text=Rejoins%20OFS%20Elite%20avec%20mon%20code%20${code}%20%3A%20${encodeURIComponent(refUrl)}`, color: "#25D366" },
              { icon: "fa-brands fa-instagram", label: "Instagram", href: "#", color: "#E1306C" },
              { icon: "fa-brands fa-tiktok",    label: "TikTok",    href: "#", color: "#ffffff" },
            ].map(n => (
              <a key={n.label} href={n.href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 flex-1 justify-center py-2.5 rounded border border-[#37475A] text-[#ADBAC7] hover:border-white/30 transition-all text-[10px] font-black uppercase tracking-widest max-w-[110px]"
                style={{ "--hover-color": n.color }}
              >
                <i className={`${n.icon} text-sm`} style={{ color: n.color }}></i>
                <span className="hidden sm:inline">{n.label}</span>
              </a>
            ))}
          </div>
        </div>
      </AmzCard>

      {/* Commissions */}
      {(() => {
        const pending   = commissions.filter(c => c.status === 'pending');
        const confirmed = commissions.filter(c => c.status === 'confirmed' || c.status === 'paid');
        const totalPending   = pending.reduce((s, c) => s + (c.commission_amount || 0), 0);
        const totalConfirmed = confirmed.reduce((s, c) => s + (c.commission_amount || 0), 0);
        return commissions.length > 0 ? (
          <AmzCard>
            <AmzCardHeader title="Mes commissions d'affiliation" icon="fa-money-bill-trend-up" />
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#FFF8D3] border border-[#FCD200]/50 rounded p-3 text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-[#565959] mb-1">En attente</p>
                  <p className="font-black text-lg text-[#FF9900]">{totalPending.toLocaleString()}</p>
                  <p className="text-[8px] text-[#565959]">FCFA · {pending.length} commande{pending.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-[#E8F5E8] border border-[#007600]/20 rounded p-3 text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-[#565959] mb-1">Confirmée{confirmed.length !== 1 ? 's' : ''}</p>
                  <p className="font-black text-lg text-[#007600]">{totalConfirmed.toLocaleString()}</p>
                  <p className="text-[8px] text-[#565959]">FCFA · {confirmed.length} commande{confirmed.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="space-y-2">
                {commissions.slice(0, 8).map(c => {
                  const isPending = c.status === 'pending';
                  return (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-[#F0F2F2] last:border-0">
                      <div>
                        <p className="text-[10px] font-black text-[#0F1111]">
                          Commande · {Number(c.order_amount).toLocaleString()} FCFA
                        </p>
                        <p className="text-[9px] text-[#565959]">{new Date(c.created_at).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-[11px] ${isPending ? 'text-[#FF9900]' : 'text-[#007600]'}`}>
                          +{Number(c.commission_amount).toLocaleString()} F
                        </p>
                        <span className={`text-[8px] font-black uppercase ${isPending ? 'text-[#FF9900]' : 'text-[#007600]'}`}>
                          {isPending ? 'En attente' : c.status === 'paid' ? 'Payée' : 'Confirmée'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </AmzCard>
        ) : null;
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Paliers */}
        <AmzCard>
          <AmzCardHeader title="Paliers de parrainage" icon="fa-trophy" />
          <div className="divide-y divide-[#F0F2F2]">
            {PALIERS.map(p => {
              const done = referrals.length >= p.n;
              return (
                <div key={p.n} className={`flex items-center gap-4 px-4 py-3 ${done ? "bg-[#E8F5E8]" : ""}`}>
                  <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 border ${done ? "bg-[#007600]/10 border-[#007600]/30" : "bg-[#EAEDED] border-[#D5D9D9]"}`}>
                    <i className={`fa-solid fa-user-group text-xs ${done ? "text-[#007600]" : "text-[#565959]"}`}></i>
                  </div>
                  <div className="flex-grow">
                    <p className={`text-[11px] font-black uppercase ${done ? "text-[#007600]" : "text-[#0F1111]"}`}>{p.label}</p>
                    <p className="text-[9px] font-bold text-[#565959]">+{p.pts.toLocaleString()} pts de bonus</p>
                  </div>
                  {done
                    ? <i className="fa-solid fa-circle-check text-[#007600] text-sm flex-shrink-0"></i>
                    : <span className="text-[9px] font-black text-[#565959]">{p.n - referrals.length} restant{p.n - referrals.length > 1 ? "s" : ""}</span>
                  }
                </div>
              );
            })}
          </div>
        </AmzCard>

        {/* Filleuls */}
        <AmzCard>
          <AmzCardHeader title={`Mes filleuls (${referrals.length})`} icon="fa-users" />
          <div className="p-4">
            {loading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-[#EAEDED] rounded animate-pulse" />)}</div>
            ) : referrals.length === 0 ? (
              <div className="text-center py-6">
                <i className="fa-solid fa-user-group text-[#D5D9D9] text-2xl mb-2 block"></i>
                <p className="text-[10px] font-bold text-[#565959]">Partagez votre lien pour commencer !</p>
              </div>
            ) : (
              <div className="space-y-2">
                {referrals.slice(0, 6).map(r => (
                  <div key={r.id} className="flex items-center gap-3 py-1">
                    <div className="w-8 h-8 rounded bg-[#EAEDED] border border-[#D5D9D9] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {r.referred?.avatar_url
                        ? <img src={r.referred.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <span className="text-xs font-black text-[#565959]">{(r.referred?.full_name || "?")[0].toUpperCase()}</span>
                      }
                    </div>
                    <p className="text-xs font-bold text-[#0F1111] flex-grow">{r.referred?.full_name || "Membre OFS"}</p>
                    <span className="text-[9px] font-black text-[#007600]">+200 pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AmzCard>
      </div>
    </div>
  );
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
const NotificationsTab = ({ prefs, onSave }) => {
  const [p,     setP]     = useState(prefs || { order_updates: true, promotions: true, new_products: true, price_drops: true, reviews: true, newsletter: false, sms: false, push: true });
  const [saved, setSaved] = useState(false);

  const handle = async () => { await onSave(p); setSaved(true); setTimeout(() => setSaved(false), 2500); };

  const Toggle = ({ k, label, sub }) => (
    <div className="flex items-center justify-between py-3.5 border-b border-[#F0F2F2] last:border-0">
      <div>
        <p className="font-black text-[12px] text-[#0F1111]">{label}</p>
        {sub && <p className="text-[9px] text-[#565959] font-bold mt-0.5">{sub}</p>}
      </div>
      <button onClick={() => setP(prev => ({ ...prev, [k]: !prev[k] }))}
        className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${p[k] ? "bg-[#FF9900]" : "bg-[#D5D9D9]"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${p[k] ? "left-6" : "left-0.5"}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <AmzCard>
        <AmzCardHeader title="Notifications email" icon="fa-envelope" />
        <div className="px-4">
          <Toggle k="order_updates" label="Mises à jour commandes"  sub="Confirmation, expédition, livraison" />
          <Toggle k="promotions"    label="Promotions & Flash Deals" sub="Offres exclusives et ventes flash"   />
          <Toggle k="new_products"  label="Nouveaux produits"        sub="Alertes nouvelles arrivées"          />
          <Toggle k="price_drops"   label="Baisse de prix"           sub="Sur vos articles en favoris"        />
          <Toggle k="reviews"       label="Avis & feedback"          sub="Demandes d'avis après achat"        />
          <Toggle k="newsletter"    label="Newsletter OFS"           sub="Actualités et tendances"             />
        </div>
      </AmzCard>
      <AmzCard>
        <AmzCardHeader title="Autres canaux" icon="fa-mobile-screen" />
        <div className="px-4">
          <Toggle k="sms"  label="SMS"                sub="Mises à jour livraison par SMS"    />
          <Toggle k="push" label="Notifications push" sub="Alertes instantanées navigateur"   />
        </div>
      </AmzCard>
      <PrimaryBtn onClick={handle} className="w-full py-3">
        <i className={`fa-solid ${saved ? "fa-check" : "fa-floppy-disk"} text-xs`}></i>
        {saved ? "Préférences enregistrées !" : "Enregistrer les préférences"}
      </PrimaryBtn>
    </div>
  );
};

// ─── SECURITY ─────────────────────────────────────────────────────────────────
const Security = ({ user, onToast }) => {
  const [pw,      setPw]      = useState({ current: "", next: "", confirm: "" });
  const [msg,     setMsg]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [delLoading, setDelLoading] = useState(false);

  const handlePw = async () => {
    setMsg(null);
    if (!pw.current.trim()) { setMsg({ type: "error", text: "Veuillez saisir votre mot de passe actuel." }); return; }
    if (pw.next.length < 8) { setMsg({ type: "error", text: "Le nouveau mot de passe doit faire min. 8 caractères." }); return; }
    if (pw.next !== pw.confirm) { setMsg({ type: "error", text: "Les mots de passe ne correspondent pas." }); return; }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: pw.current });
      if (signInError) { setMsg({ type: "error", text: "Mot de passe actuel incorrect." }); setLoading(false); return; }
      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw error;
      setMsg({ type: "ok", text: "Mot de passe mis à jour avec succès !" });
      setPw({ current: "", next: "", confirm: "" });
      onToast?.("Mot de passe mis à jour !", "success");
    } catch (e) { setMsg({ type: "error", text: e.message || "Une erreur est survenue." }); } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    setDelLoading(true);
    try {
      await supabase.auth.admin?.deleteUser(user.id);
      await supabase.auth.signOut();
    } catch (e) { setMsg({ type: "error", text: "La suppression doit être effectuée via le support OFS." }); }
    finally { setDelLoading(false); setDelConfirm(false); }
  };

  return (
    <div className="space-y-4">
      {/* Password */}
      <AmzCard>
        <AmzCardHeader title="Changer le mot de passe" icon="fa-lock" />
        <div className="p-4 space-y-3">
          <p className="text-[10px] text-[#565959] font-bold">Connecté en tant que <span className="text-[#0F1111] font-black">{user?.email}</span></p>
          {[
            { k: "current", label: "Mot de passe actuel",  ph: "Votre mot de passe actuel"     },
            { k: "next",    label: "Nouveau mot de passe",  ph: "Min. 8 caractères"              },
            { k: "confirm", label: "Confirmer le nouveau",  ph: "Répétez le nouveau mot de passe"},
          ].map(f => (
            <AmzInput key={f.k} label={f.label} type="password" value={pw[f.k]}
              onChange={e => setPw(p => ({ ...p, [f.k]: e.target.value }))}
              placeholder={f.ph} onKeyDown={e => e.key === "Enter" && handlePw()}
            />
          ))}

          {pw.next && (
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#565959]">Force du mot de passe</p>
              <div className="flex gap-1">
                {[8, 12, 16].map((len, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
                    pw.next.length >= len
                      ? i === 0 ? "bg-[#B12704]" : i === 1 ? "bg-[#FF9900]" : "bg-[#007600]"
                      : "bg-[#EAEDED]"
                  }`} />
                ))}
              </div>
              <p className="text-[9px] text-[#565959]">
                {pw.next.length < 8 ? "Trop court" : pw.next.length < 12 ? "Faible" : pw.next.length < 16 ? "Moyen" : "Fort"}
              </p>
            </div>
          )}

          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded text-[10px] font-bold border ${
              msg.type === "ok" ? "bg-[#E8F5E8] text-[#007600] border-[#007600]/30" : "bg-[#FEE7E5] text-[#B12704] border-[#B12704]/30"
            }`}>
              <i className={`fa-solid ${msg.type === "ok" ? "fa-check" : "fa-triangle-exclamation"}`}></i>
              {msg.text}
            </div>
          )}

          <PrimaryBtn onClick={handlePw} disabled={loading} className="w-full py-3 mt-2">
            {loading ? <i className="fa-solid fa-spinner fa-spin text-xs"></i> : <i className="fa-solid fa-shield-halved text-xs"></i>}
            Mettre à jour le mot de passe
          </PrimaryBtn>
        </div>
      </AmzCard>

      {/* Session */}
      <AmzCard>
        <AmzCardHeader title="Session active" icon="fa-mobile-screen" />
        <div className="p-4">
          <div className="flex items-center justify-between p-3 bg-[#F7F8F8] border border-[#D5D9D9] rounded">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-globe text-[#565959] text-sm"></i>
              <div>
                <p className="text-[11px] font-black text-[#0F1111]">Navigateur web</p>
                <p className="text-[9px] text-[#565959]">{user?.email}</p>
              </div>
            </div>
            <span className="text-[8px] font-black text-[#007600] bg-[#E8F5E8] border border-[#007600]/30 px-2 py-1 rounded-full uppercase">Actif</span>
          </div>
        </div>
      </AmzCard>

      {/* Danger zone */}
      <div className="bg-white border border-[#B12704]/30 rounded overflow-hidden">
        <div className="bg-[#FEE7E5] px-4 py-3 border-b border-[#B12704]/20">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#B12704] flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>Zone de danger
          </p>
        </div>
        <div className="p-4">
          <p className="text-[10px] text-[#565959] font-bold mb-4">Ces actions sont irréversibles. Procédez avec précaution.</p>
          {!delConfirm ? (
            <button onClick={() => setDelConfirm(true)}
              className="border border-[#B12704]/40 text-[#B12704] px-5 py-2.5 rounded font-black text-[9px] uppercase tracking-widest hover:bg-[#FEE7E5] transition-colors"
            >
              <i className="fa-solid fa-trash-can mr-2"></i>Supprimer mon compte
            </button>
          ) : (
            <div className="space-y-3 bg-[#FEE7E5] border border-[#B12704]/30 rounded p-4">
              <p className="text-[10px] font-black text-[#B12704] uppercase">Êtes-vous sûr ? Cette action est irréversible.</p>
              <div className="flex gap-2">
                <button onClick={handleDelete} disabled={delLoading}
                  className="flex items-center gap-2 bg-[#B12704] text-white px-4 py-2 rounded font-black text-[9px] uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {delLoading ? <i className="fa-solid fa-spinner fa-spin text-xs"></i> : <i className="fa-solid fa-trash-can text-xs"></i>}
                  Oui, supprimer
                </button>
                <SecondaryBtn onClick={() => setDelConfirm(false)}>Annuler</SecondaryBtn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
const Settings = ({ profile, user, onSave, onToast }) => {
  const [form, setForm] = useState({
    full_name: profile?.full_name || "", phone: profile?.phone || "", bio: profile?.bio || "",
    city: profile?.city || "Douala", birthday: profile?.birthday || "", gender: profile?.gender || "",
    instagram: profile?.instagram || "", whatsapp: profile?.whatsapp || "",
  });
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [avatar,        setAvatar]        = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [error,         setError]         = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    setForm({
      full_name: profile?.full_name || "", phone: profile?.phone || "", bio: profile?.bio || "",
      city: profile?.city || "Douala", birthday: profile?.birthday || "", gender: profile?.gender || "",
      instagram: profile?.instagram || "", whatsapp: profile?.whatsapp || "",
    });
  }, [profile?.id]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Photo trop lourde (max 2 MB)."); return; }
    setError(""); setAvatar(file); setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.full_name?.trim()) { setError("Le nom complet est requis."); return; }
    setError(""); setSaving(true);
    try {
      const updates = { ...form };
      if (avatar) {
        const ext  = avatar.name.split(".").pop();
        const path = `avatars/${user.id}.${ext}`;
        const { error: upErr } = await supabase.storage.from("profiles").upload(path, avatar, { upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("profiles").getPublicUrl(path);
        updates.avatar_url = publicUrl + `?t=${Date.now()}`;
      }
      await onSave(updates);
      setSaved(true); onToast?.("Profil mis à jour !", "success");
      setTimeout(() => setSaved(false), 2500);
      setAvatar(null); setAvatarPreview(null);
    } catch (e) { setError(e.message || "Erreur."); onToast?.(e.message || "Erreur", "error"); } finally { setSaving(false); }
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const currentAvatar = avatarPreview || profile?.avatar_url;

  return (
    <div className="space-y-4">
      {/* Photo */}
      <AmzCard>
        <AmzCardHeader title="Photo de profil" icon="fa-user-circle" />
        <div className="p-4 flex items-center gap-5">
          <div onClick={() => fileRef.current?.click()}
            className="relative w-20 h-20 rounded overflow-hidden border-2 border-[#FF9900] bg-[#232F3E] cursor-pointer flex-shrink-0 group"
          >
            {currentAvatar
              ? <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center">
                  <span className="font-black text-[#FF9900] text-2xl">{(form.full_name || "?")[0].toUpperCase()}</span>
                </div>
            }
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <i className="fa-solid fa-camera text-white text-lg"></i>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <div>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 border border-[#D5D9D9] text-[#0F1111] hover:border-[#FF9900]/50 px-4 py-2 rounded font-black text-[9px] uppercase tracking-widest transition-colors mb-2"
            >
              <i className="fa-solid fa-upload text-xs"></i>{avatar ? "Changer la sélection" : "Changer la photo"}
            </button>
            <p className="text-[8px] text-[#565959] font-bold">JPG, PNG, WebP · Max 2 MB</p>
            {avatar && <p className="text-[8px] text-[#007600] font-bold mt-1"><i className="fa-solid fa-check mr-1"></i>{avatar.name} sélectionné</p>}
          </div>
        </div>
      </AmzCard>

      {/* Infos personnelles */}
      <AmzCard>
        <AmzCardHeader title="Informations personnelles" icon="fa-id-card" />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AmzInput label="Nom complet *" value={form.full_name} onChange={e => set("full_name", e.target.value)} placeholder="Votre nom complet" />
            <AmzInput label="Téléphone" type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+237 6XX XXX XXX" />
            <AmzInput label="Ville" value={form.city} onChange={e => set("city", e.target.value)} placeholder="Douala" />
            <AmzInput label="Date de naissance" type="date" value={form.birthday} onChange={e => set("birthday", e.target.value)} />
            <AmzSelect label="Genre" value={form.gender} onChange={e => set("gender", e.target.value)}>
              <option value="">Non précisé</option>
              <option value="H">Homme</option>
              <option value="F">Femme</option>
              <option value="autre">Autre</option>
            </AmzSelect>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1.5 block">Bio</label>
            <textarea value={form.bio} onChange={e => set("bio", e.target.value)} rows={3}
              placeholder="Quelques mots sur vous..."
              className="w-full bg-white border border-[#D5D9D9] rounded px-3 py-2.5 text-sm text-[#0F1111] focus:border-[#FF9900] focus:outline-none transition-colors placeholder-[#adb5bd] resize-none"
            />
          </div>
        </div>
      </AmzCard>

      {/* Réseaux */}
      <AmzCard>
        <AmzCardHeader title="Réseaux sociaux" icon="fa-share-nodes" />
        <div className="p-4 space-y-3">
          {[
            { k: "instagram", icon: "fa-brands fa-instagram", label: "Instagram", ph: "@votre_handle", color: "#E1306C" },
            { k: "whatsapp",  icon: "fa-brands fa-whatsapp",  label: "WhatsApp",  ph: "+237 6XX XXX XXX", color: "#25D366" },
          ].map(f => (
            <div key={f.k} className="flex items-center gap-3">
              <i className={`${f.icon} text-base w-5 flex-shrink-0`} style={{ color: f.color }}></i>
              <input value={form[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.ph}
                className="flex-grow bg-white border border-[#D5D9D9] rounded px-3 py-2.5 text-sm text-[#0F1111] focus:border-[#FF9900] focus:outline-none transition-colors placeholder-[#adb5bd]"
              />
            </div>
          ))}
        </div>
      </AmzCard>

      {/* Email */}
      <AmzCard>
        <AmzCardHeader title="Email" icon="fa-envelope" />
        <div className="p-4">
          <div className="flex items-center gap-3 bg-[#F7F8F8] border border-[#D5D9D9] rounded px-4 py-3">
            <span className="text-sm font-bold text-[#565959] flex-grow">{user?.email}</span>
            <span className="text-[7px] font-black uppercase text-[#007600] bg-[#E8F5E8] border border-[#007600]/30 px-2 py-0.5 rounded-full">Vérifié</span>
          </div>
        </div>
      </AmzCard>

      {error && (
        <div className="flex items-center gap-2 bg-[#FEE7E5] border border-[#B12704]/30 rounded px-4 py-3">
          <i className="fa-solid fa-triangle-exclamation text-[#B12704] text-xs"></i>
          <span className="text-[9px] font-bold text-[#B12704]">{error}</span>
        </div>
      )}

      <PrimaryBtn onClick={handleSave} disabled={saving} className={`w-full py-3 ${saved ? "!bg-[#007600] !border-[#007600] !text-white" : ""}`}>
        {saving ? <i className="fa-solid fa-spinner fa-spin text-xs"></i> : <i className={`fa-solid ${saved ? "fa-check" : "fa-floppy-disk"} text-xs`}></i>}
        {saving ? "Enregistrement..." : saved ? "Profil mis à jour !" : "Enregistrer les modifications"}
      </PrimaryBtn>
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

  const showToast = useCallback((message, type = "success") => setToast({ message, type }), []);
  const hideToast = useCallback(() => setToast(null), []);

  useEffect(() => { if (!authLoading && !user) navigate("/login", { state: { from: "/profile" } }); }, [user, authLoading]);

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
        if (!profileData.referral_code) {
          const code = generateReferralCode(user.id);
          await supabase.from("profiles").update({ referral_code: code }).eq("id", user.id);
          profileData = { ...profileData, referral_code: code };
        }
        setProfile(profileData); setOrders(oR.data || []); setWishlist(wR.data || []);
        setReviews(rR.data || []); setAddresses(aR.data || []);
        const delivered = (oR.data || []).filter(o => o.status === "delivered");
        const newPts    = await syncOrderPoints(user.id, delivered);
        const { data: freshProfile } = await supabase.from("profiles").select("loyalty_points").eq("id", user.id).single();
        const totalPts = freshProfile?.loyalty_points || profileData.loyalty_points || 0;
        setLoyaltyPoints(totalPts);
        if (newPts > 0) showToast(`+${newPts} pts OFS crédités pour vos achats !`, "info");
      } catch (e) { console.error("ProfilePage load error:", e); } finally { setLoading(false); }
    })();
  }, [user]);

  const saveProfile = async (data) => {
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...data, updated_at: new Date().toISOString() });
    if (error) throw error;
    setProfile(p => ({ ...p, ...data }));
  };
  const saveAddress = async (data) => {
    const { data: res, error } = await supabase.from("user_addresses").insert({ user_id: user.id, ...data }).select().single();
    if (error) throw new Error(error.message);
    if (res.is_default) {
      await supabase.from("user_addresses").update({ is_default: false }).eq("user_id", user.id).neq("id", res.id);
      setAddresses(prev => [res, ...prev.map(a => ({ ...a, is_default: false }))]);
    } else { setAddresses(prev => [...prev, res]); }
  };
  const deleteAddress  = async (id) => { const { error } = await supabase.from("user_addresses").delete().eq("id", id); if (!error) setAddresses(prev => prev.filter(a => a.id !== id)); };
  const removeWishlist = async (id) => { await supabase.from("wishlists").delete().eq("id", id); setWishlist(prev => prev.filter(w => w.id !== id)); };
  const saveNotifPrefs = async (prefs) => { await supabase.from("profiles").upsert({ id: user.id, notification_prefs: prefs }); showToast("Préférences enregistrées !", "success"); };

  if (authLoading) return (
    <div className="min-h-screen bg-[#EAEDED] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <i className="fa-solid fa-spinner fa-spin text-[#FF9900] text-3xl"></i>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#565959]">Chargement...</p>
      </div>
    </div>
  );
  if (!user) return null;

  const tier    = getTier(loyaltyPoints || profile?.loyalty_points || 0);
  const tierCfg = TIER_CONFIG[tier];
  const activeTab = TABS.find(t => t.key === tab);
  const pendingCount = orders.filter(o => o.status === "pending").length;

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
    <div className="min-h-screen bg-[#EAEDED] text-[#0F1111]">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5">

        {/* ── PROFILE HEADER ── */}
        <div className="bg-[#131921] rounded overflow-hidden mb-4">
          {/* Banner */}
          <div className="h-20 bg-[#232F3E] relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.06]"
              style={{ backgroundImage: "linear-gradient(rgba(255,153,0,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,153,0,1) 1px,transparent 1px)", backgroundSize: "30px 30px" }}
            />
            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-15">
              <i className={`fa-solid ${tierCfg.icon} text-[60px]`} style={{ color: tierCfg.color }}></i>
            </div>
          </div>
          {/* Info */}
          <div className="px-6 pb-5 -mt-8 flex flex-col sm:flex-row sm:items-end gap-4">
            <Avatar url={profile?.avatar_url} name={profile?.full_name || user?.email} size={20} onClick={() => setTab("settings")} />
            <div className="flex-grow min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <h1 className="font-black text-xl text-white uppercase leading-none">
                  {profile?.full_name || user?.email?.split("@")[0]}
                </h1>
                <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-full border border-current"
                  style={{ color: tierCfg.color, borderColor: tierCfg.color + "55", background: tierCfg.color + "22" }}>
                  <i className={`fa-solid ${tierCfg.icon} mr-1 text-[7px]`}></i>{tierCfg.label}
                </span>
                <span className="text-[8px] font-black text-[#FF9900] bg-[#FF9900]/15 border border-[#FF9900]/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <i className="fa-solid fa-coins text-[8px]"></i>
                  {(loyaltyPoints || profile?.loyalty_points || 0).toLocaleString()} pts
                </span>
              </div>
              <p className="text-[10px] text-[#ADBAC7] font-bold mt-1">{user?.email}</p>
              {profile?.bio && <p className="text-[11px] text-[#ADBAC7] mt-1 italic">"{profile.bio}"</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              <Link to="/rewards"
                className="flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] px-3 py-2 rounded font-black text-[9px] uppercase tracking-widest transition-colors"
              >
                <i className="fa-solid fa-gift text-xs"></i>
                <span className="hidden sm:inline">Rewards</span>
              </Link>
              <button onClick={() => setTab("settings")}
                className="flex items-center gap-2 border border-[#37475A] text-[#ADBAC7] hover:text-white hover:border-[#FF9900]/50 px-3 py-2 rounded font-black text-[9px] uppercase tracking-widest transition-colors"
              >
                <i className="fa-solid fa-pen-to-square text-xs"></i>
                <span className="hidden sm:inline">Modifier</span>
              </button>
              <button onClick={signOut}
                className="flex items-center gap-2 border border-[#B12704]/30 text-[#B12704] hover:bg-[#B12704]/10 px-3 py-2 rounded font-black text-[9px] uppercase tracking-widest transition-colors"
              >
                <i className="fa-solid fa-right-from-bracket text-xs"></i>
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-start">

          {/* ── SIDEBAR desktop ── */}
          <aside className="hidden lg:block w-52 flex-shrink-0">
            <AmzCard className="mb-3">
              <div className="bg-[#232F3E] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900]">Mon Compte</p>
              </div>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold border-b border-[#F0F2F2] last:border-0 transition-colors ${
                    tab === t.key ? "bg-[#FFF8D3] text-[#C45500] font-black" : "text-[#0F1111] hover:bg-[#EAEDED]"
                  }`}
                >
                  <i className={`fa-solid ${t.icon} text-xs w-4`} style={{ color: tab === t.key ? "#FF9900" : "#565959" }}></i>
                  <span>{t.label}</span>
                  {t.key === "orders" && pendingCount > 0 && (
                    <span className="ml-auto bg-[#FF9900] text-[#0F1111] text-[7px] font-black rounded-full px-1.5 py-0.5">{pendingCount}</span>
                  )}
                </button>
              ))}
            </AmzCard>
            <AmzCard>
              <div className="bg-[#232F3E] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900]">Explorer</p>
              </div>
              {[
                { to: "/store",     icon: "fa-bag-shopping", label: "Store"        },
                { to: "/rewards",   icon: "fa-gift",         label: "OFS Rewards"  },
                { to: "/boutiques", icon: "fa-store",        label: "Boutiques"    },
              ].map(l => (
                <Link key={l.to} to={l.to}
                  className="flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-[#007185] hover:text-[#C45500] hover:bg-[#EAEDED] border-b border-[#F0F2F2] last:border-0 transition-colors"
                >
                  <i className={`fa-solid ${l.icon} text-xs w-4`}></i><span>{l.label}</span>
                </Link>
              ))}
            </AmzCard>
            {/* Trust block */}
            <div className="bg-[#131921] border border-[#232F3E] rounded p-4 mt-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900] mb-3">
                <i className="fa-solid fa-shield-halved mr-1.5"></i>Achat sécurisé
              </p>
              {[
                { icon: "fa-truck-fast",    text: "Livraison 2h · Douala"    },
                { icon: "fa-mobile-screen", text: "Orange Money · MTN MoMo"  },
                { icon: "fa-rotate-left",   text: "Retour sous 7 jours"      },
                { icon: "fa-headset",       text: "Support WhatsApp 7j/7"    },
              ].map(i => (
                <div key={i.text} className="flex items-center gap-2 mb-2">
                  <i className={`fa-solid ${i.icon} text-[#FF9900] text-[10px] w-3.5 flex-shrink-0`}></i>
                  <span className="text-[10px] text-[#ADBAC7]">{i.text}</span>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-[#232F3E] text-center">
                <span className="text-[9px] font-black uppercase text-[#37475A]">OneFreestyle · Douala 🇨🇲</span>
              </div>
            </div>
          </aside>

          {/* ── CONTENT ── */}
          <div className="flex-grow min-w-0">

            {/* Mobile nav */}
            <div className="lg:hidden mb-4">
              <button onClick={() => setMobileNav(!mobileNav)}
                className="w-full flex items-center justify-between bg-white border border-[#D5D9D9] rounded px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <i className={`fa-solid ${activeTab?.icon} text-[#FF9900] text-sm`}></i>
                  <span className="font-black text-[11px] uppercase text-[#0F1111]">{activeTab?.label}</span>
                </div>
                <i className={`fa-solid fa-chevron-down text-[#565959] text-xs transition-transform ${mobileNav ? "rotate-180" : ""}`}></i>
              </button>
              {mobileNav && (
                <div className="bg-white border border-[#D5D9D9] rounded mt-1 overflow-hidden border-t-0 rounded-t-none">
                  {TABS.map(t => (
                    <button key={t.key} onClick={() => { setTab(t.key); setMobileNav(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#F0F2F2] last:border-0 font-bold text-[11px] transition-colors ${
                        tab === t.key ? "bg-[#FFF8D3] text-[#C45500] font-black" : "text-[#0F1111] hover:bg-[#EAEDED]"
                      }`}
                    >
                      <i className={`fa-solid ${t.icon} text-xs w-4`} style={{ color: tab === t.key ? "#FF9900" : "#565959" }}></i>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Section title */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 bg-[#FF9900] rounded-full"></div>
              <h2 className="font-black text-lg uppercase text-[#0F1111]">{activeTab?.label}</h2>
            </div>

            {/* Tab content */}
            {loading && !["settings","security","notifications","addresses","referral"].includes(tab)
              ? <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white border border-[#D5D9D9] rounded animate-pulse" />)}</div>
              : CONTENT[tab]
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
