import React, { useState, useMemo, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import { supabase } from '../lib/supabase';

const Store = ({ openModal, addToCart }) => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("featured");
  const [maxPrice, setMaxPrice] = useState(250000);
  const [selectedSize, setSelectedSize] = useState("All");
  const [dbProducts, setDbProducts] = useState([]);

  useEffect(() => {
    const fetchStoreProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*');
      if (!error) setDbProducts(data);
    };
    fetchStoreProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return dbProducts
      .filter(p => (category === "All" || p.type === category))
      .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
      .filter(p => p.price <= maxPrice)
      .filter(p => {
        if (selectedSize === "All") return true;
        return (p.type === "Clothing" || p.type === "Shoes");
      })
      .sort((a, b) => {
        if (sortBy === "price-asc") return a.price - b.price;
        if (sortBy === "price-desc") return b.price - a.price;
        return 0;
      });
  }, [dbProducts, search, category, sortBy, maxPrice, selectedSize]);

  const categories = ["All", "Audio Lab", "Clothing", "Shoes", "Tech Lab"];
  const apparelSizes = ["S", "M", "L", "XL"];
  const shoeSizes = ["40", "41", "42", "43", "44"];

  return (
    <main className="pt-24 pb-12 px-4 md:px-8 max-w-[1920px] mx-auto min-h-screen">
      
      {/* HEADER COMPACT */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-center border-b dark:border-zinc-800 pb-6 gap-4">
        <div className="flex items-baseline space-x-3">
          <h1 className="text-4xl font-black italic tracking-tighter uppercase">THE <span className="text-primary">ARSENAL.</span></h1>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded">
            {filteredProducts.length} Items
          </span>
        </div>
        
        {/* BARRE DE RECHERCHE INTÉGRÉE AU HEADER */}
        <div className="relative w-full md:w-96 group">
          <input 
            type="text" 
            placeholder="Recherche rapide..." 
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 pl-10 rounded-lg text-xs font-bold focus:ring-1 ring-primary outline-none transition-all"
            onChange={(e) => setSearch(e.target.value)}
          />
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-xs"></i>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* SIDEBAR COMPACTE */}
        <aside className="lg:w-56 space-y-8 flex-shrink-0">
          {/* Catégories - Style Liste Compacte */}
          <div>
            <label className="text-[9px] font-black uppercase tracking-[0.2em] mb-4 block text-zinc-400">Collections</label>
            <div className="space-y-1">
              {categories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => {setCategory(cat); setSelectedSize("All");}}
                  className={`w-full text-left text-[11px] font-bold uppercase px-3 py-2 rounded-md transition-all ${category === cat ? 'bg-primary text-black' : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tailles - Style Grille Compacte */}
          {(category === "Clothing" || category === "Shoes" || category === "All") && (
            <div>
              <label className="text-[9px] font-black uppercase tracking-[0.2em] mb-4 block text-zinc-400">Taille / Pointure</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button 
                  onClick={() => setSelectedSize("All")}
                  className={`py-2 text-[9px] font-black border rounded ${selectedSize === "All" ? 'bg-black dark:bg-white dark:text-black text-white border-black dark:border-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500'}`}
                >
                  ALL
                </button>
                {(category === "Shoes" ? shoeSizes : apparelSizes).map(s => (
                  <button 
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`py-2 text-[9px] font-black border rounded transition ${selectedSize === s ? 'bg-primary text-black border-primary' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Budget - Compact Slider */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Budget Max</label>
              <span className="text-[10px] font-black text-primary">{Number(maxPrice).toLocaleString()}</span>
            </div>
            <input 
                type="range" min="10000" max="250000" step="5000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full accent-primary bg-zinc-200 dark:bg-zinc-800 h-1 rounded-lg cursor-pointer"
            />
          </div>
        </aside>

        {/* GRILLE STORE OPTIMISÉE (4 COLONNES) */}
        <section className="flex-grow">
          <div className="flex justify-end mb-6">
            <div className="flex items-center space-x-2">
                <span className="text-[9px] font-black uppercase opacity-40">Tri :</span>
                <select 
                    className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer focus:text-primary"
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    <option value="featured">Populaire</option>
                    <option value="price-asc">Prix ↑</option>
                    <option value="price-desc">Prix ↓</option>
                </select>
            </div>
          </div>

          {/* Grille 4 colonnes sur XL, 3 sur LG, 2 sur SM */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} openModal={openModal} addToCart={addToCart} />
            ))}
          </div>

          {/* Message vide si aucun résultat */}
          {filteredProducts.length === 0 && (
            <div className="py-32 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-900 rounded-3xl">
              <h3 className="text-xl font-black italic uppercase opacity-20 mb-4">Aucun équipement disponible</h3>
              <button onClick={() => {setCategory("All"); setSelectedSize("All"); setMaxPrice(250000)}} className="text-[10px] font-black uppercase text-primary underline underline-offset-8">Réinitialiser tout</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default Store;