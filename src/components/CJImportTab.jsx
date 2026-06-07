import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { cjListProducts, cjGetProductDetail, cjSearchBySku, cjGetCategories, mapCjToProduct, mapCjProductType, usdToFcfa } from "../lib/cjApi";

const PAGE_SIZE = 100;

const translateToEnglish = async (q) => {
  if (!q || /^[\x00-\x7F]+$/.test(q)) return q;
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=fr|en`,
      { signal: AbortSignal.timeout(3000) }
    );
    const json = await res.json();
    const t = json?.responseData?.translatedText;
    return t && json?.responseStatus === 200 ? t : q;
  } catch { return q; }
};

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

const CJCard = ({ product, selected, onToggle, onImport, importing, alreadyImported }) => {
  const price = usdToFcfa(product.sellPrice || product.nowPrice || product.productPrice || 0);
  const type  = mapCjProductType(product.categoryName || "", product.productNameEn || product.productName || "");
  return (
    <div onClick={() => !alreadyImported && onToggle(product.pid)}
      className={`relative bg-white border-2 rounded-xl overflow-hidden transition-all group ${
        alreadyImported ? "border-[#007600]/40 opacity-70 cursor-default"
          : selected ? "border-[#FF9900] shadow-[0_0_0_3px_rgba(255,153,0,0.15)] cursor-pointer"
          : "border-[#D5D9D9] hover:border-[#FF9900]/50 cursor-pointer"
      }`}>

      {!alreadyImported ? (
        <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
          selected ? "bg-[#FF9900] border-[#FF9900]" : "bg-white/90 border-[#D5D9D9]"
        }`}>
          {selected && <i className="fa-solid fa-check text-[#0F1111] text-[8px]"></i>}
        </div>
      ) : (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-[#007600] text-white text-[8px] font-black px-2 py-1 rounded-full">
          <i className="fa-solid fa-check text-[8px]"></i>Importé
        </div>
      )}

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
            <p className={`text-sm font-bold ${alreadyImported ? "text-[#007600]" : "text-[#B12704]"}`}>{price.toLocaleString()} F</p>
          </div>
          {alreadyImported ? (
            <div className="w-8 h-8 bg-[#E8F5E8] border border-[#007600]/30 rounded-lg flex items-center justify-center">
              <i className="fa-solid fa-check text-[#007600] text-xs"></i>
            </div>
          ) : (
            <button onClick={e => { e.stopPropagation(); onImport([product]); }} disabled={importing}
              className="w-8 h-8 bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-50 border border-[#FCD200] rounded-lg flex items-center justify-center transition-all active:scale-95">
              <i className="fa-solid fa-plus text-[#0F1111] text-xs"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const OFS_TYPES = ["Tous", "Audio Lab", "Tech Lab", "Femme", "Clothing", "Shoes", "Beauté", "Accessories", "Maison", "Sport", "Bébé & Enfants", "Auto"];
const STATUS_COLOR = { pending: "#ADBAC7", importing: "#FF9900", done: "#007600", error: "#B12704" };
const STATUS_ICON  = { pending: "fa-clock", importing: "fa-spinner fa-spin", done: "fa-check", error: "fa-xmark" };

const CJImportTab = () => {
  const { user } = useAuth();
  const initDoneRef = useRef(false);

  // Products
  const [products,    setProducts]    = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [pageInput,   setPageInput]   = useState("1");
  const [search,      setSearch]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [translating, setTranslating] = useState(false);
  const [fetchError,  setFetchError]  = useState(null);

  // Categories
  const [categories,  setCategories]  = useState([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catsError,   setCatsError]   = useState(null);
  const [catSearch,   setCatSearch]   = useState("");
  const [selCatId,    setSelCatId]    = useState("");
  const [selCatName,  setSelCatName]  = useState("");
  const [showCats,    setShowCats]    = useState(false);
  const [catSelected, setCatSelected] = useState(new Set());
  const [defaultImportN, setDefaultImportN] = useState(100);

  // Import queue
  const [queue,        setQueue]        = useState([]);
  const [showQueue,    setShowQueue]    = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);

  // Selection & import
  const [selected,     setSelected]     = useState(new Set());
  const [importing,    setImporting]    = useState(false);
  const [importProg,   setImportProg]   = useState({ done: 0, total: 0 });
  const [toast,        setToast]        = useState(null);
  const [alreadyCount, setAlreadyCount] = useState(0);
  const [importedIds,  setImportedIds]  = useState(new Set());
  const [quickN,       setQuickN]       = useState("");
  const [ofsTypeFilter, setOfsTypeFilter] = useState("Tous");

  // Sync
  const [syncing,  setSyncing]  = useState(false);
  const [syncProg, setSyncProg] = useState({ done: 0, total: 0 });

  const filteredProducts = ofsTypeFilter === "Tous"
    ? products
    : products.filter(p => mapCjProductType(p.categoryName || "", p.productNameEn || p.productName || "") === ofsTypeFilter);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const isBulkMode = importProg.total > 0 || batchRunning || syncing;

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const markImported = (pids) =>
    setImportedIds(prev => { const n = new Set(prev); pids.filter(Boolean).forEach(id => n.add(id)); return n; });

  // Load all already-imported CJ IDs once at mount
  useEffect(() => {
    supabase.from("products")
      .select("cj_product_id", { count: "exact" })
      .is("vendor_id", null)
      .not("cj_product_id", "is", null)
      .then(({ data, count }) => {
        setAlreadyCount(count || 0);
        setImportedIds(new Set((data || []).map(p => p.cj_product_id).filter(Boolean)));
      });
  }, []);

  const loadCategories = useCallback(async () => {
    setCatsLoading(true);
    setCatsError(null);
    try {
      const data = await cjGetCategories();
      const flat = [];
      const root = Array.isArray(data) ? data : (data?.list || data?.data || []);
      root.forEach(first => {
        if (first.categoryFirstId && first.categoryFirstName) {
          flat.push({ id: first.categoryFirstId, name: first.categoryFirstName, level: 1 });
          (first.categoryFirstList || []).forEach(second => {
            if (second.categorySecondId && second.categorySecondName) {
              flat.push({ id: second.categorySecondId, name: `  ${second.categorySecondName}`, level: 2 });
              (second.categorySecondList || []).forEach(third => {
                if (third.categoryThirdId && third.categoryThirdName)
                  flat.push({ id: third.categoryThirdId, name: `    ${third.categoryThirdName}`, level: 3 });
              });
            }
          });
        } else if (first.categoryId && first.categoryName) {
          flat.push({ id: first.categoryId, name: first.categoryName, level: 1 });
        }
      });
      if (flat.length === 0) setCatsError(`Aucune catégorie. Réponse: ${JSON.stringify(data)?.slice(0, 200)}`);
      setCategories(flat);
    } catch (err) {
      setCatsError(err.message);
    } finally {
      setCatsLoading(false);
    }
  }, []);

  // SKU pattern: starts with CJ or is all-caps alphanumeric ≥6 chars (no spaces)
  const isSku = (q) => /^CJ[A-Z0-9]{4,}$/i.test(q.trim()) || /^[A-Z0-9\-]{6,}$/.test(q.trim());

  const fetchBySku = useCallback(async (sku) => {
    setLoading(true);
    setFetchError(null);
    try {
      const raw = await cjSearchBySku(sku.trim());
      if (raw) {
        setProducts([raw]);
        setTotal(1);
      } else {
        setProducts([]);
        setTotal(0);
        setFetchError(`Aucun produit CJ trouvé pour le SKU "${sku}"`);
      }
      setPage(1);
      setPageInput("1");
      setOfsTypeFilter("Tous");
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
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
      setOfsTypeFilter("Tous");
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Guard against re-init on JWT token refresh
  useEffect(() => {
    if (!user || initDoneRef.current) return;
    initDoneRef.current = true;
    fetchProducts(1, "", "");
    loadCategories();
  }, [user]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const raw = search.trim();
    if (!raw) { fetchProducts(1, "", selCatId); return; }
    if (isSku(raw)) { fetchBySku(raw); return; }
    setTranslating(true);
    const q = await translateToEnglish(raw);
    setTranslating(false);
    fetchProducts(1, q, selCatId);
  };

  const handlePageJump = (e) => {
    e.preventDefault();
    const n = parseInt(pageInput, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) fetchProducts(n, search, selCatId);
  };

  const selectCategory = (cat) => {
    setSelCatId(cat.id); setSelCatName(cat.name.trim());
    setShowCats(false); setSearch("");
    fetchProducts(1, "", cat.id);
  };

  const clearCategory = () => { setSelCatId(""); setSelCatName(""); fetchProducts(1, search, ""); };

  const toggleSelect = (pid) => setSelected(prev => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  const selectAll    = () => setSelected(new Set(filteredProducts.map(p => p.pid)));
  const clearAll     = () => setSelected(new Set());

  // Enrich with full CJ detail (variants, sizes, colors)
  const enrichOne = async (p) => {
    try {
      const pid    = p.pid || p.productId || p.cjProductId;
      const detail = pid ? await cjGetProductDetail(pid) : null;
      return detail ? mapCjToProduct(detail) : mapCjToProduct(p);
    } catch { return mapCjToProduct(p); }
  };

  const batchInsert = async (list, onProgress) => {
    const DETAIL_BATCH = 2;
    const INSERT_BATCH = 20;
    let enriched = [];
    for (let i = 0; i < list.length; i += DETAIL_BATCH) {
      enriched = [...enriched, ...await Promise.all(list.slice(i, i + DETAIL_BATCH).map(enrichOne))];
      if (i + DETAIL_BATCH < list.length) await new Promise(r => setTimeout(r, 1200));
    }
    let done = 0;
    for (let i = 0; i < enriched.length; i += INSERT_BATCH) {
      const { error } = await supabase.from("products").insert(enriched.slice(i, i + INSERT_BATCH));
      if (error) console.warn("[Insert]", error.message);
      done += Math.min(INSERT_BATCH, enriched.length - i);
      onProgress?.(done);
    }
    return done;
  };

  // Upsert variant — updates price, stock, images for already-imported products
  const batchUpsert = async (list, onProgress) => {
    const DETAIL_BATCH = 2;
    const UPSERT_BATCH = 20;
    let enriched = [];
    for (let i = 0; i < list.length; i += DETAIL_BATCH) {
      enriched = [...enriched, ...await Promise.all(list.slice(i, i + DETAIL_BATCH).map(enrichOne))];
      if (i + DETAIL_BATCH < list.length) await new Promise(r => setTimeout(r, 1200));
    }
    let done = 0;
    for (let i = 0; i < enriched.length; i += UPSERT_BATCH) {
      const { error } = await supabase.from("products").upsert(enriched.slice(i, i + UPSERT_BATCH), { onConflict: "cj_product_id" });
      if (error) console.warn("[Upsert]", error.message);
      done += Math.min(UPSERT_BATCH, enriched.length - i);
      onProgress?.(done);
    }
    return done;
  };

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

  const importProducts = async (list) => {
    if (!list.length) return;
    setImporting(true);
    setImportProg({ done: 0, total: list.length });
    try {
      const done = await batchInsert(list, (d) => setImportProg({ done: d, total: list.length }));
      showToast(`${done} produits importés !`, "success");
      setSelected(new Set());
      setAlreadyCount(c => c + done);
      markImported(list.map(p => p.pid));
    } catch (err) { showToast(err.message, "error"); }
    finally { setImporting(false); setImportProg({ done: 0, total: 0 }); }
  };

  const importSelected = () => importProducts(filteredProducts.filter(p => selected.has(p.pid)));

  const importQuickN = async () => {
    const n = parseInt(quickN, 10);
    if (!n || n <= 0) return;
    setImporting(true);
    setImportProg({ done: 0, total: n });
    try {
      const list = await fetchN(n, search, selCatId);
      setImportProg({ done: 0, total: list.length });
      const done = await batchInsert(list, (d) => setImportProg({ done: d, total: list.length }));
      showToast(`${done} produits importés !`, "success");
      setAlreadyCount(c => c + done);
      markImported(list.map(p => p.pid));
    } catch (err) { showToast(err.message, "error"); }
    finally { setImporting(false); setImportProg({ done: 0, total: 0 }); setQuickN(""); }
  };

  const importAll = async () => {
    const cap = Math.min(total, 5000);
    if (!cap || !window.confirm(`Importer jusqu'à ${cap.toLocaleString()} produits${selCatName ? ` de "${selCatName}"` : ""}?\n\nCela peut prendre plusieurs minutes.`)) return;
    setImporting(true);
    setImportProg({ done: 0, total: cap });
    let done = 0;
    const allPids = [];
    for (let p = 1; done < cap; p++) {
      try {
        const data = await cjListProducts(p, PAGE_SIZE, search, selCatId);
        const list = data?.list || [];
        if (!list.length) break;
        done += await batchInsert(list, () => {});
        list.forEach(item => item.pid && allPids.push(item.pid));
        setImportProg({ done, total: cap });
        await new Promise(r => setTimeout(r, 300));
      } catch { break; }
    }
    showToast(`Import terminé : ${done} produits ajoutés`, "success");
    setAlreadyCount(c => c + done);
    markImported(allPids);
    setImporting(false);
    setImportProg({ done: 0, total: 0 });
  };

  // Re-sync existing CJ products — upserts fresh price/stock/images
  const syncAll = async () => {
    const ids = [...importedIds];
    if (!ids.length) return showToast("Aucun produit CJ à synchroniser.", "error");
    if (!window.confirm(`Synchroniser ${ids.length.toLocaleString()} produits importés ?\n\nPrix, stocks et images seront mis à jour depuis CJ.\nCela peut prendre plusieurs minutes.`)) return;
    setSyncing(true);
    setSyncProg({ done: 0, total: ids.length });
    let done = 0;
    const CHUNK = 50;
    for (let i = 0; i < ids.length; i += CHUNK) {
      try {
        const chunk = ids.slice(i, i + CHUNK).map(pid => ({ pid }));
        const updated = await batchUpsert(chunk, (d) => {
          done = i + d;
          setSyncProg({ done, total: ids.length });
        });
        done = i + updated;
      } catch (err) { console.warn("[Sync]", err.message); }
      await new Promise(r => setTimeout(r, 300));
    }
    showToast(`Sync terminée : ${done} produits mis à jour`, "success");
    setSyncing(false);
    setSyncProg({ done: 0, total: 0 });
  };

  const removeFromQueue    = (id) => setQueue(prev => prev.filter(q => q.id !== id));
  const updateQueueCount   = (id, val) => {
    const n = Math.max(1, Math.min(5000, parseInt(val, 10) || 1));
    setQueue(prev => prev.map(q => q.id === id ? { ...q, count: n } : q));
  };

  const runBatchImport = async () => {
    if (!queue.length) return;
    setBatchRunning(true);
    let totalImported = 0;
    for (const item of queue) {
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "importing", imported: 0 } : q));
      try {
        const list = await fetchN(item.count, "", item.id);
        let done = 0;
        await batchInsert(list, (d) => {
          done = d;
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, imported: d } : q));
        });
        totalImported += done;
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "done", imported: done } : q));
        setAlreadyCount(c => c + done);
        markImported(list.map(p => p.pid));
      } catch {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "error" } : q));
      }
      await new Promise(r => setTimeout(r, 400));
    }
    showToast(`Batch terminé : ${totalImported} produits importés`, "success");
    setBatchRunning(false);
  };

  const clearQueue  = () => setQueue([]);
  const queueTotal  = queue.reduce((s, q) => s + q.count, 0);
  const filteredCats = categories.filter(c => (c.name || "").toLowerCase().includes((catSearch || "").toLowerCase()));

  const pagesWindow = (() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    return [...Array(Math.min(5, totalPages))].map((_, i) => start + i);
  })();

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

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

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
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
                <span className="text-[#FFD814] text-[11px] font-bold">{queue.length} cat. · {queueTotal.toLocaleString()} prod.</span>
              </div>
            )}
            <button onClick={syncAll} disabled={syncing || !importedIds.size}
              title={`Synchroniser ${alreadyCount} produits depuis CJ`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#007185]/20 hover:bg-[#007185]/40 border border-[#007185]/40 rounded-lg text-[#7dd3e8] hover:text-white text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-40">
              <i className={`fa-solid ${syncing ? "fa-spinner animate-spin" : "fa-rotate"} text-[10px]`}></i>
              <span className="hidden sm:inline">Sync</span>
              {alreadyCount > 0 && <span className="text-[9px] opacity-70">({alreadyCount})</span>}
            </button>
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
            { label: `Page ${page}/${totalPages || "…"}`, value: `${products.length} affichés`, color: "#007600" },
          ].map(s => (
            <div key={s.label} className="px-4 py-3">
              <p className="text-[8px] font-black uppercase tracking-widest text-[#565959]">{s.label}</p>
              <p className="text-base font-black mt-0.5" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bulk / Sync progress ────────────────────────────────────────────────── */}
      {isBulkMode && (
        <div className="bg-white border border-[#D5D9D9] rounded-2xl overflow-hidden">
          <div className="bg-[#232F3E] px-5 py-3 flex items-center gap-3">
            <i className="fa-solid fa-spinner animate-spin text-[#FF9900]"></i>
            <span className="font-black text-white text-sm">{syncing ? "Synchronisation…" : "Import en cours…"}</span>
            {(() => {
              const prog = syncing ? syncProg : importProg;
              return prog.total > 0 && (
                <span className="text-[#ADBAC7] text-sm">{prog.done} / {prog.total} produits</span>
              );
            })()}
          </div>
          {(() => {
            const prog = syncing ? syncProg : importProg;
            return prog.total > 0 && (
              <div className="p-5 space-y-2">
                <div className="h-3 bg-[#EAEDED] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#FF9900] to-[#FFD814] rounded-full transition-all duration-300"
                    style={{ width: `${(prog.done / prog.total) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#565959]">Ne fermez pas cette page</span>
                  <span className="font-bold">{Math.round((prog.done / prog.total) * 100)}%</span>
                </div>
              </div>
            );
          })()}
          {batchRunning && (
            <div className="px-5 pb-5 space-y-1.5 max-h-48 overflow-y-auto">
              {queue.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-xs">
                  <i className={`fa-solid ${STATUS_ICON[item.status]} w-3`} style={{ color: STATUS_COLOR[item.status] }}></i>
                  <span className="font-bold text-[#0F1111] truncate max-w-[120px]">{item.name.trim()}</span>
                  <span className="text-[#565959]">
                    {item.status === "importing" ? `${item.imported} / ${item.count}…`
                      : item.status === "done" ? `✓ ${item.imported} importés`
                      : item.status === "error" ? "Erreur" : "En attente"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isBulkMode && (
        <>
          {/* ── Search + action bar ─────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#FF9900] text-sm"></i>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Nom (FR/EN) ou SKU (ex: CJJJCFCF01619)…"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-xl text-sm placeholder-[#ADBAC7] transition-colors" />
              </div>
              <button type="submit" disabled={loading || translating}
                className="px-4 py-2.5 bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-60 text-[#0F1111] rounded-xl font-bold border border-[#FCD200] transition-all flex items-center gap-2">
                {(loading || translating) ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
              </button>
            </form>
            <div className="flex gap-2 flex-shrink-0 flex-wrap items-center">
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
              {/* Quick import N — inline */}
              <div className="flex items-center gap-1 bg-white border border-[#D5D9D9] rounded-xl px-2 py-1.5 hover:border-[#FF9900]/40 transition-colors">
                <i className="fa-solid fa-hashtag text-[#ADBAC7] text-[10px]"></i>
                <input type="number" min="1" max={Math.min(total || 5000, 5000)} value={quickN}
                  onChange={e => setQuickN(e.target.value)} placeholder="N"
                  onKeyDown={e => e.key === "Enter" && importQuickN()}
                  className="w-14 bg-transparent text-[#0F1111] text-xs text-center focus:outline-none placeholder-[#ADBAC7]" />
                <button onClick={importQuickN} disabled={!quickN || !parseInt(quickN)}
                  className="px-2 py-0.5 bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-40 text-[#0F1111] rounded text-[10px] font-black border border-[#FCD200] transition-all">
                  Go
                </button>
              </div>
              <button onClick={importAll} disabled={!total}
                className="px-3 py-2.5 bg-[#131921] hover:bg-[#0a0e15] text-[#FF9900] rounded-xl font-black text-[11px] uppercase tracking-wider border border-[#FF9900]/20 transition-all flex items-center gap-1.5 disabled:opacity-40">
                <i className="fa-solid fa-bolt"></i>
                <span className="hidden sm:inline">Tout</span>
              </button>
            </div>
          </div>

          {/* ── Batch queue ─────────────────────────────────────────────────────── */}
          {showQueue && (
            <div className="bg-[#131921] border border-[#232F3E] rounded-2xl overflow-hidden">
              <div className="bg-[#232F3E] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-list-check text-[#FF9900]"></i>
                  <span className="text-white font-bold text-sm">File d'import</span>
                  {queue.length > 0 && (
                    <span className="text-[#ADBAC7] text-xs">{queue.length} cat. · {queueTotal.toLocaleString()} produits</span>
                  )}
                </div>
                {queue.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button onClick={clearQueue} className="text-xs text-[#ADBAC7] hover:text-[#B12704] font-bold transition-colors">Vider</button>
                    <button onClick={runBatchImport} disabled={batchRunning || queue.every(q => q.status === "done")}
                      className="px-4 py-1.5 bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-50 text-[#0F1111] rounded-lg font-black text-xs uppercase tracking-wider border border-[#FCD200] transition-all flex items-center gap-1.5">
                      <i className="fa-solid fa-play text-[10px]"></i>Lancer
                    </button>
                  </div>
                )}
              </div>
              {queue.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <i className="fa-solid fa-arrow-down text-[#565959] text-2xl mb-3 block"></i>
                  <p className="text-[#ADBAC7] text-sm font-semibold">File vide</p>
                  <p className="text-[#565959] text-xs mt-1">Ouvre Catégories et clique <i className="fa-solid fa-arrow-right mx-1"></i> sur chaque catégorie à importer</p>
                </div>
              ) : (
                <div className="divide-y divide-[#232F3E]">
                  {queue.map((item, idx) => (
                    <div key={item.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                      <span className="text-[#565959] text-[10px] font-black w-5 text-center">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{item.name.trim()}</p>
                        {item.status !== "pending" && (
                          <p className="text-xs mt-0.5" style={{ color: STATUS_COLOR[item.status] }}>
                            {item.status === "importing" ? `${item.imported} / ${item.count}…`
                              : item.status === "done" ? `✓ ${item.imported} importés` : "Erreur"}
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
                        <i className={`fa-solid ${STATUS_ICON[item.status]} text-xs`} style={{ color: STATUS_COLOR[item.status] }}></i>
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

          {/* ── Categories panel ─────────────────────────────────────────────────── */}
          {showCats && (
            <div className="bg-[#131921] border border-[#232F3E] rounded-2xl overflow-hidden">
              <div className="bg-[#232F3E] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-layer-group text-[#FF9900]"></i>
                  <span className="text-white font-bold text-sm">Catégories CJ</span>
                  <span className="text-[#ADBAC7] text-xs">({filteredCats.length} / {categories.length})</span>
                </div>
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[#ADBAC7] text-[10px]"></i>
                  <input type="text" value={catSearch} onChange={e => setCatSearch(e.target.value)}
                    placeholder="Filtrer…"
                    className="pl-7 pr-3 py-1.5 bg-[#131921] border border-[#FF9900]/20 focus:border-[#FF9900] rounded-lg text-white text-xs w-44 focus:outline-none placeholder-[#ADBAC7]" />
                </div>
              </div>

              {catSelected.size > 0 && (
                <div className="bg-[#FF9900]/10 border-b border-[#FF9900]/20 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="text-[#FF9900] font-black text-sm">
                      {catSelected.size} sélectionnée{catSelected.size > 1 ? "s" : ""}
                    </span>
                    <button onClick={() => setCatSelected(new Set())} className="text-[#ADBAC7] text-xs hover:text-white transition-colors">
                      Désélectionner
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#ADBAC7] text-xs">Nb/cat.:</span>
                    <input type="number" min="1" max="5000" value={defaultImportN}
                      onChange={e => setDefaultImportN(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 px-2 py-1 bg-[#232F3E] border border-[#FF9900]/30 rounded-lg text-white text-xs text-center focus:outline-none focus:border-[#FF9900]" />
                    <button
                      onClick={() => {
                        filteredCats.filter(c => catSelected.has(c.id)).forEach(cat => {
                          if (!queue.find(q => q.id === cat.id))
                            setQueue(prev => [...prev, { id: cat.id, name: cat.name, count: defaultImportN, status: "pending", imported: 0 }]);
                        });
                        setShowQueue(true);
                        setCatSelected(new Set());
                      }}
                      className="px-4 py-1.5 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] rounded-lg font-black text-xs uppercase border border-[#FCD200] transition-all flex items-center gap-1.5">
                      <i className="fa-solid fa-list-check text-[10px]"></i>Ajouter à la file
                    </button>
                    <button
                      onClick={() => filteredCats.filter(c => catSelected.has(c.id)).forEach(selectCategory)}
                      className="px-3 py-1.5 bg-[#232F3E] hover:bg-[#0a0e15] text-[#FF9900] rounded-lg font-black text-xs uppercase border border-[#FF9900]/20 transition-all flex items-center gap-1.5">
                      <i className="fa-solid fa-eye text-[10px]"></i>Parcourir
                    </button>
                  </div>
                </div>
              )}

              {!catsLoading && filteredCats.length > 0 && (
                <div className="px-5 py-2 border-b border-[#232F3E] flex items-center justify-between">
                  <button
                    onClick={() => catSelected.size === filteredCats.length
                      ? setCatSelected(new Set())
                      : setCatSelected(new Set(filteredCats.map(c => c.id)))}
                    className="flex items-center gap-2 text-xs text-[#ADBAC7] hover:text-white transition-colors">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                      catSelected.size === filteredCats.length && filteredCats.length > 0 ? "bg-[#FF9900] border-[#FF9900]"
                        : catSelected.size > 0 ? "bg-[#FF9900]/40 border-[#FF9900]/60" : "border-[#565959]"
                    }`}>
                      {catSelected.size > 0 && <i className="fa-solid fa-check text-[#0F1111] text-[7px]"></i>}
                    </div>
                    <span>
                      {catSelected.size === filteredCats.length && filteredCats.length > 0
                        ? "Tout désélectionner"
                        : `Tout sélectionner (${filteredCats.length})`}
                    </span>
                  </button>
                  <span className="text-[#565959] text-[10px]">Clique = sélectionner · <i className="fa-solid fa-arrow-right text-[8px]"></i> = parcourir</span>
                </div>
              )}

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
                <div className="p-8 text-center text-[#565959] text-sm">Aucune catégorie pour "{catSearch}"</div>
              ) : (
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
                  {filteredCats.map(cat => {
                    const isChecked = catSelected.has(cat.id);
                    const inQueue   = queue.some(q => q.id === cat.id);
                    const isActive  = selCatId === cat.id;
                    return (
                      <div key={cat.id}
                        onClick={() => setCatSelected(prev => { const n = new Set(prev); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; })}
                        className={`relative flex flex-col gap-0.5 rounded-xl border cursor-pointer transition-all px-2.5 py-2 ${
                          isChecked ? "bg-[#FF9900]/20 border-[#FF9900]/50"
                            : inQueue ? "bg-[#FFD814]/10 border-[#FFD814]/30 hover:border-[#FFD814]/50"
                            : isActive ? "bg-[#007185]/20 border-[#007185]/40"
                            : "bg-[#232F3E]/50 border-[#232F3E] hover:bg-[#232F3E] hover:border-[#565959]"
                        }`}>
                        <div className={`absolute top-1.5 right-1.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isChecked ? "bg-[#FF9900] border-[#FF9900]" : "border-[#565959] bg-[#131921]"
                        }`}>
                          {isChecked && <i className="fa-solid fa-check text-[#0F1111] text-[7px]"></i>}
                        </div>
                        <p className={`text-xs font-semibold leading-tight pr-5 ${isChecked ? "text-[#FF9900]" : isActive ? "text-[#007185]" : "text-white"}`}>
                          {cat.name}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {inQueue && <span className="text-[8px] text-[#FFD814] font-black uppercase">En file</span>}
                        </div>
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

      {/* ── Selection bar ───────────────────────────────────────────────────────── */}
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

      {/* ── Product grid ────────────────────────────────────────────────────────── */}
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
          {(() => {
            const counts = {};
            products.forEach(p => {
              const t = mapCjProductType(p.categoryName || "", p.productNameEn || p.productName || "");
              counts[t] = (counts[t] || 0) + 1;
            });
            return (
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
                {OFS_TYPES.filter(t => t === "Tous" || counts[t] > 0).map(t => (
                  <button key={t} onClick={() => setOfsTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap border flex-shrink-0 transition-all ${
                      ofsTypeFilter === t ? "bg-[#232F3E] text-[#FF9900] border-[#FF9900]/40" : "bg-white text-[#565959] border-[#D5D9D9] hover:border-[#FF9900]/40"
                    }`}>
                    {t !== "Tous" && counts[t] ? `${t} · ${counts[t]}` : t === "Tous" ? `${t} · ${products.length}` : t}
                  </button>
                ))}
              </div>
            );
          })()}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-[#565959]">
                {filteredProducts.length} affichés
                {ofsTypeFilter !== "Tous" && <span className="text-[#FF9900] font-bold"> · {ofsTypeFilter}</span>}
                {" "}· {total.toLocaleString()} au total{selCatName ? ` dans "${selCatName}"` : ""}
              </p>
              {(() => {
                const n = filteredProducts.filter(p => importedIds.has(p.pid)).length;
                return n > 0 ? (
                  <span className="inline-flex items-center gap-1 bg-[#E8F5E8] border border-[#007600]/20 text-[#007600] text-[9px] font-black px-2 py-0.5 rounded-full">
                    <i className="fa-solid fa-check text-[8px]"></i>{n} déjà importé{n > 1 ? "s" : ""}
                  </span>
                ) : null;
              })()}
            </div>
            <button onClick={selected.size === filteredProducts.length ? clearAll : selectAll}
              className="text-xs text-[#007185] hover:text-[#C45500] font-bold transition-colors">
              {selected.size === filteredProducts.length ? "Désélectionner tout" : "Sélectionner tout"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map(p => (
              <CJCard key={p.pid} product={p} selected={selected.has(p.pid)}
                onToggle={toggleSelect} onImport={importProducts} importing={importing}
                alreadyImported={importedIds.has(p.pid)} />
            ))}
          </div>

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
