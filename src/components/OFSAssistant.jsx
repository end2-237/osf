import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.1-8b-instant';

const OFS_CATEGORIES = [
  "Audio Lab", "Tech Lab", "Clothing", "Shoes", "Femme", "Beauté",
  "Accessories", "Maison", "Sport", "Bébé & Enfants", "Auto",
];

const SYSTEM_PROMPT = `Tu es l'assistant shopping OFS (OneFreestyle Store), une marketplace camerounaise.
L'utilisateur décrit ce qu'il cherche avec ses propres mots. Tu dois analyser sa demande et extraire les informations de recherche.

Catégories disponibles: ${OFS_CATEGORIES.join(', ')}

Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication:
{
  "keywords": ["mot1", "mot2", "mot3"],
  "categories": ["Cat1", "Cat2"],
  "styles": ["attribut1", "attribut2"],
  "summary": "Courte phrase décrivant ce que l'utilisateur cherche"
}

Règles:
- keywords: 3-8 mots-clés de produits pertinents (noms, types, marques possibles)
- categories: 1-3 catégories OFS les plus pertinentes parmi la liste
- styles: couleurs, matériaux, occasions, attributs (ex: "vert", "cuir", "soirée", "sport", "pas cher")
- summary: 1 phrase courte en français
- Sois créatif: "un truc pour nager" → keywords: ["maillot", "short de bain", "lunettes", "natation", "plage"]
- "cadeau copine" → keywords: ["parfum", "bijou", "sac", "montre", "robe"], categories: ["Beauté", "Accessories", "Femme"]`;

async function askGroq(userMessage) {
  if (!GROQ_KEY) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const PROMPTS = [
  { text: "Un cadeau pour ma copine", icon: "fa-gift" },
  { text: "Des sneakers confortables", icon: "fa-shoe-prints" },
  { text: "Un truc pour la piscine", icon: "fa-water-ladder" },
  { text: "Un parfum homme classe", icon: "fa-spray-can-sparkles" },
  { text: "Équipement pour la salle", icon: "fa-dumbbell" },
  { text: "Une montre pas chère", icon: "fa-clock" },
  { text: "Un casque bluetooth", icon: "fa-headphones" },
  { text: "Tenue pour une soirée", icon: "fa-champagne-glasses" },
];

const OFSAssistant = ({ addToCart }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorMap, setVendorMap] = useState({});
  const [vendorProducts, setVendorProducts] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [addedId, setAddedId] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [results, setResults] = useState([]);
  const [showBoutiques, setShowBoutiques] = useState(false);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (!open || dataLoaded) return;
    const load = async () => {
      const [prodR, vendR] = await Promise.all([
        supabase.from('products')
          .select('id, name, price, img, type, description, vendor_id, cj_product_id, created_at')
          .order('created_at', { ascending: false }),
        supabase.from('vendors')
          .select('*')
          .order('shop_name'),
      ]);
      const prods = prodR.data || [];
      let vends = vendR.data || [];
      console.log('[OFS Assistant] vendors:', vends.length, 'products:', prods.length, 'vendErr:', vendR.error);
      // Fallback: if RLS blocks vendors table, build from product join
      if (vends.length === 0 && prods.length > 0) {
        const vendorIds = [...new Set(prods.map(p => p.vendor_id).filter(Boolean))];
        if (vendorIds.length > 0) {
          const { data: fallbackV } = await supabase.from('vendors').select('*').in('id', vendorIds);
          vends = fallbackV || [];
          console.log('[OFS Assistant] fallback vendors:', vends.length);
        }
      }
      const vm = {};
      vends.forEach(v => { vm[v.id] = v; });
      setAllProducts(prods);
      setVendors(vends);
      setVendorMap(vm);
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

  const scoreProducts = (ai) => {
    if (!ai) return [];
    const allTerms = [...(ai.keywords || []), ...(ai.styles || [])].map(t => t.toLowerCase());
    const cats = (ai.categories || []).map(c => c.toLowerCase());

    const scored = allProducts.map(p => {
      const name = (p.name || '').toLowerCase();
      const type = (p.type || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const shop = (vendorMap[p.vendor_id]?.shop_name || '').toLowerCase();
      const hay = `${name} ${type} ${desc} ${shop}`;

      let score = 0;
      for (const term of allTerms) {
        if (name.includes(term)) score += 5;
        else if (type.includes(term)) score += 3;
        else if (desc.includes(term)) score += 1;
      }
      if (cats.some(c => type.includes(c))) score += 4;

      return { ...p, _score: score };
    }).filter(p => p._score > 0);

    scored.sort((a, b) => b._score - a._score);
    return scored.slice(0, 40);
  };

  const doSearch = async (text) => {
    const q = text || query;
    if (!q.trim()) return;
    setThinking(true);
    setAiResult(null);
    setResults([]);
    setShowBoutiques(false);

    const ai = await askGroq(q);
    if (ai) {
      setAiResult(ai);
      const scored = scoreProducts(ai);
      setResults(scored);
    } else {
      // Fallback: simple text search if Groq fails
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      const fallback = allProducts.filter(p => {
        const hay = `${p.name || ''} ${p.type || ''} ${p.description || ''} ${vendorMap[p.vendor_id]?.shop_name || ''}`.toLowerCase();
        return words.some(w => hay.includes(w));
      }).slice(0, 40);
      setResults(fallback);
      setAiResult({ summary: `Résultats pour "${q}"`, keywords: words, categories: [], styles: [] });
    }
    setThinking(false);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSubmit = (e) => { e?.preventDefault(); doSearch(); };
  const handlePrompt = (text) => { setQuery(text); doSearch(text); };
  const handleProductClick = (p) => { setOpen(false); navigate(`/product/${p.id}`); };
  const handleAddToCart = (p, e) => {
    e.stopPropagation();
    addToCart({ id: p.id, name: p.name, price: p.price, img: p.img, quantity: 1, selectedSize: null, selectedColor: null, vendor_id: p.vendor_id, cj_product_id: p.cj_product_id });
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1000);
  };
  const reset = () => { setQuery(''); setResults([]); setAiResult(null); setShowBoutiques(false); };

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
            <button onClick={() => { setOpen(false); reset(); }} className="w-8 h-8 flex items-center justify-center text-[#565959] hover:text-[#0F1111]">
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </button>
            <form onSubmit={handleSubmit} className="flex-1 relative">
              <i className="fa-solid fa-sparkles absolute left-2.5 top-1/2 -translate-y-1/2 text-[#FF9900] text-xs"></i>
              <input ref={inputRef} value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Décris ce que tu veux…"
                className="w-full pl-8 pr-20 py-2 border border-[#D5D9D9] focus:border-[#FF9900] text-[13px] outline-none bg-[#F7F8F8] focus:bg-white transition" />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {query && (
                  <button type="button" onClick={reset} className="w-6 h-6 flex items-center justify-center text-[#ADBAC7] hover:text-[#0F1111]">
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
                )}
                <button type="submit" disabled={thinking || !query.trim()}
                  className="h-7 px-2.5 bg-[#FF9900] hover:bg-[#FFB800] disabled:bg-[#E7E7E7] flex items-center justify-center text-[#0F1111] text-[10px] font-bold transition-colors">
                  {thinking ? <i className="fa-solid fa-spinner fa-spin text-[10px]"></i> : 'Trouver'}
                </button>
              </div>
            </form>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {!dataLoaded ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-[3px] border-[#FF9900] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : showBoutiques ? (
              /* ─── BOUTIQUES ─── */
              <div>
                <div className="flex items-center gap-2 px-4 py-2 bg-[#FAFAFA] border-b border-[#E7E7E7]">
                  <button onClick={() => setShowBoutiques(false)} className="text-[10px] font-bold text-[#007185] hover:text-[#FF9900]">
                    <i className="fa-solid fa-arrow-left mr-1"></i>Retour
                  </button>
                  <span className="text-[10px] text-[#565959]">{vendors.length} boutiques</span>
                </div>
                <div className="divide-y divide-[#E7E7E7]">
                  {vendors.map(v => {
                    const vProds = (vendorProducts[v.id] || []).slice(0, 5);
                    return (
                      <div key={v.id} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#F7F8F8] border border-[#E7E7E7] overflow-hidden flex items-center justify-center flex-shrink-0">
                            {v.logo_url ? <img src={v.logo_url} alt="" className="w-full h-full object-cover" />
                              : <i className="fa-solid fa-store text-[#ADBAC7] text-sm"></i>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-[#0F1111] truncate">{v.shop_name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-[#565959]">
                              <span>{v.city || 'Douala'}</span>
                              {v.category && <span>· {v.category}</span>}
                              <span>· {(vendorProducts[v.id] || []).length} articles</span>
                              {v.member_discount_enabled && <span className="text-[#007600] font-bold">-20%</span>}
                            </div>
                          </div>
                        </div>
                        {vProds.length > 0 && (
                          <div className="flex gap-1.5 mt-2 overflow-x-auto hide-scrollbar">
                            {vProds.map(p => (
                              <div key={p.id} onClick={() => handleProductClick(p)}
                                className="w-14 h-14 flex-shrink-0 bg-[#F7F8F8] border border-[#E7E7E7] overflow-hidden cursor-pointer hover:border-[#FF9900] transition-all">
                                {p.img ? <img src={p.img} alt="" className="w-full h-full object-cover" loading="lazy" />
                                  : <div className="w-full h-full flex items-center justify-center text-[#E7E7E7]"><i className="fa-solid fa-image text-[10px]"></i></div>}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => { setOpen(false); navigate(`/shop/${encodeURIComponent(v.shop_name)}`); }}
                            className="flex-1 py-1.5 bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] text-[10px] font-bold text-[#0F1111] text-center">Visiter</button>
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(v.shop_name + ', ' + (v.city || 'Douala') + ', Cameroun')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="py-1.5 px-3 border border-[#D5D9D9] hover:border-[#FF9900] text-[10px] font-bold text-[#0F1111] bg-white text-center">
                            <i className="fa-solid fa-route mr-1"></i>Y aller</a>
                          {v.phone && (
                            <a href={`tel:${v.phone}`} className="py-1.5 px-2 border border-[#D5D9D9] hover:border-[#007600] text-[10px] text-[#007600] bg-white flex items-center">
                              <i className="fa-solid fa-phone text-[9px]"></i></a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                {/* ─── LANDING ─── */}
                <div className="px-4 py-5">
                  <div className="text-center mb-5">
                    <div className="w-12 h-12 bg-[#FFF8F0] border border-[#FFE0B2] flex items-center justify-center mx-auto mb-2">
                      <i className="fa-solid fa-sparkles text-[#FF9900] text-lg"></i>
                    </div>
                    <h2 className="text-[14px] font-bold text-[#0F1111]">Décris ce que tu veux</h2>
                    <p className="text-[11px] text-[#565959] mt-0.5">L'IA analyse ta demande et trouve les meilleurs produits</p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 mb-4">
                    {PROMPTS.map(p => (
                      <button key={p.text} onClick={() => handlePrompt(p.text)} disabled={thinking}
                        className="flex items-center gap-2 px-2.5 py-2.5 text-left border border-[#E7E7E7] hover:border-[#FF9900] hover:bg-[#FFF8F0] transition-all group disabled:opacity-50">
                        <div className="w-7 h-7 bg-[#F7F8F8] group-hover:bg-[#FF9900]/10 flex items-center justify-center flex-shrink-0 transition-colors">
                          <i className={`fa-solid ${p.icon} text-[10px] text-[#565959] group-hover:text-[#FF9900] transition-colors`}></i>
                        </div>
                        <span className="text-[10px] text-[#0F1111] leading-snug">{p.text}</span>
                      </button>
                    ))}
                  </div>

                  <button onClick={() => setShowBoutiques(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 border border-[#E7E7E7] hover:border-[#FF9900] transition-all mb-4">
                    <div className="w-7 h-7 bg-[#F7F8F8] flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-store text-[10px] text-[#565959]"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[11px] font-bold text-[#0F1111]">Boutiques</p>
                      <p className="text-[9px] text-[#565959]">{vendors.length} vendeurs · Adresses & itinéraires</p>
                    </div>
                    <i className="fa-solid fa-chevron-right text-[9px] text-[#ADBAC7]"></i>
                  </button>
                </div>

                {/* ─── THINKING ─── */}
                {thinking && (
                  <div className="px-4 pb-4">
                    <div className="flex items-start gap-3 p-3 bg-[#FFF8F0] border border-[#FFE0B2]">
                      <div className="w-7 h-7 bg-[#FF9900]/10 flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-spinner fa-spin text-[#FF9900] text-[10px]"></i>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[#B85C00]">Analyse en cours…</p>
                        <p className="text-[10px] text-[#565959]">Je comprends ta demande et cherche les meilleurs produits</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── AI RESPONSE + RESULTS ─── */}
                {aiResult && !thinking && (
                  <div ref={resultsRef}>
                    {/* AI understanding card */}
                    <div className="px-4 pb-3">
                      <div className="p-3 bg-[#F7F8F8] border border-[#E7E7E7]">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="w-6 h-6 bg-[#FF9900]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <i className="fa-solid fa-sparkles text-[#FF9900] text-[9px]"></i>
                          </div>
                          <p className="text-[12px] text-[#0F1111]"><span className="font-bold">OFS</span> — {aiResult.summary}</p>
                        </div>
                        <div className="flex flex-wrap gap-1 ml-8">
                          {(aiResult.keywords || []).map(k => (
                            <span key={k} className="px-1.5 py-0.5 bg-white border border-[#E7E7E7] text-[9px] text-[#565959]">{k}</span>
                          ))}
                          {(aiResult.styles || []).map(s => (
                            <span key={s} className="px-1.5 py-0.5 bg-[#FF9900]/5 border border-[#FF9900]/20 text-[9px] text-[#B85C00]">{s}</span>
                          ))}
                          {(aiResult.categories || []).map(c => (
                            <span key={c} className="px-1.5 py-0.5 bg-[#007185]/5 border border-[#007185]/20 text-[9px] text-[#007185]">{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Results header */}
                    <div className="flex items-center justify-between px-4 py-1.5 bg-[#FAFAFA] border-y border-[#E7E7E7]">
                      <span className="text-[10px] text-[#565959]">{results.length} produit{results.length !== 1 ? 's' : ''} trouvé{results.length !== 1 ? 's' : ''}</span>
                      <button onClick={() => setShowBoutiques(true)} className="text-[10px] font-bold text-[#007185] hover:text-[#FF9900]">
                        Boutiques <i className="fa-solid fa-store ml-0.5 text-[8px]"></i>
                      </button>
                    </div>

                    {results.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <i className="fa-solid fa-box-open text-3xl text-[#E7E7E7] mb-2 block"></i>
                        <p className="text-[12px] font-bold text-[#0F1111]">Aucun produit trouvé</p>
                        <p className="text-[11px] text-[#565959] mt-1">Essaie de décrire autrement</p>
                        <button onClick={reset} className="mt-3 px-4 py-1.5 bg-[#FFD814] hover:bg-[#F7CA00] text-[10px] font-bold text-[#0F1111] border border-[#FCD200]">
                          Nouvelle recherche
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px bg-[#E7E7E7]">
                          {results.map(p => (
                            <div key={p.id} onClick={() => handleProductClick(p)}
                              className="bg-white cursor-pointer hover:bg-[#FAFAFA] transition-colors group relative">
                              <div className="aspect-square bg-[#F7F8F8] relative overflow-hidden">
                                {p.img
                                  ? <img src={p.img} alt="" className="w-full h-full object-cover" loading="lazy" />
                                  : <div className="w-full h-full flex items-center justify-center text-[#E7E7E7]"><i className="fa-solid fa-image text-xl"></i></div>}
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
                                {vendorMap[p.vendor_id]?.shop_name && <p className="text-[9px] text-[#007185] mt-0.5">{vendorMap[p.vendor_id].shop_name}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => { setOpen(false); navigate(`/search?q=${encodeURIComponent(query)}`); }}
                          className="w-full py-3 text-[12px] font-bold text-[#007185] hover:text-[#FF9900] border-t border-[#E7E7E7]">
                          Voir tous les résultats <i className="fa-solid fa-chevron-right ml-1 text-[9px]"></i>
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* ─── TRENDING (visible before any search) ─── */}
                {!aiResult && !thinking && allProducts.length > 0 && (
                  <div className="border-t border-[#E7E7E7]">
                    <div className="px-4 py-2 bg-[#FAFAFA] border-b border-[#E7E7E7]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959]">Nouveautés</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px bg-[#E7E7E7]">
                      {allProducts.slice(0, 8).map(p => (
                        <div key={p.id} onClick={() => handleProductClick(p)}
                          className="bg-white cursor-pointer hover:bg-[#FAFAFA] transition-colors group relative">
                          <div className="aspect-square bg-[#F7F8F8] relative overflow-hidden">
                            {p.img
                              ? <img src={p.img} alt="" className="w-full h-full object-cover" loading="lazy" />
                              : <div className="w-full h-full flex items-center justify-center text-[#E7E7E7]"><i className="fa-solid fa-image text-xl"></i></div>}
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
                            {vendorMap[p.vendor_id]?.shop_name && <p className="text-[9px] text-[#007185] mt-0.5">{vendorMap[p.vendor_id].shop_name}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setOpen(false); navigate('/store'); }}
                      className="w-full py-2.5 text-[11px] font-bold text-[#007185] hover:text-[#FF9900] transition-colors">
                      Voir tout le catalogue <i className="fa-solid fa-chevron-right ml-1 text-[8px]"></i>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default OFSAssistant;
