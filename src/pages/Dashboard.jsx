import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase, uploadProductImage, uploadVendorAsset, deleteProductImage } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import VendorLivePanel from "../components/VendorLivePanel";
import AddProductWizard from "../components/AddProductWizard";
import VendorStats from "../components/VendorStats";
import { AccountSection, CreatorProfileSection } from "../components/VendorAccountSettings";
import { PayoutSection, DeliverySection } from "../components/VendorPayouts";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from "recharts";
import { DISCOUNT_PRESETS, clampDiscountPercent, getVendorDiscountPercent } from "../utils/discountUtils";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const money = (n) => (Number(n) || 0).toLocaleString("fr-FR") + " F";
const shortDate = (iso) => iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "";
const fullDate = (iso) => iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];

const STATUS = {
  pending:    { label: "En attente", cls: "bg-orange-50 text-orange-600 border-orange-200" },
  paid:       { label: "Payée",      cls: "bg-blue-50 text-blue-600 border-blue-200" },
  confirmed:  { label: "Confirmée",  cls: "bg-blue-50 text-blue-600 border-blue-200" },
  shipped:    { label: "Expédiée",   cls: "bg-violet-50 text-violet-600 border-violet-200" },
  in_transit: { label: "En transit", cls: "bg-violet-50 text-violet-600 border-violet-200" },
  delivered:  { label: "Livrée",     cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  cancelled:  { label: "Annulée",    cls: "bg-red-50 text-red-600 border-red-200" },
};
const prodStatus = (s) => s === "Épuisé"
  ? { label: "Épuisé", cls: "bg-red-50 text-red-600 border-red-200" }
  : { label: "Publié", cls: "bg-emerald-50 text-emerald-600 border-emerald-200" };

// Statuts qui comptent dans le chiffre d'affaires : la commande est engagée.
// "pending" (pas encore confirmée) et "cancelled" sont exclus.
const COUNTED_STATUSES = ["confirmed", "paid", "shipped", "in_transit", "delivered"];

const EMPTY_PRODUCT = { name: "", price: "", type: "Tech Lab", status: "In Stock", description: "" };
const CATEGORIES = ["Audio Lab","Tech Lab","Femme","Clothing","Shoes","Beauté","Accessories","Maison","Sport","Bébé & Enfants","Auto","Bien-être","Santé","Nutrition","Alimentation","Restauration"];

// ─── SPARKLINE (Recharts, sans axes ni grille) ────────────────────────────────
const MiniBars = ({ data, color }) => {
  if (!data?.length || Math.max(...data) <= 0) return null;   // pas de fausse tendance
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div className="w-24 h-9">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
          <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, delta, hint, spark, color }) => (
  <div className="bg-white border border-gray-200/80 rounded-2xl p-5">
    <p className="text-[13px] font-semibold text-gray-500 mb-2">{label}</p>
    <div className="flex items-end justify-between gap-2">
      <div>
        <p className="text-[26px] font-bold text-gray-900 leading-none tracking-tight">{value}</p>
        {hint && <p className="text-[11px] text-gray-400 mt-2">{hint}</p>}
        {delta != null && (
          <p className={`text-[12px] font-semibold mt-2 flex items-center gap-1 ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            <i className={`fa-solid fa-arrow-trend-${delta >= 0 ? "up" : "down"}`} />{Math.abs(delta)}%
          </p>
        )}
      </div>
      {spark && <MiniBars data={spark} color={color} />}
    </div>
  </div>
);

// ─── TOAST ────────────────────────────────────────────────────────────────────
const Toast = ({ toast }) => !toast ? null : (
  <div className="fixed bottom-5 right-5 z-[500] bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-xs">
    <i className={`fa-solid ${toast.type === "error" ? "fa-circle-exclamation text-red-400" : "fa-circle-check text-emerald-400"}`} />
    <div><p className="text-[13px] font-bold">{toast.title}</p>{toast.body && <p className="text-[11px] text-gray-300">{toast.body}</p>}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
//   DASHBOARD
// ═══════════════════════════════════════════════════════════════
const Dashboard = () => {
  const { user, vendor, signOut, updateVendorField, updateVendorFields } = useAuth();
  const navigate = useNavigate();

  const initialSection = (() => {
    try { return new URLSearchParams(window.location.search).get("tab") === "live" ? "live" : "dashboard"; } catch { return "dashboard"; }
  })();
  const [section, setSection]   = useState(initialSection);
  const [products, setProducts] = useState([]);
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  const showToast = (title, body, type = "success") => { setToast({ title, body, type }); setTimeout(() => setToast(null), 3000); };

  // ── Data ──
  const fetchAll = async () => {
    if (!vendor?.id) return;
    setLoading(true);
    const [{ data: p }, { data: o }] = await Promise.all([
      supabase.from("products").select("*").eq("vendor_id", vendor.id).order("created_at", { ascending: false }),
      supabase.from("orders").select("*, order_items(id,product_name,quantity,unit_price,selected_size,selected_color,product_img)").eq("vendor_id", vendor.id).order("created_at", { ascending: false }),
    ]);
    setProducts(p || []);
    setOrders(o || []);
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, [vendor?.id]);

  // ── Derived metrics ──
  // Chiffre d'affaires : toute commande engagée (confirmée → livrée). Les
  // commandes en attente ne comptent pas, les annulées non plus.
  const countedOrders = orders.filter(o => COUNTED_STATUSES.includes(o.status));
  const revenue       = countedOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const pendingCount  = orders.filter(o => o.status === "pending").length;
  const avgBasket     = countedOrders.length ? Math.round(revenue / countedOrders.length) : 0;

  // ── 12 derniers mois glissants (année incluse : deux "Mars" ne se cumulent pas) ──
  const now = new Date();
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS[d.getMonth()], year: d.getFullYear(), revenue: 0, orders: 0 };
  });
  const monthIndex = new Map(monthly.map((m, i) => [m.key, i]));
  countedOrders.forEach(o => {
    if (!o.created_at) return;
    const d = new Date(o.created_at);
    const i = monthIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (i != null) { monthly[i].revenue += Number(o.total_amount || 0); monthly[i].orders += 1; }
  });
  const hasRevenue = monthly.some(m => m.revenue > 0);

  // Évolution réelle mois en cours vs mois précédent (null si rien à comparer).
  const growth = (curr, prev) => (prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null);
  const revenueDelta = growth(monthly[11].revenue, monthly[10].revenue);
  const ordersDelta  = growth(monthly[11].orders,  monthly[10].orders);

  // Mini-courbes : 8 derniers mois. Aucune donnée inventée — si tout est à
  // zéro on ne dessine rien plutôt que d'afficher une fausse tendance.
  const sparkFrom = (key) => monthly.slice(-8).map(m => m[key]);

  // top product (by qty sold)
  const soldMap = {};
  orders.forEach(o => (o.order_items || []).forEach(it => { soldMap[it.product_name] = (soldMap[it.product_name] || 0) + Number(it.quantity || 0); }));
  const topSold = Object.entries(soldMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topProduct = products.find(p => p.name === topSold[0]?.[0]) || products[0];

  // top category
  const catMap = {};
  products.forEach(p => { catMap[p.type] = (catMap[p.type] || 0) + 1; });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

  // customers
  const customers = Object.values(orders.reduce((acc, o) => {
    const key = o.client_phone || o.client_name;
    if (!acc[key]) acc[key] = { name: o.client_name, phone: o.client_phone, address: o.client_address, orders: 0, spent: 0 };
    acc[key].orders += 1; acc[key].spent += Number(o.total_amount || 0);
    return acc;
  }, {}));

  const updateOrderStatus = async (id, status) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    setSelectedOrder(prev => prev && prev.id === id ? { ...prev, status } : prev);
    showToast("Statut mis à jour");
  };

  const deleteProduct = async (p) => {
    await supabase.from("products").delete().eq("id", p.id);
    if (p.img) { try { await deleteProductImage(p.img); } catch {} }
    setProducts(prev => prev.filter(x => x.id !== p.id));
    showToast("Produit supprimé");
  };

  const NAV = [
    { key: "dashboard", label: "Tableau de bord", icon: "fa-gauge-high" },
    { key: "products",  label: "Produits",        icon: "fa-box" },
    { key: "orders",    label: "Commandes",       icon: "fa-cart-shopping", badge: pendingCount },
    { key: "stats",     label: "Statistiques",    icon: "fa-chart-line" },
    { key: "live",      label: "Passer en live",  icon: "fa-video" },
    { key: "customers", label: "Clients",         icon: "fa-users" },
    { key: "settings",  label: "Réglages",        icon: "fa-gear" },
  ];

  const go = (k) => { setSection(k); setSelectedOrder(null); setSidebarOpen(false); };

  if (!vendor) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const sectionTitle = NAV.find(n => n.key === section)?.label || "Dashboard";

  return (
    <div className="min-h-screen bg-gray-50 flex text-gray-900">
      {/* ═══ SIDEBAR ═══ */}
      {/* Collante et haute d'un écran : elle ne s'étire plus avec la longueur
          de la page, seule sa navigation défile si elle déborde. */}
      <aside className={`fixed lg:sticky lg:top-0 lg:bottom-auto z-40 inset-y-0 left-0 lg:h-screen w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-orange-500 overflow-hidden flex items-center justify-center text-white flex-shrink-0">
            {vendor.logo_url
              ? <img src={vendor.logo_url} alt="" className="w-full h-full object-cover" />
              : <i className="fa-solid fa-store text-sm" />}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[14px] truncate">{vendor.shop_name}</p>
            <p className="text-[10px] text-gray-400">Espace vendeur</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(n => (
            <button key={n.key} onClick={() => go(n.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${section === n.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <i className={`fa-solid ${n.icon} w-4 text-center`} />
              <span className="flex-1 text-left">{n.label}</span>
              {n.badge > 0 && <span className="bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{n.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100 space-y-1">
          <a href={`/shop/${vendor.shop_name}`} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-100"><i className="fa-solid fa-arrow-up-right-from-square w-4 text-center" />Ma boutique</a>
          <button onClick={() => { signOut(); navigate("/"); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-red-500 hover:bg-red-50"><i className="fa-solid fa-right-from-bracket w-4 text-center" />Déconnexion</button>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* TOPBAR */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center gap-3 px-4 md:px-6 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><i className="fa-solid fa-bars" /></button>
          <div className="hidden sm:flex items-center gap-2 text-[13px] text-gray-400">
            <i className="fa-solid fa-gauge-high text-gray-500" /><span className="text-gray-900 font-semibold">{selectedOrder ? "Détail commande" : sectionTitle}</span>
          </div>
          <div className="flex-1 max-w-md mx-auto hidden md:block">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input placeholder="Rechercher…" className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-2 text-[13px] outline-none focus:ring-2 focus:ring-gray-900/10" />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"><i className="fa-regular fa-bell" /></button>
            {section === "products" && (
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-gray-900 text-white text-[12px] font-bold px-3.5 py-2 rounded-xl hover:bg-gray-800">
                <i className="fa-solid fa-plus" /><span className="hidden sm:inline">Ajouter</span>
              </button>
            )}
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 p-4 md:p-6 overflow-x-clip">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-white border border-gray-200 rounded-2xl animate-pulse" />)}
            </div>
          ) : (
            <>
              {section === "dashboard" && (
                <Overview {...{ revenue, orders, countedOrders, pendingCount, avgBasket, monthly, hasRevenue, revenueDelta, ordersDelta, sparkFrom, topProduct, topSold, topCats, customers, products }} />
              )}
              {section === "products" && (
                <ProductsView products={products} onDelete={deleteProduct} onAdd={() => setShowAdd(true)} onEdit={setEditProduct} />
              )}
              {section === "orders" && (
                selectedOrder
                  ? <OrderDetail order={selectedOrder} onBack={() => setSelectedOrder(null)} onStatus={updateOrderStatus} vendor={vendor} />
                  : <OrdersView orders={orders} onOpen={setSelectedOrder} />
              )}
              {section === "stats" && <VendorStats orders={orders} products={products} />}
              {section === "live" && <VendorLivePanel vendor={vendor} onToast={showToast} />}
              {section === "customers" && <CustomersView customers={customers} />}
              {section === "settings" && <SettingsView user={user} vendor={vendor} updateVendorField={updateVendorField} updateVendorFields={updateVendorFields} showToast={showToast} />}
            </>
          )}
        </main>
      </div>

      {showAdd && <AddProductWizard vendor={vendor} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); fetchAll(); showToast("Produit publié !"); }} showToast={showToast} />}
      {editProduct && (
        <AddProductWizard
          vendor={vendor}
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onDone={() => { setEditProduct(null); fetchAll(); showToast("Produit mis à jour"); }}
          showToast={showToast}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
};

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
const Overview = ({ revenue, orders, countedOrders, pendingCount, avgBasket, monthly, hasRevenue, revenueDelta, ordersDelta, sparkFrom, topProduct, topSold, topCats, customers }) => {
  const maxM = Math.max(...monthly.map(m => m.revenue), 0);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bonjour 👋</h1>
        <p className="text-[13px] text-gray-500">Voici l'activité de ta boutique.</p>
      </div>

      {/* KPI — que des chiffres réellement calculés sur tes commandes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Chiffre d'affaires" value={money(revenue)} delta={revenueDelta}
          hint="commandes confirmées à livrées" spark={sparkFrom("revenue")} color="#3b82f6" />
        <StatCard label="Commandes" value={orders.length} delta={ordersDelta}
          hint={`dont ${countedOrders.length} validée${countedOrders.length > 1 ? "s" : ""}`} spark={sparkFrom("orders")} color="#f97316" />
        <StatCard label="À traiter" value={pendingCount}
          hint={pendingCount > 0 ? "commandes en attente de confirmation" : "tout est à jour 👍"} color="#f59e0b" />
        <StatCard label="Panier moyen" value={money(avgBasket)}
          hint={countedOrders.length ? `sur ${countedOrders.length} commande${countedOrders.length > 1 ? "s" : ""}` : "aucune commande validée"} color="#8b5cf6" />
      </div>

      {/* Top product + statistic */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top product */}
        <div className="bg-gray-900 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-[15px]">Meilleur produit</p>
            <i className="fa-solid fa-arrow-up-right-from-square text-white/40 text-xs" />
          </div>
          {topProduct ? (
            <>
              <div className="rounded-xl overflow-hidden bg-white/5 aspect-video mb-3 flex items-center justify-center">
                {topProduct.img && <img src={topProduct.img} alt="" className="w-full h-full object-contain" />}
              </div>
              <p className="font-bold">{topProduct.name}</p>
              <p className="text-white/60 text-[13px]">{(topSold[0]?.[1] || 0)} ventes · {money(topProduct.price)}</p>
              <div className="mt-4 space-y-2">
                {topSold.slice(1, 4).map(([name, qty]) => (
                  <div key={name} className="bg-white/10 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-[12px] truncate">{name}</span>
                    <span className="text-[12px] font-bold">{qty} ventes</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-white/50 text-sm">Aucune vente encore.</p>}
        </div>

        {/* Chiffre d'affaires mensuel */}
        <div className="lg:col-span-2 bg-white border border-gray-200/80 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="font-bold text-[15px]">Chiffre d'affaires</p>
              <p className="text-[12px] text-gray-400">Par mois · commandes confirmées à livrées</p>
            </div>
            <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg whitespace-nowrap">12 derniers mois</span>
          </div>

          {!hasRevenue ? (
            <div className="h-64 flex flex-col items-center justify-center text-center px-6">
              <i className="fa-solid fa-chart-column text-gray-200 text-4xl mb-3" />
              <p className="text-[14px] font-bold text-gray-700">Pas encore de chiffre d'affaires</p>
              <p className="text-[12px] text-gray-400 mt-1 max-w-sm">
                Le graphique se remplit dès qu'une commande passe au statut confirmée, payée,
                expédiée ou livrée. Les commandes en attente n'y figurent pas.
              </p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#e1e0d9" strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="label" stroke="#c3c2b7" tickLine={false} axisLine={false}
                    tick={{ fill: "#898781", fontSize: 11 }} />
                  <YAxis stroke="#c3c2b7" tickLine={false} axisLine={false} width={48}
                    tick={{ fill: "#898781", fontSize: 11 }}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)} k` : v)} />
                  <RTooltip
                    cursor={{ fill: "rgba(11,11,11,0.04)" }}
                    content={({ active, payload }) => active && payload?.length ? (
                      <div className="bg-gray-900 text-white rounded-xl px-3 py-2 shadow-lg">
                        <p className="text-[10px] text-white/60 mb-0.5">
                          {payload[0].payload.label} {payload[0].payload.year}
                        </p>
                        <p className="text-[13px] font-bold">{money(payload[0].value)}</p>
                      </div>
                    ) : null}
                  />
                  <Bar dataKey="revenue" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-between border-t border-gray-100 mt-3 pt-3 text-[12px]">
                <span className="text-gray-400">Meilleur mois : <b className="text-gray-700">{money(maxM)}</b></span>
                <span className="text-gray-400">Ce mois-ci : <b className="text-gray-700">{money(monthly[11].revenue)}</b></span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5">
          <p className="font-bold text-[15px] mb-1">Clients</p>
          <p className="text-[12px] text-gray-400 mb-3">Total acheteurs</p>
          <p className="text-3xl font-bold">{customers.length}</p>
          <p className="text-[12px] text-gray-400 mt-1">
            {customers.filter(c => c.orders > 1).length} client(s) revenus commander
          </p>
        </div>
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5">
          <p className="font-bold text-[15px] mb-3">Top clients</p>
          <div className="space-y-2">
            {[...customers].sort((a, b) => b.spent - a.spent).slice(0, 3).map((c, i) => (
              <div key={i} className="flex items-center justify-between text-[12px]">
                <span className="font-semibold truncate">{c.name || "Client"}</span>
                <span className="text-gray-500">{money(c.spent)}</span>
              </div>
            ))}
            {customers.length === 0 && <p className="text-[12px] text-gray-400">Aucun client.</p>}
          </div>
        </div>
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5">
          <p className="font-bold text-[15px] mb-3">Top catégories</p>
          <div className="space-y-2">
            {topCats.map(([cat, n]) => (
              <div key={cat} className="flex items-center justify-between text-[12px]">
                <span className="font-semibold">{cat}</span>
                <span className="text-gray-500">{n} produit{n > 1 ? "s" : ""}</span>
              </div>
            ))}
            {topCats.length === 0 && <p className="text-[12px] text-gray-400">Aucune catégorie.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
const ProductsView = ({ products, onDelete, onAdd, onEdit }) => {
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(null);
  const list = q ? products.filter(p => p.name?.toLowerCase().includes(q.toLowerCase())) : products;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Produits</h1>
        <button onClick={onAdd} className="flex items-center gap-2 bg-gray-900 text-white text-[12px] font-bold px-4 py-2.5 rounded-xl hover:bg-gray-800"><i className="fa-solid fa-plus" />Ajouter</button>
      </div>
      <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-xs">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-2 text-[13px] outline-none" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-4 py-3">SKU</th>
                <th className="text-left px-4 py-3">Produit</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Catégorie</th>
                <th className="text-left px-4 py-3">Prix</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Statut</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Ajouté</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.map(p => {
                const st = prodStatus(p.status);
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-gray-400 font-mono text-[11px]">{String(p.id).slice(0, 6)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => onEdit(p)} className="flex items-center gap-3 text-left group/name">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">{p.img && <img src={p.img} alt="" className="w-full h-full object-cover" />}</div>
                        <span className="font-semibold text-gray-900 truncate max-w-[160px] group-hover/name:underline">{p.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.type}</td>
                    <td className="px-4 py-3 font-semibold">{money(p.price)}</td>
                    <td className="px-4 py-3 hidden md:table-cell"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{shortDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-right relative">
                      <button onClick={() => setMenu(menu === p.id ? null : p.id)} className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400"><i className="fa-solid fa-ellipsis-vertical" /></button>
                      {menu === p.id && (
                        <div className="absolute right-4 top-11 z-10 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-36" onMouseLeave={() => setMenu(null)}>
                          <button onClick={() => { setMenu(null); onEdit(p); }} className="w-full text-left px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50"><i className="fa-solid fa-pen mr-2" />Modifier</button>
                          <button onClick={() => { setMenu(null); onDelete(p); }} className="w-full text-left px-3 py-2 text-[12px] text-red-500 hover:bg-red-50"><i className="fa-solid fa-trash mr-2" />Supprimer</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <div className="p-10 text-center text-gray-400 text-sm">Aucun produit. Clique « Ajouter » pour commencer.</div>}
        </div>
      </div>
    </div>
  );
};

// ─── ADD PRODUCT MODAL ────────────────────────────────────────────────────────
const AddProductModal = ({ vendor, onClose, onDone, showToast }) => {
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [img, setImg] = useState(null);
  const [prev, setPrev] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.price) return showToast("Nom et prix requis", "", "error");
    setSaving(true);
    try {
      let imgUrl = "https://via.placeholder.com/600x800";
      if (img) imgUrl = await uploadProductImage(img, vendor.id);
      const { error } = await supabase.from("products").insert({
        name: form.name, price: Number(form.price), type: form.type, status: form.status,
        img: imgUrl, images: [imgUrl], vendor_id: vendor.id, description: form.description || null,
        colors: ["Black", "White"], features: [],
      });
      if (error) throw error;
      onDone();
    } catch (e) { showToast("Erreur", e.message, "error"); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Nouveau produit</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="space-y-3">
          <label className="block aspect-video rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-900 cursor-pointer overflow-hidden relative">
            {prev ? <img src={prev} alt="" className="w-full h-full object-cover" /> : <span className="absolute inset-0 flex flex-col items-center justify-center text-gray-400"><i className="fa-solid fa-image text-2xl mb-1" /><span className="text-[12px] font-semibold">Photo du produit</span></span>}
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setImg(f); setPrev(URL.createObjectURL(f)); } }} />
          </label>
          <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Nom du produit" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-900" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.price} onChange={e => set("price", e.target.value)} type="number" placeholder="Prix (F)" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-900" />
            <select value={form.type} onChange={e => set("type", e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-900">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <select value={form.status} onChange={e => set("status", e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-900">
            <option value="In Stock">En stock</option>
            <option value="Épuisé">Épuisé</option>
          </select>
          <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="Description (optionnel)" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-900 resize-none" />
          <button onClick={submit} disabled={saving} className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-50">
            {saving ? "Ajout…" : "Ajouter le produit"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ORDERS ───────────────────────────────────────────────────────────────────
const OrdersView = ({ orders, onOpen }) => (
  <div className="space-y-4">
    <h1 className="text-2xl font-bold tracking-tight">Commandes</h1>
    <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide border-b border-gray-100">
              <th className="text-left px-4 py-3">Commande</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Client</th>
              <th className="text-left px-4 py-3">Total</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Date</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const st = STATUS[o.status] || STATUS.pending;
              return (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer" onClick={() => onOpen(o)}>
                  <td className="px-4 py-3 font-semibold">#{o.order_number || String(o.id).slice(0, 6)}</td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{o.client_name}</td>
                  <td className="px-4 py-3 font-semibold">{money(o.total_amount)}</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{shortDate(o.created_at)}</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-3 text-right text-gray-300"><i className="fa-solid fa-chevron-right" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {orders.length === 0 && <div className="p-10 text-center text-gray-400 text-sm">Aucune commande.</div>}
      </div>
    </div>
  </div>
);

// ─── ORDER DETAIL ─────────────────────────────────────────────────────────────
const OrderDetail = ({ order, onBack, onStatus, vendor }) => {
  const st = STATUS[order.status] || STATUS.pending;
  const items = order.order_items || [];
  const subtotal = items.reduce((s, it) => s + Number(it.unit_price) * Number(it.quantity), 0);
  const FLOW = ["pending", "confirmed", "shipped", "delivered"];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><i className="fa-solid fa-chevron-left" /></button>
          <h1 className="text-xl font-bold">Commande #{order.order_number || String(order.id).slice(0, 6)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={order.status} onChange={e => onStatus(order.id, e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12px] font-semibold outline-none">
            {Object.keys(STATUS).map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* info + method */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3"><p className="font-bold text-[14px]">Informations</p><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span></div>
              <p className="text-[12px] text-gray-400">Date</p><p className="text-[13px] font-semibold mb-2">{fullDate(order.created_at)}</p>
              <p className="text-[12px] text-gray-400">Référence</p><p className="text-[13px] font-semibold">{order.payment_reference || "—"}</p>
            </div>
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4">
              <p className="font-bold text-[14px] mb-3">Paiement</p>
              <p className="text-[12px] text-gray-400">Méthode</p><p className="text-[13px] font-semibold mb-2">{order.payment_method || "À la livraison"}</p>
              <p className="text-[12px] text-gray-400">Livraison</p><p className="text-[13px] font-semibold">{order.tracking_carrier || "Standard"}</p>
            </div>
          </div>
          {/* items */}
          <div className="bg-white border border-gray-200/80 rounded-2xl p-4">
            <p className="font-bold text-[14px] mb-3">Articles</p>
            <div className="divide-y divide-gray-50">
              {items.map(it => (
                <div key={it.id} className="flex items-center gap-3 py-3">
                  <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">{it.product_img && <img src={it.product_img} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate">{it.product_name}</p>
                    <p className="text-[11px] text-gray-400">{[it.selected_color, it.selected_size].filter(Boolean).join(" · ")} · Qté {it.quantity}</p>
                  </div>
                  <p className="text-[13px] font-bold">{money(it.unit_price * it.quantity)}</p>
                </div>
              ))}
              {items.length === 0 && <p className="text-[12px] text-gray-400 py-3">Aucun article détaillé.</p>}
            </div>
            <div className="border-t border-gray-100 mt-2 pt-3 space-y-1.5">
              <div className="flex justify-between text-[13px]"><span className="text-gray-500">Sous-total</span><span className="font-semibold">{money(subtotal)}</span></div>
              <div className="flex justify-between text-[15px] font-bold"><span>Total</span><span>{money(order.total_amount)}</span></div>
            </div>
          </div>
        </div>

        {/* right column */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200/80 rounded-2xl p-4">
            <p className="font-bold text-[14px] mb-3">Client</p>
            <p className="text-[12px] text-gray-400">Nom</p><p className="text-[13px] font-semibold mb-2">{order.client_name}</p>
            <p className="text-[12px] text-gray-400">Téléphone</p><p className="text-[13px] font-semibold mb-2">{order.client_phone}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-4">
            <p className="font-bold text-[14px] mb-2">Adresse</p>
            <p className="text-[13px] text-gray-600 leading-relaxed">{order.client_address || "—"}</p>
          </div>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-4">
            <p className="font-bold text-[14px] mb-3">Suivi</p>
            <div className="space-y-3">
              {FLOW.map((k, i) => {
                const done = FLOW.indexOf(order.status) >= i;
                return (
                  <div key={k} className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] flex-shrink-0 ${done ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}><i className="fa-solid fa-check" /></div>
                    <div><p className={`text-[12px] font-semibold ${done ? "" : "text-gray-400"}`}>{STATUS[k].label}</p></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
const CustomersView = ({ customers }) => (
  <div className="space-y-4">
    <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
    <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide border-b border-gray-100">
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Téléphone</th>
              <th className="text-left px-4 py-3">Commandes</th>
              <th className="text-left px-4 py-3">Dépensé</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-[12px] font-bold">{(c.name || "?")[0].toUpperCase()}</div>
                    <span className="font-semibold">{c.name || "Client"}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{c.phone}</td>
                <td className="px-4 py-3 font-semibold">{c.orders}</td>
                <td className="px-4 py-3 font-semibold">{money(c.spent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && <div className="p-10 text-center text-gray-400 text-sm">Aucun client.</div>}
      </div>
    </div>
  </div>
);

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
const PAYMENT_OPTIONS = [
  { key: "orange_money",     label: "Orange Money",       sub: "Push USSD · confirmation instantanée", icon: "fa-mobile-screen-button", color: "text-orange-500" },
  { key: "mtn_momo",         label: "MTN MoMo",           sub: "Push USSD · confirmation instantanée", icon: "fa-mobile-screen-button", color: "text-yellow-600" },
  { key: "cash_on_delivery", label: "Paiement à la livraison", sub: "Espèces à la réception du colis", icon: "fa-truck-fast",           color: "text-emerald-600" },
];
const ALL_PAYMENT_KEYS = PAYMENT_OPTIONS.map(o => o.key);

// Numéro d'encaissement rattaché à chaque opérateur mobile. Ces numéros sont
// stockés dans `vendor_payout_settings`, table privée : `vendors` est lisible
// publiquement et n'a pas à les exposer.
const MOMO_FIELDS = {
  orange_money: { field: "momo_orange_number", label: "Numéro Orange Money", placeholder: "237 6 9X XX XX XX", hint: "Numéro sur lequel tu reçois les paiements Orange Money." },
  mtn_momo:     { field: "momo_mtn_number",    label: "Numéro MTN MoMo",     placeholder: "237 6 7X XX XX XX", hint: "Numéro sur lequel tu reçois les paiements MTN MoMo." },
};

// Chiffres uniquement : format attendu par la base et les opérateurs.
const normalizePhone = (v) => String(v || "").replace(/\D/g, "");
const isValidPhone   = (v) => /^[0-9]{8,15}$/.test(normalizePhone(v));

// Sections des réglages : servent d'ancres au rail de droite.
const SETTINGS_SECTIONS = [
  { id: "identite", label: "Identité visuelle",   icon: "fa-image" },
  { id: "boutique", label: "Infos de la boutique", icon: "fa-store" },
  { id: "createur", label: "Profil créateur",      icon: "fa-user-astronaut" },
  { id: "remise",    label: "Remise membre",       icon: "fa-tag" },
  { id: "livraison", label: "Livraison",           icon: "fa-truck-fast" },
  { id: "paiement",  label: "Moyens de paiement",  icon: "fa-mobile-screen-button" },
  { id: "retraits",  label: "Retraits",            icon: "fa-money-bill-transfer" },
  { id: "compte",    label: "Compte & connexion",  icon: "fa-key" },
];

// ─── RAIL DES RÉGLAGES (colonne de droite, collante) ──────────────────────────
const SettingsRail = ({ vendor, active, onJump, todos }) => (
  <aside className="w-full lg:w-[240px] flex-shrink-0 order-first lg:order-none lg:sticky lg:top-[88px] space-y-3">
    {/* Carte boutique */}
    <div className="bg-white border border-gray-200/80 rounded-2xl p-4 text-center">
      <div className="w-14 h-14 mx-auto rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center mb-2">
        {vendor.logo_url
          ? <img src={vendor.logo_url} alt="" className="w-full h-full object-cover" />
          : <i className="fa-solid fa-store text-gray-300 text-xl" />}
      </div>
      <p className="font-bold text-[14px] truncate">{vendor.shop_name}</p>
      <p className="text-[11px] text-gray-400 truncate">{vendor.email}</p>
      <a href={`/shop/${vendor.shop_name}`}
        className="mt-3 block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 text-[12px] font-bold py-2 rounded-xl transition-colors">
        <i className="fa-solid fa-arrow-up-right-from-square mr-1.5 text-[10px]" />Voir ma boutique
      </a>
    </div>

    {/* Sommaire */}
    <nav className="bg-white border border-gray-200/80 rounded-2xl p-2">
      {SETTINGS_SECTIONS.map(sec => (
        <button key={sec.id} onClick={() => onJump(sec.id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-left transition-colors ${
            active === sec.id ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
          }`}>
          <i className={`fa-solid ${sec.icon} w-4 text-center text-[11px]`} />
          <span className="flex-1 truncate">{sec.label}</span>
        </button>
      ))}
    </nav>

    {/* À compléter */}
    {todos.length > 0 && (
      <div className="bg-white border border-gray-200/80 rounded-2xl p-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-gray-400 mb-2">À compléter</p>
        <ul className="space-y-2">
          {todos.map(t => (
            <li key={t.id}>
              <button onClick={() => onJump(t.section)}
                className="text-[12px] text-left text-orange-600 hover:underline flex items-start gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[10px] mt-0.5 flex-shrink-0" />
                <span>{t.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )}

    <p className="text-[11px] text-gray-400 px-1 hidden lg:block">
      Chaque bloc s'enregistre séparément.
    </p>
  </aside>
);

const settingsInput = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors";
const settingsLabel = "text-[11px] font-bold uppercase tracking-wide text-gray-400 block mb-1.5";

const Switch = ({ on, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} className={`w-14 h-8 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50 ${on ? "bg-emerald-500" : "bg-gray-300"}`}>
    <span className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${on ? "left-7" : "left-1"}`} />
  </button>
);

const emptyShopForm = (v) => ({
  shop_name:   v?.shop_name   || "",
  full_name:   v?.full_name   || "",
  phone:       v?.phone       || "",
  city:        v?.city        || "",
  category:    v?.category    || "",
  description: v?.description || "",
});

const SettingsView = ({ user, vendor, updateVendorField, updateVendorFields, showToast }) => {
  const [busy, setBusy]   = useState(false);
  const [rate, setRate]   = useState(getVendorDiscountPercent(vendor));
  const [uploading, setUploading] = useState("");
  const [shop, setShop]   = useState(() => emptyShopForm(vendor));
  const [shopError, setShopError] = useState("");

  useEffect(() => { setRate(getVendorDiscountPercent(vendor)); }, [vendor?.id, vendor?.member_discount_rate]);
  useEffect(() => { setShop(emptyShopForm(vendor)); setShopError(""); }, [vendor?.id]);

  const setShopField = (k, v) => { setShop(f => ({ ...f, [k]: v })); setShopError(""); };
  const shopDirty = Object.keys(shop).some(k => (shop[k] || "") !== (vendor?.[k] || ""));
  const nameChanged = shop.shop_name.trim() !== (vendor?.shop_name || "").trim();

  const acceptedPayments = Array.isArray(vendor.payment_methods) && vendor.payment_methods.length
    ? vendor.payment_methods
    : ALL_PAYMENT_KEYS;

  const save = async (field, value, msg = "Réglage enregistré") => {
    setBusy(true);
    try { await updateVendorField(field, value); showToast(msg); }
    catch (e) { showToast("Erreur", e.message, "error"); }
    finally { setBusy(false); }
  };

  const toggleDiscount = () => save("member_discount_enabled", !vendor.member_discount_enabled);

  const saveRate = () => save("member_discount_rate", clampDiscountPercent(rate), `Remise fixée à ${clampDiscountPercent(rate)} %`);

  const saveShop = async () => {
    const name = shop.shop_name.trim();
    if (!name)               return setShopError("Le nom de la boutique est obligatoire.");
    if (name.length < 3)     return setShopError("Le nom doit faire au moins 3 caractères.");
    if (/[/?#]/.test(name))  return setShopError("Le nom ne peut pas contenir « / », « ? » ou « # » : il sert d'adresse à ta boutique.");
    if (!shop.full_name.trim()) return setShopError("Le nom du gérant est obligatoire.");
    if (shop.phone && !isValidPhone(shop.phone)) return setShopError("Le téléphone doit contenir 8 à 15 chiffres.");

    setBusy(true);
    try {
      // Le nom sert d'adresse publique : on vérifie qu'aucune autre boutique
      // ne le porte déjà (comparaison insensible à la casse).
      if (nameChanged) {
        const { data: clash } = await supabase
          .from("vendors").select("id, shop_name").neq("id", vendor.id);
        const taken = (clash || []).some(v => v.shop_name?.trim().toLowerCase() === name.toLowerCase());
        if (taken) { setShopError("Ce nom de boutique est déjà pris."); setBusy(false); return; }
      }

      await updateVendorFields({
        shop_name:   name,
        full_name:   shop.full_name.trim(),
        phone:       shop.phone ? normalizePhone(shop.phone) : null,
        city:        shop.city.trim() || null,
        category:    shop.category || null,
        description: shop.description.trim() || null,
      });
      showToast("Boutique mise à jour", nameChanged ? "L'adresse de ta boutique a changé." : "");
    } catch (e) {
      setShopError(e.message);
      showToast("Erreur", e.message, "error");
    } finally { setBusy(false); }
  };

  const togglePayment = (key) => {
    const next = acceptedPayments.includes(key)
      ? acceptedPayments.filter(k => k !== key)
      : [...acceptedPayments, key];
    if (next.length === 0) return showToast("Impossible", "Garde au moins un moyen de paiement.", "error");
    // On conserve l'ordre canonique pour un affichage stable côté panier.
    save("payment_methods", ALL_PAYMENT_KEYS.filter(k => next.includes(k)), "Moyens de paiement mis à jour");
  };

  const pickImage = async (e, kind) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(kind);
    try {
      const url = await uploadVendorAsset(file, vendor.id, kind);
      await updateVendorField(kind === "logo" ? "logo_url" : "cover_url", url);
      showToast(kind === "logo" ? "Photo de profil mise à jour" : "Photo de couverture mise à jour");
    } catch (err) { showToast("Erreur", err.message, "error"); }
    finally { setUploading(""); }
  };

  const removeImage = (kind) => save(kind === "logo" ? "logo_url" : "cover_url", null, "Image retirée");

  // ── Sommaire : surligne la section à l'écran et saute à l'ancre ──
  const [activeSection, setActiveSection] = useState(SETTINGS_SECTIONS[0].id);
  const sectionRefs = useRef({});

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      // La bande active commence sous l'en-tête collant.
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 }
    );
    SETTINGS_SECTIONS.forEach(sec => {
      const el = sectionRefs.current[sec.id];
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const jumpTo = (id) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveSection(id);
  };

  // Ce qu'il reste à renseigner — repris dans le rail de droite.
  const todos = [];
  if (!vendor.logo_url)  todos.push({ id: "logo",  section: "identite", label: "Ajouter une photo de profil" });
  if (!vendor.cover_url) todos.push({ id: "cover", section: "identite", label: "Ajouter une photo de couverture" });
  if (!vendor.description) todos.push({ id: "desc", section: "boutique", label: "Décrire ta boutique" });
  if (!vendor.delivery_zones) todos.push({ id: "zones", section: "livraison", label: "Préciser tes zones de livraison" });
  // Le rappel des numéros d'encaissement est porté par la section Retraits,
  // seule à connaître leur état.

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* ═══ COLONNE PRINCIPALE ═══ */}
      <div className="flex-1 min-w-0 w-full max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Réglages</h1>

      {/* ── IDENTITÉ VISUELLE ── */}
      <div id="identite" ref={el => (sectionRefs.current.identite = el)} className="scroll-mt-24 bg-white border border-gray-200/80 rounded-2xl overflow-hidden">
        <div className="relative h-36 bg-gray-100">
          {vendor.cover_url
            ? <img src={vendor.cover_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-gray-300"><i className="fa-solid fa-image text-3xl" /></div>}
          <label className="absolute bottom-3 right-3 bg-white/95 hover:bg-white text-gray-900 text-[11px] font-bold px-3 py-2 rounded-xl cursor-pointer shadow-sm">
            <i className="fa-solid fa-camera mr-1.5" />{uploading === "cover" ? "Envoi…" : "Photo de couverture"}
            <input type="file" accept="image/*" className="hidden" onChange={e => pickImage(e, "cover")} disabled={!!uploading} />
          </label>
          {vendor.cover_url && (
            <button onClick={() => removeImage("cover")} disabled={busy}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/90 hover:bg-white text-gray-500 hover:text-red-500 text-xs">
              <i className="fa-solid fa-trash" />
            </button>
          )}
        </div>
        <div className="p-5 flex items-start gap-4 -mt-12">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 border-4 border-white overflow-hidden flex items-center justify-center">
              {vendor.logo_url
                ? <img src={vendor.logo_url} alt="" className="w-full h-full object-cover" />
                : <i className="fa-solid fa-store text-gray-300 text-2xl" />}
            </div>
            <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gray-900 hover:bg-gray-800 text-white flex items-center justify-center cursor-pointer text-[11px]">
              <i className={`fa-solid ${uploading === "logo" ? "fa-spinner fa-spin" : "fa-camera"}`} />
              <input type="file" accept="image/*" className="hidden" onChange={e => pickImage(e, "logo")} disabled={!!uploading} />
            </label>
          </div>
          <div className="flex-1 min-w-0 pt-12">
            <p className="font-bold text-[15px] truncate">{vendor.shop_name}</p>
            <p className="text-[13px] text-gray-500 truncate mb-3">{vendor.email}</p>
            <p className="text-[12px] text-gray-400 mb-3">
              Ta photo de profil s'affiche sur ta boutique, dans le lien de ta boutique et partout où
              elle apparaît sur Buyticle.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <a href={`/shop/${vendor.shop_name}`} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 text-[12px] font-bold px-4 py-2.5 rounded-xl"><i className="fa-solid fa-arrow-up-right-from-square" />Voir ma boutique</a>
              {vendor.logo_url && (
                <button onClick={() => removeImage("logo")} disabled={busy}
                  className="inline-flex items-center gap-2 text-[12px] font-bold px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-50">
                  <i className="fa-solid fa-trash" />Retirer la photo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── INFOS DE LA BOUTIQUE ── */}
      <div id="boutique" ref={el => (sectionRefs.current.boutique = el)} className="scroll-mt-24 bg-white border border-gray-200/80 rounded-2xl p-5">
        <p className="font-bold text-[15px] mb-1">Informations de la boutique</p>
        <p className="text-[13px] text-gray-500 mb-4">Ce que voient tes clients sur ta page boutique.</p>

        <div className="space-y-3">
          <div>
            <label className={settingsLabel}>Nom de la boutique *</label>
            <input value={shop.shop_name} onChange={e => setShopField("shop_name", e.target.value)}
              className={settingsInput} placeholder="Ex : Douala Wellness" />
            <p className="text-[11px] text-gray-400 mt-1.5">
              Adresse de ta boutique :{" "}
              <span className="font-mono text-gray-600">/shop/{(shop.shop_name || "…").trim()}</span>
            </p>
            {nameChanged && (
              <p className="text-[11px] text-orange-600 mt-1">
                <i className="fa-solid fa-triangle-exclamation mr-1" />
                Changer le nom change l'adresse : les anciens liens partagés ne fonctionneront plus.
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={settingsLabel}>Gérant *</label>
              <input value={shop.full_name} onChange={e => setShopField("full_name", e.target.value)}
                className={settingsInput} placeholder="Nom et prénom" />
            </div>
            <div>
              <label className={settingsLabel}>Téléphone</label>
              <input value={shop.phone} onChange={e => setShopField("phone", e.target.value)}
                className={settingsInput} placeholder="237 6 XX XX XX XX" inputMode="tel" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={settingsLabel}>Ville</label>
              <input value={shop.city} onChange={e => setShopField("city", e.target.value)}
                className={settingsInput} placeholder="Douala" />
            </div>
            <div>
              <label className={settingsLabel}>Catégorie principale</label>
              <select value={shop.category} onChange={e => setShopField("category", e.target.value)}
                className={settingsInput}>
                <option value="">—</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={settingsLabel}>Description</label>
            <textarea value={shop.description} onChange={e => setShopField("description", e.target.value)}
              rows={3} className={`${settingsInput} resize-none`}
              placeholder="Présente ta boutique en quelques lignes…" />
          </div>

          {shopError && (
            <p className="text-[12px] text-red-500">
              <i className="fa-solid fa-circle-exclamation mr-1.5" />{shopError}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button onClick={saveShop} disabled={busy || !shopDirty}
              className="bg-gray-900 text-white text-[12px] font-bold px-5 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-40">
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
            {shopDirty && (
              <button onClick={() => { setShop(emptyShopForm(vendor)); setShopError(""); }} disabled={busy}
                className="text-[12px] font-bold px-4 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100">
                Annuler
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── PROFIL CRÉATEUR ── */}
      <CreatorProfileSection
        user={user} vendor={vendor} showToast={showToast}
        sectionRef={el => (sectionRefs.current.createur = el)}
      />

      {/* ── REMISE MEMBRE ── */}
      <div id="remise" ref={el => (sectionRefs.current.remise = el)} className="scroll-mt-24 bg-white border border-gray-200/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-[15px]">Remise membre</p>
            <p className="text-[13px] text-gray-500">Réservée aux membres Buyticle sur ta boutique.</p>
          </div>
          <Switch on={!!vendor.member_discount_enabled} onClick={toggleDiscount} disabled={busy} />
        </div>

        {vendor.member_discount_enabled && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-gray-400 mb-2">Ton pourcentage</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {DISCOUNT_PRESETS.map(p => (
                <button key={p} onClick={() => setRate(p)}
                  className={`px-3.5 py-2 rounded-xl text-[12px] font-bold border transition-colors ${rate === p ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-900"}`}>
                  −{p}%
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={70} step={1} value={rate}
                onChange={e => setRate(Number(e.target.value))} className="flex-1 accent-gray-900" />
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <input type="number" min={0} max={70} value={rate}
                  onChange={e => setRate(clampDiscountPercent(e.target.value))}
                  className="w-12 bg-transparent text-sm font-bold outline-none text-right" />
                <span className="text-sm font-bold text-gray-400">%</span>
              </div>
              <button onClick={saveRate} disabled={busy || rate === getVendorDiscountPercent(vendor)}
                className="bg-gray-900 text-white text-[12px] font-bold px-4 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-40">
                Enregistrer
              </button>
            </div>
            <p className="text-[12px] text-gray-400 mt-2">
              Exemple : un article à 10 000 F est affiché {money(Math.round(10000 * (1 - clampDiscountPercent(rate) / 100)))} aux membres. Maximum 70 %.
            </p>
          </div>
        )}
      </div>

      {/* ── LIVRAISON ── */}
      <DeliverySection
        vendor={vendor} updateVendorFields={updateVendorFields} showToast={showToast}
        sectionRef={el => (sectionRefs.current.livraison = el)}
      />

      {/* ── MOYENS DE PAIEMENT ── */}
      <div id="paiement" ref={el => (sectionRefs.current.paiement = el)} className="scroll-mt-24 bg-white border border-gray-200/80 rounded-2xl p-5">
        <p className="font-bold text-[15px] mb-1">Moyens de paiement acceptés</p>
        <p className="text-[13px] text-gray-500 mb-4">Seuls les moyens activés ici sont proposés à tes clients au moment de payer.</p>
        <div className="space-y-2">
          {PAYMENT_OPTIONS.map(o => {
            const on = acceptedPayments.includes(o.key);
            return (
              <div key={o.key} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <i className={`fa-solid ${o.icon} ${o.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13px]">{o.label}</p>
                    <p className="text-[11px] text-gray-400">{o.sub}</p>
                  </div>
                  <Switch on={on} onClick={() => togglePayment(o.key)} disabled={busy} />
                </div>

              </div>
            );
          })}
        </div>

        <p className="text-[12px] text-gray-400 mt-3">
          <i className="fa-solid fa-circle-info mr-1.5" />
          Les numéros sur lesquels tu reçois l'argent se règlent dans « Retraits ».
        </p>
      </div>

      {/* ── RETRAITS ── */}
      <PayoutSection
        vendor={vendor} showToast={showToast}
        sectionRef={el => (sectionRefs.current.retraits = el)}
      />

      {/* ── COMPTE & CONNEXION ── */}
      <AccountSection user={user} sectionRef={el => (sectionRefs.current.compte = el)} />
      </div>

      {/* ═══ RAIL DE DROITE ═══ */}
      <SettingsRail vendor={vendor} active={activeSection} onJump={jumpTo} todos={todos} />
    </div>
  );
};

export default Dashboard;
