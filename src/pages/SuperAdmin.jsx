import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import CJImportTab from "../components/CJImportTab";

// ─── SUPER ADMIN EMAILS ───────────────────────────────────────────────────────
const SUPER_ADMIN_EMAILS = ["emansoga@gmail.com", "nsogadavid01@gmail.com"];
const isSuperAdmin = (email) => SUPER_ADMIN_EMAILS.includes(email);

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS = {
  pending:         { label: "En attente",    color: "text-[#FF9900]",  bg: "bg-[#FFF8D3]",  border: "border-[#FCD200]/40" },
  pending_payment: { label: "Paiement...",   color: "text-[#007185]",  bg: "bg-[#E6F3F5]",  border: "border-[#007185]/30" },
  confirmed:       { label: "Confirmée",     color: "text-[#007185]",  bg: "bg-[#E6F3F5]",  border: "border-[#007185]/30" },
  paid:            { label: "Payée",         color: "text-[#007600]",  bg: "bg-[#E8F5E8]",  border: "border-[#007600]/30" },
  shipped:         { label: "Expédiée",      color: "text-[#565959]",  bg: "bg-[#EAEDED]",  border: "border-[#D5D9D9]"    },
  delivered:       { label: "Livrée",        color: "text-[#007600]",  bg: "bg-[#E8F5E8]",  border: "border-[#007600]/30" },
  cancelled:       { label: "Annulée",       color: "text-[#B12704]",  bg: "bg-[#FEE7E5]",  border: "border-[#B12704]/30" },
  payment_failed:  { label: "Pmt échoué",    color: "text-[#B12704]",  bg: "bg-[#FEE7E5]",  border: "border-[#B12704]/30" },
};

const fmtDate = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color = "#FF9900" }) => (
  <div className="bg-white border border-[#D5D9D9] rounded-xl p-5 flex items-start gap-4">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border" style={{ backgroundColor: `${color}15`, borderColor: `${color}30` }}>
      <i className={`fa-solid ${icon} text-base`} style={{ color }}></i>
    </div>
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1">{label}</p>
      <p className="text-2xl font-black text-[#0F1111] leading-none">{value}</p>
      {sub && <p className="text-[10px] text-[#565959] mt-1">{sub}</p>}
    </div>
  </div>
);

// ─── VENDOR ROW CARD ──────────────────────────────────────────────────────────
const VendorCard = ({ vendor, stats }) => {
  const rev = (stats?.revenue || 0).toLocaleString();
  return (
    <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden hover:border-[#FF9900]/50 hover:shadow-sm transition-all">
      <div className="bg-[#232F3E] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-[#FF9900]/15 rounded-lg flex items-center justify-center border border-[#FF9900]/30 flex-shrink-0">
            <i className="fa-solid fa-store text-[#FF9900] text-xs"></i>
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{vendor.shop_name}</p>
            <p className="text-[#ADBAC7] text-[10px] truncate">{vendor.full_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {vendor.member_discount_enabled && (
            <span className="text-[8px] font-black bg-[#007600]/20 text-[#007600] border border-[#007600]/30 px-2 py-0.5 rounded-full uppercase">−20% actif</span>
          )}
          <Link to={`/shop/${vendor.shop_name}`} className="text-[#FF9900] hover:text-[#FFD814] transition-colors">
            <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-[#F3F4F4] px-0 py-0">
        {[
          { label: "Produits", value: stats?.products || 0, icon: "fa-box", color: "#FF9900" },
          { label: "Commandes", value: stats?.orders || 0, icon: "fa-bag-shopping", color: "#007185" },
          { label: "Revenu", value: `${rev} F`, icon: "fa-coins", color: "#007600" },
        ].map(s => (
          <div key={s.label} className="px-4 py-3 flex flex-col items-center gap-0.5">
            <i className={`fa-solid ${s.icon} text-[10px]`} style={{ color: s.color }}></i>
            <p className="font-black text-[#0F1111] text-sm">{s.value}</p>
            <p className="text-[8px] uppercase tracking-wide text-[#ADBAC7]">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t border-[#F3F4F4] flex items-center justify-between">
        <p className="text-[10px] text-[#565959]">
          <i className="fa-regular fa-calendar mr-1.5 text-[9px]"></i>
          Depuis le {fmtDate(vendor.created_at)}
        </p>
        <p className="text-[10px] text-[#565959] font-mono">{vendor.user_id?.slice(0, 8)}…</p>
      </div>
    </div>
  );
};

// ─── ORDERS TABLE ─────────────────────────────────────────────────────────────
const AllOrdersTab = ({ orders, loading, onStatusChange }) => {
  const [filter,  setFilter]  = useState("all");
  const [search,  setSearch]  = useState("");
  const [updating, setUpdating] = useState(null);

  const filtered = orders.filter(o => {
    if (filter !== "all" && o.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.client_name?.toLowerCase().includes(q) ||
        o.client_phone?.toLowerCase().includes(q) ||
        o.id?.toLowerCase().includes(q) ||
        o.vendor?.shop_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdating(orderId);
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (!error) onStatusChange(orderId, newStatus);
    setUpdating(null);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#FF9900] text-sm"></i>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Client, téléphone, boutique…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-xl text-sm placeholder-[#ADBAC7] transition-colors"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
          {["all", "pending", "pending_payment", "paid", "confirmed", "shipped", "delivered", "cancelled", "payment_failed"].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap border transition-all flex-shrink-0 ${
                filter === s
                  ? "bg-[#232F3E] text-[#FF9900] border-[#FF9900]/30"
                  : "bg-white text-[#565959] border-[#D5D9D9] hover:border-[#FF9900]/30"
              }`}
            >
              {s === "all" ? `Tout (${orders.length})` : `${STATUS[s]?.label} (${orders.filter(o => o.status === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_,i) => (
            <div key={i} className="animate-pulse h-16 bg-white border border-[#D5D9D9] rounded-xl"></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#565959]">
          <i className="fa-solid fa-bag-shopping text-4xl text-[#D5D9D9] mb-3 block"></i>
          <p className="font-bold">Aucune commande trouvée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => {
            const st = STATUS[o.status] || STATUS.pending;
            return (
              <div key={o.id} className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden hover:border-[#FF9900]/30 transition-all">
                <div className="flex items-center gap-4 px-4 py-3 flex-wrap">
                  {/* Order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-black text-[#0F1111] text-sm font-mono">#{o.id.slice(0, 8).toUpperCase()}</p>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${st.bg} ${st.border} ${st.color}`}>
                        {st.label}
                      </span>
                      {o.vendor?.shop_name && (
                        <span className="text-[9px] text-[#007185] bg-[#007185]/10 px-2 py-0.5 rounded-full border border-[#007185]/20 font-bold">
                          {o.vendor.shop_name}
                        </span>
                      )}
                      {!o.vendor_id && (
                        <span className="text-[9px] text-[#FF9900] bg-[#FF9900]/10 px-2 py-0.5 rounded-full border border-[#FF9900]/20 font-bold">
                          OFS Platform
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[#565959] flex-wrap">
                      <span><i className="fa-solid fa-user mr-1"></i>{o.client_name}</span>
                      <span><i className="fa-solid fa-phone mr-1"></i>{o.client_phone}</span>
                      <span><i className="fa-regular fa-clock mr-1"></i>{fmtDate(o.created_at)} {fmtTime(o.created_at)}</span>
                    </div>
                  </div>

                  {/* Amount */}
                  <p className="font-black text-[#B12704] text-base flex-shrink-0">
                    {Number(o.total_amount).toLocaleString()} F
                  </p>

                  {/* Status selector */}
                  <select
                    value={o.status}
                    onChange={e => handleStatusChange(o.id, e.target.value)}
                    disabled={updating === o.id}
                    className="text-[11px] font-bold border border-[#D5D9D9] rounded-lg px-2 py-1.5 bg-white focus:border-[#FF9900] focus:outline-none cursor-pointer disabled:opacity-50 flex-shrink-0"
                  >
                    {Object.entries(STATUS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                {/* Address */}
                <div className="px-4 py-2 bg-[#F3F4F4] border-t border-[#EAEDED] flex items-center justify-between gap-4">
                  <p className="text-[10px] text-[#565959] truncate">
                    <i className="fa-solid fa-location-dot text-[#FF9900] mr-1.5"></i>
                    {o.client_address}
                  </p>
                  <p className="text-[10px] text-[#565959] capitalize flex-shrink-0">
                    {o.payment_method?.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── BOUTIQUES TAB ────────────────────────────────────────────────────────────
const BoutiquesTab = ({ vendors, vendorStats, loading }) => {
  const [search, setSearch] = useState("");
  const filtered = vendors.filter(v =>
    !search || v.shop_name?.toLowerCase().includes(search.toLowerCase()) || v.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#FF9900] text-sm"></i>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une boutique…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-xl text-sm placeholder-[#ADBAC7] transition-colors"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_,i) => (
            <div key={i} className="animate-pulse bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
              <div className="h-14 bg-[#232F3E]"></div>
              <div className="p-4 space-y-2">
                <div className="h-3 bg-[#F3F4F4] rounded w-2/3"></div>
                <div className="h-3 bg-[#F3F4F4] rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#565959]">
          <i className="fa-solid fa-store text-4xl text-[#D5D9D9] mb-3 block"></i>
          <p className="font-bold">Aucune boutique trouvée</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => (
            <VendorCard key={v.id} vendor={v} stats={vendorStats[v.id]} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
const OverviewTab = ({ stats, topVendors, recentOrders, loading }) => (
  <div className="space-y-6">
    {/* KPIs */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard icon="fa-coins"         label="Revenu total"    value={`${(stats.revenue||0).toLocaleString()} F`} color="#007600" />
      <KpiCard icon="fa-bag-shopping"  label="Commandes"       value={stats.orders || 0}   sub={`${stats.pending||0} en attente`} color="#FF9900" />
      <KpiCard icon="fa-boxes-stacked" label="Produits"        value={stats.products || 0}  sub="Dans le catalogue"  color="#007185" />
      <KpiCard icon="fa-store"         label="Boutiques"       value={stats.vendors || 0}   sub="Vendeurs actifs"    color="#a855f7" />
    </div>

    {/* Top vendors + Recent orders */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top vendors */}
      <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
        <div className="bg-[#232F3E] px-5 py-3 flex items-center gap-2">
          <i className="fa-solid fa-trophy text-[#FFD814] text-sm"></i>
          <span className="font-black text-white text-sm">Top Boutiques</span>
        </div>
        <div className="divide-y divide-[#F3F4F4]">
          {loading ? [...Array(3)].map((_,i) => (
            <div key={i} className="animate-pulse px-5 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#F3F4F4] rounded-lg flex-shrink-0"></div>
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[#F3F4F4] rounded w-1/2"></div>
                <div className="h-2 bg-[#F3F4F4] rounded w-1/3"></div>
              </div>
            </div>
          )) : topVendors.slice(0, 5).map((v, i) => (
            <div key={v.id} className="flex items-center gap-3 px-5 py-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 ${
                i === 0 ? "bg-[#FFD814] text-[#0F1111]" :
                i === 1 ? "bg-[#ADBAC7] text-[#0F1111]" :
                i === 2 ? "bg-[#c97c4a] text-white" :
                          "bg-[#F3F4F4] text-[#565959]"
              }`}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#0F1111] text-sm truncate">{v.shop_name}</p>
                <p className="text-[10px] text-[#565959]">{(v._revenue||0).toLocaleString()} FCFA</p>
              </div>
              <p className="text-[10px] font-bold text-[#007600] flex-shrink-0">{v._orders||0} cmd</p>
            </div>
          ))}
          {!loading && topVendors.length === 0 && (
            <p className="text-center py-8 text-sm text-[#565959]">Aucune boutique</p>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
        <div className="bg-[#232F3E] px-5 py-3 flex items-center gap-2">
          <i className="fa-solid fa-clock text-[#FF9900] text-sm"></i>
          <span className="font-black text-white text-sm">Commandes récentes</span>
        </div>
        <div className="divide-y divide-[#F3F4F4]">
          {loading ? [...Array(4)].map((_,i) => (
            <div key={i} className="animate-pulse px-5 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#F3F4F4] rounded-full flex-shrink-0"></div>
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[#F3F4F4] rounded w-3/4"></div>
                <div className="h-2 bg-[#F3F4F4] rounded w-1/2"></div>
              </div>
            </div>
          )) : recentOrders.slice(0, 6).map(o => {
            const st = STATUS[o.status] || STATUS.pending;
            return (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${st.bg} ${st.border}`}>
                  <i className="fa-solid fa-bag-shopping text-[9px]" style={{ color: st.color.replace("text-","").replace("[","").replace("]","") }}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#0F1111] text-sm truncate">{o.client_name}</p>
                  <p className="text-[10px] text-[#565959]">{o.vendor?.shop_name || "OFS Platform"} · {fmtDate(o.created_at)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-[#B12704] text-sm">{Number(o.total_amount).toLocaleString()} F</p>
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                </div>
              </div>
            );
          })}
          {!loading && recentOrders.length === 0 && (
            <p className="text-center py-8 text-sm text-[#565959]">Aucune commande</p>
          )}
        </div>
      </div>
    </div>

    {/* Platform product split */}
    <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
      <div className="bg-[#232F3E] px-5 py-3 flex items-center gap-2">
        <i className="fa-solid fa-circle-nodes text-[#FF9900] text-sm"></i>
        <span className="font-black text-white text-sm">Produits · Répartition</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-[#F3F4F4] p-0">
        <div className="px-6 py-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1">Produits Boutiques</p>
          <p className="text-3xl font-black text-[#FF9900]">{stats.vendorProducts || 0}</p>
          <p className="text-[10px] text-[#565959] mt-1">Mis en vente par les vendeurs</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1">Produits CJ Platform</p>
          <p className="text-3xl font-black text-[#007185]">{stats.platformProducts || 0}</p>
          <p className="text-[10px] text-[#565959] mt-1">Importés depuis CJ Dropshipping</p>
        </div>
      </div>
    </div>
  </div>
);

// ─── PRODUCTS TAB ─────────────────────────────────────────────────────────────
const AllProductsTab = ({ loading }) => {
  const [products,  setProducts]  = useState([]);
  const [total,     setTotal]     = useState(0);
  const [search,    setSearch]    = useState("");
  const [fetching,  setFetching]  = useState(false);
  const [typeFilter,setTypeFilter]= useState("Tous");

  const TYPES = ["Tous", "Audio Lab", "Tech Lab", "Clothing", "Shoes", "Femme", "Beauté", "Accessories", "Maison", "Sport", "Bébé & Enfants", "Auto"];

  const fetch = async (q = "", type = "") => {
    setFetching(true);
    let query = supabase.from("products").select("*, vendor:vendors!vendor_id(shop_name)", { count: "exact" });
    if (q) query = query.ilike("name", `%${q}%`);
    if (type && type !== "Tous") query = query.eq("type", type);
    const { data, count } = await query.order("created_at", { ascending: false }).limit(100);
    setProducts(data || []);
    setTotal(count || 0);
    setFetching(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleSearch = (e) => { e.preventDefault(); fetch(search, typeFilter === "Tous" ? "" : typeFilter); };
  const handleType   = (t) => { setTypeFilter(t); fetch(search, t === "Tous" ? "" : t); };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce produit ?")) return;
    await supabase.from("products").delete().eq("id", id);
    setProducts(p => p.filter(x => x.id !== id));
    setTotal(t => t - 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#FF9900] text-sm"></i>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit…"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-xl text-sm placeholder-[#ADBAC7]" />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-[#FFD814] text-[#0F1111] rounded-xl font-bold text-sm border border-[#FCD200]">
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
        </form>
        <p className="text-sm text-[#565959] flex items-center gap-1 flex-shrink-0">
          <span className="font-bold text-[#0F1111]">{total}</span> produits
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-0.5">
        {TYPES.map(t => (
          <button key={t} onClick={() => handleType(t)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap border transition-all flex-shrink-0 ${
              typeFilter === t ? "bg-[#232F3E] text-[#FF9900] border-[#FF9900]/30" : "bg-white text-[#565959] border-[#D5D9D9] hover:border-[#FF9900]/30"
            }`}
          >{t}</button>
        ))}
      </div>

      {fetching ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {[...Array(12)].map((_,i) => (
            <div key={i} className="animate-pulse bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
              <div className="aspect-square bg-[#F3F4F4]"></div>
              <div className="p-2.5 space-y-1.5"><div className="h-3 bg-[#F3F4F4] rounded w-full"></div><div className="h-3 bg-[#F3F4F4] rounded w-2/3"></div></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {products.map(p => (
            <div key={p.id} className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden group hover:border-[#FF9900]/50 transition-all">
              <div className="aspect-square bg-[#F3F4F4] overflow-hidden relative">
                {p.img
                  ? <img src={p.img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-image text-[#D5D9D9] text-2xl"></i></div>
                }
                <div className="absolute top-1.5 left-1.5 flex gap-1">
                  <span className="bg-[#232F3E] text-[#FF9900] text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide">{p.type}</span>
                </div>
                {!p.vendor_id && (
                  <div className="absolute top-1.5 right-1.5 bg-[#007185]/90 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase">CJ</div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-bold text-[#0F1111] leading-tight line-clamp-2 mb-1">{p.name}</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-[#B12704]">{Number(p.price).toLocaleString()} F</p>
                  <button onClick={() => handleDelete(p.id)} className="w-6 h-6 rounded border border-[#B12704]/30 bg-[#FEE7E5] text-[#B12704] flex items-center justify-center hover:bg-[#B12704] hover:text-white transition-all">
                    <i className="fa-solid fa-trash text-[8px]"></i>
                  </button>
                </div>
                {p.vendor?.shop_name && (
                  <p className="text-[9px] text-[#565959] mt-1 truncate">{p.vendor.shop_name}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── SUBCATEGORY BACKFILL PANEL ──────────────────────────────────────────────
const SubcategoryBackfillPanel = () => {
  const [state, setState] = useState({ running: false, total: 0, done: 0, updated: 0, skipped: 0, log: [] });
  const stopRef = useRef(false);

  const addLog = (msg) => setState(s => ({ ...s, log: [msg, ...s.log.slice(0, 199)] }));

  const run = async () => {
    stopRef.current = false;
    setState({ running: true, total: 0, done: 0, updated: 0, skipped: 0, log: [] });

    const { mapCjSubcategory } = await import("../lib/cjApi");

    // Fetch ALL CJ products (re-map even those that already have a subcategory,
    // in case the old value was wrong — e.g. "Rangement" for an action camera)
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, cj_category_name, subcategory")
      .not("cj_category_name", "is", null);

    if (error) { addLog(`❌ Erreur fetch: ${error.message}`); setState(s => ({ ...s, running: false })); return; }

    // Re-map everything and keep only those where the new value differs
    const toFix = (products || []).map(p => ({
      ...p,
      newSub: mapCjSubcategory(p.cj_category_name || "", p.name || ""),
    })).filter(p => p.newSub && p.newSub !== p.subcategory);

    setState(s => ({ ...s, total: toFix.length }));
    addLog(`${products?.length || 0} produits CJ scannés · ${toFix.length} à corriger`);

    if (toFix.length === 0) {
      addLog("✅ Toutes les sous-catégories sont déjà correctes");
      setState(s => ({ ...s, running: false }));
      return;
    }

    // Batch updates — 50 at a time, no external API needed
    const BATCH = 50;
    let updated = 0, skipped = 0;

    for (let i = 0; i < toFix.length; i += BATCH) {
      if (stopRef.current) { addLog("⛔ Arrêté"); break; }

      const batch = toFix.slice(i, i + BATCH);
      const withSub = batch.map(p => ({ id: p.id, sub: p.newSub }));

      // Group by subcategory value for efficient bulk updates
      const bySub = {};
      withSub.forEach(({ id, sub }) => {
        if (!sub) { skipped++; return; }
        if (!bySub[sub]) bySub[sub] = [];
        bySub[sub].push(id);
      });

      await Promise.all(
        Object.entries(bySub).map(([sub, ids]) =>
          supabase.from("products").update({ subcategory: sub }).in("id", ids)
        )
      );

      const batchUpdated = withSub.filter(x => x.sub).length;
      updated += batchUpdated;

      setState(s => ({ ...s, done: Math.min(i + BATCH, toFix.length), updated, skipped }));
      addLog(`✓ Batch ${Math.floor(i / BATCH) + 1} — ${batchUpdated} mis à jour (${i + batch.length}/${toFix.length})`);
    }

    setState(s => ({ ...s, running: false }));
    addLog(`✅ Terminé — ${updated} sous-catégories remplies · ${skipped} sans correspondance`);
  };

  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;

  return (
    <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
      <div className="bg-[#131921] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-tags text-[#FF9900] text-sm"></i>
          <span className="font-black text-sm text-white">Remplir les sous-catégories</span>
        </div>
        <span className="text-[10px] text-[#ADBAC7]">Sans appel API · Utilise cj_category_name en base</span>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-[11px] text-[#565959]">
          Calcule les sous-catégories depuis le champ <code className="bg-[#F3F4F4] px-1 rounded">cj_category_name</code> déjà
          stocké — pas d'appel CJ, traitement en batch de 50, très rapide.
        </p>
        <div className="flex gap-3">
          <button
            onClick={run}
            disabled={state.running}
            className="flex items-center gap-2 bg-[#FF9900] hover:bg-[#E47911] disabled:opacity-50 text-[#0F1111] px-5 py-2.5 rounded font-bold text-sm transition-all"
          >
            <i className={`fa-solid ${state.running ? "fa-spinner fa-spin" : "fa-tags"} text-sm`}></i>
            {state.running ? `En cours… ${state.done}/${state.total}` : "Lancer le remplissage"}
          </button>
          {state.running && (
            <button onClick={() => { stopRef.current = true; }}
              className="px-4 py-2.5 rounded border border-[#B12704]/40 text-[#B12704] text-sm font-bold hover:bg-[#FEE7E5] transition-all">
              Arrêter
            </button>
          )}
        </div>

        {state.total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#565959]">
              <span>{state.done}/{state.total} traités</span>
              <span className="text-[#007600] font-bold">{state.updated} remplis</span>
              <span className="text-[#565959]">{state.skipped} sans correspondance</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-[#F3F4F4] rounded-full overflow-hidden">
              <div className="h-full bg-[#FF9900] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {state.log.length > 0 && (
          <div className="bg-[#131921] rounded p-3 max-h-40 overflow-y-auto space-y-0.5 font-mono">
            {state.log.map((l, i) => (
              <p key={i} className="text-[10px] text-[#ADBAC7]">{l}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── REPAIR CJ DATA PANEL ────────────────────────────────────────────────────
const RepairImagesPanel = () => {
  const [state, setState] = useState({ running: false, total: 0, done: 0, updated: 0, log: [] });
  const stopRef = useRef(false);

  const addLog = (msg) => setState(s => ({ ...s, log: [msg, ...s.log.slice(0, 99)] }));

  const run = async () => {
    stopRef.current = false;
    setState({ running: true, total: 0, done: 0, updated: 0, log: [] });

    // All CJ products — select only fields needed to identify & check
    const { data: products } = await supabase
      .from("products")
      .select("id, name, cj_product_id, images, description, stock_qty")
      .is("vendor_id", null);

    const toFix = products || [];
    setState(s => ({ ...s, total: toFix.length }));
    addLog(`${toFix.length} produits CJ à synchroniser`);

    const { cjListProducts, cjGetProductDetail, mapCjToProduct } = await import("../lib/cjApi");

    let updated = 0;
    for (let i = 0; i < toFix.length; i += 3) {
      if (stopRef.current) { addLog("⛔ Arrêté"); break; }

      await Promise.all(toFix.slice(i, i + 3).map(async (p) => {
        try {
          let fullData = null;

          // Use stored CJ ID if available (direct fetch, no search)
          if (p.cj_product_id) {
            fullData = await cjGetProductDetail(p.cj_product_id);
          } else {
            const result = await cjListProducts(1, 5, p.name, "");
            const match = result?.list?.find(cj =>
              (cj.productNameEn || cj.productName || "").toLowerCase() === (p.name || "").toLowerCase()
            );
            if (!match) return;
            const cjPid = match.pid || match.productId || match.cjProductId;
            fullData = cjPid ? await cjGetProductDetail(cjPid) : match;
          }

          if (!fullData) return;
          const fresh = mapCjToProduct(fullData);

          const upd = { updated_at: new Date().toISOString() };
          if (fresh.cj_product_id)                                       upd.cj_product_id    = fresh.cj_product_id;
          if (fresh.price > 0)                                            upd.price            = fresh.price;
          if (fresh.price_usd)                                            upd.price_usd        = fresh.price_usd;
          if (fresh.img)                                                  upd.img              = fresh.img;
          if (fresh.images?.length > (p.images?.length || 0))            upd.images           = fresh.images;
          if (fresh.description?.length > (p.description?.length || 0))  upd.description      = fresh.description;
          if (fresh.features?.length > 0)                                 upd.features         = fresh.features;
          if (fresh.colors?.length > 0 && fresh.colors[0] !== "Default") upd.colors           = fresh.colors;
          if (fresh.variants)                                              upd.variants         = fresh.variants;
          if (fresh.stock_qty !== -1)                                      upd.stock_qty        = fresh.stock_qty;
          if (fresh.weight_g)                                              upd.weight_g         = fresh.weight_g;
          if (fresh.cj_category_id)                                        upd.cj_category_id  = fresh.cj_category_id;
          if (fresh.cj_category_name)                                      upd.cj_category_name= fresh.cj_category_name;
          if (fresh.status && fresh.status !== "Nouveau")                  upd.status          = fresh.status;
          if (fresh.subcategory)                                           upd.subcategory     = fresh.subcategory;
          if (fresh.ship_weight_g)                                         upd.ship_weight_g   = fresh.ship_weight_g;
          if (fresh.length_cm)                                             upd.length_cm       = fresh.length_cm;
          if (fresh.width_cm)                                              upd.width_cm        = fresh.width_cm;
          if (fresh.height_cm)                                             upd.height_cm       = fresh.height_cm;
          if (fresh.pack_l_cm)                                             upd.pack_l_cm       = fresh.pack_l_cm;
          if (fresh.pack_w_cm)                                             upd.pack_w_cm       = fresh.pack_w_cm;
          if (fresh.pack_h_cm)                                             upd.pack_h_cm       = fresh.pack_h_cm;

          await supabase.from("products").update(upd).eq("id", p.id);
          updated++;

          const imgCount = upd.images?.length || p.images?.length || 1;
          const stockInfo = fresh.stock_qty >= 0 ? ` · stock:${fresh.stock_qty}` : "";
          addLog(`✓ ${p.name.slice(0, 38)} — ${imgCount} img${stockInfo}`);
        } catch { /* continue to next */ }
      }));

      setState(s => ({ ...s, done: Math.min(i + 3, toFix.length), updated }));
      await new Promise(r => setTimeout(r, 600)); // rate limit respect
    }

    setState(s => ({ ...s, running: false }));
    addLog(`✅ Terminé — ${updated}/${toFix.length} produits synchronisés`);
  };

  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;

  return (
    <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
      <div className="bg-[#232F3E] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-rotate text-[#FF9900] text-sm"></i>
          <span className="font-black text-sm text-white">Synchronisation complète CJ</span>
        </div>
        <span className="text-[10px] text-[#ADBAC7]">Images · Stock · Prix · Couleurs · Variantes</span>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-[11px] text-[#565959]">
          Met à jour tous les produits CJ avec 1 seule image en batch de 3 requêtes en parallèle.
          Laisse l'onglet ouvert jusqu'à la fin.
        </p>

        <div className="flex gap-3">
          <button
            onClick={run}
            disabled={state.running}
            className="flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-50 text-[#0F1111] px-5 py-2.5 rounded font-bold text-sm border border-[#FCD200] transition-all"
          >
            <i className={`fa-solid ${state.running ? "fa-spinner fa-spin" : "fa-wrench"} text-sm`}></i>
            {state.running ? `En cours… ${state.done}/${state.total}` : "Lancer la réparation"}
          </button>
          {state.running && (
            <button
              onClick={() => { stopRef.current = true; }}
              className="px-4 py-2.5 rounded border border-[#B12704]/40 text-[#B12704] text-sm font-bold hover:bg-[#FEE7E5] transition-all"
            >
              Arrêter
            </button>
          )}
        </div>

        {state.total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#565959]">
              <span>{state.done}/{state.total} traités</span>
              <span className="text-[#007600] font-bold">{state.updated} mis à jour</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-[#F3F4F4] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF9900] rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {state.log.length > 0 && (
          <div className="bg-[#131921] rounded p-3 max-h-40 overflow-y-auto space-y-0.5 font-mono">
            {state.log.map((l, i) => (
              <p key={i} className="text-[10px] text-[#ADBAC7]">{l}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── CJ FULFILLMENT TAB ───────────────────────────────────────────────────────
const CJ_STATUS = {
  not_sent: { label: "À envoyer",  color: "text-[#FF9900]",  bg: "bg-[#FFF8D3]",  icon: "fa-clock"       },
  sent:     { label: "Envoyé",     color: "text-[#007600]",  bg: "bg-[#E8F5E8]",  icon: "fa-check"       },
  error:    { label: "Erreur CJ",  color: "text-[#B12704]",  bg: "bg-[#FEE7E5]",  icon: "fa-triangle-exclamation" },
};

const CJFulfillmentTab = () => {
  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState({});
  const [sendingAll, setSendingAll] = useState(false);
  const [autoSend,   setAutoSend]   = useState(false);
  const [tab,        setTab]        = useState("pending");
  const timerRef = useRef(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const loadOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("status", "paid")
      .order("paid_at", { ascending: false });
    const result = data || [];
    setOrders(result);
    return result;
  };

  useEffect(() => {
    loadOrders().then(() => setLoading(false));
  }, []);

  const sendOrderToCJ = async (orderId) => {
    if (sending[orderId] === "loading") return false;
    setSending(s => ({ ...s, [orderId]: "loading" }));
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cj-order`, {
        method:  "POST",
        headers: {
          "apikey":        ANON_KEY,
          "Authorization": `Bearer ${ANON_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({ order_id: orderId }),
      });
      const result = await res.json();
      if (result.success) {
        setSending(s => ({ ...s, [orderId]: "done" }));
        setOrders(prev => prev.map(o =>
          o.id === orderId ? { ...o, cj_order_status: "sent", cj_order_id: result.cj_order_id } : o
        ));
        return true;
      } else {
        setSending(s => ({ ...s, [orderId]: result.error || "Erreur" }));
        setOrders(prev => prev.map(o =>
          o.id === orderId ? { ...o, cj_order_status: "error" } : o
        ));
        return false;
      }
    } catch (e) {
      setSending(s => ({ ...s, [orderId]: e.message || "Erreur réseau" }));
      return false;
    }
  };

  const sendAll = async (orderList) => {
    setSendingAll(true);
    const pending = (orderList || orders).filter(o =>
      o.cj_order_status === "not_sent" || !o.cj_order_status
    );
    for (const o of pending) {
      await sendOrderToCJ(o.id);
    }
    setSendingAll(false);
  };

  useEffect(() => {
    if (autoSend) {
      sendAll(orders);
      timerRef.current = setInterval(async () => {
        const fresh = await loadOrders();
        await sendAll(fresh);
      }, 30_000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [autoSend]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingOrders = orders.filter(o => o.cj_order_status === "not_sent" || !o.cj_order_status);
  const sentOrders    = orders.filter(o => o.cj_order_status === "sent");
  const errorOrders   = orders.filter(o => o.cj_order_status === "error");
  const displayOrders = tab === "pending" ? pendingOrders : tab === "sent" ? sentOrders : errorOrders;

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="bg-[#131921] rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900] mb-0.5">CJ Dropshipping</p>
          <h2 className="text-white font-black text-lg leading-tight">Fulfillment des commandes</h2>
          <p className="text-[10px] text-[#ADBAC7] mt-0.5">
            {pendingOrders.length} à envoyer · {sentOrders.length} envoyées · {errorOrders.length} en erreur
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Auto-send toggle */}
          <div className="flex items-center gap-2 bg-[#232F3E] border border-[#37475A] rounded-lg px-3 py-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#ADBAC7]">Auto-envoi</span>
            <button
              onClick={() => setAutoSend(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoSend ? "bg-[#FF9900]" : "bg-[#37475A]"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${autoSend ? "translate-x-4.5" : "translate-x-0.5"}`} />
            </button>
            {autoSend && (
              <span className="text-[9px] font-bold text-[#FF9900] animate-pulse">ACTIF</span>
            )}
          </div>

          {/* Send all button */}
          <button
            onClick={() => sendAll(orders)}
            disabled={sendingAll || pendingOrders.length === 0}
            className="flex items-center gap-2 bg-[#FF9900] hover:bg-[#E47911] disabled:opacity-40 text-[#0F1111] px-4 py-2 rounded-lg font-bold text-sm transition-all"
          >
            <i className={`fa-solid ${sendingAll ? "fa-spinner fa-spin" : "fa-paper-plane"} text-sm`}></i>
            {sendingAll ? "Envoi…" : `Tout envoyer (${pendingOrders.length})`}
          </button>

          {/* Refresh */}
          <button
            onClick={() => loadOrders()}
            className="w-9 h-9 bg-[#232F3E] border border-[#37475A] rounded-lg flex items-center justify-center text-[#ADBAC7] hover:text-white hover:border-[#FF9900]/40 transition-all"
          >
            <i className="fa-solid fa-rotate text-sm"></i>
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1">
        {[
          { key: "pending", label: `À envoyer (${pendingOrders.length})`, color: "text-[#FF9900]" },
          { key: "sent",    label: `Envoyées (${sentOrders.length})`,      color: "text-[#007600]" },
          { key: "error",   label: `Erreurs (${errorOrders.length})`,      color: "text-[#B12704]" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-all ${
              tab === t.key
                ? `bg-[#232F3E] ${t.color} border-[#37475A]`
                : "bg-white text-[#565959] border-[#D5D9D9] hover:border-[#FF9900]/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white border border-[#D5D9D9] rounded-xl h-28"></div>
          ))}
        </div>
      ) : displayOrders.length === 0 ? (
        <div className="text-center py-16">
          <i className="fa-solid fa-truck-fast text-4xl text-[#D5D9D9] mb-3 block"></i>
          <p className="font-bold text-[#565959]">
            {tab === "pending" ? "Aucune commande en attente de fulfillment" : tab === "sent" ? "Aucune commande envoyée" : "Aucune erreur"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayOrders.map(o => {
            const cjSt       = CJ_STATUS[o.cj_order_status || "not_sent"];
            const sendState  = sending[o.id];
            const cjItems    = (o.order_items || []).filter(i => i.selected_variant_id || i.cj_product_id);

            return (
              <div key={o.id} className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden hover:border-[#FF9900]/30 transition-all">
                {/* Order header */}
                <div className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-black text-[#0F1111] text-sm font-mono">#{o.id.slice(0, 8).toUpperCase()}</p>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${cjSt.bg} ${cjSt.color}`}>
                          <i className={`fa-solid ${cjSt.icon} mr-1`}></i>{cjSt.label}
                        </span>
                        {o.cj_order_id && (
                          <span className="text-[9px] font-mono bg-[#007185]/10 text-[#007185] px-2 py-0.5 rounded-full border border-[#007185]/20">
                            CJ#{o.cj_order_id}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-[#565959]">
                        <span><i className="fa-solid fa-user mr-1"></i>{o.client_name}</span>
                        <span><i className="fa-solid fa-phone mr-1"></i>{o.client_phone}</span>
                        {o.paid_at && (
                          <span><i className="fa-solid fa-check-circle mr-1 text-[#007600]"></i>{fmtDate(o.paid_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="font-black text-[#B12704] text-base">{Number(o.total_amount).toLocaleString()} F</p>
                    {tab === "pending" && (
                      <button
                        onClick={() => sendOrderToCJ(o.id)}
                        disabled={sendState === "loading"}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#007185] hover:bg-[#005f73] disabled:opacity-40 text-white rounded-lg text-[11px] font-bold transition-all"
                      >
                        <i className={`fa-solid ${sendState === "loading" ? "fa-spinner fa-spin" : "fa-paper-plane"} text-xs`}></i>
                        {sendState === "loading" ? "Envoi…" : "Envoyer à CJ"}
                      </button>
                    )}
                    {tab === "error" && (
                      <button
                        onClick={() => sendOrderToCJ(o.id)}
                        disabled={sendState === "loading"}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B12704] hover:bg-[#8a1f04] disabled:opacity-40 text-white rounded-lg text-[11px] font-bold transition-all"
                      >
                        <i className={`fa-solid ${sendState === "loading" ? "fa-spinner fa-spin" : "fa-rotate-right"} text-xs`}></i>
                        {sendState === "loading" ? "Envoi…" : "Réessayer"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Error message */}
                {sendState && sendState !== "loading" && sendState !== "done" && (
                  <div className="px-4 py-2 bg-[#FEE7E5] border-t border-[#B12704]/10">
                    <p className="text-[10px] text-[#B12704] font-bold">
                      <i className="fa-solid fa-triangle-exclamation mr-1"></i>{sendState}
                    </p>
                  </div>
                )}

                {/* Address */}
                <div className="px-4 py-2 bg-[#F3F4F4] border-t border-[#EAEDED]">
                  <p className="text-[10px] text-[#565959] truncate">
                    <i className="fa-solid fa-location-dot text-[#FF9900] mr-1.5"></i>
                    {o.client_address}
                    {o.delivery_city && o.delivery_city !== o.client_address && ` · ${o.delivery_city}`}
                  </p>
                </div>

                {/* CJ Items */}
                {cjItems.length > 0 && (
                  <div className="px-4 py-2 border-t border-[#EAEDED] space-y-1.5">
                    {cjItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        {item.product_img && (
                          <img src={item.product_img} alt="" className="w-8 h-8 object-cover rounded border border-[#D5D9D9] flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-[#0F1111] truncate">{item.product_name}</p>
                          <div className="flex items-center gap-2 text-[9px] text-[#565959]">
                            {item.selected_variant_sku && <span className="font-mono bg-[#F3F4F4] px-1 rounded">{item.selected_variant_sku}</span>}
                            {item.selected_color && <span>{item.selected_color}</span>}
                            {item.selected_size  && <span>{item.selected_size}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[11px] font-black text-[#0F1111]">×{item.quantity}</p>
                          <p className="text-[9px] text-[#565959]">{Number(item.unit_price).toLocaleString()} F</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Non-CJ items warning */}
                {(o.order_items || []).filter(i => !i.selected_variant_id).length > 0 && (
                  <div className="px-4 py-1.5 border-t border-[#EAEDED] bg-[#FFF8D3]">
                    <p className="text-[9px] text-[#565959]">
                      <i className="fa-solid fa-info-circle text-[#FF9900] mr-1"></i>
                      {(o.order_items || []).filter(i => !i.selected_variant_id).length} article(s) non-CJ dans cette commande (ignorés)
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── SUPER ADMIN PAGE ─────────────────────────────────────────────────────────
const SuperAdmin = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [activeTab,    setActiveTab]    = useState("overview");
  const [vendors,      setVendors]      = useState([]);
  const [vendorStats,  setVendorStats]  = useState({});
  const [allOrders,    setAllOrders]    = useState([]);
  const [globalStats,  setGlobalStats]  = useState({});
  const [loading,      setLoading]      = useState(true);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!isSuperAdmin(user.email)) { navigate("/"); }
  }, [user]);

  // ── Load all data ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !isSuperAdmin(user.email)) return;
    const load = async () => {
      setLoading(true);
      try {
        const [vendorsR, ordersR, productsR] = await Promise.all([
          supabase.from("vendors").select("*").order("created_at", { ascending: false }),
          supabase.from("orders").select("*, vendor:vendors!vendor_id(shop_name)").order("created_at", { ascending: false }).limit(500),
          supabase.from("products").select("id, vendor_id, price, type"),
        ]);

        const vs = vendorsR.data || [];
        const os = ordersR.data  || [];
        const ps = productsR.data || [];

        setVendors(vs);
        setAllOrders(os);

        // Build per-vendor stats
        const stats = {};
        vs.forEach(v => {
          const vOrders   = os.filter(o => o.vendor_id === v.id);
          const vProducts = ps.filter(p => p.vendor_id === v.id);
          const revenue   = vOrders.filter(o => o.status === "delivered")
            .reduce((s, o) => s + Number(o.total_amount || 0), 0);
          stats[v.id] = { orders: vOrders.length, products: vProducts.length, revenue };
        });
        setVendorStats(stats);

        // Top vendors for overview
        const enrichedVendors = vs.map(v => ({
          ...v,
          _orders:  stats[v.id]?.orders  || 0,
          _revenue: stats[v.id]?.revenue || 0,
        })).sort((a, b) => b._revenue - a._revenue);

        const platformProds = ps.filter(p => !p.vendor_id).length;
        const vendorProds   = ps.filter(p =>  p.vendor_id).length;
        const totalRevenue  = os.filter(o => o.status === "delivered")
          .reduce((s, o) => s + Number(o.total_amount || 0), 0);
        const pendingCount  = os.filter(o => o.status === "pending").length;
        const cjPending     = os.filter(o => o.status === "paid" && (o.cj_order_status === "not_sent" || !o.cj_order_status)).length;

        setGlobalStats({
          revenue:          totalRevenue,
          orders:           os.length,
          pending:          pendingCount,
          cjPending,
          products:         ps.length,
          vendorProducts:   vendorProds,
          platformProducts: platformProds,
          vendors:          vs.length,
          topVendors:       enrichedVendors,
        });
      } catch (err) {
        console.error("[SuperAdmin]", err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleOrderStatusChange = (orderId, newStatus) => {
    setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  if (!user || !isSuperAdmin(user.email)) return null;

  const TABS = [
    { key: "overview",     icon: "fa-gauge-high",    label: "Vue globale"     },
    { key: "boutiques",    icon: "fa-store",          label: "Boutiques"       },
    { key: "orders",       icon: "fa-bag-shopping",   label: "Commandes",      badge: globalStats.pending    || 0 },
    { key: "fulfillment",  icon: "fa-truck-fast",     label: "Fulfillment CJ", badge: globalStats.cjPending  || 0 },
    { key: "products",     icon: "fa-boxes-stacked",  label: "Produits"        },
    { key: "cj",           icon: "fa-circle-nodes",   label: "CJ Import"       },
  ];

  return (
    <div className="min-h-screen bg-[#EAEDED]">

      {/* ── HEADER ── */}
      <div className="bg-[#131921] border-b border-[#232F3E]">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#232F3E] rounded-xl flex items-center justify-center border border-[#FF9900]/30">
              <i className="fa-solid fa-shield-halved text-[#FF9900] text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-black uppercase tracking-[0.35em] text-[#FF9900]">OFS Cameroun</p>
                <span className="bg-[#B12704] text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Super Admin</span>
              </div>
              <h1 className="text-white font-black text-xl leading-tight">Panneau d'administration</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#565959]">Connecté en tant que</p>
              <p className="text-[#FF9900] text-sm font-bold">{user?.email}</p>
            </div>
            <Link to="/" className="w-10 h-10 bg-[#232F3E] border border-[#37475A] rounded-lg flex items-center justify-center text-[#ADBAC7] hover:text-white hover:border-[#FF9900]/40 transition-all">
              <i className="fa-solid fa-house text-sm"></i>
            </Link>
          </div>
        </div>

        {/* ── TABS NAV ── */}
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="flex gap-0 overflow-x-auto hide-scrollbar">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`relative flex items-center gap-2 px-5 py-3.5 text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all border-b-2 ${
                  activeTab === t.key
                    ? "text-[#FF9900] border-[#FF9900] bg-[#232F3E]"
                    : "text-[#ADBAC7] border-transparent hover:text-white hover:bg-[#232F3E]/50"
                }`}
              >
                <i className={`fa-solid ${t.icon} text-[10px]`}></i>
                <span className="hidden sm:inline">{t.label}</span>
                {t.badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#CC0C39] text-white text-[8px] font-black rounded-full flex items-center justify-center">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">
        {activeTab === "overview" && (
          <OverviewTab
            stats={globalStats}
            topVendors={globalStats.topVendors || []}
            recentOrders={allOrders.slice(0, 8)}
            loading={loading}
          />
        )}

        {activeTab === "boutiques" && (
          <BoutiquesTab vendors={vendors} vendorStats={vendorStats} loading={loading} />
        )}

        {activeTab === "orders" && (
          <AllOrdersTab orders={allOrders} loading={loading} onStatusChange={handleOrderStatusChange} />
        )}

        {activeTab === "fulfillment" && (
          <CJFulfillmentTab />
        )}

        {activeTab === "products" && (
          <AllProductsTab loading={loading} />
        )}

        {activeTab === "cj" && (
          <div className="space-y-4">
            <div className="bg-[#131921] rounded-xl px-5 py-3 flex items-start gap-3">
              <i className="fa-solid fa-info-circle text-[#007185] mt-0.5 flex-shrink-0"></i>
              <p className="text-[11px] text-[#ADBAC7] leading-relaxed">
                Les produits importés depuis CJ Dropshipping ont <span className="text-[#FF9900] font-bold">vendor_id = null</span> — ils sont des <strong className="text-white">produits plateforme OFS</strong>, visibles dans tout le store mais non rattachés à un vendeur.
                Les commandes de ces produits remontent directement à l'admin.
              </p>
            </div>
            <SubcategoryBackfillPanel />
            <RepairImagesPanel />
            <CJImportTab />
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdmin;
