import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { products } from '../data/products';

const Studio = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('clothing');
  const [currentProduct, setCurrentProduct] = useState(null); // État pour stocker le produit réel
  const [config, setConfig] = useState({
    material: 'Premium Cotton',
    color: '#00ff88',
    finish: 'Matte',
    engraving: ''
  });
  const [isRendering, setIsRendering] = useState(false);

  // Initialisation : Charger le produit réel et mapper la catégorie
  useEffect(() => {
    if (location.state && location.state.productId) {
      const foundProduct = products.find(p => p.id === location.state.productId);
      if (foundProduct) {
        setCurrentProduct(foundProduct);
        const type = foundProduct.type.toLowerCase();
        if (type.includes('clothing')) setActiveTab('clothing');
        else if (type.includes('shoes')) setActiveTab('sneakers');
        else if (type.includes('tech') || type.includes('audio')) setActiveTab('watch');
      }
    }
  }, [location]);

  useEffect(() => {
    setIsRendering(true);
    const timer = setTimeout(() => setIsRendering(false), 800);
    return () => clearTimeout(timer);
  }, [config, activeTab]);

  const categories = {
    clothing: {
      name: 'Apparel Lab',
      defaultImg: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=1000',
      materials: ['Premium Cotton', 'Tech-Silk', 'Organic Hemp'],
      inspirations: [
        "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=200",
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=200"
      ]
    },
    watch: {
      name: 'Horology Lab',
      defaultImg: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000',
      materials: ['Carbon Fiber', 'Brushed Titanium', 'Ceramic'],
      inspirations: [
        "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?q=80&w=200",
        "https://images.unsplash.com/photo-1508685096489-77a46807e604?q=80&w=200"
      ]
    },
    sneakers: {
      name: 'Footwear Lab',
      defaultImg: 'https://images.unsplash.com/photo-1552066344-24632e509633?q=80&w=1000',
      materials: ['Italian Leather', 'PrimeKnit', 'Suede'],
      inspirations: [
        "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=200",
        "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=200"
      ]
    }
  };

  // Logique pour déterminer quelle image afficher : produit réel ou image par défaut de la tab
  const displayImage = currentProduct && activeTab === (
    currentProduct.type.toLowerCase().includes('clothing') ? 'clothing' : 
    currentProduct.type.toLowerCase().includes('shoes') ? 'sneakers' : 'watch'
  ) ? currentProduct.img : categories[activeTab].defaultImg;

  return (
    <main className="pt-20 min-h-screen flex flex-col lg:flex-row bg-white dark:bg-[#020202] text-zinc-900 dark:text-white transition-colors duration-500">
      
      {/* SECTION VISUALISEUR */}
      <div className="lg:w-3/5 h-[60vh] lg:h-screen sticky top-0 bg-zinc-50 dark:bg-black flex items-center justify-center p-6 md:p-12 overflow-hidden border-r border-zinc-200 dark:border-white/5">
        <div className="absolute inset-0 p-8 flex flex-col justify-between pointer-events-none z-20">
          <div className="flex justify-between items-start text-zinc-400 dark:text-zinc-500 font-mono text-[10px] uppercase">
             <p>Device: FS-X-RENDERER</p>
             <p className={isRendering ? 'text-primary animate-pulse' : ''}>{isRendering ? '>> RENDERING...' : '>> READY'}</p>
          </div>
          <div className="bg-white/80 dark:bg-zinc-900/50 backdrop-blur-md p-4 rounded-xl border border-zinc-200 dark:border-white/5">
              <p className="text-[11px] font-black italic uppercase">
                {currentProduct ? `Target: ${currentProduct.name}` : categories[activeTab].name}
              </p>
          </div>
        </div>

        <div className="relative group scale-90 md:scale-100 transition-all duration-1000">
          <div className={`absolute -inset-20 bg-primary/10 blur-[100px] rounded-full transition-opacity duration-1000 ${isRendering ? 'opacity-100' : 'opacity-40'}`}></div>
          <img 
            src={displayImage} 
            className={`relative z-10 w-full max-w-xl shadow-2xl transition-all duration-700 ${isRendering ? 'scale-95 blur-sm' : 'scale-105'}`} 
            alt="Custom Asset" 
          />
        </div>
      </div>

      {/* SECTION CONFIGURATION */}
      <div className="lg:w-2/5 p-8 lg:p-16 flex flex-col h-screen overflow-y-auto hide-scrollbar bg-white dark:bg-[#050505]">
        <div className="mb-12">
          <h2 className="text-5xl font-black italic tracking-tighter mb-4 uppercase">Elite <span className="text-primary underline decoration-primary/30">Studio.</span></h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Engine v2.0 // Personalized Manufacturing</p>
        </div>

        <div className="space-y-12 pb-20">
          <section>
            <label className="text-[10px] font-black uppercase text-primary mb-6 block tracking-[0.2em] border-l-2 border-primary pl-4">01. Base Selection</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.keys(categories).map(key => (
                <button 
                  key={key}
                  onClick={() => { setActiveTab(key); setCurrentProduct(null); }}
                  className={`py-5 border-2 rounded-2xl text-[10px] font-black transition-all duration-300 ${activeTab === key ? 'border-primary text-primary bg-primary/5' : 'border-zinc-100 dark:border-zinc-900 text-zinc-400'}`}
                >
                  {key.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          <section className="animate-fadeIn">
            <label className="text-[10px] font-black uppercase text-primary mb-6 block tracking-[0.2em] border-l-2 border-primary pl-4">02. Core Material</label>
            <div className="space-y-2">
              {categories[activeTab].materials.map(m => (
                <button key={m} onClick={() => setConfig({...config, material: m})} className={`w-full p-4 rounded-xl border text-[11px] font-black uppercase text-left ${config.material === m ? 'border-primary text-primary' : 'border-zinc-100 dark:border-white/5'}`}>{m}</button>
              ))}
            </div>
          </section>

          <section className="pt-6">
            <label className="text-[10px] font-black uppercase text-zinc-400 mb-6 block tracking-[0.2em]">Inspiration Gallery</label>
            <div className="grid grid-cols-2 gap-4">
               {categories[activeTab].inspirations.map((url, i) => (
                 <div key={i} className="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer border border-zinc-100 dark:border-white/5">
                    <img src={url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition duration-500" />
                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                       <span className="text-[8px] font-black text-black uppercase bg-primary px-3 py-1">Apply Style</span>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          <div className="pt-10 border-t border-zinc-100 dark:border-white/10 mt-10">
            <button className="w-full bg-black dark:bg-primary text-white dark:text-black font-black py-7 uppercase tracking-[0.5em] text-[11px] shadow-xl hover:scale-[1.02] transition-transform">
              Initialize Lab Order
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Studio;