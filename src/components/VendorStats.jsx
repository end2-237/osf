import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Cell, LabelList,
  PieChart, Pie,
} from "recharts";

/* ════════════════════════════════════════════════════════════════════════════
   STATISTIQUES VENDEUR — graphiques Recharts

   Palette validée avec scripts/validate_palette.js sur la surface #ffffff :
     · série principale        #2a78d6            (une seule série = une couleur)
     · trio catégoriel         #2a78d6 #eb6834 #1baf7a   (CVD ΔE 9.2 — PASS)
     · rampe ordinale pipeline #86b6ef → #184f95        (ordinal — PASS)
     · statut critique         #d03b3b            (toujours avec icône + libellé)
   L'aqua passe sous 3:1 face au blanc : partout où il sert, la valeur est
   écrite en toutes lettres (étiquette directe ou tableau) — la « règle de
   relief » exigée par la validation.
   ════════════════════════════════════════════════════════════════════════════ */
const C = {
  series:   "#2a78d6",
  cat:      ["#2a78d6", "#eb6834", "#1baf7a"],
  other:    "#a8a69e",   // « Autres » : gris neutre, jamais une teinte de série
  ordinal:  ["#86b6ef", "#5598e7", "#2a78d6", "#184f95"],
  critical: "#d03b3b",
  grid:     "#e1e0d9",
  axis:     "#c3c2b7",
  muted:    "#898781",
  ink:      "#0b0b0b",
  surface:  "#ffffff",
};

const COUNTED_STATUSES = ["confirmed", "paid", "shipped", "in_transit", "delivered"];

const MONTHS   = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];
const WEEKDAYS = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

const RANGES = [
  { key: "30d", label: "30 jours", days: 30,  bucket: "day"   },
  { key: "90d", label: "90 jours", days: 91,  bucket: "week"  },
  { key: "12m", label: "12 mois",  days: 365, bucket: "month" },
];

const fullMoney = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} F`;
const shortMoney = (n) => {
  const v = Math.round(Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (v >= 1_000)     return `${(v / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  return String(v);
};

/* « Autres » porte toujours le gris neutre, quelle que soit sa position. */
const catColor = (label, i) => (label === "Autres" ? C.other : C.cat[i % C.cat.length]);

/* Axes et grille : filets pleins, recessifs. */
const AXIS = { stroke: C.axis, tick: { fill: C.muted, fontSize: 11 }, tickLine: false, axisLine: false };

/* ── Info-bulle commune : la valeur mène, le libellé suit ──────────────── */
const ChartTooltip = ({ active, payload, label, format = fullMoney, unit }) => {
  if (!active || !payload?.length) return null;
  const head = payload[0]?.payload?.full || label;
  return (
    <div className="bg-gray-900 text-white rounded-xl px-3 py-2 shadow-lg">
      <p className="text-[10px] text-white/60 mb-0.5">{head}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[13px] font-bold leading-tight flex items-center gap-2">
          <span className="inline-block w-3 h-[2px] rounded-full" style={{ background: p.color || p.fill }} />
          {format(p.value)}
          {(unit || p.name) && (
            <span className="text-[11px] font-medium text-white/60">{unit || p.name}</span>
          )}
        </p>
      ))}
    </div>
  );
};

/* ── Carte ─────────────────────────────────────────────────────────────── */
const Card = ({ title, subtitle, aside, children, className = "" }) => (
  <div className={`bg-white border border-gray-200/80 rounded-2xl p-5 ${className}`}>
    {(title || aside) && (
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-bold text-[15px] text-gray-900">{title}</p>
          {subtitle && <p className="text-[12px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {aside}
      </div>
    )}
    {children}
  </div>
);

const EmptyPlot = ({ height = 220, message }) => (
  <div className="flex flex-col items-center justify-center text-center px-6" style={{ height }}>
    <i className="fa-solid fa-chart-simple text-gray-200 text-4xl mb-3" />
    <p className="text-[13px] text-gray-400 max-w-xs">{message}</p>
  </div>
);

/* ── Tuile de statistique ──────────────────────────────────────────────── */
const Tile = ({ label, value, hint, delta }) => (
  <div className="bg-white border border-gray-200/80 rounded-2xl p-5">
    <p className="text-[13px] font-semibold text-gray-500">{label}</p>
    <p className="text-[26px] font-bold text-gray-900 leading-none tracking-tight mt-2">{value}</p>
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      {delta != null && (
        <span className={`text-[12px] font-semibold inline-flex items-center gap-1 ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          <i className={`fa-solid fa-arrow-trend-${delta >= 0 ? "up" : "down"}`} />{Math.abs(delta)} %
        </span>
      )}
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════════ */
const VendorStats = ({ orders = [], products = [] }) => {
  const [rangeKey,  setRangeKey]  = useState("12m");
  const [showTable, setShowTable] = useState(false);
  const range = RANGES.find(r => r.key === rangeKey) || RANGES[2];

  const stats = useMemo(() => {
    const now   = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (range.days - 1));
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - range.days);
    const end = new Date(now.getTime() + 86400000);

    const between = (o, from, to) => {
      if (!o.created_at) return false;
      const d = new Date(o.created_at);
      return d >= from && d < to;
    };

    const current  = orders.filter(o => between(o, start, end));
    const previous = orders.filter(o => between(o, prevStart, start));
    const counted     = current.filter(o => COUNTED_STATUSES.includes(o.status));
    const prevCounted = previous.filter(o => COUNTED_STATUSES.includes(o.status));

    const sum     = (l) => l.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const revenue = sum(counted);
    const prevRev = sum(prevCounted);
    const growth  = (curr, prev) => (prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null);

    /* ── Série temporelle ── */
    const buckets = [];
    if (range.bucket === "month") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({
          key: `${d.getFullYear()}-${d.getMonth()}`,
          label: MONTHS[d.getMonth()],
          full: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
          revenue: 0, orders: 0,
        });
      }
    } else if (range.bucket === "week") {
      for (let i = 0; i < 13; i++) {
        const d = new Date(start); d.setDate(d.getDate() + i * 7);
        buckets.push({
          key: `w${i}`,
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          full: `Semaine du ${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}`,
          revenue: 0, orders: 0,
        });
      }
    } else {
      for (let i = 0; i < range.days; i++) {
        const d = new Date(start); d.setDate(d.getDate() + i);
        buckets.push({
          key: d.toISOString().slice(0, 10),
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          full: d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" }),
          revenue: 0, orders: 0,
        });
      }
    }

    const bucketFor = (d) => {
      if (range.bucket === "month") return buckets.findIndex(b => b.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (range.bucket === "day")   return buckets.findIndex(b => b.key === d.toISOString().slice(0, 10));
      const diffDays = Math.floor((d - start) / 86400000);
      return Math.max(0, Math.min(buckets.length - 1, Math.floor(diffDays / 7)));
    };

    counted.forEach(o => {
      const i = bucketFor(new Date(o.created_at));
      if (i >= 0) { buckets[i].revenue += Number(o.total_amount || 0); buckets[i].orders += 1; }
    });

    /* ── Pipeline (étapes ordonnées) ── */
    const countBy = (s) => current.filter(o => o.status === s).length;
    const stages = [
      { key: "pending",   label: "En attente", count: countBy("pending") },
      { key: "confirmed", label: "Confirmées", count: countBy("confirmed") + countBy("paid") },
      { key: "shipped",   label: "Expédiées",  count: countBy("shipped") + countBy("in_transit") },
      { key: "delivered", label: "Livrées",    count: countBy("delivered") },
    ];

    /* ── Produits & catégories ── */
    const prodMap = {};
    counted.forEach(o => (o.order_items || []).forEach(it => {
      const key = it.product_name || "—";
      if (!prodMap[key]) prodMap[key] = { revenue: 0, qty: 0 };
      prodMap[key].revenue += Number(it.unit_price || 0) * Number(it.quantity || 0);
      prodMap[key].qty     += Number(it.quantity || 0);
    }));
    const topProducts = Object.entries(prodMap)
      .map(([label, v]) => ({ label, full: label, revenue: v.revenue, qty: v.qty }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 6);

    const typeOf = products.reduce((acc, p) => { acc[p.name] = p.type; return acc; }, {});
    const catMap = {};
    Object.entries(prodMap).forEach(([name, v]) => {
      const t = typeOf[name] || "Autres";
      catMap[t] = (catMap[t] || 0) + v.revenue;
    });
    const catsSorted = Object.entries(catMap).map(([label, revenue]) => ({ label, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
    // Part d'un tout : 3 teintes catégorielles validées + « Autres » en gris
    // neutre. Au-delà, des pas d'une même rampe bleue seraient indiscernables.
    const topCategories = catsSorted.length > 4
      ? [...catsSorted.slice(0, 3), { label: "Autres", revenue: catsSorted.slice(3).reduce((s, c) => s + c.revenue, 0) }]
      : catsSorted;

    /* ── Jours de la semaine ── */
    const weekday = WEEKDAYS.map(label => ({ key: label, label, full: label, orders: 0 }));
    counted.forEach(o => { weekday[(new Date(o.created_at).getDay() + 6) % 7].orders += 1; });

    /* ── Clients ── */
    const clientMap = {};
    current.forEach(o => {
      const key = o.client_phone || o.client_name || "—";
      if (!clientMap[key]) clientMap[key] = { name: o.client_name || "Client", orders: 0, spent: 0 };
      clientMap[key].orders += 1;
      if (COUNTED_STATUSES.includes(o.status)) clientMap[key].spent += Number(o.total_amount || 0);
    });
    const clients = Object.values(clientMap).sort((a, b) => b.spent - a.spent);

    return {
      revenue,
      revenueDelta: growth(revenue, prevRev),
      ordersCount:  current.length,
      ordersDelta:  growth(current.length, previous.length),
      countedCount: counted.length,
      avgBasket:    counted.length ? Math.round(revenue / counted.length) : 0,
      avgDelta:     growth(
        counted.length ? revenue / counted.length : 0,
        prevCounted.length ? prevRev / prevCounted.length : 0
      ),
      conversion: current.length ? Math.round((counted.length / current.length) * 100) : 0,
      buckets, stages,
      cancelled: current.filter(o => o.status === "cancelled").length,
      topProducts, topCategories, weekday,
      clients: clients.slice(0, 6),
      clientCount: clients.length,
      loyalCount: clients.filter(c => c.orders > 1).length,
      hasData: counted.length > 0,
    };
  }, [orders, products, range]);

  const categoryTotal = stats.topCategories.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="space-y-4">
      {/* En-tête + période — une seule rangée, au-dessus de tous les graphiques */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statistiques</h1>
          <p className="text-[13px] text-gray-500">
            Toutes les données ci-dessous portent sur les {range.label.toLowerCase()} écoulés.
          </p>
        </div>
        <div className="inline-flex bg-white border border-gray-200 rounded-xl p-1">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRangeKey(r.key)}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
                rangeKey === r.key ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tuiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Tile label="Chiffre d'affaires" value={fullMoney(stats.revenue)} delta={stats.revenueDelta} hint="vs période précédente" />
        <Tile label="Commandes" value={stats.ordersCount} delta={stats.ordersDelta}
          hint={`${stats.countedCount} validée${stats.countedCount > 1 ? "s" : ""}`} />
        <Tile label="Panier moyen" value={fullMoney(stats.avgBasket)} delta={stats.avgDelta} hint="par commande validée" />
        <Tile label="Taux de validation" value={`${stats.conversion} %`} hint="commandes confirmées sur reçues" />
      </div>

      {/* ── Chiffre d'affaires ── */}
      <Card
        title="Évolution du chiffre d'affaires"
        subtitle="Commandes confirmées, payées, expédiées ou livrées"
        aside={
          <button onClick={() => setShowTable(v => !v)}
            className="text-[12px] font-semibold text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
            <i className={`fa-solid ${showTable ? "fa-chart-area" : "fa-table"} mr-1.5 text-[11px]`} />
            {showTable ? "Voir le graphique" : "Voir le tableau"}
          </button>
        }
      >
        {!stats.hasData ? (
          <EmptyPlot height={260} message="Aucune commande validée sur cette période. Le graphique se remplit dès qu'une commande passe en confirmée, payée, expédiée ou livrée." />
        ) : showTable ? (
          <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left py-2">Période</th>
                  <th className="text-right py-2">Commandes</th>
                  <th className="text-right py-2">Chiffre d'affaires</th>
                </tr>
              </thead>
              <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                {stats.buckets.map(b => (
                  <tr key={b.key} className="border-b border-gray-50">
                    <td className="py-2 text-gray-600">{b.full}</td>
                    <td className="py-2 text-right text-gray-600">{b.orders}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">{fullMoney(b.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={stats.buckets} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.series} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={C.series} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} strokeDasharray="0" vertical={false} />
              <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
              <YAxis {...AXIS} width={56} tickFormatter={shortMoney} />
              <RTooltip content={<ChartTooltip />} cursor={{ stroke: C.axis, strokeWidth: 1 }} />
              <Area
                type="linear" dataKey="revenue" name="Chiffre d'affaires"
                stroke={C.series} strokeWidth={2} fill="url(#revFill)"
                dot={false}
                activeDot={{ r: 5, fill: C.series, stroke: C.surface, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Volume de commandes ── */}
        <Card className="lg:col-span-2" title="Volume de commandes"
          subtitle="Nombre de commandes validées par période">
          {stats.hasData ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.buckets} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="0" vertical={false} />
                <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
                <YAxis {...AXIS} width={40} allowDecimals={false} />
                <RTooltip content={<ChartTooltip format={(v) => v} unit="commande(s)" />}
                  cursor={{ fill: "rgba(11,11,11,0.04)" }} />
                <Bar dataKey="orders" name="Commandes" fill={C.series}
                  radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyPlot message="Pas encore de commande validée sur cette période." />}
        </Card>

        {/* ── Pipeline : étapes ordonnées → rampe ordinale ── */}
        <Card title="Suivi des commandes"
          subtitle={`${stats.ordersCount} commande${stats.ordersCount > 1 ? "s" : ""} sur la période`}>
          {stats.ordersCount === 0 ? (
            <EmptyPlot height={240} message="Aucune commande reçue sur cette période." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.stages} layout="vertical"
                  margin={{ top: 4, right: 34, bottom: 0, left: 0 }}>
                  <XAxis type="number" {...AXIS} allowDecimals={false} hide />
                  <YAxis type="category" dataKey="label" {...AXIS} width={82} />
                  <RTooltip content={<ChartTooltip format={(v) => v} unit="commande(s)" />}
                    cursor={{ fill: "rgba(11,11,11,0.04)" }} />
                  <Bar dataKey="count" name="Commandes" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {stats.stages.map((s, i) => (
                      <Cell key={s.key} fill={C.ordinal[Math.min(i, C.ordinal.length - 1)]} />
                    ))}
                    <LabelList dataKey="count" position="right"
                      style={{ fill: C.ink, fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {stats.cancelled > 0 && (
                <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-gray-100">
                  <span className="text-[13px] text-gray-700 flex items-center gap-2">
                    <i className="fa-solid fa-circle-xmark text-[12px]" style={{ color: C.critical }} />
                    Annulées
                  </span>
                  <span className="text-[13px] font-bold text-gray-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {stats.cancelled}
                  </span>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Meilleurs produits ── */}
        <Card title="Meilleurs produits" subtitle="Chiffre d'affaires généré sur la période">
          {stats.topProducts.length === 0 ? (
            <EmptyPlot height={240} message="Aucune vente enregistrée sur cette période." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(120, stats.topProducts.length * 44)}>
              <BarChart data={stats.topProducts} layout="vertical"
                margin={{ top: 4, right: 76, bottom: 0, left: 0 }}>
                <XAxis type="number" {...AXIS} hide />
                <YAxis type="category" dataKey="label" {...AXIS} width={124}
                  tickFormatter={(v) => (v.length > 15 ? `${v.slice(0, 14)}…` : v)} />
                <RTooltip content={<ChartTooltip />} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
                <Bar dataKey="revenue" name="Chiffre d'affaires" fill={C.series}
                  radius={[0, 4, 4, 0]} maxBarSize={20}>
                  <LabelList dataKey="revenue" position="right" formatter={fullMoney}
                    style={{ fill: C.ink, fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* ── Répartition par catégorie : part d'un tout, ≤6 segments ── */}
        <Card title="Répartition par catégorie" subtitle="Part de chaque catégorie dans le chiffre d'affaires">
          {stats.topCategories.length === 0 ? (
            <EmptyPlot height={240} message="Les catégories apparaîtront après tes premières ventes." />
          ) : stats.topCategories.length === 1 ? (
            /* Une seule catégorie : le camembert n'apprend rien — on écrit le chiffre. */
            <div className="h-[240px] flex flex-col items-center justify-center text-center">
              <p className="text-[13px] text-gray-500">100 % de tes ventes</p>
              <p className="text-[26px] font-bold text-gray-900 mt-1">{stats.topCategories[0].label}</p>
              <p className="text-[15px] font-semibold text-gray-600 mt-1">{fullMoney(stats.topCategories[0].revenue)}</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={200} className="max-w-[220px]">
                <PieChart>
                  <Pie data={stats.topCategories} dataKey="revenue" nameKey="label"
                    innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke={C.surface} strokeWidth={2}>
                    {stats.topCategories.map((c, i) => (
                      <Cell key={c.label} fill={catColor(c.label, i)} />
                    ))}
                  </Pie>
                  <RTooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Légende + valeurs écrites : identité jamais portée par la seule couleur */}
              <ul className="flex-1 w-full space-y-1.5">
                {stats.topCategories.map((c, i) => (
                  <li key={c.label} className="flex items-center gap-2 text-[13px]">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ background: catColor(c.label, i) }} />
                    <span className="text-gray-700 truncate flex-1">{c.label}</span>
                    <span className="text-gray-900 font-semibold flex-shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {categoryTotal > 0 ? Math.round((c.revenue / categoryTotal) * 100) : 0} %
                    </span>
                    <span className="text-gray-400 flex-shrink-0 w-[86px] text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {fullMoney(c.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Jours de la semaine ── */}
        <Card title="Tes meilleurs jours" subtitle="Commandes validées par jour de la semaine">
          {stats.hasData ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.weekday} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="0" vertical={false} />
                <XAxis dataKey="label" {...AXIS} />
                <YAxis {...AXIS} width={32} allowDecimals={false} />
                <RTooltip content={<ChartTooltip format={(v) => v} unit="commande(s)" />}
                  cursor={{ fill: "rgba(11,11,11,0.04)" }} />
                <Bar dataKey="orders" name="Commandes" fill={C.series}
                  radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyPlot message="Pas encore assez de commandes pour dégager une tendance." />}
        </Card>

        {/* ── Clients ── */}
        <Card title="Meilleurs clients"
          subtitle={`${stats.clientCount} client${stats.clientCount > 1 ? "s" : ""} · ${stats.loyalCount} avec plusieurs commandes`}>
          {stats.clients.length === 0 ? (
            <EmptyPlot height={240} message="Aucun client sur cette période." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left py-2">Client</th>
                    <th className="text-right py-2">Commandes</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                  {stats.clients.map((c, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                            {(c.name || "?")[0].toUpperCase()}
                          </span>
                          <span className="truncate max-w-[140px] text-gray-700">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-gray-600">{c.orders}</td>
                      <td className="py-2.5 text-right font-semibold text-gray-900">{fullMoney(c.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <p className="text-[11px] text-gray-400 px-1">
        Les commandes en attente de confirmation et les commandes annulées ne sont pas comptées
        dans le chiffre d'affaires.
      </p>
    </div>
  );
};

export default VendorStats;
