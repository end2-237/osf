import React, { useState } from "react";
import { supabase, uploadProductImage } from "../lib/supabase";

// Taxonomie complète (alignée sur le Store)
const SUBCATEGORIES = {
  "Audio Lab":       ["Casques", "Enceintes", "Écouteurs", "Microphones"],
  "Tech Lab":        ["Smartphones", "TV & Vidéo", "Tablettes", "Informatique", "Gaming", "Photo & Vidéo", "Câbles & Chargeurs", "Électroménager", "Objets Connectés", "Maison Connectée"],
  "Clothing":        ["Hoodies & Sweats", "T-Shirts & Polos", "Chemises", "Pantalons & Jeans", "Vestes & Manteaux", "Shorts", "Costumes & Survêtements", "Sous-vêtements"],
  "Shoes":           ["Sneakers", "Bottes", "Sandales", "Mocassins", "Talons"],
  "Femme":           ["Robes & Jupes", "Tops & Blouses", "Lingerie", "Manteaux", "Combinaisons"],
  "Beauté":          ["Parfums", "Soins Visage", "Soins Cheveux", "Maquillage", "Corps & Bain"],
  "Accessories":     ["Montres", "Bijoux", "Sacs à main", "Lunettes", "Portefeuilles", "Ceintures", "Chapeaux"],
  "Maison":          ["Cuisine", "Décoration", "Literie", "Éclairage", "Rangement"],
  "Sport":           ["Fitness", "Vêtements Sport", "Cyclisme", "Natation", "Camping"],
  "Bébé & Enfants":  ["Jouets", "Vêtements Enfant", "Nurserie", "Scolaire"],
  "Auto":            ["Intérieur Auto", "Extérieur Auto", "Moto & Scooter", "Entretien"],
};
const CATEGORIES = Object.keys(SUBCATEGORIES);
const SIZE_PRESETS = {
  vet:   ["XS", "S", "M", "L", "XL", "XXL"],
  shoes: ["38", "39", "40", "41", "42", "43", "44", "45"],
};
const COLOR_SWATCHES = [
  { name: "Noir", hex: "#111" }, { name: "Blanc", hex: "#fff" }, { name: "Gris", hex: "#9ca3af" },
  { name: "Rouge", hex: "#ef4444" }, { name: "Bleu", hex: "#3b82f6" }, { name: "Vert", hex: "#22c55e" },
  { name: "Jaune", hex: "#eab308" }, { name: "Rose", hex: "#ec4899" }, { name: "Marron", hex: "#92400e" },
  { name: "Beige", hex: "#e7d3b3" }, { name: "Violet", hex: "#8b5cf6" }, { name: "Orange", hex: "#f97316" },
];

const input = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-900 transition-colors";
const label = "text-[11px] font-bold uppercase tracking-wide text-gray-400 block mb-1.5";

const STEPS = ["Infos", "Photos", "Variations", "Livraison", "Résumé"];

const AddProductWizard = ({ vendor, onClose, onDone, showToast }) => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    name: "", type: "Tech Lab", subcategory: "", price: "", compareAt: "",
    status: "In Stock", description: "",
    colors: [], sizes: [], features: [],
    ship_weight_g: "", pack_l_cm: "", pack_w_cm: "", pack_h_cm: "",
  });
  const [files, setFiles] = useState([]);      // File[]
  const [previews, setPreviews] = useState([]); // string[]
  const [featInput, setFeatInput] = useState("");
  const [colorInput, setColorInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const addImages = (list) => {
    const arr = Array.from(list).slice(0, 6 - files.length);
    setFiles(prev => [...prev, ...arr]);
    setPreviews(prev => [...prev, ...arr.map(x => URL.createObjectURL(x))]);
  };
  const removeImage = (i) => { setFiles(p => p.filter((_, x) => x !== i)); setPreviews(p => p.filter((_, x) => x !== i)); };

  const toggleArr = (key, val) => set(key, f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val]);
  const addChip = (key, val, reset) => { const v = val.trim(); if (v && !f[key].includes(v)) set(key, [...f[key], v]); reset(""); };

  const valid = [
    !!(f.name.trim() && f.price && f.type),   // infos
    files.length > 0,                          // photos
    true,                                      // variations (optionnel)
    true,                                      // livraison (optionnel)
    true,                                      // résumé
  ];

  const publish = async () => {
    setSaving(true);
    try {
      const urls = [];
      for (const file of files) urls.push(await uploadProductImage(file, vendor.id));
      const { error } = await supabase.from("products").insert({
        name: f.name.trim(),
        price: Number(f.price),
        type: f.type,
        subcategory: f.subcategory || null,
        status: f.status,
        img: urls[0] || "https://via.placeholder.com/600x800",
        images: urls,
        colors: f.colors.length ? f.colors : ["Black"],
        sizes: f.sizes,
        features: f.features,
        description: f.description || null,
        vendor_id: vendor.id,
        ship_weight_g: f.ship_weight_g ? Number(f.ship_weight_g) : null,
        pack_l_cm: f.pack_l_cm ? Number(f.pack_l_cm) : null,
        pack_w_cm: f.pack_w_cm ? Number(f.pack_w_cm) : null,
        pack_h_cm: f.pack_h_cm ? Number(f.pack_h_cm) : null,
      });
      if (error) throw error;
      onDone();
    } catch (e) { showToast("Erreur", e.message, "error"); setSaving(false); }
  };

  const subs = SUBCATEGORIES[f.type] || [];

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white sm:rounded-2xl w-full max-w-2xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden">
        {/* header + stepper */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold">Nouveau produit</h3>
            <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><i className="fa-solid fa-xmark" /></button>
          </div>
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1 flex items-center gap-1.5">
                <div className={`flex items-center gap-1.5 ${i <= step ? "text-gray-900" : "text-gray-300"}`}>
                  <span className={`w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-gray-900 text-white" : "bg-gray-100"}`}>
                    {i < step ? <i className="fa-solid fa-check" /> : i + 1}
                  </span>
                  <span className="text-[11px] font-bold hidden sm:inline">{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded ${i < step ? "bg-emerald-500" : "bg-gray-100"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* STEP 0 — INFOS */}
          {step === 0 && (
            <>
              <div><label className={label}>Nom du produit *</label><input className={input} value={f.name} onChange={e => set("name", e.target.value)} placeholder="Ex : Casque bluetooth Elite X1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>Catégorie *</label>
                  <select className={input} value={f.type} onChange={e => { set("type", e.target.value); set("subcategory", ""); }}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                </div>
                <div><label className={label}>Sous-catégorie</label>
                  <select className={input} value={f.subcategory} onChange={e => set("subcategory", e.target.value)}>
                    <option value="">—</option>{subs.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>Prix (FCFA) *</label><input className={input} type="number" value={f.price} onChange={e => set("price", e.target.value)} placeholder="15000" /></div>
                <div><label className={label}>Prix barré (optionnel)</label><input className={input} type="number" value={f.compareAt} onChange={e => set("compareAt", e.target.value)} placeholder="20000" /></div>
              </div>
              <div><label className={label}>Disponibilité</label>
                <div className="flex gap-2">
                  {[["In Stock", "En stock"], ["Épuisé", "Épuisé"]].map(([v, l]) => (
                    <button key={v} onClick={() => set("status", v)} className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border-2 ${f.status === v ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-500"}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div><label className={label}>Description</label><textarea className={`${input} resize-none`} rows={3} value={f.description} onChange={e => set("description", e.target.value)} placeholder="Décris ton produit…" /></div>
              <div><label className={label}>Points forts</label>
                <div className="flex gap-2 mb-2">
                  <input className={input} value={featInput} onChange={e => setFeatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addChip("features", featInput, setFeatInput))} placeholder="Ex : Autonomie 40h" />
                  <button onClick={() => addChip("features", featInput, setFeatInput)} className="bg-gray-900 text-white px-4 rounded-xl text-sm font-bold">+</button>
                </div>
                <div className="flex flex-wrap gap-2">{f.features.map(x => <span key={x} className="bg-gray-100 text-[12px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">{x}<button onClick={() => set("features", f.features.filter(y => y !== x))}><i className="fa-solid fa-xmark text-[10px]" /></button></span>)}</div>
              </div>
            </>
          )}

          {/* STEP 1 — PHOTOS */}
          {step === 1 && (
            <div>
              <label className={label}>Photos du produit (max 6) — la 1ʳᵉ est la principale</label>
              <div className="grid grid-cols-3 gap-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    {i === 0 && <span className="absolute top-1 left-1 bg-gray-900 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">Principale</span>}
                    <button onClick={() => removeImage(i)} className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full text-[10px] opacity-0 group-hover:opacity-100"><i className="fa-solid fa-xmark" /></button>
                  </div>
                ))}
                {files.length < 6 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-900 cursor-pointer flex flex-col items-center justify-center text-gray-400">
                    <i className="fa-solid fa-plus text-xl mb-1" /><span className="text-[10px] font-semibold">Ajouter</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && addImages(e.target.files)} />
                  </label>
                )}
              </div>
              {files.length === 0 && <p className="text-[12px] text-orange-500 mt-2">Ajoute au moins une photo pour continuer.</p>}
            </div>
          )}

          {/* STEP 2 — VARIATIONS */}
          {step === 2 && (
            <>
              <div>
                <label className={label}>Couleurs disponibles</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {COLOR_SWATCHES.map(c => (
                    <button key={c.name} onClick={() => toggleArr("colors", c.name)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-[12px] font-semibold ${f.colors.includes(c.name) ? "border-gray-900" : "border-gray-200 text-gray-500"}`}>
                      <span className="w-3.5 h-3.5 rounded-full border border-gray-300" style={{ background: c.hex }} />{c.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className={input} value={colorInput} onChange={e => setColorInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addChip("colors", colorInput, setColorInput))} placeholder="Autre couleur…" />
                  <button onClick={() => addChip("colors", colorInput, setColorInput)} className="bg-gray-900 text-white px-4 rounded-xl text-sm font-bold">+</button>
                </div>
              </div>
              <div>
                <label className={label}>Tailles disponibles</label>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => set("sizes", [...new Set([...f.sizes, ...SIZE_PRESETS.vet])])} className="text-[11px] font-bold bg-gray-100 px-3 py-1.5 rounded-lg">+ Vêtements (S–XXL)</button>
                  <button onClick={() => set("sizes", [...new Set([...f.sizes, ...SIZE_PRESETS.shoes])])} className="text-[11px] font-bold bg-gray-100 px-3 py-1.5 rounded-lg">+ Chaussures (38–45)</button>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {f.sizes.map(s => <span key={s} className="bg-gray-900 text-white text-[12px] font-bold px-3 py-1 rounded-lg flex items-center gap-1.5">{s}<button onClick={() => set("sizes", f.sizes.filter(x => x !== s))}><i className="fa-solid fa-xmark text-[10px]" /></button></span>)}
                </div>
                <div className="flex gap-2">
                  <input className={input} value={sizeInput} onChange={e => setSizeInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addChip("sizes", sizeInput, setSizeInput))} placeholder="Taille personnalisée (ex : Unique, 42mm)…" />
                  <button onClick={() => addChip("sizes", sizeInput, setSizeInput)} className="bg-gray-900 text-white px-4 rounded-xl text-sm font-bold">+</button>
                </div>
              </div>
              <p className="text-[12px] text-gray-400"><i className="fa-solid fa-circle-info mr-1" />Les couleurs et tailles s'afficheront comme options sur la fiche produit. Laisse vide s'il n'y a pas de variante.</p>
            </>
          )}

          {/* STEP 3 — LIVRAISON */}
          {step === 3 && (
            <>
              <p className="text-[12px] text-gray-400 mb-1"><i className="fa-solid fa-truck-fast mr-1" />Utilisé pour calculer les frais de livraison. Optionnel mais recommandé.</p>
              <div><label className={label}>Poids (grammes)</label><input className={input} type="number" value={f.ship_weight_g} onChange={e => set("ship_weight_g", e.target.value)} placeholder="500" /></div>
              <div>
                <label className={label}>Dimensions du colis (cm)</label>
                <div className="grid grid-cols-3 gap-3">
                  <input className={input} type="number" value={f.pack_l_cm} onChange={e => set("pack_l_cm", e.target.value)} placeholder="Long." />
                  <input className={input} type="number" value={f.pack_w_cm} onChange={e => set("pack_w_cm", e.target.value)} placeholder="Larg." />
                  <input className={input} type="number" value={f.pack_h_cm} onChange={e => set("pack_h_cm", e.target.value)} placeholder="Haut." />
                </div>
              </div>
            </>
          )}

          {/* STEP 4 — RÉCAP */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">{previews[0] && <img src={previews[0]} alt="" className="w-full h-full object-cover" />}</div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{f.name || "Sans nom"}</p>
                  <p className="text-[12px] text-gray-500">{f.type}{f.subcategory ? ` · ${f.subcategory}` : ""}</p>
                  <p className="text-lg font-bold mt-1">{Number(f.price || 0).toLocaleString("fr-FR")} F</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${f.status === "Épuisé" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>{f.status === "Épuisé" ? "Épuisé" : "En stock"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div className="bg-gray-50 rounded-xl p-3"><p className="text-gray-400 font-semibold mb-1">Photos</p>{files.length}</div>
                <div className="bg-gray-50 rounded-xl p-3"><p className="text-gray-400 font-semibold mb-1">Couleurs</p>{f.colors.length ? f.colors.join(", ") : "—"}</div>
                <div className="bg-gray-50 rounded-xl p-3"><p className="text-gray-400 font-semibold mb-1">Tailles</p>{f.sizes.length ? f.sizes.join(", ") : "—"}</div>
                <div className="bg-gray-50 rounded-xl p-3"><p className="text-gray-400 font-semibold mb-1">Poids</p>{f.ship_weight_g ? `${f.ship_weight_g} g` : "—"}</div>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <button onClick={() => step === 0 ? onClose() : setStep(s => s - 1)} className="px-4 py-2.5 rounded-xl text-[12px] font-bold text-gray-500 hover:bg-gray-100">
            {step === 0 ? "Annuler" : "Retour"}
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => valid[step] && setStep(s => s + 1)} disabled={!valid[step]}
              className="px-6 py-2.5 rounded-xl text-[12px] font-bold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40">
              Continuer
            </button>
          ) : (
            <button onClick={publish} disabled={saving}
              className="px-6 py-2.5 rounded-xl text-[12px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
              {saving ? "Publication…" : "Publier le produit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddProductWizard;
