import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const TAGS = [
  { label: "Sneakers", icon: "fa-shoe-prints", q: "sneakers" },
  { label: "Parfums",  icon: "fa-spray-can-sparkles", q: "parfum" },
  { label: "Tech",     icon: "fa-headphones", q: "ecouteur" },
  { label: "Sacs",     icon: "fa-bag-shopping", q: "sac" },
  { label: "Montres",  icon: "fa-clock", q: "montre" },
  { label: "Street",   icon: "fa-shirt", q: "shirt" },
];

const OFSAssistant = ({ addToCart }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorProducts, setVendorProducts] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeTag, setActiveTag] = useState(null);
  const [addedId, setAddedId] = useState(null);
  const inputRef = useRef(null);

  // Load all data once on first open
  useEffect(() => {
    if (!open || dataLoaded) return;
    const load = async () => {
      const [prodR, vendR] = await Promise.all([
        supabase.from('products')
          .select('id, name, price, img, type, description, vendor_id, cj_product_id, created_at, vendor:vendors!vendor_id(id, shop_name)')
          .order('created_at', { ascending: false }),
        supabase.from('vendors')
          .select('id, shop_name, full_name, city, phone, logo_url, category, member_discount_enabled, is_active')
          .eq('is_active', true)
          .order('shop_name'),
      ]);
      const prods = prodR.data || [];
      const vends = vendR.data || [];
      setAllProducts(prods);
      setVendors(vends);

      // Group products by vendor
      const vp = {};
      prods.forEach(p => {
        if (p.vendor_id) {
          if (!vp[p.vendor_id]) vp[p.vendor_id] = [];
          vp[p.vendor_id].push(p);
        }
      });
      setVendorProducts(vp);
      setDataLoaded(true);
    };
    load();
  }, [open, dataLoaded]);

  useEffect(() => {
    if (open && tab === 'search' && inputRef.current) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open, tab]);

  // Client-side search (same approach as SearchPage)
  const getFilteredProducts = () => {
    const q = (activeTag || query).trim().toLowerCase();
    if (!q) return allProducts.slice(0, 8); // Nouveautés
    const words = q.split(/\s+/).filter(Boolean);
    return allProducts.filter(p => {
      const name = (p.name || '').toLowerCase();
      const type = (p.type || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const shop = (p.vendor?.shop_name || '').toLowerCase();
      const haystack = `${name} ${type} ${desc} ${shop}`;
      return words.some(w => haystack.includes(w));
    }).slice(0, 12);
  };

  const filtered = getFilteredProducts();
  const isSearching = !!(activeTag || query.trim());

  const handleSearch = (e) => { e?.preventDefault(); setActiveTag(null); };
  const handleTag = (t) => { setActiveTag(activeTag === t.q ? null : t.q); setQuery(''); };
  const handleProductClick = (p) => { setOpen(false); navigate(`/product/${p.id}`); };

  const handleAddToCart = (p, e) => {
    e.stopPropagation();
    addToCart({ id: p.id, name: p.name, price: p.price, img: p.img, quantity: 1, selectedSize: null, selectedColor: null, vendor_id: p.vendor_id, cj_product_id: p.cj_product_id });
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1200);
  };

  const ProductGrid = ({ items, label }) => (
    <div>
      {label && <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#ADBAC7] mb-1.5">{label}</p>}
      <div className="grid grid-cols-2 gap-1.5">
        {items.map(p => (
          <div key={p.id} onClick={() => handleProductClick(p)}
            className="bg-[#FAFAFA] border border-[#EAEDED] rounded-lg overflow-hidden cursor-pointer hover:border-[#FF9900]/40 hover:shadow-sm transition-all group">
            <div className="relative aspect-square bg-[#F3F4F4]">
              {p.img
                ? <img src={p.img} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <div className="w-full h-full flex items-center justify-center text-[#D5D9D9]"><i className="fa-solid fa-image"></i></div>
              }
              <button onClick={(e) => handleAddToCart(p, e)}
                className={`absolute bottom-1 right-1 w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                  addedId === p.id ? 'bg-[#007600] text-white scale-110' : 'bg-[#FFD814]/90 text-[#0F1111] opacity-0 group-hover:opacity-100 hover:bg-[#F7CA00]'
                }`}>
                <i className={`fa-solid ${addedId === p.id ? 'fa-check' : 'fa-plus'} text-[8px]`}></i>
              </button>
            </div>
            <div className="px-1.5 py-1">
              <p className="text-[10px] font-medium text-[#0F1111] leading-tight line-clamp-2">{p.name}</p>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-[#B12704]">{Number(p.price).toLocaleString()} F</p>
                {p.vendor?.shop_name && <p className="text-[7px] text-[#007185] truncate max-w-[60px]">{p.vendor.shop_name}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className={`fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${
          open ? 'bg-[#0F1111] text-white rotate-45' : 'bg-[#FF9900] text-[#0F1111] hover:bg-[#FFB800]'
        }`}>
        <i className={`fa-solid ${open ? 'fa-plus' : 'fa-comment-dots'} text-lg`}></i>
      </button>

      {open && (
        <div className="fixed bottom-[4.5rem] left-6 z-50 w-[320px] max-w-[calc(100vw-3rem)] max-h-[65vh] bg-white rounded-2xl shadow-2xl border border-[#D5D9D9] flex flex-col overflow-hidden animate-[slideUp_0.2s_ease-out]">

          {/* Header */}
          <div className="bg-[#131921] px-4 py-2.5 flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 bg-[#FF9900] rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-sparkles text-[#0F1111] text-[10px]"></i>
            </div>
            <p className="text-white text-[11px] font-bold flex-1">OFS Assistant</p>
            <div className="flex bg-[#232F3E] rounded-lg p-0.5">
              {[{ key: 'search', icon: 'fa-magnifying-glass' }, { key: 'boutiques', icon: 'fa-store' }].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`w-7 h-6 rounded-md flex items-center justify-center text-[9px] transition-all ${
                    tab === t.key ? 'bg-[#FF9900] text-[#0F1111]' : 'text-[#565959] hover:text-white'
                  }`}>
                  <i className={`fa-solid ${t.icon}`}></i>
                </button>
              ))}
            </div>
            <button onClick={() => setOpen(false)} className="text-[#565959] hover:text-white transition ml-1">
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'search' ? (
              <div className="p-3 space-y-2.5">
                <form onSubmit={handleSearch} className="relative">
                  <input ref={inputRef} value={query}
                    onChange={e => { setQuery(e.target.value); setActiveTag(null); }}
                    placeholder="Je cherche…"
                    className="w-full pl-3 pr-8 py-2 bg-[#F3F4F4] border border-[#D5D9D9] focus:border-[#FF9900] focus:bg-white rounded-lg text-[11px] placeholder-[#ADBAC7] outline-none transition-all" />
                  {query && (
                    <button type="button" onClick={() => { setQuery(''); setActiveTag(null); }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-[#ADBAC7] hover:text-[#0F1111]">
                      <i className="fa-solid fa-xmark text-[8px]"></i>
                    </button>
                  )}
                </form>

                <div className="flex gap-1 overflow-x-auto hide-scrollbar pb-0.5">
                  {TAGS.map(t => (
                    <button key={t.q} onClick={() => handleTag(t)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold whitespace-nowrap border transition-all flex-shrink-0 ${
                        activeTag === t.q ? 'bg-[#FF9900]/10 border-[#FF9900]/40 text-[#B85C00]' : 'bg-[#F3F4F4] border-[#EAEDED] text-[#565959] hover:border-[#FF9900]/30'
                      }`}>
                      <i className={`fa-solid ${t.icon} text-[7px]`}></i>{t.label}
                    </button>
                  ))}
                </div>

                {!dataLoaded ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-[#FF9900] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : filtered.length > 0 ? (
                  <ProductGrid items={filtered}
                    label={isSearching ? `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}` : 'Nouveautés'} />
                ) : (
                  <div className="text-center py-4">
                    <i className="fa-solid fa-face-meh text-2xl text-[#D5D9D9] mb-1 block"></i>
                    <p className="text-[10px] font-bold text-[#565959]">Rien pour "{query || activeTag}"</p>
                  </div>
                )}

                {isSearching && filtered.length > 0 && (
                  <button onClick={() => { setOpen(false); navigate(`/search?q=${encodeURIComponent(query || activeTag)}`); }}
                    className="w-full py-1.5 text-[9px] font-black uppercase tracking-wider text-[#007185] hover:text-[#FF9900] transition-colors">
                    Tout voir <i className="fa-solid fa-arrow-right ml-0.5 text-[7px]"></i>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {!dataLoaded ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-[#FF9900] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : vendors.length === 0 ? (
                  <div className="text-center py-6">
                    <i className="fa-solid fa-store text-2xl text-[#D5D9D9] mb-1 block"></i>
                    <p className="text-[10px] font-bold text-[#565959]">Aucune boutique</p>
                  </div>
                ) : (
                  <>
                    <a href="https://www.google.com/maps/search/boutiques+mode+Douala+Cameroun"
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-[#232F3E] rounded-lg hover:bg-[#37475A] transition-colors">
                      <div className="w-7 h-7 bg-[#FF9900]/20 rounded-md flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-map-location-dot text-[#FF9900] text-[10px]"></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-[10px] font-bold">Carte des boutiques</p>
                        <p className="text-[8px] text-[#ADBAC7]">Voir autour de toi</p>
                      </div>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[#ADBAC7] text-[8px]"></i>
                    </a>

                    {vendors.map(v => {
                      const vProds = (vendorProducts[v.id] || []).slice(0, 4);
                      return (
                        <div key={v.id} className="bg-[#FAFAFA] border border-[#EAEDED] rounded-lg p-2 hover:border-[#FF9900]/30 transition-all">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-[#232F3E] rounded-md overflow-hidden flex items-center justify-center flex-shrink-0">
                              {v.logo_url
                                ? <img src={v.logo_url} alt="" className="w-full h-full object-cover" />
                                : <i className="fa-solid fa-store text-[#FF9900] text-[9px]"></i>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-[#0F1111] truncate">{v.shop_name}</p>
                              <div className="flex items-center gap-1.5 text-[8px] text-[#565959]">
                                <span><i className="fa-solid fa-location-dot text-[#FF9900] mr-0.5"></i>{v.city || 'Douala'}</span>
                                {v.category && <span className="text-[#007185]">{v.category}</span>}
                                {v.member_discount_enabled && <span className="text-[#007600] font-bold">-20%</span>}
                                <span className="text-[#ADBAC7]">{(vendorProducts[v.id] || []).length} article{(vendorProducts[v.id] || []).length !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>

                          {/* Product thumbnails */}
                          {vProds.length > 0 && (
                            <div className="flex gap-1 mt-1.5">
                              {vProds.map(p => (
                                <div key={p.id} onClick={() => handleProductClick(p)}
                                  className="w-10 h-10 rounded-md overflow-hidden bg-[#F3F4F4] border border-[#EAEDED] cursor-pointer hover:border-[#FF9900]/40 transition-all flex-shrink-0">
                                  {p.img
                                    ? <img src={p.img} alt="" className="w-full h-full object-cover" loading="lazy" />
                                    : <div className="w-full h-full flex items-center justify-center text-[#D5D9D9] text-[7px]"><i className="fa-solid fa-image"></i></div>
                                  }
                                </div>
                              ))}
                              {(vendorProducts[v.id] || []).length > 4 && (
                                <div onClick={() => { setOpen(false); navigate(`/shop/${encodeURIComponent(v.shop_name)}`); }}
                                  className="w-10 h-10 rounded-md bg-[#F3F4F4] border border-[#EAEDED] flex items-center justify-center cursor-pointer hover:border-[#FF9900]/40 transition-all flex-shrink-0">
                                  <span className="text-[8px] font-bold text-[#565959]">+{(vendorProducts[v.id] || []).length - 4}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex gap-1 mt-1.5">
                            <button onClick={() => { setOpen(false); navigate(`/shop/${encodeURIComponent(v.shop_name)}`); }}
                              className="flex-1 py-1 bg-[#FFD814] hover:bg-[#F7CA00] rounded-md text-[8px] font-black text-[#0F1111] uppercase tracking-wider transition-colors">
                              <i className="fa-solid fa-bag-shopping mr-0.5"></i>Voir
                            </button>
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(v.shop_name + ', ' + (v.city || 'Douala') + ', Cameroun')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex-1 py-1 bg-[#232F3E] hover:bg-[#37475A] rounded-md text-[8px] font-black text-white uppercase tracking-wider text-center transition-colors">
                              <i className="fa-solid fa-route mr-0.5"></i>Y aller
                            </a>
                            {v.phone && (
                              <a href={`tel:${v.phone}`} className="w-6 py-1 bg-[#007600] hover:bg-[#005c00] rounded-md flex items-center justify-center flex-shrink-0">
                                <i className="fa-solid fa-phone text-white text-[7px]"></i>
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-1 px-3 py-2 bg-[#F3F4F4] border-t border-[#EAEDED] flex-shrink-0">
            {[
              { icon: 'fa-shop', label: 'Catalogue', to: '/store' },
              { icon: 'fa-ranking-star', label: 'Top', to: '/boutiques' },
              { icon: 'fa-gift', label: 'Rewards', to: '/rewards' },
            ].map(a => (
              <button key={a.to} onClick={() => { setOpen(false); navigate(a.to); }}
                className="flex-1 py-1.5 bg-white border border-[#D5D9D9] hover:border-[#FF9900]/40 rounded-md text-[8px] font-bold text-[#565959] hover:text-[#FF9900] transition-all">
                <i className={`fa-solid ${a.icon} mr-0.5`}></i>{a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
    </>
  );
};

export default OFSAssistant;
