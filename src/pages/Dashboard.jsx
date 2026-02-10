import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, uploadProductImage, deleteProductImage } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { vendor, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('inventory');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    type: 'Audio Lab',
    status: 'In Stock',
    features: ''
  });

  // Charger les produits du vendeur
  useEffect(() => {
    if (vendor?.id) {
      fetchProducts();
      fetchOrders();
      
      const ordersSubscription = supabase
        .channel('orders-changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendor.id}` },
          (payload) => {
            console.log('Order change:', payload);
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        ordersSubscription.unsubscribe();
      };
    }
  }, [vendor]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_name,
            quantity,
            unit_price,
            selected_size,
            selected_color
          )
        `)
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log(" [IMAGE] Fichier sélectionné:", file.name, file.size, "octets");
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    console.log(">>> [ADD_PRODUCT 1] Début de la procédure d'ajout");
    console.log("Données du formulaire:", newProduct);
    console.log("Vendeur ID:", vendor?.id);

    try {
      let imageUrl = '';
      
      // 1. Upload de l'image
      if (imageFile) {
        console.log(">>> [ADD_PRODUCT 2] Tentative d'upload de l'image vers le storage...");
        try {
          imageUrl = await uploadProductImage(imageFile, vendor.id);
          console.log(">>> [ADD_PRODUCT 2.1] Upload réussi ! URL publique:", imageUrl);
        } catch (uploadErr) {
          console.error("xxx [ADD_PRODUCT 2.2] ÉCHEC de l'upload de l'image:", uploadErr);
          throw new Error("Le stockage de l'image a échoué. Vérifiez votre bucket 'product-images'.");
        }
      } else {
        console.warn(" [ADD_PRODUCT] Aucune image sélectionnée, utilisation d'un placeholder.");
        imageUrl = 'https://via.placeholder.com/600';
      }

      // 2. Traitement des features
      const features = newProduct.features
        ? newProduct.features.split(',').map(f => f.trim())
        : [];
      console.log(" [ADD_PRODUCT 3] Features formatées:", features);

      // 3. Insertion en base de données
      console.log(">>> [ADD_PRODUCT 4] Insertion dans la table 'products' via Supabase...");
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: newProduct.name,
          price: Number(newProduct.price),
          type: newProduct.type,
          status: newProduct.status,
          img: imageUrl,
          features: features,
          vendor_id: vendor.id
        })
        .select();

      if (error) {
        console.error("xxx [ADD_PRODUCT 4.1] ÉCHEC de l'insertion SQL:", error);
        console.error("Détails SQL:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log(">>> [ADD_PRODUCT 5] SUCCESS ! Produit ajouté avec succès:", data);

      // Reset form
      setNewProduct({ name: '', price: '', type: 'Audio Lab', status: 'In Stock', features: '' });
      setImageFile(null);
      setImagePreview('');
      setShowAddForm(false);
      
      await fetchProducts();
      console.log(" [ADD_PRODUCT 6] Liste des produits rafraîchie.");

    } catch (error) {
      console.error("!!! [ADD_PRODUCT ERROR] Le processus s'est arrêté:", error.message);
      alert('Erreur lors de l\'ajout du produit: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm('Confirmer la suppression de cet actif ?')) return;
    console.log(" [DELETE_PRODUCT] Tentative de suppression du produit:", product.id);

    try {
      if (product.img && product.img.includes('product-images')) {
        console.log(" [DELETE_PRODUCT] Suppression de l'image du storage...");
        await deleteProductImage(product.img);
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;
      console.log(" [DELETE_PRODUCT] Succès !");
      await fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const updateOrderStatus = async (orderId, currentStatus) => {
    const nextStatus = {
      'pending': 'validated',
      'validated': 'shipped',
      'shipped': 'delivered'
    };

    const newStatus = nextStatus[currentStatus];
    if (!newStatus) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Erreur lors de la mise à jour');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'text-orange-500 border-orange-500/30 bg-orange-500/5',
      'validated': 'text-blue-500 border-blue-500/30 bg-blue-500/5',
      'shipped': 'text-purple-500 border-purple-500/30 bg-purple-500/5',
      'delivered': 'text-primary border-primary/30 bg-primary/5'
    };
    return colors[status] || colors.pending;
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': 'En attente',
      'validated': 'Validé',
      'shipped': 'Expédié',
      'delivered': 'Livré'
    };
    return labels[status] || status;
  };

  const totalRevenue = products.reduce((acc, p) => acc + (Number(p.price) || 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="pt-28 pb-20 px-6 lg:px-12 max-w-[1600px] mx-auto min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-white transition-colors duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8 border-b border-zinc-100 dark:border-zinc-800 pb-10">
        <div>
          <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none">
            {vendor?.shop_name || 'Elite'} <span className="text-primary">Dashboard</span>
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
        </div>

        <div className="flex bg-zinc-100 dark:bg-zinc-900/80 p-1.5 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl overflow-x-auto">
          {['inventory', 'orders'].map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 whitespace-nowrap ${activeTab === tab ? 'bg-black text-white dark:bg-primary dark:text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-white/5'}`}
            >
              {tab === 'inventory' ? 'Inventaire' : 'Commandes'}
              {tab === 'orders' && pendingOrders > 0 && (
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

      <div className="grid lg:grid-cols-4 gap-8">
        
        {/* TELEMETRY */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-8 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[2rem] shadow-sm">
            <p className="text-zinc-400 text-[9px] font-black uppercase mb-4 italic">Valeur Inventaire</p>
            <p className="text-4xl font-black italic tracking-tighter text-primary">
              {totalRevenue.toLocaleString()} <span className="text-[10px] text-zinc-400 not-italic">FCFA</span>
            </p>
          </div>

          <div className="p-8 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[2rem]">
            <h4 className="text-[10px] font-black uppercase text-zinc-400 mb-6 tracking-widest">Statistiques</h4>
            <div className="space-y-4 text-zinc-500">
              <div className="flex justify-between items-center text-[11px] font-black italic">
                <span className="uppercase">Total Produits</span>
                <span className="text-primary">{products.length}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] font-black italic">
                <span className="uppercase">Commandes</span>
                <span className="text-primary">{orders.length}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] font-black italic">
                <span className="uppercase">En attente</span>
                <span className="text-orange-500">{pendingOrders}</span>
              </div>
            </div>
          </div>
        </div>

        {/* WORKSTATION */}
        <div className="lg:col-span-3 min-h-[600px]">
          
          {/* INVENTAIRE */}
          {activeTab === 'inventory' && (
            <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden animate-fadeIn">
              <div className="p-8 border-b border-zinc-200 dark:border-white/5 flex justify-between items-center bg-zinc-100/50 dark:bg-white/5">
                <h3 className="font-black uppercase text-xs tracking-widest">Gestion des Produits</h3>
                <button 
                  onClick={() => setShowAddForm(!showAddForm)} 
                  className="bg-black dark:bg-white text-white dark:text-black px-5 py-2 text-[9px] font-black uppercase hover:bg-primary transition-all rounded-lg"
                >
                  {showAddForm ? 'Fermer' : '+ Ajouter Produit'}
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={handleAddProduct} className="p-8 bg-zinc-100/30 dark:bg-white/5 border-b border-zinc-200 dark:border-white/5 space-y-6 animate-fadeIn">
                  <div className="grid md:grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      placeholder="Nom du Produit *" 
                      required 
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                      className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-[10px] font-bold outline-none focus:border-primary" 
                    />
                    <input 
                      type="number" 
                      placeholder="Prix (FCFA) *" 
                      required 
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                      className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-[10px] font-bold outline-none focus:border-primary" 
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <select 
                      value={newProduct.type}
                      onChange={(e) => setNewProduct({...newProduct, type: e.target.value})}
                      className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-[10px] font-bold outline-none focus:border-primary"
                    >
                      <option value="Audio Lab">Audio Lab</option>
                      <option value="Clothing">Vêtements</option>
                      <option value="Shoes">Chaussures</option>
                      <option value="Tech Lab">Tech Lab</option>
                    </select>

                    <select 
                      value={newProduct.status}
                      onChange={(e) => setNewProduct({...newProduct, status: e.target.value})}
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
                    onChange={(e) => setNewProduct({...newProduct, features: e.target.value})}
                    className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-[10px] font-bold outline-none focus:border-primary" 
                  />

                  {/* UPLOAD IMAGE */}
                  <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-6 text-center relative overflow-hidden">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    {imagePreview ? (
                      <div className="relative">
                        <img src={imagePreview} className="w-full h-40 object-cover rounded-lg" alt="Preview" />
                        <button
                          type="button"
                          onClick={() => { setImageFile(null); setImagePreview(''); }}
                          className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div>
                        <i className="fa-solid fa-cloud-arrow-up text-4xl text-zinc-400 mb-2"></i>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">Cliquez pour uploader une image</p>
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-primary text-black font-black uppercase text-[10px] py-4 rounded-xl hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    {loading ? 'Ajout en cours...' : 'Confirmer l\'Ajout'}
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
                      <tr key={p.id} className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors group">
                        <td className="p-8 flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10">
                            <img src={p.img} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="" />
                          </div>
                          <span className="uppercase tracking-tight">{p.name}</span>
                        </td>
                        <td className="text-zinc-400 dark:text-zinc-500 uppercase italic font-black">{p.type}</td>
                        <td className="italic text-primary">{Number(p.price).toLocaleString()} FCFA</td>
                        <td className="p-8 text-right space-x-4">
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

          {/* COMMANDES */}
          {activeTab === 'orders' && (
            <div className="space-y-4 animate-fadeIn">
              {orders.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-zinc-400 italic">Aucune commande pour le moment</p>
                </div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="p-8 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/5 rounded-[2rem] space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex items-center space-x-6">
                        <div className={`p-4 rounded-2xl border ${getStatusColor(order.status)}`}>
                          <p className="text-[10px] font-black uppercase mb-1">Commande</p>
                          <p className="text-lg font-black italic tracking-tighter text-zinc-900 dark:text-white">
                            #{order.order_number}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase tracking-tight mb-1 text-zinc-900 dark:text-white">
                            {order.client_name}
                          </p>
                          <p className="text-[9px] font-bold uppercase italic tracking-widest text-zinc-500">
                            {order.client_phone} // {order.payment_method.replace('_', ' ')}
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
                          <p className={`text-[9px] font-black uppercase mb-1 ${order.status === 'pending' ? 'text-orange-500' : 'text-primary'}`}>
                            {getStatusLabel(order.status)}
                          </p>
                          <p className="text-xl font-black italic text-zinc-900 dark:text-white">
                            {Number(order.total_amount).toLocaleString()} FCFA
                          </p>
                        </div>
                        
                        {order.status !== 'delivered' && (
                          <button 
                            onClick={() => updateOrderStatus(order.id, order.status)} 
                            className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-black dark:bg-primary text-white dark:text-black hover:scale-105"
                          >
                            {order.status === 'pending' && 'Valider'}
                            {order.status === 'validated' && 'Expédier'}
                            {order.status === 'shipped' && 'Livré'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Détails de la commande */}
                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                      <p className="text-[9px] font-black uppercase text-zinc-400 mb-3">Articles commandés :</p>
                      <div className="space-y-2">
                        {order.order_items?.map((item) => (
                          <div key={item.id} className="flex justify-between items-center text-[10px] font-bold">
                            <span>{item.product_name} x{item.quantity} ({item.selected_size} / {item.selected_color})</span>
                            <span className="text-primary">{(Number(item.unit_price) * item.quantity).toLocaleString()} FCFA</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-900">
                        <p className="text-[9px] font-black uppercase text-zinc-400">Adresse de livraison :</p>
                        <p className="text-[10px] font-bold mt-1">{order.client_address}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;