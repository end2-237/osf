import React, { useState, useMemo } from 'react';
import { products as initialProducts } from '../data/products';

const Dashboard = () => {
  // --- ÉTATS DE GESTION ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginData, setLoginData] = useState({ user: '', pass: '' });
  const [activeTab, setActiveTab] = useState('inventory');
  const [inventory, setInventory] = useState(initialProducts);
  const [showAddForm, setShowAddForm] = useState(false); // État pour le formulaire d'ajout
  const [newProduct, setNewProduct] = useState({ name: '', price: '', type: 'Audio Lab', img: '' });

  const [orders, setOrders] = useState([
    { id: 1021, client: "Nsoga David", location: "Douala, Akwa", status: "En attente", amount: 185000, method: "Orange Money", date: "07/02/2026" },
    { id: 1022, client: "Membre Elite", location: "Yaoundé, Bastos", status: "Expédié", amount: 45000, method: "Cash", date: "06/02/2026" },
  ]);

  const [customRequests, setCustomRequests] = useState([
    { id: "L-901", asset: "AirPods Pro 2", user: "Nsoga David", material: "Fibre de Carbone", finish: "Coupe Diamant", status: "Analyse" },
    { id: "L-902", asset: "Veste Tech", user: "Utilisateur Elite", material: "Soie-Tech", finish: "3D Puff", status: "Rendu" }
  ]);

  // --- LOGIQUE D'AUTHENTIFICATION ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.user === 'admin' && loginData.pass === 'elite2026') {
      setIsAuthenticated(true);
    } else {
      alert("Accès refusé : Identifiants non reconnus par Echelon OS.");
    }
  };

  // --- LOGIQUE OPÉRATIONNELLE ---
  const deleteProduct = (id) => {
    if(window.confirm("Confirmer la suppression de cet actif ?")) {
      setInventory(inventory.filter(p => p.id !== id));
    }
  };

  const handleAddProduct = (e) => {
    e.preventDefault();
    const id = inventory.length + 1;
    setInventory([{ ...newProduct, id: id, price: Number(newProduct.price), features: ["Qualité Elite"] }, ...inventory]);
    setShowAddForm(false);
    setNewProduct({ name: '', price: '', type: 'Audio Lab', img: '' });
  };

  const updateOrderStatus = (id) => {
    setOrders(orders.map(order => 
      order.id === id 
        ? { ...order, status: order.status === "En attente" ? "Expédié" : "Livré" } 
        : order
    ));
  };

  const totalRevenue = useMemo(() => 
    inventory.reduce((acc, p) => acc + p.price, 0), [inventory]
  );

  // --- RENDU 1 : CONNEXION ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-6 transition-colors duration-500">
        <div className="w-full max-w-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-10 rounded-[3rem] shadow-2xl">
          <div className="text-center mb-10">
            <h2 className="logo-font text-3xl font-black italic tracking-tighter uppercase dark:text-white">
              Echelon <span className="text-primary">OS.</span>
            </h2>
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-2">Accès Restreint // Protocole Sécurisé</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Identifiant Admin</label>
              <input type="text" required className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs font-bold focus:border-primary outline-none dark:text-white transition-all" placeholder="NOM D'UTILISATEUR" onChange={(e) => setLoginData({...loginData, user: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Code d'accès</label>
              <input type="password" required className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs font-bold focus:border-primary outline-none dark:text-white transition-all" placeholder="••••••••" onChange={(e) => setLoginData({...loginData, pass: e.target.value})} />
            </div>
            <button className="w-full bg-black dark:bg-primary dark:text-black text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl">
              Initialiser Connexion
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-28 pb-20 px-6 lg:px-12 max-w-[1600px] mx-auto min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-white transition-colors duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8 border-b border-zinc-100 dark:border-zinc-800 pb-10">
        <div>
          <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none">
            Echelon <span className="text-primary">OS.</span>
          </h1>
          <div className="flex items-center space-x-3 mt-3">
            <div className="flex space-x-1"><span className="h-1 w-4 bg-primary rounded-full"></span><span className="h-1 w-2 bg-zinc-300 dark:bg-zinc-700 rounded-full"></span></div>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Tableau de Bord Opérationnel // Accès Racine</p>
          </div>
        </div>

        <div className="flex bg-zinc-100 dark:bg-zinc-900/80 p-1.5 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl overflow-x-auto">
          {['inventory', 'orders', 'labs', 'analytics'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 whitespace-nowrap ${activeTab === tab ? 'bg-black text-white dark:bg-primary dark:text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-white/5'}`}>
              {tab === 'inventory' ? 'Inventaire' : tab === 'orders' ? 'Commandes' : tab === 'labs' ? 'Laboratoire' : 'Analyses'}
            </button>
          ))}
          <button onClick={() => setIsAuthenticated(false)} className="px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"><i className="fa-solid fa-power-off text-xs"></i></button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        
        {/* TELEMETRY */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-8 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[2rem] shadow-sm">
            <p className="text-zinc-400 text-[9px] font-black uppercase mb-4 italic text-zinc-500">Chiffre d'Affaires Session</p>
            <p className="text-4xl font-black italic tracking-tighter text-primary">
              {totalRevenue.toLocaleString()} <span className="text-[10px] text-zinc-400 not-italic">FCFA</span>
            </p>
          </div>

          <div className="p-8 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-[2.5rem]">
            <h4 className="text-[10px] font-black uppercase text-zinc-400 mb-6 tracking-widest text-zinc-500">Opérations Actives</h4>
            <div className="space-y-4 text-zinc-500">
              <div className="flex justify-between items-center text-[11px] font-black italic">
                <span className="uppercase">En attente d'envoi</span>
                <span className="text-primary">{orders.filter(o => o.status === "En attente").length}</span>
              </div>
              <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="w-[40%] h-full bg-primary shadow-[0_0_10px_#00ff88]"></div></div>
            </div>
          </div>
        </div>

        {/* WORKSTATION */}
        <div className="lg:col-span-3 min-h-[600px]">
          
          {/* INVENTAIRE */}
          {activeTab === 'inventory' && (
            <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden animate-fadeIn">
              <div className="p-8 border-b border-zinc-200 dark:border-white/5 flex justify-between items-center bg-zinc-100/50 dark:bg-white/5">
                <h3 className="font-black uppercase text-xs tracking-widest">Gestion des Actifs</h3>
                <button onClick={() => setShowAddForm(!showAddForm)} className="bg-black dark:bg-white text-white dark:text-black px-5 py-2 text-[9px] font-black uppercase hover:bg-primary transition-all rounded-lg">
                  {showAddForm ? 'Fermer' : '+ Déployer Actif'}
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={handleAddProduct} className="p-8 bg-zinc-100/30 dark:bg-white/5 border-b border-zinc-200 dark:border-white/5 grid grid-cols-1 md:grid-cols-4 gap-4 animate-fadeIn">
                  <input type="text" placeholder="Nom du Produit" required className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-[10px] font-bold outline-none focus:border-primary" onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} />
                  <input type="number" placeholder="Prix (FCFA)" required className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-[10px] font-bold outline-none focus:border-primary" onChange={(e) => setNewProduct({...newProduct, price: e.target.value})} />
                  <select className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-[10px] font-bold outline-none focus:border-primary" onChange={(e) => setNewProduct({...newProduct, type: e.target.value})}>
                    <option value="Audio Lab">Audio Lab</option>
                    <option value="Clothing">Vêtements</option>
                    <option value="Shoes">Chaussures</option>
                    <option value="Tech Lab">Tech Lab</option>
                  </select>
                  <button type="submit" className="bg-primary text-black font-black uppercase text-[10px] py-3 rounded-xl hover:scale-105 transition-transform">Confirmer l'Ajout</button>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-zinc-100 dark:bg-black/50 text-[9px] font-black uppercase text-zinc-500 tracking-widest border-b border-zinc-200 dark:border-white/5">
                    <tr><th className="p-8">Nom du Produit</th><th>Catégorie</th><th>Prix</th><th className="text-right p-8">Outils</th></tr>
                  </thead>
                  <tbody className="text-[11px] font-bold">
                    {inventory.map((p) => (
                      <tr key={p.id} className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors group">
                        <td className="p-8 flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10"><img src={p.img || 'https://via.placeholder.com/150'} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="" /></div>
                          <span className="uppercase tracking-tight">{p.name}</span>
                        </td>
                        <td className="text-zinc-400 dark:text-zinc-500 uppercase italic font-black">{p.type}</td>
                        <td className="italic text-primary">{p.price.toLocaleString()} FCFA</td>
                        <td className="p-8 text-right space-x-4">
                          <button className="text-zinc-400 dark:text-zinc-500 hover:text-black dark:hover:text-white uppercase text-[9px] font-black transition">Éditer</button>
                          <button onClick={() => deleteProduct(p.id)} className="text-red-500/50 hover:text-red-500 uppercase text-[9px] font-black transition">Purger</button>
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
              {orders.map((order) => (
                <div key={order.id} className="p-8 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/5 rounded-[2rem] flex flex-col md:flex-row justify-between items-center group hover:bg-zinc-100 dark:hover:bg-zinc-900/50 shadow-sm transition-all">
                  <div className="flex items-center space-x-8 text-zinc-500">
                    <div className={`p-4 rounded-2xl border ${order.status === 'En attente' ? 'border-orange-500/30 bg-orange-500/5' : 'border-primary/30 bg-primary/5'}`}>
                      <p className="text-[10px] font-black uppercase mb-1">ID</p>
                      <p className="text-lg font-black italic tracking-tighter text-zinc-900 dark:text-white">#{order.id}</p>
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight mb-1 text-zinc-900 dark:text-white">{order.client}</p>
                      <p className="text-[9px] font-bold uppercase italic tracking-widest">{order.location} // {order.method}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-12 mt-6 md:mt-0 text-right">
                    <div>
                      <p className={`text-[9px] font-black uppercase mb-1 ${order.status === 'En attente' ? 'text-orange-500' : 'text-primary'}`}>{order.status}</p>
                      <p className="text-xl font-black italic text-zinc-900 dark:text-white">{order.amount.toLocaleString()} FCFA</p>
                    </div>
                    <button onClick={() => updateOrderStatus(order.id)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${order.status === 'En attente' ? 'bg-black dark:bg-white text-white dark:text-black hover:bg-primary' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'}`}>
                      {order.status === 'En attente' ? 'Marquer Expédié' : 'Archivé'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LABORATOIRE */}
          {activeTab === 'labs' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
              {customRequests.map((req) => (
                <div key={req.id} className="p-8 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/5 rounded-[2.5rem] shadow-sm">
                  <div className="flex justify-between items-start mb-6">
                    <div><p className="text-[8px] font-black uppercase text-primary tracking-[0.3em] mb-1">Config {req.id}</p><h4 className="text-lg font-black uppercase italic leading-tight">{req.asset}</h4></div>
                    <span className="bg-zinc-100 dark:bg-black px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border border-zinc-200 dark:border-white/5 text-zinc-500">{req.status}</span>
                  </div>
                  <div className="space-y-4 mb-8 text-zinc-500 text-[9px] font-bold uppercase">
                    <div className="flex justify-between border-b border-zinc-100 dark:border-white/5 pb-2"><span>Client</span><span className="text-zinc-900 dark:text-white">{req.user}</span></div>
                    <div className="flex justify-between border-b border-zinc-100 dark:border-white/5 pb-2"><span>Matériau</span><span className="text-zinc-900 dark:text-white">{req.material}</span></div>
                    <div className="flex justify-between"><span>Finition</span><span className="text-zinc-900 dark:text-white">{req.finish}</span></div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-primary transition-all">Accepter</button>
                    <button className="flex-1 border border-zinc-200 dark:border-zinc-800 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:text-red-500 transition-all text-zinc-500">Refuser</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ANALYSES */}
          {activeTab === 'analytics' && (
            <div className="grid md:grid-cols-2 gap-8 animate-fadeIn">
               <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/5 rounded-[3rem] p-10 flex flex-col justify-between overflow-hidden relative shadow-sm">
                  <div><h4 className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Trafic Réseau</h4><p className="text-4xl font-black italic tracking-tighter text-zinc-900 dark:text-white">+2.4k <span className="text-xs text-primary font-bold uppercase tracking-widest ml-2">Accès sécurisés</span></p></div>
                  <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-primary/10 to-transparent flex items-end px-2 space-x-1">{[30, 45, 25, 60, 80, 45, 90, 100].map((h, i) => (<div key={i} style={{height: `${h}%`}} className="flex-grow bg-primary/20 rounded-t-sm"></div>))}</div>
               </div>
               <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/5 rounded-[3rem] p-10 shadow-sm text-zinc-500">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.4em] mb-8">Métriques de Performance</h4>
                  <div className="space-y-6">{['Conversion', 'Rétention', 'Exécution'].map((metric, i) => (<div key={i}><div className="flex justify-between text-[10px] font-black uppercase mb-2"><span>{metric}</span><span className="text-primary">8{i}%</span></div><div className="h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full"><div className={`h-full bg-primary shadow-[0_0_15px_#00ff88]`} style={{width: `8${i}%`}}></div></div></div>))}</div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;