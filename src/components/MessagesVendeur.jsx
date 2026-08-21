import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGES DE BUYTICLE — côté commerçant

   Cet écran répond à une question, et une seule : « je suis parti avec
   quarante-quatre articles, j'en retrouve quarante et un, que s'est-il
   passé ? »

   Jusqu'ici il n'y avait rien à répondre. L'administration pouvait supprimer,
   suspendre, avertir — et le commerçant ne voyait qu'un nombre qui avait
   changé. Il ne sait pas ce qu'il a fait de travers, donc il le refera ; et à
   force il conclut que la plateforme perd ses données. Il a raison de le
   penser tant qu'on ne lui dit rien.

   Deux sources, un seul fil. `actions_admin` porte ce que l'équipe a FAIT,
   avec le motif et la copie de l'article ; `mes_notifications` porte ce
   qu'elle a DIT, y compris les événements du relais. Les fusionner ici évite
   au commerçant de chercher dans deux endroits — et il n'en chercherait
   qu'un.

   L'ordre est chronologique inverse, sans regroupement : c'est un dossier
   qu'on relit, pas un flux qu'on parcourt.
   ═══════════════════════════════════════════════════════════════════════════ */

const GENRES = {
  produit_retire:     { t: "Article retiré",     i: "fa-box-open",       c: "text-[#B12704] bg-[#FEE7E5]" },
  produit_masque:     { t: "Article masqué",     i: "fa-eye-slash",      c: "text-[#8A6D00] bg-[#FFF3CD]" },
  boutique_suspendue: { t: "Boutique suspendue", i: "fa-store-slash",    c: "text-[#B12704] bg-[#FEE7E5]" },
  boutique_retablie:  { t: "Boutique rouverte",  i: "fa-store",          c: "text-[#007600] bg-[#E8F5E8]" },
  avertissement:      { t: "Avertissement",      i: "fa-triangle-exclamation", c: "text-[#8A6D00] bg-[#FFF3CD]" },
  message:            { t: "Message",            i: "fa-comment-dots",   c: "text-[#0F1111] bg-[#EAEDED]" },
  appel:              { t: "Appel de relais",    i: "fa-arrows-turn-right", c: "text-[#00695C] bg-[#E0F2F1]" },
  arrive:             { t: "Client arrivé",      i: "fa-person-walking", c: "text-[#00695C] bg-[#E0F2F1]" },
  vendu:              { t: "Relais vendu",       i: "fa-check",          c: "text-[#007600] bg-[#E8F5E8]" },
  pas_venu:           { t: "Client non venu",    i: "fa-clock",          c: "text-[#565959] bg-[#EAEDED]" },
};

function quand(iso) {
  const d = new Date(iso);
  const h = Math.round((Date.now() - d) / 3600000);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j === 1) return "hier";
  if (j < 7) return `il y a ${j} jours`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** Le compteur pour la pastille de la navigation. Sept jours seulement : un
    avertissement de mars n'est plus une alerte, c'est de l'historique. */
export async function compterMessagesVendeur(vendorId) {
  if (!vendorId) return 0;
  const { count } = await supabase
    .from("actions_admin")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId)
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
  return count || 0;
}

export default function MessagesVendeur({ vendor }) {
  const [liste, setListe] = useState(null);

  const charger = useCallback(async () => {
    if (!vendor?.id) { setListe([]); return; }

    const [{ data: actions }, { data: notifs }] = await Promise.all([
      supabase.rpc("mes_actions_admin", { p_vendor_id: vendor.id, p_limite: 60 }),
      supabase.rpc("mes_notifications", { p_vendor_id: vendor.id, p_limite: 60 }),
    ]);

    // Une action laisse DEUX lignes — l'historique et la notification poussée.
    // On garde l'historique, plus riche (motif, article visé), et on n'ajoute
    // la notification que si aucune action ne lui correspond à la minute près.
    const minute = (d) => new Date(d).toISOString().slice(0, 16);
    const vues = new Set((actions || []).map((a) => `${a.genre}|${minute(a.created_at)}`));

    const fil = [
      ...(actions || []).map((a) => ({
        id: `a-${a.id}`, genre: a.genre, motif: a.motif,
        titre: null, corps: a.message, cible: a.cible, date: a.created_at,
      })),
      ...(notifs || [])
        .filter((n) => !vues.has(`${n.genre}|${minute(n.created_at)}`))
        .map((n) => ({
          id: `n-${n.id}`, genre: n.genre, motif: null,
          titre: n.titre, corps: n.corps, cible: null, date: n.created_at, lien: n.lien,
        })),
    ].sort((x, y) => new Date(y.date) - new Date(x.date));

    setListe(fil);
  }, [vendor?.id]);

  useEffect(() => { charger(); }, [charger]);

  return (
    <div className="space-y-4">
      <div className="bg-[#131921] rounded-xl px-5 py-4 flex items-start gap-3">
        <i className="fa-solid fa-comment-dots text-[#FF9900] mt-0.5" />
        <p className="text-[11px] text-[#ADBAC7] leading-relaxed">
          Tout ce que l'équipe Buyticle fait sur ta boutique apparaît ici, avec le
          motif et la date. Si un article disparaît de ta liste, la raison est
          écrite sur cette page — tu n'as plus à deviner.
        </p>
      </div>

      {liste === null ? (
        <p className="text-[13px] text-[#565959] px-1">Chargement…</p>
      ) : liste.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#D5D9D9] px-6 py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[#F0F2F2] mx-auto flex items-center justify-center">
            <i className="fa-solid fa-bell text-[#ADB1B8] text-lg" />
          </div>
          <p className="text-[15px] font-bold text-[#0F1111] mt-4">Rien à signaler</p>
          <p className="text-[12.5px] text-[#565959] mt-1 max-w-sm mx-auto leading-relaxed">
            Quand l'équipe interviendra sur ta boutique — un article retiré, un
            rappel —, tu retrouveras ici ce qui a été fait et pourquoi.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {liste.map((m) => {
            const g = GENRES[m.genre] || GENRES.message;
            return (
              <div key={m.id} className="bg-white rounded-xl border border-[#D5D9D9] p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${g.c}`}>
                    <i className={`fa-solid ${g.i}`} style={{ fontSize: 9 }} />
                    {g.t}
                  </span>
                  {m.cible && (
                    <span className="text-[12px] font-bold text-[#0F1111]">{m.cible}</span>
                  )}
                  <span className="flex-1" />
                  <span className="text-[11px] text-[#ADB1B8]">{quand(m.date)}</span>
                </div>

                {m.titre && (
                  <p className="text-[13px] font-bold text-[#0F1111] mt-2">{m.titre}</p>
                )}
                <p className="text-[12.5px] text-[#0F1111] leading-relaxed whitespace-pre-line mt-1.5">
                  {m.corps}
                </p>

                {m.motif && (
                  <span className="inline-block text-[10.5px] text-[#565959] bg-[#F0F2F2] rounded-full px-2.5 py-1 mt-2.5">
                    {m.motif.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11.5px] text-[#565959] px-1 leading-relaxed">
        Une décision te paraît injuste ? Réponds depuis l'assistance en citant la
        date : un article retiré garde sa copie complète et peut être remis en
        ligne.
      </p>
    </div>
  );
}
