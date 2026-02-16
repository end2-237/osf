import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const Studio = () => {
  // --- ÉTATS ---
  const [catalogue, setCatalogue] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [layers, setLayers] = useState([]);
  const [activeLayerId, setActiveLayerId] = useState(null);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // --- RÉFÉRENCES ---
  const canvasRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // --- CHARGEMENT DU CATALOGUE COMPLET ---
  useEffect(() => {
    const fetchProducts = async () => {
      // On récupère tous les produits sans limite pour le studio
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order('created_at', { ascending: false });
        
      if (data && !error) {
        setCatalogue(data);
        if (!selectedProduct) setSelectedProduct(data[0]);
      }
    };
    fetchProducts();
  }, [selectedProduct]);

  // --- MOTEUR DRAG & DROP PRO ---
  const startDrag = (e, id) => {
    e.stopPropagation();
    setActiveLayerId(id);
    setIsDragging(true);
    
    const layer = layers.find((l) => l.id === id);
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    dragStartPos.current = {
      x: clientX - layer.x,
      y: clientY - layer.y,
    };
  };

  const onDrag = useCallback((e) => {
    if (!isDragging || activeLayerId === null) return;

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    setLayers((prev) =>
      prev.map((l) => (l.id === activeLayerId ? { 
        ...l, 
        x: clientX - dragStartPos.current.x, 
        y: clientY - dragStartPos.current.y 
      } : l))
    );
  }, [isDragging, activeLayerId]);

  const stopDrag = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", onDrag);
      window.addEventListener("mouseup", stopDrag);
      window.addEventListener("touchmove", onDrag, { passive: false });
      window.addEventListener("touchend", stopDrag);
    }
    return () => {
      window.removeEventListener("mousemove", onDrag);
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("touchmove", onDrag);
      window.removeEventListener("touchend", stopDrag);
    };
  }, [isDragging, onDrag]);

  // --- ACTIONS STUDIO ---
  const addLayer = (type, content = "") => {
    const newLayer = {
      id: Date.now(),
      type,
      content: type === "text" ? "TEXTE OFS" : content,
      x: 150, // Position initiale centrée
      y: 150,
      rotate: 0,
      scale: 1,
      color: "#000000",
      zIndex: layers.length + 1
    };
    setLayers([...layers, newLayer]);
    setActiveLayerId(newLayer.id);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (f) => addLayer("image", f.target.result);
      reader.readAsDataURL(file);
    }
  };

  const updateLayer = (id, props) => {
    setLayers(layers.map((l) => (l.id === id ? { ...l, ...props } : l)));
  };

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  return (
    <div className="min-h-screen bg-zinc-50 pt-24 pb-12 selection:bg-primary selection:text-black">
      <div className="max-w-[1700px] mx-auto px-6">
        
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
          <div className="space-y-1">
            <h1 className="text-6xl font-black italic uppercase tracking-tighter text-zinc-900 leading-none">
              OFS <span className="text-primary">STUDIO</span> PRO
            </h1>
            <p className="text-zinc-400 font-black uppercase text-[10px] tracking-[0.3em]">
              Workstation de personnalisation haute performance v2.0
            </p>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => setIsCatalogOpen(true)}
              className="bg-white border-2 border-zinc-200 px-8 py-4 rounded-2xl font-black uppercase text-xs hover:border-primary transition-all flex items-center gap-3 shadow-sm"
            >
              <i className="fa-solid fa-layer-group text-primary"></i> Changer Support
            </button>
            <button className="bg-primary text-black px-12 py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
              Commander le Build
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* TOOLS & LAYERS (LEFT) */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white border border-zinc-200 rounded-[32px] p-6 shadow-sm">
              <h3 className="font-black uppercase italic text-xs mb-6 text-zinc-400">Composants</h3>
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => addLayer("text")}
                  className="w-full flex items-center gap-4 p-4 border-2 border-zinc-50 rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all group text-left"
                >
                  <div className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-black transition-all">
                    <i className="fa-solid fa-font"></i>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase italic">Ajouter Texte</p>
                    <p className="text-[8px] font-bold text-zinc-400 uppercase">Custom Font</p>
                  </div>
                </button>

                <label className="w-full flex items-center gap-4 p-4 border-2 border-zinc-50 rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group text-left">
                  <input type="file" className="hidden" onChange={handleImageUpload} />
                  <div className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-black transition-all">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase italic">Importer Image</p>
                    <p className="text-[8px] font-bold text-zinc-400 uppercase">PNG / JPG / SVG</p>
                  </div>
                </label>
              </div>
            </div>

            {/* LAYER MANAGER */}
            <div className="bg-white border border-zinc-200 rounded-[32px] p-6 shadow-sm">
              <h3 className="font-black uppercase italic text-xs mb-6 text-zinc-400">Timeline Calques</h3>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {layers.length === 0 && (
                  <div className="text-center py-10 opacity-20">
                    <i className="fa-solid fa-layer-group text-2xl mb-2"></i>
                    <p className="text-[10px] font-black uppercase">Aucun élément</p>
                  </div>
                )}
                {[...layers].reverse().map((layer) => (
                  <div 
                    key={layer.id}
                    onClick={() => setActiveLayerId(layer.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all cursor-pointer ${activeLayerId === layer.id ? 'border-primary bg-primary/5 shadow-md' : 'border-zinc-50 bg-zinc-50'}`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 flex-shrink-0 bg-white rounded-lg flex items-center justify-center text-[10px]">
                        {layer.type === 'text' ? 'T' : <i className="fa-solid fa-image text-zinc-400"></i>}
                      </div>
                      <span className="text-[10px] font-black uppercase truncate italic">
                        {layer.type === 'text' ? layer.content : 'Image_Upload'}
                      </span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setLayers(layers.filter(l => l.id !== layer.id)) }} className="text-zinc-300 hover:text-red-500 p-2">
                      <i className="fa-solid fa-trash-can text-[10px]"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MAIN CANVAS (CENTER) */}
          <div 
            className="lg:col-span-6 min-h-[700px] bg-zinc-100/50 rounded-[60px] border-4 border-white shadow-2xl relative flex items-center justify-center overflow-hidden cursor-crosshair"
            onMouseDown={() => setActiveLayerId(null)} // Désélectionner au clic sur le fond
          >
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:30px_30px]"></div>
            
            {selectedProduct && (
              <div 
                ref={canvasRef} 
                className="relative w-full h-full flex items-center justify-center select-none"
                onClick={(e) => e.stopPropagation()} 
              >
                <img 
                  src={selectedProduct.img} 
                  alt="Mockup" 
                  className="max-w-[85%] max-h-[85%] object-contain drop-shadow-[0_25px_50px_rgba(0,0,0,0.15)] pointer-events-none"
                />

                <div className="absolute inset-0">
                  {layers.map((layer) => (
                    <div
                      key={layer.id}
                      onMouseDown={(e) => startDrag(e, layer.id)}
                      onTouchStart={(e) => startDrag(e, layer.id)}
                      style={{
                        left: `${layer.x}px`,
                        top: `${layer.y}px`,
                        transform: `rotate(${layer.rotate}deg) scale(${layer.scale})`,
                        position: 'absolute',
                        zIndex: layer.zIndex,
                        cursor: isDragging && activeLayerId === layer.id ? 'grabbing' : 'grab'
                      }}
                      className={`group p-2 transition-shadow ${activeLayerId === layer.id ? 'ring-2 ring-primary ring-offset-4 ring-offset-zinc-100 rounded-sm' : 'hover:ring-1 hover:ring-primary/30'}`}
                    >
                      {layer.type === 'text' ? (
                        <h2 style={{ color: layer.color }} className="font-black italic uppercase text-4xl whitespace-nowrap leading-none select-none drop-shadow-sm">
                          {layer.content}
                        </h2>
                      ) : (
                        <img src={layer.content} className="w-40 h-auto pointer-events-none rounded-lg" alt="Custom" />
                      )}
                      
                      {/* Anchor points visuels si sélectionné */}
                      {activeLayerId === layer.id && (
                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-primary rounded-full shadow-lg flex items-center justify-center">
                           <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* INSPECTOR (RIGHT) */}
          <div className="lg:col-span-3 space-y-6">
            {activeLayer ? (
              <div className="bg-zinc-900 text-white rounded-[40px] p-8 shadow-2xl space-y-8 animate-in slide-in-from-right duration-500">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                   <h3 className="font-black uppercase italic text-xs text-primary">Inspecteur</h3>
                   <button onClick={() => setActiveLayerId(null)} className="text-zinc-500 hover:text-white text-[10px] font-black uppercase">Fermer</button>
                </div>
                
                {activeLayer.type === 'text' && (
                  <div className="space-y-4">
                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Édition Texte</label>
                    <input 
                      type="text" 
                      value={activeLayer.content}
                      onChange={(e) => updateLayer(activeLayer.id, { content: e.target.value })}
                      className="w-full bg-zinc-800 border-none rounded-2xl p-4 text-xs font-black uppercase italic outline-none focus:ring-2 ring-primary transition-all"
                    />
                  </div>
                )}

                <div className="space-y-8">
                  {/* POSITION X/Y */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Pos X</label>
                      <input 
                        type="number" 
                        value={Math.round(activeLayer.x)}
                        onChange={(e) => updateLayer(activeLayer.id, { x: parseInt(e.target.value) })}
                        className="w-full bg-zinc-800 rounded-xl p-2 text-[10px] font-black text-center"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Pos Y</label>
                      <input 
                        type="number" 
                        value={Math.round(activeLayer.y)}
                        onChange={(e) => updateLayer(activeLayer.id, { y: parseInt(e.target.value) })}
                        className="w-full bg-zinc-800 rounded-xl p-2 text-[10px] font-black text-center"
                      />
                    </div>
                  </div>

                  {/* SCALE */}
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Échelle</label>
                      <span className="text-[10px] font-black text-primary">{(activeLayer.scale * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                      type="range" min="0.1" max="5" step="0.1" 
                      value={activeLayer.scale}
                      onChange={(e) => updateLayer(activeLayer.id, { scale: parseFloat(e.target.value) })}
                      className="w-full accent-primary h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>

                  {/* ROTATION */}
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Rotation</label>
                      <span className="text-[10px] font-black text-primary">{activeLayer.rotate}°</span>
                    </div>
                    <input 
                      type="range" min="0" max="360" 
                      value={activeLayer.rotate}
                      onChange={(e) => updateLayer(activeLayer.id, { rotate: parseInt(e.target.value) })}
                      className="w-full accent-primary h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>

                  {/* COLOR (Uniquement texte) */}
                  {activeLayer.type === 'text' && (
                    <div className="space-y-4">
                      <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Nuancier OFS</label>
                      <div className="flex flex-wrap gap-2">
                        {['#00ff88', '#ffffff', '#000000', '#ff2d2d', '#2d8cff', '#ffff2d'].map(c => (
                          <button 
                            key={c}
                            onClick={() => updateLayer(activeLayer.id, { color: c })}
                            style={{ backgroundColor: c }}
                            className={`w-9 h-9 rounded-xl border-2 transition-all ${activeLayer.color === c ? 'border-primary scale-110 shadow-[0_0_10px_rgba(0,255,136,0.3)]' : 'border-zinc-700'}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Z-INDEX CONTROL */}
                  <div className="flex gap-2 pt-4">
                      <button 
                        onClick={() => updateLayer(activeLayer.id, { zIndex: activeLayer.zIndex + 1 })}
                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl text-[9px] font-black uppercase italic border border-white/5 transition-all"
                      >Avant-plan</button>
                      <button 
                        onClick={() => updateLayer(activeLayer.id, { zIndex: Math.max(1, activeLayer.zIndex - 1) })}
                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl text-[9px] font-black uppercase italic border border-white/5 transition-all"
                      >Arrière-plan</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center p-12 text-center bg-white border-2 border-dashed border-zinc-200 rounded-[40px]">
                <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
                   <i className="fa-solid fa-hand-pointer text-zinc-300 animate-bounce"></i>
                </div>
                <p className="text-[10px] font-black uppercase text-zinc-400 leading-relaxed tracking-widest">
                  Cliquez sur un élément du canvas pour éditer ses propriétés
                </p>
              </div>
            )}

            {/* CART SUMMARY */}
            <div className="bg-primary/5 border border-primary/20 rounded-[40px] p-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase text-zinc-500">Total Custom Build</span>
                <span className="text-3xl font-black italic tracking-tighter">{selectedProduct?.price || 0} F</span>
              </div>
              <p className="text-[9px] font-bold text-zinc-400 uppercase leading-relaxed">
                * Livraison estimée : 2-4 jours à Douala/Yaoundé. Impression Haute Fidélité garantie.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL CATALOGUE COMPLET */}
      {isCatalogOpen && (
        <div className="fixed inset-0 z-[999] bg-zinc-900/80 backdrop-blur-2xl flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in duration-300">
          <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-[50px] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-10 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter">Support <span className="text-primary">Library</span></h2>
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mt-1">Sélectionnez la base de votre création OFS</p>
              </div>
              <button 
                onClick={() => setIsCatalogOpen(false)} 
                className="w-14 h-14 bg-white border border-zinc-200 rounded-full flex items-center justify-center hover:bg-zinc-900 hover:text-white transition-all shadow-xl group"
              >
                <i className="fa-solid fa-xmark text-xl group-hover:rotate-90 transition-transform"></i>
              </button>
            </div>
            
            {/* Modal Grid (All Products) */}
            <div className="flex-1 p-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 overflow-y-auto custom-scrollbar">
              {catalogue.map(product => (
                <div 
                  key={product.id}
                  onClick={() => { setSelectedProduct(product); setIsCatalogOpen(false); }}
                  className="group cursor-pointer flex flex-col"
                >
                  <div className="aspect-[4/5] bg-zinc-50 rounded-[40px] p-8 border-2 border-transparent group-hover:border-primary group-hover:bg-primary/5 transition-all relative overflow-hidden flex items-center justify-center">
                    <img src={product.img} className="max-w-full max-h-full object-contain group-hover:scale-110 transition-all duration-700" loading="lazy" />
                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="bg-white px-6 py-2 rounded-full text-[10px] font-black uppercase italic shadow-xl">Choisir ce modèle</span>
                    </div>
                  </div>
                  <div className="mt-6 px-2">
                    <div className="flex justify-between items-start mb-1">
                        <p className="text-[11px] font-black uppercase text-zinc-900 leading-tight flex-1">{product.name}</p>
                        <p className="text-[11px] font-black text-primary italic ml-4">{product.price}F</p>
                    </div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{product.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Studio;