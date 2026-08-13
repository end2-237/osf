/* ════════════════════════════════════════════════════════════════════════════
   LA NOTE D'UN PRODUIT VIENT DE SES AVIS, OU N'EXISTE PAS

   Les cartes produit affichaient une note calculée à partir du premier
   caractère de l'identifiant :

       rating = 3.8 + (id.charCodeAt(0) % 12) * 0.1
       count  = 10  + (id.charCodeAt(0) % 200)

   Autrement dit une note inventée, comprise entre 3,8 et 4,9, accompagnée
   d'un nombre d'avis inventé entre 10 et 209. Elle ne bougeait jamais, quoi
   qu'écrivent les clients. Un vendeur pouvait recevoir un vrai cinq étoiles
   et ne rien voir changer — c'est exactement ce qui s'est passé.

   C'est aussi un problème de fond : sur une place de marché, le nombre
   d'avis est ce sur quoi un acheteur s'appuie pour décider. L'inventer, même
   pour meubler une page vide, revient à mentir sur le seul chiffre qu'on lui
   demande de croire.

   Ce module va donc chercher les vraies notes. Comme les cartes s'affichent
   par dizaines et qu'une requête par carte serait absurde, les demandes sont
   regroupées : chaque carte s'inscrit, on attend une fenêtre courte, puis on
   émet une seule requête pour tout le lot. Le résultat est gardé en mémoire
   pour la durée de la visite.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { logError } from "./track";

const FENETRE = 60;    // ms d'attente avant d'émettre le lot
const PAQUET  = 150;   // identifiants par requête, pour ne pas faire d'URL géante

/**
 * Agrège des lignes d'avis en moyenne et compte par produit.
 * Fonction pure, sans réseau : c'est la partie qu'on peut tester.
 */
export function agreger(lignes = []) {
  const par = {};
  for (const l of lignes) {
    if (!l || !l.product_id) continue;
    const n = Number(l.rating);
    if (!Number.isFinite(n) || n < 1 || n > 5) continue;
    (par[l.product_id] ||= { total: 0, n: 0 });
    par[l.product_id].total += n;
    par[l.product_id].n += 1;
  }
  const out = {};
  for (const [id, x] of Object.entries(par)) {
    out[id] = { moy: Math.round((x.total / x.n) * 10) / 10, n: x.n };
  }
  return out;
}

/** Note retenue pour un produit : les avis Buyticle d'abord, le fournisseur
 *  ensuite, rien du tout si ni l'un ni l'autre. Jamais de valeur inventée. */
export function noteAffichable(produit, avis) {
  if (avis && avis.n > 0) return { rating: avis.moy, count: avis.n, source: "buyticle" };
  const moy = Number(produit?.rating_avg), n = Number(produit?.review_count);
  if (Number.isFinite(moy) && moy > 0 && Number.isFinite(n) && n > 0)
    return { rating: moy, count: n, source: "fournisseur" };
  return null;
}

/* ── Le regroupement des demandes ──────────────────────────────────────── */

const cache    = new Map();   // id → { moy, n }   (une entrée à 0 vaut « pas d'avis »)
const attente  = new Set();   // ids demandés, pas encore interrogés
const abonnes  = new Set();   // fonctions à rappeler quand le cache bouge
let   minuteur = null;

const prevenir = () => abonnes.forEach(f => { try { f(); } catch { /* un abonné ne casse pas les autres */ } });

async function vider() {
  minuteur = null;
  const ids = [...attente];
  attente.clear();
  if (!ids.length) return;

  for (let i = 0; i < ids.length; i += PAQUET) {
    const lot = ids.slice(i, i + PAQUET);
    const { data, error } = await supabase
      .from("reviews")
      .select("product_id, rating")
      .eq("approved", true)
      .in("product_id", lot);

    if (error) {
      logError(error, "productRatings:reviews");
      // On ne marque rien : un échec réseau ne doit pas figer « aucun avis »
      // jusqu'à la fin de la visite. La prochaine carte redemandera.
      continue;
    }

    const agrege = agreger(data || []);
    // Les identifiants sans ligne existent bel et bien : ils n'ont pas d'avis.
    // On les mémorise aussi, sinon on les redemande indéfiniment.
    for (const id of lot) cache.set(id, agrege[id] || { moy: 0, n: 0 });
  }
  prevenir();
}

function demander(id) {
  if (!id || cache.has(id) || attente.has(id)) return;
  attente.add(id);
  if (!minuteur) minuteur = setTimeout(vider, FENETRE);
}

/** Remplit le cache depuis des avis déjà chargés par la page, pour éviter une
 *  seconde requête quand l'appelant a déjà tout sous la main. */
export function amorcer(lignes, idsCouverts = []) {
  const agrege = agreger(lignes);
  for (const id of idsCouverts) cache.set(id, agrege[id] || { moy: 0, n: 0 });
  for (const [id, v] of Object.entries(agrege)) cache.set(id, v);
  prevenir();
}

/** À usage des tests : repartir d'un cache vide. */
export function reinitialiser() {
  cache.clear(); attente.clear();
  if (minuteur) { clearTimeout(minuteur); minuteur = null; }
}

/**
 * Note réelle d'un produit. Renvoie `null` tant qu'on ne sait pas, et
 * `{ moy: 0, n: 0 }` quand on sait qu'il n'y a pas d'avis — les deux cas
 * s'affichent différemment.
 */
export function useProductRating(productId) {
  const [, refaire] = useState(0);

  useEffect(() => {
    if (!productId) return;
    const f = () => refaire(n => n + 1);
    abonnes.add(f);
    demander(productId);
    return () => { abonnes.delete(f); };
  }, [productId]);

  return productId ? (cache.get(productId) || null) : null;
}
