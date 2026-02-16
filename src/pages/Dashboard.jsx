import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase, uploadProductImage, deleteProductImage } from "../lib/supabase";
import { requestNotificationPermission, setupForegroundNotifications } from "../lib/firebase";
import { useNavigate } from "react-router-dom";

/* ─── STATUS CONFIG ─── */
const STATUS_CFG = {
  pending:   { label: "En attente",  color: "text-orange-500",  bg: "bg-orange-50  dark:bg-orange-500/10",  border: "border-orange-200 dark:border-orange-500/30",  dot: "bg-orange-400" },
  validated: { label: "Validé",      color: "text-blue-500",    bg: "bg-blue-50    dark:bg-blue-500/10",    border: "border-blue-200   dark:border-blue-500/30",    dot: "bg-blue-400"   },
  shipped:   { label: "Expédié",     color: "text-purple-500",  bg: "bg-purple-50  dark:bg-purple-500/10",  border: "border-purple-200 dark:border-purple-500/30",  dot: "bg-purple-400" },
  delivered: { label: "Livré",       color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/30", dot: "bg-emerald-400"},
};
const nextStatus = { pending:"validated", validated:"shipped", shipped:"delivered" };
const nextLabel  = { pending:"Valider", validated:"Expédier", shipped:"Marquer livré" };

/* ─── PRODUCT TYPES ─── */
const TYPES = [
  { value:"Audio Lab",    label:"🎧 Audio Lab"     },
  { value:"Clothing",     label:"👕 Vêtements"     },
  { value:"Shoes",        label:"👟 Chaussures"    },
  { value:"Fragrance",    label:"🌸 Parfums"       },
  { value:"Accessories",  label:"💎 Accessoires"   },
  { value:"Tech Lab",     label:"💻 Tech Lab"      },
];
const STATUSES = ["In Stock","Elite Choice","New Drop","Limited","Hot","Best Seller"];

/* ─── STAT CARD ─── */
const StatCard = ({ icon, label, value, sub, color, gradient }) => (
  <div className={`relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}>
    <div className={`absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-15 ${gradient}`}></div>
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gradient} bg-opacity-15`}>
        <i className={`fa-solid ${icon} ${color} text-sm`}></i>
      </div>
      <div className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/30">
        <i className="fa-solid fa-arrow-up text-[7px]"></i>
        <span>{sub}</span>
      </div>
    </div>
    <p className={`text-2xl font-black italic tracking-tighter ${color}`}>{value}</p>
    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-1">{label}</p>
  </div>
);

/* ─── TOAST ─── */
const Toast = ({ toast, onClose }) => {
  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div className="fixed top-6 right-6 z-[400] animate-slideInRight max-w-sm">
      <div className={`border-2 rounded-2xl p-5 shadow-2xl backdrop-blur-xl flex items-start gap-4 ${
        isError
          ? "bg-white dark:bg-zinc-900 border-red-300 dark:border-red-500/40 shadow-red-100"
          : "bg-white dark:bg-zinc-900 border-primary/40 shadow-[0_0_30px_rgba(0,255,136,0.15)]"
      }`}>
        <div className={`rounded-full p-2 shrink-0 ${isError ? "bg-red-100 dark:bg-red-500/20" : "bg-primary/15"}`}>
          <i className={`fa-solid ${isError ? "fa-xmark text-red-500" : "fa-check text-primary"} text-sm`}></i>
        </div>
        <div className="flex-1">
          <p className={`font-black text-xs uppercase mb-0.5 ${isError ? "text-red-500" : "text-zinc-900 dark:text-white"}`}>{toast.title}</p>
          <p className="text-zinc-500 text-[10px] font-bold">{toast.body}</p>
        </div>
        <button onClick={onClose} className="text-zinc-300 hover:text-zinc-500 transition shrink-0">
          <i className="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>
    </div>
  );
};

/* ─── CONFIRM MODAL ─── */
const ConfirmModal = ({ open, title, desc, onConfirm, onCancel, danger = true }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel}></div>
      <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${danger ? "bg-red-50 dark:bg-red-500/10" : "bg-primary/10"}`}>
          <i className={`fa-solid ${danger ? "fa-trash text-red-500" : "fa-question text-primary"} text-xl`}></i>
        </div>
        <h3 className="text-lg font-black italic uppercase text-center text-zinc-900 dark:text-white mb-2">{title}</h3>
        <p className="text-zinc-400 text-xs font-bold text-center mb-8">{desc}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-zinc-200 dark:border-white/10 text-[10px] font-black uppercase text-zinc-500 hover:bg-zinc-50 dark:hover:bg-white/5 transition">Annuler</button>
          <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase text-white transition hover:scale-105 ${danger ? "bg-red-500 hover:bg-red-600" : "bg-primary text-black"}`}>
            {danger ? "Supprimer" : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════ */
const Dashboard = () => {
  const { vendor, signOut } = useAuth();
  const navigate = useNavigate();

  /* ─ State ─ */
  const [activeTab, setActiveTab]       = useState("inventory");
  const [products, setProducts]         = useState([]);
  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(false);
  const [pageLoading, setPageLoading]   = useState(true);
  const [imageFile, setImageFile]       = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [toast, setToast]               = useState(null);
  const [dragOver, setDragOver]         = useState(false);
  const [showAddForm, setShowAddForm]   = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open:false, type:"", id:null, title:"", desc:"" });
  const [searchInv, setSearchInv]       = useState("");
  const [searchOrders, setSearchOrders] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  /* ─ Notifications ─ */
  const [notifStatus, setNotifStatus]   = useState("idle");
  const [notifToken, setNotifToken]     = useState(null);
  const fcmUnsubRef   = useRef(null);
  const realtimeRef   = useRef(null);

  /* ─ Product Form ─ */
  const EMPTY_PRODUCT = { name:"", price:"", type:"Audio Lab", status:"In Stock", features:"", description:"" };
  const [newProduct, setNewProduct] = useState(EMPTY_PRODUCT);
  const [formStep, setFormStep] = useState(1);

  // ══════════════════════════════════════════════
// REMPLACER UNIQUEMENT le useEffect INIT dans Dashboard.jsx
// (vers la ligne 127 dans votre fichier actuel)
// ══════════════════════════════════════════════

  /* ─── INIT ─── */
  useEffect(() => {
    if (vendor?.id) {
      Promise.all([fetchProducts(), fetchOrders()]).finally(() => setPageLoading(false));
      registerFCMToken();
      listenRealtime();
    }
    return () => {
      if (realtimeRef.current)  supabase.removeChannel(realtimeRef.current);
      if (fcmUnsubRef.current)  fcmUnsubRef.current();
    };
  }, [vendor]);

  // INIT
  useEffect(() => {
    if (!vendor?.id) {
      const safetyTimer = setTimeout(() => {
        console.warn('[DASHBOARD] Safety: forcer pageLoading=false (vendor non chargé)    ');
        setPageLoading(false);
      }, 20000); // 20s max
      return () => clearTimeout(safetyTimer);
    }
  }, [vendor]);

  /* ─── TOAST HELPER ─── */
  const showToast = (title, body, type = "success") => {
    setToast({ title, body, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ─── FETCH ─── */
  const fetchProducts = async () => {
    const { data, error } = await supabase.from("products").select("*").eq("vendor_id", vendor.id).order("created_at", { ascending: false });
    if (!error) setProducts(data || []);
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(id,product_name,quantity,unit_price,selected_size,selected_color,product_img)")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });
    if (!error) setOrders(data || []);
  };

  /* ─── FCM ─── */
  const registerFCMToken = async () => {
    if (!("Notification" in window)) { setNotifStatus("error"); return; }
    setNotifStatus("requesting");
    try {
      const token = await requestNotificationPermission(vendor.id);
      if (token) {
        setNotifToken(token); setNotifStatus("granted");
        const unsub = setupForegroundNotifications((payload) => {
          showToast(payload.notification?.title || "Nouvelle commande", payload.notification?.body || "");
        });
        fcmUnsubRef.current = unsub;
      } else setNotifStatus("denied");
    } catch { setNotifStatus("error"); }
  };

  /* ─── REALTIME ─── */
  const listenRealtime = () => {
    const ch = supabase.channel("orders-dash")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"orders", filter:`vendor_id=eq.${vendor.id}` },
        (payload) => {
          showToast(`🛒 Commande #${payload.new.order_number}`, `${payload.new.client_name} — ${Number(payload.new.total_amount).toLocaleString()} FCFA`);
          fetchOrders();
        })
      .subscribe();
    realtimeRef.current = ch;
  };

  /* ─── IMAGE DRAG & DROP ─── */
  const handleImageChange = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  /* ─── ADD PRODUCT ─── */
  const handleAddProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    const safetyTimer = setTimeout(() => { setLoading(false); showToast("Timeout","Vérifiez votre connexion","error"); }, 20000);
    try {
      let imageUrl = "https://via.placeholder.com/600x800?text=No+Image";
      if (imageFile) {
        try { imageUrl = await uploadProductImage(imageFile, vendor.id); }
        catch (imgErr) { showToast("Image ignorée", imgErr.message, "error"); }
      }
      const features = newProduct.features ? newProduct.features.split(",").map(f => f.trim()).filter(Boolean) : [];
      const { data, error } = await supabase.from("products").insert({
        name: newProduct.name, price: Number(newProduct.price),
        type: newProduct.type, status: newProduct.status,
        img: imageUrl, features, vendor_id: vendor.id,
      }).select();
      if (error) throw error;
      if (!data?.length) throw new Error("Insert bloqué par RLS");
      setNewProduct(EMPTY_PRODUCT); setImageFile(null); setImagePreview(""); setShowAddForm(false); setFormStep(1);
      await fetchProducts();
      showToast("Produit ajouté !", `"${newProduct.name}" est maintenant live sur votre boutique.`);
    } catch (err) {
      showToast("Erreur", err.message, "error");
    } finally { clearTimeout(safetyTimer); setLoading(false); }
  };

  /* ─── DELETE PRODUCT ─── */
  const confirmDeleteProduct = (product) => {
    setConfirmModal({ open:true, type:"product", id:product.id, data:product,
      title:"Supprimer ce produit ?", desc:`"${product.name}" sera définitivement retiré de votre boutique.` });
  };

  const doDeleteProduct = async () => {
    const product = confirmModal.data;
    setConfirmModal({ open:false });
    try {
      if (product.img?.includes("product-images")) await deleteProductImage(product.img);
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) throw error;
      await fetchProducts();
      showToast("Produit supprimé", `"${product.name}" a été retiré.`);
    } catch (err) { showToast("Erreur", err.message, "error"); }
  };

  /* ─── DELETE ORDER ─── */
  const confirmDeleteOrder = (order) => {
    setConfirmModal({ open:true, type:"order", id:order.id, data:order,
      title:"Supprimer cette commande ?", desc:`La commande #${order.order_number} de ${order.client_name} sera définitivement supprimée.` });
  };

  const doDeleteOrder = async () => {
    const order = confirmModal.data;
    setConfirmModal({ open:false });
    try {
      await supabase.from("order_items").delete().eq("order_id", order.id);
      const { error } = await supabase.from("orders").delete().eq("id", order.id);
      if (error) throw error;
      await fetchOrders();
      showToast("Commande supprimée", `Commande #${order.order_number} retirée.`);
    } catch (err) { showToast("Erreur", err.message, "error"); }
  };

  /* ─── UPDATE ORDER ─── */
  const updateOrderStatus = async (orderId, current) => {
    const newS = nextStatus[current];
    if (!newS) return;
    const { error } = await supabase.from("orders").update({ status: newS }).eq("id", orderId);
    if (!error) { await fetchOrders(); showToast("Statut mis à jour", `Commande → ${STATUS_CFG[newS].label}`); }
    else showToast("Erreur", error.message, "error");
  };

  /* ─── SHARE ─── */
  const handleShare = async (type, data = null) => {
    const base = window.location.origin;
    const url  = type === "shop" ? `${base}/shop/${vendor.shop_name}` : `${base}/shop/${vendor.shop_name}?product=${data.id}`;
    try {
      if (navigator.share) await navigator.share({ title: vendor.shop_name, url });
      else { await navigator.clipboard.writeText(url); showToast("Lien copié !", "Collez-le où vous voulez."); }
    } catch {}
    setShowShareModal(false);
  };

  const copyToClipboard = async (type, data = null) => {
    const base = window.location.origin;
    const url  = type === "shop" ? `${base}/shop/${vendor.shop_name}` : `${base}/shop/${vendor.shop_name}?product=${data.id}`;
    await navigator.clipboard.writeText(url);
    showToast("Lien copié !", type === "shop" ? "Lien de votre boutique copié." : `Lien de "${data.name}" copié.`);
  };

  /* ─── STATS ─── */
  const totalRevenue   = orders.filter(o => o.status === "delivered").reduce((a, o) => a + Number(o.total_amount), 0);
  const pendingCount   = orders.filter(o => o.status === "pending").length;
  const deliveredCount = orders.filter(o => o.status === "delivered").length;
  const totalSales     = orders.reduce((a, o) => a + Number(o.total_amount), 0);

  /* ─── FILTERED LISTS ─── */
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchInv.toLowerCase()) ||
    p.type.toLowerCase().includes(searchInv.toLowerCase())
  );

  const filteredOrders = orders
    .filter(o => filterStatus === "all" || o.status === filterStatus)
    .filter(o =>
      o.client_name.toLowerCase().includes(searchOrders.toLowerCase()) ||
      String(o.order_number).includes(searchOrders)
    );

  /* ─── NOTIF BADGE ─── */
  const notifBadge = {
    idle:      { color:"text-zinc-400",       icon:"fa-bell-slash",  label:"Notifications désactivées" },
    requesting:{ color:"text-yellow-500 animate-pulse", icon:"fa-bell", label:"Activation..." },
    granted:   { color:"text-emerald-500",    icon:"fa-bell",        label:"Notifications actives" },
    denied:    { color:"text-red-400",        icon:"fa-bell-slash",  label:"Permission refusée" },
    error:     { color:"text-orange-400",     icon:"fa-bell-slash",  label:"Non supporté" },
  }[notifStatus];

  const handleLogout = async () => { try { await signOut(); navigate("/login"); } catch {} };

  if (pageLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Chargement dashboard...</p>
      </div>
    </div>
  );

  /* ══════════════════════════════════════
      RENDER
  ══════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white">

      {/* ── TOAST ── */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* ── CONFIRM MODAL ── */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        desc={confirmModal.desc}
        onConfirm={confirmModal.type === "product" ? doDeleteProduct : doDeleteOrder}
        onCancel={() => setConfirmModal({ open:false })}
      />

      {/* ══ TOP HEADER BAR ══ */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-white/10 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">

          {/* BRAND */}
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-primary/15 border border-primary/30 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-store text-primary text-sm"></i>
            </div>
            <div className="hidden sm:block">
              <p className="font-black italic uppercase text-sm tracking-tighter text-zinc-900 dark:text-white leading-none">{vendor?.shop_name}</p>
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-400">{vendor?.email}</p>
            </div>
          </div>

          {/* NAV TABS */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-white/10 overflow-x-auto hide-scrollbar">
            {[
              { key:"inventory", icon:"fa-box",          label:"Inventaire" },
              { key:"orders",    icon:"fa-bag-shopping",  label:"Commandes", badge: pendingCount },
              { key:"analytics", icon:"fa-chart-line",    label:"Analytics"  },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                }`}>
                <i className={`fa-solid ${tab.icon} text-xs ${activeTab === tab.key ? "text-primary" : ""}`}></i>
                <span className="hidden md:inline">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[7px] font-black w-4 h-4 rounded-full flex items-center justify-center">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* NOTIF STATUS */}
            <div className={`hidden lg:flex items-center gap-1.5 text-[9px] font-black uppercase ${notifBadge?.color}`}>
              <i className={`fa-solid ${notifBadge?.icon} text-xs`}></i>
              <span className="hidden xl:inline">{notifBadge?.label}</span>
            </div>

            <button onClick={() => setShowShareModal(true)}
              className="flex items-center gap-2 bg-primary text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:scale-105 transition-all shadow-[0_4px_12px_rgba(0,255,136,0.2)]">
              <i className="fa-solid fa-share-nodes text-xs"></i>
              <span className="hidden md:inline">Partager</span>
            </button>

            <button onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/30 transition-all">
              <i className="fa-solid fa-right-from-bracket text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      {/* ══ MAIN CONTENT ══ */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-8">

        {/* ── STATS ROW ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon="fa-coins"        label="Chiffre d'affaires" value={`${totalSales.toLocaleString()} F`}    sub="total cumulé"  color="text-primary"        gradient="bg-emerald-400" />
          <StatCard icon="fa-box"          label="Produits actifs"    value={products.length}                        sub="en catalogue"  color="text-blue-500"       gradient="bg-blue-400"   />
          <StatCard icon="fa-clock"        label="En attente"         value={pendingCount}                           sub="à traiter"     color="text-orange-500"     gradient="bg-orange-400" />
          <StatCard icon="fa-check-circle" label="Commandes livrées"  value={deliveredCount}                         sub="succès"        color="text-emerald-500"    gradient="bg-emerald-400"/>
        </div>

        {/* ══════════════════════════ INVENTORY TAB ══════════════════════════ */}
        {activeTab === "inventory" && (
          <div className="space-y-6">

            {/* TOOLBAR */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm"></i>
                <input type="text" value={searchInv} onChange={e => setSearchInv(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-primary transition-colors" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-zinc-400 hidden sm:block">{filteredProducts.length} produits</span>
                <button onClick={() => { setShowAddForm(!showAddForm); setFormStep(1); setNewProduct(EMPTY_PRODUCT); setImagePreview(""); setImageFile(null); }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    showAddForm ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-white" : "bg-zinc-900 dark:bg-primary text-white dark:text-black hover:bg-primary hover:text-black"
                  }`}>
                  <i className={`fa-solid ${showAddForm ? "fa-xmark" : "fa-plus"} text-xs`}></i>
                  <span>{showAddForm ? "Fermer" : "Ajouter Produit"}</span>
                </button>
              </div>
            </div>

            {/* ── ADD PRODUCT FORM ── */}
            {showAddForm && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-lg">
                {/* FORM HEADER */}
                <div className="p-6 border-b border-zinc-100 dark:border-white/5 bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/15 border border-primary/30 rounded-xl flex items-center justify-center">
                        <i className="fa-solid fa-wand-magic-sparkles text-primary text-sm"></i>
                      </div>
                      <div>
                        <h3 className="font-black italic uppercase text-sm tracking-tighter text-zinc-900 dark:text-white">Nouveau Produit</h3>
                        <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Étape {formStep}/3</p>
                      </div>
                    </div>
                    {/* STEP INDICATORS */}
                    <div className="hidden sm:flex items-center gap-2">
                      {[1,2,3].map(s => (
                        <button key={s} onClick={() => formStep > s && setFormStep(s)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${
                            s === formStep ? "bg-primary text-black" : s < formStep ? "bg-primary/20 text-primary" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                          }`}>
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${s === formStep ? "bg-black/20" : ""}`}>
                            {s < formStep ? "✓" : s}
                          </span>
                          <span>{["Info","Détails","Image"][s-1]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAddProduct} className="p-6">

                  {/* STEP 1 — BASIC INFO */}
                  {formStep === 1 && (
                    <div className="space-y-5">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Nom du produit *</label>
                          <input type="text" required placeholder="Ex: AirPods Pro 2 Elite" value={newProduct.name}
                            onChange={e => setNewProduct({...newProduct, name:e.target.value})}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-primary transition-colors" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Prix (FCFA) *</label>
                          <div className="relative">
                            <input type="number" required placeholder="45000" min="0" value={newProduct.price}
                              onChange={e => setNewProduct({...newProduct, price:e.target.value})}
                              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-primary transition-colors pr-16" />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-400 uppercase">FCFA</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Catégorie *</label>
                          <div className="grid grid-cols-2 gap-2">
                            {TYPES.map(t => (
                              <button key={t.value} type="button" onClick={() => setNewProduct({...newProduct, type:t.value})}
                                className={`py-2.5 px-3 rounded-xl text-[10px] font-black border-2 transition-all text-left ${
                                  newProduct.type === t.value ? "border-primary bg-primary/10 text-primary" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300"
                                }`}>
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Statut</label>
                          <div className="grid grid-cols-2 gap-2">
                            {STATUSES.map(s => (
                              <button key={s} type="button" onClick={() => setNewProduct({...newProduct, status:s})}
                                className={`py-2.5 px-3 rounded-xl text-[10px] font-black border-2 transition-all ${
                                  newProduct.status === s ? "border-primary bg-primary/10 text-primary" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300"
                                }`}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button type="button" onClick={() => setFormStep(2)} disabled={!newProduct.name || !newProduct.price}
                          className="bg-zinc-900 dark:bg-primary text-white dark:text-black px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-primary hover:text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                          Suivant <i className="fa-solid fa-arrow-right text-xs"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2 — DETAILS */}
                  {formStep === 2 && (
                    <div className="space-y-5">
                      <div>
                        <label className="text-[9px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">
                          Features / Caractéristiques
                          <span className="text-zinc-300 ml-2 normal-case font-bold">(séparées par des virgules)</span>
                        </label>
                        <textarea value={newProduct.features}
                          onChange={e => setNewProduct({...newProduct, features:e.target.value})}
                          placeholder="Ex: Réduction de bruit active, 30h autonomie, Bluetooth 5.3, Waterproof IPX4"
                          rows={3}
                          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-primary transition-colors resize-none" />
                        {newProduct.features && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {newProduct.features.split(",").filter(f => f.trim()).map((f, i) => (
                              <span key={i} className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-black px-2.5 py-1 rounded-full uppercase">
                                <i className="fa-solid fa-bolt text-[7px] mr-1"></i>{f.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* PREVIEW CARD */}
                      {newProduct.name && (
                        <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 flex items-center gap-4">
                          <div className="w-14 h-14 bg-zinc-200 dark:bg-zinc-700 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <i className="fa-solid fa-image text-zinc-400 text-xl"></i>}
                          </div>
                          <div>
                            <p className="font-black uppercase italic text-sm tracking-tight text-zinc-900 dark:text-white">{newProduct.name}</p>
                            <p className="text-[9px] font-black uppercase text-zinc-400">{newProduct.type} · {newProduct.status}</p>
                            <p className="text-primary font-black text-sm mt-0.5">{Number(newProduct.price||0).toLocaleString()} FCFA</p>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between">
                        <button type="button" onClick={() => setFormStep(1)} className="text-[10px] font-black uppercase text-zinc-400 hover:text-zinc-700 transition flex items-center gap-2">
                          <i className="fa-solid fa-arrow-left text-xs"></i> Retour
                        </button>
                        <button type="button" onClick={() => setFormStep(3)}
                          className="bg-zinc-900 dark:bg-primary text-white dark:text-black px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-primary hover:text-black transition-all flex items-center gap-2">
                          Suivant <i className="fa-solid fa-arrow-right text-xs"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3 — IMAGE */}
                  {formStep === 3 && (
                    <div className="space-y-5">
                      {/* DRAG & DROP ZONE */}
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDragOver(false); handleImageChange(e.dataTransfer.files[0]); }}
                        className={`relative border-2 border-dashed rounded-2xl transition-all duration-300 overflow-hidden ${
                          dragOver ? "border-primary bg-primary/5 scale-[1.01]" : imagePreview ? "border-primary/30 bg-primary/3" : "border-zinc-300 dark:border-zinc-700 hover:border-primary/50"
                        }`}>
                        <input type="file" accept="image/*" onChange={e => handleImageChange(e.target.files[0])}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        {imagePreview ? (
                          <div className="relative">
                            <img src={imagePreview} className="w-full h-56 object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <div className="bg-white text-zinc-900 px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2">
                                <i className="fa-solid fa-pen"></i> Changer
                              </div>
                            </div>
                            <button type="button" onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(""); }}
                              className="absolute top-3 right-3 z-20 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg">
                              <i className="fa-solid fa-xmark text-xs"></i>
                            </button>
                            <div className="absolute bottom-3 left-3 bg-primary text-black text-[8px] font-black px-2.5 py-1 rounded-full uppercase shadow-lg z-20">
                              <i className="fa-solid fa-check mr-1"></i>Image sélectionnée
                            </div>
                          </div>
                        ) : (
                          <div className="py-16 text-center px-8">
                            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-colors">
                              <i className="fa-solid fa-cloud-arrow-up text-3xl text-zinc-400"></i>
                            </div>
                            <p className="font-black uppercase text-sm text-zinc-600 dark:text-zinc-300 mb-1">Glissez votre image ici</p>
                            <p className="text-[10px] font-bold text-zinc-400 mb-3">ou cliquez pour parcourir</p>
                            <div className="inline-flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-[9px] font-black uppercase text-zinc-400 px-3 py-1.5 rounded-full">
                              <i className="fa-solid fa-image text-xs"></i> JPG, PNG, WEBP — max 10MB
                            </div>
                          </div>
                        )}
                      </div>

                      {/* FINAL RECAP */}
                      <div className="bg-gradient-to-r from-primary/5 to-transparent border border-primary/20 rounded-xl p-4">
                        <p className="text-[9px] font-black uppercase text-primary mb-3 tracking-widest flex items-center gap-2">
                          <i className="fa-solid fa-list-check text-xs"></i> Récapitulatif
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div><span className="text-zinc-400 font-bold uppercase">Nom: </span><span className="font-black text-zinc-900 dark:text-white">{newProduct.name}</span></div>
                          <div><span className="text-zinc-400 font-bold uppercase">Prix: </span><span className="font-black text-primary">{Number(newProduct.price||0).toLocaleString()} F</span></div>
                          <div><span className="text-zinc-400 font-bold uppercase">Type: </span><span className="font-black text-zinc-900 dark:text-white">{newProduct.type}</span></div>
                          <div><span className="text-zinc-400 font-bold uppercase">Statut: </span><span className="font-black text-zinc-900 dark:text-white">{newProduct.status}</span></div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <button type="button" onClick={() => setFormStep(2)} className="text-[10px] font-black uppercase text-zinc-400 hover:text-zinc-700 transition flex items-center gap-2">
                          <i className="fa-solid fa-arrow-left text-xs"></i> Retour
                        </button>
                        <button type="submit" disabled={loading}
                          className="bg-primary text-black px-10 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(0,255,136,0.3)] flex items-center gap-2">
                          {loading ? <><i className="fa-solid fa-circle-notch animate-spin text-xs"></i> En cours...</> : <><i className="fa-solid fa-rocket text-xs"></i> Publier le produit</>}
                        </button>
                      </div>
                    </div>
                  )}

                </form>
              </div>
            )}

            {/* ── PRODUCTS TABLE ── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden">
              {filteredProducts.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-box-open text-2xl text-zinc-300"></i>
                  </div>
                  <p className="font-black italic uppercase text-zinc-400">{searchInv ? "Aucun résultat" : "Aucun produit"}</p>
                  <p className="text-[10px] font-bold text-zinc-300 mt-1">{searchInv ? "Essayez un autre terme" : "Ajoutez votre premier produit"}</p>
                  {!searchInv && <button onClick={() => setShowAddForm(true)} className="mt-4 bg-primary text-black px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider hover:scale-105 transition-all">
                    <i className="fa-solid fa-plus mr-2"></i>Ajouter
                  </button>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-white/5">
                        <th className="text-left px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Produit</th>
                        <th className="text-left px-4 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 hidden md:table-cell">Catégorie</th>
                        <th className="text-left px-4 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Prix</th>
                        <th className="text-left px-4 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 hidden sm:table-cell">Statut</th>
                        <th className="text-right px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-white/5">
                      {filteredProducts.map(p => (
                        <tr key={p.id} className="group hover:bg-zinc-50 dark:hover:bg-white/3 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800">
                                <img src={p.img} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-black uppercase italic text-xs tracking-tight text-zinc-900 dark:text-white truncate max-w-[140px]">{p.name}</p>
                                <p className="text-[9px] text-zinc-400 font-bold mt-0.5">{p.features?.slice(0,1)[0] || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 hidden md:table-cell">
                            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[9px] font-black uppercase px-2.5 py-1 rounded-full">{p.type}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-black italic text-primary text-sm">{Number(p.price).toLocaleString()}<span className="text-[9px] text-zinc-400 ml-0.5">F</span></span>
                          </td>
                          <td className="px-4 py-4 hidden sm:table-cell">
                            <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full border ${
                              p.status === "In Stock" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30" :
                              p.status === "Limited"  ? "bg-orange-50  dark:bg-orange-500/10  text-orange-600  dark:text-orange-400  border-orange-200  dark:border-orange-500/30" :
                              "bg-primary/10 text-primary border-primary/20"
                            }`}>{p.status}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <a href={`/shop/${vendor?.shop_name}?product=${p.id}`} target="_blank" rel="noreferrer"
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-primary hover:border-primary/30 transition-all">
                                <i className="fa-solid fa-eye text-xs"></i>
                              </a>
                              <button onClick={() => copyToClipboard("product", p)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-blue-500 hover:border-blue-200 transition-all">
                                <i className="fa-solid fa-link text-xs"></i>
                              </button>
                              <button onClick={() => confirmDeleteProduct(p)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/30 transition-all">
                                <i className="fa-solid fa-trash text-xs"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════ ORDERS TAB ══════════════════════════ */}
        {activeTab === "orders" && (
          <div className="space-y-5">

            {/* ORDERS TOOLBAR */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm"></i>
                <input type="text" value={searchOrders} onChange={e => setSearchOrders(e.target.value)}
                  placeholder="Rechercher par client ou n° commande..."
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-primary transition-colors" />
              </div>
              {/* STATUS FILTERS */}
              <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
                {[
                  { value:"all",       label:"Tous",       count: orders.length },
                  { value:"pending",   label:"En attente", count: orders.filter(o=>o.status==="pending").length },
                  { value:"validated", label:"Validés",    count: orders.filter(o=>o.status==="validated").length },
                  { value:"shipped",   label:"Expédiés",   count: orders.filter(o=>o.status==="shipped").length },
                  { value:"delivered", label:"Livrés",     count: orders.filter(o=>o.status==="delivered").length },
                ].map(f => (
                  <button key={f.value} onClick={() => setFilterStatus(f.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all border ${
                      filterStatus === f.value
                        ? "bg-zinc-900 dark:bg-primary text-white dark:text-black border-transparent"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600 dark:hover:text-zinc-200 bg-white dark:bg-zinc-800"
                    }`}>
                    {f.label}
                    <span className={`min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-black ${filterStatus===f.value ? "bg-white/20 text-white dark:text-black dark:bg-black/20" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500"}`}>{f.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ORDERS LIST */}
            {filteredOrders.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl py-20 text-center">
                <i className="fa-solid fa-bag-shopping text-4xl text-zinc-200 dark:text-zinc-700 block mb-4"></i>
                <p className="font-black italic uppercase text-zinc-400">Aucune commande trouvée</p>
                <p className="text-[10px] font-bold text-zinc-300 mt-1">Modifiez vos filtres ou attendez de nouveaux clients</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map(order => {
                  const s = STATUS_CFG[order.status] || STATUS_CFG.pending;
                  return (
                    <div key={order.id} className={`bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden transition-all hover:shadow-lg ${s.border}`}>
                      {/* ORDER HEADER */}
                      <div className={`px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-white/5 ${s.bg}`}>
                        <div className="flex items-center gap-4">
                          {/* STATUS DOT + NUMBER */}
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${s.dot}`}></div>
                            <span className="font-black text-lg italic tracking-tighter text-zinc-900 dark:text-white">
                              #{order.order_number}
                            </span>
                          </div>
                          {/* CLIENT */}
                          <div>
                            <p className="font-black text-sm uppercase italic text-zinc-900 dark:text-white leading-none">{order.client_name}</p>
                            <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${s.color}`}>{s.label}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xl font-black italic tracking-tighter text-zinc-900 dark:text-white">{Number(order.total_amount).toLocaleString()} <span className="text-[11px] text-zinc-400">FCFA</span></p>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase">{order.payment_method?.replace("_"," ")}</p>
                          </div>
                          {/* ACTIONS */}
                          <div className="flex items-center gap-2">
                            {nextStatus[order.status] && (
                              <button onClick={() => updateOrderStatus(order.id, order.status)}
                                className="bg-zinc-900 dark:bg-primary text-white dark:text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-primary hover:text-black transition-all hover:scale-105">
                                {nextLabel[order.status]}
                              </button>
                            )}
                            {order.status === "delivered" && (
                              <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-3 py-2 rounded-xl text-[9px] font-black uppercase">
                                <i className="fa-solid fa-check text-xs"></i> Finalisé
                              </div>
                            )}
                            <button onClick={() => confirmDeleteOrder(order)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-300 hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/30 transition-all hover:bg-red-50 dark:hover:bg-red-500/5">
                              <i className="fa-solid fa-trash text-xs"></i>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* ORDER DETAILS */}
                      <div className="px-6 py-4 grid md:grid-cols-2 gap-6">
                        {/* ITEMS */}
                        <div>
                          <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-3">Articles commandés</p>
                          <div className="space-y-2">
                            {order.order_items?.map(item => (
                              <div key={item.id} className="flex items-center gap-3">
                                {item.product_img && (
                                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-100 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800">
                                    <img src={item.product_img} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-black uppercase truncate text-zinc-900 dark:text-white">{item.product_name}</p>
                                  <p className="text-[8px] text-zinc-400 font-bold">{item.selected_size} · {item.selected_color} · ×{item.quantity}</p>
                                </div>
                                <p className="text-[10px] font-black italic text-primary shrink-0">{(Number(item.unit_price)*item.quantity).toLocaleString()} F</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* CLIENT INFO */}
                        <div>
                          <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-3">Informations client</p>
                          <div className="space-y-2">
                            {[
                              { icon:"fa-phone",         val: order.client_phone   },
                              { icon:"fa-location-dot",  val: order.client_address },
                              order.payment_reference && { icon:"fa-receipt", val:`Réf: ${order.payment_reference}` },
                            ].filter(Boolean).map((row, i) => (
                              <div key={i} className="flex items-start gap-3 text-[10px]">
                                <i className={`fa-solid ${row.icon} text-primary text-xs mt-0.5 w-3`}></i>
                                <span className="font-bold text-zinc-600 dark:text-zinc-300">{row.val}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════ ANALYTICS TAB ══════════════════════════ */}
        {activeTab === "analytics" && (
          <div className="space-y-6">

            {/* TOP METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* REVENUE CHART PLACEHOLDER */}
              <div className="md:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Revenus cumulés</p>
                    <p className="text-3xl font-black italic tracking-tighter text-primary mt-1">{totalSales.toLocaleString()} <span className="text-zinc-400 text-base not-italic font-bold">FCFA</span></p>
                  </div>
                  <div className="bg-primary/10 border border-primary/20 text-primary text-[9px] font-black uppercase px-3 py-2 rounded-xl flex items-center gap-1.5">
                    <i className="fa-solid fa-arrow-trend-up text-xs"></i> En hausse
                  </div>
                </div>
                {/* VISUAL BARS */}
                <div className="flex items-end gap-2 h-24">
                  {orders.slice(0,10).reverse().map((o, i) => {
                    const max = Math.max(...orders.map(x => Number(x.total_amount)), 1);
                    const pct = (Number(o.total_amount)/max)*100;
                    return (
                      <div key={o.id} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="w-full rounded-t-lg transition-all duration-700 group-hover:opacity-100 opacity-70"
                          style={{ height:`${Math.max(pct,8)}%`, backgroundColor: o.status==="delivered" ? "#00ff88" : o.status==="shipped" ? "#a855f7" : "#f97316", minHeight:"6px" }}>
                        </div>
                        <span className="text-[7px] font-black text-zinc-400 hidden group-hover:block">#{o.order_number}</span>
                      </div>
                    );
                  })}
                  {orders.length === 0 && [...Array(8)].map((_, i) => (
                    <div key={i} className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-t-lg" style={{height:`${20+i*10}%`}}></div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-4 text-[9px] font-black uppercase text-zinc-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span>Livré</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>Expédié</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span>En attente</span>
                </div>
              </div>

              {/* STATUS DONUT */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-6">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-5">Répartition commandes</p>
                <div className="space-y-3">
                  {Object.entries(STATUS_CFG).map(([key, cfg]) => {
                    const count = orders.filter(o => o.status === key).length;
                    const pct   = orders.length ? Math.round((count/orders.length)*100) : 0;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${cfg.dot}`}></div>
                            <span className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-300">{cfg.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black ${cfg.color}`}>{count}</span>
                            <span className="text-[9px] text-zinc-400 font-bold">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000 ${cfg.dot}`} style={{ width:`${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-white/5">
                  <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">Total commandes</p>
                  <p className="text-2xl font-black italic text-zinc-900 dark:text-white">{orders.length}</p>
                </div>
              </div>
            </div>

            {/* PRODUCTS PERFORMANCE */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Performance catalogue</p>
                <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[9px] font-black uppercase px-3 py-1.5 rounded-full">{products.length} produits</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {TYPES.filter(t => products.some(p => p.type === t.value)).map(t => {
                  const count = products.filter(p => p.type === t.value).length;
                  const pct   = products.length ? Math.round((count/products.length)*100) : 0;
                  return (
                    <div key={t.value} className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 hover:bg-primary/5 dark:hover:bg-primary/5 border border-zinc-100 dark:border-zinc-700 hover:border-primary/20 transition-all group">
                      <p className="text-xl mb-1">{t.label.split(" ")[0]}</p>
                      <p className="font-black uppercase text-xs text-zinc-900 dark:text-white">{t.label.split(" ").slice(1).join(" ")}</p>
                      <p className="text-2xl font-black italic text-primary mt-2">{count}</p>
                      <div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-2">
                        <div className="h-full bg-primary rounded-full transition-all duration-700 group-hover:opacity-100 opacity-60" style={{ width:`${pct}%` }}></div>
                      </div>
                      <p className="text-[9px] font-bold text-zinc-400 mt-1">{pct}% du catalogue</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FCM / NOTIFICATIONS STATUS */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-6">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-5">Système de notifications</p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className={`flex items-center gap-4 p-4 rounded-xl border ${notifStatus==="granted" ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30" : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${notifStatus==="granted" ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-zinc-200 dark:bg-zinc-700"}`}>
                    <i className={`fa-solid ${notifBadge?.icon} text-xl ${notifBadge?.color}`}></i>
                  </div>
                  <div>
                    <p className={`font-black text-sm uppercase italic ${notifBadge?.color}`}>{notifBadge?.label}</p>
                    <p className="text-[9px] font-bold text-zinc-400 mt-0.5">Firebase Cloud Messaging</p>
                    {notifStatus === "denied" && (
                      <button onClick={registerFCMToken} className="text-[9px] font-black uppercase text-primary underline mt-1">Réactiver →</button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl border bg-primary/5 border-primary/20">
                  <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                    <i className="fa-solid fa-database text-primary text-xl"></i>
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase italic text-primary">Realtime Actif</p>
                    <p className="text-[9px] font-bold text-zinc-400 mt-0.5">Supabase Database Changes</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
                      <span className="text-[8px] font-black text-primary uppercase">Écoute active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ SHARE MODAL ══ */}
      {showShareModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowShareModal(false)}></div>
          <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 w-full max-w-md p-8 rounded-3xl shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-primary/15 border border-primary/30 rounded-2xl flex items-center justify-center">
                <i className="fa-solid fa-share-nodes text-primary text-lg"></i>
              </div>
              <div>
                <h3 className="text-lg font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white">Partager</h3>
                <p className="text-[9px] font-black uppercase text-zinc-400">{vendor?.shop_name}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* SHARE SHOP */}
              <div className="flex items-stretch gap-2">
                <button onClick={() => handleShare("shop")}
                  className="flex-1 p-4 bg-primary text-black rounded-2xl flex items-center justify-between hover:scale-[1.02] transition-all">
                  <div className="text-left">
                    <p className="font-black uppercase text-[10px] tracking-widest">Boutique entière</p>
                    <p className="text-[9px] font-bold opacity-60 italic">/shop/{vendor?.shop_name}</p>
                  </div>
                  <i className="fa-solid fa-arrow-up-right-from-square"></i>
                </button>
                <button onClick={() => copyToClipboard("shop")}
                  className="px-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl hover:text-primary transition-colors text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                  <i className="fa-solid fa-copy"></i>
                </button>
                <a href={`/shop/${vendor?.shop_name}`} target="_blank" rel="noreferrer"
                  className="px-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center hover:text-primary transition-colors text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                  <i className="fa-solid fa-eye"></i>
                </a>
              </div>

              {products.length > 0 && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700"></div>
                    <span className="text-[9px] font-black uppercase text-zinc-400 whitespace-nowrap">Produit spécifique</span>
                    <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700"></div>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {products.map(p => (
                      <div key={p.id} className="flex items-stretch gap-2">
                        <button onClick={() => handleShare("product", p)}
                          className="flex-1 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center gap-3 hover:border-primary/30 hover:bg-primary/3 transition-colors text-left">
                          <img src={p.img} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" alt="" />
                          <div className="flex-1 overflow-hidden">
                            <p className="text-[9px] font-black uppercase truncate text-zinc-900 dark:text-white">{p.name}</p>
                            <p className="text-[8px] text-primary font-black">{Number(p.price).toLocaleString()} FCFA</p>
                          </div>
                        </button>
                        <button onClick={() => copyToClipboard("product", p)}
                          className="px-3 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:text-primary transition-colors text-zinc-400 bg-zinc-50 dark:bg-zinc-800">
                          <i className="fa-solid fa-link text-xs"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button onClick={() => setShowShareModal(false)}
              className="mt-6 w-full py-3 border border-zinc-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-white/5 transition-all">
              Fermer
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-slideInRight { animation: slideInRight 0.4s cubic-bezier(0.2, 0, 0, 1) forwards; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #00ff88; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default Dashboard;