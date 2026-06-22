import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const CATS = [
  { label: "Tout",       q: "", icon: "fa-fire" },
  { label: "Sneakers",   q: "sneakers", icon: "fa-shoe-prints" },
  { label: "Parfums",    q: "parfum", icon: "fa-spray-can-sparkles" },
  { label: "Tech",       q: "ecouteur", icon: "fa-headphones" },
  { label: "Sacs",       q: "sac", icon: "fa-bag-shopping" },
  { label: "Montres",    q: "montre", icon: "fa-clock" },
  { label: "Mode",       q: "shirt", icon: "fa-shirt" },
];

const OFSAssistant = ({ addToCart }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorProducts, setVendorProducts] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeCat, setActiveCat] = useState('');
  const [addedId, setAddedId] = useState(null);
  const [section, setSection] = useState('products');
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
    const q = (query || activeCat).trim().toLowerCase();
    if (!q) return allProducts.slice(0, 30);
    const words = q.split(/\s+/).filter(Boolean);
    return allProducts.filter(p => {
      const hay = `${p.name || ''} ${p.type || ''} ${p.description || ''} ${p.vendor?.shop_name || ''}`.toLowerCase();
      return words.some(w => hay.includes(w));
    }).slice(0, 30);
  };

  const filtered = getFiltered();

  const handleProductClick = (p) => { setOpen(false); navigate(`/product/${p.id}`); };
  const handleAddToCart = (p, e) => {
    e.stopPropagation();
    addToCart({ id: p.id, name: p.name, price: p.price, img: p.img, quantity: 1, selectedSize: null, selectedColor: null, vendor_id: p.vendor_id, cj_product_id: p.cj_product_id });
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1000);
  };

  return (
    <>
      {/* Trigger button — small, subtle */}
      <button onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-50 w-10 h-10 bg-[#232F3E] hover:bg-[#37475A] text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95">
        <i className="fa-solid fa-magnifying-glass text-[13px]"></i>
      </button>

      {/* Full overlay */}
      {open && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-white">

          {/* Top bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#E7E7E7] flex-shrink-0 bg-white">
            <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center text-[#565959] hover:text-[#0F1111] transition">
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </button>
            <div className="flex-1 relative">
              <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[#FF9900] text-xs"></i>
              <input ref={inputRef} value={query}
                onChange={e => { setQuery(e.target.value); setActiveCat(''); setSection('products'); }}
                placeholder="Rechercher sur OFS"
                className="w-full pl-8 pr-8 py-2 border border-[#D5D9D9] focus:border-[#FF9900] rounded text-[13px] outline-none bg-[#F7F8F8] focus:bg-white transition" />
              {query && (
                <button onClick={() => { setQuery(''); setActiveCat(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#ADBAC7] hover:text-[#0F1111]">
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              )}
            </div>
          </div>

          {/* Section toggle */}
          <div className="flex border-b border-[#E7E7E7] flex-shrink-0 bg-white">
            {[
              { key: 'products', label: 'Produits', count: filtered.length },
              { key: 'boutiques', label: 'Boutiques', count: vendors.length },
            ].map(s => (
              <button key={s.key} onClick={() => setSection(s.key)}
                className={`flex-1 py-2 text-[11px] font-bold border-b-2 transition-all ${
                  section === s.key
                    ? 'text-[#0F1111] border-[#FF9900]'
                    : 'text-[#565959] border-transparent hover:text-[#0F1111]'
                }`}>
                {s.label} <span className="text-[#ADBAC7] ml-0.5">({s.count})</span>
              </button>
            ))}
          </div>

          {/* Categories row (products only) */}
          {section === 'products' && (
            <div className="flex gap-1.5 px-4 py-2 overflow-x-auto hide-scrollbar border-b border-[#F3F4F4] flex-shrink-0 bg-[#FAFAFA]">
              {CATS.map(c => (
                <button key={c.q} onClick={() => { setActiveCat(c.q); setQuery(''); }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold whitespace-nowrap border transition-all flex-shrink-0 ${
                    activeCat === c.q
                      ? 'bg-[#131921] text-white border-[#131921]'
                      : 'bg-white text-[#565959] border-[#D5D9D9] hover:border-[#131921]'
                  }`}>
                  <i className={`fa-solid ${c.icon} text-[8px]`}></i>{c.label}
                </button>
              ))}
            </div>
          )}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto bg-white">
            {!dataLoaded ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-[3px] border-[#FF9900] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : section === 'products' ? (
              <>
                {filtered.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <p className="text-[13px] text-[#565959]">Aucun résultat pour <strong>"{query || activeCat}"</strong></p>
                    <p className="text-[11px] text-[#ADBAC7] mt-1">Essaie d'autres mots-clés</p>
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

                {filtered.length > 0 && (query || activeCat) && (
                  <button onClick={() => { setOpen(false); navigate(`/search?q=${encodeURIComponent(query || activeCat)}`); }}
                    className="w-full py-3 text-[12px] font-bold text-[#007185] hover:text-[#FF9900] border-t border-[#E7E7E7] transition-colors">
                    Voir tous les résultats <i className="fa-solid fa-chevron-right ml-1 text-[9px]"></i>
                  </button>
                )}
              </>
            ) : (
              /* Boutiques */
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

                      {/* Product thumbnails row */}
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

                      {/* Actions */}
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
