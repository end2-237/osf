import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const STATUSES = {
  pending:      { step: 0, label: "Commande reçue",       color: "#C45500", bg: "#FFF3E0", icon: "fa-clock"              },
  confirmed:    { step: 1, label: "En préparation",        color: "#007185", bg: "#E0F7FA", icon: "fa-box"                },
  sent_to_cj:   { step: 1, label: "Transmise fournisseur", color: "#007185", bg: "#E0F7FA", icon: "fa-circle-nodes"       },
  at_warehouse: { step: 2, label: "En entrepôt",           color: "#C45500", bg: "#FFF3E0", icon: "fa-warehouse"          },
  in_transit:   { step: 2, label: "En transit",            color: "#007185", bg: "#E0F7FA", icon: "fa-plane"              },
  shipped:      { step: 2, label: "En livraison",          color: "#FF9900", bg: "#FFF8ED", icon: "fa-truck-fast"         },
  delivered:    { step: 3, label: "Livrée",                color: "#007600", bg: "#E8F5E9", icon: "fa-circle-check"       },
  cancelled:    { step:-1, label: "Annulée",               color: "#B12704", bg: "#FEECEB", icon: "fa-xmark-circle"       },
};

const STEPS = [
  { key: "pending",   label: "Commande",    icon: "fa-file-lines"   },
  { key: "confirmed", label: "Préparation", icon: "fa-box-open"     },
  { key: "shipped",   label: "Livraison",   icon: "fa-truck-fast"   },
  { key: "delivered", label: "Terminée",    icon: "fa-circle-check" },
];

// newest → oldest
const TIMELINE_EVENTS = [
  { minStep: 3, label: "Livré au destinataire",   icon: "fa-house-circle-check", addMin: 48*60 },
  { minStep: 2, label: "Livreur en route",         icon: "fa-truck-fast",         addMin: 20*60 },
  { minStep: 1, label: "Arrivé entrepôt OFS",      icon: "fa-warehouse",          addMin: 12*60 },
  { minStep: 1, label: "Commande prise en charge", icon: "fa-box-open",            addMin: 5*60  },
  { minStep: 0, label: "Commande reçue par OFS",   icon: "fa-circle-check",       addMin: 3     },
  { minStep: 0, label: "Paiement confirmé",         icon: "fa-credit-card",        addMin: 1     },
];

// ─── UTILS ────────────────────────────────────────────────────────────────────

const addMinutes = (iso, min) => { const d = new Date(iso); d.setMinutes(d.getMinutes() + min); return d; };
const fmtDate    = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const fmtDT      = (d)   => {
  const dt = new Date(d);
  return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })
       + " · " + dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};
const shortId = (id) => String(id || "").replace(/-/g, "").slice(0, 10).toUpperCase();
const fmt     = (n)  => Number(n || 0).toLocaleString("fr-FR");

// ─── PAGE HEADER (standalone – no Navbar) ────────────────────────────────────

const PageHeader = () => (
  <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
      <Link to="/" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 rounded-lg bg-[#131921] flex items-center justify-center flex-shrink-0">
          <span className="text-[#FF9900] font-black text-xs tracking-tight">OFS</span>
        </div>
        <div className="hidden sm:block">
          <p className="font-black text-[#0F1111] text-sm leading-none">OneFreestyle</p>
          <p className="text-[10px] text-gray-400 leading-none mt-0.5">Suivi de commande</p>
        </div>
      </Link>

      <div className="flex items-center gap-2">
        <a href="https://wa.me/237600000000" target="_blank" rel="noreferrer"
          className="hidden sm:flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-[#25D366] font-medium transition-colors">
          <i className="fa-brands fa-whatsapp text-[#25D366]" />
          Aide
        </a>
        <Link to="/store"
          className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F1111] bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] px-3 py-1.5 rounded-lg transition-colors">
          <i className="fa-solid fa-store text-[10px]" />
          Boutique
        </Link>
      </div>
    </div>
  </header>
);

// ─── STEP WIZARD ──────────────────────────────────────────────────────────────

const StepWizard = ({ status }) => {
  const st   = STATUSES[status] || STATUSES.pending;
  const step = st.step;

  if (status === "cancelled") return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5">
      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <i className="fa-solid fa-xmark text-red-600 text-base" />
      </div>
      <div>
        <p className="font-bold text-red-700 text-sm">Commande annulée</p>
        <p className="text-xs text-gray-500 mt-0.5">Contactez le support si nécessaire.</p>
      </div>
    </div>
  );

  return (
    <div className="flex items-center">
      {STEPS.map((t, i) => {
        const isDone   = i < step || status === "delivered";
        const isActive = i === step && status !== "delivered";
        const isFuture = !isDone && !isActive;

        return (
          <React.Fragment key={t.key}>
            {/* Step */}
            <div className="flex flex-col items-center flex-1 min-w-0">
              {/* Circle */}
              <div className={`relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                isDone   ? "bg-[#FF9900] border-[#FF9900]"
                : isActive ? "bg-white border-[#FF9900] shadow-[0_0_0_4px_rgba(255,153,0,0.15)]"
                :            "bg-white border-gray-200"
              }`}>
                <i className={`fa-solid ${isDone ? "fa-check" : t.icon} text-xs ${
                  isDone ? "text-white" : isActive ? "text-[#FF9900]" : "text-gray-300"
                }`} />
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#FF9900] border-2 border-white animate-pulse" />
                )}
              </div>
              {/* Label */}
              <p className={`text-[10px] font-bold uppercase tracking-wide text-center mt-2 leading-tight ${
                isDone || isActive ? "text-[#0F1111]" : "text-gray-300"
              }`}>{t.label}</p>
            </div>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div className="flex-shrink-0 mx-1 mb-5">
                <div className={`h-0.5 w-6 sm:w-12 md:w-20 rounded-full transition-all duration-500 ${
                  i < step ? "bg-[#FF9900]" : "bg-gray-200"
                }`} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── ORDER ITEMS ──────────────────────────────────────────────────────────────

const OrderItems = ({ items, loading }) => {
  if (loading) return (
    <div className="divide-y divide-gray-100">
      {[1, 2].map(i => (
        <div key={i} className="animate-pulse flex items-center gap-4 py-4">
          <div className="w-14 h-14 bg-gray-100 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-100 rounded w-3/4" />
            <div className="h-2 bg-gray-100 rounded w-1/3" />
          </div>
          <div className="h-4 w-20 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );

  if (!items?.length) return (
    <div className="py-8 text-center">
      <i className="fa-solid fa-box-open text-gray-200 text-3xl mb-2 block" />
      <p className="text-sm text-gray-400">Aucun article trouvé.</p>
    </div>
  );

  return (
    <div className="divide-y divide-gray-100">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 py-3.5">
          {/* Image */}
          <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-xl overflow-hidden flex-shrink-0">
            {item.product_img
              ? <img src={item.product_img} alt={item.product_name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center">
                  <i className="fa-solid fa-box text-gray-200 text-xl" />
                </div>
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#0F1111] text-sm leading-tight line-clamp-2">{item.product_name}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {item.selected_color && (
                <span className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
                  {item.selected_color}
                </span>
              )}
              {item.selected_size && (
                <span className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
                  T: {item.selected_size}
                </span>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="text-right flex-shrink-0 ml-2">
            <p className="text-[10px] text-gray-400">{item.quantity} × {fmt(item.unit_price)} F</p>
            <p className="font-bold text-sm text-[#0F1111] mt-0.5">{fmt(item.quantity * item.unit_price)} F</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── TRACKING TIMELINE ────────────────────────────────────────────────────────

const TrackTimeline = ({ order }) => {
  const step = (STATUSES[order.status] || STATUSES.pending).step;
  const base = order.created_at;

  return (
    <div className="space-y-0">
      {TIMELINE_EVENTS.map((ev, i) => {
        const isDone        = ev.minStep <= step;
        const isCurrentStep = isDone
          && (i === 0 || TIMELINE_EVENTS[i - 1].minStep > step)
          && order.status !== "delivered";
        const isLast = i === TIMELINE_EVENTS.length - 1;

        return (
          <div key={i} className="flex gap-3">
            {/* Dot + line */}
            <div className="flex flex-col items-center flex-shrink-0 w-6">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 mt-0.5 transition-all ${
                isCurrentStep ? "bg-[#FF9900] border-[#FF9900]"
                : isDone      ? "bg-orange-50 border-[#FF9900]/40"
                :               "bg-gray-50 border-gray-200"
              }`}>
                {isDone
                  ? <i className={`fa-solid ${isCurrentStep ? ev.icon : "fa-check"} text-[8px] ${isCurrentStep ? "text-white" : "text-[#FF9900]"}`} />
                  : <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                }
              </div>
              {!isLast && (
                <div className={`w-px flex-1 my-1 ${isDone ? "bg-[#FF9900]/25" : "bg-gray-100"}`} style={{ minHeight: "24px" }} />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-4 min-w-0 ${isLast ? "pb-0" : ""}`}>
              <p className={`text-[12px] font-semibold leading-tight ${isDone ? "text-[#0F1111]" : "text-gray-300"}`}>
                {ev.label}
              </p>
              {isDone ? (
                <p className="text-[10px] text-gray-400 mt-0.5">{fmtDT(addMinutes(base, ev.addMin))}</p>
              ) : (
                <p className="text-[10px] text-gray-300 mt-0.5">À venir</p>
              )}
              {isCurrentStep && (
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF9900] animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#C45500]">En cours</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── TRACKING VIEW ────────────────────────────────────────────────────────────

const TrackingView = ({ order, items, itemsLoading, onBack }) => {
  const st       = STATUSES[order.status] || STATUSES.pending;
  const trackRef = shortId(order.id);

  const itemsTotal  = items.reduce((s, it) => s + (it.unit_price * it.quantity), 0);
  const deliveryFee = itemsTotal > 0 ? Math.max(0, Number(order.total_amount) - itemsTotal) : 0;

  const addrParts = (order.client_address || "").split(",").map(s => s.trim());

  return (
    <div className="space-y-4">

      {/* Back */}
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 hover:text-[#C45500] transition-colors">
        <i className="fa-solid fa-arrow-left text-[10px]" />
        Mes commandes
      </button>

      {/* ── Order header card ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Top meta bar */}
        <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100">
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-0.5">Numéro de commande</p>
            <p className="font-black text-[#0F1111] text-lg font-mono tracking-wider">#{trackRef}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[11px] text-gray-400">{fmtDate(order.created_at)}</p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border"
              style={{ color: st.color, backgroundColor: st.bg, borderColor: `${st.color}30` }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: st.color }} />
              {st.label}
            </span>
          </div>
        </div>

        {/* Step wizard */}
        <div className="px-5 py-6">
          <StepWizard status={order.status} />
        </div>
      </div>

      {/* ── 2-col content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">

        {/* ── LEFT ── */}
        <div className="space-y-4">

          {/* Articles */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <p className="font-bold text-[#0F1111] text-sm">
                Articles
                {items.length > 0 && (
                  <span className="ml-2 text-[10px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                )}
              </p>
            </div>
            <div className="px-5 pb-3">
              <OrderItems items={items} loading={itemsLoading} />
            </div>
          </div>

          {/* Adresse livraison */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Adresse de livraison</p>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="fa-solid fa-location-dot text-[#FF9900] text-sm" />
              </div>
              <div>
                <p className="font-bold text-[#0F1111] text-sm">{order.client_name}</p>
                <p className="text-[12px] text-gray-500 mt-0.5">{addrParts[0] || order.client_address}</p>
                {addrParts[1] && <p className="text-[12px] text-gray-500">{addrParts.slice(1).join(", ")}</p>}
                <p className="text-[12px] text-[#007185] font-medium mt-1">
                  <i className="fa-solid fa-phone text-[10px] mr-1.5" />{order.client_phone}
                </p>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-full border border-amber-200 flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-headset text-[#C45500] text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#0F1111] text-sm">Besoin d'aide ?</p>
              <p className="text-[11px] text-gray-500">Notre équipe est disponible 7j/7</p>
            </div>
            <a href="https://wa.me/237600000000" target="_blank" rel="noreferrer"
              className="flex-shrink-0 flex items-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white px-4 py-2 rounded-xl text-[11px] font-bold transition-colors whitespace-nowrap">
              <i className="fa-brands fa-whatsapp" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="space-y-4 lg:sticky lg:top-[72px]">

          {/* Récapitulatif */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <p className="font-bold text-[#0F1111] text-sm">Récapitulatif</p>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sous-total</span>
                <span className="font-semibold text-[#0F1111]">
                  {fmt(itemsTotal > 0 ? itemsTotal : Number(order.total_amount))} FCFA
                </span>
              </div>

              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <i className="fa-solid fa-truck-fast text-[#007185] text-[10px]" />
                    Livraison
                  </span>
                  <span className="font-semibold text-[#0F1111]">+{fmt(deliveryFee)} FCFA</span>
                </div>
              )}

              {order.member_discount_applied && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#007600] flex items-center gap-1.5">
                    <i className="fa-solid fa-crown text-[#FF9900] text-[10px]" />
                    Remise membre
                  </span>
                  <span className="font-semibold text-[#007600]">−20% ✓</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Paiement</span>
                <span className="font-semibold text-[#0F1111] capitalize">
                  {order.payment_method?.replace(/_/g, " ") || "—"}
                </span>
              </div>

              {order.payment_reference && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Référence</span>
                  <span className="font-mono text-[10px] text-gray-500">{order.payment_reference}</span>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3 flex items-baseline justify-between">
                <span className="font-black text-[#0F1111]">Total</span>
                <div className="text-right">
                  <span className="font-black text-xl text-[#B12704]">{fmt(order.total_amount)}</span>
                  <span className="text-xs text-gray-400 ml-1">FCFA</span>
                </div>
              </div>
            </div>
          </div>

          {/* Parcours du colis */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <i className="fa-solid fa-route text-[#FF9900] text-sm" />
              <p className="font-bold text-[#0F1111] text-sm">Parcours du colis</p>
            </div>
            <div className="px-4 py-4">
              <TrackTimeline order={order} />
            </div>
          </div>

          {/* Trust */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2.5">
            {[
              { icon: "fa-shield-check", label: "Paiement sécurisé",  color: "#007600" },
              { icon: "fa-rotate-left",  label: "Retour sous 7 jours", color: "#007185" },
              { icon: "fa-bolt",         label: "Livraison express",   color: "#FF9900" },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2.5">
                <i className={`fa-solid ${t.icon} text-sm w-4 text-center`} style={{ color: t.color }} />
                <span className="text-[11px] text-gray-500">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── SEARCH FORM ──────────────────────────────────────────────────────────────

const SearchForm = ({ onSearch, loading }) => {
  const [input, setInput] = useState("");
  const [mode,  setMode]  = useState("phone");

  const handleSubmit = (e) => { e.preventDefault(); if (input.trim()) onSearch(input.trim(), mode); };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#131921] px-6 py-5">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#FF9900] mb-1">OFS · Tracking System</p>
        <h2 className="text-white font-black text-xl">Suivre ma commande</h2>
        <p className="text-gray-400 text-xs mt-1">Entrez votre numéro ou référence pour localiser votre colis</p>
      </div>

      <div className="p-6 space-y-4">
        {/* Mode toggle */}
        <div className="flex bg-gray-50 border border-gray-200 rounded-xl p-1 gap-1">
          {[
            { key: "phone", label: "Numéro de téléphone", icon: "fa-mobile-screen-button" },
            { key: "id",    label: "Référence commande",  icon: "fa-hashtag" },
          ].map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[11px] font-bold transition-all ${
                mode === m.key
                  ? "bg-[#131921] text-[#FF9900] shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}>
              <i className={`fa-solid ${m.icon} text-[10px]`} />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <i className={`fa-solid ${mode === "phone" ? "fa-mobile-screen-button" : "fa-magnifying-glass"} absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 text-sm`} />
            <input
              type="text" value={input} onChange={e => setInput(e.target.value)}
              placeholder={mode === "phone" ? "Ex : 6XXXXXXXX" : "Référence commande"}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 focus:border-[#FF9900] focus:ring-2 focus:ring-[#FF9900]/10 focus:outline-none rounded-xl text-sm text-[#0F1111] placeholder-gray-300 transition-all"
            />
          </div>
          <button type="submit" disabled={loading || !input.trim()}
            className="bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-40 text-[#0F1111] px-5 py-3 rounded-xl font-black text-sm border border-[#FCD200] transition-all active:scale-95 flex items-center gap-2">
            {loading
              ? <i className="fa-solid fa-spinner animate-spin" />
              : <><i className="fa-solid fa-magnifying-glass" /><span className="hidden sm:inline">Chercher</span></>
            }
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── MY ORDERS LIST ───────────────────────────────────────────────────────────

const MyOrdersList = ({ orders, onSelect, loading }) => {
  if (loading) return (
    <div className="space-y-2.5">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse bg-white border border-gray-200 rounded-xl p-4 flex gap-3 shadow-sm">
          <div className="w-9 h-9 bg-gray-100 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-2 bg-gray-100 rounded w-1/3" />
          </div>
          <div className="h-6 w-20 bg-gray-100 rounded-full" />
        </div>
      ))}
    </div>
  );

  if (!orders.length) return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
      <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <i className="fa-solid fa-bag-shopping text-gray-200 text-2xl" />
      </div>
      <p className="font-bold text-[#0F1111] mb-1">Aucune commande</p>
      <p className="text-sm text-gray-400 mb-5">Vous n'avez pas encore passé de commande.</p>
      <Link to="/store"
        className="inline-flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-5 py-2.5 rounded-xl font-bold text-sm border border-[#FCD200] transition-all">
        <i className="fa-solid fa-store text-sm" />Explorer la boutique
      </Link>
    </div>
  );

  return (
    <div className="space-y-2">
      {orders.map(o => {
        const st = STATUSES[o.status] || STATUSES.pending;
        return (
          <button key={o.id} onClick={() => onSelect(o)}
            className="w-full bg-white border border-gray-200 hover:border-[#FF9900]/50 hover:shadow-sm rounded-xl p-4 flex items-center gap-3.5 transition-all text-left group">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: st.bg }}>
              <i className={`fa-solid ${st.icon} text-sm`} style={{ color: st.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#0F1111] text-sm font-mono">#{shortId(o.id)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {fmtDate(o.created_at)} · {fmt(o.total_amount)} FCFA
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
                style={{ color: st.color, backgroundColor: st.bg, borderColor: `${st.color}30` }}>
                {st.label}
              </span>
              <i className="fa-solid fa-chevron-right text-gray-200 text-[10px] group-hover:text-[#FF9900] transition-colors" />
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────

const TrackingPage = () => {
  const { user }       = useAuth();
  const [searchParams] = useSearchParams();

  const [selectedOrder,   setSelectedOrder]   = useState(null);
  const [orderItems,      setOrderItems]       = useState([]);
  const [itemsLoading,    setItemsLoading]     = useState(false);
  const [myOrders,        setMyOrders]         = useState([]);
  const [myOrdersLoading, setMyOrdersLoading]  = useState(false);
  const [searchLoading,   setSearchLoading]    = useState(false);
  const [searchError,     setSearchError]      = useState("");

  useEffect(() => {
    if (!user) return;
    setMyOrdersLoading(true);
    supabase.from("orders").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setMyOrders(data || []); setMyOrdersLoading(false); });
  }, [user]);

  useEffect(() => {
    if (!selectedOrder) return;
    setItemsLoading(true);
    setOrderItems([]);
    supabase.from("order_items").select("*").eq("order_id", selectedOrder.id)
      .then(({ data }) => { setOrderItems(data || []); setItemsLoading(false); });
  }, [selectedOrder]);

  const handleSearch = useCallback(async (value, mode) => {
    setSearchLoading(true);
    setSearchError("");
    try {
      let q = supabase.from("orders").select("*");
      q = mode === "phone" ? q.ilike("client_phone", `%${value}%`) : q.ilike("id", `%${value}%`);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      if (!data?.length) { setSearchError("Aucune commande trouvée. Vérifiez votre numéro."); return; }
      if (data.length === 1) setSelectedOrder(data[0]);
      else setMyOrders(data);
    } catch {
      setSearchError("Erreur lors de la recherche. Réessayez.");
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleBack = () => { setSelectedOrder(null); setOrderItems([]); };

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col">

      {/* Standalone header */}
      <PageHeader />

      {/* Content */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">

        {selectedOrder ? (
          <TrackingView
            order={selectedOrder}
            items={orderItems}
            itemsLoading={itemsLoading}
            onBack={handleBack}
          />
        ) : (
          <div className="max-w-2xl mx-auto space-y-5">

            <SearchForm onSearch={handleSearch} loading={searchLoading} />

            {searchError && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <i className="fa-solid fa-triangle-exclamation text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-sm font-medium">{searchError}</p>
              </div>
            )}

            {/* My orders */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[#0F1111] text-sm flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#FF9900] rounded-full" />
                  {user ? "Mes commandes" : "Commandes récentes"}
                </h2>
                {user && myOrders.length > 0 && (
                  <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                    {myOrders.length}
                  </span>
                )}
              </div>

              {!user ? (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-center">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fa-solid fa-user text-gray-200 text-xl" />
                  </div>
                  <p className="font-bold text-[#0F1111] text-sm mb-1">Connectez-vous</p>
                  <p className="text-xs text-gray-400 mb-4">
                    Connectez-vous pour voir toutes vos commandes ou utilisez la recherche.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Link to="/login"
                      className="bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-4 py-2 rounded-lg font-bold text-xs border border-[#FCD200] transition-all">
                      Se connecter
                    </Link>
                    <Link to="/register"
                      className="bg-white hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-lg font-bold text-xs border border-gray-200 transition-all">
                      Créer un compte
                    </Link>
                  </div>
                </div>
              ) : (
                <MyOrdersList orders={myOrders} onSelect={setSelectedOrder} loading={myOrdersLoading} />
              )}
            </div>

            {/* Footer trust */}
            <div className="flex items-center justify-center gap-6 py-4">
              {[
                { icon: "fa-shield-check", label: "Sécurisé",     color: "#007600" },
                { icon: "fa-rotate-left",  label: "Retour 7j",    color: "#007185" },
                { icon: "fa-bolt",         label: "Express",       color: "#FF9900" },
              ].map(t => (
                <div key={t.label} className="flex items-center gap-1.5">
                  <i className={`fa-solid ${t.icon} text-sm`} style={{ color: t.color }} />
                  <span className="text-[11px] text-gray-400 font-medium">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackingPage;
