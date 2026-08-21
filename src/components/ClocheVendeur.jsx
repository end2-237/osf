import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ═══════════════════════════════════════════════════════════════════════════
   LA CLOCHE DU COMPTOIR

   Elle existait déjà — en décor. Un `<button>` sans `onClick`, sans compteur,
   sans rien derrière. C'est pire qu'une absence : un bouton qui ne fait rien
   apprend au commerçant que les boutons de cette page ne font rien, et il
   cesse d'essayer les autres.

   Ce qu'elle porte maintenant, dans l'ordre où ça presse :

   ① LES APPELS DE RELAIS EN COURS, avec leur compte à rebours et le bouton
   qui répond. Trente secondes ne se rattrapent pas : on répond ICI, sans
   changer de page. Ils sont relus toutes les cinq secondes — c'est le seul
   endroit du tableau de bord où l'on interroge aussi souvent, et c'est le
   seul qui le mérite.

   ② LES COMMANDES À CONFIRMER, parce qu'une commande non confirmée finit
   annulée et le client va ailleurs.

   ③ CE QUE BUYTICLE A ÉCRIT — article retiré, avertissement, rappel.

   La pastille compte les NON LUS. Une pastille qui compte les récents ment au
   bout d'un jour, et une pastille qui ment fait ignorer toutes les suivantes.
   ═══════════════════════════════════════════════════════════════════════════ */

const GENRES = {
  produit_retire:     { t: "Article retiré",     i: "fa-box-open",  c: "text-[#B12704]" },
  boutique_suspendue: { t: "Boutique suspendue", i: "fa-store-slash", c: "text-[#B12704]" },
  boutique_retablie:  { t: "Boutique rouverte",  i: "fa-store",     c: "text-[#007600]" },
  avertissement:      { t: "Avertissement",      i: "fa-triangle-exclamation", c: "text-[#8A6D00]" },
  message:            { t: "Message",            i: "fa-comment-dots", c: "text-[#0F1111]" },
};

function quand(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? "hier" : `il y a ${j} jours`;
}

/* Un appel en cours. Le compte à rebours descend seul : il dit s'il vaut
   encore la peine d'aller vérifier au fond du magasin, ou s'il faut répondre
   tout de suite. */
function Appel({ a, vendorId, onRepondu }) {
  const [reste, setReste] = useState(a.reste_s ?? 30);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReste(a.reste_s ?? 30);
    const t = setInterval(() => setReste((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [a.appel_id, a.reste_s]);

  const repondre = async (dispo) => {
    setBusy(true);
    await supabase.rpc("repondre_appel", {
      p_appel_id: a.appel_id, p_vendor_id: vendorId, p_disponible: dispo,
      p_product_id: a.product_id ?? null, p_libelle: a.libelle ?? null,
      p_prix_net: a.prix_net ?? null,
    });
    onRepondu(a.appel_id);
  };

  if (reste <= 0) return null;

  return (
    <div className="px-4 py-3 border-b border-[#EBEBEB] bg-[#E0F2F1]/40">
      <div className="flex items-center gap-2">
        <i className="fa-solid fa-arrows-turn-right text-[#00695C] text-[11px]" />
        <span className="text-[11px] font-black uppercase tracking-wider text-[#00695C]">
          Un voisin cherche
        </span>
        <span className="flex-1" />
        <span className={`text-[10px] font-black text-white px-2 py-0.5 rounded-full ${
          reste <= 10 ? "bg-[#B12704]" : "bg-[#131921]"}`}>
          {reste} s
        </span>
      </div>
      <p className="text-[13px] font-bold text-[#0F1111] mt-1.5">
        {a.produit || a.libelle || "Article demandé"}
      </p>
      {(a.contrainte || a.budget) && (
        <p className="text-[11px] text-[#565959]">
          {[a.contrainte, a.budget ? `budget ${Number(a.budget).toLocaleString("fr-FR")} F` : null]
            .filter(Boolean).join(" · ")}
        </p>
      )}
      <div className="flex gap-2 mt-2.5">
        <button onClick={() => repondre(false)} disabled={busy}
          className="flex-1 text-[12px] font-bold text-[#0F1111] border border-[#D5D9D9] rounded-lg py-2 disabled:opacity-40">
          Je ne l'ai pas
        </button>
        <button onClick={() => repondre(true)} disabled={busy}
          className="flex-[1.3] text-[12px] font-black text-white bg-[#00695C] rounded-lg py-2 disabled:opacity-40">
          <i className="fa-solid fa-check mr-1.5" />Je l'ai
        </button>
      </div>
    </div>
  );
}

export default function ClocheVendeur({ vendor, aConfirmer = 0, onOuvrirSection }) {
  const [ouvert, setOuvert] = useState(false);
  const [appels, setAppels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [nonLus, setNonLus] = useState(0);
  const boite = useRef(null);

  /* Les appels : toutes les cinq secondes, même cloche fermée. Ne les
     chercher qu'à l'ouverture voudrait dire que la pastille n'apparaît
     jamais — et personne n'ouvre une cloche éteinte. */
  const chargerAppels = useCallback(async () => {
    if (!vendor?.id) return;
    const { data } = await supabase.rpc("appels_en_attente", { p_vendor_id: vendor.id });
    setAppels(data || []);
  }, [vendor?.id]);

  const chargerMessages = useCallback(async () => {
    if (!vendor?.id) return;
    const [{ data: a }, { data: n }] = await Promise.all([
      supabase.rpc("mes_actions_admin", { p_vendor_id: vendor.id, p_limite: 12 }),
      supabase.rpc("compter_messages_non_lus", { p_vendor_id: vendor.id }),
    ]);
    setMessages(a || []);
    setNonLus(Number(n) || 0);
  }, [vendor?.id]);

  useEffect(() => { chargerAppels(); chargerMessages(); }, [chargerAppels, chargerMessages]);

  useEffect(() => {
    if (!vendor?.id) return;
    const t = setInterval(chargerAppels, 5000);
    return () => clearInterval(t);
  }, [vendor?.id, chargerAppels]);

  // Un menu qui ne se referme pas en cliquant à côté finit par masquer la page.
  useEffect(() => {
    if (!ouvert) return;
    const h = (e) => { if (!boite.current?.contains(e.target)) setOuvert(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ouvert]);

  const total = appels.length + nonLus + aConfirmer;
  const urgent = appels.length > 0;

  return (
    <div className="relative" ref={boite}>
      <button
        onClick={() => setOuvert((o) => !o)}
        title={total ? `${total} chose(s) à voir` : "Rien de neuf"}
        className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
          urgent ? "bg-[#E0F2F1] text-[#00695C]" : "hover:bg-gray-100 text-gray-500"}`}>
        <i className={`fa-bell ${urgent ? "fa-solid" : "fa-regular"}`} />
        {total > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full text-white text-[9px] font-black flex items-center justify-center ${
            urgent ? "bg-[#B12704] animate-pulse" : "bg-[#FF9900]"}`}>
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute right-0 top-11 w-[340px] max-w-[92vw] bg-white rounded-xl border border-[#D5D9D9] shadow-xl z-50 overflow-hidden">
          <div className="bg-[#131921] px-4 py-2.5 flex items-center justify-between">
            <span className="text-white font-black text-[12px]">Notifications</span>
            <button onClick={() => setOuvert(false)} className="text-[#ADBAC7] hover:text-white">
              <i className="fa-solid fa-xmark text-[12px]" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {/* ① Ce qui expire */}
            {appels.map((a) => (
              <Appel key={a.appel_id} a={a} vendorId={vendor.id}
                onRepondu={(id) => setAppels((l) => l.filter((x) => x.appel_id !== id))} />
            ))}

            {/* ② Ce qui bloque une vente */}
            {aConfirmer > 0 && (
              <button
                onClick={() => { setOuvert(false); onOuvrirSection?.("orders"); }}
                className="w-full text-left px-4 py-3 border-b border-[#EBEBEB] hover:bg-[#F7F8F8] flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-[#FFF3CD] flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-cart-shopping text-[#8A6D00] text-[12px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold text-[#0F1111]">
                    {aConfirmer} commande{aConfirmer > 1 ? "s" : ""} à confirmer
                  </span>
                  <span className="block text-[11px] text-[#565959]">
                    Une commande non confirmée finit annulée.
                  </span>
                </span>
              </button>
            )}

            {/* ③ Ce que Buyticle a écrit */}
            {messages.map((m) => {
              const g = GENRES[m.genre] || GENRES.message;
              return (
                <button key={m.id}
                  onClick={() => { setOuvert(false); onOuvrirSection?.("messages"); }}
                  className={`w-full text-left px-4 py-3 border-b border-[#EBEBEB] hover:bg-[#F7F8F8] flex items-start gap-3 ${
                    m.lu ? "" : "bg-[#FFF6E9]/60"}`}>
                  <span className="w-8 h-8 rounded-lg bg-[#F0F2F2] flex items-center justify-center flex-shrink-0">
                    <i className={`fa-solid ${g.i} ${g.c} text-[12px]`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`text-[12.5px] font-bold ${g.c}`}>{g.t}</span>
                      {!m.lu && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#FF9900]">
                          Nouveau
                        </span>
                      )}
                    </span>
                    {m.cible && (
                      <span className="block text-[11.5px] font-semibold text-[#0F1111] truncate">
                        {m.cible}
                      </span>
                    )}
                    <span className="block text-[11px] text-[#565959] line-clamp-2 leading-snug mt-0.5">
                      {m.message}
                    </span>
                    <span className="block text-[10px] text-[#ADB1B8] mt-1">{quand(m.created_at)}</span>
                  </span>
                </button>
              );
            })}

            {appels.length === 0 && aConfirmer === 0 && messages.length === 0 && (
              <div className="px-4 py-10 text-center">
                <i className="fa-regular fa-bell text-[#ADB1B8] text-xl" />
                <p className="text-[12.5px] text-[#565959] mt-2 leading-relaxed">
                  Rien de neuf.<br />
                  Quand un voisin cherchera un article que tu as, l'appel arrivera
                  ici — et tu pourras répondre sans quitter la page.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => { setOuvert(false); onOuvrirSection?.("messages"); }}
            className="w-full bg-[#F7F8F8] border-t border-[#D5D9D9] py-2.5 text-[12px] font-bold text-[#0F1111] hover:bg-[#EFF1F1]">
            Voir tous les messages
          </button>
        </div>
      )}
    </div>
  );
}
