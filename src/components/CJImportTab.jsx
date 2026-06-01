import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { cjListProducts, cjGetCategories, mapCjToProduct, mapOfsType, usdToFcfa } from "../lib/cjApi";

const PAGE_SIZE = 100;

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type = "ok" }) => (
  <div className={`fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl font-bold text-sm shadow-2xl flex items-center gap-3 border ${
    type === "ok"    ? "bg-[#131921] text-[#FF9900] border-[#232F3E]" :
    type === "error" ? "bg-[#FEE7E5] text-[#B12704] border-[#B12704]/30" :
                       "bg-[#E8F5E8] text-[#007600] border-[#007600]/30"
  }`}>
    <i className={`fa-solid ${type === "ok" ? "fa-spinner animate-spin" : type === "error" ? "fa-xmark" : "fa-check"} text-sm`}></i>
    {msg}
  </div>
);

// ─── Product card ─────────────────────────────────────────────────────────────
const CJCard = ({ product, selected, onToggle, onImport, importing }) => {
  const price = usdToFcfa(product.sellPrice || product.productPrice || 0);
  const type  = mapOfsType(product.categoryName || "");
  return (
    <div
      onClick={() => onToggle(product.pid)}
      className={`relative bg-white border-2 rounded-xl overflow-hidden transition-all cursor-pointer group ${
        selected ? "border-[#FF9900] shadow-[0_0_0_3px_rgba(255,153,0,0.15)]" : "border-[#D5D9D9] hover:border-[#FF9900]/50"
      }`}
    >
      <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
        selected ? "bg-[#FF9900] border-[#FF9900]" : "bg-white/90 border-[#D5D9D9]"
      }`}>
        {selected && <i className="fa-solid fa-check text-[#0F1111] text-[8px]"></i>}
      </div>
      <div className="absolute top-2 right-2 z-10 bg-[#232F3E]/90 text-[#FF9900] text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">{type}</div>
      <div className="aspect-square bg-[#F3F4F4] overflow-hidden">
        {product.productImage
          ? <img src={product.productImage} alt={product.productNameEn} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-image text-[#D5D9D9] text-3xl"></i></div>}
      </div>
      <div className="p-2.5">
        <p className="text-[11px] font-bold text-[#0F1111] leading-tight line-clamp-2 mb-1.5">{product.productNameEn || product.productName}</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#565959]">${product.sellPrice || "—"} USD</p>
            <p className="text-sm font-bold text-[#B12704]">{price.toLocaleString()} F</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onImport([product]); }}
            disabled={importing}
            className="w-8 h-8 bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-50 border border-[#FCD200] rounded-lg flex items-center justify-center transition-all active:scale-95"
          >
            <i className="fa-solid fa-plus text-[#0F1111] text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const CJImportTab = () => {
  const { user } = useAuth();

  // Products
  const [products,    setProducts]   = useState([]);
  const [total,       setTotal]      = useState(0);
  const [page,        setPage]       = useState(1);
  const [pageInput,   setPageInput]  = useState("1");
  const [search,      setSearch]     = useState("");
  const [loading,     setLoading]    = useState(false);
  const [fetchError,  setFetchError] = useState(null);

  // Categories
  const [categories,  setCategories]  = useState([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catSearch,   setCatSearch]   = useState("");
  const [catSort,     setCatSort]     = useState("name"); // "name" | "count"
  const [selCatId,    setSelCatId]    = useState("");
  const [selCatName,  setSelCatName]  = useState("");
  const [showCats,    setShowCats]    = useState(false);

  // Selection & import
  const [selected,       setSelected]       = useState(new Set());
  const [importing,      setImporting]      = useState(false);
  const [importProg,     setImportProg]     = useState({ done: 0, total: 0 });
  const [toast,          setToast]          = useState(null);
  const [alreadyCount,   setAlreadyCount]   = useState(0);
  const [showImportN,    setShowImportN]    = useState(false);
  const [importNValue,   setImportNValue]   = useState("");

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const isBulkMode = importProg.total > 0;

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Count already imported platform products
  useEffect(() => {
    supabase.from("products").select("id", { count: "exact", head: true }).is("vendor_id", null)
      .then(({ count }) => setAlreadyCount(count || 0));
  }, []);

  // Load CJ categories (flatten hierarchy)
  const loadCategories = useCallback(async () => {
    setCatsLoading(true);
    try {
      const data = await cjGetCategories();
      const flat = [];
      const walk = (cats) => {
        if (!Array.isArray(cats)) return;
        cats.forEach(c => {
          flat.push({ id: c.categoryId, name: c.categoryName, type: c.categoryType || 1, count: c.productCount || 0 });
          if (c.children?.length) walk(c.children);
        });
      };
      walk(Array.isArray(data) ? data : (data?.list || []));
      setCategories(flat);
    } catch (err) {
      console.error("[CJ cats]", err.message);
    } finally {
      setCatsLoading(false);
    }
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async (p, q, catId) => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await cjListProducts(p, PAGE_SIZE, q, catId);
      setProducts(data?.list || []);
      setTotal(data?.total || 0);
      setPage(p);
      setPageInput(String(p));
    } catch (err) {
      console.error("[CJ]", err.message);
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) { fetchProducts(1, "", ""); loadCategories(); }
  }, [user]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProducts(1, search, selCatId);
  };

  const handlePageJump = (e) => {
    e.preventDefault();
    const n = parseInt(pageInput, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) fetchProducts(n, search, selCatId);
  };

  const selectCategory = (cat) => {
    setSelCatId(cat.id);
    setSelCatName(cat.name);
    setShowCats(false);
    setSearch("");
    fetchProducts(1, "", cat.id);
  };

  const clearCategory = () => {
    setSelCatId("");
    setSelCatName("");
    fetchProducts(1, search, "");
  };

  // Selection helpers
  const toggleSelect = (pid) => setSelected(prev => {
    const next = new Set(prev);
    next.has(pid) ? next.delete(pid) : next.add(pid);
    return next;
  });
  const selectAll = () => setSelected(new Set(products.map(p => p.pid)));
  const clearAll  = () => setSelected(new Set());

  // Batch insert helper
  const doInsert = async (list) => {
    const BATCH = 20;
    let done = 0;
    for (let i = 0; i < list.length; i += BATCH) {
      const { error } = await supabase.from("products").insert(list.slice(i, i + BATCH).map(mapCjToProduct));
      if (error) console.warn("[Import]", error.message);
      done += batch.length;  // will be fixed below
      setImportProg(prev => ({ ...prev, done: prev.done + list.slice(i, i + BATCH).length }));
    }
    return done;
  };

  const importProducts = async (list) => {
    if (!list.length) return;
    setImporting(true);
    setImportProg({ done: 0, total: list.length });
    let done = 0;
    try {
      const BATCH = 20;
      for (let i = 0; i < list.length; i += BATCH) {
        const batch = list.slice(i, i + BATCH).map(mapCjToProduct);
        const { error } = await supabase.from("products").insert(batch);
        if (error) console.warn("[Import]", error.message);
        done += batch.length;
        setImportProg({ done, total: list.length });
      }
      showToast(`${done} produits importés !`, "success");
      setSelected(new Set());
      setAlreadyCount(c => c + done);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setImporting(false);
      setImportProg({ done: 0, total: 0 });
    }
  };

  const importSelected = () => importProducts(products.filter(p => selected.has(p.pid)));

  // Import exactly N products from current query
  const importN = async () => {
    const n = parseInt(importNValue, 10);
    if (!n || n <= 0) return;
    setShowImportN(false);
    setImporting(true);
    setImportProg({ done: 0, total: n });
    let collected = [];
    for (let p = 1; collected.length < n; p++) {
      try {
        const data = await cjListProducts(p, PAGE_SIZE, search, selCatId);
        const list = data?.list || [];
        if (!list.length) break;
        collected = [...collected, ...list];
        if (collected.length >= n || collected.length >= (data?.total || 0)) break;
        await new Promise(r => setTimeout(r, 200));
      } catch { break; }
    }
    const toImport = collected.slice(0, n);
    let done = 0;
    try {
      const BATCH = 20;
      for (let i = 0; i < toImport.length; i += BATCH) {
        const batch = toImport.slice(i, i + BATCH).map(mapCjToProduct);
        await supabase.from("products").insert(batch);
        done += batch.length;
        setImportProg({ done, total: toImport.length });
      }
      showToast(`${done} produits importés !`, "success");
      setAlreadyCount(c => c + done);
    } catch (err) { showToast(err.message, "error"); }
    setImporting(false);
    setImportProg({ done: 0, total: 0 });
    setImportNValue("");
  };

  // Import all from current category/search
  const importAll = async () => {
    const cap = Math.min(total, 5000);
    if (!window.confirm(`Importer jusqu'à ${cap.toLocaleString()} produits${selCatName ? ` de "${selCatName}"` : ""}?\n\nCela peut prendre plusieurs minutes.`)) return;
    setImporting(true);
    setImportProg({ done: 0, total: cap });
    let done = 0;
    for (let p = 1; done < cap; p++) {
      try {
        const data = await cjListProducts(p, PAGE_SIZE, search, selCatId);
        const list = data?.list || [];
        if (!list.length) break;
        const BATCH = 50;
        for (let i = 0; i < list.length; i += BATCH) {
          await supabase.from("products").insert(list.slice(i, i + BATCH).map(mapCjToProduct));
        }
        done += list.length;
        setImportProg({ done, total: cap });
        await new Promise(r => setTimeout(r, 300));
      } catch { break; }
    }
    showToast(`Import terminé : ${done} produits ajoutés`, "success");
    setAlreadyCount(c => c + done);
    setImporting(false);
    setImportProg({ done: 0, total: 0 });
  };

  // Filtered + sorted categories
  const filteredCats = categories
    .filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()))
    .sort((a, b) => catSort === "name" ? a.name.localeCompare(b.name) : b.count - a.count);

  // Pagination pages to show
  const pagesWindow = (() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    return [...Array(Math.min(5, totalPages))].map((_, i) => start + i);
  })();

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Error banner */}
      {fetchError && (
        <div className="bg-[#FEE7E5] border border-[#B12704]/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <i className="fa-solid fa-triangle-exclamation text-[#B12704] flex-shrink-0"></i>
            <p className="text-[#B12704] text-sm font-semibold truncate">{fetchError}</p>
          </div>
          <button onClick={() => fetchProducts(page, search, selCatId)}
            className="flex-shrink-0 px-3 py-1.5 bg-[#B12704] text-white rounded-lg text-xs font-bold hover:bg-[#8b1e02] transition-colors flex items-center gap-1.5">
            <i className="fa-solid fa-rotate text-[10px]"></i>Réessayer
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#131921] rounded-2xl overflow-hidden">
        <div className="bg-[#232F3E] px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF9900]/15 rounded-xl flex items-center justify-center border border-[#FF9900]/30">
              <i className="fa-solid fa-circle-nodes text-[#FF9900] text-base"></i>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[#FF9900]">CJ Dropshipping · Connecté</p>
              <p className="text-white font-bold text-base">Catalogue fournisseur</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {selCatName && (
              <div className="flex items-center gap-2 bg-[#FF9900]/15 border border-[#FF9900]/30 rounded-lg px-3 py-1.5">
                <i className="fa-solid fa-layer-group text-[#FF9900] text-[10px]"></i>
                <span className="text-[#FF9900] text-[11px] font-bold max-w-[150px] truncate">{selCatName}</span>
                <button onClick={clearCategory} className="text-[#FF9900]/60 hover:text-[#FF9900] transition-colors">
                  <i className="fa-solid fa-xmark text-[10px]"></i>
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#007600] animate-pulse"></div>
              <span className="text-[#007600] text-[10px] font-black uppercase">API Active</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 divide-x divide-[#232F3E]">
          {[
            { icon: "fa-boxes-stacked",  label: "Total CJ",       value: total.toLocaleString(),        color: "#FF9900" },
            { icon: "fa-layer-group",    label: "Catégories",      value: categories.length || "…",      color: "#FFD814" },
            { icon: "fa-store",          label: "Importés OFS",    value: alreadyCount.toLocaleString(), color: "#007185" },
            { icon: "fa-file-lines",     label: "100 / page",      value: `p.${page}/${totalPages||"…"}`,color: "#007600" },
          ].map(s => (
            <div key={s.label} className="px-4 py-3 flex flex-col gap-0.5">
              <p className="text-[8px] font-black uppercase tracking-widest text-[#565959]">{s.label}</p>
              <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk import progress */}
      {isBulkMode ? (
        <div className="bg-white border border-[#D5D9D9] rounded-2xl overflow-hidden">
          <div className="bg-[#232F3E] px-5 py-3 flex items-center gap-3">
            <i className="fa-solid fa-spinner animate-spin text-[#FF9900]"></i>
            <span className="font-black text-white text-sm">Import en cours…</span>
            <span className="text-[#ADBAC7] text-sm">{importProg.done} / {importProg.total} produits</span>
          </div>
          <div className="p-5 space-y-2">
            <div className="h-3 bg-[#EAEDED] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#FF9900] to-[#FFD814] rounded-full transition-all duration-300"
                style={{ width: `${importProg.total ? (importProg.done / importProg.total) * 100 : 0}%` }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#565959]">Ne fermez pas cette page</span>
              <span className="font-bold">{importProg.total ? Math.round((importProg.done / importProg.total) * 100) : 0}%</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Search + action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#FF9900] text-sm"></i>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher dans CJ…"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-xl text-sm placeholder-[#ADBAC7] transition-colors" />
              </div>
              <button type="submit" disabled={loading}
                className="px-4 py-2.5 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] rounded-xl font-bold text-sm border border-[#FCD200] transition-all flex items-center gap-2">
                {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
              </button>
            </form>

            <div className="flex gap-2 flex-shrink-0">
              {/* Categories toggle */}
              <button onClick={() => setShowCats(v => !v)}
                className={`px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider border transition-all flex items-center gap-2 ${
                  showCats ? "bg-[#FF9900] text-[#0F1111] border-[#FF9900]" : "bg-[#232F3E] text-[#FF9900] border-[#FF9900]/20 hover:bg-[#131921]"
                }`}>
                <i className="fa-solid fa-layer-group"></i>
                <span className="hidden sm:inline">Catégories</span>
                {categories.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] ${showCats ? "bg-[#0F1111]/20" : "bg-[#FF9900]/20"}`}>{categories.length}</span>
                )}
              </button>

              {/* Import N */}
              <button onClick={() => setShowImportN(v => !v)}
                className="px-4 py-2.5 bg-white hover:bg-[#EAEDED] text-[#0F1111] rounded-xl font-black text-[11px] uppercase tracking-wider border border-[#D5D9D9] transition-all flex items-center gap-2">
                <i className="fa-solid fa-hashtag"></i>
                <span className="hidden sm:inline">Importer N</span>
              </button>

              {/* Import all */}
              <button onClick={importAll} disabled={importing || !total}
                className="px-4 py-2.5 bg-[#131921] hover:bg-[#0a0e15] text-[#FF9900] rounded-xl font-black text-[11px] uppercase tracking-wider border border-[#FF9900]/20 transition-all flex items-center gap-2">
                <i className="fa-solid fa-bolt"></i>
                <span className="hidden sm:inline">Tout importer</span>
              </button>
            </div>
          </div>

          {/* Import N panel */}
          {showImportN && (
            <div className="bg-[#131921] border border-[#232F3E] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">Importer un nombre précis</p>
                <p className="text-[#ADBAC7] text-xs mt-0.5 truncate">
                  {selCatName ? `Catégorie : "${selCatName}"` : "Catalogue général"}{search ? ` · "${search}"` : ""}
                  {total > 0 && ` · ${total.toLocaleString()} disponibles`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min="1" max={Math.min(total, 5000)} value={importNValue}
                  onChange={e => setImportNValue(e.target.value)}
                  placeholder="ex: 200"
                  className="w-28 px-3 py-2 bg-[#232F3E] border border-[#FF9900]/30 focus:border-[#FF9900] rounded-lg text-white text-sm text-center focus:outline-none" />
                <button onClick={importN} disabled={!importNValue || importing}
                  className="px-4 py-2 bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-50 text-[#0F1111] rounded-lg font-black text-xs uppercase tracking-wider border border-[#FCD200] transition-all">
                  Importer
                </button>
                <button onClick={() => { setShowImportN(false); setImportNValue(""); }}
                  className="w-8 h-8 rounded-lg bg-[#232F3E] text-[#ADBAC7] hover:text-white flex items-center justify-center transition-colors">
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              </div>
            </div>
          )}

          {/* Categories panel */}
          {showCats && (
            <div className="bg-[#131921] border border-[#232F3E] rounded-2xl overflow-hidden">
              <div className="bg-[#232F3E] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-layer-group text-[#FF9900]"></i>
                  <span className="text-white font-bold text-sm">Catégories CJ</span>
                  <span className="text-[#ADBAC7] text-xs">({filteredCats.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[#ADBAC7] text-[10px]"></i>
                    <input type="text" value={catSearch} onChange={e => setCatSearch(e.target.value)}
                      placeholder="Filtrer…"
                      className="pl-7 pr-3 py-1.5 bg-[#131921] border border-[#FF9900]/20 focus:border-[#FF9900] rounded-lg text-white text-xs w-40 focus:outline-none placeholder-[#ADBAC7]" />
                  </div>
                  <select value={catSort} onChange={e => setCatSort(e.target.value)}
                    className="px-2 py-1.5 bg-[#131921] border border-[#FF9900]/20 rounded-lg text-[#ADBAC7] text-xs focus:outline-none cursor-pointer">
                    <option value="name">Trier A–Z</option>
                    <option value="count">Par produits</option>
                  </select>
                </div>
              </div>

              {catsLoading ? (
                <div className="p-8 flex items-center justify-center gap-3">
                  <i className="fa-solid fa-spinner animate-spin text-[#FF9900]"></i>
                  <span className="text-[#ADBAC7] text-sm">Chargement des catégories…</span>
                </div>
              ) : filteredCats.length === 0 ? (
                <div className="p-8 text-center text-[#565959] text-sm">Aucune catégorie trouvée</div>
              ) : (
                <div className="p-3 max-h-72 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
                  {filteredCats.map(cat => (
                    <button key={cat.id} onClick={() => selectCategory(cat)}
                      className={`text-left px-3 py-2.5 rounded-xl text-xs transition-all border group ${
                        selCatId === cat.id
                          ? "bg-[#FF9900]/20 border-[#FF9900]/40 text-[#FF9900] font-bold"
                          : "bg-[#232F3E]/50 border-[#232F3E] text-[#ADBAC7] hover:bg-[#232F3E] hover:text-white hover:border-[#FF9900]/20"
                      }`}>
                      <p className="font-semibold leading-tight truncate">{cat.name}</p>
                      {cat.count > 0 && (
                        <p className="text-[9px] mt-0.5 opacity-60">{cat.count.toLocaleString()} produits</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Selection bar */}
      {selected.size > 0 && !isBulkMode && (
        <div className="bg-[#FFF8D3] border border-[#FCD200]/50 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#FF9900] rounded-full flex items-center justify-center">
              <i className="fa-solid fa-check text-[#0F1111] text-[9px]"></i>
            </div>
            <span className="font-bold text-[#C45500] text-sm">
              {selected.size} produit{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={clearAll} className="text-xs text-[#565959] hover:text-[#C45500] font-bold transition-colors">
              Tout désélectionner
            </button>
            <button onClick={importSelected} disabled={importing}
              className="flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-50 text-[#0F1111] px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider border border-[#FCD200] transition-all">
              <i className="fa-solid fa-cloud-arrow-up"></i>
              Importer la sélection
            </button>
          </div>
        </div>
      )}

      {/* Product grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
              <div className="aspect-square bg-[#F3F4F4]"></div>
              <div className="p-2.5 space-y-1.5">
                <div className="h-3 bg-[#F3F4F4] rounded w-full"></div>
                <div className="h-3 bg-[#F3F4F4] rounded w-2/3"></div>
                <div className="h-5 bg-[#F3F4F4] rounded w-1/2 mt-2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 && !fetchError ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-[#F3F4F4] rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-box-open text-[#D5D9D9] text-2xl"></i>
          </div>
          <p className="font-bold text-[#565959]">Aucun produit trouvé</p>
          <p className="text-sm text-[#ADBAC7] mt-1">Essayez une autre catégorie ou terme de recherche</p>
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#565959]">
              {products.length} produits affichés · {total.toLocaleString()} au total
              {selCatName ? ` dans "${selCatName}"` : ""}
            </p>
            <button onClick={selected.size === products.length ? clearAll : selectAll}
              className="text-xs text-[#007185] hover:text-[#C45500] font-bold transition-colors">
              {selected.size === products.length ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map(p => (
              <CJCard key={p.pid} product={p} selected={selected.has(p.pid)}
                onToggle={toggleSelect} onImport={importProducts} importing={importing} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-4 flex-wrap">
              {/* First */}
              <button onClick={() => fetchProducts(1, search, selCatId)} disabled={page === 1 || loading}
                className="w-9 h-9 rounded-xl border border-[#D5D9D9] bg-white hover:border-[#FF9900] disabled:opacity-40 flex items-center justify-center transition-colors">
                <i className="fa-solid fa-angles-left text-[#565959] text-[10px]"></i>
              </button>
              {/* Prev */}
              <button onClick={() => fetchProducts(page - 1, search, selCatId)} disabled={page === 1 || loading}
                className="w-9 h-9 rounded-xl border border-[#D5D9D9] bg-white hover:border-[#FF9900] disabled:opacity-40 flex items-center justify-center transition-colors">
                <i className="fa-solid fa-chevron-left text-[#565959] text-xs"></i>
              </button>

              {/* Page numbers */}
              {pagesWindow.map(n => (
                <button key={n} onClick={() => fetchProducts(n, search, selCatId)}
                  className={`w-9 h-9 rounded-xl border text-sm font-bold transition-all ${
                    n === page ? "bg-[#232F3E] text-[#FF9900] border-[#FF9900]/30" : "bg-white border-[#D5D9D9] text-[#565959] hover:border-[#FF9900]/50"
                  }`}>
                  {n}
                </button>
              ))}

              {/* Next */}
              <button onClick={() => fetchProducts(page + 1, search, selCatId)} disabled={page === totalPages || loading}
                className="w-9 h-9 rounded-xl border border-[#D5D9D9] bg-white hover:border-[#FF9900] disabled:opacity-40 flex items-center justify-center transition-colors">
                <i className="fa-solid fa-chevron-right text-[#565959] text-xs"></i>
              </button>
              {/* Last */}
              <button onClick={() => fetchProducts(totalPages, search, selCatId)} disabled={page === totalPages || loading}
                className="w-9 h-9 rounded-xl border border-[#D5D9D9] bg-white hover:border-[#FF9900] disabled:opacity-40 flex items-center justify-center transition-colors">
                <i className="fa-solid fa-angles-right text-[#565959] text-[10px]"></i>
              </button>

              {/* Page jump */}
              <form onSubmit={handlePageJump} className="flex items-center gap-1.5 ml-3">
                <span className="text-[10px] text-[#565959] hidden sm:block">Aller à</span>
                <input type="number" min="1" max={totalPages} value={pageInput}
                  onChange={e => setPageInput(e.target.value)}
                  className="w-16 text-center px-2 py-1.5 border border-[#D5D9D9] focus:border-[#FF9900] rounded-lg text-sm font-bold focus:outline-none" />
                <span className="text-[10px] text-[#565959]">/{totalPages}</span>
                <button type="submit"
                  className="px-3 py-1.5 bg-[#232F3E] hover:bg-[#131921] text-[#FF9900] rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors">
                  OK
                </button>
              </form>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default CJImportTab;
