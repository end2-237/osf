import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ═══════════════════════════════════════════════════════════════════════════
   PARLER AU VENDEUR

   Le défaut réparé ici est un défaut de politesse, et les défauts de politesse
   coûtent des boutiques. Un commerçant quittait son comptoir avec quarante-
   quatre articles et le retrouvait à quarante et un, sans un mot. Il ne sait
   pas ce qu'il a fait de travers, donc il le refera ; et à force, il croit
   que la plateforme perd ses données.

   Trois principes tiennent tout ce fichier.

   ① AUCUNE ACTION SANS MESSAGE. La feuille d'action ne se valide pas tant que
   le texte est vide. On ne peut plus supprimer en silence, même par accident.

   ② UN TEXTE PAR DÉFAUT POUR CHAQUE CAS, MAIS TOUJOURS MODIFIABLE. Un modèle
   figé produit des messages qui ne répondent pas ; un champ vide produit des
   messages jamais écrits. Le modèle se charge, et on le corrige.

   ③ LE VENDEUR VOIT CE QU'IL VA RECEVOIR. L'aperçu montre la notification
   telle qu'elle arrivera sur son téléphone. On écrit autrement quand on voit
   la carte que l'autre lira.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Les cas, et ce qu'on dit dans chacun ──────────────────────────────────
   Ces textes sont écrits pour être lus par quelqu'un qui vend, pas par un
   juriste. Ils disent ce qui s'est passé, pourquoi, et ce qu'il peut faire
   ensuite — dans cet ordre. Un message qui n'indique pas la suite laisse le
   commerçant sans autre recours que d'appeler, et il n'appellera pas. */

export const MOTIFS_PRODUIT = [
  {
    cle: "doublon",
    label: "Article publié en double",
    titre: "Un article a été retiré",
    texte:
      "Ton article était publié plusieurs fois sur ta boutique. Nous avons gardé la première annonce — celle qui porte déjà tes vues et tes avis — et retiré les copies.\n\n" +
      "Ça arrive souvent quand le réseau coupe pendant la publication : l'article part bien, mais tu ne reçois pas la confirmation et tu recommences. Vérifie ta liste avant de republier, l'article y est peut-être déjà.",
  },
  {
    cle: "photo",
    label: "Photo manquante ou illisible",
    titre: "Un article a été retiré",
    texte:
      "Ton article a été retiré parce que sa photo ne permet pas de voir ce qui est vendu.\n\n" +
      "Republie-le avec une photo nette de l'article seul, prise de face et en pleine lumière. C'est la photo qui décide de la vente : un article mal photographié ne se vend pas, même au bon prix.",
  },
  {
    cle: "description",
    label: "Description absente ou trompeuse",
    titre: "Un article a été retiré",
    texte:
      "Ton article a été retiré parce que sa description ne correspond pas à ce qui est vendu, ou qu'elle est absente.\n\n" +
      "Republie-le en disant la marque, la taille ou la contenance, et l'état. Un client qui reçoit autre chose que ce qu'il a lu demande un remboursement, et c'est toi qui le paies.",
  },
  {
    cle: "prix",
    label: "Prix manifestement faux",
    titre: "Un article a été retiré",
    texte:
      "Ton article a été retiré parce que son prix paraît erroné.\n\n" +
      "Vérifie que tu as saisi ton prix NET, sans les frais : la plateforme ajoute sa part par-dessus, et tu touches exactement ce que tu as écrit. Republie avec le bon montant.",
  },
  {
    cle: "interdit",
    label: "Article interdit à la vente",
    titre: "Un article a été retiré",
    texte:
      "Ton article a été retiré parce qu'il fait partie des produits que nous n'acceptons pas sur Buyticle.\n\n" +
      "Si tu penses que c'est une erreur, réponds à ce message : nous regarderons le dossier.",
  },
  {
    cle: "contrefacon",
    label: "Contrefaçon présumée",
    titre: "Un article a été retiré",
    texte:
      "Ton article a été retiré : la marque affichée ne correspond pas à ce que montre la photo.\n\n" +
      "Si l'article est authentique, réponds à ce message avec une preuve d'achat ou une photo de l'étiquette, et nous le remettrons en ligne.",
  },
  {
    cle: "autre",
    label: "Autre motif",
    titre: "Un article a été retiré",
    texte: "",
  },
];

export const MOTIFS_BOUTIQUE = [
  {
    cle: "suspension_livraison",
    label: "Suspension — commandes non honorées",
    titre: "Ta boutique a été suspendue",
    texte:
      "Ta boutique est suspendue : plusieurs commandes n'ont pas été livrées et les clients n'ont pas eu de réponse.\n\n" +
      "Rien n'est perdu : tes articles et ton solde t'attendent. Traite les commandes en attente depuis ton comptoir, puis réponds à ce message — nous rouvrons dès que c'est réglé.",
  },
  {
    cle: "suspension_kyc",
    label: "Suspension — pièces manquantes",
    titre: "Ta boutique a été suspendue",
    texte:
      "Ta boutique est suspendue en attendant tes pièces d'identité.\n\n" +
      "Dépose-les depuis le site, rubrique « Mon compte ». La réouverture prend moins de vingt-quatre heures une fois les pièces reçues.",
  },
  {
    cle: "reouverture",
    label: "Réouverture",
    titre: "Ta boutique est de nouveau ouverte",
    texte:
      "C'est réglé : ta boutique est de nouveau ouverte et tes articles sont visibles.\n\nMerci d'avoir fait le nécessaire.",
  },
];

export const MOTIFS_MESSAGE = [
  {
    cle: "rappel_commandes",
    label: "Rappel — commandes en attente",
    titre: "Des commandes t'attendent",
    texte:
      "Tu as des commandes en attente de confirmation depuis plus de vingt-quatre heures.\n\n" +
      "Une commande non confirmée finit par être annulée, et le client va ailleurs. Ouvre ton comptoir dès que tu peux.",
  },
  {
    cle: "rappel_appels",
    label: "Rappel — appels de relais ignorés",
    titre: "Tu rates des ventes de relais",
    texte:
      "Des voisins ont cherché un article que tu as en boutique, et l'appel est resté sans réponse.\n\n" +
      "Chaque appel auquel tu réponds en moins de trente secondes est une vente que tu prends à la place d'un autre. Vérifie que les notifications sont autorisées dans les réglages de ton téléphone.",
  },
  {
    cle: "rappel_abonnement",
    label: "Rappel — abonnement",
    titre: "Ton abonnement arrive à échéance",
    texte:
      "Ton abonnement arrive bientôt à échéance.\n\n" +
      "Tu peux le régler depuis ton comptoir, ou avec ton bon de relais si tu en as assez. Sans renouvellement, ta boutique reste en ligne mais perd sa mise en avant.",
  },
  {
    cle: "avertissement",
    label: "Avertissement",
    titre: "Un avertissement de Buyticle",
    texte:
      "Nous avons relevé un manquement sur ta boutique.\n\n" +
      "Ceci est un premier avertissement : rien n'est encore suspendu. Réponds à ce message si tu veux qu'on en parle.",
  },
  { cle: "libre", label: "Message libre", titre: "Message de Buyticle", texte: "" },
];

/* ── L'aperçu de ce que le vendeur recevra ────────────────────────────────── */
function ApercuNotif({ titre, texte, boutique }) {
  return (
    <div className="bg-[#F0F2F2] rounded-xl p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-2">
        Ce que {boutique || "la boutique"} recevra
      </p>
      <div className="bg-white rounded-lg border border-[#D5D9D9] p-3 flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#131921] flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-bell text-[#FF9900] text-[11px]" />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-[#0F1111]">{titre || "Message de Buyticle"}</p>
          <p className="text-[11px] text-[#565959] whitespace-pre-line leading-relaxed mt-0.5">
            {texte || "…"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── La feuille d'action, partagée par tous les cas ────────────────────────
   Un seul composant pour supprimer, suspendre et écrire : les trois posent la
   même question — qu'est-ce qui se passe, et qu'est-ce qu'on en dit. */
export function FeuilleAction({
  titre, sousTitre, motifs, boutique, dangereux = false,
  onFerme, onValider, libelleValider = "Confirmer et prévenir",
}) {
  const [motif, setMotif] = useState(motifs[0]);
  const [texte, setTexte] = useState(motifs[0].texte);
  const [titreNotif, setTitreNotif] = useState(motifs[0].titre);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");

  const choisir = (m) => {
    setMotif(m);
    setTexte(m.texte);
    setTitreNotif(m.titre);
  };

  const valider = async () => {
    if (!texte.trim()) { setErreur("Écris ce que le vendeur doit lire. C'est tout l'objet de cet écran."); return; }
    setBusy(true); setErreur("");
    try {
      await onValider({ motif: motif.cle, titre: titreNotif, message: texte.trim() });
    } catch (e) {
      setErreur(e?.message || "L'action n'a pas abouti.");
      setBusy(false);
    }
  };

  const champ = "w-full bg-white border border-[#D5D9D9] rounded-lg px-3 py-2 text-[13px] text-[#0F1111] focus:outline-none focus:border-[#FF9900]";

  return (
    <div className="fixed inset-0 z-[400] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-[#F7F8F8] w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <div className="sticky top-0 bg-[#131921] px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div>
            <h3 className="text-white font-black text-sm">{titre}</h3>
            {sousTitre && <p className="text-[#ADBAC7] text-[11px] mt-0.5">{sousTitre}</p>}
          </div>
          <button onClick={onFerme} className="text-[#ADBAC7] hover:text-white flex-shrink-0">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1.5 block">
              Le motif
            </span>
            <div className="grid sm:grid-cols-2 gap-2">
              {motifs.map((m) => (
                <button key={m.cle} onClick={() => choisir(m)}
                  className={`text-left px-3 py-2 rounded-lg border text-[12px] font-bold transition-all ${
                    motif.cle === m.cle
                      ? "border-[#FF9900] bg-[#FFF6E9] text-[#0F1111]"
                      : "border-[#D5D9D9] bg-white text-[#565959] hover:border-[#ADB1B8]"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1 block">
              Titre de la notification
            </span>
            <input className={champ} value={titreNotif}
              onChange={(e) => setTitreNotif(e.target.value)} />
          </div>

          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1 block">
              Le message *
            </span>
            <textarea rows={9} className={champ} value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Dis ce qui s'est passé, pourquoi, et ce qu'il peut faire ensuite." />
            <p className="text-[10px] text-[#565959] mt-1">
              Le modèle est un point de départ — corrige-le. Un message qui n'indique
              pas la suite laisse le commerçant sans recours, et il n'appellera pas.
            </p>
          </div>

          <ApercuNotif titre={titreNotif} texte={texte} boutique={boutique} />

          {erreur && (
            <p className="text-[12px] text-[#B12704] bg-[#FEE7E5] rounded-lg px-3 py-2">{erreur}</p>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-[#D5D9D9] px-5 py-3 flex gap-3 justify-end">
          <button onClick={onFerme}
            className="px-5 py-2 rounded-lg border border-[#D5D9D9] text-[13px] font-bold text-[#0F1111]">
            Annuler
          </button>
          <button onClick={valider} disabled={busy || !texte.trim()}
            className={`px-6 py-2 rounded-lg text-[13px] font-black disabled:opacity-40 disabled:cursor-not-allowed ${
              dangereux ? "bg-[#B12704] text-white" : "bg-[#FF9900] text-[#0F1111]"}`}>
            {busy ? "…" : libelleValider}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Écrire à une boutique, sans rien changer d'autre ─────────────────────── */
function EcrireABoutique({ boutiques, onEnvoye }) {
  const [vendorId, setVendorId] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [ok, setOk] = useState("");

  const boutique = boutiques.find((b) => b.id === vendorId);

  return (
    <div className="bg-white rounded-xl border border-[#D5D9D9] overflow-hidden">
      <div className="bg-[#131921] px-5 py-3">
        <h3 className="text-white font-black text-sm">Écrire à une boutique</h3>
        <p className="text-[#ADBAC7] text-[11px] mt-0.5">
          Un rappel, une relance, un avertissement — sans rien supprimer ni suspendre.
          Le message arrive dans la boîte du commerçant et sur son téléphone.
        </p>
      </div>

      <div className="p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1 block">
            La boutique
          </span>
          <select value={vendorId} onChange={(e) => { setVendorId(e.target.value); setOk(""); }}
            className="w-full bg-white border border-[#D5D9D9] rounded-lg px-3 py-2 text-[13px]">
            <option value="">— choisir —</option>
            {boutiques.map((b) => <option key={b.id} value={b.id}>{b.shop_name}</option>)}
          </select>
        </div>
        <button onClick={() => setOuvert(true)} disabled={!vendorId}
          className="bg-[#FF9900] text-[#0F1111] font-black text-[13px] rounded-lg px-5 py-2 disabled:opacity-40">
          <i className="fa-solid fa-paper-plane mr-2" />Écrire
        </button>
      </div>

      {ok && <p className="px-5 pb-4 text-[12px] font-bold text-[#007600]">{ok}</p>}

      {ouvert && boutique && (
        <FeuilleAction
          titre={`Écrire à ${boutique.shop_name}`}
          sousTitre="Rien ne sera modifié sur la boutique. C'est une parole, pas une action."
          motifs={MOTIFS_MESSAGE}
          boutique={boutique.shop_name}
          libelleValider="Envoyer"
          onFerme={() => setOuvert(false)}
          onValider={async ({ motif, titre, message }) => {
            const genre = motif === "avertissement" ? "avertissement" : "message";
            const { error } = await supabase.rpc("admin_ecrire_vendeur", {
              p_vendor_id: vendorId, p_titre: titre, p_message: message,
              p_genre: genre, p_motif: motif,
            });
            if (error) throw new Error(error.message);
            setOuvert(false);
            setOk(`Message envoyé à ${boutique.shop_name}.`);
            onEnvoye?.();
          }} />
      )}
    </div>
  );
}

/* ── Les doublons ─────────────────────────────────────────────────────────
   La liste que la migration refuse de ranger toute seule. On garde le plus
   ancien : c'est lui qui porte les vues, les avis et les commandes passées —
   supprimer l'original pour garder la copie effacerait l'historique de la
   fiche sans que personne s'en aperçoive. */
function Doublons({ onNettoye }) {
  const [liste, setListe] = useState(null);
  const [cible, setCible] = useState(null);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase.rpc("doublons_produits");
    setListe(data || []);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const total = (liste || []).reduce((s, d) => s + (d.supprimer?.length || 0), 0);

  const toutNettoyer = async () => {
    setBusy(true);
    const ids = (liste || []).flatMap((d) => d.supprimer || []);
    await supabase.rpc("admin_retirer_produits", {
      p_ids: ids, p_motif: "doublon",
      p_message: MOTIFS_PRODUIT[0].texte,
    });
    setBusy(false);
    charger(); onNettoye?.();
  };

  return (
    <div className="bg-white rounded-xl border border-[#D5D9D9] overflow-hidden">
      <div className="bg-[#131921] px-5 py-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-black text-sm">Articles publiés en double</h3>
          <p className="text-[#ADBAC7] text-[11px] mt-0.5">
            Presque toujours un réseau coupé pendant la publication : l'article part bien,
            la confirmation se perd, le vendeur recommence. On garde la première annonce —
            celle qui porte les vues et les avis.
          </p>
        </div>
        {total > 0 && (
          <button onClick={toutNettoyer} disabled={busy}
            className="bg-[#FF9900] text-[#0F1111] font-black text-[12px] rounded-lg px-4 py-2 whitespace-nowrap disabled:opacity-40">
            {busy ? "…" : `Retirer les ${total} copies`}
          </button>
        )}
      </div>

      {liste === null ? (
        <p className="px-5 py-6 text-[13px] text-[#565959]">Recherche…</p>
      ) : liste.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-[#007600] font-bold">
          Aucun doublon. L'index unique peut être posé — rejoue la migration 42.
        </p>
      ) : (
        <div className="divide-y divide-[#EBEBEB]">
          {liste.map((d) => (
            <div key={`${d.vendor_id}-${d.nom}`} className="px-5 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#0F1111] truncate">{d.nom}</p>
                <p className="text-[11px] text-[#565959]">
                  {d.shop_name} · publié {d.combien} fois
                </p>
              </div>
              <button onClick={() => setCible(d)}
                className="text-[12px] font-bold text-[#0F1111] border border-[#D5D9D9] rounded-lg px-3 py-1.5 whitespace-nowrap">
                Retirer {d.supprimer?.length} copie{d.supprimer?.length > 1 ? "s" : ""}
              </button>
            </div>
          ))}
        </div>
      )}

      {cible && (
        <FeuilleAction
          titre={`Retirer ${cible.supprimer?.length} copie(s) de « ${cible.nom} »`}
          sousTitre={`${cible.shop_name} — la première annonce est conservée.`}
          motifs={MOTIFS_PRODUIT}
          boutique={cible.shop_name}
          dangereux
          onFerme={() => setCible(null)}
          onValider={async ({ motif, message }) => {
            const { error } = await supabase.rpc("admin_retirer_produits", {
              p_ids: cible.supprimer, p_motif: motif, p_message: message,
            });
            if (error) throw new Error(error.message);
            setCible(null); charger(); onNettoye?.();
          }} />
      )}
    </div>
  );
}

/* ── L'historique, et le retour en arrière ────────────────────────────────── */
function Historique({ rafraichir }) {
  const [liste, setListe] = useState(null);

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("actions_admin")
      .select("*, vendor:vendors!vendor_id(shop_name)")
      .order("created_at", { ascending: false })
      .limit(60);
    setListe(data || []);
  }, []);

  useEffect(() => { charger(); }, [charger, rafraichir]);

  const retablir = async (a) => {
    const { error } = await supabase.rpc("admin_retablir_produit", { p_action_id: a.id });
    if (error) { alert(error.message); return; }
    charger();
  };

  const GENRES = {
    produit_retire: ["Article retiré", "bg-[#FEE7E5] text-[#B12704]"],
    produit_masque: ["Article masqué", "bg-[#FFF3CD] text-[#8A6D00]"],
    boutique_suspendue: ["Boutique suspendue", "bg-[#FEE7E5] text-[#B12704]"],
    boutique_retablie: ["Boutique rouverte", "bg-[#E8F5E8] text-[#007600]"],
    avertissement: ["Avertissement", "bg-[#FFF3CD] text-[#8A6D00]"],
    message: ["Message", "bg-[#EAEDED] text-[#565959]"],
  };

  return (
    <div className="bg-white rounded-xl border border-[#D5D9D9] overflow-hidden">
      <div className="bg-[#131921] px-5 py-3">
        <h3 className="text-white font-black text-sm">Ce qui a été fait, et dit</h3>
        <p className="text-[#ADBAC7] text-[11px] mt-0.5">
          Chaque vendeur voit la partie qui le concerne depuis son comptoir. Un
          article retiré garde sa copie : il peut être remis en ligne.
        </p>
      </div>

      {liste === null ? (
        <p className="px-5 py-6 text-[13px] text-[#565959]">Chargement…</p>
      ) : liste.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-[#565959]">Rien encore.</p>
      ) : (
        <div className="divide-y divide-[#EBEBEB]">
          {liste.map((a) => {
            const [label, couleur] = GENRES[a.genre] || ["Action", "bg-[#EAEDED] text-[#565959]"];
            return (
              <div key={a.id} className="px-5 py-3 flex gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${couleur}`}>
                      {label}
                    </span>
                    <span className="text-[12px] font-bold text-[#0F1111]">
                      {a.vendor?.shop_name || "Boutique supprimée"}
                    </span>
                    {a.cible && <span className="text-[11px] text-[#565959]">· {a.cible}</span>}
                  </div>
                  <p className="text-[11px] text-[#565959] whitespace-pre-line mt-1 line-clamp-3">
                    {a.message}
                  </p>
                  <p className="text-[10px] text-[#ADB1B8] mt-1">
                    {new Date(a.created_at).toLocaleString("fr-FR")}
                    {a.motif ? ` · ${a.motif}` : ""}
                  </p>
                </div>
                {a.copie && (
                  <button onClick={() => retablir(a)}
                    className="text-[12px] font-bold text-[#0F1111] border border-[#D5D9D9] rounded-lg px-3 py-1.5 h-fit whitespace-nowrap">
                    Remettre en ligne
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── L'onglet ─────────────────────────────────────────────────────────────── */
export default function MessagerieAdmin() {
  const [boutiques, setBoutiques] = useState([]);
  const [tic, setTic] = useState(0);

  useEffect(() => {
    supabase.from("vendors").select("id, shop_name").order("shop_name")
      .then(({ data }) => setBoutiques(data || []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-[#131921] rounded-xl px-5 py-4 flex items-start gap-3">
        <i className="fa-solid fa-comment-dots text-[#FF9900] mt-0.5" />
        <p className="text-[11px] text-[#ADBAC7] leading-relaxed">
          Plus aucune action de l'administration n'est muette. Supprimer un article,
          suspendre une boutique — chaque geste écrit au vendeur et laisse une ligne
          qu'il peut relire depuis son comptoir. C'est ce qui manquait quand un
          commerçant partait avec 44 articles et en retrouvait 41.
        </p>
      </div>

      <EcrireABoutique boutiques={boutiques} onEnvoye={() => setTic((t) => t + 1)} />
      <Doublons onNettoye={() => setTic((t) => t + 1)} />
      <Historique rafraichir={tic} />
    </div>
  );
}
