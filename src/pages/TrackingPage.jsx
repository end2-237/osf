import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUSES = {
  pending:   { step: 0, label: "Commande reçue",  color: "#FF9900",  bg: "bg-[#FFF8D3]",  border: "border-[#FCD200]/50", text: "text-[#C45500]", icon: "fa-clock" },
  confirmed: { step: 1, label: "En préparation",  color: "#007185",  bg: "bg-[#E6F3F5]",  border: "border-[#007185]/40", text: "text-[#007185]", icon: "fa-box" },
  shipped:   { step: 2, label: "En route 🚀",     color: "#FF9900",  bg: "bg-[#FFF8D3]",  border: "border-[#FF9900]/40", text: "text-[#C45500]", icon: "fa-truck-fast" },
  delivered: { step: 3, label: "Livrée ✓",        color: "#007600",  bg: "bg-[#E8F5E8]",  border: "border-[#007600]/40", text: "text-[#007600]", icon: "fa-house-circle-check" },
  cancelled: { step: -1, label: "Annulée",        color: "#B12704",  bg: "bg-[#FEE7E5]",  border: "border-[#B12704]/40", text: "text-[#B12704]", icon: "fa-xmark-circle" },
};

const TIMELINE = [
  { key: "pending",   label: "Commande reçue",   icon: "fa-circle-check",       desc: "Commande confirmée par OFS" },
  { key: "confirmed", label: "En préparation",   icon: "fa-box-open",            desc: "Votre commande est en cours de préparation" },
  { key: "shipped",   label: "En livraison",     icon: "fa-truck-fast",          desc: "Votre livreur OFS est en route" },
  { key: "delivered", label: "Livrée",           icon: "fa-house-circle-check",  desc: "Commande remise avec succès" },
];

const ETA_MAP = {
  pending:   "~30–45 min",
  confirmed: "~20–30 min",
  shipped:   "~10–20 min",
  delivered: null,
};

// ─── ADD MINUTES TO A DATE ────────────────────────────────────────────────────
const addMin = (iso, min) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + min);
  return d;
};

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

// ─── MOCK STEP TIMES based on created_at ─────────────────────────────────────
const getStepTimes = (order) => {
  const base = order.created_at;
  return {
    pending:   fmtTime(base),
    confirmed: fmtTime(addMin(base, 3)),
    shipped:   fmtTime(addMin(base, 18)),
    delivered: fmtTime(addMin(base, 45)),
  };
};

// ─── DELIVERY PROGRESS BAR ───────────────────────────────────────────────────
const DeliveryBar = ({ status }) => {
  const st    = STATUSES[status] || STATUSES.pending;
  const step  = st.step;
  const pct   = Math.max(0, (step / 3) * 100);
  const isMoving = status === "shipped";
  const done  = status === "delivered";
  const cancelled = status === "cancelled";

  if (cancelled) return (
    <div className="bg-[#B12704]/10 border border-[#B12704]/30 rounded-xl px-6 py-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-[#B12704]/15 flex items-center justify-center flex-shrink-0">
        <i className="fa-solid fa-xmark text-[#B12704] text-xl"></i>
      </div>
      <div>
        <p className="font-black text-[#B12704] text-base">Commande annulée</p>
        <p className="text-[#565959] text-sm mt-0.5">Cette commande a été annulée. Contactez le support si nécessaire.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Progress track */}
      <div className="relative">
        <div className="h-2 bg-[#EAEDED] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: done ? "100%" : `${pct}%`,
              background: done ? "#007600" : "linear-gradient(90deg, #FF9900, #FFD814)",
            }}
          />
        </div>

        {/* Truck icon */}
        {!done && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-1000"
            style={{ left: `${Math.min(pct, 96)}%` }}
          >
            <div className={`w-8 h-8 rounded-full bg-[#131921] border-2 border-[#FF9900] flex items-center justify-center shadow-lg ${isMoving ? "animate-bounce" : ""}`}>
              <i className="fa-solid fa-truck-fast text-[#FF9900] text-[10px]"></i>
            </div>
          </div>
        )}

        {/* Done checkmark */}
        {done && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
            <div className="w-8 h-8 rounded-full bg-[#007600] flex items-center justify-center shadow-lg">
              <i className="fa-solid fa-check text-white text-[10px]"></i>
            </div>
          </div>
        )}
      </div>

      {/* Step labels */}
      <div className="grid grid-cols-4 gap-1">
        {TIMELINE.map((t, i) => {
          const active = i === step;
          const past   = i < step;
          return (
            <div key={t.key} className="flex flex-col items-center text-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                past   ? "bg-[#007600] border-[#007600]" :
                active ? "bg-[#131921] border-[#FF9900] shadow-[0_0_0_3px_rgba(255,153,0,0.2)]" :
                         "bg-white border-[#D5D9D9]"
              }`}>
                {past
                  ? <i className="fa-solid fa-check text-white text-[9px]"></i>
                  : <i className={`fa-solid ${t.icon} text-[9px] ${active ? "text-[#FF9900]" : "text-[#D5D9D9]"}`}></i>
                }
              </div>
              <p className={`text-[9px] font-black uppercase tracking-wide leading-tight ${
                active ? "text-[#FF9900]" : past ? "text-[#007600]" : "text-[#ADBAC7]"
              }`}>
                {t.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── MAP PLACEHOLDER ──────────────────────────────────────────────────────────
const DeliveryMap = ({ order }) => {
  const status = order?.status;
  const isMoving = status === "shipped";
  const done = status === "delivered";

  return (
    <div className="relative bg-[#131921] rounded-xl overflow-hidden" style={{ minHeight: 180 }}>
      {/* Stylised grid */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "linear-gradient(#FF9900 1px, transparent 1px), linear-gradient(90deg, #FF9900 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Route line (SVG) */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 180" preserveAspectRatio="none">
        <defs>
          <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF9900" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFD814" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <path
          d="M 40,140 C 100,140 120,60 200,60 C 280,60 300,100 360,80"
          fill="none"
          stroke="url(#routeGrad)"
          strokeWidth="2.5"
          strokeDasharray="8 4"
        />
        {/* Origin dot */}
        <circle cx="40" cy="140" r="6" fill="#FF9900" />
        {/* Destination dot */}
        <circle cx="360" cy="80" r="6" fill={done ? "#007600" : "#565959"} />
      </svg>

      {/* Origin label */}
      <div className="absolute bottom-4 left-6">
        <div className="bg-[#232F3E] border border-[#FF9900]/30 rounded-lg px-3 py-2">
          <p className="text-[8px] font-black uppercase text-[#FF9900] tracking-widest">Départ</p>
          <p className="text-[11px] font-bold text-white">Bonamoussadi 🇨🇲</p>
        </div>
      </div>

      {/* Destination label */}
      <div className="absolute top-4 right-6">
        <div className={`border rounded-lg px-3 py-2 ${done ? "bg-[#007600]/20 border-[#007600]/40" : "bg-[#232F3E] border-[#D5D9D9]/20"}`}>
          <p className={`text-[8px] font-black uppercase tracking-widest ${done ? "text-[#007600]" : "text-[#ADBAC7]"}`}>
            {done ? "Livré ✓" : "Destination"}
          </p>
          <p className="text-[11px] font-bold text-white">{order?.client_address?.split(",")[0] || "Adresse client"}</p>
        </div>
      </div>

      {/* Moving truck */}
      {isMoving && (
        <div className="absolute top-[42%] left-[48%] -translate-x-1/2 -translate-y-1/2 animate-bounce">
          <div className="w-10 h-10 bg-[#FF9900] rounded-full flex items-center justify-center shadow-lg shadow-[#FF9900]/40 border-2 border-[#FFD814]">
            <i className="fa-solid fa-truck-fast text-[#0F1111] text-sm"></i>
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#FF9900]"></div>
        </div>
      )}

      {/* OFS badge */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2">
        <div className="bg-[#131921]/80 backdrop-blur-sm border border-[#FF9900]/20 rounded-full px-3 py-1 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF9900] animate-pulse"></div>
          <span className="text-[8px] font-black uppercase tracking-widest text-[#FF9900]">OFS Tracking Live</span>
        </div>
      </div>
    </div>
  );
};

// ─── COURIER CARD ─────────────────────────────────────────────────────────────
const CourierCard = ({ status }) => {
  if (!["shipped", "confirmed"].includes(status)) return null;

  const couriers = [
    { name: "Jean-Paul K.", avatar: "J", rating: 4.9, trips: 312, phone: "+237 6XX XXX XXX" },
    { name: "Alain N.",     avatar: "A", rating: 4.8, trips: 187, phone: "+237 6XX XXX XXX" },
    { name: "Patrick M.",   avatar: "P", rating: 5.0, trips: 94,  phone: "+237 6XX XXX XXX" },
  ];
  const courier = couriers[Math.floor(Math.random() * couriers.length)];

  return (
    <div className="bg-white border border-[#D5D9D9] rounded-xl p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-[#232F3E] flex items-center justify-center border-2 border-[#FF9900]/50 flex-shrink-0">
        <span className="text-[#FF9900] font-black text-lg">{courier.avatar}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-bold text-[#0F1111] text-sm">{courier.name}</p>
          <span className="text-[9px] font-black bg-[#007600]/10 text-[#007600] border border-[#007600]/20 px-1.5 py-0.5 rounded uppercase">OFS Livreur</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#565959]">
          <span className="flex items-center gap-1"><i className="fa-solid fa-star text-[#FF9900] text-[9px]"></i>{courier.rating}</span>
          <span>{courier.trips} livraisons</span>
        </div>
      </div>
      <a
        href={`https://wa.me/${courier.phone.replace(/\s/g, "")}`}
        className="w-10 h-10 bg-[#25D366] hover:bg-[#20BD5A] rounded-full flex items-center justify-center transition-colors flex-shrink-0"
      >
        <i className="fa-brands fa-whatsapp text-white text-lg"></i>
      </a>
    </div>
  );
};

// ─── ORDER ITEMS ──────────────────────────────────────────────────────────────
const OrderItems = ({ items, loading }) => {
  if (loading) return (
    <div className="space-y-3">
      {[1,2].map(i => (
        <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-[#F3F4F4] rounded-lg">
          <div className="w-14 h-14 bg-[#D5D9D9] rounded-lg flex-shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-[#D5D9D9] rounded w-3/4"></div>
            <div className="h-2 bg-[#D5D9D9] rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );
  if (!items?.length) return <p className="text-sm text-[#565959]">Aucun article trouvé.</p>;

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-[#F3F4F4] border border-[#D5D9D9] rounded-lg">
          <div className="w-14 h-14 bg-white rounded-lg overflow-hidden border border-[#D5D9D9] flex-shrink-0">
            {item.product_img
              ? <img src={item.product_img} alt={item.product_name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-box text-[#D5D9D9] text-xl"></i></div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#0F1111] text-sm truncate">{item.product_name}</p>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#565959]">
              {item.selected_size  && <span>Taille : {item.selected_size}</span>}
              {item.selected_color && <span>· {item.selected_color}</span>}
            </div>
            <p className="text-[10px] text-[#565959] mt-0.5">Qté : {item.quantity}</p>
          </div>
          <p className="font-bold text-[#B12704] text-sm flex-shrink-0">
            {(item.unit_price * item.quantity).toLocaleString()} F
          </p>
        </div>
      ))}
    </div>
  );
};

// ─── FULL ORDER TRACKING VIEW ─────────────────────────────────────────────────
const TrackingView = ({ order, items, itemsLoading }) => {
  const st     = STATUSES[order.status] || STATUSES.pending;
  const times  = getStepTimes(order);
  const eta    = ETA_MAP[order.status];
  const step   = st.step;

  return (
    <div className="space-y-4">

      {/* ── STATUS HERO CARD ── */}
      <div className="bg-[#131921] rounded-2xl overflow-hidden">
        {/* Top bar */}
        <div className="bg-[#232F3E] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-location-dot text-[#FF9900] text-sm"></i>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#ADBAC7]">
              Suivi OFS · #{String(order.id).slice(0, 8).toUpperCase()}
            </span>
          </div>
          <span className="text-[9px] font-bold text-[#565959]">{fmtDate(order.created_at)}</span>
        </div>

        <div className="px-5 pt-5 pb-4 space-y-5">
          {/* Status + ETA */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${st.bg} ${st.border} mb-2`}>
                <i className={`fa-solid ${st.icon} text-xs`} style={{ color: st.color }}></i>
                <span className={`text-[10px] font-black uppercase tracking-widest ${st.text}`}>{st.label}</span>
                {order.status === "shipped" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF9900] animate-pulse"></span>
                )}
              </div>
              <p className="text-white font-bold text-xl leading-tight">
                {order.status === "delivered" ? "Bonne réception !" : "En bonne voie 🇨🇲"}
              </p>
              <p className="text-[#ADBAC7] text-[11px] mt-1">
                {order.client_address}
              </p>
            </div>
            {eta && (
              <div className="text-right flex-shrink-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1">ETA</p>
                <p className="text-[#FFD814] font-black text-lg leading-tight">{eta}</p>
                <p className="text-[9px] text-[#565959]">Bonamoussadi → {order.client_address?.split(",")[0]}</p>
              </div>
            )}
            {order.status === "delivered" && (
              <div className="w-12 h-12 rounded-full bg-[#007600] flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-check text-white text-xl"></i>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <DeliveryBar status={order.status} />
        </div>
      </div>

      {/* ── MAP ── */}
      <DeliveryMap order={order} />

      {/* ── COURIER ── */}
      <CourierCard status={order.status} />

      {/* ── TIMELINE détail ── */}
      <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
        <div className="bg-[#232F3E] px-5 py-3 flex items-center gap-2">
          <i className="fa-solid fa-timeline text-[#FF9900] text-sm"></i>
          <span className="font-black text-sm text-white">Historique de la commande</span>
        </div>
        <div className="px-5 py-4 space-y-0">
          {TIMELINE.filter(t => t.key !== "cancelled").map((t, i) => {
            const active = i === step;
            const past   = i < step;
            const future = i > step;
            if (order.status === "cancelled" && i > 0) return null;
            return (
              <div key={t.key} className="flex gap-4">
                {/* Icon + line */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 ${
                    past   ? "bg-[#007600] border-[#007600]" :
                    active ? "bg-[#131921] border-[#FF9900]" :
                             "bg-white border-[#D5D9D9]"
                  }`}>
                    {past
                      ? <i className="fa-solid fa-check text-white text-[9px]"></i>
                      : <i className={`fa-solid ${t.icon} text-[9px] ${active ? "text-[#FF9900]" : "text-[#D5D9D9]"}`}></i>
                    }
                  </div>
                  {i < TIMELINE.length - 1 && (
                    <div className={`w-0.5 h-10 ${past ? "bg-[#007600]" : "bg-[#D5D9D9]"}`}></div>
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center justify-between">
                    <p className={`font-bold text-sm ${future ? "text-[#ADBAC7]" : "text-[#0F1111]"}`}>{t.label}</p>
                    {!future && (
                      <span className="text-[10px] font-bold text-[#565959]">
                        {times[t.key]}
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] mt-0.5 ${future ? "text-[#D5D9D9]" : "text-[#565959]"}`}>{t.desc}</p>
                  {active && order.status !== "delivered" && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FF9900] animate-pulse"></div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-[#FF9900]">En cours…</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ARTICLES ── */}
      <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
        <div className="bg-[#232F3E] px-5 py-3 flex items-center gap-2">
          <i className="fa-solid fa-bag-shopping text-[#FF9900] text-sm"></i>
          <span className="font-black text-sm text-white">Articles commandés</span>
        </div>
        <div className="p-4">
          <OrderItems items={items} loading={itemsLoading} />
        </div>
      </div>

      {/* ── RÉCAP COMMANDE ── */}
      <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
        <div className="bg-[#232F3E] px-5 py-3 flex items-center gap-2">
          <i className="fa-solid fa-receipt text-[#FF9900] text-sm"></i>
          <span className="font-black text-sm text-white">Récapitulatif</span>
        </div>
        <div className="px-5 py-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-[#565959]">Client</span>
            <span className="font-bold text-[#0F1111]">{order.client_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#565959]">Téléphone</span>
            <span className="font-bold text-[#0F1111]">{order.client_phone}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#565959]">Paiement</span>
            <span className="font-bold text-[#0F1111] capitalize">{order.payment_method?.replace("_", " ")}</span>
          </div>
          {order.payment_reference && (
            <div className="flex justify-between text-sm">
              <span className="text-[#565959]">Réf. paiement</span>
              <span className="font-mono font-bold text-[#0F1111] text-xs">{order.payment_reference}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline pt-2 border-t border-[#D5D9D9]">
            <span className="font-bold text-[#0F1111]">Total payé</span>
            <span className="text-xl font-bold text-[#B12704]">
              {Number(order.total_amount).toLocaleString()} <span className="text-sm text-[#565959] font-normal">FCFA</span>
            </span>
          </div>
          {order.member_discount_applied && (
            <p className="text-[10px] text-[#007600] font-bold flex items-center gap-1">
              <i className="fa-solid fa-crown text-[#FF9900]"></i>
              Remise membre −20% appliquée
            </p>
          )}
        </div>
      </div>

      {/* ── SUPPORT ── */}
      <div className="bg-[#FFF8D3] border border-[#FCD200]/40 rounded-xl p-4 flex items-start gap-4">
        <div className="w-10 h-10 bg-[#232F3E] rounded-full flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-headset text-[#FF9900] text-sm"></i>
        </div>
        <div className="flex-1">
          <p className="font-bold text-[#0F1111] text-sm mb-1">Besoin d'aide ?</p>
          <p className="text-[11px] text-[#565959] mb-3">Notre équipe OFS est disponible 7j/7 pour vous assister.</p>
          <a
            href="https://wa.me/237600000000"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
          >
            <i className="fa-brands fa-whatsapp text-sm"></i>
            Contacter OFS Support
          </a>
        </div>
      </div>

    </div>
  );
};

// ─── SEARCH FORM ──────────────────────────────────────────────────────────────
const SearchForm = ({ onSearch, loading }) => {
  const [input, setInput] = useState("");
  const [mode,  setMode]  = useState("phone"); // "phone" | "id"

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) onSearch(input.trim(), mode);
  };

  return (
    <div className="bg-white border border-[#D5D9D9] rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-[#232F3E] px-6 py-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900] mb-1">OFS Tracking System</p>
        <h2 className="text-white font-bold text-lg leading-tight">Suivre ma commande</h2>
        <p className="text-[#ADBAC7] text-xs mt-0.5">Entrez votre numéro ou référence pour localiser votre colis</p>
      </div>

      <div className="p-6 space-y-4">
        {/* Mode toggle */}
        <div className="flex bg-[#F3F4F4] border border-[#D5D9D9] rounded-lg p-1 gap-1">
          {[
            { key: "phone", label: "Numéro de téléphone", icon: "fa-mobile-screen-button" },
            { key: "id",    label: "Référence commande",  icon: "fa-hashtag"               },
          ].map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded text-[11px] font-black uppercase tracking-wide transition-all ${
                mode === m.key
                  ? "bg-[#131921] text-[#FF9900] shadow-sm"
                  : "text-[#565959] hover:text-[#0F1111]"
              }`}
            >
              <i className={`fa-solid ${m.icon} text-[10px]`}></i>
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <i className={`fa-solid ${mode === "phone" ? "fa-mobile-screen-button" : "fa-magnifying-glass"} text-[#FF9900] text-sm`}></i>
            </div>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={mode === "phone" ? "Ex: 6XXXXXXXX" : "Réf. commande (8 car.)"}
              className="w-full pl-10 pr-4 py-3 bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-lg text-sm text-[#0F1111] placeholder-[#ADBAC7] font-medium transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-50 disabled:cursor-not-allowed text-[#0F1111] px-5 py-3 rounded-lg font-black text-sm border border-[#FCD200] transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
          >
            {loading
              ? <i className="fa-solid fa-spinner animate-spin text-sm"></i>
              : <><i className="fa-solid fa-magnifying-glass text-sm"></i><span className="hidden sm:inline">Rechercher</span></>
            }
          </button>
        </form>

        <p className="text-[10px] text-[#ADBAC7] text-center">
          Utilisez le numéro indiqué lors de la commande
        </p>
      </div>
    </div>
  );
};

// ─── MY ORDERS LIST (logged in) ───────────────────────────────────────────────
const MyOrdersList = ({ orders, onSelect, loading }) => {
  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="animate-pulse bg-white border border-[#D5D9D9] rounded-xl p-4 flex gap-3">
          <div className="w-10 h-10 bg-[#F3F4F4] rounded-full flex-shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-[#F3F4F4] rounded w-1/2"></div>
            <div className="h-2 bg-[#F3F4F4] rounded w-1/3"></div>
          </div>
          <div className="h-6 w-16 bg-[#F3F4F4] rounded-full"></div>
        </div>
      ))}
    </div>
  );

  if (!orders.length) return (
    <div className="bg-white border border-[#D5D9D9] rounded-xl p-8 text-center">
      <div className="w-14 h-14 bg-[#F3F4F4] rounded-full flex items-center justify-center mx-auto mb-4">
        <i className="fa-solid fa-bag-shopping text-[#D5D9D9] text-2xl"></i>
      </div>
      <p className="font-bold text-[#0F1111] mb-1">Aucune commande</p>
      <p className="text-sm text-[#565959] mb-4">Vous n'avez pas encore passé de commande.</p>
      <Link to="/store" className="inline-flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-5 py-2.5 rounded-lg font-bold text-sm border border-[#FCD200] transition-all">
        <i className="fa-solid fa-store text-sm"></i>Explorer le store
      </Link>
    </div>
  );

  return (
    <div className="space-y-3">
      {orders.map(o => {
        const st = STATUSES[o.status] || STATUSES.pending;
        return (
          <button
            key={o.id}
            onClick={() => onSelect(o)}
            className="w-full bg-white border border-[#D5D9D9] hover:border-[#FF9900] rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-sm text-left group"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border"
              style={{ backgroundColor: `${st.color}18`, borderColor: `${st.color}40` }}
            >
              <i className={`fa-solid ${st.icon} text-sm`} style={{ color: st.color }}></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#0F1111] text-sm">
                Commande #{String(o.id).slice(0, 8).toUpperCase()}
              </p>
              <p className="text-[10px] text-[#565959] mt-0.5">
                {fmtDate(o.created_at)} · {Number(o.total_amount).toLocaleString()} FCFA
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${st.bg} ${st.border} ${st.text}`}>
                {st.label}
              </span>
              <i className="fa-solid fa-chevron-right text-[#D5D9D9] text-xs group-hover:text-[#FF9900] transition-colors"></i>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────
const TrackingPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [selectedOrder,  setSelectedOrder]  = useState(null);
  const [orderItems,     setOrderItems]      = useState([]);
  const [itemsLoading,   setItemsLoading]    = useState(false);
  const [myOrders,       setMyOrders]        = useState([]);
  const [myOrdersLoading,setMyOrdersLoading] = useState(false);
  const [searchLoading,  setSearchLoading]   = useState(false);
  const [searchError,    setSearchError]     = useState("");

  // Load my orders if logged in
  useEffect(() => {
    if (!user) return;
    setMyOrdersLoading(true);
    supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setMyOrders(data || []);
        setMyOrdersLoading(false);
      });
  }, [user]);

  // Load items when order selected
  useEffect(() => {
    if (!selectedOrder) return;
    setItemsLoading(true);
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", selectedOrder.id)
      .then(({ data }) => {
        setOrderItems(data || []);
        setItemsLoading(false);
      });
  }, [selectedOrder]);

  const handleSearch = useCallback(async (value, mode) => {
    setSearchLoading(true);
    setSearchError("");
    try {
      let query = supabase.from("orders").select("*");
      if (mode === "phone") {
        query = query.ilike("client_phone", `%${value}%`);
      } else {
        query = query.ilike("id", `%${value}%`);
      }
      const { data, error } = await query.order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      if (!data || data.length === 0) {
        setSearchError("Aucune commande trouvée. Vérifiez votre numéro de téléphone.");
        return;
      }
      if (data.length === 1) {
        setSelectedOrder(data[0]);
      } else {
        setMyOrders(data);
      }
    } catch {
      setSearchError("Erreur lors de la recherche. Réessayez.");
    } finally {
      setSearchLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#EAEDED]">

      {/* ── PAGE HEADER ── */}
      <div className="bg-[#131921]">
        <div className="max-w-[700px] mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-[#232F3E] rounded-xl flex items-center justify-center border border-[#FF9900]/30">
              <i className="fa-solid fa-location-dot text-[#FF9900] text-base"></i>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.35em] text-[#FF9900]">OneFreestyle Store</p>
              <h1 className="text-white font-black text-xl leading-tight">Suivi de commande</h1>
            </div>
          </div>
          <p className="text-[#ADBAC7] text-xs ml-14">Livraison express · Douala et tout le Cameroun 🇨🇲</p>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { icon: "fa-bolt",         label: "Douala",    sub: "30 min–2h",    color: "#FF9900" },
              { icon: "fa-truck-fast",   label: "Cameroun",  sub: "24–72h",       color: "#007185" },
              { icon: "fa-plane",        label: "Diaspora",  sub: "Cadeau 🎁",    color: "#FFD814" },
            ].map(s => (
              <div key={s.label} className="bg-[#232F3E] rounded-xl px-3 py-2.5 flex items-center gap-2.5 border border-white/5">
                <i className={`fa-solid ${s.icon} text-sm flex-shrink-0`} style={{ color: s.color }}></i>
                <div>
                  <p className="text-white font-black text-[11px]">{s.label}</p>
                  <p className="text-[#565959] text-[9px]">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-[700px] mx-auto px-4 md:px-6 py-6 space-y-6">

        {selectedOrder ? (
          <>
            {/* Back button */}
            <button
              onClick={() => { setSelectedOrder(null); setOrderItems([]); }}
              className="flex items-center gap-2 text-sm text-[#007185] hover:text-[#C45500] transition-colors font-bold"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
              Retour à mes commandes
            </button>

            <TrackingView order={selectedOrder} items={orderItems} itemsLoading={itemsLoading} />
          </>
        ) : (
          <>
            {/* Search */}
            <SearchForm onSearch={handleSearch} loading={searchLoading} />

            {searchError && (
              <div className="flex items-center gap-3 bg-[#FEE7E5] border border-[#B12704]/30 rounded-xl px-4 py-3">
                <i className="fa-solid fa-triangle-exclamation text-[#B12704] flex-shrink-0"></i>
                <p className="text-[#B12704] text-sm font-medium">{searchError}</p>
              </div>
            )}

            {/* My orders section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 bg-[#FF9900] rounded-full"></div>
                  <h2 className="font-bold text-[#0F1111] text-base">
                    {user ? "Mes commandes" : "Commandes récentes"}
                  </h2>
                </div>
                {user && myOrders.length > 0 && (
                  <span className="text-[9px] font-black bg-[#232F3E] text-[#FF9900] px-2.5 py-1 rounded-full">
                    {myOrders.length} commande{myOrders.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {!user ? (
                <div className="bg-white border border-[#D5D9D9] rounded-xl p-6 text-center">
                  <div className="w-14 h-14 bg-[#F3F4F4] rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fa-solid fa-user text-[#D5D9D9] text-2xl"></i>
                  </div>
                  <p className="font-bold text-[#0F1111] mb-1">Connectez-vous</p>
                  <p className="text-sm text-[#565959] mb-4">
                    Connectez-vous pour voir toutes vos commandes, ou utilisez la recherche ci-dessus.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Link to="/login" className="bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-5 py-2.5 rounded-lg font-bold text-sm border border-[#FCD200] transition-all">
                      Se connecter
                    </Link>
                    <Link to="/register" className="bg-white hover:bg-[#F3F4F4] text-[#565959] px-5 py-2.5 rounded-lg font-bold text-sm border border-[#D5D9D9] transition-all">
                      Créer un compte
                    </Link>
                  </div>
                </div>
              ) : (
                <MyOrdersList orders={myOrders} onSelect={setSelectedOrder} loading={myOrdersLoading} />
              )}
            </div>
          </>
        )}

        {/* Footer trust */}
        <div className="bg-[#131921] rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#232F3E] rounded-full flex items-center justify-center border border-[#FF9900]/30">
              <i className="fa-solid fa-shield-check text-[#FF9900] text-xs"></i>
            </div>
            <div>
              <p className="text-white font-black text-sm">OFS Cameroun · Garanti</p>
              <p className="text-[#ADBAC7] text-[10px]">Paiement sécurisé · Retour 7 jours</p>
            </div>
          </div>
          <a
            href="https://wa.me/237600000000"
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white px-4 py-2 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap"
          >
            <i className="fa-brands fa-whatsapp text-base"></i>
            WhatsApp Support
          </a>
        </div>

      </div>
    </div>
  );
};

export default TrackingPage;
