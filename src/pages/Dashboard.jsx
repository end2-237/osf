import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase, uploadProductImage, deleteProductImage } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import VendorLivePanel from "../components/VendorLivePanel";
import AddProductWizard from "../components/AddProductWizard";

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

const EMPTY_PRODUCT = { name: "", price: "", type: "Tech Lab", status: "In Stock", description: "" };
const CATEGORIES = ["Audio Lab","Tech Lab","Femme","Clothing","Shoes","Beauté","Accessories","Maison","Sport","Bébé & Enfants","Auto"];

// ─── MINI BAR SPARKLINE ───────────────────────────────────────────────────────
const MiniBars = ({ data, color }) => {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px] h-9">
      {data.map((v, i) => (
        <div key={i} className="w-1.5 rounded-full" style={{ height: `${Math.max(12, (v / max) * 100)}%`, background: color, opacity: 0.35 + 0.65 * (v / max) }} />
      ))}
    </div>
  );
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, delta, spark, color }) => (
  <div className="bg-white border border-gray-200/80 rounded-2xl p-5">
    <p className="text-[13px] font-semibold text-gray-500 mb-2">{label}</p>
    <div className="flex items-end justify-between gap-2">
      <div>
        <p className="text-[26px] font-bold text-gray-900 leading-none tracking-tight">{value}</p>
        {delta != null && (
          <p className={`text-[12px] font-semibold mt-2 flex items-center gap-1 ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            <i className={`fa-solid fa-arrow-trend-${delta >= 0 ? "up" : "down"}`} />{Math.abs(delta)}%
          </p>
        )}
      </div>
      <MiniBars data={spark} color={color} />
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
  const { vendor, signOut, updateVendorField } = useAuth();
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
  const revenue = orders.filter(o => ["delivered","paid"].includes(o.status)).reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const profit = Math.round(revenue * 0.35);
  const expenses = Math.round(revenue * 0.15);

  // monthly revenue (12)
  const monthly = Array(12).fill(0);
  orders.forEach(o => { if (["delivered","paid"].includes(o.status) && o.created_at) monthly[new Date(o.created_at).getMonth()] += Number(o.total_amount || 0); });
  const sparkFrom = (arr) => { const last = arr.slice(-8); return last.some(Boolean) ? last : [3,5,4,6,5,7,6,8]; };

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
    { key: "live",      label: "Live",            icon: "fa-video" },
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
      <aside className={`fixed lg:static z-40 inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white"><i className="fa-solid fa-store text-sm" /></div>
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
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-white border border-gray-200 rounded-2xl animate-pulse" />)}
            </div>
          ) : (
            <>
              {section === "dashboard" && (
                <Overview {...{ revenue, orders, profit, expenses, monthly, sparkFrom, topProduct, topSold, topCats, customers, products }} />
              )}
              {section === "products" && (
                <ProductsView products={products} onDelete={deleteProduct} onAdd={() => setShowAdd(true)} />
              )}
              {section === "orders" && (
                selectedOrder
                  ? <OrderDetail order={selectedOrder} onBack={() => setSelectedOrder(null)} onStatus={updateOrderStatus} vendor={vendor} />
                  : <OrdersView orders={orders} onOpen={setSelectedOrder} />
              )}
              {section === "live" && <VendorLivePanel vendor={vendor} onToast={showToast} />}
              {section === "customers" && <CustomersView customers={customers} />}
              {section === "settings" && <SettingsView vendor={vendor} updateVendorField={updateVendorField} showToast={showToast} />}
            </>
          )}
        </main>
      </div>

      {showAdd && <AddProductWizard vendor={vendor} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); fetchAll(); showToast("Produit publié !"); }} showToast={showToast} />}
      <Toast toast={toast} />
    </div>
  );
};

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
const Overview = ({ revenue, orders, profit, expenses, monthly, sparkFrom, topProduct, topSold, topCats, customers }) => {
  const maxM = Math.max(...monthly, 1);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bonjour 👋</h1>
        <p className="text-[13px] text-gray-500">Voici l'activité de ta boutique.</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Revenu"    value={money(revenue)}       delta={10} spark={sparkFrom(monthly)} color="#3b82f6" />
        <StatCard label="Commandes" value={orders.length}        delta={8}  spark={sparkFrom(orders.map((_, i) => (i % 5) + 1))} color="#f97316" />
        <StatCard label="Bénéfice"  value={money(profit)}        delta={6}  spark={sparkFrom(monthly.map(v => v * 0.35))} color="#10b981" />
        <StatCard label="Dépenses"  value={money(expenses)}      delta={-3} spark={sparkFrom(monthly.map(v => v * 0.15))} color="#ef4444" />
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

        {/* Statistic chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200/80 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div><p className="font-bold text-[15px]">Statistiques</p><p className="text-[12px] text-gray-400">Revenu par mois</p></div>
            <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">Cette année</span>
          </div>
          <div className="flex items-end gap-2 h-52">
            {monthly.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full flex items-end justify-center" style={{ height: "100%" }}>
                  <div className="w-full max-w-[22px] rounded-t-lg bg-gradient-to-t from-orange-500 to-orange-400 group-hover:from-gray-900 group-hover:to-gray-700 transition-colors" style={{ height: `${Math.max(4, (v / maxM) * 100)}%` }} title={money(v)} />
                </div>
                <span className="text-[10px] text-gray-400">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5">
          <p className="font-bold text-[15px] mb-1">Clients</p>
          <p className="text-[12px] text-gray-400 mb-3">Total acheteurs</p>
          <p className="text-3xl font-bold">{customers.length}</p>
          <p className="text-[12px] text-emerald-600 font-semibold mt-1"><i className="fa-solid fa-arrow-trend-up mr-1" />croissance</p>
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
const ProductsView = ({ products, onDelete, onAdd }) => {
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
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">{p.img && <img src={p.img} alt="" className="w-full h-full object-cover" />}</div>
                        <span className="font-semibold text-gray-900 truncate max-w-[160px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.type}</td>
                    <td className="px-4 py-3 font-semibold">{money(p.price)}</td>
                    <td className="px-4 py-3 hidden md:table-cell"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{shortDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-right relative">
                      <button onClick={() => setMenu(menu === p.id ? null : p.id)} className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400"><i className="fa-solid fa-ellipsis-vertical" /></button>
                      {menu === p.id && (
                        <div className="absolute right-4 top-11 z-10 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-32" onMouseLeave={() => setMenu(null)}>
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
const SettingsView = ({ vendor, updateVendorField, showToast }) => {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try { await updateVendorField("member_discount_enabled", !vendor.member_discount_enabled); showToast("Réglage enregistré"); }
    catch (e) { showToast("Erreur", e.message, "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Réglages</h1>
      <div className="bg-white border border-gray-200/80 rounded-2xl p-5">
        <p className="font-bold text-[15px] mb-1">Boutique</p>
        <p className="text-[13px] text-gray-500 mb-4">{vendor.shop_name} · {vendor.email}</p>
        <a href={`/shop/${vendor.shop_name}`} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 text-[12px] font-bold px-4 py-2.5 rounded-xl"><i className="fa-solid fa-arrow-up-right-from-square" />Voir ma boutique</a>
      </div>
      <div className="bg-white border border-gray-200/80 rounded-2xl p-5 flex items-center justify-between gap-3">
        <div><p className="font-bold text-[15px]">Remise membre −20%</p><p className="text-[13px] text-gray-500">Réservée aux membres OFS sur ta boutique.</p></div>
        <button onClick={toggle} disabled={busy} className={`w-14 h-8 rounded-full transition-colors relative flex-shrink-0 ${vendor.member_discount_enabled ? "bg-emerald-500" : "bg-gray-300"}`}>
          <span className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${vendor.member_discount_enabled ? "left-7" : "left-1"}`} />
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
