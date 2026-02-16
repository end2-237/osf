import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const QUICK_SEARCHES = [
  "casque sans fil bonne basse",
  "sneakers blanches Jordan",
  "hoodie streetwear noir oversize",
  "AirPods Pro",
  "parfum masculin discret",
  "montre connectée moderne",
];

const normalize = (s = "") =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").trim();

// ── Recherche textuelle via Supabase directement ──
async function searchByKeywords(description) {
  const words = normalize(description)
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 4);

  if (!words.length) return [];

  const orFilters = words.map((w) => `name.ilike.%${w}%`).join(",");
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .or(orFilters)
    .limit(24);

  if (error) throw new Error(error.message);

  // Scoring local
  return (data || [])
    .map((p) => {
      const name = normalize(p.name);
      const searchable = normalize(`${p.name} ${p.type} ${(p.features || []).join(" ")}`);
      let score = 0;
      words.forEach((w) => {
        if (name.includes(w)) score += 4;
        else if (searchable.includes(w)) score += 1;
      });
      return { ...p, similarity: score / (words.length * 4) };
    })
    .filter((p) => p.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);
}

// ─────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────

const VisualSearchModal = ({ isOpen, onClose, addToCart }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [mode, setMode] = useState("image");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [results, setResults] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setImageFile(null);
    setImagePreview("");
    setDescription("");
    setResults(null);
    setMeta(null);
    setError("");
    setLoadingMsg("");
  };

  const switchMode = (m) => { setMode(m); reset(); };

  const loadImage = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setResults(null);
    setMeta(null);
    setError("");
  }, []);

  // ════════════════════════════════════════════════
  // RECHERCHE VISUELLE — pgvector + CLIP
  // ════════════════════════════════════════════════
  const searchByImage = async () => {
    if (!imageFile || loading) return;
    setLoading(true);
    setError("");
    setResults(null);
    setMeta(null);

    try {
      setLoadingMsg("Génération de l'empreinte vectorielle...");
      const imageBase64 = await fileToBase64(imageFile);

      setLoadingMsg("Recherche par similarité cosinus...");
      const response = await fetch("/api/visual-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          imageMimeType: imageFile.type || "image/jpeg",
          threshold: 0.45,
          limit: 8,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Erreur API ${response.status}`);
      }

      const data = await response.json();
      setResults(data.results || []);
      setMeta(data.meta);
    } catch (err) {
      console.error("[VisualSearch]", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // ════════════════════════════════════════════════
  // RECHERCHE PAR TEXTE — Supabase direct
  // ════════════════════════════════════════════════
  const searchByText = async () => {
    if (!description.trim() || loading) return;
    setLoading(true);
    setError("");
    setResults(null);
    setMeta(null);
    setLoadingMsg("Recherche dans le catalogue...");

    try {
      const found = await searchByKeywords(description);
      setResults(found);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-zinc-950 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-3xl max-h-[94vh] flex flex-col shadow-[0_0_60px_rgba(0,255,136,0.05)] overflow-hidden">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 border border-primary/25 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-dna text-primary text-sm" />
            </div>
            <div>
              <h2 className="font-black uppercase italic tracking-tighter text-white text-base leading-none">
                Recherche Vectorielle
              </h2>
              <p className="text-[8px] font-black uppercase text-zinc-600 tracking-[0.2em] mt-0.5">
                CLIP · pgvector · Similarité cosinus
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/25 transition-all"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-2 px-5 py-3 border-b border-white/5 flex-shrink-0">
          {[
            { key: "image", icon: "fa-camera", label: "Par image" },
            { key: "text", icon: "fa-keyboard", label: "Par description" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchMode(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                mode === tab.key
                  ? "bg-primary text-black border-primary shadow-[0_0_16px_rgba(0,255,136,0.12)]"
                  : "bg-white/5 text-zinc-500 border-white/8 hover:border-primary/25 hover:text-zinc-300"
              }`}
            >
              <i className={`fa-solid ${tab.icon} text-xs`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── CORPS SCROLLABLE ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ scrollbarWidth: "none" }}>

          {/* ══════════ MODE IMAGE ══════════ */}
          {mode === "image" && (
            <>
              {/* Zone drop */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); loadImage(e.dataTransfer.files[0]); }}
                onClick={() => !imagePreview && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl transition-all duration-300 overflow-hidden ${
                  dragOver ? "border-primary bg-primary/5 scale-[1.01]"
                  : imagePreview ? "border-primary/20 bg-black/30"
                  : "border-white/8 hover:border-primary/30 cursor-pointer"
                }`}
              >
                <input type="file" accept="image/*" ref={fileInputRef}
                  onChange={(e) => loadImage(e.target.files[0])} className="hidden" />
                <input type="file" accept="image/*" capture="environment" ref={cameraInputRef}
                  onChange={(e) => loadImage(e.target.files[0])} className="hidden" />

                {imagePreview ? (
                  <div className="relative group">
                    <img src={imagePreview} alt="Aperçu"
                      className="w-full h-52 object-contain bg-black/60 p-3" />
                    <button
                      onClick={(e) => { e.stopPropagation(); reset(); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500/90 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform z-10"
                    >
                      <i className="fa-solid fa-xmark text-[10px]" />
                    </button>
                    <div
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <span className="bg-primary text-black text-[10px] font-black uppercase px-4 py-2 rounded-xl flex items-center gap-2">
                        <i className="fa-solid fa-rotate" /> Changer l'image
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 px-6 text-center">
                    <div className="w-14 h-14 bg-white/4 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/6">
                      <i className="fa-solid fa-cloud-arrow-up text-2xl text-zinc-700" />
                    </div>
                    <p className="font-black uppercase text-zinc-400 text-sm mb-1">Glissez une photo produit</p>
                    <p className="text-[10px] text-zinc-600 mb-5">ou choisissez ci-dessous</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white/6 hover:bg-white/10 border border-white/8 rounded-xl text-[9px] font-black uppercase text-zinc-500 hover:text-zinc-200 transition-all"
                      >
                        <i className="fa-solid fa-image text-[9px]" /> Galerie
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-xl text-[9px] font-black uppercase text-primary transition-all"
                      >
                        <i className="fa-solid fa-camera text-[9px]" /> Photo
                      </button>
                    </div>
                    <p className="text-[7px] font-black uppercase text-zinc-700 mt-4 tracking-widest">
                      JPG · PNG · WEBP · HEIC
                    </p>
                  </div>
                )}
              </div>

              {/* Explication technique */}
              {!imagePreview && (
                <HowItWorks />
              )}

              {/* Loader */}
              {loading && <LoadingIndicator msg={loadingMsg} />}

              {/* Bouton */}
              <button
                onClick={searchByImage}
                disabled={!imageFile || loading}
                className="w-full bg-primary text-black py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(0,255,136,0.15)]"
              >
                {loading
                  ? <><i className="fa-solid fa-circle-notch animate-spin text-xs" /> Calcul en cours…</>
                  : <><i className="fa-solid fa-dna text-xs" /> Lancer la recherche vectorielle</>
                }
              </button>
            </>
          )}

          {/* ══════════ MODE TEXTE ══════════ */}
          {mode === "text" && (
            <>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest block mb-2">
                  Décrivez ce que vous cherchez
                </label>
                <textarea
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setResults(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); searchByText(); } }}
                  placeholder="Ex: casque sans fil avec réduction de bruit, coloris blanc…"
                  rows={3}
                  className="w-full bg-white/5 border border-white/8 rounded-2xl px-4 py-3.5 text-sm font-bold text-white placeholder-zinc-700 outline-none focus:border-primary/50 transition-colors resize-none"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SEARCHES.map((ex) => (
                  <button key={ex} onClick={() => setDescription(ex)}
                    className="text-[9px] font-black uppercase px-3 py-1.5 rounded-full bg-white/5 text-zinc-500 border border-white/6 hover:border-primary/40 hover:text-primary transition-all">
                    {ex}
                  </button>
                ))}
              </div>

              {loading && <LoadingIndicator msg={loadingMsg} />}

              <button
                onClick={searchByText}
                disabled={!description.trim() || loading}
                className="w-full bg-primary text-black py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(0,255,136,0.15)]"
              >
                {loading
                  ? <><i className="fa-solid fa-circle-notch animate-spin text-xs" /> Recherche…</>
                  : <><i className="fa-solid fa-magnifying-glass-plus text-xs" /> Trouver des produits</>
                }
              </button>
            </>
          )}

          {/* ── ERREUR ── */}
          {error && (
            <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <i className="fa-solid fa-triangle-exclamation text-red-400 text-sm mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-400 text-[10px] font-black uppercase mb-0.5">Erreur</p>
                <p className="text-red-400/70 text-[10px] font-bold">{error}</p>
              </div>
            </div>
          )}

          {/* ── META PERF (debug) ── */}
          {meta && !loading && (
            <div className="flex items-center gap-4 px-1">
              <span className="text-[8px] font-black uppercase text-zinc-700 tracking-wider flex items-center gap-1.5">
                <i className="fa-solid fa-bolt text-primary/40 text-[7px]" />
                {meta.embeddingMs}ms embedding
              </span>
              <span className="text-[8px] font-black uppercase text-zinc-700 tracking-wider">
                {meta.totalMs}ms total
              </span>
              <span className="text-[8px] font-black uppercase text-zinc-700 tracking-wider">
                {(meta.threshold * 100).toFixed(0)}% seuil
              </span>
            </div>
          )}

          {/* ── RÉSULTATS ── */}
          {results !== null && !loading && (
            <ResultsGrid
              results={results}
              mode={mode}
              onProductClick={(p) => { navigate(`/product/${p.id}`, { state: { product: p } }); onClose(); }}
              onAddToCart={(p) => addToCart?.({ ...p, selectedSize: "M", selectedColor: "Black", quantity: 1 })}
              onViewAll={() => { onClose(); navigate("/store"); }}
            />
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-white/5 flex items-center justify-between">
          <p className="text-[8px] font-black uppercase text-zinc-700 tracking-widest flex items-center gap-1.5">
            <i className="fa-solid fa-microchip text-primary/50 text-[8px]" />
            CLIP vit-base-patch32 · 512 dimensions · pgvector HNSW
          </p>
          <button onClick={onClose} className="text-[9px] font-black uppercase text-zinc-600 hover:text-white transition-colors">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────
// SOUS-COMPOSANTS
// ─────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { icon: "fa-dna", label: "Embedding CLIP", sub: "512 dimensions" },
        { icon: "fa-circle-nodes", label: "pgvector HNSW", sub: "Index cosinus" },
        { icon: "fa-ranking-star", label: "Similarité", sub: ">45% seuil" },
      ].map((s) => (
        <div key={s.label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
          <i className={`fa-solid ${s.icon} text-primary text-sm mb-2 block`} />
          <p className="text-[9px] font-black uppercase text-zinc-400">{s.label}</p>
          <p className="text-[8px] font-bold text-zinc-700 mt-0.5">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

function LoadingIndicator({ msg }) {
  return (
    <div className="bg-primary/5 border border-primary/12 rounded-xl p-4 flex items-center gap-3">
      <i className="fa-solid fa-circle-notch animate-spin text-primary text-sm flex-shrink-0" />
      <p className="text-[11px] font-bold text-zinc-400">{msg}</p>
    </div>
  );
}

function ResultsGrid({ results, mode, onProductClick, onAddToCart, onViewAll }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
          <span className="text-primary text-sm font-black italic">{results.length}</span>
          {" "}produit{results.length !== 1 ? "s" : ""}
          {mode === "image" && results.length > 0 && (
            <span className="ml-1.5 text-zinc-700">· classés par similarité vectorielle</span>
          )}
        </p>
        {results.length > 0 && (
          <button onClick={onViewAll}
            className="text-[9px] font-black uppercase text-primary hover:underline flex items-center gap-1">
            Voir tout <i className="fa-solid fa-arrow-right text-[7px]" />
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="py-14 text-center border border-white/5 rounded-2xl">
          <i className="fa-solid fa-box-open text-3xl text-zinc-800 mb-3 block" />
          <p className="font-black uppercase italic text-zinc-600 text-sm">Aucun produit similaire</p>
          <p className="text-[9px] text-zinc-700 mt-1">
            {mode === "image"
              ? "Essayez avec une image plus nette ou un seuil plus bas"
              : "Reformulez votre recherche"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-2">
          {results.map((product, idx) => (
            <ProductCard
              key={product.id}
              product={product}
              rank={idx}
              mode={mode}
              onClick={() => onProductClick(product)}
              onAddToCart={() => onAddToCart(product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, rank, mode, onClick, onAddToCart }) {
  const simPct = product.similarity != null ? Math.round(product.similarity * 100) : null;

  return (
    <div
      onClick={onClick}
      className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden cursor-pointer group hover:border-primary/30 transition-all duration-300"
    >
      <div className="aspect-square overflow-hidden bg-zinc-900 relative">
        <img src={product.img} alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          loading="lazy" />

        {/* Badge similarité (mode image) */}
        {mode === "image" && simPct != null && (
          <div className="absolute top-2 left-2">
            {rank === 0 ? (
              <span className="bg-primary text-black text-[7px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                <i className="fa-solid fa-star text-[5px]" /> {simPct}% match
              </span>
            ) : (
              <span className="bg-black/70 backdrop-blur-sm text-zinc-300 text-[7px] font-black px-2 py-0.5 rounded-full border border-white/10">
                {simPct}%
              </span>
            )}
          </div>
        )}

        {/* Quick buy */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
            className="w-full bg-primary text-black py-2 font-black text-[9px] uppercase rounded-xl hover:bg-white transition-colors"
          >
            <i className="fa-solid fa-bag-shopping text-[8px] mr-1" /> Quick Buy
          </button>
        </div>
      </div>

      <div className="p-2.5">
        <p className="font-black uppercase italic text-white text-[10px] truncate leading-tight">{product.name}</p>
        <p className="text-[8px] text-zinc-700 font-black uppercase mt-0.5">{product.type}</p>
        <p className="text-primary font-black text-xs mt-1.5 leading-none">
          {Number(product.price).toLocaleString("fr-FR")}{" "}
          <span className="text-[8px] text-primary/60">FCFA</span>
        </p>
      </div>
    </div>
  );
}

export default VisualSearchModal;