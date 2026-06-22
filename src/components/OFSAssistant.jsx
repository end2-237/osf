import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Intent mapping: natural phrases → product keywords + categories
const INTENT_MAP = [
  { triggers: ["nager", "nage", "piscine", "swim", "plage", "mer"], keywords: ["natation", "maillot", "swim", "plage", "aqua"], label: "Natation & Plage" },
  { triggers: ["courir", "course", "running", "jogging", "marathon"], keywords: ["running", "sport", "fitness", "course"], label: "Running" },
  { triggers: ["musculation", "muscu", "gym", "fitness", "sport"], keywords: ["fitness", "sport", "gym", "training", "musculation"], label: "Fitness" },
  { triggers: ["cadeau", "offrir", "anniversaire", "noel", "fete"], keywords: ["cadeau", "coffret", "montre", "parfum", "bijou", "sac"], label: "Idées cadeaux" },
  { triggers: ["copine", "femme", "elle", "fille", "mere", "maman", "soeur"], keywords: ["femme", "robe", "sac", "parfum", "bijou", "maquillage", "lingerie"], label: "Pour elle" },
  { triggers: ["copain", "homme", "lui", "pere", "papa", "frere", "mec"], keywords: ["homme", "montre", "sneakers", "t-shirt", "parfum", "portefeuille"], label: "Pour lui" },
  { triggers: ["enfant", "bebe", "gamin", "fils", "fille", "kid", "petit"], keywords: ["enfant", "jouet", "bébé", "scolaire", "nurserie"], label: "Enfants" },
  { triggers: ["pluie", "froid", "hiver"], keywords: ["veste", "manteau", "imperméable", "boots", "bottes"], label: "Temps froid & pluie" },
  { triggers: ["soleil", "chaud", "chaleur", "été", "ete"], keywords: ["lunettes", "short", "sandales", "casquette", "chapeau"], label: "Été & soleil" },
  { triggers: ["maison", "deco", "decoration", "cuisine", "chambre", "salon"], keywords: ["maison", "décoration", "cuisine", "literie", "éclairage", "rangement"], label: "Maison" },
  { triggers: ["voiture", "auto", "moto", "scooter", "conduite"], keywords: ["auto", "voiture", "moto", "intérieur", "extérieur", "entretien"], label: "Auto & Moto" },
  { triggers: ["musique", "son", "ecouter", "audio", "casque", "enceinte"], keywords: ["casque", "écouteur", "enceinte", "audio", "microphone"], label: "Audio" },
  { triggers: ["photo", "video", "camera", "film", "filmer"], keywords: ["photo", "vidéo", "camera", "gopro"], label: "Photo & Vidéo" },
  { triggers: ["gamer", "gaming", "jeu", "jouer", "console", "manette"], keywords: ["gaming", "manette", "console", "gamer"], label: "Gaming" },
  { triggers: ["telephone", "phone", "iphone", "samsung", "coque", "chargeur"], keywords: ["smartphone", "coque", "chargeur", "câble", "téléphone"], label: "Téléphonie" },
  { triggers: ["elegant", "classe", "soiree", "chic", "mariage", "costume"], keywords: ["costume", "chemise", "robe", "talons", "montre", "bijou", "ceinture"], label: "Tenue chic" },
  { triggers: ["decontracte", "casual", "relax", "chill", "street"], keywords: ["t-shirt", "hoodie", "sneakers", "streetwear", "sweat", "short"], label: "Style décontracté" },
  { triggers: ["soin", "beaute", "peau", "cheveux", "visage", "creme"], keywords: ["soin", "visage", "cheveux", "crème", "maquillage", "corps"], label: "Soins & Beauté" },
  { triggers: ["parfum", "sentir", "odeur", "fragrance"], keywords: ["parfum", "fragrance", "eau de toilette"], label: "Parfums" },
  { triggers: ["voyage", "vacances", "valise", "sac", "camping", "rando"], keywords: ["sac", "valise", "camping", "voyage", "sac à dos"], label: "Voyage" },
];

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
  const [vendorProducts, setVendorProducts] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [addedId, setAddedId] = useState(null);
  const [searched, setSearched] = useState(false);
  const [matchLabel, setMatchLabel] = useState('');
  const [showBoutiques, setShowBoutiques] = useState(false);
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

  const smartSearch = (raw) => {
    const q = raw.trim().toLowerCase();
    if (!q) return [];

    const words = q.split(/\s+/).filter(Boolean);

    // Find matching intents
    let intentKeywords = [];
    let label = '';
    for (const intent of INTENT_MAP) {
      if (intent.triggers.some(t => words.some(w => w.includes(t) || t.includes(w)))) {
        intentKeywords.push(...intent.keywords);
        if (!label) label = intent.label;
      }
    }

    // Combine user words + intent-derived keywords
    const allTerms = [...new Set([...words, ...intentKeywords])];

    const scored = allProducts.map(p => {
      const hay = `${p.name || ''} ${p.type || ''} ${p.description || ''}`.toLowerCase();
      let score = 0;
      for (const term of allTerms) {
        if (hay.includes(term)) score += (words.includes(term) ? 3 : 1);
      }
      return { ...p, _score: score };
    }).filter(p => p._score > 0);

    scored.sort((a, b) => b._score - a._score);

    setMatchLabel(label);
    return scored.slice(0, 40);
  };

  const [results, setResults] = useState([]);

  const doSearch = (q) => {
    const r = smartSearch(q || query);
    setResults(r);
    setSearched(true);
    setShowBoutiques(false);
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

  const reset = () => { setQuery(''); setSearched(false); setResults([]); setMatchLabel(''); setShowBoutiques(false); };

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
              <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[#FF9900] text-xs"></i>
              <input ref={inputRef} value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Décris ce que tu cherches…"
                className="w-full pl-8 pr-16 py-2 border border-[#D5D9D9] focus:border-[#FF9900] text-[13px] outline-none bg-[#F7F8F8] focus:bg-white transition" />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {query && (
                  <button type="button" onClick={reset} className="w-6 h-6 flex items-center justify-center text-[#ADBAC7] hover:text-[#0F1111]">
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
                )}
                <button type="submit" className="h-7 px-2 bg-[#FF9900] hover:bg-[#FFB800] flex items-center justify-center text-[#0F1111] text-[10px] font-bold">
                  Trouver
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
            ) : !searched ? (
              /* ─── LANDING: conversational prompts ─── */
              <div className="px-4 py-6">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-[#FFF8F0] border border-[#FFE0B2] flex items-center justify-center mx-auto mb-3">
                    <i className="fa-solid fa-sparkles text-[#FF9900] text-xl"></i>
                  </div>
                  <h2 className="text-[15px] font-bold text-[#0F1111]">Qu'est-ce que tu cherches ?</h2>
                  <p className="text-[12px] text-[#565959] mt-1">Décris avec tes propres mots, on trouve pour toi</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {PROMPTS.map(p => (
                    <button key={p.text} onClick={() => handlePrompt(p.text)}
                      className="flex items-center gap-2.5 px-3 py-3 text-left border border-[#E7E7E7] hover:border-[#FF9900] hover:bg-[#FFF8F0] transition-all group">
                      <div className="w-8 h-8 bg-[#F7F8F8] group-hover:bg-[#FF9900]/10 flex items-center justify-center flex-shrink-0 transition-colors">
                        <i className={`fa-solid ${p.icon} text-[11px] text-[#565959] group-hover:text-[#FF9900] transition-colors`}></i>
                      </div>
                      <span className="text-[11px] text-[#0F1111] leading-snug">{p.text}</span>
                    </button>
                  ))}
                </div>

                {/* Boutiques shortcut */}
                <div className="mt-6 border-t border-[#F3F4F4] pt-4">
                  <button onClick={() => { setSearched(true); setShowBoutiques(true); }}
                    className="w-full flex items-center gap-3 px-3 py-3 border border-[#E7E7E7] hover:border-[#FF9900] transition-all">
                    <div className="w-8 h-8 bg-[#F7F8F8] flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-store text-[11px] text-[#565959]"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[12px] font-bold text-[#0F1111]">Parcourir les boutiques</p>
                      <p className="text-[10px] text-[#565959]">{vendors.length} vendeurs · Adresses & itinéraires</p>
                    </div>
                    <i className="fa-solid fa-chevron-right text-[10px] text-[#ADBAC7]"></i>
                  </button>
                </div>

                {/* Trending products */}
                {allProducts.length > 0 && (
                  <div className="mt-5 border-t border-[#F3F4F4] pt-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-2">Nouveautés</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px bg-[#E7E7E7] border border-[#E7E7E7]">
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
                            {p.vendor?.shop_name && <p className="text-[9px] text-[#007185] mt-0.5">{p.vendor.shop_name}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setOpen(false); navigate('/store'); }}
                      className="w-full py-2.5 mt-1 text-[11px] font-bold text-[#007185] hover:text-[#FF9900] transition-colors">
                      Voir tout le catalogue <i className="fa-solid fa-chevron-right ml-1 text-[8px]"></i>
                    </button>
                  </div>
                )}
              </div>
            ) : showBoutiques ? (
              /* ─── BOUTIQUES ─── */
              <div>
                <div className="flex items-center gap-2 px-4 py-2 bg-[#FAFAFA] border-b border-[#E7E7E7]">
                  <button onClick={() => { setShowBoutiques(false); setSearched(false); }} className="text-[10px] font-bold text-[#007185] hover:text-[#FF9900]">
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
                            {v.logo_url
                              ? <img src={v.logo_url} alt="" className="w-full h-full object-cover" />
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
                            {(vendorProducts[v.id] || []).length > 5 && (
                              <div onClick={() => { setOpen(false); navigate(`/shop/${encodeURIComponent(v.shop_name)}`); }}
                                className="w-14 h-14 flex-shrink-0 bg-[#F7F8F8] border border-[#E7E7E7] flex items-center justify-center cursor-pointer hover:border-[#FF9900]">
                                <span className="text-[10px] font-bold text-[#007185]">+{(vendorProducts[v.id] || []).length - 5}</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => { setOpen(false); navigate(`/shop/${encodeURIComponent(v.shop_name)}`); }}
                            className="flex-1 py-1.5 bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] text-[10px] font-bold text-[#0F1111] text-center">
                            Visiter
                          </button>
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(v.shop_name + ', ' + (v.city || 'Douala') + ', Cameroun')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="py-1.5 px-3 border border-[#D5D9D9] hover:border-[#FF9900] text-[10px] font-bold text-[#0F1111] bg-white text-center">
                            <i className="fa-solid fa-route mr-1"></i>Y aller
                          </a>
                          {v.phone && (
                            <a href={`tel:${v.phone}`} className="py-1.5 px-2 border border-[#D5D9D9] hover:border-[#007600] text-[10px] text-[#007600] bg-white flex items-center">
                              <i className="fa-solid fa-phone text-[9px]"></i>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ─── RESULTS ─── */
              <div>
                {/* Result header */}
                <div className="flex items-center gap-2 px-4 py-2 bg-[#FAFAFA] border-b border-[#E7E7E7] flex-shrink-0">
                  <button onClick={reset} className="text-[10px] font-bold text-[#007185] hover:text-[#FF9900]">
                    <i className="fa-solid fa-arrow-left mr-1"></i>Retour
                  </button>
                  <div className="flex-1 min-w-0">
                    {matchLabel && (
                      <span className="text-[10px] font-bold text-[#FF9900] mr-2">
                        <i className="fa-solid fa-sparkles mr-0.5 text-[8px]"></i>{matchLabel}
                      </span>
                    )}
                    <span className="text-[10px] text-[#565959]">{results.length} résultat{results.length !== 1 ? 's' : ''}</span>
                  </div>
                  <button onClick={() => setShowBoutiques(true)} className="text-[10px] font-bold text-[#007185] hover:text-[#FF9900]">
                    Boutiques <i className="fa-solid fa-store ml-0.5 text-[8px]"></i>
                  </button>
                </div>

                {results.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <i className="fa-solid fa-face-thinking text-4xl text-[#E7E7E7] mb-3 block"></i>
                    <p className="text-[13px] font-bold text-[#0F1111]">Hmm, rien trouvé pour ça</p>
                    <p className="text-[11px] text-[#565959] mt-1 max-w-[280px] mx-auto">Essaie de décrire autrement. Par exemple : "un casque pour écouter de la musique" ou "des chaussures de sport"</p>
                    <button onClick={reset} className="mt-4 px-4 py-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[11px] font-bold text-[#0F1111] border border-[#FCD200]">
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
                            {p.vendor?.shop_name && <p className="text-[9px] text-[#007185] mt-0.5">{p.vendor.shop_name}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setOpen(false); navigate(`/search?q=${encodeURIComponent(query)}`); }}
                      className="w-full py-3 text-[12px] font-bold text-[#007185] hover:text-[#FF9900] border-t border-[#E7E7E7] transition-colors">
                      Voir tous les résultats sur OFS <i className="fa-solid fa-chevron-right ml-1 text-[9px]"></i>
                    </button>
                  </>
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
