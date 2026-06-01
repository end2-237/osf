import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import {
  cjListProducts,
  cjGetCategories,
  mapCjToProduct,
  mapOfsType,
  usdToFcfa,
} from "../lib/cjApi";

// ─── OFS product types ────────────────────────────────────────────────────────
const OFS_TYPES = ["Tous", "Audio Lab", "Tech Lab", "Clothing", "Shoes", "Fragrance", "Femme", "Accessories"];

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

// ─── Product card (CJ preview) ────────────────────────────────────────────────
const CJCard = ({ product, selected, onToggle, onImport, importing }) => {
  const price = usdToFcfa(product.sellPrice || product.productPrice || 0);
  const type  = mapOfsType(product.categoryName || "");

  return (
    <div
      className={`relative bg-white border-2 rounded-xl overflow-hidden transition-all cursor-pointer group ${
        selected ? "border-[#FF9900] shadow-[0_0_0_3px_rgba(255,153,0,0.15)]" : "border-[#D5D9D9] hover:border-[#FF9900]/50"
      }`}
      onClick={() => onToggle(product.pid)}
    >
      {/* Checkbox */}
      <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
        selected ? "bg-[#FF9900] border-[#FF9900]" : "bg-white/90 border-[#D5D9D9]"
      }`}>
        {selected && <i className="fa-solid fa-check text-[#0F1111] text-[8px]"></i>}
      </div>

      {/* OFS type badge */}
      <div className="absolute top-2 right-2 z-10 bg-[#232F3E]/90 text-[#FF9900] text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
        {type}
      </div>

      {/* Image */}
      <div className="aspect-square bg-[#F3F4F4] overflow-hidden">
        {product.productImage
          ? <img src={product.productImage} alt={product.productNameEn} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-image text-[#D5D9D9] text-3xl"></i></div>
        }
      </div>

      {/* Info */}
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
            title="Importer ce produit"
          >
            <i className="fa-solid fa-plus text-[#0F1111] text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const CJImportTab = () => {
  const { user } = useAuth();
  const [products,     setProducts]     = useState([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState("Tous");
  const [loading,      setLoading]      = useState(false);
  const [selected,     setSelected]     = useState(new Set());
  const [importing,    setImporting]    = useState(false);
  const [importProg,   setImportProg]   = useState({ done: 0, total: 0 });
  const [toast,        setToast]        = useState(null);
  const [fetchError,   setFetchError]   = useState(null);
  const [importedPids, setImportedPids] = useState(new Set());
  const [alreadyCount, setAlreadyCount] = useState(0);

  const PAGE_SIZE = 50;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const isBulkMode = importProg.total > 0;

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load already imported CJ pids from Supabase (by name prefix check)
  useEffect(() => {
    supabase.from("products").select("id").not("img", "is", null).then(({ data }) => {
      setAlreadyCount(data?.length || 0);
    });
  }, []);

  // ── Fetch CJ products ──────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (p = 1, q = search) => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await cjListProducts(p, PAGE_SIZE, q, "");
      setProducts(data?.list || []);
      setTotal(data?.total || 0);
    } catch (err) {
      console.error("[CJ]", err.message);
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Wait for auth session before first fetch
  useEffect(() => { if (user) fetchProducts(1, ""); }, [user]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchProducts(1, search);
  };

  const changePage = (p) => {
    setPage(p);
    fetchProducts(p, search);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Filter by OFS type locally ─────────────────────────────────────────────
  const displayed = typeFilter === "Tous"
    ? products
    : products.filter(p => mapOfsType(p.categoryName || "") === typeFilter);

  // ── Selection ─────────────────────────────────────────────────────────────
  const toggleSelect = (pid) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(displayed.map(p => p.pid)));
  const clearAll  = () => setSelected(new Set());

  // ── Import products to Supabase ────────────────────────────────────────────
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
        if (error) console.error("[Import]", error.message);
        done += batch.length;
        setImportProg({ done, total: list.length });
      }
      showToast(`${done} produits importés avec succès !`, "success");
      setSelected(new Set());
      setAlreadyCount(c => c + done);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setImporting(false);
      setImportProg({ done: 0, total: 0 });
    }
  };

  const importSelected = () => {
    const list = products.filter(p => selected.has(p.pid));
    importProducts(list);
  };

  // ── Bulk import ALL 5000 products ──────────────────────────────────────────
  const importAll5000 = async () => {
    if (!window.confirm(`Importer jusqu'à 5000 produits CJ Dropshipping dans votre catalogue ?\n\nCela peut prendre quelques minutes.`)) return;
    setImporting(true);
    const maxPages = 25; // 25 × 200 = 5000
    const PSIZE    = 200;
    let totalDone  = 0;
    let totalItems = 0;
    setImportProg({ done: 0, total: 5000 });

    for (let p = 1; p <= maxPages; p++) {
      try {
        const data = await cjListProducts(p, PSIZE, "", "");
        const list = data?.list || [];
        if (!list.length) break;
        if (p === 1) {
          totalItems = Math.min(data.total || 5000, 5000);
          setImportProg(prev => ({ ...prev, total: totalItems }));
        }
        const toInsert = list.map(mapCjToProduct);
        const BATCH = 50;
        for (let i = 0; i < toInsert.length; i += BATCH) {
          const { error } = await supabase.from("products").insert(toInsert.slice(i, i + BATCH));
          if (error) console.warn("[BulkImport]", error.message);
        }
        totalDone += list.length;
        setImportProg({ done: totalDone, total: totalItems || 5000 });
        // Small pause to avoid rate-limiting
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(`[BulkImport page ${p}]`, err.message);
        break;
      }
    }

    showToast(`Import terminé : ${totalDone} produits ajoutés`, "success");
    setAlreadyCount(c => c + totalDone);
    setImporting(false);
    setImportProg({ done: 0, total: 0 });
  };

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ── API ERROR ── */}
      {fetchError && (
        <div className="bg-[#FEE7E5] border border-[#B12704]/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <i className="fa-solid fa-triangle-exclamation text-[#B12704] flex-shrink-0"></i>
            <p className="text-[#B12704] text-sm font-semibold truncate">{fetchError}</p>
          </div>
          <button onClick={() => fetchProducts(1, search)}
            className="flex-shrink-0 px-3 py-1.5 bg-[#B12704] text-white rounded-lg text-xs font-bold hover:bg-[#8b1e02] transition-colors flex items-center gap-1.5">
            <i className="fa-solid fa-rotate text-[10px]"></i>Réessayer
          </button>
        </div>
      )}

      {/* ── HEADER STATS ── */}
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
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#007600] animate-pulse"></div>
            <span className="text-[#007600] text-[10px] font-black uppercase">API Active</span>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-[#232F3E] px-0">
          {[
            { icon: "fa-boxes-stacked", label: "Disponibles CJ",   value: total.toLocaleString(),        color: "#FF9900" },
            { icon: "fa-store",         label: "Dans votre store",  value: alreadyCount.toLocaleString(), color: "#FFD814" },
            { icon: "fa-arrow-trend-up",label: "Affichés",          value: products.length,               color: "#007185" },
          ].map(s => (
            <div key={s.label} className="px-5 py-4 flex flex-col gap-0.5">
              <p className="text-[8px] font-black uppercase tracking-widest text-[#565959]">{s.label}</p>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── BULK IMPORT BAR ── */}
      {isBulkMode ? (
        <div className="bg-white border border-[#D5D9D9] rounded-2xl overflow-hidden">
          <div className="bg-[#232F3E] px-5 py-3 flex items-center gap-3">
            <i className="fa-solid fa-spinner animate-spin text-[#FF9900]"></i>
            <span className="font-black text-white text-sm">Import en cours…</span>
            <span className="text-[#ADBAC7] text-sm">{importProg.done} / {importProg.total} produits</span>
          </div>
          <div className="p-5 space-y-3">
            <div className="h-3 bg-[#EAEDED] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FF9900] to-[#FFD814] rounded-full transition-all duration-300"
                style={{ width: `${importProg.total ? (importProg.done / importProg.total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#565959]">Ne fermez pas cette page</span>
              <span className="font-bold text-[#0F1111]">
                {importProg.total ? Math.round((importProg.done / importProg.total) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ── SEARCH + ACTIONS ── */
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#FF9900] text-sm"></i>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un produit CJ…"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-xl text-sm text-[#0F1111] placeholder-[#ADBAC7] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] rounded-xl font-bold text-sm border border-[#FCD200] transition-all active:scale-95 flex items-center gap-2"
            >
              {loading ? <i className="fa-solid fa-spinner animate-spin text-sm"></i> : <i className="fa-solid fa-magnifying-glass text-sm"></i>}
              <span className="hidden sm:inline">Rechercher</span>
            </button>
          </form>

          <button
            onClick={importAll5000}
            disabled={importing}
            className="px-4 py-2.5 bg-[#232F3E] hover:bg-[#131921] text-[#FF9900] rounded-xl font-black text-[11px] uppercase tracking-widest border border-[#FF9900]/20 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <i className="fa-solid fa-bolt text-sm"></i>
            Importer 5 000 produits
          </button>
        </div>
      )}

      {/* ── FILTERS ── */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-0.5">
        {OFS_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap border transition-all flex-shrink-0 ${
              typeFilter === t
                ? "bg-[#232F3E] text-[#FF9900] border-[#FF9900]/30"
                : "bg-white text-[#565959] border-[#D5D9D9] hover:border-[#FF9900]/40"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── SELECTION BAR ── */}
      {selected.size > 0 && (
        <div className="bg-[#FFF8D3] border border-[#FCD200]/50 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#FF9900] rounded-full flex items-center justify-center">
              <i className="fa-solid fa-check text-[#0F1111] text-[9px]"></i>
            </div>
            <span className="font-bold text-[#C45500] text-sm">{selected.size} produit{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={clearAll} className="text-xs text-[#565959] hover:text-[#C45500] transition-colors font-bold">Tout désélectionner</button>
            <button
              onClick={importSelected}
              disabled={importing}
              className="flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-50 text-[#0F1111] px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider border border-[#FCD200] transition-all"
            >
              <i className="fa-solid fa-cloud-arrow-up text-sm"></i>
              Importer la sélection
            </button>
          </div>
        </div>
      )}

      {/* ── PRODUCT GRID ── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(20)].map((_,i) => (
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
      ) : displayed.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-[#F3F4F4] rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-box-open text-[#D5D9D9] text-2xl"></i>
          </div>
          <p className="font-bold text-[#565959]">Aucun produit trouvé</p>
          <p className="text-sm text-[#ADBAC7] mt-1">Essayez un autre filtre ou terme de recherche</p>
        </div>
      ) : (
        <>
          {/* Select all button */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#565959]">
              Affichant {displayed.length} produits sur {total.toLocaleString()} disponibles
            </p>
            <button
              onClick={selected.size === displayed.length ? clearAll : selectAll}
              className="text-xs text-[#007185] hover:text-[#C45500] font-bold transition-colors"
            >
              {selected.size === displayed.length ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {displayed.map(p => (
              <CJCard
                key={p.pid}
                product={p}
                selected={selected.has(p.pid)}
                onToggle={toggleSelect}
                onImport={importProducts}
                importing={importing}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => changePage(Math.max(1, page - 1))}
                disabled={page === 1 || loading}
                className="w-9 h-9 rounded-xl border border-[#D5D9D9] bg-white hover:border-[#FF9900] disabled:opacity-40 flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-chevron-left text-[#565959] text-xs"></i>
              </button>

              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => changePage(p)}
                    className={`w-9 h-9 rounded-xl border text-sm font-bold transition-all ${
                      p === page
                        ? "bg-[#232F3E] text-[#FF9900] border-[#FF9900]/30"
                        : "bg-white border-[#D5D9D9] text-[#565959] hover:border-[#FF9900]/50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => changePage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages || loading}
                className="w-9 h-9 rounded-xl border border-[#D5D9D9] bg-white hover:border-[#FF9900] disabled:opacity-40 flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-chevron-right text-[#565959] text-xs"></i>
              </button>

              <span className="text-[10px] text-[#565959] ml-2 hidden sm:block">
                Page {page}/{totalPages} · {total.toLocaleString()} produits
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CJImportTab;
