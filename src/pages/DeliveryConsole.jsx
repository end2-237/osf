import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, YAxis, XAxis, Tooltip,
} from "recharts";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { LOGO_URL } from "../lib/brand";
import DeliveryMap from "../components/DeliveryMap";
import DeliverySlipForm from "../components/DeliverySlipForm";
import { routeBetween, searchAddress, formatKm, formatDuration, currentPosition, DEFAULT_CENTER } from "../lib/geo";

/* ════════════════════════════════════════════════════════════════════════════
   BUYTICLE DELIVERY — console de suivi

   Le même écran sert trois personnes, et c'est la base qui décide de ce que
   chacune voit (`delivery_feed`, `delivery_view`) :
     · le vendeur qui livre lui-même y suit ses propres trajets ;
     · le livreur Buyticle y trouve ses courses ;
     · l'admin voit toutes les courses confiées à Buyticle Delivery.

   Rien ne s'ouvre sans compte. La session en cours suffit — on ne redemande
   jamais d'identifiants à quelqu'un qui est déjà connecté.
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Palette ─────────────────────────────────────────────────────────────────
   Une seule couleur d'accent porte tout l'écran, comme dans la maquette. */
const ACCENT   = "#FF9900";
const INK      = "#0F1111";
const DARK     = "#131921";
const MUTED    = "#565959";
const BORDER   = "#E3E6E6";
const GHOST    = "#D5D9D9";

const money  = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} F`;
const nfmt   = (n) => Number(n || 0).toLocaleString("fr-FR");

const STATUS_LABEL = {
  pending: "En attente", pending_payment: "Paiement…", confirmed: "Confirmée",
  paid: "Payée", shipped: "Expédiée", in_transit: "En route",
  at_warehouse: "En dépôt", sent_to_cj: "Chez le transitaire",
  delivered: "Livrée", cancelled: "Annulée", payment_failed: "Paiement échoué",
};
const IN_TRANSIT = ["shipped", "in_transit", "at_warehouse", "sent_to_cj"];

const card = "bg-white rounded-[20px] border";

/* ════════════════════════════════════════════════════════════════════════════
   ÉCRAN DE CHARGEMENT — le module est lourd, il s'annonce
   ════════════════════════════════════════════════════════════════════════════ */
export const DeliveryLoader = ({ label = "Ouverture de Buyticle Delivery…" }) => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: "#F3F4F4" }}>
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
        style={{ background: DARK }}>
        <img src={LOGO_URL} alt="" className="w-9 h-9 object-contain" />
      </div>
      <div className="w-40 h-1 rounded-full overflow-hidden mx-auto mb-4" style={{ background: GHOST }}>
        <div className="h-full w-1/3 rounded-full animate-[loaderSlide_1.1s_ease-in-out_infinite]"
          style={{ background: ACCENT }} />
      </div>
      <p className="text-[11px] font-black uppercase tracking-[0.25em]" style={{ color: MUTED }}>{label}</p>
      <style>{`@keyframes loaderSlide{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}`}</style>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   PORTE — pas de compte, pas de carte
   ════════════════════════════════════════════════════════════════════════════ */
const LockedOut = ({ title, message, cta }) => (
  <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F3F4F4" }}>
    <div className={`${card} p-8 max-w-md w-full text-center`} style={{ borderColor: BORDER }}>
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: DARK }}>
        <i className="fa-solid fa-lock text-lg" style={{ color: ACCENT }} />
      </div>
      <h1 className="font-black text-lg mb-2" style={{ color: INK }}>{title}</h1>
      <p className="text-[13px] leading-relaxed mb-6" style={{ color: MUTED }}>{message}</p>
      {cta}
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   BARRE DU HAUT
   ════════════════════════════════════════════════════════════════════════════ */
const NAV = [
  { key: "board",    icon: "fa-grip",           label: "Tableau" },
  { key: "courses",  icon: "fa-box",            label: "Courses" },
  { key: "map",      icon: "fa-map-location-dot", label: "Carte" },
  { key: "perf",     icon: "fa-chart-simple",   label: "Performance" },
  { key: "drivers",  icon: "fa-id-badge",       label: "Livreurs" },
  { key: "messages", icon: "fa-envelope",       label: "Messages" },
];

const Topbar = ({ tab, onTab, avatar, name, role, onExit }) => (
  <div className={`${card} px-4 sm:px-5 py-3 flex items-center justify-between gap-4`} style={{ borderColor: BORDER }}>
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: DARK }}>
        <img src={LOGO_URL} alt="" className="w-5 h-5 object-contain" />
      </div>
      <p className="font-black text-[15px] tracking-tight truncate" style={{ color: INK }}>
        Buyticle<span style={{ color: ACCENT }}>Delivery</span>
      </p>
    </div>

    <nav className="hidden md:flex items-center gap-1.5 rounded-2xl p-1" style={{ background: "#F3F4F4" }}>
      {NAV.map(n => (
        <button key={n.key} onClick={() => onTab(n.key)} title={n.label}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
          style={tab === n.key
            ? { background: ACCENT, color: "#fff" }
            : { color: MUTED }}>
          <i className={`fa-solid ${n.icon} text-[13px]`} />
        </button>
      ))}
    </nav>

    <div className="flex items-center gap-2 flex-shrink-0">
      <button className="w-10 h-10 rounded-full border flex items-center justify-center relative"
        style={{ borderColor: BORDER, color: MUTED }} title="Notifications">
        <i className="fa-solid fa-bell text-[13px]" />
        <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full" style={{ background: ACCENT }} />
      </button>
      <button onClick={onExit} className="w-10 h-10 rounded-full border flex items-center justify-center"
        style={{ borderColor: BORDER, color: MUTED }} title="Quitter le module">
        <i className="fa-solid fa-arrow-right-from-bracket text-[13px]" />
      </button>
      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
        style={{ background: DARK }} title={`${name} · ${role}`}>
        {avatar
          ? <img src={avatar} alt="" className="w-full h-full object-cover" />
          : <span className="text-white font-black text-[13px]">{(name || "?").charAt(0).toUpperCase()}</span>}
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   CARTE PRINCIPALE
   ════════════════════════════════════════════════════════════════════════════ */
const MapPanel = ({ markers, route, center, filter, onFilter, onPickPlace, orders }) => {
  const [q, setQ]         = useState("");
  const [hits, setHits]   = useState([]);
  const [open, setOpen]   = useState(false);
  const [full, setFull]   = useState(false);
  const mapApi            = useRef(null);

  // Nominatim tolère mal les rafales : on attend que la frappe se calme.
  useEffect(() => {
    if (q.trim().length < 3) { setHits([]); return; }
    const t = setTimeout(async () => setHits(await searchAddress(q)), 600);
    return () => clearTimeout(t);
  }, [q]);

  const counts = useMemo(() => ({
    all:       orders.length,
    transit:   orders.filter(o => IN_TRANSIT.includes(o.status)).length,
    pending:   orders.filter(o => ["pending", "confirmed", "paid", "pending_payment"].includes(o.status)).length,
    delivered: orders.filter(o => o.status === "delivered").length,
  }), [orders]);

  return (
    <div className={`relative rounded-[24px] overflow-hidden border ${full ? "fixed inset-3 z-[1200]" : "h-[280px] sm:h-[330px]"}`}
      style={{ background: "#EDEFEF", borderColor: BORDER }}>
      <DeliveryMap
        markers={markers} route={route} center={center} theme="light"
        routeColor={ACCENT} className="w-full h-full"
        onReady={(m) => { mapApi.current = m; }}
      />

      {/* recherche de lieu */}
      <div className="absolute top-3 left-3 right-3 flex items-start gap-2 z-[1000] pointer-events-none">
        <div className="relative flex-1 max-w-[280px] pointer-events-auto">
          <div className="bg-white rounded-full flex items-center gap-2 pl-4 pr-3 h-11 shadow-lg">
            <i className="fa-solid fa-magnifying-glass text-[12px]" style={{ color: MUTED }} />
            <input
              value={q} onChange={e => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder="Douala, Cameroun"
              className="flex-1 min-w-0 bg-transparent text-[13px] outline-none"
              style={{ color: INK }}
            />
            {q && <button onClick={() => { setQ(""); setHits([]); }} className="text-[11px]" style={{ color: MUTED }}>
              <i className="fa-solid fa-xmark" />
            </button>}
          </div>
          {open && hits.length > 0 && (
            <div className="absolute top-12 left-0 right-0 bg-white rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
              {hits.map((h, i) => (
                <button key={i} onClick={() => { onPickPlace(h); setOpen(false); setQ(h.short); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b last:border-0"
                  style={{ borderColor: BORDER }}>
                  <p className="text-[12px] font-bold" style={{ color: INK }}>{h.short}</p>
                  <p className="text-[10px] truncate" style={{ color: MUTED }}>{h.label}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-full h-11 flex items-center gap-2 pl-4 pr-2 shadow-lg pointer-events-auto">
          <span className="text-[12px] hidden sm:inline" style={{ color: MUTED }}>Filtrer</span>
          <select value={filter} onChange={e => onFilter(e.target.value)}
            className="bg-transparent text-[13px] font-bold outline-none pr-1 cursor-pointer" style={{ color: INK }}>
            <option value="transit">En route ({counts.transit})</option>
            <option value="pending">À traiter ({counts.pending})</option>
            <option value="delivered">Livrées ({counts.delivered})</option>
            <option value="all">Toutes ({counts.all})</option>
          </select>
        </div>

        <button onClick={() => setFull(f => !f)}
          className="ml-auto w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center pointer-events-auto"
          style={{ color: INK }} title={full ? "Réduire" : "Plein écran"}>
          <i className={`fa-solid ${full ? "fa-compress" : "fa-expand"} text-[13px]`} />
        </button>
      </div>

      {/* zoom */}
      <div className="absolute bottom-4 right-3 flex flex-col gap-2 z-[1000]">
        <button onClick={() => mapApi.current?.zoomIn()}
          className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center" style={{ color: INK }}>
          <i className="fa-solid fa-plus text-[12px]" />
        </button>
        <button onClick={() => mapApi.current?.zoomOut()}
          className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center" style={{ color: INK }}>
          <i className="fa-solid fa-minus text-[12px]" />
        </button>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   COLONNE 1 — volume + quatre indicateurs
   ════════════════════════════════════════════════════════════════════════════ */
const VolumeCard = ({ series, delivered, successRate }) => (
  <div className={`${card} p-5`} style={{ borderColor: BORDER }}>
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-2">
        <i className="fa-solid fa-chart-line text-[12px]" style={{ color: INK }} />
        <p className="font-bold text-[14px]" style={{ color: INK }}>Volume de livraison</p>
      </div>
      <i className="fa-solid fa-sliders text-[12px]" style={{ color: GHOST }} />
    </div>

    <div className="h-[86px] -mx-2 mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
          <YAxis hide domain={[0, "dataMax + 1"]} />
          <Tooltip
            cursor={{ stroke: GHOST }}
            contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }}
            labelFormatter={l => l}
            formatter={(v) => [`${v} course${v > 1 ? "s" : ""}`, ""]}
          />
          <Line type="linear" dataKey="v" stroke={ACCENT} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>

    <div className="flex gap-8 mt-3">
      <div>
        <p className="text-[26px] font-black leading-none" style={{ color: INK }}>{nfmt(delivered)}</p>
        <p className="text-[11px] mt-1.5" style={{ color: MUTED }}>Livrées ce mois</p>
      </div>
      <div>
        <p className="text-[26px] font-black leading-none" style={{ color: INK }}>{successRate}%</p>
        <p className="text-[11px] mt-1.5" style={{ color: MUTED }}>Livraisons réussies</p>
      </div>
    </div>
  </div>
);

const MiniCard = ({ label, value, spark, badge, kind }) => (
  <div className={`${card} p-4`} style={{ borderColor: BORDER }}>
    <p className="text-[12px] mb-2" style={{ color: MUTED }}>{label}</p>
    <div className="flex items-end justify-between gap-3">
      <p className="text-[22px] font-black leading-none" style={{ color: INK }}>{value}</p>
      {badge && (
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{ background: "#FFF3E0", color: "#B26200" }}>{badge}</span>
      )}
      {spark?.length > 1 && (
        <div className="w-[68px] h-[26px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            {kind === "bar" ? (
              <BarChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <Bar dataKey="v" fill={ACCENT} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            ) : (
              <LineChart data={spark} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
                <Line type="linear" dataKey="v" stroke={ACCENT} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   LIVREURS — voir qui est disponible, attribuer, ou prendre la course

   La liste vient de `assignable_couriers` : côté Buyticle pour les commandes
   qu'on nous confie, côté boutique pour celles qu'elle livre elle-même. On ne
   filtre pas dans l'écran, c'est la base qui répond.
   ════════════════════════════════════════════════════════════════════════════ */
const CourierPicker = ({ order, open, onClose, onAssign, onTake, busy }) => {
  const [list, setList]     = useState([]);
  const [loading, setLoad]  = useState(false);
  const [err, setErr]       = useState("");

  useEffect(() => {
    if (!open || !order?.id) return;
    let alive = true;
    (async () => {
      setLoad(true); setErr("");
      const { data, error } = await supabase.rpc("assignable_couriers", { p_order_id: order.id });
      if (!alive) return;
      if (error) setErr(error.message);
      setList(data || []);
      setLoad(false);
    })();
    return () => { alive = false; };
  }, [open, order?.id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center p-3"
      style={{ background: "rgba(15,17,17,.45)" }} onClick={onClose}>
      <div className={`${card} w-full max-w-md max-h-[80vh] flex flex-col`}
        style={{ borderColor: BORDER }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
          <div>
            <p className="font-bold text-[14px]" style={{ color: INK }}>Qui fait cette course ?</p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              {order?.delivery_mode === "buyticle" ? "Livreurs Buyticle" : "Livreurs de la boutique"}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ color: MUTED }}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="p-3 border-b" style={{ borderColor: BORDER }}>
          <button onClick={onTake} disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-white disabled:opacity-50"
            style={{ background: DARK }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: ACCENT }}>
              <i className="fa-solid fa-person-walking text-[13px] text-white" />
            </div>
            <span className="flex-1 text-left">
              <span className="block font-bold text-[13px]">Je démarre moi-même</span>
              <span className="block text-[11px] opacity-60">La course m'est attribuée tout de suite</span>
            </span>
            <i className="fa-solid fa-chevron-right text-[11px] opacity-60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {err && (
            <p className="px-5 py-4 text-[12px] font-bold" style={{ color: "#B12704" }}>
              <i className="fa-solid fa-circle-exclamation mr-1.5" />{err}
            </p>
          )}
          {loading ? (
            <p className="px-5 py-8 text-center text-[12px] font-bold" style={{ color: MUTED }}>
              <i className="fa-solid fa-spinner fa-spin mr-2" />Chargement des livreurs…
            </p>
          ) : list.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <i className="fa-solid fa-id-badge text-3xl mb-3 block" style={{ color: GHOST }} />
              <p className="text-[12px] font-bold" style={{ color: MUTED }}>Aucun livreur enregistré</p>
              <p className="text-[11px] mt-1" style={{ color: MUTED }}>
                {order?.delivery_mode === "buyticle"
                  ? "Ajoute des livreurs dans Super Admin → Livraison."
                  : "Ajoute tes livreurs dans Réglages → Livraison."}
              </p>
            </div>
          ) : list.map(c => (
            <button key={c.id} onClick={() => onAssign(c.id)} disabled={busy}
              className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 border-b last:border-0 disabled:opacity-50"
              style={{ borderColor: BORDER,
                       background: order?.courier_id === c.id ? "#FFF8EF" : undefined }}>
              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                style={{ background: "#EDEFEF" }}>
                {c.avatar_url
                  ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <i className="fa-solid fa-user text-[12px]" style={{ color: MUTED }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[13px] truncate" style={{ color: INK }}>
                  {c.full_name}{c.is_me && <span className="ml-1.5 text-[10px]" style={{ color: ACCENT }}>(moi)</span>}
                </p>
                <p className="text-[11px]" style={{ color: MUTED }}>
                  {c.phone || "Sans téléphone"} · {c.active_runs} course{c.active_runs > 1 ? "s" : ""} en cours
                </p>
              </div>
              {order?.courier_id === c.id
                ? <i className="fa-solid fa-circle-check text-[14px]" style={{ color: ACCENT }} />
                : <i className="fa-solid fa-chevron-right text-[11px]" style={{ color: GHOST }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   COLONNE 2 — la course sélectionnée et qui la porte
   ════════════════════════════════════════════════════════════════════════════ */
/* Les trois moments d'une course. L'écran n'en déduit pas l'ordre : il lit
   les horodatages posés par la base et propose le pas suivant. */
const COURSE_STEPS = [
  { key: "start",  icon: "fa-play",         label: "Départ" },
  { key: "pickup", icon: "fa-box-open",     label: "Colis récupéré" },
  { key: "finish", icon: "fa-flag-checkered", label: "Livré" },
];

const nextCourseStep = (order) => {
  if (!order) return { key: null, label: "—", icon: "fa-minus", color: GHOST };
  if (order.status === "delivered")
    return { key: null, label: "Course terminée", icon: "fa-flag-checkered", color: "#007600" };
  if (!order.course_started_at)
    return { key: "start",  label: "Démarrer",         icon: "fa-play",           color: ACCENT };
  if (!order.picked_up_at)
    return { key: "pickup", label: "Colis récupéré",   icon: "fa-box-open",       color: ACCENT };
  return   { key: "finish", label: "Terminer la course", icon: "fa-flag-checkered", color: "#007600" };
};

const FleetCard = ({ total, stats, order, driver, onLocate, canManage,
                    onOpenPicker, onAdvance, onLocateMe, busy, started,
                    stepIndex, nextStep, finished, code, onCode, onOpenSlip }) => (
  <div className={`${card} p-5 flex flex-col h-full`} style={{ borderColor: BORDER }}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <i className="fa-solid fa-truck text-[12px]" style={{ color: INK }} />
        <p className="font-bold text-[14px]" style={{ color: INK }}>Courses</p>
      </div>
      <p className="text-[12px]" style={{ color: MUTED }}>{nfmt(total)} au total</p>
    </div>

    <div className="grid grid-cols-3 gap-2.5">
      {stats.map(s => (
        <div key={s.label} className="rounded-2xl border p-3 text-center" style={{ borderColor: BORDER }}>
          <p className="text-[19px] font-black leading-none" style={{ color: INK }}>{s.value}</p>
          <p className="text-[10px] mt-1.5 leading-tight" style={{ color: MUTED }}>{s.label}</p>
        </div>
      ))}
    </div>

    {/* Le véhicule, comme dans la maquette : un au centre, deux estompés. */}
    <div className="flex items-end justify-center gap-1 my-5 select-none" aria-hidden="true">
      <i className="fa-solid fa-truck-front text-[42px]" style={{ color: "#EDEFEF" }} />
      <i className="fa-solid fa-truck text-[76px]" style={{ color: "#C9CDCD" }} />
      <i className="fa-solid fa-truck-front text-[42px]" style={{ color: "#EDEFEF" }} />
    </div>

    <p className="text-center text-[11px] font-bold mb-3" style={{ color: MUTED }}>
      {order ? <>#{order.order_number || String(order.id).slice(0, 6)} · </> : null}
      <span style={{ color: order && IN_TRANSIT.includes(order.status) ? ACCENT : MUTED }}>
        {order ? (STATUS_LABEL[order.status] || order.status) : "Aucune course sélectionnée"}
      </span>
      {started && <> · partie {new Date(started).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</>}
    </p>

    {/* Le fil de la course. Un seul bouton d'action à la fois : celui du pas
        qui vient. Le reste ne sert qu'à rappeler où l'on en est. */}
    {order && canManage && (
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-1.5">
          {COURSE_STEPS.map((st, i) => {
            const done = i < stepIndex, now = i === stepIndex;
            return (
              <React.Fragment key={st.key}>
                {i > 0 && <span className="flex-1 h-[2px] rounded-full"
                  style={{ background: done || now ? ACCENT : "#EDEFEF" }} />}
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] flex-shrink-0"
                  title={st.label}
                  style={{ background: done ? ACCENT : now ? "#FFF3E0" : "#EDEFEF",
                           color: done ? "#fff" : now ? "#B26200" : GHOST }}>
                  <i className={`fa-solid ${done ? "fa-check" : st.icon}`} />
                </span>
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={onOpenPicker} disabled={busy || finished}
            className="h-10 px-3 rounded-xl border text-[12px] font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ borderColor: BORDER, color: INK }}
            title={order.courier_id ? "Changer de livreur" : "Attribuer un livreur"}>
            <i className="fa-solid fa-id-badge text-[11px]" />
            <span className="hidden sm:inline">{order.courier_id ? "Changer" : "Attribuer"}</span>
          </button>

          {!started && (
            <button onClick={onLocateMe} disabled={busy} title="Partir de ma position"
              className="w-10 h-10 rounded-xl border flex items-center justify-center disabled:opacity-50"
              style={{ borderColor: BORDER, color: MUTED }}>
              <i className="fa-solid fa-crosshairs text-[11px]" />
            </button>
          )}

          {nextStep.key === "finish" ? (
            <>
              <input value={code} onChange={e => onCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Code" inputMode="numeric" maxLength={4}
                className="w-[74px] h-10 rounded-xl border text-center text-[15px] font-black tracking-[0.2em] outline-none"
                style={{ borderColor: code.length === 4 ? "#007600" : BORDER, color: INK }} />
              <button onClick={() => onAdvance("finish")} disabled={busy}
                className="flex-1 h-10 rounded-xl text-[12px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: "#007600" }}>
                <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-flag-checkered"} text-[11px]`} />
                Terminer
              </button>
            </>
          ) : (
            <button onClick={() => onAdvance(nextStep.key)}
              disabled={busy || !nextStep.key || !order.courier_id}
              className="flex-1 h-10 rounded-xl text-[12px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: nextStep.key ? nextStep.color : "#007600" }}>
              <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : nextStep.icon} text-[11px]`} />
              {nextStep.label}
            </button>
          )}
        </div>

        {/* Le code est la preuve la plus simple. Quand le client ne peut pas le
            donner, la fiche de remise prend le relais et vaut autant. Clore
            sans l'un ni l'autre reste possible, mais le doute profitera au
            client en cas de litige — on le dit avant, pas après. */}
        {nextStep.key === "finish" && (
          <>
            <p className="text-[10px] leading-snug" style={{ color: MUTED }}>
              <i className="fa-solid fa-key mr-1" />
              Demande au client les 4 chiffres affichés dans son suivi.
              {code.length === 4
                ? " Remise prouvée."
                : " Sans code ni fiche, la remise n'est pas prouvée."}
            </p>
            <button onClick={onOpenSlip} disabled={busy}
              className="w-full h-9 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ borderColor: BORDER, color: INK }}>
              <i className="fa-solid fa-file-signature text-[11px]" />
              Le client ne peut pas donner son code
            </button>
          </>
        )}

        {!order.courier_id && (
          <p className="text-[10px]" style={{ color: MUTED }}>
            <i className="fa-solid fa-circle-info mr-1" />
            Attribue la course — ou prends-la — avant de pouvoir la démarrer.
          </p>
        )}
      </div>
    )}

    <div className="flex items-center gap-3 pt-4 border-t mt-auto" style={{ borderColor: BORDER }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: driver?.name ? DARK : "#EDEFEF" }}>
        <i className="fa-solid fa-user text-[13px]" style={{ color: driver?.name ? ACCENT : GHOST }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[13px] truncate" style={{ color: INK }}>
          {driver?.name || "Aucun livreur assigné"}
        </p>
        <p className="text-[11px]" style={{ color: MUTED }}>{driver?.role || "Livreur"}</p>
      </div>
      <div className="flex gap-1.5">
        <button onClick={onLocate} disabled={!order}
          className="w-9 h-9 rounded-full border flex items-center justify-center disabled:opacity-40"
          style={{ borderColor: BORDER, color: MUTED }} title="Centrer sur la course">
          <i className="fa-solid fa-location-dot text-[11px]" />
        </button>
        <a href={driver?.phone ? `tel:${driver.phone}` : undefined}
          className={`w-9 h-9 rounded-full border flex items-center justify-center ${driver?.phone ? "" : "opacity-40 pointer-events-none"}`}
          style={{ borderColor: BORDER, color: MUTED }} title="Appeler">
          <i className="fa-solid fa-phone text-[11px]" />
        </a>
        <a href={order?.client_phone ? `sms:${order.client_phone}` : undefined}
          className={`w-9 h-9 rounded-full border flex items-center justify-center ${order?.client_phone ? "" : "opacity-40 pointer-events-none"}`}
          style={{ borderColor: BORDER, color: MUTED }} title="Écrire au client">
          <i className="fa-solid fa-envelope text-[11px]" />
        </a>
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   COLONNE 3 — la course en tête, puis le chiffre
   ════════════════════════════════════════════════════════════════════════════ */
const FLOW = ["confirmed", "paid", "shipped", "in_transit", "delivered"];

const LatestOrderCard = ({ order, leg, pickupLeg, onSeeAll }) => {
  const step  = Math.max(0, FLOW.indexOf(order?.status || ""));
  const pct   = order?.status === "delivered" ? 100 : Math.round((step / (FLOW.length - 1)) * 100);

  // Un trajet manquant a toujours une cause précise. La nommer évite au vendeur
  // de croire à une panne alors qu'il lui manque une épingle.
  const gap = !order ? null
    : !Number.isFinite(order.pickup_lat) ? "La boutique n'a pas placé sa position sur la carte."
    : !Number.isFinite(order.client_lat) ? "Le client n'a pas enregistré sa position."
    : null;

  return (
    <div className={`${card} p-5`} style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-box text-[12px]" style={{ color: INK }} />
          <p className="font-bold text-[14px]" style={{ color: INK }}>Course en tête</p>
        </div>
        <button onClick={onSeeAll} className="text-[12px] font-bold hover:underline" style={{ color: MUTED }}>
          Tout voir
        </button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <p className="font-black text-[14px]" style={{ color: INK }}>
              #{order?.order_number || (order ? String(order.id).slice(0, 8) : "—")}
            </p>
            {order && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                style={{ background: "#FFF3E0", color: "#B26200" }}>
                {STATUS_LABEL[order.status] || order.status}
              </span>
            )}
          </div>
          <p className="text-[11px] leading-snug mb-3 line-clamp-2" style={{ color: MUTED }}>
            {order?.client_address || "Aucune course à afficher."}
          </p>

          <div className="relative h-[3px] rounded-full mb-1" style={{ background: "#EDEFEF" }}>
            <div className="absolute left-0 top-0 h-full rounded-full"
              style={{ width: `${pct}%`, background: ACCENT }} />
            <i className="fa-solid fa-truck-fast absolute text-[11px] -top-[6px]"
              style={{ left: `calc(${pct}% - 8px)`, color: INK }} />
          </div>
          {gap ? (
            <p className="text-[10px] font-bold" style={{ color: "#B26200" }}>
              <i className="fa-solid fa-triangle-exclamation mr-1" />{gap}
            </p>
          ) : (
            <p className="text-[10px]" style={{ color: MUTED }}>
              {pickupLeg?.km != null && (
                <>ramasse {formatKm(pickupLeg.km)} · </>
              )}
              {leg?.km != null
                ? <>remise {formatKm(leg.km)} · {formatDuration(leg.minutes)}{leg.approximate ? " (estimé)" : ""}</>
                : "Trajet en cours de calcul…"}
            </p>
          )}
        </div>

        <div className="w-[110px] h-[92px] rounded-2xl overflow-hidden flex-shrink-0 border"
          style={{ background: "#EDEFEF", borderColor: BORDER }}>
          {order && Number.isFinite(order.client_lat) ? (
            <DeliveryMap
              theme="light" interactive={false} zoom={14}
              center={{ lat: order.client_lat, lng: order.client_lng }}
              markers={[{ lat: order.client_lat, lng: order.client_lng, color: ACCENT, icon: "fa-location-dot" }]}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <i className="fa-solid fa-location-crosshairs text-[18px]" style={{ color: GHOST }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RevenueCard = ({ months, total, delta }) => {
  const max = Math.max(1, ...months.map(m => m.v));
  return (
    <div className={`${card} p-5`} style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-money-bill-wave text-[12px]" style={{ color: INK }} />
          <p className="font-bold text-[14px]" style={{ color: INK }}>Frais de course</p>
        </div>
        <span className="text-[11px] font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5"
          style={{ borderColor: BORDER, color: MUTED }}>
          12 derniers mois <i className="fa-regular fa-calendar text-[10px]" />
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <p className="text-[26px] font-black leading-none" style={{ color: INK }}>{money(total)}</p>
        {delta != null && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: delta >= 0 ? "#FFF3E0" : "#FEE7E5", color: delta >= 0 ? "#B26200" : "#B12704" }}>
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>

      <div className="h-[92px] -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1}
              tick={{ fontSize: 10, fill: MUTED }} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }}
              contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }}
              formatter={(v) => [money(v), "Frais"]} />
            <Bar dataKey="v" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {months.map((m, i) => (
                <Cell key={i} fill={m.v >= max * 0.55 ? ACCENT : "#E3E6E6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   LISTE DES COURSES — l'onglet « Courses »
   ════════════════════════════════════════════════════════════════════════════ */
const CourseList = ({ orders, selectedId, onSelect }) => (
  <div className={`${card} overflow-hidden`} style={{ borderColor: BORDER }}>
    <div className="px-5 py-4 border-b" style={{ borderColor: BORDER }}>
      <p className="font-bold text-[14px]" style={{ color: INK }}>{orders.length} course{orders.length > 1 ? "s" : ""}</p>
    </div>
    {orders.length === 0 ? (
      <div className="py-14 text-center">
        <i className="fa-solid fa-box-open text-3xl mb-3 block" style={{ color: GHOST }} />
        <p className="text-[13px] font-bold" style={{ color: MUTED }}>Aucune course dans ce filtre</p>
      </div>
    ) : (
      <div className="divide-y max-h-[520px] overflow-y-auto" style={{ borderColor: BORDER }}>
        {orders.map(o => (
          <button key={o.id} onClick={() => onSelect(o.id)}
            className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors"
            style={selectedId === o.id ? { background: "#FFF8EF" } : undefined}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: o.status === "delivered" ? "#E8F5E8" : "#FFF3E0" }}>
              <i className={`fa-solid ${o.status === "delivered" ? "fa-check" : "fa-truck-fast"} text-[11px]`}
                style={{ color: o.status === "delivered" ? "#007600" : "#B26200" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[13px] truncate" style={{ color: INK }}>
                #{o.order_number || String(o.id).slice(0, 8)} · {o.client_name}
              </p>
              <p className="text-[11px] truncate" style={{ color: MUTED }}>{o.client_address || "Adresse non précisée"}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-[13px]" style={{ color: INK }}>{money(o.total_amount)}</p>
              <p className="text-[10px]" style={{ color: MUTED }}>
                {o.delivery_mode === "buyticle" ? "Buyticle Delivery" : "Livrée par la boutique"}
              </p>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════════════ */
const DeliveryConsole = () => {
  const { orderId }       = useParams();
  const navigate          = useNavigate();
  const { user, vendor, isSuperAdmin, loading: authLoading } = useAuth();

  const [feed,     setFeed]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [selected, setSelected] = useState(orderId || null);
  const [filter,   setFilter]   = useState("transit");
  const [tab,      setTab]      = useState("board");
  const [route,    setRoute]    = useState(null);
  const [leg,      setLeg]      = useState(null);
  const [pickupLeg, setPickupLeg] = useState(null);
  const [center,   setCenter]   = useState(DEFAULT_CENTER);
  const [profile,  setProfile]  = useState(null);
  const [hub,      setHub]      = useState(null);
  // Là où se trouve celui qui regarde. Demandé sur clic, jamais au chargement :
  // une console qui réclame le GPS à l'ouverture se fait refuser une fois pour
  // toutes par le navigateur.
  const [myPos,    setMyPos]    = useState(null);
  const [picker,   setPicker]   = useState(false);
  const [acting,   setActing]   = useState(false);
  const [code,     setCode]     = useState("");
  const [slipFor,  setSlipFor]  = useState(null);

  /* ── Chargement ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true); setError("");
      const [{ data, error: e }, { data: prof }, { data: rates }] = await Promise.all([
        supabase.rpc("delivery_feed"),
        supabase.from("profiles").select("full_name, avatar_url, is_driver").eq("id", user.id).maybeSingle(),
        supabase.from("delivery_rates").select("hub_lat, hub_lng, hub_label").maybeSingle(),
      ]);
      if (!alive) return;
      if (e) setError(e.message);
      setFeed(data || []);
      setProfile(prof || null);
      setHub(rates?.hub_lat != null
        ? { lat: rates.hub_lat, lng: rates.hub_lng, label: rates.hub_label }
        : null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  const reload = async () => {
    const { data } = await supabase.rpc("delivery_feed");
    setFeed(data || []);
  };

  /* ── Attribution et démarrage ─────────────────────────────────────────── */
  const assign = async (courierId) => {
    setActing(true); setError("");
    const { error: e } = await supabase.rpc("assign_courier", {
      p_order_id: current.id, p_courier_id: courierId,
    });
    if (e) setError(e.message); else { setPicker(false); await reload(); }
    setActing(false);
  };

  const take = async () => {
    setActing(true); setError("");
    const { error: e } = await supabase.rpc("take_course", { p_order_id: current.id });
    if (e) setError(e.message); else { setPicker(false); await reload(); }
    setActing(false);
  };

  // La position est un plus, pas une condition : un livreur qui refuse le GPS
  // doit quand même pouvoir démarrer. La base retient alors le siège.
  const locateMe = async () => {
    setError("");
    try { setMyPos(await currentPosition()); }
    catch (e) { setError(e.message); }
  };

  // Un seul chemin pour les trois pas : la base vérifie l'ordre, l'écran se
  // contente de proposer le suivant. La position n'est demandée qu'au départ,
  // et son refus ne bloque rien — la base retient alors le siège.
  const advance = async (step) => {
    if (!current || !step) return;
    setActing(true); setError("");
    let pos = myPos;
    if (step === "start" && !pos) {
      try { pos = await currentPosition(); setMyPos(pos); } catch { pos = null; }
    }
    const { error: e } = await supabase.rpc("advance_course", {
      p_order_id: current.id, p_step: step,
      p_lat: step === "start" ? (pos?.lat ?? null) : null,
      p_lng: step === "start" ? (pos?.lng ?? null) : null,
      p_code: step === "finish" ? (code.trim() || null) : null,
    });
    if (e) setError(e.message); else { setCode(""); await reload(); }
    setActing(false);
  };

  /* ── Filtrage ─────────────────────────────────────────────────────────── */
  const visible = useMemo(() => {
    if (filter === "all")       return feed;
    if (filter === "transit")   return feed.filter(o => IN_TRANSIT.includes(o.status));
    if (filter === "delivered") return feed.filter(o => o.status === "delivered");
    return feed.filter(o => ["pending", "confirmed", "paid", "pending_payment"].includes(o.status));
  }, [feed, filter]);

  const current = useMemo(
    () => feed.find(o => o.id === selected) || visible[0] || feed[0] || null,
    [feed, visible, selected]
  );

  /* ── Tracé de la course choisie ───────────────────────────────────────── */
  const byBuyticle = current?.delivery_mode === "buyticle";

  /* D'où part la course. Une course ne commence pas à la boutique : le livreur
     doit d'abord y aller. Par ordre de vérité décroissante :
       1. ma position, si je l'ai partagée — c'est le vrai « où je suis » ;
       2. le point figé au démarrage, pour qui regarde après coup ;
       3. le siège Buyticle, quand c'est nous qui livrons.
     Une boutique qui livre elle-même et n'a rien démarré part de sa devanture :
     deux points suffisent alors. */
  const origin = useMemo(() => {
    if (myPos) return { ...myPos, label: "Ma position", live: true };
    if (Number.isFinite(current?.origin_lat))
      return { lat: current.origin_lat, lng: current.origin_lng, label: "Départ" };
    if (byBuyticle && hub) return { ...hub, label: hub.label || "Base Buyticle" };
    return null;
  }, [myPos, current?.origin_lat, current?.origin_lng, byBuyticle, hub]);

  useEffect(() => {
    let alive = true;
    if (!current || !Number.isFinite(current.pickup_lat) || !Number.isFinite(current.client_lat)) {
      setRoute(null); setLeg(null); setPickupLeg(null);
      return;
    }
    const pickup = { lat: current.pickup_lat, lng: current.pickup_lng };
    (async () => {
      // Trajet 2, celui qu'on facture au client : boutique → client.
      const drop = await routeBetween([pickup, { lat: current.client_lat, lng: current.client_lng }]);
      // Trajet 1 : d'où je suis jusqu'au colis. Il disparaît dès que le colis
      // est récupéré — le montrer encore ferait croire qu'il reste à faire.
      const pick = origin && !current.picked_up_at
        ? await routeBetween([origin, pickup]) : null;
      if (!alive) return;
      setRoute([...(pick?.coords || []), ...(drop?.coords || [])]);
      setLeg(drop || null);
      setPickupLeg(pick || null);
    })();
    return () => { alive = false; };
  }, [current?.id, current?.pickup_lat, current?.client_lat, current?.picked_up_at, origin?.lat, origin?.lng]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Marqueurs : la course choisie en entier, les autres en point ─────── */
  const markers = useMemo(() => {
    const out = [];
    if (current) {
      // 1 · où je suis — tant que le colis reste à prendre
      if (origin && !current.picked_up_at && Number.isFinite(current.pickup_lat))
        out.push({ lat: origin.lat, lng: origin.lng, color: "#4a5057",
                   icon: origin.live ? "fa-person-biking" : "fa-warehouse", label: origin.label });
      // 2 · où je vais chercher le produit
      if (Number.isFinite(current.pickup_lat))
        out.push({ lat: current.pickup_lat, lng: current.pickup_lng, color: DARK,
                   icon: "fa-store", label: current.shop_name || "Boutique" });
      // 3 · où je le livre
      if (Number.isFinite(current.client_lat))
        out.push({ lat: current.client_lat, lng: current.client_lng, color: ACCENT,
                   icon: "fa-location-dot", label: current.client_name });
    }
    visible
      .filter(o => o.id !== current?.id && Number.isFinite(o.client_lat))
      .slice(0, 40)
      .forEach(o => out.push({
        lat: o.client_lat, lng: o.client_lng, color: "#7a7f85", icon: "fa-box",
        title: `#${o.order_number || String(o.id).slice(0, 8)} — ${o.client_name}`,
      }));
    return out;
  }, [current, visible, origin]);

  /* ── Indicateurs, tous tirés des commandes réelles ────────────────────── */
  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const delivered      = feed.filter(o => o.status === "delivered");
    const deliveredMonth = delivered.filter(o => new Date(o.delivered_at || o.created_at) >= monthStart);
    const closed         = feed.filter(o => ["delivered", "cancelled", "payment_failed"].includes(o.status));
    const successRate    = closed.length ? Math.round((delivered.length / closed.length) * 100) : 100;

    // 30 derniers jours, une valeur par jour.
    const series = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (29 - i));
      const key = d.toDateString();
      return {
        label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        v: feed.filter(o => new Date(o.created_at).toDateString() === key).length,
      };
    });

    // « En retard » : accepté depuis plus de 48 h et toujours pas livré.
    const late = feed.filter(o =>
      !["delivered", "cancelled", "payment_failed", "pending", "pending_payment"].includes(o.status) &&
      (Date.now() - new Date(o.created_at).getTime()) > 48 * 3600 * 1000
    ).length;
    const active = feed.filter(o => !["cancelled", "payment_failed"].includes(o.status)).length;

    // Délai moyen, uniquement sur les courses horodatées.
    const timed = delivered.filter(o => o.delivered_at);
    const avgMin = timed.length
      ? Math.round(timed.reduce((s, o) =>
          s + (new Date(o.delivered_at) - new Date(o.created_at)) / 60000, 0) / timed.length)
      : null;

    // Frais de course par mois sur un an glissant.
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return {
        label: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
        key: `${d.getFullYear()}-${d.getMonth()}`, v: 0,
      };
    });
    feed.forEach(o => {
      const d = new Date(o.created_at);
      const m = months.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.v += Number(o.course_fee || 0);
    });
    const totalFees = months.reduce((s, m) => s + m.v, 0);
    const delta = months[10].v ? Math.round(((months[11].v - months[10].v) / months[10].v) * 100) : null;

    const inTransit = feed.filter(o => IN_TRANSIT.includes(o.status)).length;
    const km = feed.reduce((s, o) => s + Number(o.dropoff_km || 0), 0);
    const onTime = active ? Math.round(((active - late) / active) * 100) : 100;

    return {
      series, delivered: deliveredMonth.length, successRate, inTransit, late,
      latePct: active ? Math.round((late / active) * 100) : 0,
      avgMin, months, totalFees, delta,
      feesMonth: months[11].v, total: feed.length, km: Math.round(km), onTime,
    };
  }, [feed]);

  const monthlySpark = useMemo(() => kpis.months.map(m => ({ v: m.v })), [kpis.months]);

  /* ── Portes ───────────────────────────────────────────────────────────── */
  if (authLoading || (user && loading)) return <DeliveryLoader />;

  if (!user) return (
    <LockedOut
      title="Connexion requise"
      message="Buyticle Delivery est réservé aux comptes vendeur, livreur et administrateur. Connecte-toi, tu reviendras ici directement."
      cta={
        <Link to={`/login?redirect=${encodeURIComponent(orderId ? `/delivery/${orderId}` : "/delivery")}`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] text-white"
          style={{ background: ACCENT }}>
          <i className="fa-solid fa-right-to-bracket text-[12px]" />Se connecter
        </Link>
      }
    />
  );

  const isDriver = !!profile?.is_driver;
  if (!vendor && !isSuperAdmin && !isDriver) return (
    <LockedOut
      title="Accès réservé"
      message="Ce module suit les livraisons des boutiques. Ton compte n'est ni vendeur, ni livreur, ni administrateur — il n'a donc aucune course à afficher."
      cta={
        <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] text-white"
          style={{ background: DARK }}>
          <i className="fa-solid fa-house text-[12px]" />Retour à la boutique
        </Link>
      }
    />
  );

  const role = isSuperAdmin ? "Administrateur" : isDriver ? "Livreur" : "Vendeur";
  const driver = current?.courier_name
    ? { name: current.courier_name, phone: current.courier_phone,
        role: current.delivery_mode === "buyticle" ? "Livreur Buyticle" : "Livreur de la boutique" }
    : null;

  return (
    <div className="min-h-screen p-3 sm:p-4 space-y-3 sm:space-y-4" style={{ background: "#F3F4F4" }}>
      <Topbar
        tab={tab} onTab={setTab}
        avatar={profile?.avatar_url} name={profile?.full_name || user.email} role={role}
        onExit={() => navigate(isSuperAdmin ? "/super-admin" : "/admin")}
      />

      {error && (
        <div className="rounded-2xl px-4 py-3 text-[12px] font-bold"
          style={{ background: "#FEE7E5", color: "#B12704" }}>
          <i className="fa-solid fa-circle-exclamation mr-2" />{error}
        </div>
      )}

      <MapPanel
        markers={markers} route={route} center={center} orders={feed}
        filter={filter} onFilter={setFilter}
        onPickPlace={(h) => setCenter({ lat: h.lat, lng: h.lng })}
      />

      {slipFor && (
        <DeliverySlipForm
          order={slipFor}
          onClose={() => setSlipFor(null)}
          onDone={async () => { setSlipFor(null); setCode(""); await reload(); }}
        />
      )}

      <CourierPicker
        order={current} open={picker} busy={acting}
        onClose={() => setPicker(false)} onAssign={assign} onTake={take}
      />

      {tab === "courses" ? (
        <CourseList orders={visible} selectedId={current?.id}
          onSelect={(id) => { setSelected(id); setTab("board"); }} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 items-stretch">
          {/* ── colonne 1 ── */}
          <div className="space-y-3 sm:space-y-4">
            <VolumeCard series={kpis.series} delivered={kpis.delivered} successRate={kpis.successRate} />
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <MiniCard label="Courses en route" value={nfmt(kpis.inTransit)} kind="bar" spark={monthlySpark} />
              <MiniCard label="Courses en retard" value={nfmt(kpis.late)}
                badge={`${kpis.latePct}% des courses`} />
              <MiniCard label="Frais encaissés ce mois" value={money(kpis.feesMonth)} spark={monthlySpark} />
              <MiniCard label="Délai moyen"
                value={kpis.avgMin != null ? formatDuration(kpis.avgMin) : "—"} />
            </div>
          </div>

          {/* ── colonne 2 ── */}
          <FleetCard
            total={kpis.total}
            stats={[
              { value: nfmt(kpis.delivered), label: "Livrées ce mois" },
              { value: `${kpis.onTime}%`,    label: "Dans les temps" },
              { value: nfmt(kpis.km),        label: "Distance (km)" },
            ]}
            order={current} driver={driver}
            canManage={!!current?.can_manage}
            started={current?.course_started_at}
            finished={current?.status === "delivered"}
            stepIndex={current?.status === "delivered" ? 3
                       : current?.picked_up_at ? 2
                       : current?.course_started_at ? 1 : 0}
            nextStep={nextCourseStep(current)}
            code={code} onCode={setCode}
            onOpenSlip={() => setSlipFor(current)}
            busy={acting}
            onOpenPicker={() => setPicker(true)}
            onAdvance={advance}
            onLocateMe={locateMe}
            onLocate={() => current && setCenter({ lat: current.client_lat, lng: current.client_lng })}
          />

          {/* ── colonne 3 ── */}
          <div className="space-y-3 sm:space-y-4">
            <LatestOrderCard order={current} leg={leg} pickupLeg={pickupLeg} onSeeAll={() => setTab("courses")} />
            <RevenueCard months={kpis.months} total={kpis.totalFees} delta={kpis.delta} />
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryConsole;
