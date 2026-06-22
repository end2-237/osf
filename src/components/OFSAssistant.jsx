import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const CATEGORIES = [
  { key: "Audio Lab",      label: "Audio Lab",   icon: "fa-headphones",         color: "#FF9900",
    subs: ["Casques", "Enceintes", "Écouteurs", "Microphones"] },
  { key: "Tech Lab",       label: "Tech Lab",    icon: "fa-microchip",          color: "#3b82f6",
    subs: ["Smartphones", "TV & Vidéo", "Tablettes", "Informatique", "Gaming", "Photo & Vidéo", "Câbles & Chargeurs", "Électroménager", "Objets Connectés", "Maison Connectée"] },
  { key: "Clothing",       label: "Pour Lui",    icon: "fa-shirt",              color: "#a855f7",
    subs: ["Hoodies & Sweats", "T-Shirts & Polos", "Chemises", "Pantalons & Jeans", "Vestes & Manteaux", "Shorts", "Costumes & Survêtements", "Sous-vêtements"] },
  { key: "Shoes",          label: "Sneakers",    icon: "fa-shoe-prints",        color: "#f97316",
    subs: ["Sneakers", "Bottes", "Sandales", "Mocassins", "Talons"] },
  { key: "Femme",          label: "Pour Elle",   icon: "fa-person-dress",       color: "#ec4899",
    subs: ["Robes & Jupes", "Tops & Blouses", "Lingerie", "Manteaux", "Combinaisons"] },
  { key: "Beauté",         label: "Beauté",      icon: "fa-spray-can-sparkles", color: "#f472b6",
    subs: ["Parfums", "Soins Visage", "Soins Cheveux", "Maquillage", "Corps & Bain"] },
  { key: "Accessories",    label: "Accessoires", icon: "fa-gem",                color: "#eab308",
    subs: ["Montres", "Bijoux", "Sacs à main", "Lunettes", "Portefeuilles", "Ceintures", "Chapeaux"] },
  { key: "Maison",         label: "Maison",      icon: "fa-house",              color: "#14b8a6",
    subs: ["Cuisine", "Décoration", "Literie", "Éclairage", "Rangement"] },
  { key: "Sport",          label: "Sport",       icon: "fa-dumbbell",           color: "#f97316",
    subs: ["Fitness", "Vêtements Sport", "Cyclisme", "Natation", "Camping"] },
  { key: "Bébé & Enfants", label: "Enfants",     icon: "fa-baby",               color: "#fb923c",
    subs: ["Jouets", "Vêtements Enfant", "Nurserie", "Scolaire"] },
  { key: "Auto",           label: "Auto",        icon: "fa-car",                color: "#64748b",
    subs: ["Intérieur Auto", "Extérieur Auto", "Moto & Scooter", "Entretien"] },
];

const OFSAssistant = ({ addToCart }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorProducts, setVendorProducts] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [addedId, setAddedId] = useState(null);
  const [section, setSection] = useState('products');
  const [expandedCat, setExpandedCat] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open || dataLoaded) return;
    const load = async () => {
      const [prodR, vendR] = await Promise.all([
        supabase.from('products')
          .select('id, name, price, img, type, description, vendor_id, cj_product_id, created_at, vendor:vendors!vendor_id(id, shop_name)')
          .order('created_at', { ascending: false }),
        supabase.from('vendors')
          .select('id, shop_name, full_name, city, phone, logo_url, category, member_discount_enabled, is_active')
          .eq('is_active', true).order('shop_name'),
      ]);
      const prods = prodR.data || [];
      const vends = vendR.data || [];
      setAllProducts(prods);
      setVendors(vends);
      const vp = {};
      prods.forEach(p => { if (p.vendor_id) { if (!vp[p.vendor_id]) vp[p.vendor_id] = []; vp[p.vendor_id].push(p); } });
      setVendorProducts(vp);
      setDataLoaded(true);
    };
    load();
  }, [open, dataLoaded]);

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const getFiltered = () => {
    let q = query.trim().toLowerCase();
    let list = allProducts;

    // Category/subcategory filter
    if (expandedCat && !activeSub && !q) {
      list = list.filter(p => (p.type || '').toLowerCase() === expandedCat.toLowerCase());
    }
    if (activeSub) {
      const sub = activeSub.toLowerCase();
      list = list.filter(p => {
        const hay = `${p.name || ''} ${p.type || ''} ${p.description || ''}`.toLowerCase();
        return hay.includes(sub);
      });
    }

    // Text search
    if (q) {
      const words = q.split(/\s+/).filter(Boolean);
      list = list.filter(p => {
        const hay = `${p.name || ''} ${p.type || ''} ${p.description || ''} ${p.vendor?.shop_name || ''}`.toLowerCase();
        return words.some(w => hay.includes(w));
      });
    }

    return list.slice(0, 40);
  };

  const filtered = getFiltered();
  const isFiltering = !!(query.trim() || expandedCat || activeSub);

  const handleProductClick = (p) => { setOpen(false); navigate(`/product/${p.id}`); };
  const handleAddToCart = (p, e) => {
    e.stopPropagation();
    addToCart({ id: p.id, name: p.name, price: p.price, img: p.img, quantity: 1, selectedSize: null, selectedColor: null, vendor_id: p.vendor_id, cj_product_id: p.cj_product_id });
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1000);
  };

  const handleCatClick = (cat) => {
    if (expandedCat === cat.key) {
      setExpandedCat(null);
      setActiveSub(null);
    } else {
      setExpandedCat(cat.key);
      setActiveSub(null);
      setQuery('');
    }
  };

  const handleSubClick = (sub) => {
    setActiveSub(activeSub === sub ? null : sub);
    setQuery('');
  };

  const clearFilters = () => { setQuery(''); setExpandedCat(null); setActiveSub(null); };

  const catCounts = {};
  if (dataLoaded) {
    CATEGORIES.forEach(c => {
      catCounts[c.key] = allProducts.filter(p => (p.type || '').toLowerCase() === c.key.toLowerCase()).length;
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-50 w-10 h-10 bg-[#232F3E] hover:bg-[#37475A] text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95">
        <i className="fa-solid fa-magnifying-glass text-[13px]"></i>
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-white">

          {/* Top bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#E7E7E7] flex-shrink-0">
            <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center text-[#565959] hover:text-[#0F1111]">
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </button>
            <div className="flex-1 relative">
              <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[#FF9900] text-xs"></i>
              <input ref={inputRef} value={query}
                onChange={e => { setQuery(e.target.value); if (e.target.value) { setExpandedCat(null); setActiveSub(null); } }}
                placeholder="Rechercher produits, marques, boutiques…"
                className="w-full pl-8 pr-8 py-2 border border-[#D5D9D9] focus:border-[#FF9900] text-[13px] outline-none bg-[#F7F8F8] focus:bg-white transition" />
              {(query || expandedCat) && (
                <button onClick={clearFilters} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#ADBAC7] hover:text-[#0F1111]">
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              )}
            </div>
          </div>

          {/* Section toggle */}
          <div className="flex border-b border-[#E7E7E7] flex-shrink-0">
            {[
              { key: 'products', label: 'Produits', icon: 'fa-box' },
              { key: 'categories', label: 'Catégories', icon: 'fa-layer-group' },
              { key: 'boutiques', label: 'Boutiques', icon: 'fa-store' },
            ].map(s => (
              <button key={s.key} onClick={() => setSection(s.key)}
                className={`flex-1 py-2.5 text-[11px] font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                  section === s.key ? 'text-[#0F1111] border-[#FF9900]' : 'text-[#565959] border-transparent hover:text-[#0F1111]'
                }`}>
                <i className={`fa-solid ${s.icon} text-[9px]`}></i>
                {s.label}
              </button>
            ))}
          </div>

          {/* Active filter badge */}
          {isFiltering && section !== 'categories' && (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-[#FFF8F0] border-b border-[#FFE0B2] flex-shrink-0">
              <p className="text-[10px] text-[#B85C00] flex-1">
                {activeSub && <><i className="fa-solid fa-tag mr-1"></i>{activeSub}</>}
                {expandedCat && !activeSub && <><i className="fa-solid fa-folder mr-1"></i>{CATEGORIES.find(c => c.key === expandedCat)?.label}</>}
                {query && <><i className="fa-solid fa-magnifying-glass mr-1"></i>"{query}"</>}
                <span className="ml-1 text-[#ADBAC7]">— {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
              </p>
              <button onClick={clearFilters} className="text-[10px] font-bold text-[#007185] hover:text-[#FF9900]">Effacer</button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {!dataLoaded ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-[3px] border-[#FF9900] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : section === 'categories' ? (
              /* ─── CATEGORIES ─── */
              <div className="divide-y divide-[#F3F4F4]">
                {CATEGORIES.map(cat => {
                  const isExpanded = expandedCat === cat.key;
                  const count = catCounts[cat.key] || 0;
                  return (
                    <div key={cat.key}>
                      <button onClick={() => handleCatClick(cat)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isExpanded ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]'
                        }`}>
                        <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 border border-[#E7E7E7]"
                          style={{ backgroundColor: cat.color + '10' }}>
                          <i className={`fa-solid ${cat.icon} text-sm`} style={{ color: cat.color }}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-[#0F1111]">{cat.label}</p>
                          <p className="text-[10px] text-[#565959]">{cat.subs.length} sous-catégories · {count} article{count !== 1 ? 's' : ''}</p>
                        </div>
                        <i className={`fa-solid fa-chevron-right text-[10px] text-[#ADBAC7] transition-transform ${isExpanded ? 'rotate-90' : ''}`}></i>
                      </button>

                      {isExpanded && (
                        <div className="bg-[#FAFAFA] border-t border-[#F3F4F4]">
                          {/* View all in category */}
                          <button onClick={() => { setActiveSub(null); setSection('products'); }}
                            className="w-full flex items-center gap-3 px-4 py-2 pl-16 text-left hover:bg-[#F0F0F0] transition-colors border-b border-[#F3F4F4]">
                            <i className="fa-solid fa-border-all text-[9px] text-[#FF9900]"></i>
                            <span className="text-[12px] font-bold text-[#FF9900]">Tout {cat.label}</span>
                            <span className="text-[10px] text-[#ADBAC7] ml-auto">{count}</span>
                          </button>
                          {cat.subs.map(sub => (
                            <button key={sub} onClick={() => { handleSubClick(sub); setSection('products'); }}
                              className={`w-full flex items-center gap-3 px-4 py-2 pl-16 text-left transition-colors ${
                                activeSub === sub ? 'bg-[#FFF8F0]' : 'hover:bg-[#F0F0F0]'
                              }`}>
                              <i className={`fa-solid fa-chevron-right text-[7px] ${activeSub === sub ? 'text-[#FF9900]' : 'text-[#D5D9D9]'}`}></i>
                              <span className={`text-[12px] ${activeSub === sub ? 'font-bold text-[#B85C00]' : 'text-[#0F1111]'}`}>{sub}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Total summary */}
                <div className="px-4 py-3 bg-[#F7F8F8]">
                  <p className="text-[10px] text-[#565959]">
                    <span className="font-bold text-[#0F1111]">{CATEGORIES.length}</span> catégories ·{' '}
                    <span className="font-bold text-[#0F1111]">{CATEGORIES.reduce((s, c) => s + c.subs.length, 0)}</span> sous-catégories ·{' '}
                    <span className="font-bold text-[#0F1111]">{allProducts.length}</span> produits
                  </p>
                </div>
              </div>
            ) : section === 'products' ? (
              /* ─── PRODUCTS ─── */
              <>
                {/* Quick category pills when not filtering */}
                {!isFiltering && (
                  <div className="flex gap-1.5 px-4 py-2 overflow-x-auto hide-scrollbar border-b border-[#F3F4F4] bg-[#FAFAFA] flex-shrink-0">
                    {CATEGORIES.slice(0, 7).map(c => (
                      <button key={c.key} onClick={() => { setExpandedCat(c.key); setSection('products'); }}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold whitespace-nowrap border bg-white text-[#565959] border-[#D5D9D9] hover:border-[#131921] transition-all flex-shrink-0">
                        <i className={`fa-solid ${c.icon} text-[8px]`} style={{ color: c.color }}></i>{c.label}
                      </button>
                    ))}
                  </div>
                )}

                {filtered.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <i className="fa-solid fa-box-open text-4xl text-[#E7E7E7] mb-3 block"></i>
                    <p className="text-[13px] text-[#565959]">Aucun résultat</p>
                    <p className="text-[11px] text-[#ADBAC7] mt-1">Essaie d'autres mots-clés ou catégories</p>
                    <button onClick={clearFilters} className="mt-3 text-[11px] font-bold text-[#007185] hover:text-[#FF9900]">
                      Réinitialiser les filtres
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px bg-[#E7E7E7]">
                    {filtered.map(p => (
                      <div key={p.id} onClick={() => handleProductClick(p)}
                        className="bg-white cursor-pointer hover:bg-[#FAFAFA] transition-colors group relative">
                        <div className="aspect-square bg-[#F7F8F8] relative overflow-hidden">
                          {p.img
                            ? <img src={p.img} alt="" className="w-full h-full object-cover" loading="lazy" />
                            : <div className="w-full h-full flex items-center justify-center text-[#E7E7E7]"><i className="fa-solid fa-image text-xl"></i></div>
                          }
                          <button onClick={(e) => handleAddToCart(p, e)}
                            className={`absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center transition-all shadow-sm ${
                              addedId === p.id
                                ? 'bg-[#007600] text-white'
                                : 'bg-white text-[#0F1111] border border-[#D5D9D9] opacity-0 group-hover:opacity-100 hover:border-[#FF9900]'
                            }`}>
                            <i className={`fa-solid ${addedId === p.id ? 'fa-check' : 'fa-cart-plus'} text-[10px]`}></i>
                          </button>
                        </div>
                        <div className="px-2 py-2">
                          <p className="text-[11px] text-[#0F1111] leading-snug line-clamp-2">{p.name}</p>
                          <p className="text-[13px] font-bold text-[#0F1111] mt-0.5">{Number(p.price).toLocaleString()} <span className="text-[10px] font-normal">FCFA</span></p>
                          {p.vendor?.shop_name && (
                            <p className="text-[9px] text-[#007185] mt-0.5">{p.vendor.shop_name}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {filtered.length > 0 && isFiltering && (
                  <button onClick={() => { setOpen(false); navigate(`/search?q=${encodeURIComponent(query || activeSub || expandedCat || '')}`); }}
                    className="w-full py-3 text-[12px] font-bold text-[#007185] hover:text-[#FF9900] border-t border-[#E7E7E7] transition-colors">
                    Voir tous les résultats sur OFS <i className="fa-solid fa-chevron-right ml-1 text-[9px]"></i>
                  </button>
                )}
              </>
            ) : (
              /* ─── BOUTIQUES ─── */
              <div className="divide-y divide-[#E7E7E7]">
                {vendors.map(v => {
                  const vProds = (vendorProducts[v.id] || []).slice(0, 5);
                  return (
                    <div key={v.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#F7F8F8] border border-[#E7E7E7] overflow-hidden flex items-center justify-center flex-shrink-0">
                          {v.logo_url
                            ? <img src={v.logo_url} alt="" className="w-full h-full object-cover" />
                            : <i className="fa-solid fa-store text-[#ADBAC7] text-sm"></i>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-[#0F1111] truncate">{v.shop_name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-[#565959]">
                            <span>{v.city || 'Douala'}</span>
                            {v.category && <span>· {v.category}</span>}
                            <span>· {(vendorProducts[v.id] || []).length} articles</span>
                            {v.member_discount_enabled && <span className="text-[#007600] font-bold">Membre -20%</span>}
                          </div>
                        </div>
                      </div>

                      {vProds.length > 0 && (
                        <div className="flex gap-1.5 mt-2 overflow-x-auto hide-scrollbar">
                          {vProds.map(p => (
                            <div key={p.id} onClick={() => handleProductClick(p)}
                              className="w-14 h-14 flex-shrink-0 bg-[#F7F8F8] border border-[#E7E7E7] overflow-hidden cursor-pointer hover:border-[#FF9900] transition-all">
                              {p.img
                                ? <img src={p.img} alt="" className="w-full h-full object-cover" loading="lazy" />
                                : <div className="w-full h-full flex items-center justify-center text-[#E7E7E7]"><i className="fa-solid fa-image text-[10px]"></i></div>
                              }
                            </div>
                          ))}
                          {(vendorProducts[v.id] || []).length > 5 && (
                            <div onClick={() => { setOpen(false); navigate(`/shop/${encodeURIComponent(v.shop_name)}`); }}
                              className="w-14 h-14 flex-shrink-0 bg-[#F7F8F8] border border-[#E7E7E7] flex items-center justify-center cursor-pointer hover:border-[#FF9900] transition-all">
                              <span className="text-[10px] font-bold text-[#007185]">+{(vendorProducts[v.id] || []).length - 5}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 mt-2">
                        <button onClick={() => { setOpen(false); navigate(`/shop/${encodeURIComponent(v.shop_name)}`); }}
                          className="flex-1 py-1.5 bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] text-[10px] font-bold text-[#0F1111] transition-colors text-center">
                          Visiter la boutique
                        </button>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(v.shop_name + ', ' + (v.city || 'Douala') + ', Cameroun')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="py-1.5 px-3 border border-[#D5D9D9] hover:border-[#FF9900] text-[10px] font-bold text-[#0F1111] transition-colors text-center bg-white">
                          <i className="fa-solid fa-route mr-1"></i>Itinéraire
                        </a>
                        {v.phone && (
                          <a href={`tel:${v.phone}`}
                            className="py-1.5 px-2 border border-[#D5D9D9] hover:border-[#007600] text-[10px] text-[#007600] transition-colors bg-white flex items-center">
                            <i className="fa-solid fa-phone text-[9px]"></i>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default OFSAssistant;
