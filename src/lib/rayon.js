import { supabase } from './supabase';

/* ══════════════════════════════════════════════════════════════════════════
   LE RAYON, CÔTÉ NAVIGATEUR

   Miroir exact de docs/sql/23-rayons.sql. Les mêmes calculs existent en base
   — c'est la base qui fait foi — mais le formulaire produit doit montrer au
   commerçant, pendant qu'il tape, ce que son prix net devient à l'affichage.
   Un aller-retour serveur à chaque frappe serait absurde.

   Toute modification ici doit être reportée dans le SQL, et l'inverse.
   ══════════════════════════════════════════════════════════════════════════ */

/* Valeurs de platform_policy. Chargées une fois, gardées en mémoire ; celles
   écrites ici sont les valeurs par défaut de la migration et servent tant que
   le chargement n'a pas eu lieu. */
export const BAREME_DEFAUT = {
  majoration_bps:      1300,   // 13 % ajoutés au-dessus du prix net
  part_buyticle_bps:    300,   //  3 % — notre commission
  part_remise_bps:      500,   //  5 % — rendus au client relayé
  part_bon_bps:         500,   //  5 % — le bon de la boutique qui a envoyé
  remise_directe_bps:  1000,   // 10 % — sans envoyeur, le bon revient au client
  bon_validite_heures:   48,
  appel_secondes:        30,
};

let _bareme = null;
let _enCours = null;

export async function chargerBareme() {
  if (_bareme) return _bareme;
  if (_enCours) return _enCours;
  _enCours = supabase
    .from('platform_policy')
    .select('majoration_bps, part_buyticle_bps, part_remise_bps, part_bon_bps, remise_directe_bps, bon_validite_heures, appel_secondes')
    .maybeSingle()
    .then(({ data, error }) => {
      // supabase-js ne lève pas : l'erreur est dans `error`, jamais en exception.
      if (error) console.error('[rayon] barème:', error.code, error.message);
      _bareme = { ...BAREME_DEFAUT, ...(data || {}) };
      _enCours = null;
      return _bareme;
    });
  return _enCours;
}

export const baremeCourant = () => _bareme || BAREME_DEFAUT;

/* ── Les prix ────────────────────────────────────────────────────────────── */

/**
 * Le prix affiché sur la plateforme.
 * Le prix saisi par une boutique de rayon EST son prix net : ce qu'elle touche
 * en entier. La majoration est ajoutée par-dessus et portée par l'acheteur.
 * Hors rayon, le prix s'affiche tel quel.
 */
export function prixAffiche(prixNet, { enRayon = true, bareme = baremeCourant() } = {}) {
  const net = Number(prixNet);
  if (!Number.isFinite(net) || net <= 0) return 0;
  if (!enRayon) return Math.round(net);
  return Math.round(net * (1 + bareme.majoration_bps / 10000));
}

/**
 * Ce que le client paie réellement.
 * Relayé, il garde 5 % de remise. Venu de lui-même, il en a 10 % : les 5 % du
 * bon n'ont pas de destinataire, et on ne les garde pas. Revenir seul coûte
 * donc moins cher que d'être envoyé — c'est voulu.
 */
export function prixClient(prixNet, { relaye = true, enRayon = true, bareme = baremeCourant() } = {}) {
  const net = Number(prixNet);
  if (!Number.isFinite(net) || net <= 0) return 0;
  if (!enRayon) return Math.round(net);
  const remise = relaye ? bareme.part_remise_bps : bareme.remise_directe_bps;
  return Math.round(net * (1 + (bareme.majoration_bps - remise) / 10000));
}

/**
 * Les quatre lignes d'une vente relayée. Sert au formulaire produit, à la
 * fiche article et au relevé du commerçant — toujours les mêmes nombres.
 */
export function decomposer(prixNet, { relaye = true, enRayon = true, bareme = baremeCourant() } = {}) {
  const net = Math.round(Number(prixNet) || 0);
  if (!enRayon || net <= 0) {
    return { net, affiche: net, paye: net, buyticle: 0, remise: 0, bon: 0, enRayon: false };
  }
  const remiseBps = relaye ? bareme.part_remise_bps : bareme.remise_directe_bps;
  return {
    net,
    affiche:  prixAffiche(net, { enRayon, bareme }),
    paye:     prixClient(net, { relaye, enRayon, bareme }),
    buyticle: Math.round(net * bareme.part_buyticle_bps / 10000),
    remise:   Math.round(net * remiseBps / 10000),
    bon:      relaye ? Math.round(net * bareme.part_bon_bps / 10000) : 0,
    enRayon:  true,
  };
}

/* ── Les familles ────────────────────────────────────────────────────────── */

/* p = 2,2 / racine(variantes), plafonné à 0,60.
   Le coefficient a été calé pour retrouver les nombres du chapitre 4 de la
   stratégie. Il reste à vérifier au terrain. */
export const familleP = (variantes) =>
  Math.min(0.6, 2.2 / Math.sqrt(Math.max(Number(variantes) || 1, 1)));

/* Porteurs nécessaires pour couvrir 90 % des demandes, jamais moins de quatre :
   en dessous, le départ d'une seule boutique fait s'effondrer la famille. */
export const famillePorteursRequis = (variantes) =>
  Math.max(4, Math.ceil(1 + Math.log(0.1) / Math.log(1 - familleP(variantes))));

export const familleCouverture = (variantes, porteurs) =>
  porteurs < 2 ? 0 : 1 - Math.pow(1 - familleP(variantes), porteurs - 1);

/* ── L'appartenance d'une boutique ───────────────────────────────────────── */

const _rayonParVendeur = new Map();

/** Renvoie l'appartenance au rayon, ou null. Mémorisé pour la session. */
export async function rayonDuVendeur(vendorId) {
  if (!vendorId) return null;
  if (_rayonParVendeur.has(vendorId)) return _rayonParVendeur.get(vendorId);

  const { data, error } = await supabase
    .from('boutique_rayon')
    .select('rayon_id, categorie, profil, genre, abonnement_fcfa, rayons(nom, zone, ville, statut)')
    .eq('vendor_id', vendorId)
    .eq('actif', true)
    .maybeSingle();

  if (error) console.error('[rayon] appartenance:', error.code, error.message);
  const res = data && data.rayons?.statut === 'actif' ? data : null;
  _rayonParVendeur.set(vendorId, res);
  return res;
}

export const oublierRayon = (vendorId) =>
  vendorId ? _rayonParVendeur.delete(vendorId) : _rayonParVendeur.clear();

export const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} F`;
