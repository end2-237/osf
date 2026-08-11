import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ════════════════════════════════════════════════════════════════════════════
   CARNET DE LIVREURS

   Le même carnet sert deux périmètres, décidés par `vendorId` :
     · null      → les livreurs Buyticle, tenus par l'admin ;
     · un id     → les livreurs d'une boutique, qu'elle seule voit.
   Les règles d'écriture ne sont pas ici : elles sont dans les policies de la
   table `couriers`. Cet écran ne fait que présenter.

   Un livreur peut exister sans compte : beaucoup de boutiques travaillent avec
   un motard qu'on appelle au téléphone. Le compte n'est utile que pour ouvrir
   la console et suivre ses courses lui-même.
   ════════════════════════════════════════════════════════════════════════════ */

const EMPTY = { full_name: "", phone: "" };

const CourierManager = ({
  vendorId = null,
  theme = "light",          // "light" = panneau seul, "admin" = super-admin
  nested = false,           // emboîté dans une carte existante : pas de cadre
  onCount = null,
}) => {
  const [list,    setList]    = useState([]);
  const [form,    setForm]    = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState(null);

  const admin = theme === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("couriers").select("*").order("created_at", { ascending: false });
    q = vendorId ? q.eq("vendor_id", vendorId) : q.is("vendor_id", null);
    const { data, error } = await q;
    if (error) setMsg({ type: "error", text: error.message });
    setList(data || []);
    onCount?.((data || []).filter(c => c.is_active).length);
    setLoading(false);
  }, [vendorId]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const name  = form.full_name.trim();
    const phone = form.phone.replace(/\D/g, "");
    if (name.length < 2)                    return setMsg({ type: "error", text: "Donne au moins un nom." });
    if (phone && !/^[0-9]{8,15}$/.test(phone)) return setMsg({ type: "error", text: "Le téléphone doit faire 8 à 15 chiffres." });

    setBusy(true); setMsg(null);
    const { error } = await supabase.from("couriers").insert({
      vendor_id: vendorId, full_name: name, phone: phone || null,
    });
    setBusy(false);
    if (error) return setMsg({ type: "error", text: error.message });
    setForm(EMPTY);
    setMsg({ type: "ok", text: `${name} ajouté.` });
    load();
  };

  // On désactive plutôt qu'on ne supprime : les courses passées gardent le nom
  // de qui les a faites.
  const toggle = async (c) => {
    setBusy(true);
    const { error } = await supabase.from("couriers")
      .update({ is_active: !c.is_active }).eq("id", c.id);
    setBusy(false);
    if (error) return setMsg({ type: "error", text: error.message });
    load();
  };

  const cls = admin
    ? { card: "bg-white border border-[#D5D9D9] rounded-xl",
        input: "w-full bg-white border border-[#D5D9D9] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#FF9900]",
        label: "text-[9px] font-black uppercase tracking-widest text-[#565959] block mb-1.5",
        btn: "bg-[#131921] hover:bg-[#232F3E] text-white text-[10px] font-black uppercase tracking-wider px-5 py-2.5 rounded-lg" }
    : { card: "bg-white border border-gray-200/80 rounded-2xl",
        input: "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-900",
        label: "text-[11px] font-bold uppercase tracking-wide text-gray-400 block mb-1.5",
        btn: "bg-gray-900 hover:bg-gray-800 text-white text-[12px] font-bold px-5 py-2.5 rounded-xl" };

  return (
    <div className={nested ? "space-y-4" : `${cls.card} p-5 space-y-4`}>
      <div>
        <p className="font-bold text-[15px] mb-1">
          {vendorId ? "Mes livreurs" : "Livreurs Buyticle"}
        </p>
        <p className="text-[13px] text-gray-500">
          {vendorId
            ? "Les personnes à qui tu peux confier une course. Un numéro suffit — le compte n'est utile que si le livreur veut suivre ses courses lui-même."
            : "Les livreurs de la plateforme, attribuables aux commandes que les boutiques nous confient."}
        </p>
      </div>

      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <label className={cls.label}>Nom</label>
          <input value={form.full_name} onChange={e => { setForm(f => ({ ...f, full_name: e.target.value })); setMsg(null); }}
            placeholder="Robert Ndongo" className={cls.input} />
        </div>
        <div>
          <label className={cls.label}>Téléphone</label>
          <input value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setMsg(null); }}
            placeholder="237 6XX XXX XXX" inputMode="tel" className={cls.input} />
        </div>
        <button onClick={add} disabled={busy || !form.full_name.trim()} className={`${cls.btn} disabled:opacity-40`}>
          <i className="fa-solid fa-plus mr-1.5 text-[11px]" />Ajouter
        </button>
      </div>

      {msg && (
        <p className={`text-[12px] font-bold ${msg.type === "error" ? "text-red-500" : "text-emerald-600"}`}>
          <i className={`fa-solid ${msg.type === "error" ? "fa-circle-exclamation" : "fa-circle-check"} mr-1.5`} />
          {msg.text}
        </p>
      )}

      {loading ? (
        <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
      ) : list.length === 0 ? (
        <div className="text-center py-8 border-t border-gray-100">
          <i className="fa-solid fa-id-badge text-3xl mb-3 block text-gray-200" />
          <p className="text-[13px] font-bold text-gray-500">Aucun livreur enregistré</p>
          <p className="text-[11px] text-gray-400 mt-1">
            Tant que ce carnet est vide, seule l'option « je démarre moi-même » est proposée.
          </p>
        </div>
      ) : (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {list.map(c => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: c.is_active ? "#131921" : "#EDEFEF" }}>
                <i className="fa-solid fa-user text-[12px]"
                  style={{ color: c.is_active ? "#FF9900" : "#adb5bd" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-[13px] truncate ${c.is_active ? "" : "text-gray-400 line-through"}`}>
                  {c.full_name}
                </p>
                <p className="text-[11px] text-gray-400">
                  {c.phone || "Sans téléphone"}
                  {c.user_id ? " · compte lié" : " · sans compte"}
                </p>
              </div>
              <button onClick={() => toggle(c)} disabled={busy}
                className={`text-[11px] font-bold px-3 py-2 rounded-xl border disabled:opacity-50 ${
                  c.is_active
                    ? "border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500"
                    : "border-gray-200 text-emerald-600"
                }`}>
                {c.is_active ? "Désactiver" : "Réactiver"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CourierManager;
