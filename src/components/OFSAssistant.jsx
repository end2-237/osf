import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const OFSAssistant = ({ addToCart }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loadingP, setLoadingP] = useState(false);
  const [loadingV, setLoadingV] = useState(false);
  const [suggestions] = useState([
    "Sneakers homme", "Parfum femme", "Écouteurs bluetooth",
    "Sac à dos", "Montre", "T-shirt streetwear"
  ]);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (open && tab === 'boutiques' && vendors.length === 0) {
      setLoadingV(true);
      supabase.from('vendors').select('id, shop_name, full_name, city, phone, logo_url, category, member_discount_enabled, is_active')
        .eq('is_active', true)
        .order('shop_name')
        .then(({ data }) => { setVendors(data || []); setLoadingV(false); });
    }
  }, [open, tab]);

  useEffect(() => {
    if (open && tab === 'search' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, tab]);

  const searchProducts = async (q) => {
    if (!q.trim()) { setProducts([]); return; }
    setLoadingP(true);
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let qb = supabase.from('products').select('id, name, price, img, type, vendor_id, cj_product_id').limit(20);
    for (const w of words.slice(0, 3)) {
      qb = qb.or(`name.ilike.%${w}%,type.ilike.%${w}%,description.ilike.%${w}%`);
    }
    const { data } = await qb;
    setProducts(data || []);
    setLoadingP(false);
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    searchProducts(query);
  };

  const handleSuggestion = (s) => {
    setQuery(s);
    searchProducts(s);
  };

  const handleProductClick = (p) => {
    setOpen(false);
    navigate(`/product/${p.id}`);
  };

  const handleAddToCart = (p, e) => {
    e.stopPropagation();
    addToCart({
      id: p.id, name: p.name, price: p.price, img: p.img,
      quantity: 1, selectedSize: null, selectedColor: null,
      vendor_id: p.vendor_id, cj_product_id: p.cj_product_id,
    });
  };

  const getDirectionsUrl = (v) => {
    const city = v.city || 'Douala';
    const name = encodeURIComponent(`${v.shop_name}, ${city}, Cameroun`);
    return `https://www.google.com/maps/dir/?api=1&destination=${name}`;
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${
          open
            ? 'bg-[#0F1111] text-white rotate-45'
            : 'bg-[#FF9900] text-[#0F1111] hover:bg-[#FFB800]'
        }`}
        aria-label="Assistant OFS"
      >
        <i className={`fa-solid ${open ? 'fa-plus' : 'fa-comment-dots'} text-xl`}></i>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 left-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-[#D5D9D9] flex flex-col overflow-hidden animate-[slideUp_0.25s_ease-out]" ref={panelRef}>

          {/* Header */}
          <div className="bg-[#131921] px-5 py-4 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 bg-[#FF9900] rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-sparkles text-[#0F1111] text-sm"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[#FF9900]">OFS Assistant</p>
              <p className="text-white text-sm font-bold leading-tight">Comment puis-je t'aider ?</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#565959] hover:text-white transition">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#EAEDED] flex-shrink-0">
            {[
              { key: 'search', icon: 'fa-magnifying-glass', label: 'Recherche' },
              { key: 'boutiques', icon: 'fa-store', label: 'Boutiques' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border-b-2 ${
                  tab === t.key
                    ? 'text-[#FF9900] border-[#FF9900] bg-[#FFF8F0]'
                    : 'text-[#565959] border-transparent hover:text-[#0F1111]'
                }`}
              >
                <i className={`fa-solid ${t.icon} text-[9px]`}></i>
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'search' ? (
              <div className="p-4 space-y-3">
                {/* Search input */}
                <form onSubmit={handleSearch} className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#FF9900] text-xs"></i>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch(e)}
                    placeholder="Décris ce que tu cherches…"
                    className="w-full pl-9 pr-10 py-2.5 bg-[#F3F4F4] border border-[#D5D9D9] focus:border-[#FF9900] focus:bg-white rounded-xl text-sm placeholder-[#ADBAC7] outline-none transition-all"
                  />
                  <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-[#FF9900] hover:bg-[#FFB800] rounded-lg flex items-center justify-center transition-colors">
                    <i className="fa-solid fa-arrow-right text-[#0F1111] text-[10px]"></i>
                  </button>
                </form>

                {/* Suggestions */}
                {products.length === 0 && !query && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#ADBAC7] mb-2">Suggestions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map(s => (
                        <button
                          key={s}
                          onClick={() => handleSuggestion(s)}
                          className="px-3 py-1.5 bg-[#F3F4F4] hover:bg-[#FF9900]/10 border border-[#D5D9D9] hover:border-[#FF9900]/30 rounded-full text-[11px] text-[#565959] hover:text-[#0F1111] font-medium transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading */}
                {loadingP && (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-3 border-[#FF9900] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}

                {/* Results */}
                {!loadingP && products.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#ADBAC7] mb-2">
                      {products.length} résultat{products.length > 1 ? 's' : ''}
                    </p>
                    <div className="space-y-2">
                      {products.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleProductClick(p)}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#F3F4F4] cursor-pointer transition-colors group"
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#F3F4F4] flex-shrink-0 border border-[#EAEDED]">
                            {p.img ? (
                              <img src={p.img} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#D5D9D9]">
                                <i className="fa-solid fa-image text-sm"></i>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#0F1111] truncate">{p.name}</p>
                            <p className="text-xs text-[#B12704] font-bold">{Number(p.price).toLocaleString()} FCFA</p>
                          </div>
                          <button
                            onClick={(e) => handleAddToCart(p, e)}
                            className="w-8 h-8 bg-[#FFD814] hover:bg-[#F7CA00] rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                            title="Ajouter au panier"
                          >
                            <i className="fa-solid fa-cart-plus text-[10px] text-[#0F1111]"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => { setOpen(false); navigate(`/search?q=${encodeURIComponent(query)}`); }}
                      className="w-full mt-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#007185] hover:text-[#FF9900] transition-colors"
                    >
                      Voir tous les résultats <i className="fa-solid fa-arrow-right ml-1"></i>
                    </button>
                  </div>
                )}

                {/* No results */}
                {!loadingP && query && products.length === 0 && (
                  <div className="text-center py-6">
                    <i className="fa-solid fa-face-meh text-3xl text-[#D5D9D9] mb-2 block"></i>
                    <p className="text-sm font-bold text-[#565959]">Aucun résultat pour "{query}"</p>
                    <p className="text-[11px] text-[#ADBAC7] mt-1">Essaie avec d'autres mots</p>
                  </div>
                )}
              </div>
            ) : (
              /* Boutiques tab */
              <div className="p-4 space-y-3">
                {loadingV ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-3 border-[#FF9900] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : vendors.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fa-solid fa-store text-3xl text-[#D5D9D9] mb-2 block"></i>
                    <p className="text-sm font-bold text-[#565959]">Aucune boutique</p>
                  </div>
                ) : (
                  <>
                    {/* Map CTA */}
                    <a
                      href="https://www.google.com/maps/search/boutiques+mode+Douala+Cameroun"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-[#232F3E] rounded-xl hover:bg-[#37475A] transition-colors group"
                    >
                      <div className="w-10 h-10 bg-[#FF9900]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-map-location-dot text-[#FF9900] text-sm"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold">Voir la carte</p>
                        <p className="text-[10px] text-[#ADBAC7]">Toutes les boutiques autour de toi</p>
                      </div>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[#ADBAC7] group-hover:text-[#FF9900] text-xs transition-colors"></i>
                    </a>

                    {/* Vendor list */}
                    <div className="space-y-2">
                      {vendors.map(v => (
                        <div key={v.id} className="bg-[#FAFAFA] border border-[#EAEDED] rounded-xl p-3 hover:border-[#FF9900]/30 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#232F3E] rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                              {v.logo_url ? (
                                <img src={v.logo_url} alt={v.shop_name} className="w-full h-full object-cover" />
                              ) : (
                                <i className="fa-solid fa-store text-[#FF9900] text-sm"></i>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-[#0F1111] truncate">{v.shop_name}</p>
                              <div className="flex items-center gap-2 text-[10px] text-[#565959]">
                                <span><i className="fa-solid fa-location-dot text-[#FF9900] mr-0.5"></i>{v.city || 'Douala'}</span>
                                {v.category && <span className="text-[#007185]">{v.category}</span>}
                                {v.member_discount_enabled && (
                                  <span className="text-[#007600]"><i className="fa-solid fa-tag mr-0.5"></i>-20%</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 mt-2.5">
                            <button
                              onClick={() => { setOpen(false); navigate(`/shop/${encodeURIComponent(v.shop_name)}`); }}
                              className="flex-1 py-1.5 bg-[#FFD814] hover:bg-[#F7CA00] rounded-lg text-[10px] font-black text-[#0F1111] uppercase tracking-wider transition-colors"
                            >
                              <i className="fa-solid fa-bag-shopping mr-1"></i>Voir
                            </button>
                            <a
                              href={getDirectionsUrl(v)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-1.5 bg-[#232F3E] hover:bg-[#37475A] rounded-lg text-[10px] font-black text-white uppercase tracking-wider text-center transition-colors"
                            >
                              <i className="fa-solid fa-route mr-1"></i>Itinéraire
                            </a>
                            {v.phone && (
                              <a
                                href={`tel:${v.phone}`}
                                className="w-8 py-1.5 bg-[#007600] hover:bg-[#005c00] rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                                title="Appeler"
                              >
                                <i className="fa-solid fa-phone text-white text-[10px]"></i>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer quick actions */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[#F3F4F4] border-t border-[#EAEDED] flex-shrink-0">
            <button
              onClick={() => { setOpen(false); navigate('/store'); }}
              className="flex-1 py-2 bg-white border border-[#D5D9D9] hover:border-[#FF9900]/40 rounded-lg text-[10px] font-bold text-[#565959] hover:text-[#FF9900] transition-all"
            >
              <i className="fa-solid fa-shop mr-1"></i>Catalogue
            </button>
            <button
              onClick={() => { setOpen(false); navigate('/boutiques'); }}
              className="flex-1 py-2 bg-white border border-[#D5D9D9] hover:border-[#FF9900]/40 rounded-lg text-[10px] font-bold text-[#565959] hover:text-[#FF9900] transition-all"
            >
              <i className="fa-solid fa-ranking-star mr-1"></i>Classement
            </button>
            <button
              onClick={() => { setOpen(false); navigate('/rewards'); }}
              className="flex-1 py-2 bg-white border border-[#D5D9D9] hover:border-[#FF9900]/40 rounded-lg text-[10px] font-bold text-[#565959] hover:text-[#FF9900] transition-all"
            >
              <i className="fa-solid fa-gift mr-1"></i>Rewards
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
};

export default OFSAssistant;
