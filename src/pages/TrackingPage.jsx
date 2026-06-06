import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const STATUSES = {
  pending:      { step: 0, label: "Commande reçue",    color: "#FF9900", bg: "bg-[#FFF8D3]",  border: "border-[#FCD200]/50", text: "text-[#C45500]",  icon: "fa-clock"              },
  confirmed:    { step: 1, label: "En préparation",    color: "#007185", bg: "bg-[#E6F3F5]",  border: "border-[#007185]/40", text: "text-[#007185]",  icon: "fa-box"                },
  sent_to_cj:   { step: 1, label: "Transmise fournisseur", color: "#007185", bg: "bg-[#E6F3F5]", border: "border-[#007185]/40", text: "text-[#007185]", icon: "fa-circle-nodes"    },
  at_warehouse: { step: 2, label: "En entrepôt",       color: "#FF9900", bg: "bg-[#FFF8D3]",  border: "border-[#FF9900]/40", text: "text-[#C45500]",  icon: "fa-warehouse"          },
  in_transit:   { step: 2, label: "En transit 🛫",     color: "#007185", bg: "bg-[#E6F3F5]",  border: "border-[#007185]/40", text: "text-[#007185]",  icon: "fa-plane"              },
  shipped:      { step: 2, label: "En livraison 🚀",   color: "#FF9900", bg: "bg-[#FFF8D3]",  border: "border-[#FF9900]/40", text: "text-[#C45500]",  icon: "fa-truck-fast"         },
  delivered:    { step: 3, label: "Livrée ✓",          color: "#007600", bg: "bg-[#E8F5E8]",  border: "border-[#007600]/40", text: "text-[#007600]",  icon: "fa-house-circle-check" },
  cancelled:    { step:-1, label: "Annulée",           color: "#B12704", bg: "bg-[#FEE7E5]",  border: "border-[#B12704]/40", text: "text-[#B12704]",  icon: "fa-xmark-circle"       },
};

const STEPS = [
  { key: "pending",   label: "Commande",    icon: "fa-file-lines",   desc: "Reçue & confirmée"  },
  { key: "confirmed", label: "Préparation", icon: "fa-box-open",      desc: "En cours de traitement" },
  { key: "shipped",   label: "Livraison",   icon: "fa-truck-fast",    desc: "Livreur en route"   },
  { key: "delivered", label: "Terminée",    icon: "fa-circle-check",  desc: "Remise confirmée"   },
];

// newest → oldest (minStep = step at which this event becomes visible)
const TIMELINE_EVENTS = [
  { minStep: 3, label: "Livré au destinataire",    icon: "fa-house-circle-check", addMin: 48 * 60 },
  { minStep: 2, label: "Livreur en route",          icon: "fa-truck-fast",         addMin: 20 * 60 },
  { minStep: 1, label: "Arrivé entrepôt OFS",       icon: "fa-warehouse",          addMin: 12 * 60 },
  { minStep: 1, label: "Commande prise en charge",  icon: "fa-box-open",            addMin: 5  * 60 },
  { minStep: 0, label: "Commande reçue par OFS",    icon: "fa-circle-check",       addMin: 3        },
  { minStep: 0, label: "Paiement confirmé",          icon: "fa-credit-card",        addMin: 1        },
];

const OFS_SELLER = {
  name:    "OFS Cameroun",
  line1:   "Bonamoussadi · Rond-Point Express",
  line2:   "Douala, Cameroun",
  country: "🇨🇲 Cameroun",
};

// ─── UTILS ────────────────────────────────────────────────────────────────────

const addMin  = (iso, min) => { const d = new Date(iso); d.setMinutes(d.getMinutes() + min); return d; };
const fmtDate = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const fmtDT   = (d)   => {
  const dt = new Date(d);
  return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
       + " " + dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};
const shortId = (id) => String(id || "").replace(/-/g, "").slice(0, 10).toUpperCase();

// ─── STEP WIZARD ──────────────────────────────────────────────────────────────

const StepWizard = ({ status }) => {
  const st   = STATUSES[status] || STATUSES.pending;
  const step = st.step;

  if (status === "cancelled") return (
    <div className="flex items-center gap-3 bg-[#B12704]/10 border border-[#B12704]/30 rounded-xl px-5 py-4">
      <div className="w-10 h-10 rounded-full bg-[#B12704]/20 flex items-center justify-center flex-shrink-0">
        <i className="fa-solid fa-xmark text-[#B12704] text-lg" />
      </div>
      <div>
        <p className="font-black text-[#B12704]">Commande annulée</p>
        <p className="text-sm text-[#565959] mt-0.5">Contactez le support si nécessaire.</p>
      </div>
    </div>
  );

  return (
    <div className="flex items-start">
      {STEPS.map((t, i) => {
        const isDone   = i < step || status === "delivered";
        const isActive = i === step && status !== "delivered";
        const isFuture = i > step  && status !== "delivered";
        return (
          <React.Fragment key={t.key}>
            <div className={`flex flex-col items-center flex-1 transition-opacity ${isFuture ? "opacity-35" : ""}`}>
              {/* Icon box */}
              <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-300 ${
                isDone   ? "bg-[#FF9900] border-[#FF9900] shadow-sm" :
                isActive ? "bg-white border-[#FF9900] shadow-[0_0_0_5px_rgba(255,153,0,0.12)]" :
                           "bg-[#F3F4F4] border-[#D5D9D9]"
              }`}>
                <i className={`fa-solid ${isDone ? "fa-check" : t.icon} text-sm ${
                  isDone ? "text-[#0F1111]" : isActive ? "text-[#FF9900]" : "text-[#ADBAC7]"
                }`} />
                {isActive && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#FF9900] border-2 border-white animate-pulse" />
                )}
              </div>
              <p className={`text-[10px] font-black uppercase tracking-wide text-center mt-2 leading-tight ${
                isDone || isActive ? "text-[#0F1111]" : "text-[#ADBAC7]"
              }`}>{t.label}</p>
              <p className={`text-[9px] text-center leading-tight mt-0.5 hidden sm:block ${
                isFuture ? "text-[#D5D9D9]" : "text-[#565959]"
              }`}>{t.desc}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-shrink-0 mt-5">
                <div className={`h-0.5 w-5 sm:w-8 rounded-full transition-all duration-500 ${
                  i < step ? "bg-[#FF9900]" : "bg-[#D5D9D9]"
                }`} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── PACKAGE TIMELINE (right sidebar) ────────────────────────────────────────

const PackageTimeline = ({ order }) => {
  const step = (STATUSES[order.status] || STATUSES.pending).step;
  const base = order.created_at;

  return (
    <div className="bg-[#131921] border border-[#232F3E] rounded-2xl overflow-hidden lg:sticky lg:top-4">
      <div className="bg-[#232F3E] px-5 py-3.5 flex items-center gap-2.5">
        <div className="w-7 h-7 bg-[#FF9900]/15 rounded-lg flex items-center justify-center border border-[#FF9900]/30 flex-shrink-0">
          <i className="fa-solid fa-timeline text-[#FF9900] text-[11px]" />
        </div>
        <div>
          <p className="font-black text-sm text-white">Parcours du colis</p>
          <p className="text-[#565959] text-[9px]">Historique en temps réel</p>
        </div>
      </div>

      <div className="px-4 py-4">
        {TIMELINE_EVENTS.map((event, i) => {
          const isDone       = event.minStep <= step;
          const isCurrentStep = isDone
            && (i === 0 || TIMELINE_EVENTS[i - 1].minStep > step)
            && order.status !== "delivered";

          return (
            <div key={i} className="flex gap-3">
              {/* Dot + vertical line */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all ${
                  isCurrentStep ? "bg-[#FF9900] border-[#FF9900] shadow-[0_0_0_4px_rgba(255,153,0,0.2)]" :
                  isDone        ? "bg-[#FF9900]/15 border-[#FF9900]/40" :
                                  "bg-[#1a1a1a] border-[#232F3E]"
                }`}>
                  {isDone
                    ? <i className={`fa-solid ${isCurrentStep ? event.icon : "fa-check"} text-[${isCurrentStep ? "#0F1111" : "#FF9900"}] text-[9px]`} />
                    : <div className="w-2 h-2 rounded-full bg-[#565959]/30" />
                  }
                </div>
                {i < TIMELINE_EVENTS.length - 1 && (
                  <div className={`w-0.5 h-7 my-1 rounded-full ${isDone ? "bg-[#FF9900]/25" : "bg-[#232F3E]"}`} />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 pb-2 pt-0.5 min-w-0">
                <p className={`text-[11px] font-bold leading-tight ${isDone ? "text-white" : "text-[#565959]/50"}`}>
                  {event.label}
                </p>
                {isDone ? (
                  <p className="text-[9px] text-[#565959] mt-0.5">{fmtDT(addMin(base, event.addMin))}</p>
                ) : (
                  <p className="text-[9px] text-[#565959]/30 mt-0.5">À venir</p>
                )}
                {isCurrentStep && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF9900] animate-pulse" />
                    <span className="text-[9px] text-[#FF9900] font-black uppercase tracking-wider">En cours</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── ADDRESS CARD ─────────────────────────────────────────────────────────────

const AddressCard = ({ title, name, line1, line2, extra, icon, editIcon = false }) => (
  <div className="bg-[#F3F4F4] border border-[#D5D9D9] rounded-xl p-4 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-[#232F3E] rounded-lg flex items-center justify-center flex-shrink-0">
          <i className={`fa-solid ${icon} text-[#FF9900] text-[9px]`} />
        </div>
        <p className="text-[9px] font-black uppercase tracking-widest text-[#565959]">{title}</p>
      </div>
    </div>
    <div>
      <p className="font-bold text-[#0F1111] text-sm">{name}</p>
      {line1 && <p className="text-[11px] text-[#565959] mt-0.5">{line1}</p>}
      {line2 && <p className="text-[11px] text-[#565959]">{line2}</p>}
      {extra && <p className="text-[11px] text-[#007185] mt-1 font-medium">{extra}</p>}
    </div>
  </div>
);

// ─── ORDER ITEMS TABLE ────────────────────────────────────────────────────────

const OrderItemsTable = ({ items, loading }) => {
  if (loading) return (
    <div className="divide-y divide-[#F3F4F4]">
      {[1, 2].map(i => (
        <div key={i} className="animate-pulse flex items-center gap-4 py-4">
          <div className="w-14 h-14 bg-[#F3F4F4] rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 bg-[#F3F4F4] rounded w-3/4" />
            <div className="h-2 bg-[#F3F4F4] rounded w-1/2" />
          </div>
          <div className="h-4 w-24 bg-[#F3F4F4] rounded" />
        </div>
      ))}
    </div>
  );

  if (!items?.length) return (
    <div className="py-8 text-center">
      <i className="fa-solid fa-box-open text-[#D5D9D9] text-3xl mb-2 block" />
      <p className="text-sm text-[#565959]">Aucun article trouvé.</p>
    </div>
  );

  return (
    <div className="divide-y divide-[#F3F4F4]">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-4 py-4">
          <div className="w-14 h-14 bg-[#F3F4F4] border border-[#D5D9D9] rounded-lg overflow-hidden flex-shrink-0">
            {item.product_img
              ? <img src={item.product_img} alt={item.product_name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center">
                  <i className="fa-solid fa-box text-[#D5D9D9] text-xl" />
                </div>
            }
          </div>
          <div className="flex-1 min-w-0">
            {item.product_type && (
              <p className="text-[9px] font-black uppercase tracking-widest text-[#ADBAC7] mb-0.5">{item.product_type}</p>
            )}
            <p className="font-bold text-[#0F1111] text-sm leading-tight truncate">{item.product_name}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {item.selected_color && (
                <span className="text-[10px] text-[#565959] bg-white border border-[#D5D9D9] rounded-md px-2 py-0.5">
                  {item.selected_color}
                </span>
              )}
              {item.selected_size && (
                <span className="text-[10px] text-[#565959] bg-white border border-[#D5D9D9] rounded-md px-2 py-0.5">
                  T : {item.selected_size}
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-[#565959] mb-0.5">{item.quantity} × {Number(item.unit_price).toLocaleString()} F</p>
            <p className="font-bold text-sm text-[#0F1111]">{(item.quantity * item.unit_price).toLocaleString()} F</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── TRACKING VIEW (2-column layout) ─────────────────────────────────────────

const TrackingView = ({ order, items, itemsLoading, onBack }) => {
  const st       = STATUSES[order.status] || STATUSES.pending;
  const trackRef = shortId(order.id);
  const resi     = order.payment_reference || trackRef;

  // Compute summary
  const itemsTotal  = items.reduce((s, it) => s + (it.unit_price * it.quantity), 0);
  const deliveryFee = itemsTotal > 0 ? Math.max(0, Number(order.total_amount) - itemsTotal) : 0;

  // Parse buyer address into parts
  const addrParts = (order.client_address || "").split(",").map(s => s.trim());

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-sm text-[#007185] hover:text-[#C45500] font-bold transition-colors">
        <i className="fa-solid fa-chevron-left text-xs" />
        Retour à mes commandes
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">

        {/* ── LEFT MAIN ─────────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* ── Order ID header card ── */}
          <div className="bg-white border border-[#D5D9D9] rounded-2xl overflow-hidden shadow-sm">
            {/* Dark header */}
            <div className="bg-[#131921] px-5 py-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.35em] text-[#FF9900] mb-1">
                  OFS Cameroun · Suivi commande
                </p>
                <h2 className="text-white font-black text-xl leading-tight">
                  Order ID : <span className="text-[#FFD814] font-mono">{trackRef}</span>
                </h2>
                <p className="text-[#ADBAC7] text-[11px] mt-1.5">
                  Passée le {fmtDate(order.created_at)} · {order.client_name}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-[8px] font-black uppercase tracking-widest text-[#565959] mb-1">No Resi</p>
                <p className="font-mono font-bold text-[#FF9900] text-sm">{resi}</p>
              </div>
            </div>

            {/* Status bar */}
            <div className="border-b border-[#F3F4F4] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  order.status === "shipped" || order.status === "in_transit" ? "bg-[#FF9900] animate-pulse" :
                  order.status === "delivered"                                ? "bg-[#007600]" :
                  order.status === "cancelled"                                ? "bg-[#B12704]" :
                                                                               "bg-[#007185]"
                }`} />
                <span className={`text-sm font-bold ${st.text}`}>{st.label}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#565959]">
                <span>No Resi :</span>
                <span className="font-mono font-bold text-[#0F1111]">{resi}</span>
              </div>
            </div>

            {/* Step wizard */}
            <div className="px-5 py-6">
              <StepWizard status={order.status} />
            </div>
          </div>

          {/* ── Addresses ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AddressCard
              title="Adresse expéditeur (Vendeur)"
              name={OFS_SELLER.name}
              line1={OFS_SELLER.line1}
              line2={OFS_SELLER.line2}
              extra={OFS_SELLER.country}
              icon="fa-store"
            />
            <AddressCard
              title="Adresse destinataire (Client)"
              name={order.client_name}
              line1={addrParts[0] || order.client_address}
              line2={addrParts.slice(1).join(", ") || ""}
              extra={`📞 ${order.client_phone}`}
              icon="fa-user"
            />
          </div>

          {/* ── Order items ── */}
          <div className="bg-white border border-[#D5D9D9] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#F3F4F4] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-bag-shopping text-[#FF9900] text-sm" />
                <p className="font-black text-[#0F1111] text-sm">Articles commandés</p>
              </div>
              {items.length > 0 && (
                <span className="text-[9px] font-black bg-[#232F3E] text-[#FF9900] px-2.5 py-1 rounded-full">
                  {items.length} article{items.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="px-5">
              <OrderItemsTable items={items} loading={itemsLoading} />
            </div>
          </div>

          {/* ── Order summary ── */}
          <div className="bg-white border border-[#D5D9D9] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#F3F4F4]">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-receipt text-[#FF9900] text-sm" />
                <p className="font-black text-[#0F1111] text-sm">Récapitulatif de commande</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#565959]">Prix des produits</span>
                <span className="font-bold text-[#0F1111]">
                  {(itemsTotal > 0 ? itemsTotal : Number(order.total_amount)).toLocaleString()} FCFA
                </span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#565959] flex items-center gap-1.5">
                    <i className="fa-solid fa-truck-fast text-[#007185] text-[10px]" />
                    Frais de livraison
                  </span>
                  <span className="font-bold text-[#0F1111]">+{deliveryFee.toLocaleString()} FCFA</span>
                </div>
              )}
              {order.member_discount_applied && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-[#007600]">
                    <i className="fa-solid fa-crown text-[#FF9900] text-[10px]" />
                    Remise membre (−20%)
                  </span>
                  <span className="font-bold text-[#007600]">Appliquée ✓</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-[#565959]">Mode de paiement</span>
                <span className="font-bold text-[#0F1111] capitalize">
                  {order.payment_method?.replace(/_/g, " ") || "—"}
                </span>
              </div>
              {order.payment_reference && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#565959]">Référence</span>
                  <span className="font-mono text-[11px] font-bold text-[#565959]">{order.payment_reference}</span>
                </div>
              )}
              <div className="border-t border-[#F3F4F4] pt-3 flex items-baseline justify-between">
                <span className="font-black text-[#0F1111] text-base">Total</span>
                <div className="text-right">
                  <span className="font-black text-2xl text-[#B12704]">
                    {Number(order.total_amount).toLocaleString()}
                  </span>
                  <span className="text-sm text-[#565959] ml-1 font-normal">FCFA</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Support ── */}
          <div className="bg-[#FFF8D3] border border-[#FCD200]/40 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-[#232F3E] rounded-full flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-headset text-[#FF9900] text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#0F1111] text-sm">Besoin d'aide ?</p>
              <p className="text-[11px] text-[#565959]">Notre équipe OFS est disponible 7j/7</p>
            </div>
            <a href="https://wa.me/237600000000"
              className="flex-shrink-0 flex items-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap">
              <i className="fa-brands fa-whatsapp text-base" />
              <span>Support</span>
            </a>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Package timeline */}
          <PackageTimeline order={order} />

          {/* Courier card */}
          {["shipped", "confirmed", "at_warehouse"].includes(order.status) && (
            <div className="bg-white border border-[#D5D9D9] rounded-2xl p-4 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-3">Livreur assigné</p>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#232F3E] flex items-center justify-center border-2 border-[#FF9900]/50 flex-shrink-0">
                  <span className="text-[#FF9900] font-black text-base">J</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-bold text-[#0F1111] text-sm">Jean-Paul K.</p>
                    <span className="text-[8px] font-black bg-[#007600]/10 text-[#007600] px-1.5 py-0.5 rounded uppercase">OFS</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[#565959]">
                    <span className="flex items-center gap-0.5">
                      <i className="fa-solid fa-star text-[#FF9900] text-[9px]" />4.9
                    </span>
                    <span>312 livraisons</span>
                  </div>
                </div>
                <a href="https://wa.me/237600000000"
                  className="w-9 h-9 bg-[#25D366] hover:bg-[#20BD5A] rounded-full flex items-center justify-center flex-shrink-0 transition-colors">
                  <i className="fa-brands fa-whatsapp text-white" />
                </a>
              </div>
            </div>
          )}

          {/* Trust mini-card */}
          <div className="bg-[#131921] border border-[#232F3E] rounded-xl p-4 space-y-3">
            {[
              { icon: "fa-shield-check", text: "Paiement sécurisé", color: "#007600" },
              { icon: "fa-rotate-left",  text: "Retour 7 jours",    color: "#007185" },
              { icon: "fa-bolt",         text: "Livraison express",  color: "#FF9900" },
            ].map(t => (
              <div key={t.text} className="flex items-center gap-2.5">
                <i className={`fa-solid ${t.icon} text-sm`} style={{ color: t.color }} />
                <span className="text-[11px] text-[#ADBAC7] font-medium">{t.text}</span>
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) onSearch(input.trim(), mode);
  };

  return (
    <div className="bg-white border border-[#D5D9D9] rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-[#232F3E] px-6 py-4">
        <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[#FF9900] mb-1">OFS Tracking System</p>
        <h2 className="text-white font-bold text-lg">Suivre ma commande</h2>
        <p className="text-[#ADBAC7] text-xs mt-0.5">Entrez votre numéro ou référence pour localiser votre colis</p>
      </div>
      <div className="p-6 space-y-4">
        {/* Mode toggle */}
        <div className="flex bg-[#F3F4F4] border border-[#D5D9D9] rounded-lg p-1 gap-1">
          {[
            { key: "phone", label: "Numéro de téléphone", icon: "fa-mobile-screen-button" },
            { key: "id",    label: "Référence commande",  icon: "fa-hashtag" },
          ].map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded text-[11px] font-black uppercase tracking-wide transition-all ${
                mode === m.key ? "bg-[#131921] text-[#FF9900] shadow-sm" : "text-[#565959] hover:text-[#0F1111]"
              }`}>
              <i className={`fa-solid ${m.icon} text-[10px]`} />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <i className={`fa-solid ${mode === "phone" ? "fa-mobile-screen-button" : "fa-magnifying-glass"} absolute left-3 top-1/2 -translate-y-1/2 text-[#FF9900] text-sm`} />
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              placeholder={mode === "phone" ? "Ex: 6XXXXXXXX" : "Réf. commande"}
              className="w-full pl-10 pr-4 py-3 bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-lg text-sm text-[#0F1111] placeholder-[#ADBAC7] font-medium transition-colors" />
          </div>
          <button type="submit" disabled={loading || !input.trim()}
            className="bg-[#FFD814] hover:bg-[#F7CA00] disabled:opacity-50 text-[#0F1111] px-5 py-3 rounded-lg font-black text-sm border border-[#FCD200] transition-all active:scale-95 flex items-center gap-2">
            {loading
              ? <i className="fa-solid fa-spinner animate-spin" />
              : <><i className="fa-solid fa-magnifying-glass" /><span className="hidden sm:inline">Rechercher</span></>
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

// ─── MY ORDERS LIST ───────────────────────────────────────────────────────────

const MyOrdersList = ({ orders, onSelect, loading }) => {
  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse bg-white border border-[#D5D9D9] rounded-xl p-4 flex gap-3">
          <div className="w-10 h-10 bg-[#F3F4F4] rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-[#F3F4F4] rounded w-1/2" />
            <div className="h-2 bg-[#F3F4F4] rounded w-1/3" />
          </div>
          <div className="h-6 w-16 bg-[#F3F4F4] rounded-full" />
        </div>
      ))}
    </div>
  );

  if (!orders.length) return (
    <div className="bg-white border border-[#D5D9D9] rounded-xl p-8 text-center">
      <div className="w-14 h-14 bg-[#F3F4F4] rounded-full flex items-center justify-center mx-auto mb-4">
        <i className="fa-solid fa-bag-shopping text-[#D5D9D9] text-2xl" />
      </div>
      <p className="font-bold text-[#0F1111] mb-1">Aucune commande</p>
      <p className="text-sm text-[#565959] mb-4">Vous n'avez pas encore passé de commande.</p>
      <Link to="/store"
        className="inline-flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-5 py-2.5 rounded-lg font-bold text-sm border border-[#FCD200] transition-all">
        <i className="fa-solid fa-store text-sm" />Explorer le store
      </Link>
    </div>
  );

  return (
    <div className="space-y-2.5">
      {orders.map(o => {
        const st = STATUSES[o.status] || STATUSES.pending;
        return (
          <button key={o.id} onClick={() => onSelect(o)}
            className="w-full bg-white border border-[#D5D9D9] hover:border-[#FF9900] rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-sm text-left group">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2"
              style={{ backgroundColor: `${st.color}18`, borderColor: `${st.color}40` }}>
              <i className={`fa-solid ${st.icon} text-sm`} style={{ color: st.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#0F1111] text-sm font-mono">
                #{shortId(o.id)}
              </p>
              <p className="text-[10px] text-[#565959] mt-0.5">
                {fmtDate(o.created_at)} · {Number(o.total_amount).toLocaleString()} FCFA
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${st.bg} ${st.border} ${st.text}`}>
                {st.label}
              </span>
              <i className="fa-solid fa-chevron-right text-[#D5D9D9] text-xs group-hover:text-[#FF9900] transition-colors" />
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────

const TrackingPage = () => {
  const { user }      = useAuth();
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
    <div className="min-h-screen bg-[#EAEDED]">

      {/* ── Page header ── */}
      <div className="bg-[#131921]">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#232F3E] rounded-xl flex items-center justify-center border border-[#FF9900]/30 flex-shrink-0">
              <i className="fa-solid fa-location-dot text-[#FF9900] text-base" />
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.35em] text-[#FF9900]">OneFreestyle Store</p>
              <h1 className="text-white font-black text-xl leading-tight">Suivi de commande</h1>
              <p className="text-[#ADBAC7] text-[10px] mt-0.5">Livraison express · Douala et tout le Cameroun 🇨🇲</p>
            </div>
          </div>
          {/* Quick delivery chips */}
          <div className="flex gap-2 flex-wrap">
            {[
              { icon: "fa-bolt",       label: "Douala",   sub: "30min–2h",  color: "#FF9900" },
              { icon: "fa-truck-fast", label: "Cameroun", sub: "24–72h",    color: "#007185" },
              { icon: "fa-plane",      label: "Diaspora", sub: "Cadeau 🎁", color: "#FFD814" },
            ].map(s => (
              <div key={s.label} className="bg-[#232F3E] rounded-xl px-3 py-2 flex items-center gap-2 border border-white/5">
                <i className={`fa-solid ${s.icon} text-sm flex-shrink-0`} style={{ color: s.color }} />
                <div>
                  <p className="text-white font-black text-[10px]">{s.label}</p>
                  <p className="text-[#565959] text-[9px]">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">

        {selectedOrder ? (
          <TrackingView
            order={selectedOrder}
            items={orderItems}
            itemsLoading={itemsLoading}
            onBack={handleBack}
          />
        ) : (
          <div className="max-w-[680px] mx-auto space-y-6">
            {/* Search */}
            <SearchForm onSearch={handleSearch} loading={searchLoading} />

            {searchError && (
              <div className="flex items-center gap-3 bg-[#FEE7E5] border border-[#B12704]/30 rounded-xl px-4 py-3">
                <i className="fa-solid fa-triangle-exclamation text-[#B12704] flex-shrink-0" />
                <p className="text-[#B12704] text-sm font-medium">{searchError}</p>
              </div>
            )}

            {/* My orders */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 bg-[#FF9900] rounded-full" />
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
                    <i className="fa-solid fa-user text-[#D5D9D9] text-2xl" />
                  </div>
                  <p className="font-bold text-[#0F1111] mb-1">Connectez-vous</p>
                  <p className="text-sm text-[#565959] mb-4">
                    Connectez-vous pour voir toutes vos commandes ou utilisez la recherche ci-dessus.
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

            {/* Footer trust bar */}
            <div className="bg-[#131921] rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#232F3E] rounded-full flex items-center justify-center border border-[#FF9900]/30">
                  <i className="fa-solid fa-shield-check text-[#FF9900] text-xs" />
                </div>
                <div>
                  <p className="text-white font-black text-sm">OFS Cameroun · Garanti</p>
                  <p className="text-[#ADBAC7] text-[10px]">Paiement sécurisé · Retour 7 jours</p>
                </div>
              </div>
              <a href="https://wa.me/237600000000"
                className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white px-4 py-2 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap">
                <i className="fa-brands fa-whatsapp text-base" />WhatsApp Support
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackingPage;
