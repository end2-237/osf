import React, { useState, useMemo, useEffect, useCallback } from "react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, Tooltip } from "recharts";
import { supabase } from "../lib/supabase";

/* ════════════════════════════════════════════════════════════════════════════
   PRODUITS — la vitrine de la boutique

   Un tableau à sept colonnes disait tout sauf l'essentiel : à quoi ressemble
   ce qu'on vend. Ici les produits sont montrés comme le client les verra, et
   les quatre indicateurs du haut répondent aux questions qu'on se pose en
   ouvrant la page — combien j'ai en stock, qu'est-ce qui part, qu'est-ce qui
   manque.

   S'y ajoute ce que le forfait impose : le nombre de places en vitrine. Quand
   le catalogue dépasse le plafond, c'est le vendeur qui choisit ce qui reste
   exposé — un tri automatique masquerait ses meilleures ventes sans lui
   demander. Un produit retiré n'est pas supprimé : il dort.
   ════════════════════════════════════════════════════════════════════════════ */

const ACCENT = "#FF9900", INK = "#0F1111", MUTED = "#565959", BORDER = "#E9EAEC";

const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} F`;
const nfmt  = (n) => Number(n || 0).toLocaleString("fr-FR");

/* ── Un indicateur ───────────────────────────────────────────────────────── */
const Kpi = ({ label, sub, value, delta, hint, series, tone = ACCENT, kind = "area" }) => (
  <div className="bg-white rounded-2xl border p-4 flex flex-col" style={{ borderColor: BORDER }}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-bold text-[13px] truncate" style={{ color: INK }}>{label}</p>
        <p className="text-[11px] truncate" style={{ color: MUTED }}>{sub}</p>
      </div>
      <i className="fa-solid fa-ellipsis text-[12px] flex-shrink-0" style={{ color: "#C9CDCD" }} />
    </div>

    <div className="flex items-end gap-2 mt-3">
      <p className="text-[24px] font-black leading-none" style={{ color: INK }}>{value}</p>
      {delta != null && (
        <span className="text-[11px] font-bold flex items-center gap-1"
          style={{ color: delta >= 0 ? "#007600" : "#B12704" }}>
          <i className={`fa-solid fa-arrow-trend-${delta >= 0 ? "up" : "down"} text-[10px]`} />
          {Math.abs(delta)}%
        </span>
      )}
    </div>
    {hint && <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{hint}</p>}

    <div className="h-[58px] -mx-1 mt-auto pt-2">
      {series?.length > 1 && (
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart data={series} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
              <Bar dataKey="v" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {series.map((d, i) => (
                  <Cell key={i} fill={i === series.length - 1 ? tone : "#EDEFEF"} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={tone} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={tone} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip cursor={{ stroke: "#D5D9D9" }} contentStyle={{ borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 11 }} />
              <Area type="linear" dataKey="v" stroke={tone} strokeWidth={2}
                fill={`url(#g-${label})`} isAnimationActive={false} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  </div>
);

/* ── Une carte produit ───────────────────────────────────────────────────── */
const Card = ({ p, sold, onEdit, onDelete, onToggle, busy, canList }) => {
  const [menu, setMenu] = useState(false);
  const listed = p.is_listed !== false;

  return (
    <div className="bg-white rounded-2xl border overflow-hidden group relative flex flex-col"
      style={{ borderColor: BORDER, opacity: listed ? 1 : 0.72 }}>
      <div className="relative h-44 flex items-center justify-center" style={{ background: "#F7F8F8" }}>
        {p.img
          ? <img src={p.img} alt="" className={`w-full h-full object-contain p-4 ${listed ? "" : "grayscale"}`} />
          : <i className="fa-solid fa-image text-3xl" style={{ color: "#D5D9D9" }} />}

        {!listed && (
          <span className="absolute top-3 left-3 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg"
            style={{ background: "#EDEFEF", color: MUTED }}>
            <i className="fa-solid fa-eye-slash mr-1" />En réserve
          </span>
        )}

        <div className="absolute top-3 right-3">
          <button onClick={() => setMenu(m => !m)}
            className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center shadow-sm"
            style={{ color: MUTED }}>
            <i className="fa-solid fa-ellipsis text-[12px]" />
          </button>
          {menu && (
            <div className="absolute right-0 top-9 z-20 bg-white rounded-xl shadow-lg border py-1 w-44"
              style={{ borderColor: BORDER }} onMouseLeave={() => setMenu(false)}>
              <button onClick={() => { setMenu(false); onEdit(p); }}
                className="w-full text-left px-3 py-2 text-[12px] hover:bg-gray-50" style={{ color: INK }}>
                <i className="fa-solid fa-pen mr-2 text-[11px]" />Modifier
              </button>
              <button onClick={() => { setMenu(false); onToggle(p); }}
                disabled={busy || (!listed && !canList)}
                className="w-full text-left px-3 py-2 text-[12px] hover:bg-gray-50 disabled:opacity-40"
                style={{ color: INK }}
                title={!listed && !canList ? "Plus de place en vitrine" : undefined}>
                <i className={`fa-solid ${listed ? "fa-eye-slash" : "fa-eye"} mr-2 text-[11px]`} />
                {listed ? "Retirer de la vitrine" : "Mettre en vitrine"}
              </button>
              <button onClick={() => { setMenu(false); onDelete(p); }}
                className="w-full text-left px-3 py-2 text-[12px] hover:bg-red-50" style={{ color: "#B12704" }}>
                <i className="fa-solid fa-trash mr-2 text-[11px]" />Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <p className="font-bold text-[14px] truncate" style={{ color: INK }}>{p.name}</p>
        <p className="text-[15px] font-black mt-1" style={{ color: INK }}>{money(p.price)}</p>
        <div className="flex items-center justify-between gap-2 mt-3">
          <p className="text-[11px]" style={{ color: MUTED }}>
            Stock : <strong style={{ color: INK }}>{p.stock_qty ?? "—"}</strong>
            <span className="mx-1.5">·</span>
            Vendus : <strong style={{ color: INK }}>{sold}</strong>
          </p>
          <button onClick={() => onEdit(p)}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white"
            style={{ background: ACCENT }} title="Modifier">
            <i className="fa-solid fa-arrow-up-right text-[12px]" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   LA PAGE
   ════════════════════════════════════════════════════════════════════════════ */
const FILTERS = [
  { key: "all",      label: "Tous"           },
  { key: "listed",   label: "En vitrine"     },
  { key: "reserve",  label: "En réserve"     },
  { key: "best",     label: "Meilleures ventes" },
  { key: "recent",   label: "Nouveautés"     },
  { key: "low",      label: "Stock bas"      },
];

const VendorProducts = ({ vendor, products, orders = [], onAdd, onEdit, onDelete, onRefresh, showToast }) => {
  const [q, setQ]           = useState("");
  const [filter, setFilter] = useState("all");
  const [cat, setCat]       = useState("");
  const [plan, setPlan]     = useState(null);
  const [busy, setBusy]     = useState(false);

  const loadPlan = useCallback(async () => {
    if (!vendor?.id) return;
    const { data } = await supabase.rpc("vendor_plan_state", { p_vendor_id: vendor.id });
    setPlan(Array.isArray(data) ? data[0] : data);
  }, [vendor?.id]);
  useEffect(() => { loadPlan(); }, [loadPlan, products.length]);

  // Ventes par produit, tirées des commandes déjà chargées par le tableau de bord.
  const soldBy = useMemo(() => {
    const m = {};
    orders.forEach(o => (o.order_items || []).forEach(it => {
      const k = it.product_id || it.product_name;
      m[k] = (m[k] || 0) + Number(it.quantity || 0);
    }));
    return m;
  }, [orders]);

  const soldFor = (p) => soldBy[p.id] ?? soldBy[p.name] ?? 0;

  const cats = useMemo(
    () => [...new Set(products.map(p => p.type).filter(Boolean))].sort(),
    [products]
  );

  const list = useMemo(() => {
    let out = products;
    if (q)   out = out.filter(p => p.name?.toLowerCase().includes(q.toLowerCase()));
    if (cat) out = out.filter(p => p.type === cat);
    if (filter === "listed")  out = out.filter(p => p.is_listed !== false);
    if (filter === "reserve") out = out.filter(p => p.is_listed === false);
    if (filter === "low")     out = out.filter(p => Number(p.stock_qty ?? 99) <= 5);
    if (filter === "best")    out = [...out].sort((a, b) => soldFor(b) - soldFor(a));
    if (filter === "recent")  out = [...out].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return out;
  }, [products, q, cat, filter, soldBy]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Les quatre indicateurs ────────────────────────────────────────────── */
  const kpi = useMemo(() => {
    const stockValue = products.reduce((s, p) => s + Number(p.price || 0) * Number(p.stock_qty ?? 0), 0);
    const low = products.filter(p => Number(p.stock_qty ?? 99) <= 5).length;

    const byCat = {};
    products.forEach(p => {
      if (!p.type) return;
      byCat[p.type] = (byCat[p.type] || 0) + soldFor(p) * Number(p.price || 0);
    });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

    const totalSold = products.reduce((s, p) => s + soldFor(p), 0);

    // Douze points, un par mois glissant : assez pour voir une tendance sans
    // prétendre à une précision qu'on n'a pas.
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, v: 0 };
    });
    orders.forEach(o => {
      const d = new Date(o.created_at);
      const m = months.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.v += (o.order_items || []).reduce((s, it) => s + Number(it.quantity || 0), 0);
    });

    const added = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      return { v: products.filter(p => {
        const c = new Date(p.created_at);
        return `${c.getFullYear()}-${c.getMonth()}` === k;
      }).length };
    });

    const lastTwo = months.slice(-2).map(m => m.v);
    const delta = lastTwo[0] ? Math.round(((lastTwo[1] - lastTwo[0]) / lastTwo[0]) * 100) : null;

    return {
      stockValue, low, totalSold, delta,
      topCat: top ? { name: top[0], value: top[1] } : null,
      soldSeries: months.map(m => ({ v: m.v })),
      addedSeries: added,
    };
  }, [products, orders, soldBy]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Vitrine ──────────────────────────────────────────────────────────── */
  const toggle = async (p) => {
    setBusy(true);
    const { error } = await supabase.rpc("set_product_listed", {
      p_product_id: p.id, p_listed: p.is_listed === false,
    });
    setBusy(false);
    if (error) return showToast?.("Impossible", error.message, "error");
    showToast?.(p.is_listed === false ? "Produit mis en vitrine" : "Produit mis en réserve");
    await onRefresh?.();
    await loadPlan();
  };

  const slotsLeft = plan?.max_products == null ? null : Math.max(plan.max_products - plan.products_listed, 0);
  const canList   = slotsLeft == null || slotsLeft > 0;

  return (
    <div className="space-y-4">
      {/* ── Fil d'ariane, titre, actions ── */}
      <div>
        <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: MUTED }}>
          <i className="fa-solid fa-store text-[11px]" />
          <span>Ma boutique</span>
          <i className="fa-solid fa-chevron-right text-[9px]" style={{ color: "#C9CDCD" }} />
          <span className="font-semibold" style={{ color: INK }}>Produits</span>
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[26px] font-black tracking-tight leading-none" style={{ color: INK }}>Produits</h1>
            <p className="text-[13px] mt-1.5" style={{ color: MUTED }}>
              Gère ton catalogue, suis ce qui se vend, et choisis ce qui est en vitrine.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={cat} onChange={e => setCat(e.target.value)}
              className="bg-white border rounded-xl px-3 py-2.5 text-[12px] font-semibold outline-none cursor-pointer"
              style={{ borderColor: BORDER, color: INK }}>
              <option value="">Toutes catégories</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={onAdd}
              className="flex items-center gap-2 text-white text-[12px] font-bold px-4 py-2.5 rounded-xl"
              style={{ background: INK }}>
              <i className="fa-solid fa-plus text-[11px]" />Nouveau produit
            </button>
          </div>
        </div>
      </div>

      {/* ── Places en vitrine ── */}
      {plan && plan.max_products != null && (
        <div className="rounded-2xl border px-4 py-3 flex items-center gap-4 flex-wrap"
          style={{ borderColor: slotsLeft === 0 ? "#FCD200" : BORDER,
                   background: slotsLeft === 0 ? "#FFF8D3" : "#fff" }}>
          <div className="flex-1 min-w-[220px]">
            <p className="text-[12px] font-bold" style={{ color: INK }}>
              {plan.products_listed} / {plan.max_products} places de vitrine occupées
              <span className="font-normal" style={{ color: MUTED }}>
                {" · forfait "}{plan.plan_name}
              </span>
            </p>
            <div className="h-[5px] rounded-full mt-2 overflow-hidden" style={{ background: "#EDEFEF" }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, (plan.products_listed / plan.max_products) * 100)}%`,
                         background: slotsLeft === 0 ? "#B26200" : ACCENT }} />
            </div>
            {plan.products_total > plan.products_listed && (
              <p className="text-[11px] mt-1.5" style={{ color: MUTED }}>
                {plan.products_total - plan.products_listed} produit
                {plan.products_total - plan.products_listed > 1 ? "s" : ""} en réserve — modifiables,
                mais invisibles pour les clients.
              </p>
            )}
          </div>
          {slotsLeft === 0 && (
            <p className="text-[11px] font-bold" style={{ color: "#B26200" }}>
              <i className="fa-solid fa-circle-info mr-1.5" />
              Retire un produit pour en exposer un autre, ou passe au forfait supérieur.
            </p>
          )}
        </div>
      )}

      {/* ── Indicateurs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi label="Valeur du stock" sub="Prix × quantité en réserve"
          value={money(kpi.stockValue)} series={kpi.addedSeries} kind="bar"
          hint={`${products.length} produit${products.length > 1 ? "s" : ""} au catalogue`} />
        <Kpi label="Catégorie qui porte" sub={kpi.topCat?.name || "Aucune vente encore"}
          value={kpi.topCat ? money(kpi.topCat.value) : "—"} series={kpi.soldSeries} tone="#2a78d6" />
        <Kpi label="Stock bas" sub="5 unités ou moins"
          value={nfmt(kpi.low)} series={kpi.addedSeries} tone="#eb6834"
          hint={kpi.low ? "À réapprovisionner" : "Rien à signaler"} />
        <Kpi label="Articles vendus" sub="Toutes commandes confondues"
          value={nfmt(kpi.totalSold)} delta={kpi.delta} series={kpi.soldSeries} tone="#1baf7a" />
      </div>

      {/* ── Liste ── */}
      <div className="bg-white rounded-2xl border p-4 sm:p-5" style={{ borderColor: BORDER }}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <p className="font-black text-[16px]" style={{ color: INK }}>Mon catalogue</p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px]"
                style={{ color: MUTED }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…"
                className="w-44 rounded-xl pl-9 pr-3 py-2 text-[12px] outline-none border"
                style={{ borderColor: BORDER }} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="px-3.5 py-2 rounded-full text-[12px] font-semibold transition-colors"
              style={filter === f.key
                ? { background: INK, color: "#fff" }
                : { color: MUTED }}>
              {f.label}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="py-16 text-center">
            <i className="fa-solid fa-box-open text-4xl mb-3 block" style={{ color: "#E3E6E6" }} />
            <p className="font-bold text-[14px]" style={{ color: INK }}>
              {products.length === 0 ? "Ton catalogue est vide" : "Rien ne correspond"}
            </p>
            <p className="text-[12px] mt-1" style={{ color: MUTED }}>
              {products.length === 0
                ? "Ajoute ton premier produit, il sera en ligne tout de suite."
                : "Change de filtre ou de recherche."}
            </p>
            {products.length === 0 && (
              <button onClick={onAdd}
                className="mt-4 text-white text-[12px] font-bold px-5 py-2.5 rounded-xl"
                style={{ background: INK }}>
                <i className="fa-solid fa-plus mr-1.5 text-[11px]" />Nouveau produit
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {list.map(p => (
              <Card key={p.id} p={p} sold={soldFor(p)} busy={busy} canList={canList}
                onEdit={onEdit} onDelete={onDelete} onToggle={toggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorProducts;
