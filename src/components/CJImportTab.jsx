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
    <div onClick={() => onToggle(product.pid)}
      className={`relative bg-white border-2 rounded-xl overflow-hidden transition-all cursor-pointer group ${
        selected ? "border-[#FF9900] shadow-[0_0_0_3px_rgba(255,153,0,0.15)]" : "border-[#D5D9D9] hover:border-[#FF9900]/50"
      }`}>
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
          <button onClick={e => { e.stopPropagation(); onImport([product]); }} disabled={importing}
            className="w-8 h-8 bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-50 border border-[#FCD200] rounded-lg flex items-center justify-center transition-all active:scale-95">
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
  const [products,   setProducts]   = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [pageInput,  setPageInput]  = useState("1");
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Categories
  const [categories,  setCategories]  = useState([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catSearch,   setCatSearch]   = useState("");
  const [catSort,     setCatSort]     = useState("name");
  const [selCatId,    setSelCatId]    = useState("");
  const [selCatName,  setSelCatName]  = useState("");
  const [showCats,    setShowCats]    = useState(false);
  const [catSelected, setCatSelected] = useState(new Set()); // multi-select checkboxes
  const [defaultImportN, setDefaultImportN] = useState(100); // default count for bulk-add-to-queue

  // Import queue (multi-category)
  const [queue,       setQueue]       = useState([]); // [{ id, name, count, status, imported }]
  const [showQueue,   setShowQueue]   = useState(false);
  const [batchRunning,setBatchRunning]= useState(false);
  const [batchLog,    setBatchLog]    = useState([]);

  // Selection & import
  const [selected,     setSelected]     = useState(new Set());
  const [importing,    setImporting]    = useState(false);
  const [importProg,   setImportProg]   = useState({ done: 0, total: 0 });
  const [toast,        setToast]        = useState(null);
  const [alreadyCount, setAlreadyCount] = useState(0);
  const [showImportN,  setShowImportN]  = useState(false);
  const [importNValue, setImportNValue] = useState("");

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const isBulkMode = importProg.total > 0 || batchRunning;

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    supabase.from("products").select("id", { count: "exact", head: true }).is("vendor_id", null)
      .then(({ count }) => setAlreadyCount(count || 0));
  }, []);

  const [catsError, setCatsError] = useState(null);

  const loadCategories = useCallback(async () => {
    setCatsLoading(true);
    setCatsError(null);
    try {
      const data = await cjGetCategories();
      console.log("[CJ cats raw]", JSON.stringify(data)?.slice(0, 500));

      const flat = [];
      const walk = (cats) => {
        if (!cats) return;
        // Handle both array and object with children
        const list = Array.isArray(cats) ? cats : Object.values(cats);
        list.forEach(c => {
          if (!c || typeof c !== "object") return;
          const id   = c.categoryId   || c.id;
          const name = c.categoryName || c.name;
          if (id && name) {
            flat.push({ id, name, type: c.categoryType || 1, count: c.productCount || c.count || 0 });
          }
          // Recurse into children (any field that is an array of objects)
          if (c.children?.length)          walk(c.children);
          if (c.categoryList?.length)      walk(c.categoryList);
          if (c.subCategoryList?.length)   walk(c.subCategoryList);
        });
      };

      // Try all known response shapes
      if (Array.isArray(data))              walk(data);
      else if (Array.isArray(data?.list))   walk(data.list);
      else if (Array.isArray(data?.data))   walk(data.data);
      else                                  walk(data);

      console.log("[CJ cats parsed]", flat.length, "catégories");
      if (flat.length === 0) setCatsError(`Aucune catégorie reçue. Réponse brute : ${JSON.stringify(data)?.slice(0, 200)}`);
      setCategories(flat);
    } catch (err) {
      console.error("[CJ cats]", err);
      setCatsError(err.message);
    } finally {
      setCatsLoading(false);
    }
  }, []);

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

  const handleSearch = (e) => { e.preventDefault(); fetchProducts(1, search, selCatId); };

  const handlePageJump = (e) => {
    e.preventDefault();
    const n = parseInt(pageInput, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) fetchProducts(n, search, selCatId);
  };

  const selectCategory = (cat) => {
    setSelCatId(cat.id); setSelCatName(cat.name);
    setShowCats(false); setSearch("");
    fetchProducts(1, "", cat.id);
  };

  const clearCategory = () => { setSelCatId(""); setSelCatName(""); fetchProducts(1, search, ""); };

  // Selection helpers
  const toggleSelect = (pid) => setSelected(prev => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  const selectAll    = () => setSelected(new Set(products.map(p => p.pid)));
  const clearAll     = () => setSelected(new Set());

  // Core insert helper
  const batchInsert = async (list, onProgress) => {
    const BATCH = 20;
    let done = 0;
    for (let i = 0; i < list.length; i += BATCH) {
      const batch = list.slice(i, i + BATCH).map(mapCjToProduct);
      const { error } = await supabase.from("products").insert(batch);
      if (error) console.warn("[Insert]", error.message);
      done += batch.length;
      onProgress?.(done);
    }
    return done;
  };

  // Fetch N products from CJ for a given catId/search
  const fetchN = async (n, q, catId) => {
    let collected = [];
    for (let p = 1; collected.length < n; p++) {
      const data = await cjListProducts(p, PAGE_SIZE, q, catId);
      const list = data?.list || [];
      if (!list.length) break;
      collected = [...collected, ...list];
      if (collected.length >= (data?.total || 0)) break;
      await new Promise(r => setTimeout(r, 200));
    }
    return collected.slice(0, n);
  };

  // Import visible selection
  const importProducts = async (list) => {
    if (!list.length) return;
    setImporting(true);
    setImportProg({ done: 0, total: list.length });
    try {
      const done = await batchInsert(list, (d) => setImportProg({ done: d, total: list.length }));
      showToast(`${done} produits importés !`, "success");
      setSelected(new Set());
      setAlreadyCount(c => c + done);
    } catch (err) { showToast(err.message, "error"); }
    finally { setImporting(false); setImportProg({ done: 0, total: 0 }); }
  };

  const importSelected = () => importProducts(products.filter(p => selected.has(p.pid)));

  // Import N from current context
  const importN = async () => {
    const n = parseInt(importNValue, 10);
    if (!n || n <= 0) return;
    setShowImportN(false);
    setImporting(true);
    setImportProg({ done: 0, total: n });
    try {
      const list = await fetchN(n, search, selCatId);
      setImportProg({ done: 0, total: list.length });
      const done = await batchInsert(list, (d) => setImportProg({ done: d, total: list.length }));
      showToast(`${done} produits importés !`, "success");
      setAlreadyCount(c => c + done);
    } catch (err) { showToast(err.message, "error"); }
    finally { setImporting(false); setImportProg({ done: 0, total: 0 }); setImportNValue(""); }
  };

  // Import all from current context
  const importAll = async () => {
    const cap = Math.min(total, 5000);
    if (!cap || !window.confirm(`Importer jusqu'à ${cap.toLocaleString()} produits${selCatName ? ` de "${selCatName}"` : ""}?\n\nCela peut prendre plusieurs minutes.`)) return;
    setImporting(true);
    setImportProg({ done: 0, total: cap });
    let done = 0;
    for (let p = 1; done < cap; p++) {
      try {
        const data = await cjListProducts(p, PAGE_SIZE, search, selCatId);
        const list = data?.list || [];
        if (!list.length) break;
        const inserted = await batchInsert(list, () => {});
        done += inserted;
        setImportProg({ done, total: cap });
        await new Promise(r => setTimeout(r, 300));
      } catch { break; }
    }
    showToast(`Import terminé : ${done} produits ajoutés`, "success");
    setAlreadyCount(c => c + done);
    setImporting(false);
    setImportProg({ done: 0, total: 0 });
  };

  // ── Queue (multi-category batch) ─────────────────────────────────────────────
  const addToQueue = (cat) => {
    if (queue.find(q => q.id === cat.id)) return; // already in queue
    setQueue(prev => [...prev, { id: cat.id, name: cat.name, count: 100, status: "pending", imported: 0 }]);
    setShowQueue(true);
  };

  const removeFromQueue = (id) => setQueue(prev => prev.filter(q => q.id !== id));

  const updateQueueCount = (id, count) => {
    const n = Math.max(1, Math.min(5000, parseInt(count, 10) || 1));
    setQueue(prev => prev.map(q => q.id === id ? { ...q, count: n } : q));
  };

  const runBatchImport = async () => {
    if (!queue.length) return;
    setBatchRunning(true);
    setBatchLog([]);
    let totalImported = 0;

    for (const item of queue) {
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "importing", imported: 0 } : q));
      setBatchLog(prev => [...prev, { id: item.id, name: item.name, msg: `Démarrage… (${item.count} produits)`, ok: null }]);
      try {
        const list = await fetchN(item.count, "", item.id);
        let done = 0;
        await batchInsert(list, (d) => {
          done = d;
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, imported: d } : q));
        });
        totalImported += done;
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "done", imported: done } : q));
        setBatchLog(prev => prev.map(l => l.id === item.id ? { ...l, msg: `✓ ${done} produits importés`, ok: true } : l));
        setAlreadyCount(c => c + done);
      } catch (err) {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "error" } : q));
        setBatchLog(prev => prev.map(l => l.id === item.id ? { ...l, msg: `Erreur : ${err.message}`, ok: false } : l));
      }
      await new Promise(r => setTimeout(r, 400));
    }

    showToast(`Batch terminé : ${totalImported} produits importés au total`, "success");
    setBatchRunning(false);
  };

  const clearQueue = () => { setQueue([]); setBatchLog([]); };

  const queueTotal = queue.reduce((s, q) => s + q.count, 0);

  // Filtered + sorted categories
  const filteredCats = categories
    .filter(c => (c.name || "").toLowerCase().includes((catSearch || "").toLowerCase()))
    .sort((a, b) => catSort === "name" ? (a.name || "").localeCompare(b.name || "") : b.count - a.count);

  const pagesWindow = (() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    return [...Array(Math.min(5, totalPages))].map((_, i) => start + i);
  })();

  const statusColor = { pending: "#ADBAC7", importing: "#FF9900", done: "#007600", error: "#B12704" };
  const statusIcon  = { pending: "fa-clock", importing: "fa-spinner fa-spin", done: "fa-check", error: "fa-xmark" };

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Error */}
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

      {/* Header stats */}
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
            {queue.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#232F3E] border border-[#FF9900]/20 rounded-lg px-3 py-1.5">
                <i className="fa-solid fa-list-check text-[#FFD814] text-[10px]"></i>
                <span className="text-[#FFD814] text-[11px] font-bold">{queue.length} cat. · {queueTotal.toLocaleString()} produits</span>
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
            { label: "Total CJ",     value: total.toLocaleString(),        color: "#FF9900" },
            { label: "Catégories",   value: categories.length || "…",      color: "#FFD814" },
            { label: "Importés OFS", value: alreadyCount.toLocaleString(), color: "#007185" },
            { label: `Page ${page}/${totalPages||"…"}`, value: `${products.length} affichés`, color: "#007600" },
          ].map(s => (
            <div key={s.label} className="px-4 py-3">
              <p className="text-[8px] font-black uppercase tracking-widest text-[#565959]">{s.label}</p>
              <p className="text-base font-black mt-0.5" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk import progress */}
      {(importProg.total > 0 || batchRunning) ? (
        <div className="bg-white border border-[#D5D9D9] rounded-2xl overflow-hidden">
          <div className="bg-[#232F3E] px-5 py-3 flex items-center gap-3">
            <i className="fa-solid fa-spinner animate-spin text-[#FF9900]"></i>
            <span className="font-black text-white text-sm">Import en cours…</span>
            {importProg.total > 0 && (
              <span className="text-[#ADBAC7] text-sm">{importProg.done} / {importProg.total} produits</span>
            )}
          </div>
          {importProg.total > 0 && (
            <div className="p-5 space-y-2">
              <div className="h-3 bg-[#EAEDED] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#FF9900] to-[#FFD814] rounded-full transition-all duration-300"
                  style={{ width: `${(importProg.done / importProg.total) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#565959]">Ne fermez pas cette page</span>
                <span className="font-bold">{Math.round((importProg.done / importProg.total) * 100)}%</span>
              </div>
            </div>
          )}
          {batchRunning && batchLog.length > 0 && (
            <div className="px-5 pb-5 space-y-1.5 max-h-48 overflow-y-auto">
              {batchLog.map(l => (
                <div key={l.id} className="flex items-center gap-2 text-xs">
                  <i className={`fa-solid ${l.ok === null ? "fa-spinner animate-spin text-[#FF9900]" : l.ok ? "fa-check text-[#007600]" : "fa-xmark text-[#B12704]"} w-3`}></i>
                  <span className="font-bold text-[#0F1111] truncate max-w-[120px]">{l.name}</span>
                  <span className="text-[#565959] truncate">{l.msg}</span>
                </div>
              ))}
            </div>
          )}
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
                className="px-4 py-2.5 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] rounded-xl font-bold border border-[#FCD200] transition-all flex items-center gap-2">
                {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
              </button>
            </form>
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              <button onClick={() => setShowCats(v => !v)}
                className={`px-3 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                  showCats ? "bg-[#FF9900] text-[#0F1111] border-[#FF9900]" : "bg-[#232F3E] text-[#FF9900] border-[#FF9900]/20 hover:bg-[#131921]"
                }`}>
                <i className="fa-solid fa-layer-group"></i>
                <span className="hidden sm:inline">Catégories</span>
                {categories.length > 0 && <span className={`px-1 py-0.5 rounded text-[9px] ${showCats ? "bg-black/20" : "bg-[#FF9900]/20"}`}>{categories.length}</span>}
              </button>
              <button onClick={() => { setShowQueue(v => !v); if (queue.length === 0) setShowCats(true); }}
                className={`px-3 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                  showQueue ? "bg-[#FFD814] text-[#0F1111] border-[#FFD814]" : "bg-white text-[#0F1111] border-[#D5D9D9] hover:border-[#FF9900]/50"
                }`}>
                <i className="fa-solid fa-list-check"></i>
                <span className="hidden sm:inline">File</span>
                {queue.length > 0 && <span className="bg-[#FF9900] text-[#0F1111] text-[9px] font-black px-1.5 py-0.5 rounded-full">{queue.length}</span>}
              </button>
              <button onClick={() => setShowImportN(v => !v)}
                className="px-3 py-2.5 bg-white hover:bg-[#EAEDED] text-[#0F1111] rounded-xl font-black text-[11px] uppercase tracking-wider border border-[#D5D9D9] transition-all flex items-center gap-1.5">
                <i className="fa-solid fa-hashtag"></i>
                <span className="hidden sm:inline">Importer N</span>
              </button>
              <button onClick={importAll} disabled={!total}
                className="px-3 py-2.5 bg-[#131921] hover:bg-[#0a0e15] text-[#FF9900] rounded-xl font-black text-[11px] uppercase tracking-wider border border-[#FF9900]/20 transition-all flex items-center gap-1.5">
                <i className="fa-solid fa-bolt"></i>
                <span className="hidden sm:inline">Tout</span>
              </button>
            </div>
          </div>

          {/* Import N panel */}
          {showImportN && (
            <div className="bg-[#131921] border border-[#232F3E] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">Importer un nombre précis</p>
                <p className="text-[#ADBAC7] text-xs mt-0.5 truncate">
                  {selCatName ? `"${selCatName}"` : "Catalogue général"}{search ? ` · "${search}"` : ""}
                  {total > 0 && ` · ${total.toLocaleString()} disponibles`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min="1" max={Math.min(total || 5000, 5000)} value={importNValue}
                  onChange={e => setImportNValue(e.target.value)} placeholder="ex: 200"
                  className="w-28 px-3 py-2 bg-[#232F3E] border border-[#FF9900]/30 focus:border-[#FF9900] rounded-lg text-white text-sm text-center focus:outline-none" />
                <button onClick={importN} disabled={!importNValue}
                  className="px-4 py-2 bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-50 text-[#0F1111] rounded-lg font-black text-xs uppercase tracking-wider border border-[#FCD200] transition-all">
                  Go
                </button>
                <button onClick={() => { setShowImportN(false); setImportNValue(""); }}
                  className="w-8 h-8 rounded-lg bg-[#232F3E] text-[#ADBAC7] hover:text-white flex items-center justify-center">
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              </div>
            </div>
          )}

          {/* ── BATCH QUEUE ─────────────────────────────────────────────────── */}
          {showQueue && (
            <div className="bg-[#131921] border border-[#232F3E] rounded-2xl overflow-hidden">
              <div className="bg-[#232F3E] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-list-check text-[#FF9900]"></i>
                  <span className="text-white font-bold text-sm">File d'import multi-catégories</span>
                  {queue.length > 0 && (
                    <span className="text-[#ADBAC7] text-xs">{queue.length} catégories · {queueTotal.toLocaleString()} produits au total</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {queue.length > 0 && (
                    <>
                      <button onClick={clearQueue}
                        className="text-xs text-[#ADBAC7] hover:text-[#B12704] font-bold transition-colors">
                        Vider
                      </button>
                      <button onClick={runBatchImport} disabled={batchRunning || queue.every(q => q.status === "done")}
                        className="px-4 py-1.5 bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-50 text-[#0F1111] rounded-lg font-black text-xs uppercase tracking-wider border border-[#FCD200] transition-all flex items-center gap-1.5">
                        <i className="fa-solid fa-play text-[10px]"></i>
                        Lancer l'import
                      </button>
                    </>
                  )}
                </div>
              </div>

              {queue.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <i className="fa-solid fa-arrow-down text-[#565959] text-2xl mb-3 block"></i>
                  <p className="text-[#ADBAC7] text-sm font-semibold">File vide</p>
                  <p className="text-[#565959] text-xs mt-1">
                    Ouvre le panel Catégories et clique <i className="fa-solid fa-plus mx-1"></i> sur chaque catégorie à importer
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#232F3E]">
                  {queue.map((item, idx) => (
                    <div key={item.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                      <span className="text-[#565959] text-[10px] font-black w-5 text-center">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                        {item.status !== "pending" && (
                          <p className="text-xs mt-0.5" style={{ color: statusColor[item.status] }}>
                            {item.status === "importing" ? `${item.imported} / ${item.count} importés…` :
                             item.status === "done" ? `✓ ${item.imported} produits importés` : "Erreur"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-[#232F3E] rounded-lg px-2 py-1.5 border border-[#FF9900]/20">
                          <span className="text-[#ADBAC7] text-[10px]">Nb:</span>
                          <input type="number" min="1" max="5000" value={item.count}
                            onChange={e => updateQueueCount(item.id, e.target.value)}
                            disabled={item.status !== "pending"}
                            className="w-16 bg-transparent text-white text-xs text-center focus:outline-none disabled:opacity-50" />
                        </div>
                        <i className={`fa-solid ${statusIcon[item.status]} text-xs`} style={{ color: statusColor[item.status] }}></i>
                        {item.status === "pending" && (
                          <button onClick={() => removeFromQueue(item.id)}
                            className="w-6 h-6 rounded bg-[#232F3E] text-[#ADBAC7] hover:text-[#B12704] flex items-center justify-center transition-colors">
                            <i className="fa-solid fa-xmark text-[9px]"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Categories panel */}
          {showCats && (
            <div className="bg-[#131921] border border-[#232F3E] rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-[#232F3E] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-layer-group text-[#FF9900]"></i>
                  <span className="text-white font-bold text-sm">Catégories CJ</span>
                  <span className="text-[#ADBAC7] text-xs">({filteredCats.length} / {categories.length})</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[#ADBAC7] text-[10px]"></i>
                    <input type="text" value={catSearch} onChange={e => setCatSearch(e.target.value)}
                      placeholder="Filtrer les catégories…"
                      className="pl-7 pr-3 py-1.5 bg-[#131921] border border-[#FF9900]/20 focus:border-[#FF9900] rounded-lg text-white text-xs w-44 focus:outline-none placeholder-[#ADBAC7]" />
                  </div>
                  <select value={catSort} onChange={e => setCatSort(e.target.value)}
                    className="px-2 py-1.5 bg-[#131921] border border-[#FF9900]/20 rounded-lg text-[#ADBAC7] text-xs focus:outline-none cursor-pointer">
                    <option value="name">A–Z</option>
                    <option value="count">Par produits</option>
                  </select>
                </div>
              </div>

              {/* Selection action bar */}
              {catSelected.size > 0 && (
                <div className="bg-[#FF9900]/10 border-b border-[#FF9900]/20 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="text-[#FF9900] font-black text-sm">{catSelected.size} catégorie{catSelected.size > 1 ? "s" : ""} sélectionnée{catSelected.size > 1 ? "s" : ""}</span>
                    <button onClick={() => setCatSelected(new Set())} className="text-[#ADBAC7] text-xs hover:text-white transition-colors">Tout désélectionner</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#ADBAC7] text-xs">Nb par cat.:</span>
                    <input type="number" min="1" max="5000" value={defaultImportN}
                      onChange={e => setDefaultImportN(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 px-2 py-1 bg-[#232F3E] border border-[#FF9900]/30 rounded-lg text-white text-xs text-center focus:outline-none focus:border-[#FF9900]" />
                    <button
                      onClick={() => {
                        filteredCats.filter(c => catSelected.has(c.id)).forEach(cat => {
                          if (!queue.find(q => q.id === cat.id)) {
                            setQueue(prev => [...prev, { id: cat.id, name: cat.name, count: defaultImportN, status: "pending", imported: 0 }]);
                          }
                        });
                        setShowQueue(true);
                        setCatSelected(new Set());
                      }}
                      className="px-4 py-1.5 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] rounded-lg font-black text-xs uppercase tracking-wider border border-[#FCD200] transition-all flex items-center gap-1.5">
                      <i className="fa-solid fa-list-check text-[10px]"></i>
                      Ajouter à la file
                    </button>
                    <button
                      onClick={() => {
                        const selected = filteredCats.filter(c => catSelected.has(c.id));
                        selected.forEach(cat => selectCategory(cat));
                      }}
                      className="px-3 py-1.5 bg-[#232F3E] hover:bg-[#0a0e15] text-[#FF9900] rounded-lg font-black text-xs uppercase tracking-wider border border-[#FF9900]/20 transition-all flex items-center gap-1.5">
                      <i className="fa-solid fa-eye text-[10px]"></i>
                      Parcourir
                    </button>
                  </div>
                </div>
              )}

              {/* Select all row */}
              {!catsLoading && filteredCats.length > 0 && (
                <div className="px-5 py-2 border-b border-[#232F3E] flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (catSelected.size === filteredCats.length) setCatSelected(new Set());
                      else setCatSelected(new Set(filteredCats.map(c => c.id)));
                    }}
                    className="flex items-center gap-2 text-xs text-[#ADBAC7] hover:text-white transition-colors">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                      catSelected.size === filteredCats.length && filteredCats.length > 0
                        ? "bg-[#FF9900] border-[#FF9900]"
                        : catSelected.size > 0
                        ? "bg-[#FF9900]/40 border-[#FF9900]/60"
                        : "border-[#565959]"
                    }`}>
                      {catSelected.size > 0 && <i className="fa-solid fa-check text-[#0F1111] text-[7px]"></i>}
                    </div>
                    <span>{catSelected.size === filteredCats.length && filteredCats.length > 0 ? "Tout désélectionner" : `Tout sélectionner (${filteredCats.length})`}</span>
                  </button>
                  <span className="text-[#565959] text-[10px]">Clique = sélectionner · <i className="fa-solid fa-arrow-right text-[8px]"></i> = parcourir produits</span>
                </div>
              )}

              {/* Grid */}
              {catsLoading ? (
                <div className="p-8 flex items-center justify-center gap-3">
                  <i className="fa-solid fa-spinner animate-spin text-[#FF9900]"></i>
                  <span className="text-[#ADBAC7] text-sm">Chargement des catégories…</span>
                </div>
              ) : catsError ? (
                <div className="p-5 space-y-3">
                  <div className="bg-[#FEE7E5] border border-[#B12704]/30 rounded-xl p-4 text-xs text-[#B12704] font-mono break-all">{catsError}</div>
                  <button onClick={loadCategories} className="px-4 py-2 bg-[#232F3E] text-[#FF9900] rounded-lg text-xs font-bold flex items-center gap-2">
                    <i className="fa-solid fa-rotate"></i>Réessayer
                  </button>
                </div>
              ) : filteredCats.length === 0 && catSearch ? (
                <div className="p-8 text-center text-[#565959] text-sm">Aucune catégorie correspondant à "{catSearch}"</div>
              ) : (
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
                  {filteredCats.map(cat => {
                    const isChecked = catSelected.has(cat.id);
                    const inQueue   = queue.some(q => q.id === cat.id);
                    const isActive  = selCatId === cat.id;
                    return (
                      <div key={cat.id}
                        onClick={() => {
                          setCatSelected(prev => {
                            const next = new Set(prev);
                            next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                            return next;
                          });
                        }}
                        className={`relative flex flex-col gap-0.5 rounded-xl border cursor-pointer transition-all px-2.5 py-2 ${
                          isChecked  ? "bg-[#FF9900]/20 border-[#FF9900]/50" :
                          inQueue    ? "bg-[#FFD814]/10 border-[#FFD814]/30 hover:border-[#FFD814]/50" :
                          isActive   ? "bg-[#007185]/20 border-[#007185]/40" :
                                       "bg-[#232F3E]/50 border-[#232F3E] hover:bg-[#232F3E] hover:border-[#565959]"
                        }`}>
                        {/* Checkbox */}
                        <div className={`absolute top-1.5 right-1.5 w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                          isChecked ? "bg-[#FF9900] border-[#FF9900]" : "border-[#565959] bg-[#131921]"
                        }`}>
                          {isChecked && <i className="fa-solid fa-check text-[#0F1111] text-[7px]"></i>}
                        </div>

                        <p className={`text-xs font-semibold leading-tight pr-5 ${isChecked ? "text-[#FF9900]" : isActive ? "text-[#007185]" : "text-white"}`}>
                          {cat.name}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {cat.count > 0 && <span className="text-[9px] text-[#565959]">{cat.count.toLocaleString()} produits</span>}
                          {inQueue && <span className="text-[8px] text-[#FFD814] font-black uppercase">En file</span>}
                        </div>

                        {/* Browse arrow */}
                        <button
                          onClick={e => { e.stopPropagation(); selectCategory(cat); }}
                          title="Parcourir les produits"
                          className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded bg-[#232F3E] hover:bg-[#FF9900]/20 text-[#565959] hover:text-[#FF9900] flex items-center justify-center transition-all">
                          <i className="fa-solid fa-arrow-right text-[8px]"></i>
                        </button>
                      </div>
                    );
                  })}
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
            <button onClick={clearAll} className="text-xs text-[#565959] hover:text-[#C45500] font-bold">Désélectionner</button>
            <button onClick={importSelected}
              className="flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider border border-[#FCD200] transition-all">
              <i className="fa-solid fa-cloud-arrow-up"></i>Importer
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
              {products.length} affichés · {total.toLocaleString()} au total{selCatName ? ` dans "${selCatName}"` : ""}
            </p>
            <button onClick={selected.size === products.length ? clearAll : selectAll}
              className="text-xs text-[#007185] hover:text-[#C45500] font-bold transition-colors">
              {selected.size === products.length ? "Désélectionner tout" : "Sélectionner tout"}
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
              <button onClick={() => fetchProducts(1, search, selCatId)} disabled={page === 1 || loading}
                className="w-9 h-9 rounded-xl border border-[#D5D9D9] bg-white hover:border-[#FF9900] disabled:opacity-40 flex items-center justify-center">
                <i className="fa-solid fa-angles-left text-[#565959] text-[10px]"></i>
              </button>
              <button onClick={() => fetchProducts(page - 1, search, selCatId)} disabled={page === 1 || loading}
                className="w-9 h-9 rounded-xl border border-[#D5D9D9] bg-white hover:border-[#FF9900] disabled:opacity-40 flex items-center justify-center">
                <i className="fa-solid fa-chevron-left text-[#565959] text-xs"></i>
              </button>
              {pagesWindow.map(n => (
                <button key={n} onClick={() => fetchProducts(n, search, selCatId)}
                  className={`w-9 h-9 rounded-xl border text-sm font-bold transition-all ${
                    n === page ? "bg-[#232F3E] text-[#FF9900] border-[#FF9900]/30" : "bg-white border-[#D5D9D9] text-[#565959] hover:border-[#FF9900]/50"
                  }`}>
                  {n}
                </button>
              ))}
              <button onClick={() => fetchProducts(page + 1, search, selCatId)} disabled={page === totalPages || loading}
                className="w-9 h-9 rounded-xl border border-[#D5D9D9] bg-white hover:border-[#FF9900] disabled:opacity-40 flex items-center justify-center">
                <i className="fa-solid fa-chevron-right text-[#565959] text-xs"></i>
              </button>
              <button onClick={() => fetchProducts(totalPages, search, selCatId)} disabled={page === totalPages || loading}
                className="w-9 h-9 rounded-xl border border-[#D5D9D9] bg-white hover:border-[#FF9900] disabled:opacity-40 flex items-center justify-center">
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
