import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ════════════════════════════════════════════════════════════════════════════
   RETRAITS ET LIVRAISON

   Les numéros de reversement vivent dans `vendor_payout_settings`, une table
   privée : `vendors` reste lisible publiquement pour les pages boutique, elle
   n'a donc pas à porter de coordonnées bancaires.

   Le solde ne compte que les commandes encaissées EN LIGNE. Le paiement à la
   livraison est collecté directement par le vendeur : la plateforme ne lui
   doit rien dessus, l'afficher comme « à retirer » serait faux.
   ════════════════════════════════════════════════════════════════════════════ */

const input = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors";
const label = "text-[11px] font-bold uppercase tracking-wide text-gray-400 block mb-1.5";
const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} F`;

const normalizePhone = (v) => String(v || "").replace(/\D/g, "");
const isValidPhone   = (v) => /^[0-9]{8,15}$/.test(normalizePhone(v));

const METHODS = [
  { key: "orange_money", field: "momo_orange_number", label: "Orange Money", icon: "fa-mobile-screen-button", color: "text-orange-500" },
  { key: "mtn_momo",     field: "momo_mtn_number",    label: "MTN MoMo",     icon: "fa-mobile-screen-button", color: "text-yellow-600" },
];

const PAYOUT_STATUS = {
  pending:    { label: "En attente", cls: "bg-orange-50 text-orange-600 border-orange-200" },
  processing: { label: "En cours",   cls: "bg-blue-50 text-blue-600 border-blue-200" },
  paid:       { label: "Versé",      cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  rejected:   { label: "Refusé",     cls: "bg-red-50 text-red-600 border-red-200" },
};

const shortDate = (iso) => iso
  ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
  : "—";

/* ── RETRAITS ─────────────────────────────────────────────────────────────── */
export const PayoutSection = ({ vendor, showToast, sectionRef }) => {
  const [settings, setSettings] = useState({ momo_orange_number: "", momo_mtn_number: "" });
  const [numbers,  setNumbers]  = useState({ momo_orange_number: "", momo_mtn_number: "" });
  const [balance,  setBalance]  = useState(null);
  const [payouts,  setPayouts]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState(false);
  const [amount,   setAmount]   = useState("");
  const [method,   setMethod]   = useState("orange_money");
  const [msg,      setMsg]      = useState(null);

  const load = useCallback(async () => {
    if (!vendor?.id) return;
    const [{ data: s }, { data: b }, { data: p }] = await Promise.all([
      supabase.from("vendor_payout_settings")
        .select("momo_orange_number, momo_mtn_number").eq("vendor_id", vendor.id).maybeSingle(),
      supabase.rpc("vendor_balance", { p_vendor_id: vendor.id }),
      supabase.from("vendor_payouts").select("*")
        .eq("vendor_id", vendor.id).order("requested_at", { ascending: false }).limit(20),
    ]);
    const next = {
      momo_orange_number: s?.momo_orange_number || "",
      momo_mtn_number:    s?.momo_mtn_number    || "",
    };
    setSettings(next);
    setNumbers(next);
    setBalance(Array.isArray(b) ? b[0] : b);
    setPayouts(p || []);
    setLoading(false);
  }, [vendor?.id]);

  useEffect(() => { load(); }, [load]);

  const saveNumber = async (field) => {
    const raw = numbers[field];
    if (raw && !isValidPhone(raw)) {
      return showToast?.("Numéro invalide", "8 à 15 chiffres attendus.", "error");
    }
    setBusy(true);
    try {
      const patch = { vendor_id: vendor.id, [field]: raw ? normalizePhone(raw) : null };
      const { error } = await supabase
        .from("vendor_payout_settings").upsert(patch, { onConflict: "vendor_id" });
      if (error) throw error;
      setSettings(s => ({ ...s, [field]: patch[field] || "" }));
      setNumbers(s => ({ ...s, [field]: patch[field] || "" }));
      showToast?.(raw ? "Numéro enregistré" : "Numéro retiré");
    } catch (e) { showToast?.("Erreur", e.message, "error"); }
    finally { setBusy(false); }
  };

  const requestPayout = async () => {
    const value = Math.round(Number(amount) || 0);
    setMsg(null);
    if (value <= 0)                    return setMsg({ type: "error", text: "Saisis un montant." });
    if (value > (balance?.available ?? 0)) return setMsg({ type: "error", text: "Montant supérieur à ton solde disponible." });

    setBusy(true);
    try {
      const { error } = await supabase.rpc("request_payout", {
        p_vendor_id: vendor.id, p_amount: value, p_method: method,
      });
      if (error) throw error;
      setAmount("");
      setMsg({ type: "ok", text: "Demande enregistrée. Le versement est traité sous 48 h ouvrées." });
      showToast?.("Demande de retrait envoyée");
      load();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally { setBusy(false); }
  };

  const available   = balance?.available ?? 0;
  const methodReady = !!settings[METHODS.find(m => m.key === method).field];

  return (
    <div id="retraits" ref={sectionRef} className="scroll-mt-24 bg-white border border-gray-200/80 rounded-2xl p-5 space-y-5">
      <div>
        <p className="font-bold text-[15px] mb-1">Retraits</p>
        <p className="text-[13px] text-gray-500">
          Ton argent encaissé en ligne, et les numéros sur lesquels tu le reçois.
        </p>
      </div>

      {loading ? (
        <div className="h-24 bg-gray-50 rounded-xl animate-pulse" />
      ) : (
        <>
          {/* Solde */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-gray-900 text-white rounded-xl p-4">
              <p className="text-[12px] text-white/60">Disponible</p>
              <p className="text-[22px] font-bold leading-none mt-1.5">{money(available)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[12px] text-gray-500">Retrait en cours</p>
              <p className="text-[22px] font-bold text-gray-900 leading-none mt-1.5">{money(balance?.pending)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[12px] text-gray-500">Déjà versé</p>
              <p className="text-[22px] font-bold text-gray-900 leading-none mt-1.5">{money(balance?.withdrawn)}</p>
            </div>
          </div>

          <p className="text-[12px] text-gray-400">
            <i className="fa-solid fa-circle-info mr-1.5" />
            Seules les commandes payées en ligne (Orange Money, MTN MoMo) alimentent ce solde.
            L'argent des commandes réglées à la livraison est encaissé directement par toi.
          </p>

          {/* Numéros de reversement */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-[12px] font-bold uppercase tracking-wide text-gray-400">
              Numéros de reversement
            </p>
            {METHODS.map(m => {
              const dirty = normalizePhone(numbers[m.field]) !== (settings[m.field] || "");
              return (
                <div key={m.key}>
                  <label className={label}>{m.label}</label>
                  <div className="flex items-center gap-2">
                    <span className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <i className={`fa-solid ${m.icon} ${m.color}`} />
                    </span>
                    <input value={numbers[m.field]} inputMode="tel"
                      onChange={e => setNumbers(n => ({ ...n, [m.field]: e.target.value }))}
                      placeholder="237 6XX XXX XXX" className={input} />
                    <button onClick={() => saveNumber(m.field)} disabled={busy || !dirty}
                      className="bg-gray-900 text-white text-[12px] font-bold px-4 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-40 flex-shrink-0">
                      Enregistrer
                    </button>
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-gray-400">
              Ces numéros ne sont visibles que par toi : ils ne figurent pas sur ta page boutique.
            </p>
          </div>

          {/* Demande de retrait */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-[12px] font-bold uppercase tracking-wide text-gray-400">
              Demander un retrait
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Montant (FCFA)</label>
                <input type="number" min={0} value={amount} inputMode="numeric"
                  onChange={e => { setAmount(e.target.value); setMsg(null); }}
                  placeholder={String(available)} className={input} />
              </div>
              <div>
                <label className={label}>Vers</label>
                <select value={method} onChange={e => { setMethod(e.target.value); setMsg(null); }} className={input}>
                  {METHODS.map(m => (
                    <option key={m.key} value={m.key}>
                      {m.label}{settings[m.field] ? ` · ${settings[m.field]}` : " — numéro manquant"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {amount === "" && available > 0 && (
              <button onClick={() => setAmount(String(available))}
                className="block text-[12px] font-semibold text-gray-500 hover:text-gray-900">
                Retirer la totalité ({money(available)})
              </button>
            )}

            {msg && (
              <p className={`text-[12px] ${msg.type === "error" ? "text-red-500" : "text-emerald-600"}`}>
                <i className={`fa-solid ${msg.type === "error" ? "fa-circle-exclamation" : "fa-circle-check"} mr-1.5`} />
                {msg.text}
              </p>
            )}
            {!methodReady && (
              <p className="text-[12px] text-orange-600">
                <i className="fa-solid fa-triangle-exclamation mr-1.5" />
                Renseigne d'abord ton numéro {METHODS.find(m => m.key === method).label}.
              </p>
            )}

            <button onClick={requestPayout} disabled={busy || available <= 0 || !methodReady}
              className="block bg-gray-900 text-white text-[12px] font-bold px-5 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-40">
              {busy ? "Envoi…" : "Demander le retrait"}
            </button>
          </div>

          {/* Historique */}
          {payouts.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-[12px] font-bold uppercase tracking-wide text-gray-400 mb-2">Historique</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide border-b border-gray-100">
                      <th className="text-left py-2">Date</th>
                      <th className="text-left py-2">Vers</th>
                      <th className="text-right py-2">Montant</th>
                      <th className="text-right py-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                    {payouts.map(p => {
                      const st = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.pending;
                      return (
                        <tr key={p.id} className="border-b border-gray-50">
                          <td className="py-2.5 text-gray-500">{shortDate(p.requested_at)}</td>
                          <td className="py-2.5 text-gray-600">
                            {METHODS.find(m => m.key === p.method)?.label || p.method}
                            <span className="text-gray-400 ml-1.5">{p.phone}</span>
                          </td>
                          <td className="py-2.5 text-right font-semibold text-gray-900">{money(p.amount)}</td>
                          <td className="py-2.5 text-right">
                            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ── LIVRAISON ────────────────────────────────────────────────────────────── */
const emptyDelivery = (v) => ({
  delivery_fee:            v?.delivery_fee ?? 0,
  free_delivery_threshold: v?.free_delivery_threshold ?? "",
  delivery_zones:          v?.delivery_zones || "",
  delivery_delay:          v?.delivery_delay || "",
});

export const DeliverySection = ({ vendor, updateVendorFields, showToast, sectionRef }) => {
  const [form, setForm] = useState(() => emptyDelivery(vendor));
  const [busy, setBusy] = useState(false);

  useEffect(() => { setForm(emptyDelivery(vendor)); }, [
    vendor?.id, vendor?.delivery_fee, vendor?.free_delivery_threshold,
    vendor?.delivery_zones, vendor?.delivery_delay,
  ]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const dirty =
    String(form.delivery_fee ?? "")            !== String(vendor?.delivery_fee ?? 0) ||
    String(form.free_delivery_threshold ?? "") !== String(vendor?.free_delivery_threshold ?? "") ||
    (form.delivery_zones || "")                !== (vendor?.delivery_zones || "") ||
    (form.delivery_delay || "")                !== (vendor?.delivery_delay || "");

  const save = async () => {
    setBusy(true);
    try {
      await updateVendorFields({
        delivery_fee:            Math.max(0, Math.round(Number(form.delivery_fee) || 0)),
        free_delivery_threshold: form.free_delivery_threshold === ""
          ? null : Math.max(0, Math.round(Number(form.free_delivery_threshold) || 0)),
        delivery_zones: form.delivery_zones.trim() || null,
        delivery_delay: form.delivery_delay.trim() || null,
      });
      showToast?.("Livraison mise à jour");
    } catch (e) { showToast?.("Erreur", e.message, "error"); }
    finally { setBusy(false); }
  };

  const fee = Math.max(0, Math.round(Number(form.delivery_fee) || 0));

  return (
    <div id="livraison" ref={sectionRef} className="scroll-mt-24 bg-white border border-gray-200/80 rounded-2xl p-5 space-y-4">
      <div>
        <p className="font-bold text-[15px] mb-1">Livraison</p>
        <p className="text-[13px] text-gray-500">
          Ce que tu factures pour livrer. Laisse à 0 pour livrer gratuitement.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Frais de livraison (FCFA)</label>
          <input type="number" min={0} inputMode="numeric" value={form.delivery_fee}
            onChange={e => set("delivery_fee", e.target.value)} className={input} placeholder="1000" />
        </div>
        <div>
          <label className={label}>Livraison offerte à partir de</label>
          <input type="number" min={0} inputMode="numeric" value={form.free_delivery_threshold}
            onChange={e => set("free_delivery_threshold", e.target.value)}
            className={input} placeholder="Aucun seuil" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Zones livrées</label>
          <input value={form.delivery_zones} onChange={e => set("delivery_zones", e.target.value)}
            className={input} placeholder="Douala, Bonabéri, Yaoundé…" />
        </div>
        <div>
          <label className={label}>Délai annoncé</label>
          <input value={form.delivery_delay} onChange={e => set("delivery_delay", e.target.value)}
            className={input} placeholder="24 à 48 h" />
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 text-[12px] text-gray-600">
        <i className="fa-solid fa-truck-fast text-[#FF9900] mr-1.5" />
        {fee === 0
          ? "Tes clients ne paient aucun frais de livraison."
          : form.free_delivery_threshold
            ? `${money(fee)} de livraison, offerts dès ${money(form.free_delivery_threshold)} d'achat.`
            : `${money(fee)} de livraison sur chaque commande.`}
      </div>

      <button onClick={save} disabled={busy || !dirty}
        className="bg-gray-900 text-white text-[12px] font-bold px-5 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-40">
        {busy ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
};
