import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ── APPEL API ──
const callGemini = async (payload) => {
  const response = await fetch('/api/ai-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erreur API ${response.status}: ${err}`);
  }
  const data = await response.json();
  const raw = (data.text || '{}').replace(/```json[\s\S]*?```|```/g, '').trim();
  return JSON.parse(raw);
};

// ── PASSE 1 : identifier la catégorie ──
const IDENTIFY_PROMPT = `You analyze product images for an e-commerce store (OneFreestyle Elite, Douala, Cameroon).
Categories: Audio Lab (headphones/earbuds/speakers), Clothing (t-shirts/hoodies/jackets), Shoes/Sneakers, Tech Lab (VR/smartwatches/gadgets), Fragrance (perfumes), Accessories (watches/jewelry).

Return ONLY JSON, no markdown:
{
  "type": "Audio Lab | Clothing | Shoes | Tech Lab | Fragrance | Accessories | null",
  "productName": "specific name if recognizable (e.g. AirPods Pro, Jordan 1, etc.)",
  "reasoning": "une phrase en français décrivant ce que tu vois"
}`;

// ── PROMPT TEXTE ──
const TEXT_PROMPT = (desc) =>
  `Product search assistant for OneFreestyle Elite (Douala, Cameroon).
Categories: Audio Lab (headphones/earbuds/speakers), Clothing, Shoes, Tech Lab, Fragrance, Accessories.

User looking for: "${desc}"

Return ONLY JSON, no markdown:
{
  "type": "Audio Lab | Clothing | Shoes | Tech Lab | Fragrance | Accessories | null",
  "searchTerms": ["specific word", "brand if any", "feature word"],
  "summary": "une phrase en français",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}
Use specific single words for searchTerms (e.g. "Jordan" not "sneakers", "Sony" not "casque").`;

// ── NORMALIZE (pour text search) ──
const normalize = (str = '') =>
  str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').trim();

const matchProducts = (products, analysis) => {
  if (!products?.length) return [];
  const rawTerms = [
    ...(analysis.searchTerms || []),
    analysis.productName || '',
  ].filter(Boolean);
  const terms = rawTerms.flatMap(t => normalize(t).split(/\s+/)).filter(t => t.length > 2);
  if (!terms.length) return products.slice(0, 8);
  const scored = products.map(p => {
    const nameNorm = normalize(p.name);
    const searchable = normalize(`${p.name} ${p.type} ${p.brand || ''} ${(p.features || []).join(' ')}`);
    let score = 0;
    for (const term of terms) {
      if (searchable.includes(term)) {
        score += 1;
        if (nameNorm.includes(term)) score += 2;
        if (new RegExp(`\\b${term}\\b`).test(searchable)) score += 1;
      }
    }
    return { ...p, _score: score };
  });
  return scored.filter(p => p._score > 0).sort((a, b) => b._score - a._score).slice(0, 12);
};

// ══════════════════════════════════════════
const VisualSearchModal = ({ isOpen, onClose, addToCart }) => {
  const [mode, setMode] = useState('image');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [results, setResults] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleImageUpload = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setResults(null); setAiAnalysis(null); setError('');
  }, []);

  const toBase64 = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  // ══ RECHERCHE PAR IMAGE — 2 passes ══
  const searchByImage = async () => {
    if (!imageFile) return;
    setLoading(true); setError(''); setAiAnalysis(null); setResults(null);

    try {
      const imageBase64 = await toBase64(imageFile);

      // ── PASSE 1 : Gemini identifie la catégorie ──
      setLoadingStep('Étape 1/2 — Identification du produit...');
      const identification = await callGemini({
        type: 'image',
        prompt: IDENTIFY_PROMPT,
        imageBase64,
        imageMimeType: imageFile.type || 'image/jpeg',
      });
      setAiAnalysis(identification);

      // ── Récupérer les produits Supabase par catégorie ──
      setLoadingStep('Chargement du catalogue...');
      let query = supabase.from('products').select('*');
      if (identification.type) query = query.eq('type', identification.type);
      const { data: products, error: supaError } = await query.limit(16);
      if (supaError) throw new Error(supaError.message);

      const candidates = products || [];
      if (candidates.length === 0) {
        setResults([]);
        return;
      }

      // ── PASSE 2 : Gemini compare visuellement l'image uploadée vs images des produits ──
      setLoadingStep(`Étape 2/2 — Comparaison visuelle avec ${candidates.length} produits...`);
      const productImageUrls = candidates.map(p => p.img).filter(Boolean);

      const comparison = await callGemini({
        type: 'compare',
        userImageBase64: imageBase64,
        userImageMimeType: imageFile.type || 'image/jpeg',
        productImageUrls,
      });

      // ── Ordonner les produits selon le classement Gemini ──
      const rankedIndices = comparison.rankedIndices || [];
      const seenIds = new Set();

      // D'abord les produits classés par Gemini
      const ranked = rankedIndices
        .map(i => candidates[i])
        .filter(p => p && !seenIds.has(p.id) && seenIds.add(p.id));

      // Puis les produits non classés (Gemini n'a pas pu les traiter)
      const unranked = candidates.filter(p => !seenIds.has(p.id));

      setResults([...ranked, ...unranked].slice(0, 8));

      // Enrichir l'analyse avec le raisonnement de la comparaison
      if (comparison.reasoning) {
        setAiAnalysis(prev => ({ ...prev, comparisonReasoning: comparison.reasoning }));
      }

    } catch (err) {
      console.error('Visual search error:', err);
      setError("L'analyse a échoué : " + err.message);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // ══ RECHERCHE PAR DESCRIPTION ══
  const searchByDescription = async () => {
    if (!description.trim()) return;
    setLoading(true); setError(''); setAiAnalysis(null); setResults(null);
    setLoadingStep('Analyse de la description...');

    try {
      const analysis = await callGemini({ type: 'text', prompt: TEXT_PROMPT(description) });
      setAiAnalysis(analysis);

      setLoadingStep('Recherche dans le catalogue...');
      const primaryTerm = analysis.searchTerms?.[0] || '';
      let query = supabase.from('products').select('*');
      if (analysis.type && primaryTerm) {
        query = query.or(`type.eq.${analysis.type},name.ilike.%${primaryTerm}%`);
      } else if (analysis.type) {
        query = query.eq('type', analysis.type);
      } else if (primaryTerm) {
        query = query.ilike('name', `%${primaryTerm}%`);
      }
      const { data: products } = await query.limit(50);
      setResults(matchProducts(products || [], analysis));

    } catch (err) {
      console.error('Description search error:', err);
      setError('Recherche échouée : ' + err.message);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const resetModal = () => {
    setImageFile(null); setImagePreview(''); setDescription('');
    setResults(null); setAiAnalysis(null); setError(''); setLoadingStep('');
  };
  const switchMode = (m) => { setMode(m); resetModal(); };

  if (!isOpen) return null;

  const EXAMPLES = [
    'casque sans fil bonne basse',
    'veste streetwear noire oversize',
    'sneakers blanches sport',
    'écouteurs pour le gym',
    'parfum masculin discret',
    'montre connectée moderne',
  ];

  return (
    <div className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

      <div className="relative bg-zinc-950 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col shadow-[0_0_80px_rgba(0,255,136,0.08)]">

        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/15 border border-primary/30 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-magnifying-glass-plus text-primary text-sm"></i>
            </div>
            <div>
              <h2 className="font-black uppercase italic tracking-tighter text-white text-base leading-none">
                Recherche IA
              </h2>
              <p className="text-[8px] font-black uppercase text-zinc-600 tracking-[0.2em]">
                Comparaison visuelle · Gemini · Gratuit
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-all">
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-2 px-5 py-3 border-b border-white/5 flex-shrink-0">
          {[
            { key: 'image', icon: 'fa-camera', label: 'Par image' },
            { key: 'text', icon: 'fa-comment-dots', label: 'Par description' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchMode(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                mode === tab.key
                  ? 'bg-primary text-black border-primary shadow-[0_0_20px_rgba(0,255,136,0.2)]'
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:border-primary/30 hover:text-zinc-200'
              }`}
            >
              <i className={`fa-solid ${tab.icon} text-xs`}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 hide-scrollbar">

          {/* IMAGE MODE */}
          {mode === 'image' && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleImageUpload(e.dataTransfer.files[0]); }}
                onClick={() => !imagePreview && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl transition-all duration-300 overflow-hidden ${
                  dragOver ? 'border-primary bg-primary/5 scale-[1.01]'
                  : imagePreview ? 'border-primary/30'
                  : 'border-white/10 hover:border-primary/40 cursor-pointer'
                }`}
              >
                <input type="file" accept="image/*" ref={fileInputRef}
                  onChange={(e) => handleImageUpload(e.target.files[0])} className="hidden" />
                {imagePreview ? (
                  <div className="relative group">
                    <img src={imagePreview} alt="Preview" className="w-full h-48 object-contain bg-black/40 p-2" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(''); setResults(null); setAiAnalysis(null); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform z-10"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                    <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="bg-primary text-black text-[10px] font-black uppercase px-4 py-2 rounded-xl">Changer l'image</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center px-6">
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <i className="fa-solid fa-cloud-arrow-up text-2xl text-zinc-500"></i>
                    </div>
                    <p className="font-black uppercase text-zinc-300 text-sm mb-1">Glissez une photo produit</p>
                    <p className="text-[10px] font-bold text-zinc-500 mb-3">ou cliquez pour parcourir</p>
                    <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">JPG · PNG · WEBP</p>
                  </div>
                )}
              </div>

              {!imagePreview && (
                <div className="flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-xl p-3">
                  <i className="fa-solid fa-eye text-primary text-sm mt-0.5 flex-shrink-0"></i>
                  <p className="text-[10px] font-bold text-zinc-400">
                    Gemini <span className="text-primary">compare visuellement</span> ton image avec chaque photo produit du catalogue — pas de mots-clés, une vraie comparaison d'images.
                  </p>
                </div>
              )}

              {/* Indicateur de progression */}
              {loading && loadingStep && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-circle-notch animate-spin text-primary text-sm flex-shrink-0"></i>
                    <p className="text-[11px] font-bold text-zinc-300">{loadingStep}</p>
                  </div>
                  <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: loadingStep.includes('2/2') ? '80%' : '35%' }}></div>
                  </div>
                </div>
              )}

              <button
                onClick={searchByImage}
                disabled={!imageFile || loading}
                className="w-full bg-primary text-black py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(0,255,136,0.2)]"
              >
                {loading ? (
                  <><i className="fa-solid fa-circle-notch animate-spin text-xs"></i> Comparaison en cours...</>
                ) : (
                  <><i className="fa-solid fa-eye text-xs"></i> Comparer visuellement</>
                )}
              </button>
            </>
          )}

          {/* TEXT MODE */}
          {mode === 'text' && (
            <>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest block mb-2">
                  Décrivez ce que vous cherchez
                </label>
                <textarea
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setResults(null); setAiAnalysis(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); searchByDescription(); } }}
                  placeholder="Ex: un casque sans fil avec bonne réduction de bruit..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-white placeholder-zinc-700 outline-none focus:border-primary transition-colors resize-none"
                />
                <p className="text-[9px] font-bold text-zinc-600 mt-1.5 text-right">Entrée pour rechercher</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest mb-2">Essayez :</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => setDescription(ex)}
                      className="text-[9px] font-black uppercase px-3 py-1.5 rounded-full bg-white/5 text-zinc-400 border border-white/8 hover:border-primary/50 hover:text-primary transition-all"
                    >{ex}</button>
                  ))}
                </div>
              </div>
              <button
                onClick={searchByDescription}
                disabled={!description.trim() || loading}
                className="w-full bg-primary text-black py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(0,255,136,0.2)]"
              >
                {loading
                  ? <><i className="fa-solid fa-circle-notch animate-spin text-xs"></i> Recherche...</>
                  : <><i className="fa-solid fa-magnifying-glass-plus text-xs"></i> Trouver des produits</>
                }
              </button>
            </>
          )}

          {/* ERROR */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-3">
              <i className="fa-solid fa-triangle-exclamation text-red-400 text-sm mt-0.5"></i>
              <p className="text-red-400 text-[10px] font-bold">{error}</p>
            </div>
          )}

          {/* AI ANALYSIS */}
          {aiAnalysis && !loading && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
              <p className="text-[9px] font-black uppercase text-primary tracking-widest mb-3 flex items-center gap-2">
                <i className="fa-solid fa-robot text-xs"></i> Analyse IA
              </p>
              <div className="space-y-2">
                {aiAnalysis.reasoning && (
                  <p className="text-zinc-300 text-[11px] font-bold leading-relaxed">{aiAnalysis.reasoning}</p>
                )}
                {aiAnalysis.comparisonReasoning && (
                  <p className="text-zinc-400 text-[10px] font-bold leading-relaxed border-t border-white/5 pt-2">
                    <i className="fa-solid fa-eye text-primary mr-1 text-[8px]"></i>
                    {aiAnalysis.comparisonReasoning}
                  </p>
                )}
                {aiAnalysis.summary && (
                  <p className="text-zinc-300 text-[11px] font-bold leading-relaxed">{aiAnalysis.summary}</p>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {aiAnalysis.type && (
                    <span className="bg-primary text-black text-[8px] font-black uppercase px-2.5 py-1 rounded-full">
                      {aiAnalysis.type}
                    </span>
                  )}
                  {aiAnalysis.productName && (
                    <span className="bg-white/10 text-zinc-300 text-[8px] font-black uppercase px-2.5 py-1 rounded-full">
                      {aiAnalysis.productName}
                    </span>
                  )}
                </div>
                {aiAnalysis.suggestions?.length > 0 && (
                  <div className="pt-1">
                    <div className="flex flex-wrap gap-1.5">
                      {aiAnalysis.suggestions.map((s) => (
                        <button key={s} onClick={() => { setDescription(s); setMode('text'); }}
                          className="text-[9px] font-black text-primary border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-all"
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RESULTS */}
          {results !== null && !loading && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                  <span className="text-primary text-sm font-black italic">{results.length}</span>
                  {' '}produit{results.length !== 1 ? 's' : ''} trouvé{results.length !== 1 ? 's' : ''}
                  {mode === 'image' && results.length > 0 && (
                    <span className="ml-2 text-primary/60">· classés par ressemblance</span>
                  )}
                </p>
                {results.length > 0 && (
                  <button onClick={() => { onClose(); navigate('/store'); }}
                    className="text-[9px] font-black uppercase text-primary hover:underline flex items-center gap-1"
                  >Voir tout <i className="fa-solid fa-arrow-right text-[8px]"></i></button>
                )}
              </div>

              {results.length === 0 ? (
                <div className="py-12 text-center border border-white/5 rounded-2xl">
                  <i className="fa-solid fa-box-open text-3xl text-zinc-700 mb-3 block"></i>
                  <p className="font-black uppercase italic text-zinc-500 text-sm">Aucun produit correspondant</p>
                  <p className="text-[10px] font-bold text-zinc-600 mt-1">Essayez une autre image</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-2">
                  {results.map((product, idx) => (
                    <div
                      key={product.id}
                      onClick={() => { navigate(`/product/${product.id}`, { state: { product } }); onClose(); }}
                      className="bg-black/50 border border-white/5 rounded-2xl overflow-hidden cursor-pointer group hover:border-primary/40 transition-all"
                    >
                      <div className="aspect-square overflow-hidden bg-zinc-900 relative">
                        <img src={product.img} alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />

                        {/* Badge rang pour mode image */}
                        {mode === 'image' && idx === 0 && (
                          <div className="absolute top-2 left-2">
                            <span className="bg-primary text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                              <i className="fa-solid fa-star text-[6px]"></i> Meilleur match
                            </span>
                          </div>
                        )}
                        {mode === 'image' && idx > 0 && (
                          <div className="absolute top-2 left-2">
                            <span className="bg-black/60 text-zinc-300 text-[8px] font-black px-2 py-0.5 rounded-full">#{idx + 1}</span>
                          </div>
                        )}
                        {mode === 'text' && (
                          <div className="absolute top-2 left-2">
                            <span className="bg-primary text-black text-[7px] font-black px-2 py-0.5 rounded-full uppercase">{product.status}</span>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); addToCart?.({ ...product, selectedSize: 'M', selectedColor: 'Black', quantity: 1 }); }}
                            className="w-full bg-primary text-black py-2 font-black text-[9px] uppercase rounded-xl hover:bg-white transition-colors"
                          >Quick Buy</button>
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="font-black uppercase italic text-white text-[10px] truncate">{product.name}</p>
                        <p className="text-[9px] text-zinc-600 font-black uppercase mt-0.5">{product.type}</p>
                        <p className="text-primary font-black text-xs mt-1">{Number(product.price).toLocaleString()} <span className="text-[8px]">F</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-white/5 flex items-center justify-between bg-black/30">
          <p className="text-[8px] font-black uppercase text-zinc-700 tracking-widest">
            <i className="fa-solid fa-shield-check text-primary mr-1"></i>
            Gemini Vision · Comparaison image-à-image · Images non conservées
          </p>
          <button onClick={onClose} className="text-[9px] font-black uppercase text-zinc-500 hover:text-white transition-colors">Fermer</button>
        </div>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default VisualSearchModal;