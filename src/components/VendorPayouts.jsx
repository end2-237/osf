import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ════════════════════════════════════════════════════════════════════════════
   RETRAITS & LIVRAISON

   Buyticle ne prélève aucune commission. Le solde suit donc ce que la
   plateforme a encaissé pour la boutique : toujours le mobile money, et le
   paiement à la livraison uniquement quand c'est Buyticle Delivery qui livre.
   Les frais de livraison suivent celui qui livre — au vendeur s'il livre
   lui-même, à Buyticle sinon. Tout est recalculé côté base par
   `vendor_balance` ; `request_payout` revalide le montant demandé.
   ════════════════════════════════════════════════════════════════════════════ */

const input = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors";
const label = "text-[11px] font-bold uppercase tracking-wide text-gray-400 block mb-1.5";
const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} F`;

const PAYOUT_STATUS = {
  pending:    { label: "En attente",  cls: "bg-orange-50 text-orange-600 border-orange-200" },
  processing: { label: "En cours",    cls: "bg-blue-50 text-blue-600 border-blue-200" },
  paid:       { label: "Versé",       cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  rejected:   { label: "Refusé",      cls: "bg-red-50 text-red-600 border-red-200" },
};

const METHODS = [
  { key: "orange_money", label: "Orange Money", field: "momo_orange_number" },
  { key: "mtn_momo",     label: "MTN MoMo",     field: "momo_mtn_number" },
];

const Feedback = ({ msg }) => !msg ? null : (
  <p className={`text-[12px] ${msg.type === "error" ? "text-red-500" : "text-emerald-600"}`}>
    <i className={`fa-solid ${msg.type === "error" ? "fa-circle-exclamation" : "fa-circle-check"} mr-1.5`} />
    {msg.text}
  </p>
);

/* ── RETRAITS ─────────────────────────────────────────────────────────────── */
export const PayoutSection = ({ vendor, showToast, sectionRef }) => {
  const [balance, setBalance]   = useState(null);
  const [payouts, setPayouts]   = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [amount, setAmount]     = useState("");
  const [momo, setMomo]         = useState({ momo_orange_number: "", momo_mtn_number: "" });
  const [momoBusy, setMomoBusy] = useState("");
  const [method, setMethod]     = useState("orange_money");
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState(null);

  const load = useCallback(async () => {
    if (!vendor?.id) return;
    const [bal, hist, cfg] = await Promise.all([
      supabase.rpc("vendor_balance", { p_vendor_id: vendor.id }),
      supabase.from("vendor_payouts").select("*").eq("vendor_id", vendor.id)
        .order("requested_at", { ascending: false }).limit(20),
      supabase.from("vendor_payout_settings").select("*").eq("vendor_id", vendor.id).maybeSingle(),
    ]);
    setBalance(Array.isArray(bal.data) ? bal.data[0] : bal.data);
    setPayouts(hist.data || []);
    setSettings(cfg.data || null);
    setMomo({
      momo_orange_number: cfg.data?.momo_orange_number || "",
      momo_mtn_number:    cfg.data?.momo_mtn_number    || "",
    });
    setLoading(false);
  }, [vendor?.id]);

  useEffect(() => { load(); }, [load]);

  // Un moyen n'est proposé que si son numéro est enregistré.
  const usable = METHODS.filter(m => settings?.[m.field]);
  useEffect(() => {
    if (usable.length && !usable.some(m => m.key === method)) setMethod(usable[0].key);
  }, [settings]);   // eslint-disable-line react-hooks/exhaustive-deps

  const available = Number(balance?.available || 0);

  const normalizePhone = (v) => String(v || "").replace(/\D/g, "");
  const saveNumber = async (field) => {
    const raw = momo[field];
    if (raw && !/^[0-9]{8,15}$/.test(normalizePhone(raw))) {
      return showToast?.("Numéro invalide", "8 à 15 chiffres attendus.", "error");
    }
    setMomoBusy(field);
    try {
      const patch = {
        vendor_id: vendor.id,
        [field]: raw ? normalizePhone(raw) : null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("vendor_payout_settings").upsert(patch, { onConflict: "vendor_id" });
      if (error) throw error;
      setSettings(c => ({ ...(c || { vendor_id: vendor.id }), ...patch }));
      showToast?.(raw ? "Numéro enregistré" : "Numéro retiré");
    } catch (e) { showToast?.("Erreur", e.message, "error"); }
    finally { setMomoBusy(""); }
  };

  const submit = async () => {
    const value = Math.round(Number(amount));
    setMsg(null);
    if (!value || value <= 0)     return setMsg({ type: "error", text: "Saisis un montant." });
    if (value > available)        return setMsg({ type: "error", text: `Maximum disponible : ${money(available)}.` });

    setBusy(true);
    try {
      const { error } = await supabase.rpc("request_payout", {
        p_vendor_id: vendor.id, p_amount: value, p_method: method,
      });
      if (error) throw error;
      setAmount("");
      setMsg({ type: "ok", text: "Demande enregistrée. Elle sera traitée sous 48 h ouvrées." });
      showToast?.("Demande de retrait envoyée");
      load();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally { setBusy(false); }
  };

  return (
    <div id="retraits" ref={sectionRef} className="scroll-mt-24 bg-white border border-gray-200/80 rounded-2xl p-5 space-y-4">
      <div>
        <p className="font-bold text-[15px] mb-1">Ton solde</p>
        <p className="text-[13px] text-gray-500">
          Ce que la plateforme a encaissé pour toi et qu'il te reste à récupérer.
        </p>
      </div>

      {loading ? (
        <div className="h-24 bg-gray-50 rounded-xl animate-pulse" />
      ) : (
        <>
          {/* Soldes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Disponible", value: available,                       strong: true },
              { label: "Encaissé",   value: Number(balance?.collected || 0)               },
              { label: "En attente", value: Number(balance?.pending   || 0)               },
              { label: "Déjà versé", value: Number(balance?.withdrawn || 0)               },
            ].map(b => (
              <div key={b.label} className={`rounded-xl p-3 ${b.strong ? "bg-gray-900 text-white" : "bg-gray-50"}`}>
                <p className={`text-[11px] font-semibold ${b.strong ? "text-white/60" : "text-gray-400"}`}>{b.label}</p>
                <p className={`text-[17px] font-bold mt-1 ${b.strong ? "" : "text-gray-900"}`}>{money(b.value)}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-gray-400">
            <i className="fa-solid fa-circle-info mr-1" />
            Buyticle ne prend aucune commission : le prix de tes articles te revient en entier.{" "}
            {vendor?.delivery_mode === "buyticle"
              ? <>Les commandes payées en ligne alimentent ce solde, ainsi que celles payées à la
                  livraison une fois livrées — notre livreur encaisse pour toi. Les frais de livraison,
                  eux, restent à Buyticle puisque c'est nous qui livrons.</>
              : <>Seules les commandes payées en ligne (Orange Money, MTN MoMo) alimentent ce solde,
                  frais de livraison compris puisque tu livres toi-même. Les paiements à la livraison,
                  tu les encaisses directement.</>}
          </p>

          {/* Numéros d'encaissement */}
          <div className="border-t border-gray-100 pt-4">
            <p className={label}>Numéros sur lesquels tu reçois l'argent</p>
            <div className="space-y-2">
              {METHODS.map(m => {
                const saved = settings?.[m.field] || "";
                const dirty = normalizePhone(momo[m.field]) !== saved;
                return (
                  <div key={m.key}>
                    <div className="flex items-center gap-2">
                      <span className="w-28 text-[12px] font-semibold text-gray-600 flex-shrink-0">{m.label}</span>
                      <input
                        value={momo[m.field]}
                        onChange={e => setMomo(v => ({ ...v, [m.field]: e.target.value }))}
                        placeholder={m.key === "orange_money" ? "237 6 9X XX XX XX" : "237 6 7X XX XX XX"}
                        inputMode="tel" className={input}
                      />
                      <button onClick={() => saveNumber(m.field)} disabled={!!momoBusy || !dirty}
                        className="bg-gray-900 text-white text-[12px] font-bold px-4 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-40 flex-shrink-0">
                        {momoBusy === m.field ? "…" : "Enregistrer"}
                      </button>
                    </div>
                    {saved && (
                      <p className="text-[11px] text-emerald-600 mt-1 ml-[7.5rem]">
                        <i className="fa-solid fa-circle-check mr-1" />Enregistré : {saved}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Demande */}
          {usable.length === 0 ? (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-[12px] text-orange-700">
              <i className="fa-solid fa-triangle-exclamation mr-1.5" />
              Enregistre au moins un numéro ci-dessus pour pouvoir demander un retrait.
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={label}>Montant à retirer</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={available} value={amount}
                      onChange={e => { setAmount(e.target.value); setMsg(null); }}
                      placeholder="0" className={input} />
                    <button onClick={() => setAmount(String(available))} disabled={!available}
                      className="text-[11px] font-bold px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-40 flex-shrink-0">
                      Tout
                    </button>
                  </div>
                </div>
                <div>
                  <label className={label}>Vers</label>
                  <select value={method} onChange={e => setMethod(e.target.value)} className={input}>
                    {usable.map(m => (
                      <option key={m.key} value={m.key}>
                        {m.label} — {settings[m.field]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Feedback msg={msg} />

              <button onClick={submit} disabled={busy || !available}
                className="bg-gray-900 text-white text-[12px] font-bold px-5 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-40">
                {busy ? "Envoi…" : "Demander le retrait"}
              </button>
            </div>
          )}

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
                        <React.Fragment key={p.id}>
                        <tr className={p.note || p.reference ? "" : "border-b border-gray-50"}>
                          <td className="py-2.5 text-gray-500">
                            {p.requested_at ? new Date(p.requested_at).toLocaleDateString("fr-FR",
                              { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </td>
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
                        {(p.note || p.reference) && (
                          <tr className="border-b border-gray-50">
                            <td colSpan={4} className="pb-2.5 text-[12px] text-gray-500">
                              {p.note && <span className="block">{p.note}</span>}
                              {p.reference && (
                                <span className="block text-gray-400">
                                  Référence <span className="font-mono">{p.reference}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
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
  delivery_mode:           v?.delivery_mode || "self",
  delivery_fee:            v?.delivery_fee ?? "",
  free_delivery_threshold: v?.free_delivery_threshold ?? "",
  delivery_zones:          v?.delivery_zones || "",
  delivery_delay:          v?.delivery_delay || "",
});

// Qui livre — et donc qui encaisse l'argent du paiement à la livraison.
const DELIVERY_MODES = [
  {
    key: "self", icon: "fa-person-biking", label: "Je livre moi-même",
    sub: "Ton livreur ou toi. Tu encaisses directement l'argent des commandes payées à la livraison.",
    note: "Les frais de livraison te reviennent : sur les paiements en ligne, on te les reverse avec la vente.",
  },
  {
    key: "buyticle", icon: "fa-truck-fast", label: "Buyticle Delivery",
    sub: "Notre livreur récupère la commande et la remet au client.",
    note: "Les frais de livraison couvrent notre service et nous reviennent. Le prix des articles, lui, t'est reversé en entier.",
  },
];

export const DeliverySection = ({ vendor, updateVendorFields, showToast, sectionRef }) => {
  const [form, setForm] = useState(() => emptyDelivery(vendor));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState(null);

  useEffect(() => { setForm(emptyDelivery(vendor)); }, [vendor?.id]);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setMsg(null); };
  const dirty = Object.keys(form).some(k => String(form[k] ?? "") !== String(vendor?.[k] ?? ""));

  const save = async () => {
    const fee = form.delivery_fee === "" ? 0 : Math.round(Number(form.delivery_fee));
    const thr = form.free_delivery_threshold === "" ? null : Math.round(Number(form.free_delivery_threshold));
    if (Number.isNaN(fee) || fee < 0)              return setMsg({ type: "error", text: "Frais de livraison invalides." });
    if (thr !== null && (Number.isNaN(thr) || thr < 0)) return setMsg({ type: "error", text: "Seuil invalide." });

    setBusy(true); setMsg(null);
    try {
      await updateVendorFields({
        delivery_mode:           form.delivery_mode,
        delivery_fee:            fee,
        free_delivery_threshold: thr,
        delivery_zones:          form.delivery_zones.trim() || null,
        delivery_delay:          form.delivery_delay.trim() || null,
      });
      showToast?.("Livraison mise à jour");
    } catch (e) {
      setMsg({ type: "error", text: e.message });
      showToast?.("Erreur", e.message, "error");
    } finally { setBusy(false); }
  };

  const fee = Number(form.delivery_fee) || 0;
  const thr = Number(form.free_delivery_threshold) || 0;

  return (
    <div id="livraison" ref={sectionRef} className="scroll-mt-24 bg-white border border-gray-200/80 rounded-2xl p-5 space-y-4">
      <div>
        <p className="font-bold text-[15px] mb-1">Qui livre tes commandes ?</p>
        <p className="text-[13px] text-gray-500">
          Ce choix décide aussi de qui encaisse l'argent des commandes payées à la livraison.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {DELIVERY_MODES.map(m => {
          const on = form.delivery_mode === m.key;
          return (
            <button key={m.key} type="button" onClick={() => set("delivery_mode", m.key)}
              className={`text-left p-4 rounded-xl border-2 transition-colors ${
                on ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"
              }`}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${on ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}>
                  <i className={`fa-solid ${m.icon} text-[13px]`} />
                </div>
                <p className="font-bold text-[13px] flex-1">{m.label}</p>
                <i className={`fa-solid ${on ? "fa-circle-check text-gray-900" : "fa-circle text-gray-200"} text-[14px]`} />
              </div>
              <p className="text-[12px] text-gray-500 leading-snug mb-1.5">{m.sub}</p>
              <p className="text-[11px] text-gray-400 leading-snug">{m.note}</p>
            </button>
          );
        })}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="font-bold text-[15px] mb-1">Frais de livraison</p>
        <p className="text-[13px] text-gray-500 mb-3">
          Appliqués aux commandes de ta boutique. Laisse à 0 pour livrer gratuitement.{" "}
          {form.delivery_mode === "buyticle"
            ? "Ils rémunèrent notre livreur et reviennent à Buyticle."
            : "Ils te reviennent, puisque tu livres."}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Frais de livraison (FCFA)</label>
          <input type="number" min={0} value={form.delivery_fee}
            onChange={e => set("delivery_fee", e.target.value)} placeholder="0" className={input} />
        </div>
        <div>
          <label className={label}>Livraison offerte à partir de</label>
          <input type="number" min={0} value={form.free_delivery_threshold}
            onChange={e => set("free_delivery_threshold", e.target.value)}
            placeholder="Aucun seuil" className={input} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Zones livrées</label>
          <input value={form.delivery_zones} onChange={e => set("delivery_zones", e.target.value)}
            placeholder="Douala, Bonabéri, Bonamoussadi…" className={input} />
        </div>
        <div>
          <label className={label}>Délai annoncé</label>
          <input value={form.delivery_delay} onChange={e => set("delivery_delay", e.target.value)}
            placeholder="Sous 24 h" className={input} />
        </div>
      </div>

      <p className="text-[12px] text-gray-400">
        {fee === 0
          ? "Actuellement : livraison gratuite sur toutes tes commandes."
          : thr > 0
            ? `Actuellement : ${money(fee)} de livraison, offerte dès ${money(thr)} d'achat.`
            : `Actuellement : ${money(fee)} de livraison sur chaque commande.`}
      </p>

      {form.delivery_mode === "buyticle" && (
        <p className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
          <i className="fa-solid fa-circle-info mr-1.5" />
          Avec Buyticle Delivery, le prix des articles des commandes payées à la livraison arrive dans
          ton solde dès que la commande est marquée livrée — hors frais de livraison, qui rémunèrent
          notre livreur. Tu récupères ton solde depuis « Retraits ».
        </p>
      )}

      <Feedback msg={msg} />

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={busy || !dirty}
          className="bg-gray-900 text-white text-[12px] font-bold px-5 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-40">
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        {dirty && (
          <button onClick={() => { setForm(emptyDelivery(vendor)); setMsg(null); }} disabled={busy}
            className="text-[12px] font-bold px-4 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100">
            Annuler
          </button>
        )}
      </div>
    </div>
  );
};
