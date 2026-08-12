import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ════════════════════════════════════════════════════════════════════════════
   ABONNEMENT DE LA BOUTIQUE

   Le forfait choisi à l'inscription restait enfoui dans le dossier de
   candidature : la boutique ne savait ni où elle en était, ni comment changer.
   Cette page est son écran de compte.

   Deux façons de payer, parce que toutes les boutiques n'ont pas de mobile
   money approvisionné :
     · MOBILE MONEY — Monetbil, comme pour les commandes. Le forfait s'applique
       dès que le webhook confirme.
     · EN AGENCE    — la boutique passe déposer l'argent, un admin valide.

   Dans les deux cas le reçu est le même, émis par le service de facturation
   et téléchargeable en PDF. Il n'apparaît qu'une fois le paiement acquis :
   un reçu atteste d'un versement, il ne l'annonce pas.
   ════════════════════════════════════════════════════════════════════════════ */

const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} F`;

/* Repères indicatifs pour les boutiques qui raisonnent dans une autre monnaie.
   Taux figés : ce sont des ordres de grandeur, la facturation reste en FCFA. */
const EQUIV = [
  { code: "NGN", label: "₦",   rate: 2.55  },
  { code: "USD", label: "$",   rate: 0.0016 },
  { code: "EUR", label: "€",   rate: 0.00152 },
  { code: "GHS", label: "₵",   rate: 0.025 },
];

const STATUS = {
  pending:   { label: "En attente de paiement", cls: "bg-orange-50 text-orange-600 border-orange-200" },
  paid:      { label: "Payé",                   cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  rejected:  { label: "Refusé",                 cls: "bg-red-50 text-red-600 border-red-200" },
  cancelled: { label: "Annulé",                 cls: "bg-gray-50 text-gray-500 border-gray-200" },
};

const OPERATORS = [
  { key: "orange", label: "Orange Money", color: "text-orange-500" },
  { key: "mtn",    label: "MTN MoMo",     color: "text-yellow-500" },
];

const VendorSubscription = ({ vendor, showToast, onPlanChange }) => {
  const [plans,   setPlans]   = useState([]);
  const [sub,     setSub]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState("");
  const [picked,  setPicked]  = useState(null);      // forfait en cours de souscription
  const [method,  setMethod]  = useState("monetbil");
  const [months,  setMonths]  = useState(1);
  const [phone,   setPhone]   = useState(vendor?.phone || "");
  const [operator, setOperator] = useState("orange");
  const [receipt, setReceipt] = useState("");        // id en cours de génération

  const load = useCallback(async () => {
    if (!vendor?.id) return;
    setLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("subscription_plans").select("*").eq("is_active", true).order("sort_order"),
      supabase.rpc("my_subscription", { p_vendor_id: vendor.id }),
    ]);
    setPlans(p || []);
    setSub(Array.isArray(s) ? s[0] : s);
    setLoading(false);
  }, [vendor?.id]);

  useEffect(() => { load(); }, [load]);

  const current = sub?.plan || vendor?.plan || "starter";
  const pending = sub?.pending || null;

  /* ── Souscrire ────────────────────────────────────────────────────────── */
  const subscribe = async () => {
    if (!picked) return;
    setBusy(true); setError("");
    try {
      const { data, error: e } = await supabase.rpc("request_subscription", {
        p_vendor_id: vendor.id, p_plan: picked.code, p_method: method, p_months: months,
      });
      if (e) throw new Error(e.message);
      const order = Array.isArray(data) ? data[0] : data;

      // Le gratuit s'applique sans caisse : la base a déjà tout fait.
      if (!order || order.amount === 0) {
        showToast?.("Forfait mis à jour");
        setPicked(null); await load(); onPlanChange?.();
        return;
      }

      if (method === "monetbil") {
        const digits = phone.replace(/\D/g, "");
        if (!/^[0-9]{8,15}$/.test(digits)) throw new Error("Saisis le numéro qui va payer (8 à 15 chiffres).");

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monetbil-init`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            subscription_id: order.id, amount: order.amount,
            phone: digits, operator,
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out?.payment_url) {
          throw new Error(out?.error || "Le paiement mobile n'a pas pu démarrer. Réessaie ou paie en agence.");
        }
        window.location.href = out.payment_url;
        return;
      }

      showToast?.("Demande enregistrée", "Passe en agence avec la référence.");
      setPicked(null); await load();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  /* ── Le reçu ──────────────────────────────────────────────────────────── */
  const getReceipt = async (row) => {
    if (row.invoice_url) { window.open(row.invoice_url, "_blank", "noopener"); return; }
    setReceipt(row.id); setError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-receipt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ subscription_id: row.id }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out?.url) throw new Error(out?.error || "Reçu indisponible pour le moment.");
      await load();
      window.open(out.url, "_blank", "noopener");
    } catch (e) {
      setError(e.message);
    } finally { setReceipt(""); }
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
      <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Abonnement</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Ce que tu paies aujourd'hui, ce que tu peux prendre, et tes reçus.
        </p>
      </div>

      {/* ── Forfait en cours ── */}
      <div className="bg-gray-900 text-white rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1">Forfait actuel</p>
            <p className="text-2xl font-black leading-none">{sub?.plan_name || "Gratuit"}</p>
            <p className="text-[13px] text-white/60 mt-1.5">
              {Number(sub?.plan_price) > 0 ? `${money(sub.plan_price)} par mois` : "Sans frais"}
              {sub?.plan_since && ` · depuis le ${new Date(sub.plan_since).toLocaleDateString("fr-FR",
                { day: "2-digit", month: "long", year: "numeric" })}`}
            </p>
          </div>
          {sub?.plan_expires_at && (
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1">Échéance</p>
              <p className="text-[15px] font-bold">
                {new Date(sub.plan_expires_at).toLocaleDateString("fr-FR",
                  { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Demande en cours ── */}
      {pending && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="font-bold text-[14px] text-orange-900 mb-1">
                <i className="fa-solid fa-hourglass-half mr-1.5" />
                Passage au forfait {pending.to_plan} en attente
              </p>
              <p className="text-[13px] text-orange-800">
                {money(pending.amount)}
                {pending.months > 1 && ` pour ${pending.months} mois`}
                {pending.method === "agency"
                  ? " · à régler en agence"
                  : " · paiement mobile money"}
              </p>
              {pending.method === "agency" && (
                <p className="text-[12px] text-orange-700 mt-2 leading-relaxed">
                  Passe dans une agence Buyticle avec cette référence :{" "}
                  <span className="font-mono font-bold bg-white px-2 py-0.5 rounded">
                    ABO-{String(pending.id).slice(0, 8).toUpperCase()}
                  </span>
                  <br />Ton forfait s'active dès que l'agent enregistre le versement.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[13px] font-bold text-red-500">
          <i className="fa-solid fa-circle-exclamation mr-1.5" />{error}
        </p>
      )}

      {/* ── Les forfaits ── */}
      <div className="grid sm:grid-cols-3 gap-3">
        {plans.map(p => {
          const isCurrent = p.code === current;
          const isUp = p.price_xaf > (Number(sub?.plan_price) || 0);
          return (
            <div key={p.code}
              className={`bg-white border rounded-2xl p-5 flex flex-col ${
                isCurrent ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200/80"}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className="font-black text-[16px]">{p.name}</p>
                {isCurrent && (
                  <span className="text-[9px] font-black uppercase tracking-wider bg-gray-900 text-white px-2 py-0.5 rounded-full">
                    Actuel
                  </span>
                )}
              </div>
              <p className="text-[12px] text-gray-500 mb-3 leading-snug">{p.tagline}</p>

              <p className="text-[26px] font-black leading-none">
                {p.price_xaf === 0 ? "Gratuit" : money(p.price_xaf)}
                {p.price_xaf > 0 && <span className="text-[12px] font-bold text-gray-400"> /{p.period}</span>}
              </p>
              {p.price_xaf > 0 && (
                <p className="text-[10px] text-gray-400 mt-1.5">
                  ≈ {EQUIV.map(e => `${e.label}${Math.round(p.price_xaf * e.rate).toLocaleString("fr-FR")}`).join(" · ")}
                </p>
              )}

              <ul className="mt-4 space-y-1.5 flex-1">
                {(p.features || []).map((f, i) => (
                  <li key={i} className="text-[12px] text-gray-600 flex items-start gap-2">
                    <i className="fa-solid fa-check text-[10px] mt-1 text-emerald-600" />{f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => { setPicked(p); setMonths(1); setError(""); }}
                disabled={isCurrent || busy}
                className={`mt-4 w-full py-2.5 rounded-xl text-[12px] font-bold disabled:opacity-40 ${
                  isUp ? "bg-[#FF9900] text-gray-900 hover:bg-[#e08800]"
                       : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                {isCurrent ? "Ton forfait" : isUp ? "Passer à ce forfait" : "Revenir à ce forfait"}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Choix du paiement ── */}
      {picked && (
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-[15px]">Passer au forfait {picked.name}</p>
              <p className="text-[13px] text-gray-500">
                {picked.price_xaf === 0
                  ? "Ce forfait est sans frais : le changement est immédiat."
                  : `${money(picked.price_xaf)} par mois.`}
              </p>
            </div>
            <button onClick={() => { setPicked(null); setError(""); }}
              className="w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {picked.price_xaf > 0 && (
            <>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Durée</p>
                <div className="flex gap-2 flex-wrap">
                  {[1, 3, 6, 12].map(m => (
                    <button key={m} onClick={() => setMonths(m)}
                      className={`px-3.5 py-2 rounded-xl text-[12px] font-bold border transition-colors ${
                        months === m ? "bg-gray-900 text-white border-gray-900"
                                     : "bg-white text-gray-600 border-gray-200 hover:border-gray-900"}`}>
                      {m} mois
                    </button>
                  ))}
                </div>
                <p className="text-[13px] font-bold mt-2">
                  Total : {money(picked.price_xaf * months)}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Comment tu paies</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { key: "monetbil", icon: "fa-mobile-screen-button", title: "Mobile money",
                      sub: "Orange Money ou MTN MoMo. Ton forfait s'active dès la confirmation." },
                    { key: "agency", icon: "fa-building-columns", title: "En agence",
                      sub: "Tu passes déposer l'argent. Le forfait s'active quand Buyticle enregistre le versement." },
                  ].map(o => (
                    <button key={o.key} onClick={() => setMethod(o.key)}
                      className={`text-left p-4 rounded-xl border-2 transition-colors ${
                        method === o.key ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          method === o.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}>
                          <i className={`fa-solid ${o.icon} text-[13px]`} />
                        </div>
                        <p className="font-bold text-[13px] flex-1">{o.title}</p>
                        <i className={`fa-solid ${method === o.key ? "fa-circle-check text-gray-900" : "fa-circle text-gray-200"} text-[14px]`} />
                      </div>
                      <p className="text-[12px] text-gray-500 leading-snug">{o.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {method === "monetbil" && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Opérateur</p>
                    <div className="flex gap-2">
                      {OPERATORS.map(o => (
                        <button key={o.key} onClick={() => setOperator(o.key)}
                          className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border transition-colors ${
                            operator === o.key ? "bg-gray-900 text-white border-gray-900"
                                               : "bg-white text-gray-600 border-gray-200"}`}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Numéro qui paie</p>
                    <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel"
                      placeholder="237 6XX XXX XXX"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-900" />
                  </div>
                </div>
              )}

              {method === "agency" && (
                <p className="text-[12px] text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-2.5 leading-relaxed">
                  <i className="fa-solid fa-circle-info mr-1.5" />
                  On te donne une référence à présenter en agence. Tant que le versement n'est pas
                  enregistré, ton forfait actuel reste en place — rien n'est coupé.
                </p>
              )}
            </>
          )}

          <button onClick={subscribe} disabled={busy}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-bold py-3 rounded-xl disabled:opacity-50">
            {busy ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Un instant…</>
              : picked.price_xaf === 0 ? "Passer au gratuit"
              : method === "monetbil" ? `Payer ${money(picked.price_xaf * months)}`
              : `Obtenir ma référence de paiement`}
          </button>
        </div>
      )}

      {/* ── Historique et reçus ── */}
      {(sub?.history || []).length > 0 && (
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5">
          <p className="font-bold text-[15px] mb-1">Mes paiements</p>
          <p className="text-[13px] text-gray-500 mb-4">
            Le reçu est disponible dès que le paiement est enregistré.
          </p>
          <div className="divide-y divide-gray-50">
            {sub.history.map(h => {
              const st = STATUS[h.status] || STATUS.pending;
              return (
                <div key={h.id} className="flex items-center gap-3 py-3 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[13px]">Forfait {h.to_plan}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(h.requested_at).toLocaleDateString("fr-FR",
                        { day: "2-digit", month: "short", year: "numeric" })}
                      {" · "}{h.method === "agency" ? "en agence" : "mobile money"}
                      {h.months > 1 && ` · ${h.months} mois`}
                      {h.invoice_number && ` · ${h.invoice_number}`}
                    </p>
                    {h.admin_note && (
                      <p className="text-[11px] text-gray-500 mt-1 italic">« {h.admin_note} »</p>
                    )}
                  </div>
                  <p className="font-bold text-[13px]">{money(h.amount)}</p>
                  {h.status === "paid" && h.amount > 0 && (
                    <button onClick={() => getReceipt(h)} disabled={receipt === h.id}
                      className="text-[11px] font-bold px-3 py-2 rounded-xl border border-gray-200 hover:border-gray-900 disabled:opacity-50">
                      <i className={`fa-solid ${receipt === h.id ? "fa-spinner fa-spin" : "fa-file-arrow-down"} mr-1.5`} />
                      {receipt === h.id ? "Génération…" : "Reçu"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorSubscription;
