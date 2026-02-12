import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import {
  supabase,
  uploadProductImage,
  deleteProductImage,
} from "../lib/supabase";
import {
  requestNotificationPermission,
  setupForegroundNotifications,
} from "../lib/firebase";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { vendor, signOut } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("inventory");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // 🔔 Notifications
  const [notifStatus, setNotifStatus] = useState("idle");
  const [notifToken, setNotifToken] = useState(null);
  const [liveToast, setLiveToast] = useState(null);
  const fcmUnsubscribeRef = useRef(null);
  const realtimeChannelRef = useRef(null);

  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    type: "Audio Lab",
    status: "In Stock",
    features: "",
  });

  useEffect(() => {
    if (vendor?.id) {
      fetchProducts();
      fetchOrders();
      registerFCMToken();
      listenRealtimeOrders(); // ✅ Écoute Database Changes uniquement
    }
    return () => {
      // Cleanup Realtime channel
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      // Cleanup FCM foreground listener
      if (fcmUnsubscribeRef.current) {
        fcmUnsubscribeRef.current();
      }
    };
  }, [vendor]);

  // ✅ Enregistrement FCM
  const registerFCMToken = async () => {
    if (!("Notification" in window)) {
      setNotifStatus("error");
      return;
    }
    setNotifStatus("requesting");
    try {
      const token = await requestNotificationPermission(vendor.id);
      if (token) {
        setNotifToken(token);
        setNotifStatus("granted");
        // ✅ Listener continu pour messages foreground
        const unsubscribe = setupForegroundNotifications((payload) => {
          showLiveToast({
            title: payload.notification?.title || "Nouvelle commande",
            body: payload.notification?.body || "",
          });
        });
        fcmUnsubscribeRef.current = unsubscribe;
      } else {
        setNotifStatus("denied");
      }
    } catch (err) {
      setNotifStatus("error");
    }
  };

  // ✅ FIX : Écouter SEULEMENT les Database Changes PostgreSQL (pas de broadcast)
  const listenRealtimeOrders = () => {
    console.log(
      "[REALTIME] Configuration de l'écoute Database Changes pour vendor:",
      vendor.id
    );

    const channel = supabase
      .channel("orders-realtime-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `vendor_id=eq.${vendor.id}`,
        },
        (payload) => {
          console.log("[REALTIME] ✅ Nouvelle commande détectée:", payload.new);

          // Afficher toast dans le dashboard
          showLiveToast({
            title: `🛒 Commande #${payload.new.order_number}`,
            body: `${
              payload.new.client_name
            } — ${payload.new.total_amount?.toLocaleString()} FCFA`,
          });

          // Notification système (même si onglet actif, pour référence)
          if (Notification.permission === "granted") {
            navigator.serviceWorker.getRegistration("/").then((reg) => {
              if (reg) {
                reg.showNotification(
                  `🛒 Nouvelle Commande #${payload.new.order_number}`,
                  {
                    body: `${
                      payload.new.client_name
                    } — ${payload.new.total_amount?.toLocaleString()} FCFA`,
                    icon: "/ofs.png",
                    badge: "/ofs.png",
                    tag: `order-${payload.new.order_number}`,
                    requireInteraction: true,
                    vibrate: [200, 100, 200],
                    data: { url: "/admin" },
                  }
                );
              }
            });
          }

          // Rafraîchir la liste
          fetchOrders();
        }
      )
      .subscribe((status) => {
        console.log("[REALTIME] Statut subscription:", status);
      });

    realtimeChannelRef.current = channel;
  };

  // Afficher un toast de notification live
  const showLiveToast = (notif) => {
    setLiveToast(notif);
    setTimeout(() => setLiveToast(null), 6000);
  };

  // ✅ Test notification (fonctionne à chaque clic)
  const sendTestNotification = async () => {
    if (Notification.permission !== "granted") {
      alert("Notifications non autorisées.");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (reg) {
      reg.showNotification("🛒 Test Elite Notification", {
        body: `${vendor.shop_name} — Système de notifications opérationnel !`,
        icon: "/ofs.png",
        tag: `test-${Date.now()}`, // ✅ tag unique = pas de déduplication
        requireInteraction: false,
        vibrate: [200, 100, 200],
      });
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `*, order_items(id, product_name, quantity, unit_price, selected_size, selected_color)`
        )
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let imageUrl = imageFile
        ? await uploadProductImage(imageFile, vendor.id)
        : "https://via.placeholder.com/600";
      const features = newProduct.features
        ? newProduct.features.split(",").map((f) => f.trim())
        : [];
      const { error } = await supabase.from("products").insert({
        name: newProduct.name,
        price: Number(newProduct.price),
        type: newProduct.type,
        status: newProduct.status,
        img: imageUrl,
        features,
        vendor_id: vendor.id,
      });
      if (error) throw error;
      setNewProduct({
        name: "",
        price: "",
        type: "Audio Lab",
        status: "In Stock",
        features: "",
      });
      setImageFile(null);
      setImagePreview("");
      setShowAddForm(false);
      await fetchProducts();
    } catch (error) {
      alert("Erreur ajout produit: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm("Confirmer la suppression ?")) return;
    try {
      if (product.img?.includes("product-images"))
        await deleteProductImage(product.img);
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);
      if (error) throw error;
      await fetchProducts();
    } catch (error) {
      alert("Erreur suppression");
    }
  };

  const updateOrderStatus = async (orderId, currentStatus) => {
    const next = {
      pending: "validated",
      validated: "shipped",
      shipped: "delivered",
    };
    const newStatus = next[currentStatus];
    if (!newStatus) return;
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);
      if (error) throw error;
      await fetchOrders();
    } catch (error) {
      alert("Erreur mise à jour");
    }
  };

  const getStatusColor = (s) =>
    ({
      pending: "text-orange-500 border-orange-500/30 bg-orange-500/5",
      validated: "text-blue-500 border-blue-500/30 bg-blue-500/5",
      shipped: "text-purple-500 border-purple-500/30 bg-purple-500/5",
      delivered: "text-primary border-primary/30 bg-primary/5",
    }[s] || "text-orange-500 border-orange-500/30 bg-orange-500/5");

  const getStatusLabel = (s) =>
    ({
      pending: "En attente",
      validated: "Validé",
      shipped: "Expédié",
      delivered: "Livré",
    }[s] || s);

  const totalRevenue = products.reduce(
    (acc, p) => acc + (Number(p.price) || 0),
    0
  );
  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (e) {
      console.error(e);
    }
  };

  const notifBadgeConfig = {
    idle: {
      color: "text-zinc-400",
      icon: "fa-bell-slash",
      label: "Notifications désactivées",
    },
    requesting: {
      color: "text-yellow-500 animate-pulse",
      icon: "fa-bell",
      label: "Activation en cours...",
    },
    granted: {
      color: "text-primary",
      icon: "fa-bell",
      label: "Notifications actives",
    },
    denied: {
      color: "text-red-400",
      icon: "fa-bell-slash",
      label: "Permission refusée",
    },
    error: {
      color: "text-orange-400",
      icon: "fa-bell-slash",
      label: "Non supporté",
    },
  }[notifStatus];

  // A insérer dans Dashboard.jsx (Fonction de partage)
  const shareStore = () => {
    const url = `${window.location.origin}/shop/${vendor.shop_name}`;
    if (navigator.share) {
      navigator.share({
        title: vendor.shop_name,
        text: `Découvrez ma boutique sur OneFreestyle Elite !`,
        url: url,
      });
    } else {
      navigator.clipboard.writeText(url);
      alert("Lien de la boutique copié !");
    }
  };


  // src/pages/Dashboard.jsx

// ... autres imports
const [showShareModal, setShowShareModal] = useState(false);
const [selectedProductForShare, setSelectedProductForShare] = useState(null);

// Fonction de partage améliorée
const handleShare = async (type, data = null) => {
  const baseUrl = window.location.origin;
  const shareData = {
    title: vendor.shop_name,
    text: `Découvrez ${type === 'shop' ? 'ma boutique' : data.name} sur OneFreestyle Elite !`,
    url: type === 'shop' 
      ? `${baseUrl}/shop/${vendor.shop_name}`
      : `${baseUrl}/shop/${vendor.shop_name}?product=${data.id}` 
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(shareData.url);
      alert("Lien copié dans le presse-papier !");
    }
  } catch (err) {
    console.error("Erreur de partage:", err);
  }
  setShowShareModal(false);
};

const copyToClipboard = (type, data = null) => {
  const baseUrl = window.location.origin;
  const url = type === 'shop' 
    ? `${baseUrl}/shop/${vendor.shop_name}`
    : `${baseUrl}/shop/${vendor.shop_name}?product=${data.id}`;
  
  navigator.clipboard.writeText(url);

  // Utilisation du système de toast existant au lieu de l'alert
  showLiveToast({
    title: "Lien Copié",
    body: type === 'shop' 
      ? "Le lien de votre boutique est prêt à être partagé." 
      : `Le lien pour "${data.name}" est copié.`
  });
};
  return (
    <div className="pt-28 pb-20 px-6 lg:px-12 max-w-[1600px] mx-auto min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-white">
      {/* ✅ Toast Live Nouvelle Commande */}
      {liveToast && (
        <div className="fixed top-6 right-6 z-[400] animate-slideInRight max-w-sm">
          <div className="bg-black border-2 border-primary rounded-2xl p-5 shadow-[0_0_40px_rgba(0,255,136,0.3)] backdrop-blur-xl">
            <div className="flex items-start space-x-4">
              <div className="bg-primary rounded-full p-2 shrink-0">
                <i className="fa-solid fa-bag-shopping text-black text-sm"></i>
              </div>
              <div className="flex-grow">
                <p className="text-white font-black text-xs uppercase mb-1">
                  {liveToast.title}
                </p>
                <p className="text-zinc-300 text-[10px] font-bold">
                  {liveToast.body}
                </p>
              </div>
              <button
                onClick={() => setLiveToast(null)}
                className="text-zinc-500 hover:text-white transition"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8 border-b border-zinc-100 dark:border-zinc-800 pb-10">
        <div>
          <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none">
            {vendor?.shop_name || "Elite"}{" "}
            <span className="text-primary">Dashboard</span>
          </h1>
          <div className="flex items-center space-x-3 mt-3">
            <div className="flex space-x-1">
              <span className="h-1 w-4 bg-primary rounded-full animate-pulse"></span>
              <span className="h-1 w-2 bg-zinc-300 dark:bg-zinc-700 rounded-full"></span>
            </div>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
              {vendor?.full_name} // {vendor?.email}
            </p>
          </div>
          {/* Badge statut notif */}
          <div
            className={`flex items-center space-x-2 mt-2 text-[9px] font-black uppercase ${notifBadgeConfig?.color}`}
          >
            <i className={`fa-solid ${notifBadgeConfig?.icon}`}></i>
            <span>{notifBadgeConfig?.label}</span>
            {notifStatus === "denied" && (
              <button
                onClick={registerFCMToken}
                className="text-primary underline ml-2"
              >
                Réessayer
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          {/* {notifStatus === 'granted' && (
            <button
              onClick={sendTestNotification}
              className="px-5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-primary hover:text-primary transition-all"
            >
              <i className="fa-solid fa-paper-plane mr-2"></i>
              Tester Notification
            </button>
          )} */}
          {/* Dans le Header, remplacez le bouton shareStore par celui-ci */}
<button
  onClick={() => setShowShareModal(true)}
  className="px-5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl bg-primary text-black hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)]"
>
  <i className="fa-solid fa-share-nodes mr-2"></i>
  Partager mon Arsenal
</button>
          <div className="flex bg-zinc-100 dark:bg-zinc-900/80 p-1.5 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl overflow-x-auto">
            {["inventory", "orders"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 whitespace-nowrap ${
                  activeTab === tab
                    ? "bg-black text-white dark:bg-primary dark:text-black shadow-lg"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-white/5"
                }`}
              >
                {tab === "inventory" ? "Inventaire" : "Commandes"}
                {tab === "orders" && pendingOrders > 0 && (
                  <span className="ml-2 bg-orange-500 text-white text-[8px] px-2 py-0.5 rounded-full">
                    {pendingOrders}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={handleLogout}
              className="px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
            >
              <i className="fa-solid fa-power-off text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* TELEMETRY */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-8 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[2rem]">
            <p className="text-zinc-400 text-[9px] font-black uppercase mb-4 italic">
              Valeur Inventaire
            </p>
            <p className="text-4xl font-black italic tracking-tighter text-primary">
              {totalRevenue.toLocaleString()}{" "}
              <span className="text-[10px] text-zinc-400 not-italic">FCFA</span>
            </p>
          </div>
          <div className="p-8 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[2rem]">
            <h4 className="text-[10px] font-black uppercase text-zinc-400 mb-6 tracking-widest">
              Statistiques
            </h4>
            <div className="space-y-4 text-zinc-500">
              <div className="flex justify-between text-[11px] font-black italic">
                <span className="uppercase">Total Produits</span>
                <span className="text-primary">{products.length}</span>
              </div>
              <div className="flex justify-between text-[11px] font-black italic">
                <span className="uppercase">Commandes</span>
                <span className="text-primary">{orders.length}</span>
              </div>
              <div className="flex justify-between text-[11px] font-black italic">
                <span className="uppercase">En attente</span>
                <span className="text-orange-500">{pendingOrders}</span>
              </div>
            </div>
          </div>
          {notifToken && (
            <div className="p-6 bg-primary/5 border border-primary/20 rounded-[1.5rem]">
              <p className="text-[9px] font-black uppercase text-primary mb-2">
                FCM Token Actif
              </p>
              <p className="text-[8px] font-mono text-zinc-500 break-all leading-relaxed">
                {notifToken.substring(0, 40)}...
              </p>
              <div className="mt-3 flex items-center space-x-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-[8px] font-black uppercase text-primary">
                  Realtime DB Changes Actif
                </span>
              </div>
            </div>
          )}
        </div>

        {/* WORKSTATION */}
        <div className="lg:col-span-3 min-h-[600px]">
          {activeTab === "inventory" && (
            <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden">
              <div className="p-8 border-b border-zinc-200 dark:border-white/5 flex justify-between items-center bg-zinc-100/50 dark:bg-white/5">
                <h3 className="font-black uppercase text-xs tracking-widest">
                  Gestion des Produits
                </h3>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-black dark:bg-white text-white dark:text-black px-5 py-2 text-[9px] font-black uppercase hover:bg-primary transition-all rounded-lg"
                >
                  {showAddForm ? "Fermer" : "+ Ajouter Produit"}
                </button>
              </div>

              {showAddForm && (
                <form
                  onSubmit={handleAddProduct}
                  className="p-8 bg-zinc-100/30 dark:bg-white/5 border-b border-zinc-200 dark:border-white/5 space-y-6"
                >
                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Nom du Produit *"
                      required
                      value={newProduct.name}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, name: e.target.value })
                      }
                      className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-[10px] font-bold outline-none focus:border-primary"
                    />
                    <input
                      type="number"
                      placeholder="Prix (FCFA) *"
                      required
                      value={newProduct.price}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, price: e.target.value })
                      }
                      className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-[10px] font-bold outline-none focus:border-primary"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <select
                      value={newProduct.type}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, type: e.target.value })
                      }
                      className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-[10px] font-bold outline-none focus:border-primary"
                    >
                      <option value="Audio Lab">Audio Lab</option>
                      <option value="Clothing">Vêtements</option>
                      <option value="Shoes">Chaussures</option>
                      <option value="Fragrance">Parfums & Senteurs</option>{" "}
                      {/* NOUVEAU */}
                      <option value="Accessories">
                        Accessoires Elite
                      </option>{" "}
                      {/* NOUVEAU */}
                      <option value="Tech Lab">Tech Lab</option>
                    </select>
                    <select
                      value={newProduct.status}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, status: e.target.value })
                      }
                      className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-[10px] font-bold outline-none focus:border-primary"
                    >
                      <option value="In Stock">In Stock</option>
                      <option value="Elite Choice">Elite Choice</option>
                      <option value="New Drop">New Drop</option>
                      <option value="Limited">Limited</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Features (séparées par des virgules)"
                    value={newProduct.features}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, features: e.target.value })
                    }
                    className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-[10px] font-bold outline-none focus:border-primary"
                  />
                  <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-6 text-center relative overflow-hidden">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          className="w-full h-40 object-cover rounded-lg"
                          alt="Preview"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview("");
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div>
                        <i className="fa-solid fa-cloud-arrow-up text-4xl text-zinc-400 mb-2"></i>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">
                          Cliquez pour uploader une image
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-black font-black uppercase text-[10px] py-4 rounded-xl hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    {loading ? "Ajout en cours..." : "Confirmer l'Ajout"}
                  </button>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-zinc-100 dark:bg-black/50 text-[9px] font-black uppercase text-zinc-500 tracking-widest border-b border-zinc-200 dark:border-white/5">
                    <tr>
                      <th className="p-8">Produit</th>
                      <th>Catégorie</th>
                      <th>Prix</th>
                      <th className="text-right p-8">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] font-bold">
                    {products.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors group"
                      >
                        <td className="p-8 flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10">
                            <img
                              src={p.img}
                              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
                              alt=""
                            />
                          </div>
                          <span className="uppercase tracking-tight">
                            {p.name}
                          </span>
                        </td>
                        <td className="text-zinc-400 dark:text-zinc-500 uppercase italic font-black">
                          {p.type}
                        </td>
                        <td className="italic text-primary">
                          {Number(p.price).toLocaleString()} FCFA
                        </td>
                        <td className="p-8 text-right">
                          <button
                            onClick={() => deleteProduct(p)}
                            className="text-red-500/50 hover:text-red-500 uppercase text-[9px] font-black transition"
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "orders" && (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-zinc-400 italic">
                    Aucune commande pour le moment
                  </p>
                </div>
              ) : (
                orders.map((order) => (
                  <div
                    key={order.id}
                    className="p-8 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/5 rounded-[2rem] space-y-6"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex items-center space-x-6">
                        <div
                          className={`p-4 rounded-2xl border ${getStatusColor(
                            order.status
                          )}`}
                        >
                          <p className="text-[10px] font-black uppercase mb-1">
                            Commande
                          </p>
                          <p className="text-lg font-black italic tracking-tighter text-zinc-900 dark:text-white">
                            #{order.order_number}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase tracking-tight mb-1 text-zinc-900 dark:text-white">
                            {order.client_name}
                          </p>
                          <p className="text-[9px] font-bold uppercase italic tracking-widest text-zinc-500">
                            {order.client_phone} //{" "}
                            {order.payment_method?.replace("_", " ")}
                          </p>
                          {order.payment_reference && (
                            <p className="text-[9px] font-bold text-primary mt-1">
                              Ref: {order.payment_reference}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-8">
                        <div className="text-right">
                          <p
                            className={`text-[9px] font-black uppercase mb-1 ${
                              order.status === "pending"
                                ? "text-orange-500"
                                : "text-primary"
                            }`}
                          >
                            {getStatusLabel(order.status)}
                          </p>
                          <p className="text-xl font-black italic text-zinc-900 dark:text-white">
                            {Number(order.total_amount).toLocaleString()} FCFA
                          </p>
                        </div>
                        {order.status !== "delivered" && (
                          <button
                            onClick={() =>
                              updateOrderStatus(order.id, order.status)
                            }
                            className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-black dark:bg-primary text-white dark:text-black hover:scale-105"
                          >
                            {order.status === "pending" && "Valider"}
                            {order.status === "validated" && "Expédier"}
                            {order.status === "shipped" && "Livré"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                      <p className="text-[9px] font-black uppercase text-zinc-400 mb-3">
                        Articles commandés :
                      </p>
                      <div className="space-y-2">
                        {order.order_items?.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between items-center text-[10px] font-bold"
                          >
                            <span>
                              {item.product_name} x{item.quantity} (
                              {item.selected_size} / {item.selected_color})
                            </span>
                            <span className="text-primary">
                              {(
                                Number(item.unit_price) * item.quantity
                              ).toLocaleString()}{" "}
                              FCFA
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-900">
                        <p className="text-[9px] font-black uppercase text-zinc-400">
                          Adresse :
                        </p>
                        <p className="text-[10px] font-bold mt-1">
                          {order.client_address}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
  {/* ✅ MODAL DE PARTAGE ÉLITE AMÉLIORÉ */}
{showShareModal && (
  <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowShareModal(false)}></div>
    <div className="relative bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl animate-modalUp">
      <h3 className="text-2xl font-black italic uppercase mb-6 text-center text-zinc-900 dark:text-white">Partager l'Univers</h3>
      
      <div className="space-y-4">
        {/* SECTION BOUTIQUE */}
        {/* SECTION BOUTIQUE DANS LE MODAL DE PARTAGE */}
<div className="flex items-stretch space-x-2">
  <button 
    onClick={() => handleShare('shop')}
    className="flex-grow p-5 bg-primary text-black rounded-2xl flex items-center justify-between group hover:scale-[1.02] transition-all"
  >
    <div className="text-left">
      <p className="font-black uppercase text-[10px] tracking-widest">Partager Boutique</p>
      <p className="text-[9px] font-bold opacity-60 italic">Via Apps (WhatsApp...)</p>
    </div>
    <i className="fa-solid fa-share-nodes"></i>
  </button>
  
  {/* Bouton Copier avec Toast */}
  <button 
    onClick={() => copyToClipboard('shop')}
    className="px-4 bg-zinc-200 dark:bg-white/5 rounded-2xl hover:text-primary transition-colors text-zinc-500"
    title="Copier le lien"
  >
    <i className="fa-solid fa-copy"></i>
  </button>

  {/* ✅ Bouton VOIR LA BOUTIQUE */}
  <a 
    href={`/shop/${vendor?.shop_name}`}
    target="_blank"
    rel="noopener noreferrer"
    className="px-4 bg-zinc-200 dark:bg-white/5 rounded-2xl flex items-center justify-center hover:text-primary transition-colors text-zinc-500"
    title="Voir ma boutique"
  >
    <i className="fa-solid fa-eye"></i>
  </a>
</div>
        <div className="py-2 flex items-center">
          <div className="flex-grow h-[1px] bg-zinc-200 dark:bg-zinc-800"></div>
          <span className="px-4 text-[9px] font-black uppercase text-zinc-400">Ou un produit spécifique</span>
          <div className="flex-grow h-[1px] bg-zinc-200 dark:bg-zinc-800"></div>
        </div>

        {/* LISTE PRODUITS AVEC COPIE DIRECTE */}
        <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {products.map(p => (
            <div key={p.id} className="flex items-stretch space-x-2">
              <button 
                onClick={() => handleShare('product', p)}
                className="flex-grow p-3 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center space-x-3 hover:border-primary transition-colors text-left"
              >
                <img src={p.img} className="w-10 h-10 object-cover rounded-lg" alt="" />
                <div className="flex-grow overflow-hidden">
                  <p className="text-[9px] font-black uppercase truncate text-zinc-900 dark:text-white">{p.name}</p>
                  <p className="text-[8px] text-primary">{p.price.toLocaleString()} FCFA</p>
                </div>
              </button>
              
              <button 
                onClick={() => copyToClipboard('product', p)}
                className="px-4 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:text-primary transition-colors text-zinc-400"
              >
                <i className="fa-solid fa-link text-xs"></i>
              </button>
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={() => setShowShareModal(false)}
        className="mt-8 w-full py-4 border border-zinc-200 dark:border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 hover:text-white hover:bg-white/5 transition"
      >
        Fermer
      </button>
    </div>
  </div>
)}
    </div>
  );
};

export default Dashboard;
