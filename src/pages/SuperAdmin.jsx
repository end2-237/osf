import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import CJImportTab from "../components/CJImportTab";
import { fetchSiteSettings, saveSiteSettings } from "../components/WhatsAppButton";

// ─── SUPER ADMIN EMAILS ───────────────────────────────────────────────────────
const SUPER_ADMIN_EMAILS = ["emansoga@gmail.com", "nsogadavid01@gmail.com"];
const isSuperAdmin = (email) => SUPER_ADMIN_EMAILS.includes(email);

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS = {
  pending:         { label: "En attente",     color: "text-[#FF9900]",  bg: "bg-[#FFF8D3]",  border: "border-[#FCD200]/40" },
  pending_payment: { label: "Paiement...",    color: "text-[#007185]",  bg: "bg-[#E6F3F5]",  border: "border-[#007185]/30" },
  confirmed:       { label: "Confirmée",      color: "text-[#007185]",  bg: "bg-[#E6F3F5]",  border: "border-[#007185]/30" },
  paid:            { label: "Payée",          color: "text-[#007600]",  bg: "bg-[#E8F5E8]",  border: "border-[#007600]/30" },
  sent_to_cj:      { label: "Chez transit.",  color: "text-[#7c3aed]",  bg: "bg-[#f5f3ff]",  border: "border-[#7c3aed]/30" },
  at_warehouse:    { label: "Entrepôt CN",    color: "text-[#FF9900]",  bg: "bg-[#FFF8D3]",  border: "border-[#FCD200]/40" },
  in_transit:      { label: "En transit",     color: "text-[#007185]",  bg: "bg-[#E6F3F5]",  border: "border-[#007185]/30" },
  shipped:         { label: "Expédiée",       color: "text-[#565959]",  bg: "bg-[#EAEDED]",  border: "border-[#D5D9D9]"    },
  delivered:       { label: "Livrée",         color: "text-[#007600]",  bg: "bg-[#E8F5E8]",  border: "border-[#007600]/30" },
  cancelled:       { label: "Annulée",        color: "text-[#B12704]",  bg: "bg-[#FEE7E5]",  border: "border-[#B12704]/30" },
  payment_failed:  { label: "Pmt échoué",     color: "text-[#B12704]",  bg: "bg-[#FEE7E5]",  border: "border-[#B12704]/30" },
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
    if (!error) {
      onStatusChange(orderId, newStatus);
      if (newStatus === 'shipped') {
        const order = orders.find(o => o.id === orderId);
        if (order?.user_id) {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ type: 'shipped', order_id: orderId }),
          }).catch(() => {});
        }
      }
    }
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

                  {/* Quick "Expédié" button */}
                  {['paid', 'confirmed', 'in_transit'].includes(o.status) && (
                    <button
                      onClick={() => handleStatusChange(o.id, 'shipped')}
                      disabled={updating === o.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF9900] hover:bg-[#FFB800] active:scale-95 text-[#0F1111] text-[10px] font-black uppercase tracking-wide rounded-lg transition-all disabled:opacity-50 flex-shrink-0 shadow-sm"
                    >
                      {updating === o.id
                        ? <i className="fa-solid fa-spinner fa-spin text-[9px]"></i>
                        : <i className="fa-solid fa-truck-fast text-[9px]"></i>}
                      Expédié
                    </button>
                  )}
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

// ─── PRODUCT ADMIN CARD ───────────────────────────────────────────────────────
const ProductAdminCard = ({ p, onDelete }) => {
  const isCj = !p.vendor_id;
  const [syncing,   setSyncing]   = useState(false);
  const [hasVideo,  setHasVideo]  = useState(!!p.product_video);
  const [syncState, setSyncState] = useState("idle"); // idle | ok | error | unavailable

  const syncVideo = async () => {
    if (!p.cj_product_id) { setSyncState("error"); return; }
    setSyncing(true); setSyncState("idle");
    try {
      const { cjGetProductDetail, cjGetProductVideos, cjListProducts, cjListProductsV2, cjQueryVariantByVid, mapCjToProduct, resolveVideoUrl, resolveDownloadUrl } = await import("../lib/cjApi");

      let videoUrl = null;
      let thumbUrl = null;
      let freshDetail = null;
      const cjId = p.cj_product_id;

      // Step 1: queryVideosByProductId — ask proxy to follow redirect with CJ auth,
      // which may reveal the actual public CDN URL; also grab coverURL as thumbnail
      try {
        const videos = await cjGetProductVideos(cjId);
        const freeVid = Array.isArray(videos)
          ? videos.find(v => v.videoState === "ON_STATE" && (v.isFree === "1" || v.isBuy))
          : (Array.isArray(videos) ? videos[0] : null);
        if (freeVid?.coverURL) thumbUrl = freeVid.coverURL;
        if (freeVid?.videoUrl) {
          if (!freeVid.videoUrl.includes("download-only-api")) {
            videoUrl = freeVid.videoUrl; // Direct public URL
          } else {
            // Try server-side redirect follow with CJ auth token
            const cdnUrl = await resolveDownloadUrl(freeVid.videoUrl);
            if (cdnUrl) videoUrl = cdnUrl;
            // download-only-api is IP-restricted (403) — cannot proxy, skip
          }
        }
      } catch {}

      // Step 2: detail endpoint — productVideo is a public CDN URL (embeddable)
      const detail = await cjGetProductDetail(cjId).catch(() => null);
      if (detail) {
        const fresh = mapCjToProduct(detail);
        freshDetail = fresh;
        if (fresh.product_video && !fresh.product_video.includes("download-only-api")) {
          videoUrl = fresh.product_video;
          thumbUrl = fresh.video_thumbnail || thumbUrl;
        }
      }

      // Step 3: listV2 endpoint
      if (!videoUrl) {
        const name = p.name || detail?.productNameEn || "";
        if (name) {
          const v2 = await cjListProductsV2(1, 50, name, "").catch(() => null);
          const matchV2 = (v2?.list || v2?.data?.list || []).find(item =>
            (item.id || item.pid || "").toLowerCase() === cjId.toLowerCase() ||
            (item.sku || "").toLowerCase() === (p.sku || "").toLowerCase()
          );
          if (matchV2) {
            const freshV2 = mapCjToProduct(matchV2);
            if (freshV2.product_video && !freshV2.product_video.includes("download-only-api")) {
              videoUrl = freshV2.product_video;
              thumbUrl = freshV2.video_thumbnail || thumbUrl;
            }
          }
        }
      }

      // Step 4: list v1 — probe videoList hex IDs against known public CDN patterns
      if (!videoUrl) {
        const name = p.name || detail?.productNameEn || "";
        if (name) {
          const listData = await cjListProducts(1, 50, name, "").catch(() => null);
          const match = (listData?.list || []).find(item =>
            (item.id || item.pid || "").toLowerCase() === cjId.toLowerCase() ||
            (item.sku || "").toLowerCase() === (p.sku || "").toLowerCase()
          );
          if (match?.videoList?.length) {
            videoUrl = await resolveVideoUrl(match.videoList);
          }
        }
      }

      // Step 5: variant/queryByVid
      if (!videoUrl && detail?.videoList?.length) {
        for (const vid of detail.videoList.slice(0, 2)) {
          const vdata = await cjQueryVariantByVid(vid).catch(() => null);
          if (vdata?.productVideo || vdata?.videoUrl) {
            const candidate = vdata.productVideo || vdata.videoUrl;
            if (!candidate.includes("download-only-api")) { videoUrl = candidate; break; }
          }
        }
      }

      // Build update — video fields (when found) + pricing tiers (when detail fetched)
      const upd = { updated_at: new Date().toISOString() };
      if (videoUrl) {
        upd.product_video   = videoUrl;
        upd.video_thumbnail = thumbUrl || null;
      }
      if (freshDetail) {
        if (freshDetail.quantity_prices?.length > 0)  upd.quantity_prices    = freshDetail.quantity_prices;
        if (freshDetail.min_buy_qty > 0)              upd.min_buy_qty        = freshDetail.min_buy_qty;
        if (freshDetail.max_buy_qty)                  upd.max_buy_qty        = freshDetail.max_buy_qty;
        if (freshDetail.suggest_price_fcfa)           upd.suggest_price_fcfa = freshDetail.suggest_price_fcfa;
        if (freshDetail.pack_num > 1)                 upd.pack_num           = freshDetail.pack_num;
      }

      const syncedPricing = upd.quantity_prices || upd.min_buy_qty || upd.suggest_price_fcfa;
      if (videoUrl || syncedPricing) {
        await supabase.from("products").update(upd).eq("id", p.id);
        if (videoUrl) setHasVideo(true);
        setSyncState("ok");
      } else {
        setSyncState("unavailable");
      }
    } catch { setSyncState("error"); }
    finally { setSyncing(false); }
  };

  return (
    <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden group hover:border-[#FF9900]/50 transition-all">
      <div className="aspect-square bg-[#F3F4F4] overflow-hidden relative">
        {p.img
          ? <img src={p.img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-image text-[#D5D9D9] text-2xl"></i></div>
        }
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          <span className="bg-[#232F3E] text-[#FF9900] text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide">{p.type}</span>
        </div>
        {isCj && (
          <div className="absolute top-1.5 right-1.5 bg-[#007185]/90 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase">CJ</div>
        )}
        {/* VIDEO BADGE */}
        {isCj && (
          <div className="absolute bottom-1.5 left-1.5">
            {hasVideo ? (
              <span className="bg-[#007600]/90 text-white text-[7px] font-black px-1.5 py-0.5 rounded flex items-center gap-1">
                <i className="fa-solid fa-film text-[6px]"></i> Vidéo
              </span>
            ) : (
              <span className="bg-[#565959]/80 text-white text-[7px] font-black px-1.5 py-0.5 rounded flex items-center gap-1">
                <i className="fa-solid fa-film text-[6px]"></i> Pas de vidéo
              </span>
            )}
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-[11px] font-bold text-[#0F1111] leading-tight line-clamp-2 mb-1">{p.name}</p>
        {p.sku && <p className="text-[9px] text-[#007185] mb-1 font-mono truncate">{p.sku}</p>}
        <div className="flex items-center justify-between gap-1">
          <p className="text-sm font-black text-[#B12704]">{Number(p.price).toLocaleString()} F</p>
          <div className="flex items-center gap-1">
            {/* SYNC VIDEO — all CJ products */}
            {isCj && (
              <button onClick={syncVideo} disabled={syncing || !p.cj_product_id} title={
                !p.cj_product_id      ? "ID CJ manquant — réimporter ce produit"
                : syncing             ? "Sync en cours…"
                : syncState === "error"       ? "Erreur — réessayer"
                : syncState === "unavailable" ? "CJ n'a ni vidéo ni tarifs pour ce produit"
                : syncState === "ok"          ? "Synchronisé (vidéo + tarifs dégressifs)"
                : "Synchroniser vidéo + tarifs dégressifs depuis CJ"
              }
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                  !p.cj_product_id          ? "border-[#D5D9D9] text-[#adb5bd] cursor-not-allowed"
                  : syncState === "error"       ? "border-[#B12704]/40 text-[#B12704] hover:bg-[#FEE7E5]"
                  : syncState === "unavailable" ? "border-[#565959]/30 text-[#565959]"
                  : syncState === "ok"          ? "border-[#007600]/40 text-[#007600] hover:bg-[#E8F5E8]"
                  : hasVideo                ? "border-[#FF9900]/40 text-[#FF9900] hover:bg-[#FFF8D3]"
                  : "border-[#007185]/40 text-[#007185] hover:bg-[#E6F3F5]"
                }`}>
                <i className={`fa-solid ${syncing ? "fa-spinner animate-spin" : syncState === "ok" ? "fa-check" : syncState === "error" ? "fa-rotate-right" : hasVideo ? "fa-rotate-right" : "fa-rotate"} text-[8px]`}></i>
                <span>{syncing ? "…" : syncState === "ok" ? "OK" : syncState === "error" ? "Retry" : hasVideo ? "Re-sync" : "Sync"}</span>
              </button>
            )}
            <button onClick={() => onDelete(p.id)} className="w-6 h-6 rounded border border-[#B12704]/30 bg-[#FEE7E5] text-[#B12704] flex items-center justify-center hover:bg-[#B12704] hover:text-white transition-all">
              <i className="fa-solid fa-trash text-[8px]"></i>
            </button>
          </div>
        </div>
        {p.vendor?.shop_name && (
          <p className="text-[9px] text-[#565959] mt-0.5 truncate">{p.vendor.shop_name}</p>
        )}
      </div>
    </div>
  );
};

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
    if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,cj_product_id.ilike.%${q}%`);
    if (type && type !== "Tous") query = query.eq("type", type);
    const { data, count } = await query.order("created_at", { ascending: false }).limit(100);
    setProducts(data || []);
    setTotal(count || 0);
    setFetching(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleSearch = (e) => { e.preventDefault(); fetch(search, typeFilter === "Tous" ? "" : typeFilter); };
  const handleType   = (t) => { setTypeFilter(t); fetch(search, t === "Tous" ? "" : t); };

  const [videoSync, setVideoSync] = useState({ running: false, done: 0, total: 0, updated: 0, stopped: false });
  const videoSyncStop = useRef(false);

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce produit ?")) return;
    await supabase.from("products").delete().eq("id", id);
    setProducts(p => p.filter(x => x.id !== id));
    setTotal(t => t - 1);
  };

  const runBulkVideoSync = async () => {
    videoSyncStop.current = false;
    // Fetch all CJ products missing a video
    const { data: toSync } = await supabase
      .from("products")
      .select("id, name, cj_product_id, sku")
      .is("vendor_id", null)
      .or("product_video.is.null,product_video.ilike.%download-only-api%")
      .not("cj_product_id", "is", null);

    if (!toSync?.length) {
      setVideoSync({ running: false, done: 0, total: 0, updated: 0, stopped: false });
      return;
    }

    setVideoSync({ running: true, done: 0, total: toSync.length, updated: 0, stopped: false });
    const { cjGetProductDetail, cjGetProductVideos, cjListProducts, mapCjToProduct, resolveVideoUrl, resolveDownloadUrl } = await import("../lib/cjApi");
    let updated = 0;

    for (let i = 0; i < toSync.length; i++) {
      if (videoSyncStop.current) {
        setVideoSync(s => ({ ...s, running: false, stopped: true }));
        return;
      }
      const p = toSync[i];
      try {
        let videoUrl = null;
        let thumbUrl = null;

        // Step A: queryVideosByProductId — resolve download URL to CDN URL via proxy
        try {
          const videos = await cjGetProductVideos(p.cj_product_id);
          const freeVid = Array.isArray(videos)
            ? (videos.find(v => v.videoState === "ON_STATE" && (v.isFree === "1" || v.isBuy)) || videos[0])
            : null;
          if (freeVid?.coverURL) thumbUrl = freeVid.coverURL;
          if (freeVid?.videoUrl) {
            if (!freeVid.videoUrl.includes("download-only-api")) {
              videoUrl = freeVid.videoUrl;
            } else {
              const cdnUrl = await resolveDownloadUrl(freeVid.videoUrl);
              if (cdnUrl) videoUrl = cdnUrl;
              // download-only-api is IP-restricted (403) — cannot proxy, skip
            }
          }
        } catch {}

        // Step B: detail endpoint — productVideo may be a public CDN URL
        if (!videoUrl) {
          const detail = await cjGetProductDetail(p.cj_product_id).catch(() => null);
          if (detail) {
            const fresh = mapCjToProduct(detail);
            if (fresh.product_video && !fresh.product_video.includes("download-only-api")) {
              videoUrl = fresh.product_video;
              thumbUrl = fresh.video_thumbnail || thumbUrl;
            }
          }
        }

        // Step C: list endpoint + server-side probe of videoList hex IDs
        if (!videoUrl) {
          const listData = await cjListProducts(1, 20, p.name || "", "").catch(() => null);
          const match = (listData?.list || []).find(item =>
            (item.id || item.pid || "").toLowerCase() === p.cj_product_id.toLowerCase() ||
            (item.sku || "").toLowerCase() === (p.sku || "").toLowerCase()
          );
          if (match?.videoList?.length) videoUrl = await resolveVideoUrl(match.videoList);
        }

        if (videoUrl) {
          await supabase.from("products").update({
            product_video:   videoUrl,
            video_thumbnail: thumbUrl || null,
            updated_at:      new Date().toISOString(),
          }).eq("id", p.id);
          updated++;
          setProducts(prev => prev.map(x => x.id === p.id ? { ...x, product_video: videoUrl } : x));
        }
      } catch {}
      setVideoSync(s => ({ ...s, done: i + 1, updated }));
      if (i < toSync.length - 1) await new Promise(r => setTimeout(r, 800));
    }
    setVideoSync(s => ({ ...s, running: false }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#FF9900] text-sm"></i>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, SKU ou ID CJ…"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-xl text-sm placeholder-[#ADBAC7]" />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-[#FFD814] text-[#0F1111] rounded-xl font-bold text-sm border border-[#FCD200]">
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
        </form>
        <div className="flex items-center gap-2 flex-shrink-0">
          <p className="text-sm text-[#565959]">
            <span className="font-bold text-[#0F1111]">{total}</span> produits
          </p>
          {videoSync.running ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#FFF8D3] border border-[#FCD200]/40 rounded-xl px-3 py-1.5 text-xs font-bold text-[#0F1111]">
                <i className="fa-solid fa-spinner animate-spin text-[#FF9900] text-[10px]"></i>
                <span>{videoSync.done}/{videoSync.total}</span>
                <span className="text-[#007600]">+{videoSync.updated} vidéos</span>
              </div>
              <button onClick={() => { videoSyncStop.current = true; }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-[#B12704]/30 text-[#B12704] hover:bg-[#FEE7E5] transition-all">
                Stop
              </button>
            </div>
          ) : (
            <button onClick={runBulkVideoSync}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#232F3E] hover:bg-[#131921] text-[#FF9900] rounded-xl text-xs font-bold border border-[#FF9900]/20 transition-all">
              <i className="fa-solid fa-film text-[10px]"></i>
              Sync vidéos
            </button>
          )}
        </div>
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
            <ProductAdminCard key={p.id} p={p} onDelete={handleDelete} />
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
          // Pricing tiers & order constraints — drive the quantity-tier UI on the product page
          if (fresh.quantity_prices?.length > 0)                           upd.quantity_prices = fresh.quantity_prices;
          if (fresh.min_buy_qty > 0)                                       upd.min_buy_qty     = fresh.min_buy_qty;
          if (fresh.max_buy_qty)                                           upd.max_buy_qty     = fresh.max_buy_qty;
          if (fresh.suggest_price_fcfa)                                    upd.suggest_price_fcfa = fresh.suggest_price_fcfa;
          if (fresh.pack_num > 1)                                          upd.pack_num        = fresh.pack_num;

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

// ─── TRANSITAIRE SETTINGS ─────────────────────────────────────────────────────
// ─── WHATSAPP SETTINGS ────────────────────────────────────────────────────────
const WA_KEYS = ['whatsapp_phone', 'whatsapp_msg_default', 'whatsapp_msg_product', 'whatsapp_msg_cart'];

const WhatsAppSettingsPanel = () => {
  const [form, setForm] = useState({
    whatsapp_phone:       "",
    whatsapp_msg_default: "Bonjour, j'ai une question sur OFS",
    whatsapp_msg_product: 'Bonjour, je suis intéressé par "{product}" sur OFS',
    whatsapp_msg_cart:    "Bonjour, j'ai besoin d'aide pour finaliser ma commande sur OFS",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSiteSettings(WA_KEYS).then(s => {
      if (Object.keys(s).length > 0) setForm(f => ({ ...f, ...s }));
      setLoading(false);
    });
  }, []);

  const save = async () => {
    await saveSiteSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const testWA = () => {
    const phone = form.whatsapp_phone.replace(/\D/g, '');
    if (!phone) return;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(form.whatsapp_msg_default)}`, '_blank');
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#131921] rounded-xl px-5 py-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-[#25D366] mb-0.5">Support client</p>
        <h2 className="text-white font-black text-lg leading-tight">Bouton WhatsApp</h2>
        <p className="text-[10px] text-[#ADBAC7] mt-0.5">Bouton flottant sur le site — les clients cliquent et arrivent directement sur WhatsApp</p>
      </div>

      <div className="bg-white border border-[#D5D9D9] rounded-xl p-5 space-y-4">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-[#565959] mb-1.5 block">
            Numéro WhatsApp Business
          </label>
          <input
            value={form.whatsapp_phone || ""}
            onChange={e => set("whatsapp_phone", e.target.value)}
            placeholder="237XXXXXXXXX (avec indicatif, sans + ni espaces)"
            disabled={loading}
            className="w-full md:w-80 border border-[#D5D9D9] rounded-lg px-3 py-2 text-sm text-[#0F1111] focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]/20 disabled:opacity-50"
          />
          <p className="text-[10px] text-[#565959] mt-1">Ex: <span className="font-mono">237690000000</span> pour +237 690 000 000</p>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#565959]">Messages pré-remplis</p>
          {[
            { key: "whatsapp_msg_default", label: "Message par défaut (toutes les pages)" },
            { key: "whatsapp_msg_product", label: "Page produit — utilise {product} pour le nom" },
            { key: "whatsapp_msg_cart",    label: "Page panier / commande" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] text-[#565959] mb-1 block">{f.label}</label>
              <input
                value={form[f.key] || ""}
                onChange={e => set(f.key, e.target.value)}
                disabled={loading}
                className="w-full border border-[#D5D9D9] rounded-lg px-3 py-2 text-sm text-[#0F1111] focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]/20 disabled:opacity-50"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${saved ? "bg-[#007600] text-white" : "bg-[#25D366] hover:bg-[#1ebe5d] text-white"}`}
          >
            <i className={`fa-solid ${saved ? "fa-check" : "fa-floppy-disk"} text-sm`}></i>
            {saved ? "Sauvegardé !" : "Sauvegarder"}
          </button>
          {form.whatsapp_phone && (
            <button
              onClick={testWA}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm border border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/5 transition-all"
            >
              <i className="fa-brands fa-whatsapp text-sm"></i>
              Tester
            </button>
          )}
        </div>
      </div>

      <div className="bg-[#E8F5E8] border border-[#25D366]/20 rounded-xl px-4 py-3 space-y-1">
        <p className="text-[11px] font-black text-[#007600] uppercase tracking-wider">Comment ça marche</p>
        <p className="text-[11px] text-[#565959] leading-relaxed">
          Un bouton vert flottant apparaît sur toutes les pages du site. En cliquant, le client ouvre WhatsApp avec un message pré-rempli selon la page où il se trouve.
          Si le numéro est vide, le bouton est masqué.
        </p>
      </div>
    </div>
  );
};

// ─── TRANSITAIRE SETTINGS ─────────────────────────────────────────────────────
const TRANSITAIRE_KEY = "ofs_transitaire_v1";
const getTransitaireSettings = () => {
  try { const s = localStorage.getItem(TRANSITAIRE_KEY); return s ? JSON.parse(s) : null; }
  catch { return null; }
};

const TransitaireSettingsPanel = () => {
  const [form, setForm] = useState(() => getTransitaireSettings() || {
    name: "", address_china: "", city_china: "Guangzhou", phone_china: "",
    wechat: "", phone_cm: "", rate_fcfa_per_kg: 10000, notes: "",
  });
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem(TRANSITAIRE_KEY, JSON.stringify(form));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="bg-[#131921] rounded-xl px-5 py-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900] mb-0.5">Logistique</p>
        <h2 className="text-white font-black text-lg leading-tight">Paramètres Transitaire</h2>
        <p className="text-[10px] text-[#ADBAC7] mt-0.5">Adresse de l'entrepôt en Chine pour les expéditions par voie aérienne</p>
      </div>

      <div className="bg-white border border-[#D5D9D9] rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "name",           label: "Nom du transitaire",          placeholder: "Ex: Guangzhou Freight Co."  },
            { key: "wechat",         label: "WeChat / Contact",            placeholder: "WeChat ID ou contact"        },
            { key: "address_china",  label: "Adresse entrepôt (Chine)",    placeholder: "123 Huangpu Ave, Guangzhou"  },
            { key: "city_china",     label: "Ville (Chine)",               placeholder: "Guangzhou"                   },
            { key: "phone_china",    label: "Téléphone Chine",             placeholder: "+86 XXX XXX XXXX"            },
            { key: "phone_cm",       label: "Téléphone Cameroun",          placeholder: "+237 6XX XXX XXX"            },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] font-black uppercase tracking-wider text-[#565959] mb-1.5 block">{f.label}</label>
              <input
                value={form[f.key] || ""}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full border border-[#D5D9D9] rounded-lg px-3 py-2 text-sm text-[#0F1111] focus:outline-none focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900]/20"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-[#565959] mb-1.5 block">Tarif (FCFA / kg)</label>
          <input
            type="number"
            value={form.rate_fcfa_per_kg || 10000}
            onChange={e => set("rate_fcfa_per_kg", Number(e.target.value))}
            className="w-full md:w-48 border border-[#D5D9D9] rounded-lg px-3 py-2 text-sm text-[#0F1111] focus:outline-none focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900]/20"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-[#565959] mb-1.5 block">Notes</label>
          <textarea
            value={form.notes || ""}
            onChange={e => set("notes", e.target.value)}
            rows={3}
            placeholder="Instructions spéciales, délais, etc."
            className="w-full border border-[#D5D9D9] rounded-lg px-3 py-2 text-sm text-[#0F1111] focus:outline-none focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900]/20 resize-none"
          />
        </div>

        <button
          onClick={save}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${saved ? "bg-[#007600] text-white" : "bg-[#FF9900] hover:bg-[#E47911] text-[#0F1111]"}`}
        >
          <i className={`fa-solid ${saved ? "fa-check" : "fa-floppy-disk"} text-sm`}></i>
          {saved ? "Sauvegardé !" : "Sauvegarder"}
        </button>
      </div>

      {/* Info box */}
      <div className="bg-[#E6F3F5] border border-[#007185]/20 rounded-xl px-4 py-3 space-y-1">
        <p className="text-[11px] font-black text-[#007185] uppercase tracking-wider">Flux transitaire</p>
        <p className="text-[11px] text-[#565959] leading-relaxed">
          CJ expédie à l'entrepôt Chine → transitaire regroupe les colis → avion vers Douala → livraison client.
          Le statut commande suit : <span className="font-bold">Chez transitaire → Entrepôt CN → En transit → Livré</span>.
        </p>
      </div>
    </div>
  );
};

// ─── TRANSIT STEPS ────────────────────────────────────────────────────────────
const TRANSIT_STEPS = [
  { status: "sent_to_cj",   label: "Chez transitaire CN", next: "at_warehouse", nextLabel: "Reçu entrepôt", color: "text-[#7c3aed]", bg: "bg-[#f5f3ff]", border: "border-[#7c3aed]/30", icon: "fa-warehouse"    },
  { status: "at_warehouse", label: "Entrepôt Chine",       next: "in_transit",  nextLabel: "Expédié avion",  color: "text-[#FF9900]", bg: "bg-[#FFF8D3]", border: "border-[#FCD200]/40", icon: "fa-box-open"     },
  { status: "in_transit",   label: "En transit (avion)",   next: "delivered",   nextLabel: "Livré",          color: "text-[#007185]", bg: "bg-[#E6F3F5]", border: "border-[#007185]/30", icon: "fa-plane"        },
  { status: "delivered",    label: "Livré au client",       next: null,          nextLabel: null,             color: "text-[#007600]", bg: "bg-[#E8F5E8]", border: "border-[#007600]/30", icon: "fa-circle-check" },
];

// ─── CJ FULFILLMENT TAB ───────────────────────────────────────────────────────
const CJ_STATUS = {
  not_sent: { label: "À envoyer", color: "text-[#FF9900]", bg: "bg-[#FFF8D3]", icon: "fa-clock"                  },
  sent:     { label: "Envoyé",    color: "text-[#007600]", bg: "bg-[#E8F5E8]", icon: "fa-check"                  },
  error:    { label: "Erreur CJ", color: "text-[#B12704]", bg: "bg-[#FEE7E5]", icon: "fa-triangle-exclamation"   },
};

const CJFulfillmentTab = () => {
  const [orders,         setOrders]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [sending,        setSending]        = useState({});
  const [sendingAll,     setSendingAll]     = useState(false);
  const [autoSend,       setAutoSend]       = useState(false);
  const [tab,            setTab]            = useState("pending");
  const [deliveryMode,   setDeliveryMode]   = useState("dhl");
  const [orderModes,     setOrderModes]     = useState({});
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [transitaire,    setTransitaire]    = useState(() => getTransitaireSettings());
  const timerRef = useRef(null);

  const SUPABASE_URL_ENV = import.meta.env.VITE_SUPABASE_URL;
  const ANON_KEY         = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const getMode = (orderId) => orderModes[orderId] || deliveryMode;

  const loadOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .in("status", ["paid", "sent_to_cj", "at_warehouse", "in_transit", "delivered"])
      .order("paid_at", { ascending: false });
    const result = data || [];
    setOrders(result);
    return result;
  };

  useEffect(() => {
    loadOrders().then(() => setLoading(false));
  }, []);

  const updateOrderStatus = async (orderId, newStatus) => {
    setUpdatingStatus(s => ({ ...s, [orderId]: newStatus }));
    await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    setUpdatingStatus(s => ({ ...s, [orderId]: null }));
  };

  const sendOrderToCJ = async (orderId) => {
    if (sending[orderId] === "loading") return false;
    setSending(s => ({ ...s, [orderId]: "loading" }));
    try {
      const mode = getMode(orderId);
      const tr = getTransitaireSettings();
      if (mode === "transitaire" && !tr?.address_china) {
        setSending(s => ({ ...s, [orderId]: "Configurez l'adresse du transitaire dans Paramètres" }));
        return false;
      }
      const payload = { order_id: orderId };
      if (mode === "transitaire" && tr) {
        payload.use_transitaire = true;
        payload.transitaire = tr;
      }
      const res = await fetch(`${SUPABASE_URL_ENV}/functions/v1/cj-order`, {
        method:  "POST",
        headers: {
          "apikey":        ANON_KEY,
          "Authorization": `Bearer ${ANON_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        setSending(s => ({ ...s, [orderId]: "done" }));
        setOrders(prev => prev.map(o => {
          if (o.id !== orderId) return o;
          return {
            ...o,
            cj_order_status: "sent",
            cj_order_id:     result.cj_order_id,
            status:          mode === "transitaire" ? "sent_to_cj" : o.status,
            shipping_mode:   mode === "transitaire" ? "transitaire" : "dhl_direct",
          };
        }));
        return true;
      } else {
        setSending(s => ({ ...s, [orderId]: result.error || "Erreur" }));
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, cj_order_status: "error" } : o));
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
      o.status === "paid" && (o.cj_order_status === "not_sent" || !o.cj_order_status)
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

  const pendingOrders   = orders.filter(o => o.status === "paid" && (o.cj_order_status === "not_sent" || !o.cj_order_status));
  const sentOrders      = orders.filter(o => o.cj_order_status === "sent" && o.status === "paid");
  const transitOrders   = orders.filter(o => ["sent_to_cj", "at_warehouse", "in_transit"].includes(o.status));
  const deliveredOrders = orders.filter(o => o.status === "delivered");
  const errorOrders     = orders.filter(o => o.cj_order_status === "error");

  const displayOrders =
    tab === "pending"   ? pendingOrders   :
    tab === "sent"      ? sentOrders      :
    tab === "transit"   ? transitOrders   :
    tab === "delivered" ? deliveredOrders :
    errorOrders;

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="bg-[#131921] rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900] mb-0.5">CJ Dropshipping</p>
          <h2 className="text-white font-black text-lg leading-tight">Fulfillment des commandes</h2>
          <p className="text-[10px] text-[#ADBAC7] mt-0.5">
            {pendingOrders.length} à envoyer · {transitOrders.length} en transit · {errorOrders.length} en erreur
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Global delivery mode toggle */}
          <div className="flex items-center gap-1 bg-[#232F3E] border border-[#37475A] rounded-lg p-1">
            {[
              { key: "dhl",         label: "DHL Direct",  icon: "fa-truck"     },
              { key: "transitaire", label: "Transitaire", icon: "fa-warehouse" },
            ].map(m => (
              <button
                key={m.key}
                onClick={() => setDeliveryMode(m.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                  deliveryMode === m.key ? "bg-[#FF9900] text-[#0F1111]" : "text-[#ADBAC7] hover:text-white"
                }`}
              >
                <i className={`fa-solid ${m.icon} text-[9px]`}></i>
                {m.label}
              </button>
            ))}
          </div>

          {/* Auto-send toggle */}
          <div className="flex items-center gap-2 bg-[#232F3E] border border-[#37475A] rounded-lg px-3 py-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#ADBAC7]">Auto-envoi</span>
            <button
              onClick={() => setAutoSend(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoSend ? "bg-[#FF9900]" : "bg-[#37475A]"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${autoSend ? "translate-x-4.5" : "translate-x-0.5"}`} />
            </button>
            {autoSend && <span className="text-[9px] font-bold text-[#FF9900] animate-pulse">ACTIF</span>}
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

      {/* Transitaire not configured warning */}
      {deliveryMode === "transitaire" && !transitaire?.address_china && (
        <div className="bg-[#FFF8D3] border border-[#FCD200]/40 rounded-xl px-4 py-3 flex items-center gap-3">
          <i className="fa-solid fa-triangle-exclamation text-[#FF9900] flex-shrink-0"></i>
          <p className="text-sm text-[#565959]">
            <span className="font-bold">Adresse transitaire non configurée.</span>{" "}
            Allez dans l'onglet <span className="font-bold">Paramètres</span> pour configurer l'entrepôt Chine.
          </p>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap">
        {[
          { key: "pending",   label: `À envoyer (${pendingOrders.length})`,   color: "text-[#FF9900]" },
          { key: "sent",      label: `DHL envoyées (${sentOrders.length})`,    color: "text-[#007600]" },
          { key: "transit",   label: `En transit (${transitOrders.length})`,   color: "text-[#7c3aed]" },
          { key: "delivered", label: `Livrées (${deliveredOrders.length})`,    color: "text-[#007600]" },
          { key: "error",     label: `Erreurs (${errorOrders.length})`,        color: "text-[#B12704]" },
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
            {tab === "pending" ? "Aucune commande en attente" :
             tab === "transit" ? "Aucune commande en transit" :
             tab === "delivered" ? "Aucune commande livrée" :
             tab === "sent" ? "Aucune commande DHL envoyée" : "Aucune erreur"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayOrders.map(o => {
            const cjSt      = CJ_STATUS[o.cj_order_status || "not_sent"];
            const sendState = sending[o.id];
            const cjItems   = (o.order_items || []).filter(i => i.selected_variant_id || i.cj_product_id);
            const orderMode = getMode(o.id);
            const transitStep = TRANSIT_STEPS.find(s => s.status === o.status);

            return (
              <div key={o.id} className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden hover:border-[#FF9900]/30 transition-all">
                {/* Order header */}
                <div className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-black text-[#0F1111] text-sm font-mono">#{o.id.slice(0, 8).toUpperCase()}</p>
                      {o.status === "paid" && (
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${cjSt.bg} ${cjSt.color}`}>
                          <i className={`fa-solid ${cjSt.icon} mr-1`}></i>{cjSt.label}
                        </span>
                      )}
                      {transitStep && (
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${transitStep.bg} ${transitStep.color} ${transitStep.border}`}>
                          <i className={`fa-solid ${transitStep.icon} mr-1`}></i>{transitStep.label}
                        </span>
                      )}
                      {o.cj_order_id && (
                        <span className="text-[9px] font-mono bg-[#007185]/10 text-[#007185] px-2 py-0.5 rounded-full border border-[#007185]/20">
                          CJ#{o.cj_order_id}
                        </span>
                      )}
                      {o.shipping_mode === "transitaire" && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-[#f5f3ff] text-[#7c3aed] border-[#7c3aed]/30">
                          <i className="fa-solid fa-warehouse mr-1 text-[8px]"></i>Transit
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

                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    <p className="font-black text-[#B12704] text-base">{Number(o.total_amount).toLocaleString()} F</p>

                    {/* Per-order mode toggle (pending only) */}
                    {tab === "pending" && (
                      <div className="flex items-center gap-0.5 bg-[#F3F4F4] border border-[#D5D9D9] rounded-lg p-0.5">
                        {[
                          { key: "dhl",         label: "DHL",     icon: "fa-truck"     },
                          { key: "transitaire", label: "Transit", icon: "fa-warehouse" },
                        ].map(m => (
                          <button
                            key={m.key}
                            onClick={() => setOrderModes(prev => ({ ...prev, [o.id]: m.key }))}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${
                              orderMode === m.key ? "bg-white text-[#FF9900] shadow-sm" : "text-[#ADBAC7] hover:text-[#565959]"
                            }`}
                          >
                            <i className={`fa-solid ${m.icon} text-[8px]`}></i>
                            {m.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Send to CJ */}
                    {tab === "pending" && (
                      <button
                        onClick={() => sendOrderToCJ(o.id)}
                        disabled={sendState === "loading"}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#007185] hover:bg-[#005f73] disabled:opacity-40 text-white rounded-lg text-[11px] font-bold transition-all"
                      >
                        <i className={`fa-solid ${sendState === "loading" ? "fa-spinner fa-spin" : "fa-paper-plane"} text-xs`}></i>
                        {sendState === "loading" ? "Envoi…" : orderMode === "transitaire" ? "→ Transitaire" : "Envoyer à CJ"}
                      </button>
                    )}

                    {/* Advance transit step */}
                    {transitStep?.next && (
                      <button
                        onClick={() => updateOrderStatus(o.id, transitStep.next)}
                        disabled={!!updatingStatus[o.id]}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-40 text-white rounded-lg text-[11px] font-bold transition-all"
                      >
                        <i className={`fa-solid ${updatingStatus[o.id] ? "fa-spinner fa-spin" : "fa-arrow-right"} text-xs`}></i>
                        {transitStep.nextLabel}
                      </button>
                    )}

                    {/* Error retry */}
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

                {/* Non-CJ items note */}
                {(o.order_items || []).filter(i => !i.selected_variant_id).length > 0 && (
                  <div className="px-4 py-1.5 border-t border-[#EAEDED] bg-[#FFF8D3]">
                    <p className="text-[9px] text-[#565959]">
                      <i className="fa-solid fa-info-circle text-[#FF9900] mr-1"></i>
                      {(o.order_items || []).filter(i => !i.selected_variant_id).length} article(s) non-CJ (ignorés)
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

// ─── REVIEWS MODERATION ───────────────────────────────────────────────────────
const ReviewsModerationTab = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("pending"); // pending | approved | all
  const [acting,  setActing]  = useState({});

  const load = async () => {
    setLoading(true);
    let q = supabase.from("reviews").select("*, product:products(name, img)").order("created_at", { ascending: false });
    if (filter === "pending")  q = q.eq("approved", false);
    if (filter === "approved") q = q.eq("approved", true);
    const { data } = await q;
    setReviews(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const approve = async (id) => {
    setActing(a => ({ ...a, [id]: "approving" }));
    await supabase.from("reviews").update({ approved: true }).eq("id", id);
    setActing(a => ({ ...a, [id]: null }));
    load();
  };

  const reject = async (id) => {
    setActing(a => ({ ...a, [id]: "rejecting" }));
    await supabase.from("reviews").delete().eq("id", id);
    setActing(a => ({ ...a, [id]: null }));
    load();
  };

  const Stars = ({ v }) => (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => <i key={i} className={`fa-solid fa-star text-[10px] ${i <= v ? "text-[#FF9900]" : "text-[#D5D9D9]"}`} />)}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-[#131921] rounded-xl px-5 py-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900] mb-0.5">Contenu</p>
        <h2 className="text-white font-black text-lg leading-tight">Modération des avis</h2>
        <p className="text-[10px] text-[#ADBAC7] mt-0.5">Approuver ou supprimer les avis clients avant publication</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: "pending",  label: "En attente" },
          { key: "approved", label: "Approuvés"  },
          { key: "all",      label: "Tous"        },
        ].map(opt => (
          <button key={opt.key} onClick={() => setFilter(opt.key)}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
              filter === opt.key
                ? "bg-[#131921] text-[#FF9900] border-[#131921]"
                : "bg-white text-[#565959] border-[#D5D9D9] hover:border-[#565959]"
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="animate-pulse h-24 bg-white rounded-xl" />)}</div>
      ) : reviews.length === 0 ? (
        <div className="bg-white border border-dashed border-[#D5D9D9] rounded-xl p-10 text-center">
          <i className="fa-regular fa-star text-3xl text-[#D5D9D9] mb-3 block" />
          <p className="text-[#565959] font-bold text-sm">Aucun avis {filter === "pending" ? "en attente" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(rev => (
            <div key={rev.id} className="bg-white border border-[#D5D9D9] rounded-xl p-4">
              <div className="flex items-start gap-4">
                {/* Product thumb */}
                {rev.product?.img && (
                  <img src={rev.product.img} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#D5D9D9] flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-[10px] font-black text-[#0F1111]">{rev.user_name}</p>
                      <p className="text-[9px] text-[#565959] truncate max-w-[200px]">{rev.product?.name}</p>
                      <Stars v={rev.rating} />
                    </div>
                    <p className="text-[8px] text-[#767676]">{new Date(rev.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                  {rev.text && <p className="text-[11px] text-[#0F1111] mt-2 leading-relaxed line-clamp-3">{rev.text}</p>}
                  {(rev.images || []).length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {(rev.images || []).map((url, i) => (
                        <img key={i} src={url} alt="" className="w-10 h-10 rounded object-cover border border-[#D5D9D9]" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Actions */}
              {filter !== "approved" && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-[#EAEDED]">
                  <button onClick={() => approve(rev.id)} disabled={!!acting[rev.id]}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#E8F5E8] hover:bg-[#007600]/10 border border-[#007600]/20 text-[#007600] font-black text-[9px] uppercase rounded-lg transition-all disabled:opacity-50">
                    {acting[rev.id] === "approving"
                      ? <i className="fa-solid fa-circle-notch animate-spin text-[9px]" />
                      : <i className="fa-solid fa-check text-[9px]" />}
                    Approuver
                  </button>
                  <button onClick={() => reject(rev.id)} disabled={!!acting[rev.id]}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#FEE7E5] hover:bg-[#B12704]/10 border border-[#B12704]/20 text-[#B12704] font-black text-[9px] uppercase rounded-lg transition-all disabled:opacity-50">
                    {acting[rev.id] === "rejecting"
                      ? <i className="fa-solid fa-circle-notch animate-spin text-[9px]" />
                      : <i className="fa-solid fa-trash text-[9px]" />}
                    Supprimer
                  </button>
                </div>
              )}
              {filter === "approved" && (
                <div className="flex justify-end mt-3 pt-3 border-t border-[#EAEDED]">
                  <button onClick={() => reject(rev.id)} disabled={!!acting[rev.id]}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#FEE7E5] hover:bg-[#B12704]/10 border border-[#B12704]/20 text-[#B12704] font-black text-[9px] uppercase rounded-lg transition-all disabled:opacity-50">
                    <i className="fa-solid fa-trash text-[9px]" /> Supprimer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── PROMO CODES TAB ──────────────────────────────────────────────────────────
const PromoCodesTab = () => {
  const [codes,   setCodes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState({
    code: '', discount_type: 'percent', discount_value: '', min_order_amount: '', max_uses: '', expires_at: '',
  });
  const [formErr, setFormErr] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });
    setCodes(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const code = form.code.trim().toUpperCase();
    if (!code)                          { setFormErr('Code requis.'); return; }
    if (!form.discount_value || Number(form.discount_value) <= 0) { setFormErr('Valeur de remise invalide.'); return; }
    if (form.discount_type === 'percent' && Number(form.discount_value) > 100) { setFormErr('Max 100 % de remise.'); return; }
    setSaving(true); setFormErr('');
    const { error } = await supabase.from('promo_codes').insert({
      code,
      discount_type:    form.discount_type,
      discount_value:   Number(form.discount_value),
      min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : 0,
      max_uses:         form.max_uses ? Number(form.max_uses) : null,
      expires_at:       form.expires_at || null,
      is_active:        true,
    });
    setSaving(false);
    if (error) { setFormErr(error.message); return; }
    setForm({ code: '', discount_type: 'percent', discount_value: '', min_order_amount: '', max_uses: '', expires_at: '' });
    load();
  };

  const toggleActive = async (id, current) => {
    await supabase.from('promo_codes').update({ is_active: !current }).eq('id', id);
    setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c));
  };

  const deleteCode = async (id) => {
    if (!window.confirm('Supprimer ce code promo ?')) return;
    await supabase.from('promo_codes').delete().eq('id', id);
    setCodes(prev => prev.filter(c => c.id !== id));
  };

  const inputCls = 'w-full border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-lg px-3 py-2 text-sm bg-white';

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="bg-white border border-[#D5D9D9] rounded-xl p-5">
        <h3 className="font-black text-[#0F1111] text-sm mb-4">
          <i className="fa-solid fa-tag text-[#FF9900] mr-2"></i>Créer un code promo
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#565959] mb-1">Code *</label>
            <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              placeholder="PROMO20" className={`${inputCls} font-mono uppercase`} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#565959] mb-1">Type *</label>
            <select value={form.discount_type} onChange={e => setForm(p => ({ ...p, discount_type: e.target.value }))} className={inputCls}>
              <option value="percent">Pourcentage (%)</option>
              <option value="fixed">Montant fixe (FCFA)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#565959] mb-1">
              Valeur * {form.discount_type === 'percent' ? '(%)' : '(FCFA)'}
            </label>
            <input type="number" value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))}
              placeholder={form.discount_type === 'percent' ? '20' : '2000'} className={inputCls} min="1" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#565959] mb-1">Commande minimum (FCFA)</label>
            <input type="number" value={form.min_order_amount} onChange={e => setForm(p => ({ ...p, min_order_amount: e.target.value }))}
              placeholder="5000" className={inputCls} min="0" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#565959] mb-1">Limite d'utilisations</label>
            <input type="number" value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))}
              placeholder="Illimité" className={inputCls} min="1" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#565959] mb-1">Expiration</label>
            <input type="datetime-local" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} className={inputCls} />
          </div>
        </div>
        {formErr && (
          <p className="text-[11px] text-[#B12704] mt-2">
            <i className="fa-solid fa-circle-exclamation mr-1"></i>{formErr}
          </p>
        )}
        <button onClick={handleCreate} disabled={saving}
          className="mt-4 bg-[#FF9900] hover:bg-[#FFB800] text-[#0F1111] font-black px-6 py-2.5 rounded-lg text-sm transition disabled:opacity-50 flex items-center gap-2">
          {saving ? <i className="fa-solid fa-spinner fa-spin text-xs"></i> : <i className="fa-solid fa-plus text-xs"></i>}
          Créer le code
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="animate-pulse h-14 bg-white border border-[#D5D9D9] rounded-xl" />)}</div>
      ) : codes.length === 0 ? (
        <div className="text-center py-12 text-[#565959]">
          <i className="fa-solid fa-tag text-4xl text-[#D5D9D9] mb-3 block"></i>
          <p className="font-bold">Aucun code promo</p>
        </div>
      ) : (
        <div className="space-y-2">
          {codes.map(c => {
            const expired = c.expires_at && new Date(c.expires_at) < new Date();
            const maxed   = c.max_uses != null && c.current_uses >= c.max_uses;
            return (
              <div key={c.id} className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap transition-all ${c.is_active && !expired && !maxed ? 'border-[#007600]/20' : 'border-[#D5D9D9] opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-[#0F1111] font-mono text-sm">{c.code}</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${c.is_active && !expired && !maxed ? 'bg-[#E8F5E8] text-[#007600] border-[#007600]/20' : 'bg-[#EAEDED] text-[#565959] border-[#D5D9D9]'}`}>
                      {expired ? 'Expiré' : maxed ? 'Épuisé' : c.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#565959] mt-0.5">
                    {c.discount_type === 'percent' ? `−${c.discount_value}%` : `−${Number(c.discount_value).toLocaleString()} FCFA`}
                    {c.min_order_amount > 0 && ` · min ${Number(c.min_order_amount).toLocaleString()} FCFA`}
                    {c.max_uses != null && ` · ${c.current_uses}/${c.max_uses} utilisations`}
                    {c.expires_at && ` · exp. ${new Date(c.expires_at).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleActive(c.id, c.is_active)}
                    className={`text-[10px] font-black px-3 py-1.5 rounded-lg border transition ${c.is_active ? 'bg-[#EAEDED] text-[#565959] border-[#D5D9D9] hover:border-[#FF9900]/40' : 'bg-[#E8F5E8] text-[#007600] border-[#007600]/20'}`}>
                    {c.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button onClick={() => deleteCode(c.id)}
                    className="text-[10px] font-black px-2 py-1.5 rounded-lg border border-[#D5D9D9] text-[#B12704] hover:bg-[#FEE7E5] hover:border-[#B12704]/20 transition">
                    <i className="fa-solid fa-trash text-[9px]"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── AFFILIATION TAB ──────────────────────────────────────────────────────────
const AffiliationTab = ({ orders }) => {
  const [newCode, setNewCode] = useState('');
  const [copied, setCopied]   = useState('');

  const refOrders = orders.filter(o => o.referral_code);
  const byCode    = refOrders.reduce((acc, o) => {
    const code = o.referral_code;
    if (!acc[code]) acc[code] = { orders: 0, revenue: 0 };
    acc[code].orders += 1;
    if (['paid', 'delivered'].includes(o.status)) acc[code].revenue += Number(o.total_amount || 0);
    return acc;
  }, {});
  const affiliates = Object.entries(byCode)
    .map(([code, s]) => ({ code, ...s }))
    .sort((a, b) => b.revenue - a.revenue);

  const copyLink = (code) => {
    navigator.clipboard.writeText(`https://www.onefreestyle.store/ref/${code}`);
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  };

  const refRevenue = refOrders
    .filter(o => ['paid', 'delivered'].includes(o.status))
    .reduce((s, o) => s + Number(o.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Create link */}
      <div className="bg-white border border-[#D5D9D9] rounded-xl p-5">
        <h3 className="font-black text-[#0F1111] text-sm mb-1">
          <i className="fa-solid fa-link text-[#FF9900] mr-2"></i>Créer un lien d'affiliation
        </h3>
        <p className="text-[10px] text-[#565959] mb-3">Partagez /ref/CODE avec vos ambassadeurs. Chaque commande passée via ce lien sera trackée.</p>
        <div className="flex gap-2">
          <input
            value={newCode}
            onChange={e => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && newCode && copyLink(newCode)}
            placeholder="INFLUENCEUR_NOM"
            className="flex-1 border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-lg px-3 py-2.5 text-sm font-mono uppercase"
          />
          <button
            onClick={() => { if (newCode) copyLink(newCode); }}
            disabled={!newCode}
            className="bg-[#FF9900] hover:bg-[#FFB800] text-[#0F1111] px-4 py-2.5 rounded-lg text-sm font-black transition disabled:opacity-50 flex items-center gap-2"
          >
            <i className={`fa-solid ${copied === newCode ? 'fa-circle-check' : 'fa-copy'} text-xs`}></i>
            {copied === newCode ? 'Copié !' : 'Copier'}
          </button>
        </div>
        {newCode && (
          <p className="text-[11px] text-[#007185] mt-2 font-mono bg-[#F3F4F4] px-3 py-1.5 rounded">
            https://www.onefreestyle.store/ref/{newCode}
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="fa-users" label="Affiliés actifs" value={affiliates.length} color="#007185" />
        <KpiCard icon="fa-bag-shopping" label="Commandes via ref" value={refOrders.length} color="#FF9900" />
        <KpiCard icon="fa-coins" label="CA affilié" value={`${refRevenue.toLocaleString()} F`} color="#007600" />
      </div>

      {/* Leaderboard */}
      {affiliates.length === 0 ? (
        <div className="text-center py-16 text-[#565959]">
          <i className="fa-solid fa-link text-4xl text-[#D5D9D9] mb-3 block"></i>
          <p className="font-bold">Aucune commande affiliée pour l'instant</p>
          <p className="text-sm mt-1 text-[#ADBAC7]">Créez des liens /ref/CODE et partagez-les avec vos ambassadeurs.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#565959] mb-3">
            <i className="fa-solid fa-trophy text-[#FF9900] mr-1.5"></i>Classement affiliés
          </p>
          {affiliates.map((a, i) => (
            <div key={a.code} className="bg-white border border-[#D5D9D9] rounded-xl px-4 py-3 flex items-center gap-4 hover:border-[#FF9900]/30 transition-all">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 ${
                i === 0 ? 'bg-[#FFD814] text-[#0F1111]'
                : i === 1 ? 'bg-[#EAEDED] text-[#565959]'
                : i === 2 ? 'bg-[#FF9900]/20 text-[#FF9900]'
                : 'bg-[#F3F4F4] text-[#ADBAC7]'
              }`}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#0F1111] text-sm font-mono">{a.code}</p>
                <p className="text-[10px] text-[#565959]">
                  {a.orders} commande{a.orders > 1 ? 's' : ''} · {a.revenue.toLocaleString()} FCFA CA
                </p>
              </div>
              <button
                onClick={() => copyLink(a.code)}
                className="text-xs text-[#007185] hover:text-[#C45500] border border-[#D5D9D9] rounded-lg px-3 py-1.5 hover:border-[#C45500] transition flex items-center gap-1.5 flex-shrink-0"
              >
                <i className={`fa-solid ${copied === a.code ? 'fa-circle-check text-[#007600]' : 'fa-copy'} text-[10px]`}></i>
                {copied === a.code ? 'Copié !' : 'Lien'}
              </button>
            </div>
          ))}
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

        const { count: pendingReviews } = await supabase
          .from("reviews").select("id", { count: "exact", head: true })
          .eq("approved", false);

        setGlobalStats({
          revenue:          totalRevenue,
          orders:           os.length,
          pending:          pendingCount,
          cjPending,
          pendingReviews:   pendingReviews || 0,
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
    { key: "reviews",      icon: "fa-star",            label: "Avis",           badge: globalStats.pendingReviews || 0 },
    { key: "promo",        icon: "fa-tag",             label: "Promos"          },
    { key: "affiliation",  icon: "fa-link",            label: "Affiliation"     },
    { key: "settings",     icon: "fa-gear",            label: "Paramètres"      },
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

        {activeTab === "reviews" && (
          <ReviewsModerationTab />
        )}

        {activeTab === "promo" && (
          <PromoCodesTab />
        )}

        {activeTab === "affiliation" && (
          <AffiliationTab orders={allOrders} />
        )}

        {activeTab === "settings" && (
          <div className="space-y-8">
            <WhatsAppSettingsPanel />
            <TransitaireSettingsPanel />
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdmin;
