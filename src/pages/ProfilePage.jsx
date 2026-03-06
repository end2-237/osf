import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const TABS = [
  { key:"overview",       label:"Accueil",      icon:"fa-house"         },
  { key:"orders",         label:"Commandes",    icon:"fa-bag-shopping"  },
  { key:"wishlist",       label:"Favoris",      icon:"fa-heart"         },
  { key:"addresses",      label:"Adresses",     icon:"fa-location-dot"  },
  { key:"reviews",        label:"Avis",         icon:"fa-star"          },
  { key:"referral",       label:"Parrainage",   icon:"fa-user-plus"     },
  { key:"notifications",  label:"Notifications",icon:"fa-bell"          },
  { key:"security",       label:"Sécurité",     icon:"fa-shield-halved" },
  { key:"settings",       label:"Mon Profil",   icon:"fa-pen-to-square" },
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
const getTier = (pts) => pts>=5000?"platinum":pts>=2000?"gold":pts>=500?"silver":"bronze";

const Avatar = ({ url, name, size=20, onClick }) => (
  <div onClick={onClick}
    className={`relative rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 ${onClick?"cursor-pointer":""}`}
    style={{ width:size*4, height:size*4 }}
  >
    {url
      ? <img src={url} alt={name} className="w-full h-full object-cover"/>
      : <div className="w-full h-full flex items-center justify-center">
          <span className="font-black text-primary" style={{fontSize:size*1.4}}>{(name||"?")[0].toUpperCase()}</span>
        </div>
    }
    {onClick && (
      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
        <i className="fa-solid fa-camera text-white text-lg"></i>
      </div>
    )}
  </div>
);

const Stat = ({ icon, value, label, color="text-primary" }) => (
  <div className="bg-zinc-950 border border-white/5 rounded-2xl p-4 text-center hover:border-primary/20 transition-colors">
    <i className={`fa-solid ${icon} ${color} text-sm mb-2 block`}></i>
    <p className={`font-black text-xl ${color}`}>{value}</p>
    <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">{label}</p>
  </div>
);

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
const Overview = ({ profile, orders, wishlist, reviews, setTab }) => {
  const tier=getTier(profile?.loyalty_points||0), cfg=TIER_CONFIG[tier];
  const pts=profile?.loyalty_points||0;
  const pct=Math.min(((pts-cfg.min)/(cfg.max-cfg.min))*100,100);
  const recent=(orders||[]).slice(0,3);
  return (
    <div className="space-y-6">
      <div className={`bg-gradient-to-br ${cfg.bg} border border-white/10 rounded-3xl p-6 relative overflow-hidden`}>
        <div className="absolute -right-8 -top-8 opacity-[0.06]"><i className={`fa-solid ${cfg.icon} text-[10rem] ${cfg.color}`}></i></div>
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
            <div className={`h-full rounded-full transition-all duration-1000 ${cfg.color.replace("text-","bg-")}`} style={{width:pct+"%"}}/>
          </div>
          <div className="flex justify-between">
            <span className="text-[8px] font-bold text-zinc-500">{pts} pts</span>
            <span className="text-[8px] font-bold text-zinc-500">{cfg.max<99999?`${cfg.max} pts pour le niveau suivant`:"Niveau max 🎉"}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon="fa-bag-shopping" value={orders?.length||0}  label="Commandes" color="text-primary"/>
        <Stat icon="fa-heart"        value={wishlist?.length||0} label="Favoris"   color="text-red-400"/>
        <Stat icon="fa-star"         value={reviews?.length||0}  label="Avis"      color="text-yellow-400"/>
        <Stat icon="fa-crown"        value="−20%"                label="Réduction" color="text-yellow-300"/>
      </div>
      {recent.length>0 && (
        <div className="bg-zinc-950 border border-white/5 rounded-3xl overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-white/5">
            <span className="font-black text-sm uppercase tracking-tight text-white">Commandes récentes</span>
            <button onClick={()=>setTab("orders")} className="text-[9px] font-black uppercase text-primary hover:underline">Voir tout →</button>
          </div>
          <div className="divide-y divide-white/5">
            {recent.map(o=>{const st=ORDER_STATUS[o.status]||ORDER_STATUS.pending;return(
              <div key={o.id} className="flex items-center gap-4 p-4 hover:bg-white/2 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${st.bg} border ${st.border} flex-shrink-0`}>
                  <i className={`fa-solid ${st.icon} ${st.color} text-xs`}></i>
                </div>
                <div className="flex-grow min-w-0">
                  <p className="font-black text-[11px] text-white truncate">#{o.id?.slice(-8).toUpperCase()}</p>
                  <p className="text-[9px] text-zinc-500 font-bold">{new Date(o.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-[11px] text-white">{Number(o.total_amount||0).toLocaleString()} F</p>
                  <span className={`text-[8px] font-black uppercase ${st.color}`}>{st.label}</span>
                </div>
              </div>
            );})}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {[
          {icon:"fa-location-dot",  label:"Mes adresses",  tab:"addresses",     color:"text-orange-400", bg:"bg-orange-400/8 border-orange-400/15"},
          {icon:"fa-user-plus",     label:"Parrainer",     tab:"referral",      color:"text-blue-400",   bg:"bg-blue-400/8 border-blue-400/15"},
          {icon:"fa-bell",          label:"Notifications", tab:"notifications", color:"text-purple-400", bg:"bg-purple-400/8 border-purple-400/15"},
          {icon:"fa-shield-halved", label:"Sécurité",      tab:"security",      color:"text-primary",    bg:"bg-primary/8 border-primary/15"},
        ].map(l=>(
          <button key={l.tab} onClick={()=>setTab(l.tab)}
            className={`flex items-center gap-3 p-4 rounded-2xl border text-left hover:scale-[1.02] transition-transform ${l.bg}`}>
            <i className={`fa-solid ${l.icon} ${l.color} text-base`}></i>
            <span className="font-black text-[11px] uppercase tracking-wide text-white">{l.label}</span>
            <i className="fa-solid fa-chevron-right text-zinc-600 text-[9px] ml-auto"></i>
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── ORDERS ───────────────────────────────────────────────────────────────────
const Orders = ({ orders, loading }) => {
  const [filter, setFilter] = useState("all");
  const filtered = filter==="all" ? orders : orders.filter(o=>o.status===filter);
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[["all","Toutes"],["pending","En attente"],["delivered","Livrées"],["cancelled","Annulées"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${filter===k?"bg-primary text-black border-primary":"border-white/10 text-zinc-400 hover:border-white/20"}`}
          >{l}</button>
        ))}
      </div>
      {loading ? <div className="space-y-3">{[...Array(3)].map((_,i)=><div key={i} className="h-20 bg-zinc-900 rounded-2xl animate-pulse"/>)}</div>
      : filtered.length===0 ? (
        <div className="text-center py-16 border border-white/5 rounded-3xl">
          <i className="fa-solid fa-bag-shopping text-zinc-700 text-4xl mb-3 block"></i>
          <p className="font-black text-white uppercase text-sm">Aucune commande</p>
          <Link to="/store" className="mt-3 inline-flex items-center gap-2 bg-primary text-black px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition">Explorer →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o=>{const st=ORDER_STATUS[o.status]||ORDER_STATUS.pending;const items=o.items||[];return(
            <div key={o.id} className="bg-zinc-950 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full border ${st.bg} ${st.border} ${st.color}`}><i className={`fa-solid ${st.icon} mr-1`}></i>{st.label}</span>
                  <span className="text-[9px] font-black text-zinc-400 uppercase">#{o.id?.slice(-8).toUpperCase()}</span>
                </div>
                <span className="text-[9px] text-zinc-500 font-bold">{new Date(o.created_at).toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="px-5 py-4">
                {items.slice(0,2).map((item,i)=>(
                  <div key={i} className="flex items-center gap-3 mb-2 last:mb-0">
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl overflow-hidden flex-shrink-0">
                      {(item.product_img||item.img)&&<img src={item.product_img||item.img} alt="" className="w-full h-full object-cover"/>}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="font-black text-[10px] text-white truncate">{item.product_name||item.name}</p>
                      <p className="text-[8px] text-zinc-500">Qté: {item.quantity}</p>
                    </div>
                    <p className="font-black text-[11px] text-white flex-shrink-0">{Number(item.unit_price||0).toLocaleString()} F</p>
                  </div>
                ))}
                {items.length>2&&<p className="text-[8px] text-zinc-500 font-bold mt-1">+{items.length-2} autre(s)</p>}
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 bg-white/[0.02]">
                <div>
                  <p className="text-[8px] text-zinc-500 font-bold uppercase">Total</p>
                  <p className="font-black text-primary text-base">{Number(o.total_amount||0).toLocaleString()} <span className="text-xs text-zinc-400">FCFA</span></p>
                </div>
                <div className="flex gap-2">
                  {o.status==="delivered"&&<button className="flex items-center gap-1.5 border border-yellow-400/30 text-yellow-400 px-3 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-yellow-400/10 transition"><i className="fa-solid fa-star"></i> Avis</button>}
                  <button className="flex items-center gap-1.5 border border-white/10 text-zinc-400 px-3 py-2 rounded-xl text-[8px] font-black uppercase hover:border-primary/30 hover:text-primary transition"><i className="fa-solid fa-eye"></i> Détails</button>
                </div>
              </div>
            </div>
          );})}
        </div>
      )}
    </div>
  );
};

// ─── WISHLIST ─────────────────────────────────────────────────────────────────
const WishlistTab = ({ items, loading, onRemove, addToCart }) => (
  <div className="space-y-4">
    {loading ? <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{[...Array(6)].map((_,i)=><div key={i} className="aspect-[3/4] bg-zinc-900 rounded-2xl animate-pulse"/>)}</div>
    : !items?.length ? (
      <div className="text-center py-16 border border-white/5 rounded-3xl">
        <i className="fa-regular fa-heart text-zinc-700 text-5xl mb-3 block"></i>
        <p className="font-black text-white uppercase text-sm">Aucun favori</p>
        <Link to="/store" className="mt-3 inline-flex items-center gap-2 bg-primary text-black px-6 py-2.5 rounded-xl font-black text-[9px] uppercase hover:bg-white transition">Explorer →</Link>
      </div>
    ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(item=>(
          <div key={item.id} className="bg-zinc-950 border border-white/5 rounded-2xl overflow-hidden group hover:border-primary/20 transition-all">
            <div className="relative aspect-square overflow-hidden bg-zinc-900">
              {item.product?.img&&<img src={item.product.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>}
              <button onClick={()=>onRemove(item.id)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20">
                <i className="fa-solid fa-xmark text-white text-[9px]"></i>
              </button>
            </div>
            <div className="p-3">
              <p className="font-black text-[10px] text-white truncate mb-1">{item.product?.name}</p>
              <p className="font-black text-primary text-sm mb-2">{Number(item.product?.price||0).toLocaleString()} F</p>
              <button onClick={()=>addToCart(item.product)} className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-black border border-primary/20 hover:border-primary rounded-xl py-2 text-[8px] font-black uppercase tracking-widest transition-all">
                <i className="fa-solid fa-bag-shopping mr-1"></i>Ajouter
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─── ADDRESSES ────────────────────────────────────────────────────────────────
const EMPTY_FORM = { label:"Maison", full_name:"", phone:"", city:"Douala", neighborhood:"", street:"", extra:"", is_default:false };

const Addresses = ({ addresses, onSave, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
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
      setForm(EMPTY_FORM); setShowForm(false);
      setSuccess(true); setTimeout(()=>setSuccess(false), 3000);
    } catch(e) { setError(e.message||"Erreur lors de l'enregistrement."); }
    finally { setSaving(false); }
  };

  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{addresses?.length||0} adresse(s)</p>
        <button onClick={()=>{setShowForm(!showForm);setError("");}}
          className="flex items-center gap-2 bg-primary text-black px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition">
          <i className={`fa-solid ${showForm?"fa-xmark":"fa-plus"} text-xs`}></i>
          {showForm?"Annuler":"Ajouter"}
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

          {/* Libellé rapide */}
          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Libellé</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {["Maison","Bureau","Famille","Autre"].map(l=>(
                <button key={l} type="button" onClick={()=>set("label",l)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition ${form.label===l?"bg-primary text-black border-primary":"border-white/10 text-zinc-400 hover:border-white/20"}`}
                >{l}</button>
              ))}
            </div>
            <input value={form.label} onChange={e=>set("label",e.target.value)} placeholder="Libellé personnalisé..."
              className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"/>
          </div>

          {/* Nom + Téléphone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[{k:"full_name",label:"Nom complet *",type:"text",ph:"Nom de la personne"},
              {k:"phone",    label:"Téléphone *",  type:"tel", ph:"+237 6XX XXX XXX"}].map(f=>(
              <div key={f.k}>
                <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">{f.label}</label>
                <input type={f.type} value={form[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph}
                  className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"/>
              </div>
            ))}
          </div>

          {/* Ville + Quartier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[{k:"city",label:"Ville",ph:"Douala"},{k:"neighborhood",label:"Quartier",ph:"Bonamoussadi, Akwa..."}].map(f=>(
              <div key={f.k}>
                <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">{f.label}</label>
                <input value={form[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph}
                  className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"/>
              </div>
            ))}
          </div>

          {/* Rue */}
          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Rue / Avenue *</label>
            <input value={form.street} onChange={e=>set("street",e.target.value)} placeholder="Ex: Rue Njo Njo, Avenue Kennedy..."
              className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"/>
          </div>

          {/* Extra */}
          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Infos supplémentaires</label>
            <input value={form.extra} onChange={e=>set("extra",e.target.value)} placeholder="Bâtiment, étage, code d'entrée..."
              className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"/>
          </div>

          {/* Défaut */}
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-zinc-900/50 rounded-xl border border-white/5 hover:border-primary/20 transition">
            <input type="checkbox" checked={form.is_default} onChange={e=>set("is_default",e.target.checked)} className="accent-primary w-4 h-4"/>
            <div>
              <span className="text-[10px] font-black text-white uppercase tracking-wide">Adresse par défaut</span>
              <p className="text-[8px] text-zinc-500 font-bold mt-0.5">Pré-sélectionnée à chaque commande</p>
            </div>
          </label>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-primary text-black px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition disabled:opacity-50">
              {saving?<><i className="fa-solid fa-spinner fa-spin text-xs"></i>Enregistrement...</>:<><i className="fa-solid fa-check text-xs"></i>Enregistrer</>}
            </button>
            <button onClick={()=>{setShowForm(false);setForm(EMPTY_FORM);setError("");}}
              className="border border-white/10 text-zinc-400 px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:border-white/20 transition">
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
          {(addresses||[]).map(a=>(
            <div key={a.id} className={`bg-zinc-950 border rounded-2xl p-5 relative hover:border-white/10 transition-colors ${a.is_default?"border-primary/30":"border-white/5"}`}>
              {a.is_default&&<span className="absolute top-3 right-3 text-[7px] font-black uppercase bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded-full">Défaut</span>}
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-location-dot text-primary text-xs"></i>
                <span className="font-black text-[12px] text-white uppercase">{a.label||"Adresse"}</span>
              </div>
              <p className="text-[11px] font-bold text-zinc-300">{a.full_name}</p>
              <p className="text-[10px] text-zinc-500 font-bold">{a.phone}</p>
              <p className="text-[10px] text-zinc-400 font-bold mt-1">{[a.street,a.neighborhood,a.city].filter(Boolean).join(", ")}</p>
              {a.extra&&<p className="text-[9px] text-zinc-600 italic mt-1">{a.extra}</p>}
              <button onClick={()=>onDelete(a.id)}
                className="mt-4 text-[8px] font-black uppercase text-zinc-400 hover:text-red-400 transition border border-white/8 hover:border-red-400/30 px-3 py-1.5 rounded-lg">
                <i className="fa-solid fa-trash mr-1"></i>Supprimer
              </button>
            </div>
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
      <div className="text-center py-12 border border-white/5 rounded-3xl">
        <i className="fa-solid fa-star text-zinc-700 text-4xl mb-3 block"></i>
        <p className="font-black text-white uppercase text-sm">Aucun avis publié</p>
      </div>
    ) : reviews.map(r=>(
      <div key={r.id} className="bg-zinc-950 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-black text-[12px] text-white">{r.product?.name||"Produit"}</p>
            <p className="text-[9px] text-zinc-500">{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
          </div>
          <div className="flex gap-0.5">{[...Array(5)].map((_,i)=><i key={i} className={`fa-solid fa-star text-xs ${i<r.stars?"text-yellow-400":"text-zinc-700"}`}></i>)}</div>
        </div>
        {r.comment&&<p className="text-[11px] text-zinc-400 font-bold leading-relaxed">{r.comment}</p>}
      </div>
    ))}
  </div>
);

// ─── REFERRAL ─────────────────────────────────────────────────────────────────
const Referral = ({ profile }) => {
  const code=(profile?.referral_code||("OFS-"+(profile?.id||"XXXX").slice(0,6).toUpperCase()));
  const [copied,setCopied]=useState(false);
  const copy=()=>{navigator.clipboard.writeText(`https://onefreestyle.com/register?ref=${code}`);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-400/20 rounded-3xl p-7 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:"radial-gradient(circle, #3b82f6 1px, transparent 1px)",backgroundSize:"24px 24px"}}/>
        <i className="fa-solid fa-user-plus text-blue-400 text-3xl mb-4 block relative z-10"></i>
        <h3 className="font-black text-2xl italic tracking-tighter text-white mb-2 relative z-10">Parraine. Gagne. <span className="text-blue-400">Repeat.</span></h3>
        <p className="text-zinc-400 font-bold text-sm mb-6 relative z-10">Gagne <span className="text-primary font-black">500 pts</span> par ami parrainé</p>
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl p-3 max-w-sm mx-auto relative z-10">
          <span className="font-black text-primary text-sm flex-grow text-left font-mono tracking-widest">{code}</span>
          <button onClick={copy} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex-shrink-0 ${copied?"bg-primary text-black":"bg-blue-500/20 border border-blue-400/30 text-blue-300 hover:bg-blue-500/30"}`}>
            <i className={`fa-solid ${copied?"fa-check":"fa-copy"} text-xs`}></i>{copied?"Copié !":"Copier"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[{n:1,pts:500,icon:"fa-user",label:"1 ami",color:"text-zinc-300",bg:"bg-zinc-300/10 border-zinc-300/20"},
          {n:5,pts:3000,icon:"fa-users",label:"5 amis",color:"text-yellow-400",bg:"bg-yellow-400/10 border-yellow-400/20"},
          {n:10,pts:7500,icon:"fa-users-line",label:"10 amis",color:"text-primary",bg:"bg-primary/10 border-primary/20"}].map(p=>(
          <div key={p.n} className={`border rounded-2xl p-4 text-center ${p.bg}`}>
            <i className={`fa-solid ${p.icon} ${p.color} text-xl mb-2 block`}></i>
            <p className={`font-black text-lg ${p.color}`}>{p.pts.toLocaleString()} pts</p>
            <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">{p.label} parrainé(s)</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
const NotificationsTab = ({ prefs, onSave }) => {
  const [p,setP]=useState(prefs||{order_updates:true,promotions:true,new_products:true,price_drops:true,reviews:true,newsletter:false,sms:false,push:true});
  const [saved,setSaved]=useState(false);
  const handle=async()=>{await onSave(p);setSaved(true);setTimeout(()=>setSaved(false),2500);};
  const Toggle=({k,label,sub})=>(
    <div className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0">
      <div><p className="font-black text-[12px] text-white">{label}</p>{sub&&<p className="text-[9px] text-zinc-500 font-bold mt-0.5">{sub}</p>}</div>
      <button onClick={()=>setP(prev=>({...prev,[k]:!prev[k]}))} className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${p[k]?"bg-primary":"bg-zinc-700"}`}>
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${p[k]?"left-6":"left-0.5"}`}/>
      </button>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-4">Notifications email</p>
        <Toggle k="order_updates" label="Mises à jour commandes"   sub="Confirmation, expédition, livraison"/>
        <Toggle k="promotions"    label="Promotions & Flash Deals"  sub="Offres exclusives et ventes flash"/>
        <Toggle k="new_products"  label="Nouveaux produits"         sub="Alertes nouvelles arrivées"/>
        <Toggle k="price_drops"   label="Baisse de prix"            sub="Sur vos articles en favoris"/>
        <Toggle k="reviews"       label="Avis & feedback"           sub="Demandes d'avis après achat"/>
        <Toggle k="newsletter"    label="Newsletter OFS"            sub="Actualités et tendances"/>
      </div>
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-4">Autres canaux</p>
        <Toggle k="sms"  label="SMS"                sub="Mises à jour livraison par SMS"/>
        <Toggle k="push" label="Notifications push" sub="Alertes instantanées navigateur"/>
      </div>
      <button onClick={handle} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${saved?"bg-emerald-500 text-white":"bg-primary text-black hover:bg-white"}`}>
        <i className={`fa-solid ${saved?"fa-check":"fa-floppy-disk"}`}></i>{saved?"Préférences enregistrées !":"Enregistrer les préférences"}
      </button>
    </div>
  );
};

// ─── SECURITY ─────────────────────────────────────────────────────────────────
const Security = ({ user }) => {
  const [pw,setPw]=useState({current:"",next:"",confirm:""});
  const [msg,setMsg]=useState(null);
  const [loading,setLoading]=useState(false);
  const handlePw=async()=>{
    if(pw.next!==pw.confirm) return setMsg({type:"error",text:"Les mots de passe ne correspondent pas."});
    if(pw.next.length<8)    return setMsg({type:"error",text:"Min. 8 caractères requis."});
    setLoading(true);
    try{const{error}=await supabase.auth.updateUser({password:pw.next});if(error)throw error;setMsg({type:"ok",text:"Mot de passe mis à jour !"});setPw({current:"",next:"",confirm:""});}
    catch(e){setMsg({type:"error",text:e.message});}finally{setLoading(false);}
  };
  return (
    <div className="space-y-4">
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
        <p className="font-black text-sm uppercase tracking-tight text-white mb-4 flex items-center gap-2"><i className="fa-solid fa-lock text-primary"></i>Changer le mot de passe</p>
        <div className="space-y-3">
          {[["current","Mot de passe actuel"],["next","Nouveau mot de passe"],["confirm","Confirmer le nouveau"]].map(([k,l])=>(
            <input key={k} type="password" value={pw[k]} onChange={e=>setPw(p=>({...p,[k]:e.target.value}))} placeholder={l}
              className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"/>
          ))}
        </div>
        {msg&&<div className={`flex items-center gap-2 mt-3 p-3 rounded-xl text-[10px] font-bold ${msg.type==="ok"?"bg-primary/10 text-primary border border-primary/20":"bg-red-500/10 text-red-400 border border-red-400/20"}`}><i className={`fa-solid ${msg.type==="ok"?"fa-check":"fa-triangle-exclamation"}`}></i>{msg.text}</div>}
        <button onClick={handlePw} disabled={loading} className="mt-4 w-full bg-primary text-black py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white transition disabled:opacity-50 flex items-center justify-center gap-2">
          {loading?<i className="fa-solid fa-spinner fa-spin"></i>:<i className="fa-solid fa-shield-check"></i>}Mettre à jour
        </button>
      </div>
      <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-5">
        <p className="font-black text-sm uppercase tracking-tight text-red-400 mb-1 flex items-center gap-2"><i className="fa-solid fa-triangle-exclamation"></i>Zone de danger</p>
        <p className="text-[10px] text-zinc-500 font-bold mb-4">Ces actions sont irréversibles. Procédez avec précaution.</p>
        <button className="border border-red-500/30 text-red-400 px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-500/10 transition"><i className="fa-solid fa-trash-can mr-2"></i>Supprimer mon compte</button>
      </div>
    </div>
  );
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
const Settings = ({ profile, user, onSave }) => {
  const [form,setForm]=useState({full_name:profile?.full_name||"",phone:profile?.phone||"",bio:profile?.bio||"",city:profile?.city||"Douala",birthday:profile?.birthday||"",gender:profile?.gender||"",instagram:profile?.instagram||"",whatsapp:profile?.whatsapp||""});
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [avatar,setAvatar]=useState(null);
  const fileRef=useRef(null);
  const handleSave=async()=>{
    setSaving(true);
    try{
      if(avatar){const ext=avatar.name.split(".").pop();const path=`avatars/${user.id}.${ext}`;await supabase.storage.from("profiles").upload(path,avatar,{upsert:true});const{data:{publicUrl}}=supabase.storage.from("profiles").getPublicUrl(path);form.avatar_url=publicUrl;}
      await onSave(form);setSaved(true);setTimeout(()=>setSaved(false),2500);
    }finally{setSaving(false);}
  };
  return (
    <div className="space-y-5">
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
        <p className="font-black text-sm uppercase tracking-tight text-white mb-4 flex items-center gap-2"><i className="fa-solid fa-user-circle text-primary"></i>Photo de profil</p>
        <div className="flex items-center gap-5">
          <Avatar url={avatar?URL.createObjectURL(avatar):profile?.avatar_url} name={form.full_name} size={18} onClick={()=>fileRef.current?.click()}/>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>setAvatar(e.target.files[0])}/>
          <div>
            <button onClick={()=>fileRef.current?.click()} className="flex items-center gap-2 border border-primary/30 text-primary px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-primary/10 transition mb-2"><i className="fa-solid fa-upload text-xs"></i>Changer la photo</button>
            <p className="text-[8px] text-zinc-600 font-bold">JPG, PNG · Max 2 MB</p>
          </div>
        </div>
      </div>
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 space-y-4">
        <p className="font-black text-sm uppercase tracking-tight text-white flex items-center gap-2"><i className="fa-solid fa-id-card text-primary"></i>Informations personnelles</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[{k:"full_name",label:"Nom complet",type:"text"},{k:"phone",label:"Téléphone",type:"tel"},{k:"city",label:"Ville",type:"text"},{k:"birthday",label:"Date de naissance",type:"date"}].map(f=>(
            <div key={f.k}>
              <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">{f.label}</label>
              <input type={f.type} value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.label}
                className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition"/>
            </div>
          ))}
          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Genre</label>
            <select value={form.gender} onChange={e=>setForm(p=>({...p,gender:e.target.value}))} className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold focus:border-primary/40 focus:outline-none transition">
              <option value="">Non précisé</option><option value="H">Homme</option><option value="F">Femme</option><option value="autre">Autre</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Bio</label>
          <textarea value={form.bio} onChange={e=>setForm(p=>({...p,bio:e.target.value}))} rows={3} placeholder="Quelques mots sur vous..."
            className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-white font-bold placeholder-zinc-600 focus:border-primary/40 focus:outline-none transition resize-none"/>
        </div>
      </div>
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
        <p className="font-black text-sm uppercase tracking-tight text-white flex items-center gap-2 mb-3"><i className="fa-solid fa-envelope text-primary"></i>Email</p>
        <div className="flex items-center gap-3 bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-3">
          <span className="text-[11px] font-bold text-zinc-400 flex-grow">{user?.email}</span>
          <span className="text-[7px] font-black uppercase text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">Vérifié</span>
        </div>
      </div>
      <button onClick={handleSave} disabled={saving}
        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${saved?"bg-emerald-500 text-white":"bg-primary text-black hover:bg-white"} disabled:opacity-60`}>
        {saving?<i className="fa-solid fa-spinner fa-spin"></i>:<i className={`fa-solid ${saved?"fa-check":"fa-floppy-disk"}`}></i>}
        {saved?"Profil mis à jour !":"Enregistrer les modifications"}
      </button>
    </div>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const ProfilePage = ({ addToCart }) => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate=useNavigate();
  const [tab,       setTab]      = useState("overview");
  const [profile,   setProfile]  = useState(null);
  const [orders,    setOrders]   = useState([]);
  const [wishlist,  setWishlist] = useState([]);
  const [reviews,   setReviews]  = useState([]);
  const [addresses, setAddresses]= useState([]);
  const [loading,   setLoading]  = useState(true);
  const [mobileNav, setMobileNav]= useState(false);

  useEffect(()=>{ if(!authLoading&&!user) navigate("/login",{state:{from:"/profile"}}); },[user,authLoading]);

  useEffect(()=>{
    if(!user) return;
    (async()=>{
      setLoading(true);
      try{
        const[pR,oR,wR,rR,aR]=await Promise.all([
          supabase.from("profiles").select("*").eq("id",user.id).single(),
          supabase.from("orders").select("*,items:order_items(*)").eq("user_id",user.id).order("created_at",{ascending:false}),
          supabase.from("wishlists").select("*,product:products(*)").eq("user_id",user.id),
          supabase.from("reviews").select("*,product:products(name,img)").eq("user_id",user.id).order("created_at",{ascending:false}),
          supabase.from("user_addresses").select("*").eq("user_id",user.id).order("is_default",{ascending:false}),
        ]);
        if(pR.data) setProfile(pR.data);
        if(oR.data) setOrders(oR.data);
        if(wR.data) setWishlist(wR.data);
        if(rR.data) setReviews(rR.data);
        if(aR.data) setAddresses(aR.data);
      }catch(e){console.error(e);}finally{setLoading(false);}
    })();
  },[user]);

  const saveProfile=async(data)=>{
    const{error}=await supabase.from("profiles").upsert({id:user.id,...data,updated_at:new Date().toISOString()});
    if(error) throw error;
    setProfile(p=>({...p,...data}));
  };

  // ✅ saveAddress : insert + retour de la ligne créée
  const saveAddress=async(data)=>{
    const{data:res,error}=await supabase
      .from("user_addresses")
      .insert({user_id:user.id,...data})
      .select()
      .single();
    if(error) throw new Error(error.message);
    if(res.is_default){
      setAddresses(prev=>[res,...prev.map(a=>({...a,is_default:false}))]);
    } else {
      setAddresses(prev=>[...prev,res]);
    }
  };

  const deleteAddress=async(id)=>{
    const{error}=await supabase.from("user_addresses").delete().eq("id",id);
    if(!error) setAddresses(prev=>prev.filter(a=>a.id!==id));
  };

  const removeWishlist=async(id)=>{
    await supabase.from("wishlists").delete().eq("id",id);
    setWishlist(prev=>prev.filter(w=>w.id!==id));
  };

  const saveNotifPrefs=async(prefs)=>{
    await supabase.from("profiles").upsert({id:user.id,notification_prefs:prefs});
  };

  if(authLoading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <i className="fa-solid fa-spinner fa-spin text-primary text-3xl"></i>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Chargement...</p>
      </div>
    </div>
  );
  if(!user) return null;

  const tier=getTier(profile?.loyalty_points||0);
  const tierCfg=TIER_CONFIG[tier];
  const activeTab=TABS.find(t=>t.key===tab);

  const CONTENT={
    overview:      <Overview      profile={profile} orders={orders} wishlist={wishlist} reviews={reviews} setTab={setTab}/>,
    orders:        <Orders        orders={orders} loading={loading}/>,
    wishlist:      <WishlistTab   items={wishlist} loading={loading} onRemove={removeWishlist} addToCart={addToCart}/>,
    addresses:     <Addresses     addresses={addresses} onSave={saveAddress} onDelete={deleteAddress}/>,
    reviews:       <ReviewsTab    reviews={reviews}/>,
    referral:      <Referral      profile={profile}/>,
    notifications: <NotificationsTab prefs={profile?.notification_prefs} onSave={saveNotifPrefs}/>,
    security:      <Security      user={user}/>,
    settings:      <Settings      profile={profile} user={user} onSave={saveProfile}/>,
  };

  return (
    <div className="min-h-screen bg-black text-white pt-[148px] pb-20">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">

        {/* HEADER */}
        <div className="bg-zinc-950 border border-white/5 rounded-3xl overflow-hidden mb-6">
          <div className="h-28 bg-gradient-to-r from-primary/20 via-blue-500/10 to-purple-500/15 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:"linear-gradient(rgba(0,217,126,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,217,126,1) 1px,transparent 1px)",backgroundSize:"40px 40px"}}/>
          </div>
          <div className="px-6 pb-5 -mt-10 flex flex-col sm:flex-row sm:items-end gap-4">
            <Avatar url={profile?.avatar_url} name={profile?.full_name||user?.email} size={20} onClick={()=>setTab("settings")}/>
            <div className="flex-grow min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-black text-xl uppercase italic tracking-tighter text-white leading-none">
                  {profile?.full_name||user?.email?.split("@")[0]}
                </h1>
                <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full border ${tierCfg.color} bg-gradient-to-br ${tierCfg.bg}`}>
                  <i className={`fa-solid ${tierCfg.icon} mr-1`}></i>{tierCfg.label}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-bold mt-1">{user?.email}</p>
              {profile?.bio&&<p className="text-[11px] text-zinc-400 mt-1 font-bold italic">"{profile.bio}"</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={()=>setTab("settings")} className="flex items-center gap-2 border border-white/10 text-zinc-400 hover:text-primary hover:border-primary/30 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition">
                <i className="fa-solid fa-pen-to-square text-xs"></i><span className="hidden sm:inline">Modifier</span>
              </button>
              <button onClick={signOut} className="flex items-center gap-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition">
                <i className="fa-solid fa-right-from-bracket text-xs"></i><span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* SIDEBAR */}
          <aside className="hidden lg:flex flex-col gap-1 w-52 flex-shrink-0">
            {TABS.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-left transition-all ${tab===t.key?"bg-primary text-black":"text-zinc-400 hover:text-white hover:bg-white/5"}`}>
                <i className={`fa-solid ${t.icon} text-xs w-4`}></i><span>{t.label}</span>
                {t.key==="orders"&&orders.filter(o=>o.status==="pending").length>0&&(
                  <span className="ml-auto bg-primary/20 text-primary text-[7px] font-black rounded-full px-1.5 py-0.5">{orders.filter(o=>o.status==="pending").length}</span>
                )}
              </button>
            ))}
            <div className="mt-3 pt-3 border-t border-white/5">
              <Link to="/store"    className="flex items-center gap-3 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-zinc-500 hover:text-primary transition"><i className="fa-solid fa-bag-shopping text-xs w-4"></i><span>Store</span></Link>
              <Link to="/boutiques" className="flex items-center gap-3 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-zinc-500 hover:text-primary transition"><i className="fa-solid fa-store text-xs w-4"></i><span>Boutiques</span></Link>
            </div>
          </aside>

          {/* CONTENU */}
          <div className="flex-grow min-w-0">
            <div className="lg:hidden mb-4">
              <button onClick={()=>setMobileNav(!mobileNav)} className="w-full flex items-center justify-between bg-zinc-950 border border-white/8 rounded-2xl px-5 py-3">
                <div className="flex items-center gap-3">
                  <i className={`fa-solid ${activeTab?.icon} text-primary text-sm`}></i>
                  <span className="font-black text-[11px] uppercase tracking-widest text-white">{activeTab?.label}</span>
                </div>
                <i className={`fa-solid fa-chevron-down text-zinc-400 text-xs transition-transform ${mobileNav?"rotate-180":""}`}></i>
              </button>
              {mobileNav&&(
                <div className="bg-zinc-950 border border-white/8 rounded-2xl mt-1 overflow-hidden">
                  {TABS.map(t=>(
                    <button key={t.key} onClick={()=>{setTab(t.key);setMobileNav(false);}}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left border-b border-white/5 last:border-0 font-black text-[10px] uppercase tracking-widest transition ${tab===t.key?"text-primary bg-primary/5":"text-zinc-400 hover:text-white"}`}>
                      <i className={`fa-solid ${t.icon} text-xs w-4`}></i><span>{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-7 bg-primary rounded-full"></div>
              <h2 className="font-black text-lg uppercase tracking-tighter text-white">{activeTab?.label}</h2>
            </div>

            {loading&&!["settings","security","notifications","addresses","referral"].includes(tab)
              ? <div className="space-y-3">{[...Array(4)].map((_,i)=><div key={i} className="h-20 bg-zinc-900 rounded-2xl animate-pulse"/>)}</div>
              : CONTENT[tab]
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;